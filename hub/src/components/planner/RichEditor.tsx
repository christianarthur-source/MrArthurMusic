import React, { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading2,
  List,
  ListOrdered,
  ListChecks,
  Highlighter,
  Link2,
  RemoveFormatting,
  Palette
} from 'lucide-react';
import { CHECKLIST_CLASS, safeLinkUrl, sanitizeHtml } from '../../services/plannerContent';

const SAVE_DELAY_MS = 500;

const INK_COLORS = [
  { name: 'Ink', value: '#1c1917' },
  { name: 'Red', value: '#b91c1c' },
  { name: 'Blue', value: '#1d4ed8' },
  { name: 'Green', value: '#15803d' },
  { name: 'Purple', value: '#7e22ce' }
];

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Smaller toolbar that only shows while the editor has focus (week view). */
  compact?: boolean;
  /** Called with image files pasted or dropped into the editor. */
  onImageFiles?: (files: File[]) => void;
  className?: string;
  minHeightClass?: string;
}

const exec = (command: string, arg?: string) => {
  document.execCommand('styleWithCSS', false, 'true');
  document.execCommand(command, false, arg);
};

/** A small rich-text editor for planner pages: bold, lists, checklists, headings, colors and links. */
export const RichEditor: React.FC<RichEditorProps> = ({
  value,
  onChange,
  placeholder = 'Start writing…',
  compact = false,
  onImageFiles,
  className = '',
  minHeightClass = 'min-h-[12rem]'
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(value);
  // The latest onChange, so a save that fires after re-render (or on unmount) still reaches it.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [focused, setFocused] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [isEmpty, setIsEmpty] = useState(!value);

  // Load outside changes (another day, a synced edit) without moving the caret while typing.
  useEffect(() => {
    const el = ref.current;
    if (!el || value === lastSaved.current) return;
    if (document.activeElement === el) return;
    el.innerHTML = value;
    lastSaved.current = value;
    setIsEmpty(!el.textContent?.trim() && !el.querySelector('li'));
  }, [value]);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value;
    setIsEmpty(!ref.current?.textContent?.trim() && !ref.current?.querySelector('li'));
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        flush();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flush = () => {
    const el = ref.current;
    if (!el) return;
    const html = sanitizeHtml(el.innerHTML);
    if (html === lastSaved.current) return;
    lastSaved.current = html;
    onChangeRef.current(html);
  };

  const scheduleSave = () => {
    const el = ref.current;
    setIsEmpty(!el?.textContent?.trim() && !el?.querySelector('li'));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      flush();
    }, SAVE_DELAY_MS);
  };

  const run = (command: string, arg?: string) => {
    ref.current?.focus();
    exec(command, arg);
    scheduleSave();
  };

  const toggleChecklist = () => {
    ref.current?.focus();
    const sel = window.getSelection();
    const node = sel?.anchorNode;
    const list = (node instanceof Element ? node : node?.parentElement)?.closest('ul');
    if (list && ref.current?.contains(list)) {
      if (list.classList.contains(CHECKLIST_CLASS)) {
        list.classList.remove(CHECKLIST_CLASS);
        list.querySelectorAll('li').forEach((li) => li.removeAttribute('data-checked'));
      } else {
        list.classList.add(CHECKLIST_CLASS);
      }
    } else {
      exec('insertUnorderedList');
      const anchor = window.getSelection()?.anchorNode;
      const created = (anchor instanceof Element ? anchor : anchor?.parentElement)?.closest('ul');
      created?.classList.add(CHECKLIST_CLASS);
    }
    scheduleSave();
  };

  const addLink = () => {
    const raw = window.prompt('Link address (https://…)');
    if (!raw) return;
    const url = safeLinkUrl(raw);
    if (!url) {
      window.alert('That does not look like a web address.');
      return;
    }
    const sel = window.getSelection();
    ref.current?.focus();
    if (sel && !sel.isCollapsed) exec('createLink', url);
    else exec('insertHTML', `<a href="${url.replace(/"/g, '&quot;')}">${url.replace(/</g, '&lt;')}</a>&nbsp;`);
    scheduleSave();
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const li = target.closest('li');
    const list = li?.parentElement;
    if (li && list?.classList.contains(CHECKLIST_CLASS)) {
      const box = li.getBoundingClientRect();
      if (e.clientX - box.left < 26) {
        e.preventDefault();
        li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true');
        scheduleSave();
        return;
      }
    }
    const link = target.closest('a');
    if (link && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      window.open(link.href, '_blank', 'noopener,noreferrer');
    }
  };

  const takeImages = (files: FileList | null | undefined) => {
    const images = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    if (images.length && onImageFiles) {
      onImageFiles(images);
      return true;
    }
    return false;
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (takeImages(e.clipboardData.files)) {
      e.preventDefault();
      return;
    }
    const html = e.clipboardData.getData('text/html');
    if (html) {
      e.preventDefault();
      exec('insertHTML', sanitizeHtml(html));
      scheduleSave();
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (takeImages(e.dataTransfer.files)) e.preventDefault();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const key = e.key.toLowerCase();
    if (key === 'k') {
      e.preventDefault();
      addLink();
    } else if (e.shiftKey && key === 'x') {
      e.preventDefault();
      run('strikeThrough');
    }
  };

  const tools: { icon: React.ElementType; label: string; action: () => void }[] = [
    { icon: Bold, label: 'Bold (⌘B)', action: () => run('bold') },
    { icon: Italic, label: 'Italic (⌘I)', action: () => run('italic') },
    { icon: Underline, label: 'Underline (⌘U)', action: () => run('underline') },
    { icon: Strikethrough, label: 'Strikethrough', action: () => run('strikeThrough') },
    { icon: Heading2, label: 'Heading', action: () => run('formatBlock', 'h3') },
    { icon: List, label: 'Bulleted list', action: () => run('insertUnorderedList') },
    { icon: ListOrdered, label: 'Numbered list', action: () => run('insertOrderedList') },
    { icon: ListChecks, label: 'Checklist', action: toggleChecklist },
    { icon: Highlighter, label: 'Highlight', action: () => run('hiliteColor', '#fde68a') },
    { icon: Link2, label: 'Link (⌘K)', action: addLink },
    { icon: RemoveFormatting, label: 'Clear formatting', action: () => run('removeFormat') }
  ];

  const showToolbar = !compact || focused;

  return (
    <div className={`relative ${className}`}>
      {showToolbar && (
        <div
          className={`no-print flex flex-wrap items-center gap-0.5 ${
            compact
              ? 'absolute -top-9 left-0 z-20 rounded-lg bg-white dark:bg-stone-800 shadow-md border border-stone-200 dark:border-stone-700 px-1 py-0.5'
              : 'mb-2 pb-2 border-b border-stone-300/60 dark:border-stone-600/60'
          }`}
          onMouseDown={(e) => e.preventDefault()}
        >
          {tools.map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              onClick={action}
              className="p-1.5 rounded-md text-stone-600 hover:text-stone-900 hover:bg-stone-900/5 dark:text-stone-300 dark:hover:text-white dark:hover:bg-white/10"
            >
              <Icon className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            </button>
          ))}
          <div className="relative">
            <button
              type="button"
              title="Ink color"
              aria-label="Ink color"
              onClick={() => setShowColors((v) => !v)}
              className="p-1.5 rounded-md text-stone-600 hover:text-stone-900 hover:bg-stone-900/5 dark:text-stone-300 dark:hover:text-white dark:hover:bg-white/10"
            >
              <Palette className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            </button>
            {showColors && (
              <div className="absolute top-full left-0 mt-1 z-30 flex gap-1 p-1.5 rounded-lg bg-white dark:bg-stone-800 shadow-lg border border-stone-200 dark:border-stone-700">
                {INK_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.name}
                    aria-label={`${c.name} ink`}
                    onClick={() => {
                      run('foreColor', c.value);
                      setShowColors(false);
                    }}
                    className="w-5 h-5 rounded-full border border-stone-300"
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="relative">
        {isEmpty && (
          <div className="pointer-events-none absolute inset-0 text-stone-400 dark:text-stone-500 italic">{placeholder}</div>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder}
          onInput={scheduleSave}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setShowColors(false);
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = null;
            flush();
          }}
          onClick={handleClick}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onKeyDown={handleKeyDown}
          className={`planner-rich outline-none ${minHeightClass}`}
        />
      </div>
    </div>
  );
};
