// Runs off the audio thread. The SoundFont's samples are Vorbis-compressed; decoding them inside the
// synthesizer would stall the sound each time a new key is played. So this worker keeps the big compressed
// bank and hands the synthesizer a small, fully decoded SoundFont holding just the instrument in use.
import { SoundBankLoader, BasicSoundBank, EmptySample, BasicInstrument, BasicPreset, Generator, GeneratorTypes } from './vendor/spessasynth_core.js';
import { stretchChannels } from './vendor/pitchshift.js'; // pitch shift that keeps the length (built from the Studio DAW's, see README)

let bank = null;

// ---- The Sampler: every key plays the recording at the SAME speed -------------------------------------
// A SoundFont normally plays one sample faster for higher keys (and shorter) and slower for lower keys (and longer).
// Instead each key within SPAN keys of the home key gets its own copy that was pitch-shifted without changing its
// length. The copies are made here, in the background, from the whole recording (so moving where the sound starts
// only re-cuts them). Until they are ready the student already hears the plain one-sample sound.
const SPAN = 24;
let take = null; // { id, rate, x, shifted: Map(semitones -> Float32Array), stop, done }
let newest = 0; // the newest sample build; older ones give up

const yieldNow = () => new Promise((r) => setTimeout(r, 0)); // lets an instrument change in between

function startTake(m) {
  if (take) take.stop = true;
  const t = { id: m.id, rate: m.rate, x: m.x, shifted: new Map(), stop: false, done: null };
  take = t;
  t.done = (async () => {
    for (let d = 1; d <= SPAN; d++) {
      for (const st of [d, -d]) {
        await yieldNow();
        if (t.stop) return false;
        const edge = Math.sign(st) * 12;
        const from = Math.abs(st) <= 12 ? t.x : t.shifted.get(edge); // beyond an octave: shift the octave key again
        if (!from) continue;
        try {
          t.shifted.set(st, stretchChannels([from], { ratio: 1, semitones: Math.abs(st) <= 12 ? st : st - edge, quality: 'fast', sampleRate: t.rate })[0]);
        } catch (err) {
          console.warn('Sampler: one key stays tape-style', err);
        }
      }
    }
    return true;
  })();
}

/** Cuts [from, to) out of a sound: soft start and end, then the same loudness for every key. */
function cutPiece(src, from, to, gain, rate) {
  const pcm = src.slice(from, to);
  const len = pcm.length;
  const fadeIn = Math.min(len, Math.round(rate * 0.002));
  const fadeOut = Math.min(Math.floor(len / 4), Math.round(rate * 0.04));
  for (let i = 0; i < fadeIn; i++) pcm[i] *= i / fadeIn;
  for (let i = 0; i < fadeOut; i++) pcm[len - 1 - i] *= i / fadeOut;
  for (let i = 0; i < len; i++) pcm[i] *= gain;
  return pcm;
}

/** One SoundFont holding a copy per key; each copy covers its own key (and the gaps up to its neighbours). */
async function buildEvenSpeed(m) {
  const t = take;
  if (!t || t.id !== m.takeId) return;
  if (!(await t.done) || m.token !== newest) return;
  const copies = new Map([[0, t.x], ...t.shifted]);
  const keys = [...copies.keys()].map((d) => [m.root + d, d]).filter(([k]) => k >= 0 && k <= 127).sort((a, b) => a[0] - b[0]);
  if (keys.length < 2) return;
  const mini = new BasicSoundBank();
  const inst = new BasicInstrument();
  inst.name = 'My Sound';
  inst.globalZone.addGenerators(new Generator(GeneratorTypes.initialAttenuation, m.attenuation ?? 0), new Generator(GeneratorTypes.releaseVolEnv, -3600));
  keys.forEach(([key, d], i) => {
    const smp = new EmptySample();
    smp.name = 'My Sound ' + key;
    smp.originalKey = key;
    smp.setAudioData(cutPiece(copies.get(d), m.from, m.to, m.gain, m.rate), m.rate);
    mini.addSamples(smp);
    const zone = inst.createZone(smp);
    const lo = i === 0 ? 0 : Math.floor((keys[i - 1][0] + key) / 2) + 1;
    const hi = i === keys.length - 1 ? 127 : Math.floor((key + keys[i + 1][0]) / 2);
    zone.keyRange = { min: lo, max: hi };
  });
  mini.addInstruments(inst);
  const preset = new BasicPreset(mini);
  preset.name = 'My Sound';
  preset.createZone(inst);
  mini.addPresets(preset);
  mini.soundBankInfo.name = 'MIDI MUSIC Sampler';
  mini.flush();
  const buffer = mini.writeSF2();
  if (m.token === newest) self.postMessage({ type: 'sample-full', token: m.token, buffer }, [buffer]);
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'load') {
      await BasicSoundBank.isSF3DecoderReady;
      bank = SoundBankLoader.fromArrayBuffer(m.buffer);
      const kits = bank.presets.filter((p) => p.isGMGSDrum).map((p) => ({ program: p.program, name: p.name }));
      self.postMessage({ type: 'loaded', kits });
    } else if (m.type === 'build') {
      const preset = bank.presets.find((p) => (m.drum ? p.isGMGSDrum && p.program === m.prog : !p.isGMGSDrum && p.program === m.prog && p.bankMSB === 0 && p.bankLSB === 0));
      if (!preset) throw new Error('That sound is missing from the library');
      const mini = new BasicSoundBank();
      mini.clonePreset(preset);
      mini.flush();
      await mini.setSampleFormat({ format: 'pcm' });
      const buffer = mini.writeSF2();
      self.postMessage({ type: 'built', id: m.id, buffer }, [buffer]);
    } else if (m.type === 'take') {
      startTake(m);
    } else if (m.type === 'sample') {
      newest = m.token;
      // The Sampler: one recorded sound becomes a whole instrument. This first version plays the one sample
      // faster for higher keys and slower for lower ones, starting from the key it "lives" on (m.root);
      // buildEvenSpeed (below) replaces it with the same-speed version a moment later.
      const mini = new BasicSoundBank();
      const smp = new EmptySample();
      smp.name = 'My Sound';
      smp.originalKey = m.root;
      smp.setAudioData(m.pcm, m.rate);
      mini.addSamples(smp);
      const inst = new BasicInstrument();
      inst.name = 'My Sound';
      inst.globalZone.addGenerators(new Generator(GeneratorTypes.initialAttenuation, m.attenuation ?? 0), new Generator(GeneratorTypes.releaseVolEnv, -3600)); // ~0.12 s fade when the key lifts
      inst.createZone(smp);
      mini.addInstruments(inst);
      const preset = new BasicPreset(mini);
      preset.name = 'My Sound';
      preset.createZone(inst);
      mini.addPresets(preset);
      mini.soundBankInfo.name = 'MIDI MUSIC Sampler';
      mini.flush();
      const buffer = mini.writeSF2();
      self.postMessage({ type: 'built', id: m.id, buffer }, [buffer]);
      if (m.takeId != null) buildEvenSpeed(m).catch((err) => console.warn('Sampler: even-speed keys not ready', err));
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, message: String(err?.message || err) });
  }
};
