// Runs off the audio thread. The SoundFont's samples are Vorbis-compressed; decoding them inside the
// synthesizer would stall the sound each time a new key is played. So this worker keeps the big compressed
// bank and hands the synthesizer a small, fully decoded SoundFont holding just the instrument in use.
import { SoundBankLoader, BasicSoundBank, EmptySample, BasicInstrument, BasicPreset, Generator, GeneratorTypes } from './vendor/spessasynth_core.js';

let bank = null;

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
    } else if (m.type === 'sample') {
      // The Sampler: one recorded sound becomes a whole instrument. The synthesizer plays it faster for
      // higher keys and slower for lower ones, starting from the key it "lives" on (m.root).
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
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, message: String(err?.message || err) });
  }
};
