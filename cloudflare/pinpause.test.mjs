// Checks the device-side PIN pause (src/utils/pinPause.ts): 10 wrong tries, about a minute, survives a reload.
// Run: node cloudflare/pinpause.test.mjs   (no network)
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
};
const dir = mkdtempSync(join(tmpdir(), 'pinpause-test-'));
const out = join(dir, 'pinPause.mjs');
await build({ entryPoints: ['src/utils/pinPause.ts'], bundle: true, format: 'esm', platform: 'neutral', outfile: out, logLevel: 'warning' });
const m = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

let fails = 0;
const expect = (name, ok, got) => {
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : ' -> ' + JSON.stringify(got)));
  if (!ok) fails++;
};
const t0 = 1_000_000;
const a = m.studentPinKey('alex m', 'c1');
const b = m.studentPinKey('bea b', 'c1');

for (let i = 0; i < 9; i++) m.noteWrongPin(a, t0 + i);
expect('9 wrong tries: no pause yet', m.pinPauseSecondsLeft(a, t0 + 10) === 0);
expect('10th wrong try starts a pause of 60 s', m.noteWrongPin(a, t0 + 10) === 60 && m.pinPauseSecondsLeft(a, t0 + 10) === 60);
expect("another student's key is not paused", m.pinPauseSecondsLeft(b, t0 + 10) === 0);
expect('the pause is visible from stored data (survives a reload)', JSON.parse(store.get('mrarthur_pin_pause_v1'))[a].until > t0);
expect('countdown goes down', m.pinPauseSecondsLeft(a, t0 + 40_010) === 20);
expect('the pause ends by itself', m.pinPauseSecondsLeft(a, t0 + 60_011) === 0);
expect('then a fresh allowance starts (not paused after one more wrong try)', m.noteWrongPin(a, t0 + 61_000) === 0);
m.clearWrongPins(a);
for (let i = 0; i < 9; i++) m.noteWrongPin(a, t0 + 70_000 + i);
expect('a correct sign-in clears the count', m.noteWrongPin(a, t0 + 70_100) === 60);
m.noteServerPause(b, 45, t0);
expect('a pause told by the server is shown too', m.pinPauseSecondsLeft(b, t0) === 45);
expect('old mistakes are forgotten after a while', (m.noteWrongPin(m.teacherPinKey('t1'), t0), m.pinPauseSecondsLeft(m.teacherPinKey('t1'), t0 + 20 * 60_000) === 0));
expect('messages are friendly', /ask your teacher/i.test(m.studentPauseMessage(30)) && /wait 30 seconds/.test(m.teacherPauseMessage(30)));

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
