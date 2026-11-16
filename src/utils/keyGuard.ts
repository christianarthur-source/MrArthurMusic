/**
 * One rule for global keyboard shortcuts (audit WP-6.2), so Space/Enter never "fire twice" or run behind a window.
 * A shortcut handler should return early when shouldIgnoreShortcut(e) is true.
 */

const TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
const ACTIVATABLE = 'button, a[href], summary, [role="button"], [role="menuitem"], [role="tab"], [role="checkbox"], [role="switch"]';

/** True when some pop-up window (dialog) is open anywhere on the page (optionally ignoring one, matched by selector). */
export function isDialogOpen(except?: string): boolean {
  if (typeof document === 'undefined') return false;
  const open = Array.from(document.querySelectorAll('[aria-modal="true"]'));
  return except ? open.some((d) => !d.matches(except)) : open.length > 0;
}

export interface ShortcutGuardOptions {
  /** Keep the shortcut alive when Ctrl/Cmd/Alt is held (for Undo/Copy style shortcuts). */
  allowModifiers?: boolean;
  /** Let the shortcut run when a button/link has focus (games where Space is the tap key). */
  allowOnButtons?: boolean;
  /** Let the shortcut run while a key is held down (rare). */
  allowRepeat?: boolean;
  /** CSS selector of the one window this shortcut lives inside (a Tool Box tool); other windows still block it. */
  ownDialog?: string;
}

export function shouldIgnoreShortcut(e: KeyboardEvent, opts: ShortcutGuardOptions = {}): boolean {
  if (e.defaultPrevented) return true;
  if (!opts.allowModifiers && (e.ctrlKey || e.metaKey || e.altKey)) return true;
  if (e.repeat && !opts.allowRepeat) return true;
  const t = e.target as Element | null;
  if (t && typeof t.closest === 'function') {
    if (t.closest(TYPING)) return true;
    if (!opts.allowOnButtons && t.closest(ACTIVATABLE)) return true;
  }
  if (isDialogOpen(opts.ownDialog)) return true;
  return false;
}
