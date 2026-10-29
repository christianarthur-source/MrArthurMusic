import { EffectType } from './types';

/** Pure data describing effects; shared by the UI, validation, automation and the audio engine. */

export interface ParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  default: number;
  step?: number;
  unit?: string;
  scale?: 'linear' | 'log';
  automatable?: boolean;
  help?: string;
}

export interface EffectDef {
  type: EffectType;
  name: string;
  help: string; // student-friendly description
  params: ParamDef[];
}

export const EFFECT_DEFS: Record<EffectType, EffectDef> = {
  eq3: {
    type: 'eq3',
    name: 'EQ',
    help: 'Turn the bass (low), middle and treble (high) frequencies up or down.',
    params: [
      { key: 'low', label: 'Low', min: -18, max: 18, default: 0, step: 0.5, unit: 'dB', automatable: true },
      { key: 'mid', label: 'Mid', min: -18, max: 18, default: 0, step: 0.5, unit: 'dB', automatable: true },
      { key: 'high', label: 'High', min: -18, max: 18, default: 0, step: 0.5, unit: 'dB', automatable: true },
      { key: 'lowFreq', label: 'Low freq', min: 60, max: 600, default: 250, unit: 'Hz', scale: 'log' },
      { key: 'midFreq', label: 'Mid freq', min: 300, max: 5000, default: 1000, unit: 'Hz', scale: 'log' },
      { key: 'highFreq', label: 'High freq', min: 2000, max: 12000, default: 4000, unit: 'Hz', scale: 'log' },
    ],
  },
  compressor: {
    type: 'compressor',
    name: 'Compressor',
    help: 'Evens out loud and quiet moments so the sound is punchier and more steady.',
    params: [
      { key: 'threshold', label: 'Threshold', min: -60, max: 0, default: -18, unit: 'dB' },
      { key: 'ratio', label: 'Ratio', min: 1, max: 20, default: 4, step: 0.1, unit: ':1' },
      { key: 'attack', label: 'Attack', min: 0.001, max: 0.3, default: 0.01, unit: 's', scale: 'log' },
      { key: 'release', label: 'Release', min: 0.02, max: 1, default: 0.2, unit: 's', scale: 'log' },
      { key: 'makeup', label: 'Makeup', min: 0, max: 18, default: 3, step: 0.5, unit: 'dB' },
    ],
  },
  reverb: {
    type: 'reverb',
    name: 'Reverb',
    help: 'Adds the sound of a room or hall around your track.',
    params: [
      { key: 'mix', label: 'Mix', min: 0, max: 1, default: 0.25, step: 0.01, automatable: true },
      { key: 'decay', label: 'Size', min: 0.3, max: 6, default: 2, step: 0.1, unit: 's' },
      { key: 'tone', label: 'Tone', min: 1000, max: 16000, default: 7000, unit: 'Hz', scale: 'log' },
      { key: 'predelay', label: 'Pre-delay', min: 0, max: 0.1, default: 0.01, unit: 's' },
    ],
  },
  delay: {
    type: 'delay',
    name: 'Echo',
    help: 'Repeats the sound like an echo in the mountains.',
    params: [
      { key: 'mix', label: 'Mix', min: 0, max: 1, default: 0.25, step: 0.01, automatable: true },
      { key: 'time', label: 'Time', min: 0.02, max: 1.5, default: 0.375, unit: 's' },
      { key: 'feedback', label: 'Repeats', min: 0, max: 0.85, default: 0.35, step: 0.01 },
      { key: 'tone', label: 'Tone', min: 500, max: 16000, default: 5000, unit: 'Hz', scale: 'log' },
    ],
  },
  chorus: {
    type: 'chorus',
    name: 'Chorus',
    help: 'Makes one instrument sound like several playing together.',
    params: [
      { key: 'mix', label: 'Mix', min: 0, max: 1, default: 0.5, step: 0.01 },
      { key: 'rate', label: 'Speed', min: 0.05, max: 5, default: 0.8, unit: 'Hz', scale: 'log' },
      { key: 'depth', label: 'Depth', min: 0, max: 1, default: 0.5, step: 0.01 },
    ],
  },
  phaser: {
    type: 'phaser',
    name: 'Phaser',
    help: 'A swirling, whooshing sound effect.',
    params: [
      { key: 'mix', label: 'Mix', min: 0, max: 1, default: 0.5, step: 0.01 },
      { key: 'rate', label: 'Speed', min: 0.05, max: 5, default: 0.5, unit: 'Hz', scale: 'log' },
      { key: 'depth', label: 'Depth', min: 0, max: 1, default: 0.7, step: 0.01 },
      { key: 'feedback', label: 'Resonance', min: 0, max: 0.8, default: 0.4, step: 0.01 },
    ],
  },
  distortion: {
    type: 'distortion',
    name: 'Distortion',
    help: 'Adds grit and crunch, like a guitar amp turned up loud.',
    params: [
      { key: 'drive', label: 'Drive', min: 0, max: 1, default: 0.4, step: 0.01, automatable: true },
      { key: 'tone', label: 'Tone', min: 500, max: 12000, default: 4000, unit: 'Hz', scale: 'log' },
      { key: 'mix', label: 'Mix', min: 0, max: 1, default: 1, step: 0.01 },
      { key: 'output', label: 'Output', min: -24, max: 6, default: -6, step: 0.5, unit: 'dB' },
    ],
  },
  filter: {
    type: 'filter',
    name: 'Filter',
    help: 'Removes high or low sounds. Sweep the cutoff for a classic DJ effect.',
    params: [
      { key: 'mode', label: 'Mode (0 LP / 1 HP / 2 BP)', min: 0, max: 2, default: 0, step: 1 },
      { key: 'cutoff', label: 'Cutoff', min: 40, max: 18000, default: 18000, unit: 'Hz', scale: 'log', automatable: true },
      { key: 'resonance', label: 'Resonance', min: 0.1, max: 15, default: 0.7, step: 0.1 },
    ],
  },
  limiter: {
    type: 'limiter',
    name: 'Limiter',
    help: 'Stops the sound from getting too loud and distorting. Keep it on the master track.',
    params: [
      { key: 'ceiling', label: 'Ceiling', min: -12, max: 0, default: -1, step: 0.1, unit: 'dB' },
      { key: 'gain', label: 'Input gain', min: 0, max: 12, default: 0, step: 0.5, unit: 'dB' },
    ],
  },
};

export const EFFECT_ORDER: EffectType[] = [
  'eq3',
  'compressor',
  'filter',
  'distortion',
  'chorus',
  'phaser',
  'delay',
  'reverb',
  'limiter',
];

export interface ChainPreset {
  id: string;
  name: string;
  emoji: string;
  effects: { type: EffectType; params?: Record<string, number> }[];
}

export const CHAIN_PRESETS: ChainPreset[] = [
  {
    id: 'clean-vocal',
    name: 'Clean Vocal',
    emoji: '🎤',
    effects: [
      { type: 'eq3', params: { low: -4, mid: 1, high: 3 } },
      { type: 'compressor', params: { threshold: -20, ratio: 3, attack: 0.008, release: 0.15, makeup: 4 } },
      { type: 'reverb', params: { mix: 0.15, decay: 1.4 } },
    ],
  },
  {
    id: 'big-drums',
    name: 'Big Drums',
    emoji: '🥁',
    effects: [
      { type: 'eq3', params: { low: 4, mid: -2, high: 3 } },
      { type: 'compressor', params: { threshold: -22, ratio: 5, attack: 0.02, release: 0.12, makeup: 5 } },
      { type: 'reverb', params: { mix: 0.18, decay: 1.2, tone: 6000 } },
    ],
  },
  {
    id: 'warm-bass',
    name: 'Warm Bass',
    emoji: '🎸',
    effects: [
      { type: 'eq3', params: { low: 3, mid: 0, high: -5 } },
      { type: 'distortion', params: { drive: 0.15, tone: 2500, mix: 0.4, output: -3 } },
      { type: 'compressor', params: { threshold: -20, ratio: 4, makeup: 3 } },
    ],
  },
  {
    id: 'dreamy-keys',
    name: 'Dreamy Keys',
    emoji: '✨',
    effects: [
      { type: 'chorus', params: { mix: 0.45, rate: 0.6, depth: 0.6 } },
      { type: 'delay', params: { mix: 0.2, time: 0.5, feedback: 0.4, tone: 3500 } },
      { type: 'reverb', params: { mix: 0.4, decay: 3.5 } },
    ],
  },
  {
    id: 'space-guitar',
    name: 'Space Guitar',
    emoji: '🚀',
    effects: [
      { type: 'phaser', params: { mix: 0.4, rate: 0.3, depth: 0.7 } },
      { type: 'delay', params: { mix: 0.3, time: 0.45, feedback: 0.55 } },
      { type: 'reverb', params: { mix: 0.45, decay: 4.5 } },
    ],
  },
  {
    id: 'lo-fi',
    name: 'Lo-Fi',
    emoji: '📼',
    effects: [
      { type: 'filter', params: { mode: 0, cutoff: 3500, resonance: 0.8 } },
      { type: 'distortion', params: { drive: 0.2, tone: 3000, mix: 0.5, output: -4 } },
      { type: 'chorus', params: { mix: 0.25, rate: 0.3, depth: 0.3 } },
    ],
  },
  {
    id: 'large-hall',
    name: 'Large Hall',
    emoji: '🏛️',
    effects: [{ type: 'reverb', params: { mix: 0.45, decay: 5, tone: 6000, predelay: 0.03 } }],
  },
  {
    id: 'radio-voice',
    name: 'Radio Voice',
    emoji: '📻',
    effects: [
      { type: 'filter', params: { mode: 2, cutoff: 1800, resonance: 1.2 } },
      { type: 'distortion', params: { drive: 0.25, mix: 0.6, output: -2 } },
      { type: 'compressor', params: { threshold: -25, ratio: 6, makeup: 6 } },
    ],
  },
];
