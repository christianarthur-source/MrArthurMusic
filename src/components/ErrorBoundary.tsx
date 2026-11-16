import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Name shown in the message, e.g. "Beat Machine". */
  toolName?: string;
  /** Return to the landing page without reloading. Without it the button loads the home page. */
  onBackToHub?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Catches a crash in one tool so the student sees a way back instead of a blank white page.
 * Their saved work is untouched: it lives in the class account or in this browser's storage.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Music Lab tool crashed:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // After the site is updated, a page left open can ask for files that no longer exist.
    const isStaleFile = /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError/i.test(
      String(error?.message || error),
    );
    const name = this.props.toolName || 'This page';

    return (
      <div
        role="alert"
        className="min-h-screen bg-[#0B0F19] text-slate-100 flex items-center justify-center p-6 font-sans"
      >
        <div className="max-w-md w-full rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center space-y-4">
          <div className="text-4xl" aria-hidden="true">🎵</div>
          <h1 className="text-xl font-bold">
            {isStaleFile ? 'The Music Lab was updated' : `${name} hit a problem`}
          </h1>
          <p className="text-sm text-slate-300">
            {isStaleFile
              ? 'Reload the page to get the newest version.'
              : 'Something went wrong on this screen. Songs you already saved are safe.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => {
                if (this.props.onBackToHub) {
                  this.props.onBackToHub();
                  this.setState({ error: null });
                } else {
                  window.location.assign('/');
                }
              }}
              className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-bold text-slate-100 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Back to Music Lab
            </button>
          </div>
        </div>
      </div>
    );
  }
}
