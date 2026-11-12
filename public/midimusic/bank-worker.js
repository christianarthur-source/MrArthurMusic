// Runs off the audio thread. The SoundFont's samples are Vorbis-compressed; decoding them inside the
// synthesizer would stall the sound each time a new key is played. So this worker keeps the big compressed
// bank and hands the synthesizer a small, fully decoded SoundFont holding just the instrument in use.
import { SoundBankLoader, BasicSoundBank } from './vendor/spessasynth_core.js';

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
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, message: String(err?.message || err) });
  }
};
