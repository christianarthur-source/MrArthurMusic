import React from 'react';

/**
 * One shared window behaviour for every pop-up in the site (audit WP-6.1).
 *
 * What a <Modal> gives a window:
 *  - role="dialog" + aria-modal and a name for screen readers (aria-label / aria-labelledby)
 *  - Escape closes it (only the top-most window when two are open)
 *  - Tab / Shift+Tab stay inside it
 *  - focus moves into it when it opens and goes back to where it was when it closes
 *  - optional click-on-the-dark-backdrop to close
 *
 * It renders the dark full-screen overlay itself, so a window is written as
 *   <Modal onClose={close} label="Share your song" className="... bg-slate-950/80 p-4"> ...panel... </Modal>
 * The className is whatever the old overlay <div> had (it keeps "fixed inset-0 ..." styling).
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/** Stack of open windows; only the last one reacts to Escape / Tab. */
const openStack: symbol[] = [];

function visibleFocusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('inert') && !el.closest('[aria-hidden="true"]') && el.getClientRects().length > 0,
  );
}

type DialogOpts = { escape?: boolean; initialFocus?: 'first' | 'container' | 'none' };

/** Attach the shared window behaviour to an element; returns the clean-up. */
function attachDialog(root: HTMLElement, getClose: () => (() => void) | undefined, opts: DialogOpts): () => void {
  const escape = opts.escape !== false;
  const initialFocus = opts.initialFocus || 'first';
  const id = Symbol('dialog');
  openStack.push(id);
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  // Move focus in, unless something inside already took it (autoFocus).
  if (initialFocus !== 'none' && !root.contains(document.activeElement)) {
    const target = initialFocus === 'first' ? visibleFocusables(root)[0] : null;
    if (target) target.focus({ preventScroll: true });
    else {
      if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
      root.focus({ preventScroll: true });
    }
  }

  const onKey = (e: KeyboardEvent) => {
    if (openStack[openStack.length - 1] !== id) return;
    if (e.key === 'Escape' && escape && !e.defaultPrevented) {
      const close = getClose();
      if (close) {
        e.stopPropagation();
        e.preventDefault();
        close();
      }
      return;
    }
    if (e.key === 'Tab') {
      const items = visibleFocusables(root);
      if (items.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (!current || !root.contains(current)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (current === first || current === root)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener('keydown', onKey, true);

  return () => {
    document.removeEventListener('keydown', onKey, true);
    const i = openStack.indexOf(id);
    if (i >= 0) openStack.splice(i, 1);
    // Give focus back to what opened the window (if it is still on the page).
    if (previous && previous.isConnected) {
      try {
        previous.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    }
  };
}

/**
 * Behaviour only, for overlays that must keep their own markup.
 * Put the returned ref on the overlay (or panel) element. Pass active=false while the window is closed
 * (for components that stay mounted and return null when closed).
 */
export function useDialogBehavior<T extends HTMLElement = HTMLDivElement>(
  onClose: (() => void) | undefined,
  opts: DialogOpts & { active?: boolean } = {},
) {
  const ref = React.useRef<T>(null);
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  const active = opts.active !== false;
  React.useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    return attachDialog(root, () => closeRef.current, opts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return ref;
}

/**
 * Drop-in for overlays rendered inline inside a big component: put <DialogBehavior onClose label /> as the
 * first child of the overlay <div>. It gives that parent the dialog role + aria attributes and the shared
 * behaviour, and removes them again when the overlay closes. Renders nothing visible.
 */
export function DialogBehavior({ onClose, label, ...opts }: { onClose?: () => void; label: string } & DialogOpts) {
  const marker = React.useRef<HTMLSpanElement>(null);
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  React.useEffect(() => {
    const root = marker.current?.parentElement;
    if (!root) return;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', label);
    return attachDialog(root, () => closeRef.current, opts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <span ref={marker} hidden />;
}

/** True when a key event came from inside an open window; for global shortcut handlers to ignore. */
export function eventInsideDialog(e: Event): boolean {
  const t = e.target as Element | null;
  return !!(t && typeof t.closest === 'function' && t.closest('[role="dialog"], [role="alertdialog"]'));
}

export interface ModalProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'role'> {
  onClose?: () => void;
  /** Spoken name when the window has no visible heading wired up with labelledBy. */
  label?: string;
  labelledBy?: string;
  /** Close when the dark area outside the panel is pressed. Default true when onClose is given. */
  closeOnBackdrop?: boolean;
  /** Set false for windows that must not close with Escape (rare). */
  closeOnEscape?: boolean;
  role?: 'dialog' | 'alertdialog';
  initialFocus?: 'first' | 'container' | 'none';
}

export const Modal = React.forwardRef<HTMLDivElement, ModalProps>(function Modal(
  { onClose, label, labelledBy, closeOnBackdrop, closeOnEscape, role = 'dialog', initialFocus, children, onMouseDown, ...rest },
  forwarded,
) {
  const ref = useDialogBehavior<HTMLDivElement>(onClose, { escape: closeOnEscape, initialFocus });
  const backdrop = closeOnBackdrop ?? !!onClose;
  const setRefs = (node: HTMLDivElement | null) => {
    (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    if (typeof forwarded === 'function') forwarded(node);
    else if (forwarded) (forwarded as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };
  return (
    <div
      {...rest}
      ref={setRefs}
      role={role}
      aria-modal="true"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      onMouseDown={(e) => {
        onMouseDown?.(e);
        if (backdrop && onClose && e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
});

export default Modal;
