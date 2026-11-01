import React, { useEffect, useRef, useState } from 'react';

/** Text that turns into an input when clicked; Enter or leaving the field saves, Esc cancels. */
export function InlineEdit({ value, placeholder, onSave, className }: { value: string; placeholder: string; onSave: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!editing) setText(value);
  }, [value, editing]);
  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);
  if (!editing) {
    return (
      <button className={`ps-inline ${className || ''}${value ? '' : ' ps-inline-empty'}`} title={`Click to edit ${placeholder.toLowerCase().replace(/^add /, '')}`} onClick={() => setEditing(true)}>
        {value || placeholder}
      </button>
    );
  }
  const done = (save: boolean) => {
    setEditing(false);
    if (save && text.trim() !== value) onSave(text.trim());
  };
  return (
    <input
      ref={ref}
      className={`ps-inline-input ${className || ''}`}
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => done(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') done(true);
        if (e.key === 'Escape') done(false);
        e.stopPropagation();
      }}
    />
  );
}

/** Small editor that opens when the title area on the page is clicked. */
export function HeaderEditor({ meta, pos, onSave, onClose }: {
  meta: { title: string; subtitle: string; composer: string };
  pos: { left: number; top: number };
  onSave: (m: { title: string; subtitle: string; composer: string }) => void;
  onClose: () => void;
}) {
  const [m, setM] = useState(meta);
  const save = () => {
    onSave({ title: m.title.trim(), subtitle: m.subtitle.trim(), composer: m.composer.trim() });
    onClose();
  };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') onClose();
    e.stopPropagation();
  };
  return (
    <div className="ps-header-edit" style={{ left: pos.left, top: pos.top }} onMouseDown={(e) => e.stopPropagation()}>
      <input className="ps-input ps-he-title" autoFocus value={m.title} placeholder="Title" onChange={(e) => setM({ ...m, title: e.target.value })} onKeyDown={key} />
      <input className="ps-input" value={m.subtitle} placeholder="Subtitle (optional)" onChange={(e) => setM({ ...m, subtitle: e.target.value })} onKeyDown={key} />
      <input className="ps-input" value={m.composer} placeholder="Composer" onChange={(e) => setM({ ...m, composer: e.target.value })} onKeyDown={key} />
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button className="ps-btn ps-outline" onClick={onClose}>Cancel</button>
        <button className="ps-btn ps-primary" onClick={save}>Save</button>
      </div>
    </div>
  );
}
