import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { HubLock } from './components/layout/HubLock';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <HubLock>
      <App />
    </HubLock>
  </React.StrictMode>
);
