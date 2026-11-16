/**
 * Turns a roster spreadsheet saved as CSV (or tab-separated text) into lines for the teacher's
 * "Bulk Add" box: `Name, PIN, Class`, one student per line. Nothing is sent anywhere; the teacher
 * reads the lines and presses Import themselves.
 */

export const MAX_ROSTER_ROWS = 500;

/** Splits one CSV text into rows of cells. Handles "quoted, cells", doubled quotes and ; or tab separators. */
function splitRows(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] || '';
  const sep = firstLine.includes('\t') ? '\t' : firstLine.includes(',') ? ',' : firstLine.includes(';') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

const HEADER_WORDS = /^(first\s*name|firstname|name|student|student\s*name|students)$/i;

export interface RosterCsvResult {
  /** Lines in the Bulk Add format. */
  lines: string[];
  /** A header row (Name, PIN, Class ...) was found and skipped. */
  skippedHeader: boolean;
  /** More rows than the limit were in the file; the rest were left out. */
  truncated: boolean;
}

export function parseRosterCsv(text: string): RosterCsvResult {
  const rows = splitRows(text)
    .map((r) => r.map((c) => c.replace(/[\s ]+/g, ' ').trim()))
    .filter((r) => r.some((c) => c !== ''));
  let skippedHeader = false;
  if (rows.length > 0 && HEADER_WORDS.test(rows[0][0] || '')) {
    rows.shift();
    skippedHeader = true;
  }
  const lines: string[] = [];
  for (const r of rows) {
    if (!r[0]) continue;
    // The Bulk Add box splits on commas, so a comma inside a cell would break it.
    const cells = r.slice(0, 3).map((c) => c.replace(/[,\t]+/g, ' ').replace(/ {2,}/g, ' ').trim());
    while (cells.length > 1 && cells[cells.length - 1] === '') cells.pop();
    // Name and class but no PIN: keep the slot empty so the app picks a PIN, as it does for pasted lists.
    lines.push(cells.join(', '));
  }
  const truncated = lines.length > MAX_ROSTER_ROWS;
  return { lines: lines.slice(0, MAX_ROSTER_ROWS), skippedHeader, truncated };
}
