// Orchestral playback with the MuseScore_General SoundFont (MIT, the sound set MuseScore 3 ships with),
// played by spessasynth — a FluidSynth-style SoundFont engine running in an AudioWorklet. Looped
// sustains, velocity layers, General MIDI drums and hall reverb come from the SoundFont itself.
import processorUrl from 'spessasynth_lib/dist/spessasynth_processor.min.js?url';

const PARTS = ['/audio/soundfont/MuseScore_General.sf3.partaa', '/audio/soundfont/MuseScore_General.sf3.partab'];
const TOTAL_BYTES = 39900972;

type Synth = import('spessasynth_lib').WorkletSynthesizer;


let bankPromise: Promise<ArrayBuffer> | null = null;

/** Downloads the SoundFont once (the browser caches it afterwards). */
export function loadBank(onProgress?: (fraction: number) => void): Promise<ArrayBuffer> {
  if (!bankPromise) {
    bankPromise = (async () => {
      let loaded = 0;
      const chunks: Uint8Array[] = [];
      for (const url of PARTS) {
        const res = await fetch(url);
        if (!res.ok || !res.body) throw new Error(`SoundFont download failed (${res.status})`);
        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.length;
          onProgress?.(Math.min(1, loaded / TOTAL_BYTES));
        }
      }
      const out = new Uint8Array(loaded);
      let o = 0;
      for (const c of chunks) {
        out.set(c, o);
        o += c.length;
      }
      return out.buffer;
    })();
    bankPromise.catch(() => {
      bankPromise = null;
    });
  }
  return bankPromise;
}

export interface ChannelSetup {
  staffN: string;
  partKey: string; // staves of one instrument (a piano's two staves) share a channel
  program: number;
  drums: boolean;
}

export class SoundFontEngine {
  private synth: Synth | null = null;
  private channelOf = new Map<string, number>();
  private volumes = new Map<number, number>();
  private clickCh = 14; // a spare channel set to the drum kit: the metronome runs on the same clock as the music
  ready = false;

  constructor(private ctx: AudioContext, private output: AudioNode) {}

  async init(onProgress?: (fraction: number) => void) {
    if (this.ready) return;
    const [{ WorkletSynthesizer }, bank] = await Promise.all([
      import('spessasynth_lib'),
      loadBank(onProgress),
      this.ctx.audioWorklet.addModule(processorUrl),
    ]);
    const synth = new WorkletSynthesizer(this.ctx);
    // the SoundFont is mixed conservatively; bring it up to the level of the rest of the site
    const makeup = this.ctx.createGain();
    makeup.gain.value = 2.6;
    synth.connect(makeup);
    makeup.connect(this.output);
    await synth.soundBankManager.addSoundBank(bank.slice(0), 'main');
    await synth.isReady;
    this.synth = synth;
    this.useClickChannel(14);
    this.ready = true;
  }

  private useClickChannel(ch: number) {
    const s = this.synth!;
    if (ch !== 9) s.midiChannels[ch]?.setDrums(true);
    s.controllerChange(ch, 7 as never, ch === 9 ? (this.volumes.get(9) ?? 100) : 127);
    if (ch !== 9) {
      s.controllerChange(ch, 91 as never, 0);
      s.controllerChange(ch, 93 as never, 0);
    }
    this.clickCh = ch;
  }

  /** A metronome tick (wood block; higher on the downbeat) at an exact audio-clock time. */
  click(when: number, accent: boolean) {
    const s = this.synth;
    if (!s) return;
    const key = accent ? 76 : 77;
    s.noteOn(this.clickCh, key, accent ? 120 : 96, { time: when });
    s.noteOff(this.clickCh, key, { time: when + 0.08 });
  }

  /** Gives each part a MIDI channel with its instrument (channel 10 is the drum kit). */
  setup(staves: ChannelSetup[]) {
    const s = this.synth;
    if (!s) return;
    this.channelOf.clear();
    // the previous click channel may now belong to a part
    if (this.clickCh !== 9) s.midiChannels[this.clickCh]?.setDrums(false);
    const byPart = new Map<string, number>();
    const programOf = new Map<number, number>();
    let next = 0;
    for (const st of staves) {
      if (st.drums) {
        this.channelOf.set(st.staffN, 9);
        continue;
      }
      let ch = byPart.get(st.partKey);
      if (ch === undefined) {
        if (next === 9) next++;
        if (next <= 15) ch = next++;
        else ch = [...programOf.entries()].find(([, p]) => p === st.program)?.[0] ?? 0; // more than 15 parts
        byPart.set(st.partKey, ch);
        if (!programOf.has(ch)) {
          programOf.set(ch, st.program);
          s.programChange(ch, st.program);
        }
      }
      this.channelOf.set(st.staffN, ch);
    }
    // the click gets the highest channel no part uses (15 is kept for note-entry auditions)
    const used = new Set(this.channelOf.values());
    let click = 9;
    for (let ch = 14; ch >= 0; ch--) if (ch !== 9 && !used.has(ch)) { click = ch; break; }
    for (let ch = 0; ch < 16; ch++) {
      s.controllerChange(ch, 91 as never, Math.round(Math.min(1, 0.35 * this.reverbScale * 2) * 127)); // hall reverb send
      s.controllerChange(ch, 93 as never, 8); // a touch of chorus
      s.controllerChange(ch, 7 as never, 100);
      s.controllerChange(ch, 11 as never, 127);
      s.controllerChange(ch, 64 as never, 0);
      this.volumes.set(ch, 100);
    }
    this.useClickChannel(click);
  }

  channel(staffN: string) {
    return this.channelOf.get(staffN) ?? 0;
  }

  noteOn(staffN: string, midi: number, velocity: number, when: number, dur: number) {
    const s = this.synth;
    if (!s) return;
    const ch = this.channel(staffN);
    const v = Math.max(1, Math.min(127, Math.round(velocity * 127)));
    const m = Math.max(0, Math.min(127, Math.round(midi)));
    s.noteOn(ch, m, v, { time: when });
    s.noteOff(ch, m, { time: when + Math.max(0.03, dur) });
  }

  pedal(staffN: string, down: boolean, when: number) {
    this.synth?.controllerChange(this.channel(staffN), 64 as never, down ? 127 : 0, { time: when });
  }

  private reverbScale = 0.5;
  private sends = new Map<number, number>();

  /** Mixer strip for a staff's channel: volume 0..1 (0 = muted), pan -1..1, reverb send 0..1. */
  setStrip(staffN: string, volume: number, pan: number, reverb: number) {
    const s = this.synth;
    if (!s || !this.channelOf.has(staffN)) return;
    const ch = this.channel(staffN);
    const v = Math.round(Math.max(0, Math.min(1, volume)) * 127);
    if (this.volumes.get(ch) !== v) {
      this.volumes.set(ch, v);
      s.controllerChange(ch, 7 as never, v);
    }
    s.controllerChange(ch, 10 as never, Math.round(64 + Math.max(-1, Math.min(1, pan)) * 63));
    this.sends.set(ch, reverb);
    s.controllerChange(ch, 91 as never, Math.round(Math.min(1, reverb * this.reverbScale * 2) * 127));
  }

  /** Master reverb amount 0..1 scales every channel's send. */
  setReverbScale(scale: number) {
    this.reverbScale = scale;
    const s = this.synth;
    if (!s) return;
    for (const [ch, send] of this.sends) s.controllerChange(ch, 91 as never, Math.round(Math.min(1, send * scale * 2) * 127));
  }

  /** Plays one note on a spare channel (note-entry feedback). */
  audition(program: number, drums: boolean, midi: number, when: number) {
    const s = this.synth;
    if (!s) return;
    const ch = drums ? 9 : 15;
    if (!drums) s.programChange(ch, program);
    s.noteOn(ch, midi, 90, { time: when });
    s.noteOff(ch, midi, { time: when + 0.5 });
  }

  stopAll() {
    if (!this.synth) return;
    this.synth.stopAll(true);
    for (let ch = 0; ch < 16; ch++) this.synth.controllerChange(ch, 64 as never, 0);
  }
}
