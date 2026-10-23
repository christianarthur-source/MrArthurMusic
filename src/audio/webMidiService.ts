import { KeySignature, Pitch, NoteStep, AccidentalType } from '../types/music';
import { DrumSound, DRUM_SOUND_PITCH_MAP } from '../data/drumGrooves';

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  state: 'connected' | 'disconnected';
}

export type MidiNoteOnCallback = (
  midiNumber: number,
  velocity: number,
  pitch: Pitch,
  drumSound: DrumSound | null
) => void;

export type MidiNoteOffCallback = (midiNumber: number) => void;
export type MidiDevicesChangedCallback = (devices: MidiDeviceInfo[]) => void;

/**
 * Maps standard General MIDI percussion note numbers (Channel 10 or drum controller)
 * to our soundEngine DrumSound types.
 */
export function midiNumberToDrumSound(midi: number): DrumSound | null {
  switch (midi) {
    case 35: // Acoustic Bass Drum
    case 36: // Bass Drum 1
      return 'kick';
    case 37: // Side Stick / Rimshot
      return 'rimshot';
    case 38: // Acoustic Snare
    case 40: // Electric Snare
      return 'snare';
    case 41: // Low Floor Tom
    case 43: // High Floor Tom
      return 'tom_floor';
    case 42: // Closed Hi-Hat
    case 44: // Pedal Hi-Hat
      return 'hihat_closed';
    case 45: // Low Tom
    case 47: // Low-Mid Tom
      return 'tom_low';
    case 46: // Open Hi-Hat
      return 'hihat_open';
    case 48: // Hi-Mid Tom
    case 50: // High Tom
      return 'tom_high';
    case 49: // Crash Cymbal 1
    case 57: // Crash Cymbal 2
      return 'crash';
    case 51: // Ride Cymbal 1
    case 59: // Ride Cymbal 2
      return 'ride';
    case 56: // Cowbell
      return 'cowbell';
    case 60: // High Bongo / Conga
      return 'conga_open';
    case 61: // Low Bongo / Conga
      return 'conga_slap';
    case 69: // Cabasa
    case 70: // Maracas / Shaker
    case 82: // Shaker
      return 'shaker';
    default:
      return null;
  }
}

/**
 * Maps standard MIDI note numbers (0 to 127, where 60 = Middle C / C4)
 * to a diatonic musical Pitch with accurate octave and sharp/flat accidental.
 */
export function midiNumberToPitch(
  midi: number,
  keySignature?: KeySignature
): Pitch {
  const clamped = Math.max(0, Math.min(127, Math.round(midi)));
  const semitone = clamped % 12;
  const octave = Math.floor(clamped / 12) - 1;

  const isFlatKey =
    keySignature && ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'].includes(keySignature);

  // Semitone definitions
  const flatMap: { step: NoteStep; accidental?: AccidentalType }[] = [
    { step: 'C' },
    { step: 'D', accidental: 'flat' },
    { step: 'D' },
    { step: 'E', accidental: 'flat' },
    { step: 'E' },
    { step: 'F' },
    { step: 'G', accidental: 'flat' },
    { step: 'G' },
    { step: 'A', accidental: 'flat' },
    { step: 'A' },
    { step: 'B', accidental: 'flat' },
    { step: 'B' },
  ];

  const sharpMap: { step: NoteStep; accidental?: AccidentalType }[] = [
    { step: 'C' },
    { step: 'C', accidental: 'sharp' },
    { step: 'D' },
    { step: 'D', accidental: 'sharp' },
    { step: 'E' },
    { step: 'F' },
    { step: 'F', accidental: 'sharp' },
    { step: 'G' },
    { step: 'G', accidental: 'sharp' },
    { step: 'A' },
    { step: 'A', accidental: 'sharp' },
    { step: 'B' },
  ];

  const entry = isFlatKey ? flatMap[semitone] : sharpMap[semitone];
  return {
    step: entry.step,
    octave,
    accidental: entry.accidental || null,
  };
}

/**
 * Returns standard staff pitch for a given DrumSound (e.g. kick -> F4, snare -> C5)
 */
export function getDrumPitchForSound(sound: DrumSound): Pitch {
  return DRUM_SOUND_PITCH_MAP[sound] || { step: 'C', octave: 5 };
}

/**
 * Returns a standard DrumSound for a given musical pitch
 */
export function getDrumSoundForPitch(pitch: Pitch): DrumSound {
  const step = pitch?.step || 'F';
  const octave = pitch?.octave || 4;
  if (octave >= 5) {
    if (step === 'G') return 'hihat_closed';
    if (step === 'A') return 'hihat_open';
    if (step === 'B') return 'crash';
    if (step === 'F') return 'ride';
    if (step === 'E') return 'rimshot';
    if (step === 'D') return 'tom_high';
    return 'snare';
  } else {
    if (step === 'F' || step === 'C') return 'kick';
    if (step === 'A') return 'tom_low';
    if (step === 'B') return 'shaker';
    if (step === 'D') return 'cowbell';
    if (step === 'E') return 'conga_open';
    if (step === 'G') return 'conga_slap';
    return 'kick';
  }
}

class WebMidiService {
  private midiAccess: any = null;
  private connectedDevices: MidiDeviceInfo[] = [];
  private isInitialized = false;
  private initPromise: Promise<boolean> | null = null;

  private noteOnListeners: Set<MidiNoteOnCallback> = new Set();
  private noteOffListeners: Set<MidiNoteOffCallback> = new Set();
  private devicesChangedListeners: Set<MidiDevicesChangedCallback> = new Set();

  public get isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  public async init(): Promise<boolean> {
    if (this.isInitialized && this.midiAccess) return true;
    if (!this.isSupported) return false;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const access = await navigator.requestMIDIAccess({ sysex: false });
        this.midiAccess = access;
        this.isInitialized = true;

        this.updateDevices();

        this.midiAccess.onstatechange = () => {
          this.updateDevices();
        };

        this.bindInputs();
        return true;
      } catch (err) {
        console.warn('Web MIDI permission denied or unavailable:', err);
        return false;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  private updateDevices() {
    if (!this.midiAccess) return;
    const devices: MidiDeviceInfo[] = [];

    this.midiAccess.inputs.forEach((input: any) => {
      if (input.state === 'connected') {
        devices.push({
          id: input.id,
          name: input.name || 'MIDI Keyboard Controller',
          manufacturer: input.manufacturer || 'Generic',
          state: input.state,
        });
      }
    });

    this.connectedDevices = devices;
    this.devicesChangedListeners.forEach((cb) => {
      try {
        cb(devices);
      } catch (e) {
        console.error('Error in MIDI device change listener:', e);
      }
    });

    this.bindInputs();
  }

  private bindInputs() {
    if (!this.midiAccess) return;
    this.midiAccess.inputs.forEach((input: any) => {
      input.onmidimessage = (e: any) => this.handleMidiMessage(e);
    });
  }

  private handleMidiMessage(e: { data: Uint8Array | number[] }) {
    if (!e.data || e.data.length < 3) return;
    const [status, note, velocity] = e.data;
    const command = status >> 4;

    if (command === 9 && velocity > 0) {
      // Note On
      const normVel = velocity / 127;
      const pitch = midiNumberToPitch(note);
      const drumSound = midiNumberToDrumSound(note);
      this.noteOnListeners.forEach((cb) => {
        try {
          cb(note, normVel, pitch, drumSound);
        } catch (err) {
          console.error('Error in MIDI noteOn listener:', err);
        }
      });
    } else if (command === 8 || (command === 9 && velocity === 0)) {
      // Note Off
      this.noteOffListeners.forEach((cb) => {
        try {
          cb(note);
        } catch (err) {
          console.error('Error in MIDI noteOff listener:', err);
        }
      });
    }
  }

  public onNoteOn(cb: MidiNoteOnCallback): () => void {
    this.noteOnListeners.add(cb);
    return () => this.noteOnListeners.delete(cb);
  }

  public onNoteOff(cb: MidiNoteOffCallback): () => void {
    this.noteOffListeners.add(cb);
    return () => this.noteOffListeners.delete(cb);
  }

  public onDevicesChanged(cb: MidiDevicesChangedCallback): () => void {
    this.devicesChangedListeners.add(cb);
    cb(this.connectedDevices);
    return () => this.devicesChangedListeners.delete(cb);
  }

  public getConnectedDevices(): MidiDeviceInfo[] {
    return this.connectedDevices;
  }
}

export const webMidiService = new WebMidiService();
