import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, Loader2, Lock, RefreshCw, KeyRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { cloudSync, SyncState } from '../../services/cloudSync';

const STATUS_TEXT: Record<SyncState['status'], string> = {
  synced: 'Up to date',
  syncing: 'Syncing…',
  offline: 'Offline: changes will upload when you reconnect',
  error: 'Could not reach the cloud: changes are saved on this device and will retry'
};

/** Settings card: sync status, sync now, change PIN, and lock this device. */
export const CloudSyncCard: React.FC = () => {
  const { showToast } = useApp();
  const [state, setState] = useState<SyncState>(cloudSync.getState());
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => cloudSync.onStateChange(() => setState(cloudSync.getState())), []);

  const handleSyncNow = async () => {
    try {
      await cloudSync.pull();
      showToast('Everything is synced', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Sync failed', 'error');
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      showToast('The two new PINs do not match', 'error');
      return;
    }
    setBusy(true);
    try {
      await cloudSync.changePin(currentPin, newPin);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      showToast('PIN changed. Your other devices will ask for the new PIN.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not change the PIN', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleLock = async () => {
    if (!confirm('Lock the Hub on this device? You will need your PIN to open it again.')) return;
    await cloudSync.lock();
  };

  const inputClass =
    'w-full text-xs font-mono px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500';
  const StatusIcon = state.status === 'syncing' ? Loader2 : state.status === 'synced' ? Cloud : CloudOff;

  return (
    <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 sm:p-8 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-4">
      <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
        <Cloud className="w-4 h-4 text-brand-600" />
        <span>Cloud Sync & PIN Lock</span>
      </h2>
      <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
        Everything you save in the Hub syncs to your account on mrarthurmusic.com, so it is the same on every device
        you unlock with your PIN. Uploaded audio files are not synced yet.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-stone-700 dark:text-stone-300">
          <StatusIcon className={`w-4 h-4 ${state.status === 'syncing' ? 'animate-spin' : ''}`} />
          {STATUS_TEXT[state.status]}
          {state.lastSync && state.status !== 'syncing' && (
            <span className="font-normal text-stone-500">· last synced {new Date(state.lastSync).toLocaleString()}</span>
          )}
        </span>
        <button
          onClick={handleSyncNow}
          className="ml-auto px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-bold flex items-center gap-2 border border-stone-200 dark:border-stone-700"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Sync now</span>
        </button>
        <button
          onClick={handleLock}
          className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-stone-700 dark:hover:bg-stone-600 text-white text-xs font-bold flex items-center gap-2"
        >
          <Lock className="w-4 h-4" />
          <span>Lock this device</span>
        </button>
      </div>

      <form onSubmit={handleChangePin} className="pt-2 space-y-2">
        <h3 className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5" />
          <span>Change PIN</span>
        </h3>
        <div className="grid sm:grid-cols-3 gap-2">
          <input type="password" autoComplete="current-password" placeholder="Current PIN" value={currentPin} onChange={(e) => setCurrentPin(e.target.value)} className={inputClass} />
          <input type="password" autoComplete="new-password" placeholder="New PIN (6+ characters)" value={newPin} onChange={(e) => setNewPin(e.target.value)} className={inputClass} />
          <input type="password" autoComplete="new-password" placeholder="New PIN again" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} className={inputClass} />
        </div>
        <button
          type="submit"
          disabled={busy || !currentPin || !newPin || !confirmPin}
          className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>Change PIN</span>
        </button>
      </form>
    </div>
  );
};
