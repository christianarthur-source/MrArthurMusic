import { escapeHtml, printSheet } from '../../utils/printSheet';
import { ANIMAL_TEMPOS } from './MetronomeTool';
import { SOLFEGE_SCALE } from './SolfegeTrainer';
import type { ToolId } from './ClassroomToolBoxModal';

/** Tools that have a print-out. The button in the Tool Box only shows for these. */
export interface ToolPrintable {
  label: string;
  print: () => boolean;
}

function tempoChart(): boolean {
  const rows = ANIMAL_TEMPOS.map(
    (t) => `<tr><td class="big">${escapeHtml(t.emoji)}</td><td><strong>${escapeHtml(t.name)}</strong></td>
      <td><strong>${escapeHtml(t.term)}</strong><br><span style="color:#64748b">${escapeHtml(t.pronunciation)}</span></td>
      <td>${escapeHtml(t.meaning)}</td><td>${t.minBpm}&ndash;${t.maxBpm}</td></tr>`,
  ).join('');
  return printSheet(
    'Tempo chart: how fast is the music?',
    'BPM means beats per minute. Tempo words are Italian.',
    `<table><thead><tr><th></th><th>Animal</th><th>Tempo word</th><th>Feels like</th><th>BPM</th></tr></thead><tbody>${rows}</tbody></table>`,
  );
}

function solfegeChart(): boolean {
  const rows = SOLFEGE_SCALE.map(
    (n) => `<tr><td class="big"><span class="swatch" style="background:${escapeHtml(n.color)}"></span>${escapeHtml(n.syllable)}</td>
      <td class="big">${escapeHtml(n.step)}</td><td>${escapeHtml(n.handSignName)}</td><td>${escapeHtml(n.description)}</td></tr>`,
  ).join('');
  return printSheet(
    'Do-Re-Mi chart: solfege and hand signs',
    'The note names shown are for the C major scale (Do = C).',
    `<table><thead><tr><th>Syllable</th><th>Note</th><th>Hand sign</th><th>What it is</th></tr></thead><tbody>${rows}</tbody></table>`,
  );
}

export const TOOL_PRINTABLES: Partial<Record<ToolId, ToolPrintable>> = {
  metronome: { label: 'Print tempo chart', print: tempoChart },
  'tempo-tapper': { label: 'Print tempo chart', print: tempoChart },
  'solfege-trainer': { label: 'Print Do-Re-Mi chart', print: solfegeChart },
};
