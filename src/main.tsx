import {lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// /prostaff is the advanced notation editor; it loads its own code only on that path.
const isProStaff = /^\/prostaff(\/|$)/i.test(window.location.pathname);
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
