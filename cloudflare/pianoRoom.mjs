/**
 * Shared Piano rooms (Chrome Music Lab EXTRA, /chromeextra/ → Shared Piano → Play Together).
 *
 *   GET /api/piano-room/<CODE>   (WebSocket upgrade)
 *
 * Every room code maps to one Durable Object (PianoRoom) that relays note on/off messages
 * between the players connected to it. Nothing is stored: a player is only an animal emoji
 * and a server-made id, and the room disappears when the last player leaves.
 *
 * Client → server (JSON):
 *   { t: 'hello', emoji }                       pick / change your avatar
 *   { t: 'on', midi, inst }                     key down
 *   { t: 'off', midi }                          key up
 * Server → client:
 *   { t: 'welcome', you, players: [{ id, emoji }] }
 *   { t: 'roster', players: [{ id, emoji }] }   someone joined, left or changed avatar
 *   { t: 'on' | 'off', from, midi, inst? }      another player's note
 *   { t: 'full' }                               room already has MAX_PLAYERS (socket then closes)
 */

// Room codes: 4 letters/digits without look-alikes (no I, L, O, 0, 1).
export const ROOM_CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;
const ROUTE_RE = /^\/api\/piano-room\/([A-Za-z0-9]{1,8})$/;

const MAX_PLAYERS = 8;
const MAX_MESSAGE_BYTES = 200;
// Generous for a pianist (chords + fast runs) but stops a stuck loop from flooding the room.
const RATE_WINDOW_MS = 1000;
const RATE_MAX_MESSAGES = 60;

const EMOJIS = new Set(['🐶', '🐱', '🦊', '🐼', '🐨', '🐯', '🦁', '🐸', '🦉', '🦄']); // ANIMAL_AVATARS in shared-piano.js
const INSTRUMENTS = new Set(['piano', 'marimba', 'strings', 'woodwind', 'synth', 'drum-kit', 'drum-machine']);

/** Worker-side handler: validates the code and hands the WebSocket to that room's Durable Object. */
export async function handlePianoRoom(request, env) {
  const match = new URL(request.url).pathname.match(ROUTE_RE);
  const code = match ? match[1].toUpperCase() : '';
  if (!ROOM_CODE_RE.test(code)) return new Response('Bad room code', { status: 400 });
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    return new Response('Expected a WebSocket', { status: 426 });
  }
  if (!sameSite(request)) return new Response('Forbidden', { status: 403 });
  if (!env.PIANO_ROOMS) return new Response('Piano rooms are not set up', { status: 503 });
  const stub = env.PIANO_ROOMS.get(env.PIANO_ROOMS.idFromName(code));
  return stub.fetch(request);
}

/** Only pages on this site (or local dev) may open rooms. */
function sameSite(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try {
    const o = new URL(origin);
    return o.host === new URL(request.url).host || o.hostname === 'localhost' || o.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export class PianoRoom {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const sockets = this.state.getWebSockets();
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    // Hibernation API: the object can sleep between notes without dropping connections.
    this.state.acceptWebSocket(server);

    if (sockets.length >= MAX_PLAYERS) {
      server.send(JSON.stringify({ t: 'full' }));
      server.close(4000, 'Room is full');
      return new Response(null, { status: 101, webSocket: client });
    }

    const id = newPlayerId(sockets);
    server.serializeAttachment({ id, emoji: '🎹', windowStart: 0, count: 0 });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES) return;
    const me = ws.deserializeAttachment();
    if (!me) return;

    const now = Date.now();
    if (now - me.windowStart > RATE_WINDOW_MS) {
      me.windowStart = now;
      me.count = 0;
    }
    me.count++;
    if (me.count > RATE_MAX_MESSAGES) {
      ws.serializeAttachment(me);
      return;
    }

    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;

    if (msg.t === 'hello') {
      const emoji = EMOJIS.has(msg.emoji) ? msg.emoji : '🎹';
      const first = !me.joined;
      me.emoji = emoji;
      me.joined = true;
      ws.serializeAttachment(me);
      if (first) ws.send(JSON.stringify({ t: 'welcome', you: me.id, players: this.players() }));
      this.broadcast({ t: 'roster', players: this.players() }, first ? ws : null);
      return;
    }

    ws.serializeAttachment(me);
    if (!me.joined) return;
    const midi = Number(msg.midi);
    if (!Number.isInteger(midi) || midi < 0 || midi > 127) return;

    if (msg.t === 'on') {
      const inst = INSTRUMENTS.has(msg.inst) ? msg.inst : 'piano';
      this.broadcast({ t: 'on', from: me.id, midi, inst }, ws);
    } else if (msg.t === 'off') {
      this.broadcast({ t: 'off', from: me.id, midi }, ws);
    }
  }

  async webSocketClose(ws) {
    this.leave(ws);
  }

  async webSocketError(ws) {
    this.leave(ws);
  }

  leave(ws) {
    try {
      ws.close(1000, 'bye');
    } catch {
      // already closed
    }
    this.broadcast({ t: 'roster', players: this.players(ws) }, ws);
  }

  /** Players who have said hello, optionally leaving one socket out (the one that is closing). */
  players(except = null) {
    const list = [];
    for (const s of this.state.getWebSockets()) {
      if (s === except) continue;
      const a = s.deserializeAttachment();
      if (a?.joined) list.push({ id: a.id, emoji: a.emoji });
    }
    return list;
  }

  broadcast(msg, except = null) {
    const text = JSON.stringify(msg);
    for (const s of this.state.getWebSockets()) {
      if (s === except) continue;
      if (!s.deserializeAttachment()?.joined) continue;
      try {
        s.send(text);
      } catch {
        // socket went away; its close handler tidies up
      }
    }
  }
}

function newPlayerId(sockets) {
  const taken = new Set(sockets.map((s) => s.deserializeAttachment()?.id));
  for (;;) {
    const id = 'p' + Math.random().toString(36).slice(2, 8);
    if (!taken.has(id)) return id;
  }
}
