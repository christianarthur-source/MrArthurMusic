import { newId } from '../model/factory';
import { MidiNote, Track } from '../model/types';
import type { Studio } from './studio';

/**
 * Live notes from every source (MIDI controllers, the computer keyboard, the on-screen
 * piano) go through here: they play the target instrument track, honour the sustain
 * pedal, light up the on-screen keys, and are captured while a MIDI take is recording.
 */

interface OpenNote {
  start: number;
  velocity: number;
}

export interface MidiDeviceInfo {
  id: string;
  name: string;
}

export class LiveInput {
  /** Pitches currently sounding (held or sustained), for the on-screen keys. */
  active = new Set<number>();
  sustain = false;
  midiSupported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  midiError: string | null = null;
  devices: MidiDeviceInfo[] = [];
  /** Octave of the computer-keyboard piano ("a" = C of this octave). */
  octave = 4;

  private voices = new Map<number, () => void>();
  private held = new Set<number>();
  private take: { trackId: string; startTick: number; open: Map<number, OpenNote>; notes: MidiNote[] } | null = null;
  private listeners = new Set<() => void>();
  private version = 0;

  constructor(private readonly s: Studio) {}

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };
  snapshot = () => this.version;
  private emit() {
    this.version++;
    for (const fn of this.listeners) fn();
  }

  /** The instrument track live notes play: the selected one, else an armed one, else the first. */
  target(): Track | null {
    const p = this.s.store.get();
    const sel = p.tracks.find((t) => t.id === this.s.ui.get().selectedTrack);
    if (sel?.kind === 'instrument') return sel;
    return p.tracks.find((t) => t.kind === 'instrument' && t.arm) ?? p.tracks.find((t) => t.kind === 'instrument') ?? null;
  }

  noteOn(pitch: number, velocity = 100) {
    if (pitch < 0 || pitch > 127) return;
    const t = this.take ? this.s.store.get().tracks.find((x) => x.id === this.take!.trackId) : this.target();
    if (!t) return;
    this.voices.get(pitch)?.();
    this.closeNote(pitch);
    this.voices.set(pitch, this.s.engine.liveNoteOn(t.id, pitch, velocity));
    this.held.add(pitch);
    this.active.add(pitch);
    this.take?.open.set(pitch, { start: this.s.engine.currentTick(), velocity: Math.max(1, Math.min(127, Math.round(velocity))) });
    this.emit();
  }

  noteOff(pitch: number) {
    if (!this.held.delete(pitch)) return;
    if (this.sustain) return; // released when the pedal comes up
    this.release(pitch);
    this.emit();
  }

  setSustain(on: boolean) {
    if (on === this.sustain) return;
    this.sustain = on;
    if (!on) for (const p of [...this.active]) if (!this.held.has(p)) this.release(p);
    this.emit();
  }

  allNotesOff() {
    this.sustain = false;
    this.held.clear();
    for (const p of [...this.active]) this.release(p);
    this.emit();
  }

  private release(pitch: number) {
    this.voices.get(pitch)?.();
    this.voices.delete(pitch);
    this.active.delete(pitch);
    this.closeNote(pitch);
  }

  private closeNote(pitch: number) {
    const take = this.take;
    const o = take?.open.get(pitch);
    if (!take || !o) return;
    take.open.delete(pitch);
    const end = this.s.engine.currentTick();
    const start = Math.max(o.start, take.startTick);
    if (end - start < 10) return; // pressed during the count-in, or a glitch
    take.notes.push({ id: newId('n'), pitch, start: Math.round(start - take.startTick), length: Math.round(end - start), velocity: o.velocity });
  }

  get recordingMidi() {
    return !!this.take;
  }

  startTake(trackId: string, startTick: number) {
    this.take = { trackId, startTick, open: new Map(), notes: [] };
  }

  /** Ends the take; notes still held are cut at the current position. */
  stopTake(): { trackId: string; startTick: number; notes: MidiNote[] } | null {
    if (!this.take) return null;
    for (const p of [...this.take.open.keys()]) this.closeNote(p);
    const t = this.take;
    this.take = null;
    return { trackId: t.trackId, startTick: t.startTick, notes: t.notes.sort((a, b) => a.start - b.start) };
  }

  setOctave(o: number) {
    this.octave = Math.max(1, Math.min(7, o));
    this.emit();
  }

  setDevices(devices: MidiDeviceInfo[], error: string | null = null) {
    this.devices = devices;
    this.midiError = error;
    this.emit();
  }
}
