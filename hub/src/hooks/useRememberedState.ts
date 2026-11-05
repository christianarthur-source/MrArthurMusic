import { useEffect, useState } from 'react';

/**
 * Where you left off on each screen (open video, selected date, filters, settings) is kept per
 * device under these keys. They are not part of cloud sync, and locking the device clears them.
 */
export const REMEMBERED_PREFIX = 'hub_ui:';

interface Codec<T> {
  save: (value: T) => unknown;
  load: (stored: any) => T;
}

/** useState that restores its last value the next time the screen opens on this device. */
export function useRememberedState<T>(key: string, initial: T | (() => T), codec?: Codec<T>) {
  const storageKey = REMEMBERED_PREFIX + key;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) {
        const stored = JSON.parse(raw);
        const restored = codec ? codec.load(stored) : (stored as T);
        if (restored !== undefined && restored !== null) return restored;
      }
    } catch {
      // Unreadable or from an older version: start fresh.
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(codec ? codec.save(value) : value));
    } catch {
      // Storage full or blocked: the screen still works, it just won't be remembered.
    }
  }, [storageKey, value]);

  return [value, setValue] as const;
}

/** Stores a Date as an ISO string; anything unreadable falls back to now. */
export const dateCodec: Codec<Date> = {
  save: (d) => d.toISOString(),
  load: (s) => {
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date() : d;
  }
};
