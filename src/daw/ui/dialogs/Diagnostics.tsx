import { useEffect, useState } from 'react';
import { EngineDiagnostics } from '../../engine/engine';
import { runTimingSelfTest, SelfTestResult } from '../../export/selfTest';
import { Modal } from '../controls';
import { useStudio } from '../studio';

/** Timing diagnostics: live scheduler stats plus an offline-render timing self-test. */
export function DiagnosticsDialog({ onClose }: { onClose: () => void }) {
  const s = useStudio();
  const [d, setD] = useState<EngineDiagnostics>(() => s.engine.diagnostics());
  const [results, setResults] = useState<SelfTestResult[] | null>(null);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setD(s.engine.diagnostics()), 500);
    return () => clearInterval(id);
  }, [s]);
  const rows: [string, string, boolean?][] = [
    ['Audio context', `${d.contextState} @ ${d.sampleRate} Hz`, d.contextState !== 'running'],
    ['Base / output latency', `${d.baseLatencyMs.toFixed(1)} ms / ${d.outputLatencyMs.toFixed(1)} ms`],
    ['Look-ahead window', `${d.lookaheadMs} ms`],
    ['Scheduler wake-ups', `${d.wakeups} (avg ${d.avgWakeGapMs.toFixed(1)} ms, worst ${d.maxWakeGapMs.toFixed(1)} ms)`, d.maxWakeGapMs > d.lookaheadMs * 0.75],
    ['Events scheduled', String(d.scheduledEvents)],
    ['Late events (scheduled after their time)', String(d.lateEvents), d.lateEvents > 0],
    ['Smallest scheduling margin', `${d.minLeadMs.toFixed(1)} ms`, d.scheduledEvents > 0 && d.minLeadMs < 5],
    ['Active voices', String(d.activeVoices)],
    ['Clips waiting for audio', String(d.missingAssets)],
    ['Clips playing with temporary tape-speed stretch', String(d.fallbackStretch)],
    ['Playhead latency correction', `${d.playheadErrorMs.toFixed(1)} ms`],
    ['Audio underruns (if the browser reports them)', d.underruns === null ? 'not reported by this browser' : String(d.underruns), (d.underruns ?? 0) > 0],
    ['Audio memory', `${d.memory.decodedMB.toFixed(1)} MB decoded, ${d.memory.processedMB.toFixed(1)} MB stretched`],
  ];
  return (
    <Modal title="Timing diagnostics" onClose={onClose} wide>
      <p className="mb-3 text-xs text-slate-400">Values reset each time you press play. Red rows need attention.</p>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v, bad]) => (
            <tr key={k} className="border-b border-slate-800">
              <td className="py-1 pr-3 text-slate-400">{k}</td>
              <td className={`py-1 font-mono ${bad ? 'text-rose-300' : 'text-slate-200'}`}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 space-y-2">
        <button
          type="button"
          data-testid="run-selftest"
          disabled={running}
          className="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
          onClick={async () => {
            setRunning(true);
            try {
              setResults(await runTimingSelfTest(s.engine.ctx, s.engine.instruments));
            } catch (err) {
              setResults([{ name: 'Self-test', pass: false, detail: err instanceof Error ? err.message : String(err) }]);
            } finally {
              setRunning(false);
            }
          }}
        >
          {running ? 'Running…' : 'Run timing self-test'}
        </button>
        <p className="text-xs text-slate-500">Renders test click tracks through the real engine (offline) and measures where every click lands.</p>
        {results && (
          <ul className="space-y-1 text-sm" data-testid="selftest-results">
            {results.map((r) => (
              <li key={r.name} className={r.pass ? 'text-emerald-300' : 'text-rose-300'}>
                {r.pass ? '✔' : '✘'} {r.name}: <span className="text-slate-300">{r.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
