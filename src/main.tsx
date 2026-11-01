import {lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// /wolfi (also /prostaff) is the advanced notation editor; it loads its own code only on those paths.
const isProStaff = /^\/(prostaff|wolfi)(\/|$)/i.test(window.location.pathname);
const ProStaff = lazy(() => import('./prostaff'));

createRoot(document.getElementById('root')!).render(
  isProStaff ? (
    <Suspense fallback={<div style={{position: 'fixed', inset: 0, background: '#121418'}} />}>
      <ProStaff />
    </Suspense>
  ) : (
    <App />
  ),
);
