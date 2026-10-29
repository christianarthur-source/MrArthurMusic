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
    let octave = 4;
    const held = new Map<string, () => void>();
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    };
    const pianoTrack = () => {
      const p = s.store.get();
      const t = p.tracks.find((x) => x.id === s.ui.get().selectedTrack);
      return t && t.kind === 'instrument' && s.ui.get().bottom === 'editor' ? t : null;
    };

    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const ui = s.ui.get();

      // Computer-keyboard piano (only while the note editor is open, so letters stay shortcuts otherwise)
      const pt = pianoTrack();
      if (pt && !mod && !e.altKey) {
        if (k in PIANO_KEYS) {
          e.preventDefault();
          if (!e.repeat && !held.has(k)) held.set(k, s.engine.liveNoteOn(pt.id, 12 * (octave + 1) + PIANO_KEYS[k], 100));
          return;
        }
        if (k === 'z') {
          octave = Math.max(1, octave - 1);
          s.ui.toast('info', `Keyboard octave ${octave}`);
          return;
        }
        if (k === 'x') {
          octave = Math.min(7, octave + 1);
          s.ui.toast('info', `Keyboard octave ${octave}`);
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
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const off = held.get(k);
      if (off) {
        off();
        held.delete(k);
      }
    };
    const blur = () => {
      for (const off of held.values()) off();
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

/** Web MIDI keyboards play the selected instrument track (if the browser allows MIDI). */
export function useMidiInput(s: Studio, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('requestMIDIAccess' in navigator)) return;
    let access: MIDIAccess | null = null;
    const held = new Map<number, () => void>();
    const onMsg = (ev: MIDIMessageEvent) => {
      const d = ev.data;
      if (!d || d.length < 3) return;
      const cmd = d[0] & 0xf0;
      const p = s.store.get();
      const t = p.tracks.find((x) => x.id === s.ui.get().selectedTrack && x.kind === 'instrument') ?? p.tracks.find((x) => x.kind === 'instrument');
      if (!t) return;
      if (cmd === 0x90 && d[2] > 0) {
        held.get(d[1])?.();
        held.set(d[1], s.engine.liveNoteOn(t.id, d[1], d[2]));
      } else if (cmd === 0x80 || (cmd === 0x90 && d[2] === 0)) {
        held.get(d[1])?.();
        held.delete(d[1]);
      }
    };
    const attach = () => access?.inputs.forEach((inp) => (inp.onmidimessage = onMsg));
    navigator
      .requestMIDIAccess()
      .then((a) => {
        access = a;
        attach();
        a.onstatechange = attach;
      })
      .catch(() => undefined); // MIDI is optional (often blocked on managed Chromebooks)
    return () => {
      access?.inputs.forEach((inp) => (inp.onmidimessage = null));
      for (const off of held.values()) off();
    };
  }, [s, enabled]);
}
