import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let bg = 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900';
        let icon = <Info className="w-5 h-5 text-brand-400 shrink-0" />;

        if (toast.type === 'success') {
          bg = 'bg-emerald-900 text-emerald-50 dark:bg-emerald-800 dark:text-white border border-emerald-700/50';
          icon = <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
        } else if (toast.type === 'warning' || toast.type === 'error') {
          bg = 'bg-rose-950 text-rose-50 dark:bg-rose-900 dark:text-white border border-rose-800/50';
          icon = <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl shadow-elevated transition-all duration-200 transform translate-y-0 ${bg}`}
          >
            <div className="flex items-center gap-3 pr-2">
              {icon}
              <p className="text-sm font-medium leading-snug">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 hover:opacity-75 rounded-lg transition-opacity"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
