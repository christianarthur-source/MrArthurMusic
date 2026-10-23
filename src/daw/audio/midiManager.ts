import { webMidiService, MidiDeviceInfo } from '../../audio/webMidiService';

export type { MidiDeviceInfo };

export class DawMidiManager {
  private _onNoteOn?: (midi: number, velocity: number) => void;
  private _onNoteOff?: (midi: number) => void;
  private _onDevicesChanged?: (devices: MidiDeviceInfo[]) => void;

  private unsubNoteOn?: () => void;
  private unsubNoteOff?: () => void;
  private unsubDevices?: () => void;

  public get onNoteOn(): ((midi: number, velocity: number) => void) | undefined {
    return this._onNoteOn;
  }
  public set onNoteOn(fn: ((midi: number, velocity: number) => void) | undefined) {
    this._onNoteOn = fn;
    if (this.unsubNoteOn) this.unsubNoteOn();
    if (fn) {
      this.unsubNoteOn = webMidiService.onNoteOn((midi, vel) => fn(midi, vel));
    }
  }

  public get onNoteOff(): ((midi: number) => void) | undefined {
    return this._onNoteOff;
  }
  public set onNoteOff(fn: ((midi: number) => void) | undefined) {
    this._onNoteOff = fn;
    if (this.unsubNoteOff) this.unsubNoteOff();
    if (fn) {
      this.unsubNoteOff = webMidiService.onNoteOff((midi) => fn(midi));
    }
  }

  public get onDevicesChanged(): ((devices: MidiDeviceInfo[]) => void) | undefined {
    return this._onDevicesChanged;
  }
  public set onDevicesChanged(fn: ((devices: MidiDeviceInfo[]) => void) | undefined) {
    this._onDevicesChanged = fn;
    if (this.unsubDevices) this.unsubDevices();
    if (fn) {
      this.unsubDevices = webMidiService.onDevicesChanged((devices) => fn(devices));
    }
  }

  public async init(): Promise<boolean> {
    return webMidiService.init();
  }

  public getConnectedDevices(): MidiDeviceInfo[] {
    return webMidiService.getConnectedDevices();
  }
}

export const dawMidiManager = new DawMidiManager();
