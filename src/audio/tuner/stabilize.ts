// Main-thread smoothing for tuner readings: adaptive noise gate, median-of-5, One-Euro filter,
// note hysteresis and a short hold. Pure (no DOM), erasable-syntax TypeScript.

export interface RawReading {
  /** Detected frequency, or null when the detector found no pitch. */
  hz: number | null;
  clarity: number;
  rms: number;
}

export interface StableOutput {
  /** True while a pitch is being shown (including the dimmed hold period). */
  active: boolean;
  /** True during the dimmed hold after the sound stopped. */
  held: boolean;
  /** Filtered fractional MIDI note (concert pitch). */
  midi: number;
  /** Displayed (hysteresis-protected) integer MIDI note. */
  noteMidi: number;
  hz: number;
  clarity: number;
  /** Latest input level (rms). */
  rms: number;
}

export interface StabilizerConfig {
  a4: number;
  clarityMin: number;
  holdMs: number;
  /** Readings in a row that must agree before the displayed note changes. */
  agree: number;
  /** Cents from the displayed note needed before a neighbour can take over. */
  flipCents: number;
}

export const DEFAULT_STABILIZER: StabilizerConfig = {
  a4: 440,
  clarityMin: 0.9,
  holdMs: 400,
  agree: 3,
  flipCents: 60,
};

/** One-Euro filter (Casiez et al.): heavy smoothing when steady, light when moving. */
class OneEuro {
  private x = 0;
  private dx = 0;
  private t = 0;
  private has = false;
  private minCutoff = 1.2;
  private beta = 0.05;
  private dCutoff = 1;
  reset() { this.has = false; }
  private alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  filter(v: number, tSec: number): number {
    if (!this.has) {
      this.has = true;
      this.x = v; this.dx = 0; this.t = tSec;
      return v;
    }
    const dt = Math.max(1e-3, Math.min(0.2, tSec - this.t));
    this.t = tSec;
    const dRaw = (v - this.x) / dt;
    this.dx += this.alpha(this.dCutoff, dt) * (dRaw - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += this.alpha(cutoff, dt) * (v - this.x);
    return this.x;
  }
}

function median(values: number[]): number {
  const s = values.slice().sort((a, b) => a - b);
  return s[s.length >> 1];
}

export class Stabilizer {
  cfg: StabilizerConfig;
  private floor = 0.003;
  private recent: number[] = [];
  private euro = new OneEuro();
  private noteMidi: number | null = null;
  private candidate: number | null = null;
  private candidateCount = 0;
  private last: StableOutput | null = null;
  private lastGoodMs = -Infinity;

  constructor(cfg: Partial<StabilizerConfig> = {}) {
    this.cfg = { ...DEFAULT_STABILIZER, ...cfg };
  }

  setConfig(cfg: Partial<StabilizerConfig>) {
    this.cfg = { ...this.cfg, ...cfg };
  }

  reset() {
    this.recent = [];
    this.euro.reset();
    this.noteMidi = null;
    this.candidate = null;
    this.candidateCount = 0;
    this.last = null;
    this.lastGoodMs = -Infinity;
  }

  /** Adaptive noise floor: falls to the quietest level fast, rises very slowly. */
  private trackFloor(rms: number) {
    if (rms < this.floor) this.floor = Math.max(0.0005, this.floor * 0.9 + rms * 0.1);
    else this.floor = Math.min(0.02, this.floor * 1.0002);
  }

  /** Feed one detector reading at time `tMs`; returns what to display (null = nothing). */
  push(r: RawReading, tMs: number): StableOutput | null {
    this.trackFloor(r.rms);
    const gate = Math.max(0.003, this.floor * 3);
    const good = r.hz !== null && r.hz > 0 && r.clarity >= this.cfg.clarityMin && r.rms >= gate;

    if (!good) {
      if (this.last && tMs - this.lastGoodMs <= this.cfg.holdMs) {
        this.last = { ...this.last, held: true, rms: r.rms };
        return this.last;
      }
      this.recent = [];
      this.candidate = null;
      this.candidateCount = 0;
      this.noteMidi = null;
      this.euro.reset();
      this.last = null;
      return null;
    }

    this.lastGoodMs = tMs;
    const midiRaw = 69 + 12 * Math.log2((r.hz as number) / this.cfg.a4);
    this.recent.push(midiRaw);
    if (this.recent.length > 5) this.recent.shift();
    const med = median(this.recent);
    const filtered = this.euro.filter(med * 100, tMs / 1000) / 100;

    // Note hysteresis.
    if (this.noteMidi === null) {
      const nearest = Math.round(med);
      if (this.candidate === nearest) this.candidateCount++;
      else { this.candidate = nearest; this.candidateCount = 1; }
      if (this.candidateCount >= this.cfg.agree) {
        this.noteMidi = nearest;
        this.candidate = null;
        this.candidateCount = 0;
      }
    } else if (Math.abs(med - this.noteMidi) * 100 > this.cfg.flipCents) {
      const nearest = Math.round(med);
      if (this.candidate === nearest) this.candidateCount++;
      else { this.candidate = nearest; this.candidateCount = 1; }
      if (this.candidateCount >= this.cfg.agree) {
        this.noteMidi = nearest;
        this.candidate = null;
        this.candidateCount = 0;
      }
    } else {
      this.candidate = null;
      this.candidateCount = 0;
    }

    if (this.noteMidi === null) {
      // Not enough agreeing readings yet: nothing to show, but keep any previous output out.
      return this.last && tMs - this.lastGoodMs <= this.cfg.holdMs && this.last.active ? this.last : null;
    }
    this.last = {
      active: true,
      held: false,
      midi: filtered,
      noteMidi: this.noteMidi,
      hz: this.cfg.a4 * Math.pow(2, (filtered - 69) / 12),
      clarity: r.clarity,
      rms: r.rms,
    };
    return this.last;
  }
}
