import { ArrowLeft, Check, Cloud, HelpCircle, Home, KeyboardMusic, Library, Loader2, Mic, Menu, Redo2, Save, Share2, Sliders, Undo2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { saveProjectLocal, duplicateProject } from '../persistence/projectRepo';
import { importFiles, redo, undo } from './actions';
import { cx, EditableText, IconButton } from './controls';
import { useProject, useStudio, useSubscribe, useUi } from './studio';

export function TopBar({ onHome, onSave, cloudLabel }: { onHome: () => void; onSave: () => void; cloudLabel?: string }) {
  const s = useStudio();
  const title = useProject((p) => p.title);
  const save = useSubscribe((fn) => s.autosave.subscribe(fn), () => s.autosave.status);
  useProject((p) => p); // re-render for undo/redo availability
  const libraryOpen = useUi((u) => u.libraryOpen);
  const bottom = useUi((u) => u.bottom);
  const beginner = useUi((u) => u.beginner);
  const [menu, setMenu] = useState<'file' | 'help' | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const item = (label: string, run: () => void, hint?: string) => (
    <button
      type="button"
      role="menuitem"
      className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-800"
      onClick={() => {
        setMenu(null);
        run();
      }}
    >
      {label}
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </button>
  );

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-950 px-2">
      {s.host.onExit && (
        <IconButton label="Back to Music Lab" onClick={s.host.onExit}>
          <ArrowLeft size={17} />
        </IconButton>
      )}
      <IconButton label="My songs (start screen)" onClick={onHome}>
        <Home size={17} />
      </IconButton>
      <div className="relative">
        <IconButton label="File menu" onClick={() => setMenu(menu === 'file' ? null : 'file')} active={menu === 'file'}>
          <Menu size={17} /> <span className="hidden sm:inline">File</span>
        </IconButton>
        {menu === 'file' && (
          <div role="menu" className="absolute left-0 top-9 z-[70] w-64 rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-2xl" onPointerLeave={() => setMenu(null)}>
            {item('Share (link)…', () => s.ui.set({ dialog: 'share' }))}
            {item('New song…', onHome)}
            {item('Save', onSave, 'Ctrl+S')}
            {item('Save a copy', async () => {
              const copy = duplicateProject(s.store.get());
              await saveProjectLocal(copy);
              s.loadProject(copy);
              s.ui.toast('success', `Saved a copy: "${copy.title}". You are now editing the copy.`);
            })}
            {item('Import audio or MIDI file…', () => fileInput.current?.click())}
            {item(s.store.get().video ? 'Replace video…' : 'Add video…', () => s.ui.set({ dialog: 'video' }))}
            {item('Export / download…', () => s.ui.set({ dialog: 'export' }), 'Ctrl+E')}
            {item('Recording setup…', () => s.ui.set({ dialog: 'record' }))}
            {item('Storage & cache…', () => s.ui.set({ dialog: 'storage' }))}
            {item('Clear song…', () => {
              if (!confirm('Remove all tracks and clips from this song? You can undo this.')) return;
              s.store.exec('Clear song', (p) => ({ ...p, tracks: [], regions: [], markers: [] }));
            })}
          </div>
        )}
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="audio/*,.mid,.midi,.wav,.mp3,.ogg,.m4a,.flac,.aif,.aiff"
          className="hidden"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = '';
            void importFiles(s, files);
          }}
        />
      </div>
      <IconButton label={`Undo ${s.store.undoLabel() ?? ''}`} shortcut="Ctrl+Z" disabled={!s.store.canUndo()} onClick={() => undo(s)}>
        <Undo2 size={16} />
      </IconButton>
      <IconButton label={`Redo ${s.store.redoLabel() ?? ''}`} shortcut="Ctrl+Shift+Z" disabled={!s.store.canRedo()} onClick={() => redo(s)}>
        <Redo2 size={16} />
      </IconButton>

      <div className="mx-2 flex min-w-0 flex-1 items-center justify-center gap-2">
        <EditableText
          label="Song title"
          value={title}
          maxLength={60}
          className="max-w-[22rem] daw-display text-lg text-slate-100"
          onCommit={(v) => {
            if (s.host.textFilter && !s.host.textFilter(v)) {
              s.ui.toast('warn', 'Please use school-appropriate words in the song title.');
              return;
            }
            s.store.exec('Rename song', (p) => ({ ...p, title: v.slice(0, 60) }));
          }}
        />
        <span className={cx('flex items-center gap-1 text-xs', save === 'error' ? 'text-rose-300' : save === 'saved' ? 'text-emerald-400' : 'text-slate-400')} role="status" title={save === 'error' ? (s.autosave.lastError ?? '') : 'Songs save automatically on this computer'} data-testid="save-status">
          {save === 'saving' ? <Loader2 size={12} className="animate-spin" /> : save === 'saved' ? <Check size={12} /> : null}
          {save === 'saved' ? 'Saved' : save === 'saving' ? 'Saving…' : save === 'unsaved' ? 'Unsaved changes' : 'Not saved!'}
        </span>
      </div>

      <IconButton label={cloudLabel ? `Save to ${cloudLabel}` : 'Save'} shortcut="Ctrl+S" tone="accent" onClick={onSave}>
        {cloudLabel ? <Cloud size={16} /> : <Save size={16} />} <span className="hidden md:inline">Save</span>
      </IconButton>
      <IconButton label="Share a link to this song" onClick={() => s.ui.set({ dialog: 'share' })}>
        <Share2 size={16} /> <span className="hidden xl:inline">Share</span>
      </IconButton>
      <IconButton label="Keyboard: play notes with the mouse, computer keys or a MIDI keyboard" shortcut="N" active={bottom === 'keyboard'} onClick={() => s.ui.set({ bottom: bottom === 'keyboard' ? 'none' : 'keyboard' })}>
        <KeyboardMusic size={16} /> <span className="hidden lg:inline">Keyboard</span>
      </IconButton>
      <IconButton label="Recording setup" onClick={() => s.ui.set({ dialog: 'record' })}>
        <Mic size={16} />
      </IconButton>
      <IconButton label="Mixer" shortcut="M" active={bottom === 'mixer'} onClick={() => s.ui.set({ bottom: bottom === 'mixer' ? 'none' : 'mixer' })}>
        <Sliders size={16} />
      </IconButton>
      <IconButton label={libraryOpen ? 'Hide loop library' : 'Show loop library'} active={libraryOpen} onClick={() => s.ui.set({ libraryOpen: !libraryOpen })}>
        <Library size={16} /> <span className="hidden lg:inline">Loops</span>
      </IconButton>
      <div className="relative">
        <IconButton label="Help" onClick={() => setMenu(menu === 'help' ? null : 'help')} active={menu === 'help'}>
          <HelpCircle size={17} />
        </IconButton>
        {menu === 'help' && (
          <div role="menu" className="absolute right-0 top-9 z-[70] w-64 rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-2xl" onPointerLeave={() => setMenu(null)}>
            {item('Guided tutorial', () => s.ui.set({ tutorialStep: 0 }))}
            {item('Keyboard shortcuts', () => s.ui.set({ dialog: 'shortcuts' }), '?')}
            {item(beginner ? 'Switch to advanced mode' : 'Switch to beginner mode', () => s.ui.set({ beginner: !beginner }))}
            {item('Timing diagnostics…', () => s.ui.set({ dialog: 'diagnostics' }))}
            {item('About & sound credits…', () => s.ui.set({ dialog: 'about' }))}
          </div>
        )}
      </div>
    </header>
  );
}
