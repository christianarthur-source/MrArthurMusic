import React from 'react';

/**
 * Wraps a modal/overlay so its code downloads only the first time it is opened.
 * After that it stays mounted (exactly like before), so its internal state is kept.
 * If the file cannot be fetched (offline, or the site was just updated) the rest of the app keeps
 * working and a small message explains it, instead of the whole page turning into an error screen.
 */

interface LoadGuardProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose?: () => void;
}

class LoadGuard extends React.Component<LoadGuardProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error('Could not load a window:', error);
  }

  componentDidUpdate(prev: LoadGuardProps) {
    // Let the student try again the next time they open it.
    if (this.state.failed && prev.isOpen && !this.props.isOpen) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (!this.props.isOpen) return null;
    return (
      <div
        role="alert"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] max-w-sm rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-slate-100 shadow-xl"
      >
        This window could not load. Check your internet connection, then close and try again.
        {this.props.onClose && (
          <button
            type="button"
            onClick={this.props.onClose}
            className="ml-3 rounded-lg bg-amber-400 px-2 py-1 text-xs font-bold text-slate-900"
          >
            Close
          </button>
        )}
      </div>
    );
  }
}

export function lazyModal<P extends { isOpen: boolean; onClose?: () => void }>(
  loader: () => Promise<{ default: React.ComponentType<P> }>,
): React.FC<P> {
  const Lazy = React.lazy(loader) as unknown as React.ComponentType<P>;
  const LazyModal: React.FC<P> = (props) => {
    const opened = React.useRef(false);
    if (props.isOpen) opened.current = true;
    if (!opened.current) return null;
    return (
      <LoadGuard isOpen={props.isOpen} onClose={props.onClose}>
        <React.Suspense fallback={null}>
          <Lazy {...props} />
        </React.Suspense>
      </LoadGuard>
    );
  };
  return LazyModal;
}
