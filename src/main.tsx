import {lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary';
import './index.css';

// /wolfie (also /wolfi and /prostaff) is the advanced notation editor; it loads its own code only there.
const isProStaff = /^\/(wolfie|wolfi|prostaff)(\/|$)/i.test(window.location.pathname);
const ProStaff = lazy(() => import('./prostaff'));

createRoot(document.getElementById('root')!).render(
  // Last line of defence: a crash anywhere shows a way back instead of a blank page.
  <ErrorBoundary toolName={isProStaff ? 'Wolfi' : undefined}>
    {isProStaff ? (
      <Suspense fallback={<div style={{position: 'fixed', inset: 0, background: '#121418'}} />}>
        <ProStaff />
      </Suspense>
    ) : (
      <App />
    )}
  </ErrorBoundary>,
);
