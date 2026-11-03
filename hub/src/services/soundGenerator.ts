// Utility to generate authentic PCM WAV audio blobs for bundled accompaniment tracks
// This provides real, offline-available audio files for the Audio Studio playlist and test tracks

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + samples.length * 2, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count (1 mono)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * 2)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, samples.length * 2, true);

  floatTo16BitPCM(view, 44, samples);

  return new Blob([buffer], { type: 'audio/wav' });
}

// Generate Recorder Karate Backing Track (G, A, B tones + steady click)
export function generateRecorderAccompaniment(): string {
  const sampleRate = 22050;
  const durationSec = 24; // 24 seconds loop
  const totalSamples = sampleRate * durationSec;
  const samples = new Float32Array(totalSamples);
  const bpm = 80;
  const beatSec = 60 / bpm;

  // Pattern: C major / G major accompaniment chord arpeggios
  const chords = [
    [261.63, 329.63, 392.0], // C
    [293.66, 369.99, 440.0], // D
    [329.63, 392.0, 493.88], // Em
    [261.63, 329.63, 392.0]  // C
  ];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const beatIndex = Math.floor(t / beatSec);
    const chord = chords[Math.floor(beatIndex / 4) % chords.length];
    const noteFreq = chord[beatIndex % 3];

    // Soft marimba-like envelope
    const noteTime = t % (beatSec * 0.5);
    const env = Math.exp(-noteTime * 6);

    // Fundamental + gentle harmonics
    const tone =
      0.35 * Math.sin(2 * Math.PI * noteFreq * t) +
      0.15 * Math.sin(4 * Math.PI * noteFreq * t) +
      0.08 * Math.sin(6 * Math.PI * noteFreq * t);

    // Soft wood percussion click on every beat
    const beatTime = t % beatSec;
    const clickEnv = Math.exp(-beatTime * 35);
    const click = beatTime < 0.05 ? 0.25 * Math.sin(2 * Math.PI * 900 * t) * clickEnv : 0;

    samples[i] = tone * env + click;
  }

  const blob = encodeWAV(samples, sampleRate);
  return URL.createObjectURL(blob);
}

// Generate Orff Pentatonic Groove (C, D, E, G, A xylophone melody + djembe pulse)
export function generateOrffGroove(): string {
  const sampleRate = 22050;
  const durationSec = 20;
  const totalSamples = sampleRate * durationSec;
  const samples = new Float32Array(totalSamples);
  const bpm = 104;
  const stepSec = 60 / bpm / 2; // eighth notes

  const pentatonic = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
  const melodySteps = [0, 2, 3, 2, 4, 3, 2, 0, 1, 2, 4, 5, 4, 3, 2, 0];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const stepIdx = Math.floor(t / stepSec) % melodySteps.length;
    const freq = pentatonic[melodySteps[stepIdx]];

    // Xylophone chime envelope
    const stepTime = t % stepSec;
    const xyloEnv = Math.exp(-stepTime * 10);
    const xylo = (0.4 * Math.sin(2 * Math.PI * freq * t) + 0.15 * Math.sin(2 * Math.PI * freq * 2.756 * t)) * xyloEnv;

    // Djembe bass on steps 0 and 8, slap on 4 and 12
    let drum = 0;
    if (stepIdx % 8 === 0) {
      const drumTime = t % (stepSec * 4);
      if (drumTime < 0.2) {
        const bassEnv = Math.exp(-drumTime * 14);
        drum = 0.3 * Math.sin(2 * Math.PI * (70 - drumTime * 120) * t) * bassEnv;
      }
    } else if (stepIdx % 4 === 2) {
      const slapTime = t % (stepSec * 2);
      if (slapTime < 0.08) {
        drum = (Math.random() * 2 - 1) * 0.18 * Math.exp(-slapTime * 30);
      }
    }

    samples[i] = xylo + drum;
  }

  const blob = encodeWAV(samples, sampleRate);
  return URL.createObjectURL(blob);
}

// Generate Steady Beat March (Drum cadence + brass fanfare)
export function generateSteadyBeatMarch(): string {
  const sampleRate = 22050;
  const durationSec = 18;
  const totalSamples = sampleRate * durationSec;
  const samples = new Float32Array(totalSamples);
  const bpm = 116;
  const beatSec = 60 / bpm;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const beatTime = t % beatSec;

    // Bass drum on 1 and 3
    const beatNum = Math.floor(t / beatSec) % 4;
    let drum = 0;
    if (beatNum === 0 || beatNum === 2) {
      if (beatTime < 0.2) {
        const kickEnv = Math.exp(-beatTime * 16);
        drum += 0.35 * Math.sin(2 * Math.PI * (100 - beatTime * 250) * t) * kickEnv;
      }
    }

    // Snare tap on 2 and 4
    if (beatNum === 1 || beatNum === 3) {
      if (beatTime < 0.15) {
        const snareEnv = Math.exp(-beatTime * 20);
        drum += (Math.random() * 2 - 1) * 0.22 * snareEnv;
      }
    }

    // Bugle call fanfare (Do-Sol-Do-Mi-Sol)
    const fanfareNotes = [261.63, 329.63, 392.0, 523.25];
    const fanfareIdx = Math.floor(t / (beatSec * 2)) % fanfareNotes.length;
    const freq = fanfareNotes[fanfareIdx];
    const fanfareEnv = Math.exp(-(t % (beatSec * 2)) * 2);
    const horn = 0.2 * Math.sin(2 * Math.PI * freq * t) * fanfareEnv;

    samples[i] = drum + horn;
  }

  const blob = encodeWAV(samples, sampleRate);
  return URL.createObjectURL(blob);
}
