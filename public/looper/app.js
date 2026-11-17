// Looper page code (Phase 1: one loop). All timing lives in engine-worklet.js; this file only sends it commands,
// routes its outputs through native gain / pan nodes, and draws what the audio clock says.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const MAX_FIRST_SEC = 12;           // longest first loop (this is the master length limit)
  const LAT_KEY = 'looper.latency.v1';
  const NSLOT = 24;
  const DEMO = /[?&]test\b/.test(location.search);

  let ctx = null, node = null, mic = null, master = null, sr = 48000;
  const mk = () => ({ st: 0, k: 1, len: 0, layers: 0, muted: false, pend: null, od: false, rel: 0 });
  const SL = Array.from({ length: NSLOT }, mk);   // mirror of every slot in the worklet
  let sel = 0;                                     // selected slot (drives the big ring and controls)
  let S = SL[0];
  const COLORS = ['#fbbf24','#38bdf8','#4ade80','#f472b6','#a78bfa','#fb923c','#2dd4bf','#f87171','#a3e635','#60a5fa','#e879f9','#facc15'];
  const colorOf = (i) => COLORS[i % COLORS.length];
  const FX = {};                                   // per-slot effect {id, amt}
  const M = { t0: -1, M: 0, playing: true, bpm: 100, nBeats: 0 };
  const metro = { on: false, bpm: 100, sound: 'click', feel: 'beat', countIn: true };
  let glitches = 0, level = 0, latencySec = 0.04, pendingCal = null, outLat = 0;
  const chain = [];
  let room = null;

  // ---------- tiny helpers ----------
  const status = (t, err) => { const s = $('status'); s.textContent = t || ''; s.classList.toggle('err', !!err); };
  const post = (m, tr) => node && node.port.postMessage(m, tr || []);
  const bump = () => { const b = $('bigBtn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); };
  const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} };
  const press = (el, fn) => el.addEventListener('pointerdown', (e) => { if (el.disabled) return; if (e.button > 0) return; e.preventDefault(); fn(e); });

  // ---------- audio start (must come from a tap: autoplay rules) ----------
  async function start() {
    $('startBtn').disabled = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
      await ctx.resume();
      sr = ctx.sampleRate;
      await ctx.audioWorklet.addModule('engine-worklet.js');
      node = new AudioWorkletNode(ctx, 'looper-engine', { numberOfInputs: 1, numberOfOutputs: NSLOT + 1, outputChannelCount: new Array(NSLOT + 1).fill(1) });
      node.port.onmessage = onMsg;
      // graph: loops -> gain -> pan -> master -> compressor -> speakers (effects will slot in after the pan in Phase 2)
      master = ctx.createGain(); master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 12; comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.2;
      master.connect(comp); comp.connect(ctx.destination);
      const mg = ctx.createGain(); mg.gain.value = 1; node.connect(mg, 0); mg.connect(master);
      room = makeRoom();
      for (let i = 0; i < NSLOT; i++) {
        const g = ctx.createGain(), p = ctx.createStereoPanner(), dry = ctx.createGain(), out = ctx.createGain();
        node.connect(g, 1 + i); g.connect(p); p.connect(dry); dry.connect(out); out.connect(master);
        g.gain.value = 0.8 ** 2 * 1.2; chain.push({ g, p, dry, out, fx: null });
        SL[i].vol = 80; SL[i].pan = 0;
      }
      try { latencySec = JSON.parse(localStorage.getItem(LAT_KEY)).sec; } catch (e) { latencySec = (ctx.baseLatency || 0.01) + (ctx.outputLatency || 0.02) + 0.02; }
      applyLatency();
      if (DEMO) { $('testPanel').hidden = false; }
      let micOk = false;
      if (!DEMO) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1, latency: 0 } });
          mic = ctx.createMediaStreamSource(stream); mic.connect(node); micOk = true;
        } catch (e) { status('The microphone is off, so you can’t record. Allow it in your browser and reload.', true); }
      }
      $('splash').hidden = true;
      post({ type: 'metro', on: false, bpm: metro.bpm, sound: metro.sound, feel: metro.feel, countIn: metro.countIn, perBar: 4 });
      if (micOk) status(localStorage.getItem(LAT_KEY) ? '' : 'Tip: do the Sound check below once so layers line up.');
      ctx.onstatechange = () => { if (ctx.state !== 'running') ctx.resume().catch(() => {}); };
      document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx.state !== 'running') ctx.resume().catch(() => {}); });
      requestAnimationFrame(frame);
    } catch (e) {
      $('startBtn').disabled = false;
      $('splashMsg').textContent = 'Could not start the audio: ' + (e && e.message ? e.message : e);
    }
  }
  const applyLatency = () => post({ type: 'setup', latency: Math.round(latencySec * sr) });

  // ---------- messages from the engine ----------
  function onMsg(e) {
    const m = e.data;
    switch (m.type) {
      case 'slot': { Object.assign(SL[m.i], { st: m.st, k: m.k, len: m.len, layers: m.layers, muted: m.muted, pend: m.pend, od: m.od, rel: m.rel }); if (m.note && m.i === sel) status(m.note === 'od-refused' ? 'Can’t add another layer right now.' : ''); tileRender(m.i); if (m.i === sel) render(); } break;
      case 'master': Object.assign(M, { t0: m.t0, M: m.M, playing: m.playing, bpm: m.bpm, nBeats: m.nBeats }); if (m.M && metro.on) $('bpmOut').textContent = Math.round(m.bpm); render(); break;
      case 'level': level = m.peak; glitches = m.glitches; break;
      case 'cal': finishCal(m); break;
      case 'snap': if (snapWait) snapWait.snaps.push(m); break;
      case 'snapDone': if (snapWait) { const w = snapWait; snapWait = null; w.res(w.snaps); } break;
      case 'metro': break;
      case 'free': break;                                  // buffer handed back; let it be garbage collected on the page
    }
  }

  // ---------- the big button ----------
  const MAX_TOTAL = 150e6;   // bytes of loop audio we allow ourselves (see HANDOFF)
  function bytesUsed() { let n = 0; for (const x of SL) if (x.len) n += x.len * 4 * (1 + x.layers); return n; }
  let kPick = 1;
  function postRec() {
    const first = !M.M, k = first ? 1 : kPick;
    const frames = first ? Math.round((MAX_FIRST_SEC + 0.6) * sr) : k * M.M + Math.round(0.5 * sr) + 4096;
    if (!first && bytesUsed() + frames * 4 > MAX_TOTAL) { status('That is a lot of sound for this device! Erase a loop first.', true); return; }
    const b = new Float32Array(frames).buffer;
    node.port.postMessage({ type: 'record', slot: sel, buf: b, k }, [b]);
  }
  function bigAction2() {
    if (!node) return;
    bump(); buzz();
    if (S.st === 0 && !S.pend) {
      if (!mic && !DEMO) { status('Allow the microphone first.', true); return; }
      postRec();
    } else if (S.st === 4 || S.st === 1) node.port.postMessage({ type: 'stopRec', slot: sel });
    else if (S.st === 2 && (S.od || S.pend === 'od')) node.port.postMessage({ type: 'stopOverdub', slot: sel });
    else if (S.st === 2 && !S.pend) { const b = new Float32Array(S.len).buffer; node.port.postMessage({ type: 'overdub', slot: sel, buf: b }, [b]); }
    else if (S.st === 3) node.port.postMessage({ type: 'play', slot: sel });
  }

  // ---------- drawing what the engine state means ----------
  function stateName() {
    if (S.st === 4) return 'count';
    if (S.st === 1) return 'rec';
    if (S.st === 2) return S.od || S.pend === 'od' ? 'od' : 'play';
    if (S.st === 3) return 'stopped';
    return S.pend === 'rec' ? 'rec' : 'empty';
  }
  const LABEL = {
    empty: ['⏺', 'Record'], count: ['…', 'Get ready'], rec: ['⏹', 'Done'], play: ['➕', 'Layer'], od: ['⏹', 'Done layer'], stopped: ['▶️', 'Play'],
  };
  function render() {
    const name = stateName();
    $('stage').dataset.state = name;
    const lab = LABEL[name];
    $('bigIco').textContent = lab[0]; $('bigTxt').textContent = lab[1];
    $('bigBtn').setAttribute('aria-label', lab[1]);
    const has = S.st >= 2;
    $('playBtn').disabled = !has; $('muteBtn').disabled = !has; $('clearBtn').disabled = !(S.st > 0);
    $('undoBtn').disabled = !(S.layers > 0 || S.od || S.pend === 'od');
    $('playIco').textContent = S.st === 3 || S.pend === 'play' ? '▶️' : '⏹'; $('playTxt').textContent = S.st === 3 ? 'Play' : 'Stop';
    $('muteBtn').setAttribute('aria-pressed', String(S.muted));
    $('muteBtn').firstElementChild.textContent = S.muted ? '🔇' : '🔊';
    $('lead').textContent = { empty: 'Make a sound, loop it, layer it.', count: 'Get ready…', rec: 'Recording! Tap Done when you are finished.', play: 'Your loop is playing. Tap Layer to add more!', od: 'Layering… play along!', stopped: 'Paused. Tap Play.' }[name];
    $('sizeRow').hidden = !(M.M && S.st === 0 && !S.pend);
    $('bpmUp').disabled = $('bpmDn').disabled = !!M.M;
  }

  // rAF: only touches the ring, the dot and the mic bar. Position comes from the audio clock, not from app state.
  const C = 552.92;
  let lastCycle = -1, ts = { ctxT: 0, perf: 0 };
  function audioNowFrames() {
    const t = ctx.getOutputTimestamp ? ctx.getOutputTimestamp() : null;
    let sec;
    if (t && t.contextTime > 0) sec = t.contextTime + (performance.now() - t.performanceTime) / 1000;
    else sec = ctx.currentTime - (ctx.outputLatency || 0);
    return sec * sr;
  }
  function frame() {
    const f = audioNowFrames(), prog = $('prog'), head = $('head');
    let frac = 0, show = false;
    if (S.st === 1 && M.t0 >= 0) { frac = Math.max(0, Math.min(1, (f - M.t0) / (MAX_FIRST_SEC * sr))); show = true; }
    else if (S.st === 4 && M.t0 >= 0) {
      const bar = Math.round(sr * 60 / metro.bpm) * 4, left = M.t0 - f;
      frac = Math.max(0, Math.min(1, 1 - left / bar)); show = true;
      const beat = Math.min(4, Math.max(1, 4 - Math.floor(left / (bar / 4))));
      const n = String(beat); if ($('bigIco').textContent !== n) { $('bigIco').textContent = n; bump(); }
    } else if (S.st >= 2 && S.len && M.t0 >= 0 && M.playing) {
      const p = (((f - M.t0 - S.rel) % S.len) + S.len) % S.len;
      frac = p / S.len; show = true;
      const cyc = Math.floor((f - M.t0) / (M.M || S.len));
      if (cyc !== lastCycle) { lastCycle = cyc; if (S.st === 2) bump(); }
    }
    prog.style.strokeDashoffset = show ? (C * (1 - frac)).toFixed(1) : C;
    head.setAttribute('transform', 'rotate(' + (frac * 360).toFixed(2) + ' 100 100)');
    tileFrame(f);
    $('micBar').style.width = Math.min(100, level * 160).toFixed(0) + '%';
    requestAnimationFrame(frame);
  }

  // ---------- controls ----------
  press($('bigBtn'), bigAction2);
  press($('playBtn'), () => { if (S.st === 2) node.port.postMessage({ type: 'stop', slot: sel }); else if (S.st === 3) node.port.postMessage({ type: 'play', slot: sel }); });
  press($('muteBtn'), () => node.port.postMessage({ type: 'mute', slot: sel, on: !S.muted }));
  press($('undoBtn'), () => node.port.postMessage({ type: 'undo', slot: sel }));
  press($('clearBtn'), () => ask('Erase this loop?', 'Erase', () => { node.port.postMessage({ type: 'clear', slot: sel }); status('Loop erased.'); }));
  function ask(q, yes, fn) {
    $('modalQ').textContent = q; $('mYes').textContent = yes; $('modal').hidden = false;
    const done = (ok) => { $('modal').hidden = true; $('mYes').onpointerdown = $('mNo').onpointerdown = null; if (ok) fn(); };
    $('mYes').onpointerdown = (e) => { e.preventDefault(); done(true); };
    $('mNo').onpointerdown = (e) => { e.preventDefault(); done(false); };
  }
  document.addEventListener('keydown', (e) => {
    if (!node || e.repeat || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); bigAction2(); }
    else if (e.key === 'p' || e.key === 'P') { if (S.st === 2) node.port.postMessage({ type: 'stop', slot: sel }); else if (S.st === 3) node.port.postMessage({ type: 'play', slot: sel }); }
    else if (e.key === 'm' || e.key === 'M') node.port.postMessage({ type: 'mute', slot: sel, on: !S.muted });
    else if (e.key === 'u' || e.key === 'U') node.port.postMessage({ type: 'undo', slot: sel });
  });

  // volume and pan: smoothed so nothing clicks or zips
  $('vol').addEventListener('input', () => { S.vol = +$('vol').value; if (chain[sel]) chain[sel].g.gain.setTargetAtTime((S.vol / 100) ** 2 * 1.2, ctx.currentTime, 0.02); });
  let panSet = null;
  (() => {
    const el = $('pan'), th = $('panThumb'), track = el.querySelector('.pantrack');
    let v = 0;
    const set = (x, quiet) => { v = Math.max(-1, Math.min(1, x)); S.pan = v; th.style.left = (50 + v * 50) + '%'; el.setAttribute('aria-valuenow', Math.round(v * 100)); if (!quiet && chain[sel]) chain[sel].p.pan.setTargetAtTime(v, ctx.currentTime, 0.02); };
    panSet = (x) => { v = x; set(x, true); };
    const fromEv = (e) => { const r = track.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 2 - 1); };
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); fromEv(e); el.onpointermove = fromEv; });
    el.addEventListener('pointerup', () => { el.onpointermove = null; });
    el.addEventListener('dblclick', () => set(0));
    el.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') set(v - 0.1); else if (e.key === 'ArrowRight') set(v + 0.1); else if (e.key === 'Home') set(0); });
  })();


  // ---------- the 24 slots: tiles, selection, size, effects ----------
  const TILE_ST = ['empty', 'play', 'play', 'stopped', 'count'];
  const tiles = [];
  function buildGrid() {
    const grid = $('grid');
    for (let i = 0; i < NSLOT; i++) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tile'; b.style.setProperty('--c', colorOf(i)); b.setAttribute('aria-label', 'Loop ' + (i + 1));
      b.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle class="tt" cx="20" cy="20" r="16"/><circle class="tp" cx="20" cy="20" r="16" transform="rotate(-90 20 20)"/></svg><span class="tn">' + (i + 1) + '</span><span class="tk"></span>';
      press(b, () => select(i));
      grid.appendChild(b); tiles.push({ b, p: b.querySelector('.tp'), k: b.querySelector('.tk'), last: '' });
    }
    tiles[0].b.classList.add('sel');
  }
  const TC = 100.53;
  function tileName(x) { return x.st === 4 ? 'count' : x.st === 1 ? 'rec' : x.st === 2 ? (x.od || x.pend === 'od' ? 'od' : 'play') : x.st === 3 ? 'stopped' : x.pend === 'rec' ? 'arm' : 'empty'; }
  function tileRender(i) {
    const x = SL[i], t = tiles[i]; if (!t) return;
    const n = tileName(x) + (x.muted ? ' muted' : '');
    if (t.last !== n) { t.last = n; t.b.dataset.s = tileName(x); t.b.classList.toggle('muted', x.muted); }
    t.k.textContent = x.len ? (x.k > 1 ? x.k + '×' : '') : '';
    if (!x.len) t.p.style.strokeDashoffset = TC;
  }
  function tileFrame(f) {
    for (let i = 0; i < NSLOT; i++) {
      const x = SL[i]; if (x.st < 2 || !x.len || M.t0 < 0 || !M.playing || i === sel && false) continue;
      const p = (((f - M.t0 - x.rel) % x.len) + x.len) % x.len;
      tiles[i].p.style.strokeDashoffset = (TC * (1 - p / x.len)).toFixed(1);
    }
  }
  function select(i) {
    if (i === sel) { return; }
    tiles[sel].b.classList.remove('sel'); sel = i; S = SL[i]; tiles[i].b.classList.add('sel');
    $('stage').style.setProperty('--loop', colorOf(i));
    $('slotName').textContent = 'Loop ' + (i + 1);
    $('vol').value = S.vol; panSet(S.pan || 0); fxShow(); status(''); render();
  }
  // size chips (1x/2x/4x): only for a loop that has not been recorded yet, and only once a master loop exists
  ['1×', '2×', '4×'].forEach((t, j) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (j === 0 ? ' on' : ''); b.textContent = t; b.dataset.k = [1, 2, 4][j];
    press(b, () => { kPick = +b.dataset.k; $('sizeChips').querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b)); });
    $('sizeChips').appendChild(b);
  });

  // effects: ONE per loop, one amount slider. All built from native nodes, after the panner, so timing is untouched.
  const FXLIST = [['none', '🚫', 'None'], ['echo', '🔁', 'Echo'], ['room', '🏛️', 'Big Room'], ['water', '🌊', 'Underwater'], ['crunch', '🔥', 'Crunchy']];
  function makeRoom() {
    const len = Math.round(sr * 1.8), buf = ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    const cv = ctx.createConvolver(); cv.buffer = buf; const wet = ctx.createGain(); wet.gain.value = 0.9; cv.connect(wet); wet.connect(master); return cv;
  }
  const crunchCurve = (() => { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * 4) / Math.tanh(4); } return c; })();
  function fxApply(i) {
    const ch = chain[i], f = FX[i] || { id: 'none', amt: 50 }, t = ctx.currentTime, a = f.amt / 100;
    if (!ch.fx || ch.fx.id !== f.id) {
      if (ch.fx) { ch.fx.nodes.forEach((n) => { try { n.disconnect(); } catch (e) {} }); }
      ch.fx = { id: f.id, nodes: [] };
      const add = (...n) => { ch.fx.nodes.push(...n); return n[0]; };
      if (f.id === 'echo') {
        const d = add(ctx.createDelay(2)), fb = add(ctx.createGain()), w = add(ctx.createGain());
        d.delayTime.value = Math.min(1.9, 60 / (M.bpm || metro.bpm || 100) * 0.75); fb.gain.value = 0.42;
        ch.p.connect(d); d.connect(fb); fb.connect(d); d.connect(w); w.connect(ch.out); ch.fx.w = w;
      } else if (f.id === 'room') {
        const sd = add(ctx.createGain()); ch.p.connect(sd); sd.connect(room); ch.fx.w = sd;
      } else if (f.id === 'water') {
        const lp = add(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.Q.value = 6; ch.p.connect(lp); lp.connect(ch.out); ch.fx.lp = lp;
      } else if (f.id === 'crunch') {
        const pre = add(ctx.createGain()), sh = add(ctx.createWaveShaper()), post = add(ctx.createGain()); sh.curve = crunchCurve; sh.oversample = '2x';
        ch.p.connect(pre); pre.connect(sh); sh.connect(post); post.connect(ch.out); ch.fx.pre = pre; ch.fx.post = post;
      }
    }
    const x = ch.fx; ch.dry.gain.setTargetAtTime(f.id === 'water' || f.id === 'crunch' ? 0 : 1, t, 0.02);
    if (f.id === 'echo') x.w.gain.setTargetAtTime(a * 0.9, t, 0.02);
    else if (f.id === 'room') x.w.gain.setTargetAtTime(a * 1.1, t, 0.02);
    else if (f.id === 'water') x.lp.frequency.setTargetAtTime(6000 * Math.pow(0.04, a), t, 0.04);
    else if (f.id === 'crunch') { x.pre.gain.setTargetAtTime(1 + a * 5, t, 0.02); x.post.gain.setTargetAtTime(0.9 / (1 + a * 1.5), t, 0.02); }
  }
  function fxShow() {
    const f = FX[sel] || { id: 'none', amt: 50 };
    $('fxChips').querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.id === f.id));
    $('fxAmt').value = f.amt; $('fxAmtRow').hidden = f.id === 'none';
  }
  FXLIST.forEach(([id, ico, name]) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip fx'; b.dataset.id = id; b.innerHTML = ico + ' ' + name;
    press(b, () => { const f = FX[sel] = FX[sel] || { id: 'none', amt: 50 }; f.id = id; if (ctx) fxApply(sel); fxShow(); });
    $('fxChips').appendChild(b);
  });
  $('fxAmt').addEventListener('input', () => { const f = FX[sel] = FX[sel] || { id: 'none', amt: 50 }; f.amt = +$('fxAmt').value; if (ctx && f.id !== 'none') fxApply(sel); });
  buildGrid(); fxShow();

  // ---------- metronome ----------
  const SOUNDS = [['click', '🔘 Click'], ['wood', '🪵 Wood'], ['beep', '🔔 Beep'], ['hat', '🎩 Hat']];
  const FEELS = [['beat', 'Steady'], ['eighth', 'Double'], ['swing', 'Swing'], ['sixteenth', 'Fast']];
  function chips(boxId, list, key) {
    const box = $(boxId);
    list.forEach(([id, label]) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (metro[key] === id ? ' on' : ''); b.textContent = label;
      press(b, () => { metro[key] = id; box.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b)); post({ type: 'metro', [key]: id }); });
      box.appendChild(b);
    });
  }
  chips('soundChips', SOUNDS, 'sound'); chips('feelChips', FEELS, 'feel');
  const setBpm = (v) => { if (M.M) return; metro.bpm = Math.max(50, Math.min(200, v)); $('bpmOut').textContent = metro.bpm; post({ type: 'metro', bpm: metro.bpm }); };
  press($('bpmDn'), () => setBpm(metro.bpm - 4)); press($('bpmUp'), () => setBpm(metro.bpm + 4));
  press($('metOn'), () => { metro.on = !metro.on; const b = $('metOn'); b.setAttribute('aria-pressed', String(metro.on)); b.textContent = metro.on ? 'On' : 'Off'; post({ type: 'metro', on: metro.on }); });
  press($('countIn'), () => { metro.countIn = !metro.countIn; const b = $('countIn'); b.setAttribute('aria-pressed', String(metro.countIn)); b.classList.toggle('on', metro.countIn); post({ type: 'metro', countIn: metro.countIn }); });

  // ---------- latency calibration: play 8 clicks, listen with the mic, measure the round trip ----------
  press($('calBtn'), () => {
    if (!node || (!mic && !DEMO)) { status('Allow the microphone first.', true); return; }
    if (S.st !== 0) { status('Clear the loop first, then do the Sound check.', true); return; }
    $('calBtn').disabled = true; $('calTxt').textContent = 'Listening… keep it quiet for a few seconds.';
    const gap = Math.round(0.5 * sr), clicks = [];
    for (let k = 0; k < 8; k++) clicks.push(Math.round(0.6 * sr) + k * gap);
    const b = new Float32Array(Math.round(5.4 * sr)).buffer;
    node.port.postMessage({ type: 'calibrate', buf: b, clicks }, [b]);
  });
  function finishCal(m) {
    const x = new Float32Array(m.buf), res = [], win = Math.round(0.45 * sr);
    for (const c of m.clicks) {
      let mx = 0, noise = 0, n = 0;
      for (let i = c; i < c + win; i++) { const a = Math.abs(x[i]); if (a > mx) mx = a; }
      for (let i = c - Math.round(0.3 * sr); i < c - Math.round(0.05 * sr); i++) { noise += Math.abs(x[i]); n++; }
      noise /= Math.max(1, n);
      if (mx < 0.03 || mx < noise * 6) continue;           // did not hear this click
      const thr = Math.max(mx * 0.3, noise * 4);
      for (let i = c; i < c + win; i++) if (Math.abs(x[i]) >= thr) { res.push(i - c); break; }
    }
    $('calBtn').disabled = false;
    if (res.length < 4) { $('calTxt').textContent = 'I could not hear the clicks. Turn the volume up, hold the speaker near the mic, and try again. (Headphones will not work for this.)'; return; }
    res.sort((a, b) => a - b);
    const med = res[res.length >> 1], spread = res[res.length - 1] - res[0];
    latencySec = med / sr;
    try { localStorage.setItem(LAT_KEY, JSON.stringify({ sec: latencySec, at: Date.now() })); } catch (e) {}
    applyLatency();
    $('calTxt').textContent = 'Done! Your device delay is ' + Math.round(latencySec * 1000) + ' ms' + (spread > 0.005 * sr ? ' (the readings varied a bit, so try again somewhere quieter).' : '.');
    status('');
  }

  // ---------- sync soak test (?test): synthetic input, no mic ----------
  if (DEMO) {
    press($('soakBtn'), async () => {
      const out = $('soakOut'); $('soakBtn').disabled = true;
      const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 220;
      const og = ctx.createGain(); og.gain.value = 0; osc.connect(og); og.connect(node); osc.start();
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));          // only used to drive the TEST, never audio timing
      const pulse = (ms) => { og.gain.setValueAtTime(0.3, ctx.currentTime); og.gain.setValueAtTime(0, ctx.currentTime + ms / 1000); };
      postRec(); await wait(300);
      for (let k = 0; k < 4; k++) { pulse(80); await wait(500); }
      node.port.postMessage({ type: 'stopRec', slot: sel }); await wait(1500);
      for (let k = 0; k < 3; k++) {
        const b = new Float32Array(S.len).buffer; node.port.postMessage({ type: 'overdub', slot: sel, buf: b }, [b]);
        await wait(S.len / sr * 1000 + 300); pulse(60);
        await wait(S.len / sr * 1000 * 1.5);
        node.port.postMessage({ type: 'stopOverdub', slot: sel }); await wait(S.len / sr * 1000 * 1.2);
      }
      const t0 = performance.now(), g0 = glitches, c0 = ctx.currentTime;
      const timer = setInterval(() => { const m = (performance.now() - t0) / 60000; out.textContent = 'Running… ' + m.toFixed(1) + ' / 10 min. Skipped audio blocks so far: ' + (glitches - g0) + '. Layers: ' + S.layers; }, 1000);
      await wait(10 * 60 * 1000); clearInterval(timer);
      const cycles = Math.floor((ctx.currentTime * sr - M.t0) / M.M);
      out.textContent = 'Done. ' + ((performance.now() - t0) / 60000).toFixed(1) + ' min, ' + cycles + ' loop passes, layers ' + S.layers + ', skipped audio blocks: ' + (glitches - g0) + (glitches - g0 === 0 ? ' ✅ perfect: the loop is locked to the sample clock.' : ' ⚠️ the browser skipped audio; note your device.') + ' Clock check: audio ' + (ctx.currentTime - c0).toFixed(2) + ' s vs wall ' + ((performance.now() - t0) / 1000).toFixed(2) + ' s.';
      $('soakBtn').disabled = false;
    });
  }


  // ---------- Phase 3: save / open (IndexedDB, this device only) and WAV export ----------
  const keep = (t, err) => { const e = $('keepTxt'); e.textContent = t; e.style.color = err ? '#fda4af' : ''; };
  let snapWait = null;
  function grab() {
    return new Promise((res) => { snapWait = { snaps: [], res }; post({ type: 'snapshot' }); });
  }
  const gainOf = (x) => (x.muted ? 0 : ((x.vol == null ? 80 : x.vol) / 100) ** 2 * 1.2);
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open('looper', 1); r.onupgradeneeded = () => r.result.createObjectStore('sessions'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const idbDo = async (mode, fn) => { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction('sessions', mode), rq = fn(tx.objectStore('sessions')); tx.oncomplete = () => res(rq && rq.result); tx.onerror = () => rej(tx.error); }); };

  press($('saveBtn'), async () => {
    if (!node || !M.M) { keep('Record something first.', true); return; }
    keep('Saving…');
    try {
      const snaps = await grab();
      const loops = snaps.map((s) => ({ slot: s.i, len: s.len, k: s.k, rel: s.rel, muted: SL[s.i].muted, vol: SL[s.i].vol, pan: SL[s.i].pan, fx: FX[s.i] || null, data: s.buf }));
      await idbDo('readwrite', (st) => st.put({ v: 1, sr, M: M.M, saved: Date.now(), loops }, 'last'));
      keep('Saved ✅ (' + loops.length + ' loops)');
    } catch (e) { keep('Could not save: ' + (e && e.message || e), true); }
  });

  press($('loadBtn'), async () => {
    if (!node) return;
    let d; try { d = await idbDo('readonly', (st) => st.get('last')); } catch (e) { keep('Could not open saved songs here.', true); return; }
    if (!d) { keep('No saved song yet.', true); return; }
    if (d.sr !== sr) { keep('That song was saved on a device with a different audio speed (' + d.sr + ' Hz), so it can’t open here.', true); return; }
    const go = () => {
      for (let i = 0; i < NSLOT; i++) if (SL[i].st || SL[i].pend) post({ type: 'clear', slot: i });
      setTimeout(() => {
        const copies = d.loops.map((l) => { const b = l.data.slice(0); return { slot: l.slot, len: l.len, k: l.k, rel: l.rel, buf: b, muted: l.muted }; });
        node.port.postMessage({ type: 'load', M: d.M, loops: copies }, copies.map((c) => c.buf));
        for (const l of d.loops) {
          SL[l.slot].vol = l.vol == null ? 80 : l.vol; SL[l.slot].pan = l.pan || 0;
          chain[l.slot].g.gain.setTargetAtTime(gainOf({ vol: SL[l.slot].vol }), ctx.currentTime, 0.02); chain[l.slot].p.pan.setTargetAtTime(SL[l.slot].pan, ctx.currentTime, 0.02);
          if (l.fx) { FX[l.slot] = l.fx; fxApply(l.slot); }
        }
        select(d.loops[0].slot); keep('Opened ✅ ' + d.loops.length + ' loops, saved ' + new Date(d.saved).toLocaleString());
      }, 150);
    };
    if (SL.some((x) => x.st)) ask('Replace what you have now?', 'Open saved', go); else go();
  });

  press($('wavBtn'), async () => {
    if (!node || !M.M) { keep('Record something first.', true); return; }
    keep('Making your WAV…');
    const snaps = await grab();
    let T = 0; for (const s of snaps) T = Math.max(T, s.len);
    const L = new Float32Array(T), R = new Float32Array(T);
    for (const s of snaps) {
      const g = gainOf(SL[s.i]); if (!g) continue;
      const ang = ((SL[s.i].pan || 0) + 1) * Math.PI / 4, gl = Math.cos(ang) * g, gr = Math.sin(ang) * g, d = new Float32Array(s.buf);
      let j = ((-s.rel) % s.len + s.len) % s.len;
      for (let x = 0; x < T; x++) { const v = d[j]; L[x] += v * gl; R[x] += v * gr; if (++j === s.len) j = 0; }
    }
    let pk = 0; for (let x = 0; x < T; x++) pk = Math.max(pk, Math.abs(L[x]), Math.abs(R[x]));
    const sc = pk > 0.98 ? 0.98 / pk : 1;
    const out = new DataView(new ArrayBuffer(44 + T * 4));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); out.setUint32(4, 36 + T * 4, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
    out.setUint32(24, sr, true); out.setUint32(28, sr * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, T * 4, true);
    for (let x = 0; x < T; x++) { out.setInt16(44 + x * 4, Math.max(-1, Math.min(1, L[x] * sc)) * 32767, true); out.setInt16(46 + x * 4, Math.max(-1, Math.min(1, R[x] * sc)) * 32767, true); }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type: 'audio/wav' })); a.download = 'my-loop.wav'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    keep('Saved my-loop.wav (' + (T / sr).toFixed(1) + ' seconds, one time through).');
  });

  press($('startBtn'), start);
  window.__looper = DEMO ? { S, M, metro, get glitches() { return glitches; }, post, get node() { return node; }, get ctx() { return ctx; } } : undefined;
})();
