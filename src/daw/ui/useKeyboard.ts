import { useEffect } from 'react';
import * as ops from '../model/ops';
import * as A from './actions';
import { Studio } from './studio';

/**
 * Global shortcuts (all routed through the action layer) and the computer-
 * keyboard piano for the selected instrument track.
 */

const PIANO_KEYS: Record<string, number> = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14 };

export function useKeyboard(s: Studio, enabled: boolean, onSave: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const held = new Map<string, number>();
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    };
    // Letters play notes only while the note editor or on-screen keyboard is open, so they stay shortcuts otherwise.
    const pianoOn = () => {
      const b = s.ui.get().bottom;
      return (b === 'editor' || b === 'keyboard') && !!s.live.target();
    };

    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const ui = s.ui.get();

      if (pianoOn() && !mod && !e.altKey) {
        if (k in PIANO_KEYS) {
          e.preventDefault();
          if (!e.repeat && !held.has(k)) {
            const pitch = 12 * (s.live.octave + 1) + PIANO_KEYS[k];
            held.set(k, pitch);
            s.live.noteOn(pitch, 100);
          }
          return;
        }
        if (k === 'z' || k === 'x') {
          s.live.setOctave(s.live.octave + (k === 'z' ? -1 : 1));
          s.ui.toast('info', `Keyboard octave ${s.live.octave}`);
          return;
        }
      }
      if (e.key === 'Escape') {
        s.ui.set({ menu: null, dialog: 'none', tool: 'pointer' });
        return;
      }
      if (mod) {
        if (k === 'z') {
          e.preventDefault();
          if (e.shiftKey) A.redo(s);
          else A.undo(s);
        } else if (k === 'y') {
          e.preventDefault();
          A.redo(s);
        } else if (k === 'c') A.copy(s);
        else if (k === 'x') A.cut(s);
        else if (k === 'v') A.paste(s);
        else if (k === 'd') {
          e.preventDefault();
          A.duplicate(s);
        } else if (k === 'a') {
          e.preventDefault();
          if (ui.bottom === 'editor' && ui.editRegion) {
            const r = s.store.get().regions.find((x) => x.id === ui.editRegion);
            if (r?.kind === 'midi') s.ui.set({ selectedNotes: r.notes.map((n) => n.id) });
          } else A.selectAll(s);
        } else if (k === 's') {
          e.preventDefault();
          onSave();
        } else if (k === 'e') {
          e.preventDefault();
          s.ui.set({ dialog: 'export' });
        } else if (k === 'k') {
          e.preventDefault();
          s.ui.set({ bottom: ui.bottom === 'keyboard' ? 'none' : 'keyboard' });
        }
        return;
      }
      switch (e.key) {
        case ' ':
          e.preventDefault();
          A.togglePlay(s);
          return;
        case 'Home':
        case 'Enter':
          e.preventDefault();
          A.returnToStart(s);
          return;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          if (ui.bottom === 'editor' && ui.editRegion && ui.selectedNotes.length) {
            const r = s.store.get().regions.find((x) => x.id === ui.editRegion);
            if (r?.kind === 'midi') {
              const del = new Set(ui.selectedNotes);
              s.store.exec('Delete notes', (p) => ops.setNotes(p, r.id, r.notes.filter((n) => !del.has(n.id))));
              s.ui.set({ selectedNotes: [] });
            }
          } else A.deleteSelection(s);
          return;
        case 'ArrowLeft':
          e.preventDefault();
          A.nudge(s, -1);
          return;
        case 'ArrowRight':
          e.preventDefault();
          A.nudge(s, 1);
          return;
        case '-':
          A.zoom(s, 1 / 1.25);
          return;
        case '=':
        case '+':
          A.zoom(s, 1.25);
          return;
        case '?':
          s.ui.set({ dialog: 'shortcuts' });
          return;
      }
      switch (k) {
        case 'r':
          if (ui.recording) void A.stopRecording(s);
          else void A.startRecording(s);
          break;
        case 'l':
          A.toggleLoop(s);
          break;
        case 'k':
          A.toggleMetronome(s);
          break;
        case 's':
          A.splitAtPlayhead(s);
          break;
        case 'v':
          s.ui.set({ tool: 'pointer' });
          break;
        case 'b':
          s.ui.set({ tool: 'split' });
          break;
        case 'p':
          s.ui.set({ tool: 'draw' });
          break;
        case 'g':
          s.store.exec('Snap', (p) => ({ ...p, editor: { ...p.editor, snap: !p.editor.snap } }));
          break;
        case 'f':
          A.fitProject(s);
          break;
        case 'q':
          A.quantizeSelection(s);
          break;
        case 'm':
          s.ui.set({ bottom: ui.bottom === 'mixer' ? 'none' : 'mixer' });
          break;
        case 'x':
          s.ui.set({ bottom: ui.bottom === 'editor' ? 'none' : 'editor' });
          break;
        case 'i':
          s.ui.set({ bottom: ui.bottom === 'inspector' ? 'none' : 'inspector' });
          break;
        case 'n':
          s.ui.set({ bottom: ui.bottom === 'keyboard' ? 'none' : 'keyboard' });
          break;
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const pitch = held.get(k);
      if (pitch !== undefined) {
        s.live.noteOff(pitch);
        held.delete(k);
      }
    };
    const blur = () => {
      for (const pitch of held.values()) s.live.noteOff(pitch);
      held.clear();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      blur();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [s, enabled, onSave]);
}

/**
 * Web MIDI controllers (USB/Bluetooth keyboards, pad controllers, any class-compliant
 * device on any channel) play the target instrument track and record into MIDI takes.
 * Handles note on/off (incl. note-on velocity 0), sustain pedal (CC64), all-notes-off
 * (CC120/123), and MIDI clock transport messages (Start/Continue/Stop). Devices can be
 * plugged in or out at any time. Needs Chrome, Edge or Firefox (Safari has no Web MIDI).
 */
export function useMidiInput(s: Studio, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (!s.live.midiSupported) {
      s.live.setDevices([], 'This browser cannot use MIDI keyboards. Use Chrome or Edge.');
      return;
    }
    let access: MIDIAccess | null = null;
    let disposed = false;
    let known = new Set<string>();
    const onMsg = (ev: MIDIMessageEvent) => {
      const d = ev.data;
      if (!d || !d.length) return;
      const status = d[0];
      // System real-time (one byte): transport buttons on many controllers send these.
      if (status === 0xfa || status === 0xfb) {
        if (s.engine.state !== 'playing') A.togglePlay(s);
        return;
      }
      if (status === 0xfc) {
        if (s.ui.get().recording) void A.stopRecording(s);
        else if (s.engine.state === 'playing') A.togglePlay(s);
        return;
      }
      if (d.length < 3) return;
      const cmd = status & 0xf0;
      if (cmd === 0x90 && d[2] > 0) s.live.noteOn(d[1], d[2]);
      else if (cmd === 0x80 || cmd === 0x90) s.live.noteOff(d[1]);
      else if (cmd === 0xb0) {
        if (d[1] === 64) s.live.setSustain(d[2] >= 64);
        else if (d[1] === 120 || d[1] === 123) s.live.allNotesOff();
      }
    };
    const attach = () => {
      if (!access || disposed) return;
      const devices: { id: string; name: string }[] = [];
      access.inputs.forEach((inp) => {
        inp.onmidimessage = onMsg;
        if (inp.state !== 'disconnected') devices.push({ id: inp.id, name: inp.name || inp.manufacturer || 'MIDI device' });
      });
      for (const dev of devices) if (!known.has(dev.id)) s.ui.toast('info', `MIDI keyboard connected: ${dev.name}`);
      known = new Set(devices.map((x) => x.id));
      s.live.setDevices(devices);
    };
    navigator
      .requestMIDIAccess()
      .then((a) => {
        if (disposed) return;
        access = a;
        known = new Set([...a.inputs.values()].map((i) => i.id)); // no toast for devices already plugged in
        attach();
        a.onstatechange = attach;
      })
      .catch(() => s.live.setDevices([], 'MIDI is blocked in this browser. Allow MIDI devices for this site, or ask your teacher.'));
    return () => {
      disposed = true;
      if (access) access.onstatechange = null;
      access?.inputs.forEach((inp) => (inp.onmidimessage = null));
      s.live.allNotesOff();
    };
  }, [s, enabled]);
}
