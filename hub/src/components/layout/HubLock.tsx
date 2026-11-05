import React, { useEffect, useState } from 'react';
import { Lock, KeyRound, Loader2, WifiOff } from 'lucide-react';
import { cloudSync } from '../../services/cloudSync';
import { startCalendarAutoRefresh } from '../../services/calendarFeeds';
import logoTrimmed from '../../assets/logo-trimmed.png';

type Gate = 'checking' | 'setup' | 'locked' | 'offline' | 'ready';

/**
 * Keeps the Hub behind its PIN. Children (the whole app) render only once this device is unlocked
 * and has pulled the latest cloud data, so every screen starts from the synced copy.
 */
export const HubLock: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gate, setGate] = useState<Gate>('checking');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [masterPin, setMasterPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const openApp = async () => {
    try {
      await cloudSync.pull();
    } catch {
      // Offline or the server is unreachable: open with this device's copy and sync later.
    }
    if (cloudSync.hasToken()) {
      cloudSync.start();
      startCalendarAutoRefresh();
      setGate('ready');
    }
  };

  const checkPinSetup = async () => {
    try {
      setGate((await cloudSync.isPinSet()) ? 'locked' : 'setup');
    } catch {
      setGate('offline');
    }
  };

  useEffect(() => {
    const unsub = cloudSync.onLocked(() => {
      setPin('');
      setGate('locked');
    });
    if (cloudSync.hasToken()) openApp();
    else checkPinSetup();
    return unsub;
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      setPin('');
      setConfirmPin('');
      setMasterPin('');
      await openApp();
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    run(() => cloudSync.login(pin));
  };

  const handleSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin !== confirmPin) {
      setError('The two PINs do not match.');
      return;
    }
    run(() => cloudSync.setupPin(masterPin, pin));
  };

  if (gate === 'ready') return <>{children}</>;

  const inputClass =
    'w-full text-center text-lg tracking-[0.3em] font-mono px-4 py-3 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 dark:bg-stone-950 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-6">
        <div className="bg-[#13171d] rounded-2xl p-3 flex justify-center">
          <img src={logoTrimmed} alt="Music Teacher Hub" className="h-10 w-auto object-contain" />
        </div>

        {gate === 'checking' && (
          <div className="flex items-center justify-center gap-2 text-stone-500 text-sm py-6">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Opening your Hub…</span>
          </div>
        )}

        {gate === 'offline' && (
          <div className="text-center space-y-4 py-2">
            <WifiOff className="w-8 h-8 mx-auto text-stone-400" />
            <p className="text-sm text-stone-600 dark:text-stone-300">
              You need an internet connection to unlock the Hub on this device.
            </p>
            <button
              onClick={() => {
                setGate('checking');
                checkPinSetup();
              }}
              className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm"
            >
              Try again
            </button>
          </div>
        )}

        {gate === 'locked' && (
          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="text-center space-y-1">
              <Lock className="w-6 h-6 mx-auto text-brand-600" />
              <h1 className="text-lg font-bold text-stone-900 dark:text-white">Enter your Hub PIN</h1>
            </div>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              aria-label="Hub PIN"
              className={inputClass}
            />
            {error && <p className="text-sm text-rose-600 text-center">{error}</p>}
            <button
              type="submit"
              disabled={busy || !pin}
              className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Unlock
            </button>
            <button
              type="button"
              onClick={() => {
                setError('');
                setPin('');
                setGate('setup');
              }}
              className="w-full text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
            >
              Forgot your PIN? Reset it with the master teacher PIN
            </button>
          </form>
        )}

        {gate === 'setup' && (
          <form onSubmit={handleSetup} className="space-y-4">
            <div className="text-center space-y-1">
              <KeyRound className="w-6 h-6 mx-auto text-brand-600" />
              <h1 className="text-lg font-bold text-stone-900 dark:text-white">Set your Hub PIN</h1>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Enter the site's master teacher PIN, then choose a PIN of at least 6 characters for the Hub.
                Setting a new PIN signs out your other devices.
              </p>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-stone-600 dark:text-stone-300">Master teacher PIN</span>
              <input
                type="password"
                autoComplete="off"
                autoFocus
                value={masterPin}
                onChange={(e) => setMasterPin(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-stone-600 dark:text-stone-300">New Hub PIN</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-stone-600 dark:text-stone-300">New Hub PIN again</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className={inputClass}
              />
            </label>
            {error && <p className="text-sm text-rose-600 text-center">{error}</p>}
            <button
              type="submit"
              disabled={busy || !masterPin || !pin || !confirmPin}
              className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Save PIN and unlock
            </button>
            <button
              type="button"
              onClick={() => {
                setError('');
                checkPinSetup();
              }}
              className="w-full text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
            >
              Already have a PIN? Unlock instead
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
