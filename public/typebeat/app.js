/* Type Beat: type letters, hear a drum loop. Plain JS, no build step.
   Each letter a-z is a drum sound from the site's shared drum kits (/audio/samples/<kit>/<sound>.mp3).
   Timing uses the Web Audio clock with a short look-ahead, so the beat stays steady even if the page is busy.
   Nothing is sent anywhere: a shared beat is stored in the link itself (#b=...). */
(function () {
  'use strict';

  var SAMPLE_BASE = '/audio/samples/';
  var KITS = [
    { id: 'drum_kit', name: 'Acoustic' },
    { id: 'drum_808', name: '808 Machine' },
    { id: 'drum_jazz', name: 'Jazz Brushes' },
    { id: 'drum_latin', name: 'Latin' }
  ];
  var C = { low: '#fb7185', snare: '#fb923c', hat: '#fcd34d', tom: '#4ade80', perc: '#38bdf8', shake: '#c4b5fd' };

  // 26 letters. The main drum sounds sit on letters that start their name (k = kick, s = snare, h = hi-hat),
  // and the rest are the same sounds played higher, lower or softer.
  var LETTERS = {
    k: { f: 'kick', n: 'Kick', c: C.low },
    f: { f: 'kick', r: 0.72, n: 'Floor kick', c: C.low },
    a: { f: 'kick', r: 1.3, n: 'Tight kick', c: C.low },
    s: { f: 'snare', n: 'Snare', c: C.snare },
    e: { f: 'snare', g: 0.45, n: 'Ghost snare', c: C.snare },
    p: { f: 'snare', r: 0.82, n: 'Fat snare', c: C.snare },
    x: { f: 'rimshot', n: 'Rim', c: C.snare },
    q: { f: 'rimshot', r: 1.25, n: 'Click', c: C.snare },
    h: { f: 'hihat', n: 'Hi-hat', c: C.hat, choke: true },
    i: { f: 'hihat', r: 1.25, n: 'Tick hat', c: C.hat, choke: true },
    j: { f: 'hihat', r: 0.85, g: 0.7, n: 'Soft hat', c: C.hat, choke: true },
    o: { f: 'hihat_open', n: 'Open hat', c: C.hat, open: true },
    c: { f: 'crash', n: 'Crash', c: C.hat },
    r: { f: 'ride', n: 'Ride', c: C.hat },
    t: { f: 'tom1', n: 'Tom', c: C.tom },
    u: { f: 'tom1', r: 1.3, n: 'High tom', c: C.tom },
    m: { f: 'tom2', n: 'Mid tom', c: C.tom },
    d: { f: 'tom3', n: 'Deep tom', c: C.tom },
    v: { f: 'tom3', r: 0.75, n: 'Very low', c: C.tom },
    b: { f: 'cowbell', n: 'Bell', c: C.perc },
    w: { f: 'cowbell', r: 1.4, n: 'High bell', c: C.perc },
    g: { f: 'conga_slap', n: 'Conga slap', c: C.perc },
    n: { f: 'conga_open', n: 'Conga', c: C.perc },
    l: { f: 'conga_open', r: 0.8, n: 'Low conga', c: C.perc },
    z: { f: 'shaker', n: 'Shaker', c: C.shake },
    y: { f: 'shaker', r: 0.8, n: 'Slow shake', c: C.shake }
  };
  var SOUND_FILES = ['kick', 'snare', 'rimshot', 'hihat', 'hihat_open', 'crash', 'ride', 'tom1', 'tom2', 'tom3', 'cowbell', 'conga_slap', 'conga_open', 'shaker'];

  var STARTERS = [
    { n: 'Rock', t: 'k.h.s.h.k.h.s.h.', bpm: 100, kit: 'drum_kit' },
    { n: 'Four on the floor', t: 'k.o.k.o.k.o.k.o.', bpm: 120, kit: 'drum_808' },
    { n: 'Funk', t: 'k.hhs.hkk.hhs.hs', bpm: 96, kit: 'drum_kit' },
    { n: 'Triplets', t: '(k.h)(s.h)(k.h)(s.h)', bpm: 90, kit: 'drum_jazz' },
    { n: 'Latin', t: 'k.nb.gnk.nb.gn.b', bpm: 104, kit: 'drum_latin' },
    { n: 'Loud and quiet', t: 'Kh.hSh.hKh.hSh.h', bpm: 100, kit: 'drum_kit' },
    { n: 'Type your name!', t: 'mr arthur', bpm: 100, kit: 'drum_kit' }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var beat = $('beat'), strip = $('strip'), playBtn = $('playBtn'), tempo = $('tempo'), tempoOut = $('tempoOut');
  var vol = $('vol'), kitSel = $('kit'), statusEl = $('status');

  // ---------------------------------------------------------------- audio
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = new AC({ latencyHint: 'interactive' });
  var master = ctx.createGain();
  master.connect(ctx.destination);
  var kitBuffers = {};          // kit id -> { file -> AudioBuffer }
  var loading = {};             // kit id -> Promise
  var kitId = KITS[0].id;
  var openHat = null;           // the open hi-hat that is ringing (a closed hat chokes it)

  function setVolume() { master.gain.value = Math.pow(vol.value / 100, 1.6); }

  // Browsers keep audio asleep until the first click or key press.
  ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) {
    document.addEventListener(ev, function wake() {
      if (ctx.state === 'running') return document.removeEventListener(ev, wake, true);
      ctx.resume();
    }, true);
  });

  function loadKit(id) {
    if (loading[id]) return loading[id];
    var map = {};
    loading[id] = Promise.all(SOUND_FILES.map(function (f) {
      return fetch(SAMPLE_BASE + id + '/' + f + '.mp3')
        .then(function (r) { if (!r.ok) throw new Error(f); return r.arrayBuffer(); })
        .then(function (b) { return ctx.decodeAudioData(b); })
        .then(function (buf) { map[f] = buf; });
    })).then(function () { kitBuffers[id] = map; return map; })
      .catch(function (e) { delete loading[id]; throw e; });
    return loading[id];
  }

  function hit(ch, when) {
    var lower = ch.toLowerCase();
    var def = LETTERS[lower];
    var bufs = kitBuffers[kitId];
    if (!def || !bufs || !bufs[def.f]) return;
    var loud = ch !== lower;
    var src = ctx.createBufferSource();
    src.buffer = bufs[def.f];
    if (def.r) src.playbackRate.value = def.r;
    var g = ctx.createGain();
    g.gain.value = (loud ? 1 : 0.7) * (def.g || 1);
    src.connect(g); g.connect(master);
    if (def.choke && openHat) { try { openHat.g.gain.setTargetAtTime(0, when, 0.01); openHat.s.stop(when + 0.08); } catch (e) { /* already ended */ } openHat = null; }
    if (def.open) openHat = { s: src, g: g };
    src.start(when);
  }

  // ---------------------------------------------------------------- the pattern
  var steps = [];    // { ch, sound: bool, mult: 1 | 2/3, i: index in the text }
  var cells = [];    // strip element per text index

  function parse(text) {
    var out = [], trip = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === '(') { trip = true; continue; }
      if (ch === ')') { trip = false; continue; }
      out.push({ ch: ch, sound: !!LETTERS[ch.toLowerCase()], mult: trip ? 2 / 3 : 1, i: i });
    }
    return out;
  }

  function render(text) {
    strip.textContent = '';
    cells = [];
    strip.classList.toggle('empty', !text);
    var trip = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i], el = document.createElement('span');
      if (ch === '(' || ch === ')') {
        el.className = 'par'; el.textContent = ch; trip = ch === '(';
      } else {
        var lower = ch.toLowerCase(), def = LETTERS[lower];
        el.className = 'cell' + (def ? '' : ' rest') + (def && ch !== lower ? ' loud' : '') + (trip ? ' trip' : '');
        if (def) { el.style.setProperty('--c', def.c); el.textContent = ch; } else { el.textContent = '·'; }
      }
      strip.appendChild(el);
      cells[i] = el;
    }
  }

  // ---------------------------------------------------------------- the clock
  var LOOKAHEAD_MS = 25, AHEAD_S = 0.1;
  var playing = false, timer = null, nextTime = 0, idx = 0, queue = [], lit = -1, userStopped = false;

  function stepSeconds() { return 15 / Number(tempo.value); }   // one letter = a sixteenth note

  function tick() {
    if (!steps.length) { nextTime = ctx.currentTime + 0.05; return; }
    while (nextTime < ctx.currentTime + AHEAD_S) {
      if (idx >= steps.length) idx = 0;
      var s = steps[idx];
      if (s.sound) hit(s.ch, nextTime);
      queue.push({ t: nextTime, i: s.i });
      nextTime += stepSeconds() * s.mult;
      idx++;
    }
  }

  function start() {
    if (playing) return;
    ctx.resume();
    loadKit(kitId).then(function () {
      if (playing) return;
      playing = true;
      idx = 0; queue = [];
      nextTime = ctx.currentTime + 0.06;
      timer = setInterval(tick, LOOKAHEAD_MS);
      tick();
      syncPlayBtn();
      requestAnimationFrame(frame);
    }, function () { say('Could not load the drum sounds. Check your connection and try again.', true); });
  }

  function stop() {
    playing = false;
    clearInterval(timer); timer = null; queue = [];
    setLit(-1);
    syncPlayBtn();
  }

  function syncPlayBtn() {
    playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    $('playIco').textContent = playing ? '■' : '▶';
    $('playTxt').textContent = playing ? 'Stop' : 'Play';
  }

  function setLit(i) {
    if (i === lit) return;
    if (cells[lit]) cells[lit].classList.remove('on');
    lit = i;
    if (cells[lit]) cells[lit].classList.add('on');
  }

  function frame() {
    if (!playing) return;
    var now = ctx.currentTime - (ctx.outputLatency || 0);
    var i = lit;
    while (queue.length && queue[0].t <= now) i = queue.shift().i;
    setLit(i);
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- UI
  var statusTimer = null;
  function say(msg, err) {
    statusEl.textContent = msg;
    statusEl.classList.toggle('err', !!err);
    clearTimeout(statusTimer);
    if (msg) statusTimer = setTimeout(function () { statusEl.textContent = ''; }, 4000);
  }

  function setLink() {
    var text = beat.value;
    var h = text ? '#b=' + encodeURIComponent(text) + '&t=' + tempo.value + '&k=' + kitId : '';
    try { history.replaceState(null, '', location.pathname + location.search + h); } catch (e) { /* sandboxed */ }
  }

  function onText() {
    var text = beat.value;
    steps = parse(text);
    if (idx >= steps.length) idx = 0;
    setLit(-1);
    render(text);
    setLink();
    if (!playing && !userStopped && steps.some(function (s) { return s.sound; })) start();
  }

  function setKit(id) {
    if (!KITS.some(function (k) { return k.id === id; })) id = KITS[0].id;
    kitId = id; kitSel.value = id;
    loadKit(id).then(function () { setLink(); }, function () { say('Could not load that drum kit.', true); });
  }

  playBtn.addEventListener('click', function () {
    if (playing) { userStopped = true; stop(); } else { userStopped = false; start(); }
  });
  beat.addEventListener('input', onText);
  beat.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); playBtn.click(); }
  });
  tempo.addEventListener('input', function () { tempoOut.textContent = tempo.value; setLink(); });
  vol.addEventListener('input', setVolume);
  kitSel.addEventListener('change', function () { setKit(kitSel.value); });
  $('clearBtn').addEventListener('click', function () { beat.value = ''; onText(); beat.focus(); });
  $('shareBtn').addEventListener('click', function () {
    if (!beat.value) return say('Type something first!', true);
    setLink();
    var url = location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { say('Link copied! Anyone who opens it hears your beat.'); },
        function () { say('Copy this address from the top of your browser.'); });
    } else { say('Copy this address from the top of your browser.'); }
  });

  KITS.forEach(function (k) {
    var o = document.createElement('option'); o.value = k.id; o.textContent = k.name; kitSel.appendChild(o);
  });

  // starter beats
  STARTERS.forEach(function (s) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'starter'; b.textContent = s.n;
    b.addEventListener('click', function () {
      beat.value = s.t; tempo.value = s.bpm; tempoOut.textContent = s.bpm; userStopped = false;
      setKit(s.kit); onText(); ctx.resume(); start();
    });
    $('starters').appendChild(b);
  });

  // pads: tap to hear a letter and add it to the beat
  Object.keys(LETTERS).sort().forEach(function (ch) {
    var d = LETTERS[ch], b = document.createElement('button');
    b.type = 'button'; b.className = 'pad'; b.style.setProperty('--c', d.c);
    b.setAttribute('aria-label', ch + ': ' + d.n);
    b.innerHTML = '<b></b><span></span>';
    b.firstChild.textContent = ch; b.lastChild.textContent = d.n;
    b.addEventListener('click', function () {
      ctx.resume();
      loadKit(kitId).then(function () { hit(ch, ctx.currentTime + 0.005); });
      var pos = beat.selectionStart == null ? beat.value.length : beat.selectionStart;
      if (beat.value.length < beat.maxLength) {
        beat.value = beat.value.slice(0, pos) + ch + beat.value.slice(beat.selectionEnd == null ? pos : beat.selectionEnd);
        beat.selectionStart = beat.selectionEnd = pos + 1;
        onText();
      }
      b.classList.add('hit'); setTimeout(function () { b.classList.remove('hit'); }, 90);
    });
    $('pads').appendChild(b);
  });

  // start from a shared link, if there is one
  (function init() {
    setVolume();
    var p = new URLSearchParams(location.hash.slice(1));
    var t = p.get('b');
    var bpm = Number(p.get('t'));
    if (bpm >= Number(tempo.min) && bpm <= Number(tempo.max)) { tempo.value = bpm; tempoOut.textContent = bpm; }
    setKit(p.get('k') || KITS[0].id);
    if (t) {
      beat.value = t.slice(0, beat.maxLength);
      userStopped = true;                 // a shared beat waits for the Play button (browsers need a click first)
      say('Press Play to hear this beat.');
    }
    steps = parse(beat.value);
    render(beat.value);
    loadKit(kitId).catch(function () { say('Could not load the drum sounds.', true); });
    if (window.matchMedia && !beat.value) beat.focus();
  })();

  if (/[?&]debug\b/.test(location.search)) window.__tb = { ctx: ctx, hit: hit, parse: parse, get steps() { return steps; }, get playing() { return playing; } };
})();
