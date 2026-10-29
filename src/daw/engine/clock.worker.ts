/// <reference lib="webworker" />
/**
 * Wake-up ticker for the look-ahead scheduler. Worker timers are not throttled
 * like main-thread timers in background tabs. This is NOT a musical clock: the
 * scheduler reads AudioContext.currentTime on every tick.
 */
let id: ReturnType<typeof setInterval> | null = null;
self.onmessage = (e: MessageEvent<{ cmd: 'start' | 'stop'; intervalMs?: number }>) => {
  if (id !== null) clearInterval(id);
  id = null;
  if (e.data.cmd === 'start') id = setInterval(() => postMessage(performance.now()), e.data.intervalMs ?? 25);
};
