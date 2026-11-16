// Checks the roster CSV reader (src/utils/rosterCsv.ts). Run: node cloudflare/rostercsv.test.mjs   (no network)
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const dir = mkdtempSync(join(tmpdir(), 'rostercsv-test-'));
const out = join(dir, 'r.mjs');
await build({ entryPoints: ['src/utils/rosterCsv.ts'], bundle: true, format: 'esm', platform: 'neutral', outfile: out, logLevel: 'warning' });
const { parseRosterCsv, MAX_ROSTER_ROWS } = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

// header skipped, BOM and Windows line ends handled, empty rows ignored
let r = parseRosterCsv('﻿First Name,PIN,Class\r\nEmma S,1024,Room 101\r\n\r\nNoah K,2048,Room 101\r\n');
assert.deepEqual(r.lines, ['Emma S, 1024, Room 101', 'Noah K, 2048, Room 101']);
assert.equal(r.skippedHeader, true);

// no header, name only, name + class without PIN (empty PIN slot kept)
r = parseRosterCsv('Olivia T\nLiam R,,Room 5\nMia P,3030');
assert.deepEqual(r.lines, ['Olivia T', 'Liam R, , Room 5', 'Mia P, 3030']);
assert.equal(r.skippedHeader, false);

// quoted cell with a comma does not break the Name, PIN, Class shape; doubled quotes
r = parseRosterCsv('"Smith, Emma",1111,"Room ""A"""');
assert.deepEqual(r.lines, ['Smith Emma, 1111, Room "A"']);

// semicolon and tab files, extra columns dropped
assert.deepEqual(parseRosterCsv('Ana;1234;Rm 2;extra').lines, ['Ana, 1234, Rm 2']);
assert.deepEqual(parseRosterCsv('Ben\t4321\tRm 3').lines, ['Ben, 4321, Rm 3']);

// nothing useful, and the 500 row cap
assert.deepEqual(parseRosterCsv('').lines, []);
assert.deepEqual(parseRosterCsv('Name,PIN\n').lines, []);
r = parseRosterCsv(Array.from({ length: MAX_ROSTER_ROWS + 5 }, (_, i) => `S${i}`).join('\n'));
assert.equal(r.lines.length, MAX_ROSTER_ROWS);
assert.equal(r.truncated, true);

// every output line survives the Bulk Add splitter with the intended fields
const split = (l) => l.split(/[,\t]+/).map((p) => p.trim());
assert.deepEqual(split('Liam R, , Room 5'), ['Liam R', '', 'Room 5']);

console.log('rostercsv: ok');
