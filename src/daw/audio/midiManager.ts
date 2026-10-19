export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
}

interface MidiInputLike {
  id: string;
  name?: string;
  manufacturer?: string;
  state: string;
  onmidimessage?: ((e: { data: Uint8Array | number[] }) => void) | null;
}

interface MidiAccessLike {
  inputs: {
    forEach: (callback: (input: MidiInputLike) => void) => void;
  };
  onstatechange?: (() => void) | null;
}

export class DawMidiManager {
  private midiAccess: any = null;
  private connectedDevices: MidiDeviceInfo[] = [];

  public onNoteOn?: (midi: number, velocity: number) => void;
  public onNoteOff?: (midi: number) => void;
  public onDevicesChanged?: (devices: MidiDeviceInfo[]) => void;

  public async init(): Promise<boolean> {
    if (!navigator.requestMIDIAccess) {
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.updateDevices();

      this.midiAccess.onstatechange = () => {
        this.updateDevices();
      };

      this.setupInputs();
      return true;
    } catch {
      return false;
    }
  }

  private updateDevices() {
    if (!this.midiAccess) return;
    const devices: MidiDeviceInfo[] = [];
    this.midiAccess.inputs.forEach((input) => {
      devices.push({
        id: input.id,
        name: input.name || 'USB MIDI Keyboard',
        manufacturer: input.manufacturer || 'Generic',
        state: input.state,
      });
    });
    this.connectedDevices = devices;
    if (this.onDevicesChanged) {
      this.onDevicesChanged(devices);
    }
  }

  private setupInputs() {
    if (!this.midiAccess) return;
    this.midiAccess.inputs.forEach((input) => {
      input.onmidimessage = (e) => this.handleMidiMessage(e);
    });
  }

  private handleMidiMessage(e: { data: Uint8Array | number[] }) {
    if (!e.data || e.data.length < 3) return;
    const [status, note, velocity] = e.data;
    const command = status >> 4;

    if (command === 9 && velocity > 0) {
      // Note On
      if (this.onNoteOn) {
        this.onNoteOn(note, velocity / 127);
      }
    } else if (command === 8 || (command === 9 && velocity === 0)) {
      // Note Off
      if (this.onNoteOff) {
        this.onNoteOff(note);
      }
    }
  }

  public getConnectedDevices(): MidiDeviceInfo[] {
    return this.connectedDevices;
  }
}

export const dawMidiManager = new DawMidiManager();
