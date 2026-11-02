import React, { useState } from 'react';
import { Pencil, Play, Search, X } from 'lucide-react';

const TOUR_KEY = 'wolfi:tour-done';

const STEPS: { icon: React.ReactNode; title: string; text: React.ReactNode }[] = [
  {
    icon: <Pencil size={18} />,
    title: 'Add notes',
    text: <>Press <kbd>N</kbd> or click <b>Add notes</b>, then click the staff or type <kbd>A</kbd>–<kbd>G</kbd>. Numbers <kbd>1</kbd>–<kbd>7</kbd> set the length.</>,
  },
  {
    icon: <span className="ps-hint-arrow">↖</span>,
    title: 'Select and change',
    text: <>Switch to <b>Select</b> to click, drag across, or drag notes up and down. The <b>Properties</b> panel on the right shows options for whatever you pick.</>,
  },
  {
    icon: <Search size={18} />,
    title: 'Find anything',
    text: <>Press <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd> and type what you want: “crescendo”, “key of D”, “transpose”. Press <kbd>Space</kbd> to play.</>,
  },
];

/** A three-step welcome shown once per device. */
export function FirstRunTour() {
  const [step, setStep] = useState<number | null>(() => {
    try {
      return localStorage.getItem(TOUR_KEY) ? null : 0;
    } catch {
      return null;
    }
  });
  if (step === null) return null;
  const done = () => {
    try {
      localStorage.setItem(TOUR_KEY, '1');
    } catch {
      /* ignore */
    }
    setStep(null);
  };
  const s = STEPS[step];
  return (
    <div className="ps-tour" role="dialog" aria-label="Welcome to Wolfi">
      <button className="ps-tour-x" onClick={done} aria-label="Close tips"><X size={14} /></button>
      <div className="ps-tour-head">
        <span className="ps-tour-icon">{s.icon}</span>
        <b>{s.title}</b>
        <small>{step + 1} / {STEPS.length}</small>
      </div>
      <p>{s.text}</p>
      <div className="ps-tour-foot">
        <button className="ps-link" onClick={done}>Skip tips</button>
        <span style={{ flex: 1 }} />
        {step > 0 && <button className="ps-btn ps-outline" onClick={() => setStep(step - 1)}>Back</button>}
        <button className="ps-btn ps-primary" onClick={() => (step + 1 < STEPS.length ? setStep(step + 1) : done())}>{step + 1 < STEPS.length ? 'Next' : 'Got it'}</button>
      </div>
    </div>
  );
}

/** Shown over an empty score: the one thing to do next. */
export function EmptyScoreHint({ onAddNotes, onPlayDemo }: { onAddNotes: () => void; onPlayDemo?: () => void }) {
  return (
    <div className="ps-empty-hint">
      <b>This score is empty.</b>
      <span>Press <kbd>N</kbd> and type letters A–G, or click the staff.</span>
      <button className="ps-btn ps-primary" onClick={onAddNotes}><Pencil size={14} /> Add notes</button>
      {onPlayDemo && <button className="ps-btn ps-outline" onClick={onPlayDemo}><Play size={14} /> Hear an example</button>}
    </div>
  );
}
