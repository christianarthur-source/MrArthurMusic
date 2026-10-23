import { InstrumentId, Score } from '../types/music';
import { expandPlaybackMeasures, getItemDuration, getMidiNoteNumber } from './musicMath';

const GM_PROGRAM_MAP: Record<InstrumentId, number> = {
  // Keyboards
  piano_treble: 0,
  piano_bass: 0,
  electric_piano: 4,
  harpsichord: 6,
  clavinet: 7,
  celesta: 8,
  music_box: 10,
  organ: 19,
  jazz_organ: 16,
  // Woodwinds
  flute: 73,
  piccolo: 72,
  recorder: 74,
  pan_flute: 75,
  oboe: 68,
  english_horn: 69,
  clarinet: 71,
  bass_clarinet: 71,
  bassoon: 70,
  contrabassoon: 70,
  soprano_sax: 64,
  alto_sax: 65,
  tenor_sax: 66,
  baritone_sax: 67,
  // Brass
  trumpet: 56,
  cornet: 56,
  flugelhorn: 56,
  muted_trumpet: 59,
  french_horn: 60,
  trombone: 57,
  bass_trombone: 57,
  euphonium: 58,
  tuba: 58,
  brass_section: 61,
  // Strings
  violin: 40,
  viola: 41,
  cello: 42,
  double_bass: 43,
  string_ensemble: 48,
  pizzicato_strings: 45,
  tremolo_strings: 44,
  harp: 46,
  // Popular & World
  acoustic_guitar: 24,
  steel_guitar: 25,
  electric_guitar: 27,
  overdrive_guitar: 29,
  ukulele: 24,
  banjo: 105,
  sitar: 104,
  koto: 107,
  kalimba: 108,
  bagpipes: 109,
  harmonica: 22,
  accordion: 21,
  electric_bass: 33,
  slap_bass: 36,
  synth_bass: 38,
  synth_lead: 81,
  synth_pad: 89,
  choir_aahs: 52,
  voice_oohs: 53,
  // Percussion
  glockenspiel: 9,
  xylophone: 13,
  marimba: 12,
  vibraphone: 11,
  steel_drums: 114,
  timpani: 47,
  taiko_drum: 116,
  tubular_bells: 14,
  triangle: 112,
  tambourine: 115,
  woodblock: 115,
  cowbell: 115,
  congas: 117,
  djembe: 116,
  drum_kit: 0,
  drum_808: 0,
  drum_jazz: 0,
  drum_latin: 0,
  // Sound Effects
  sfx_applause: 126,
  sfx_laser: 127,
  sfx_retro_8bit: 80,
  sfx_bird_tweet: 123,
  sfx_ocean_waves: 122,
  sfx_thunder: 127,
  sfx_wind_howl: 122,
  sfx_helicopter: 125,
  sfx_siren: 125,
  sfx_train_whistle: 122,
  sfx_vinyl_scratch: 120,
  sfx_cartoon_boing: 119,
};

function encodeVarLen(value: number): number[] {
  let v = Math.max(0, Math.round(value));
  const bytes = [v & 0x7f];
  while ((v >>= 7) > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
  }
  return bytes;
}

function writeUint32BE(val: number): number[] {
  return [(val >>> 24) & 0xff, (val >>> 16) & 0xff, (val >>> 8) & 0xff, val & 0xff];
}

function writeUint16BE(val: number): number[] {
  return [(val >>> 8) & 0xff, val & 0xff];
}

/**
 * Exports the score as a Standard MIDI File (.mid) Format 1.
 */
export function exportScoreToMidi(score: Score): void {
  const ticksPerQuarter = 480;
  const ticksPerWhole = ticksPerQuarter * 4;
  const [beatsPerMeasure, beatValue] = score.timeSignature;
  const measureTicks = Math.round((beatsPerMeasure / beatValue) * ticksPerWhole);

  const maxMeasures = Math.max(...score.tracks.map((t) => t.measures.length), 1);
  const playbackSequence = expandPlaybackMeasures(maxMeasures, score.tracks[0]?.measures || []);

  const trackChunks: Uint8Array[] = [];

  // Track 0: Conductor / Tempo & Time Signature Meta Track
  const conductorEvents: number[] = [];
  const microsecondsPerQuarter = Math.round(60000000 / Math.max(20, score.tempo));
  // Tempo meta event (FF 51 03 tt tt tt)
  conductorEvents.push(
    0x00,
    0xff,
    0x51,
    0x03,
    (microsecondsPerQuarter >>> 16) & 0xff,
    (microsecondsPerQuarter >>> 8) & 0xff,
    microsecondsPerQuarter & 0xff
  );
  // Time signature meta event (FF 58 04 nn dd cc bb)
  const dd = Math.round(Math.log2(beatValue));
  conductorEvents.push(0x00, 0xff, 0x58, 0x04, beatsPerMeasure, dd, 24, 8);
  // End of track (FF 2F 00)
  conductorEvents.push(0x00, 0xff, 0x2f, 0x00);

  trackChunks.push(
    new Uint8Array([
      0x4d,
      0x54,
      0x72,
      0x6b,
      ...writeUint32BE(conductorEvents.length),
      ...conductorEvents,
    ])
  );

  // Instrument Tracks
  score.tracks.forEach((track, tIdx) => {
    if (track.muted) return;
    const isDrum =
      track.instrumentId === 'drum_kit' ||
      track.instrumentId === 'drum_808' ||
      track.instrumentId === 'drum_jazz' ||
      track.instrumentId === 'drum_latin';
    const channel = isDrum ? 9 : tIdx % 9; // Channel 10 (index 9) reserved for drums
    const program = GM_PROGRAM_MAP[track.instrumentId] ?? 0;

    interface MidiEvt {
      tick: number;
      bytes: number[];
    }
    const events: MidiEvt[] = [];

    if (!isDrum) {
      events.push({ tick: 0, bytes: [0xc0 | channel, program] });
    }

    const flatItems: {
      item: Score['tracks'][0]['measures'][0]['items'][0];
      startTick: number;
      durationTicks: number;
    }[] = [];

    playbackSequence.forEach((mIdx, stepIdx) => {
      const measure = track.measures[mIdx];
      if (!measure) return;
      const measureStartTick = stepIdx * measureTicks;
      let offsetTick = 0;
      measure.items.forEach((item) => {
        const durTicks = Math.round(getItemDuration(item) * ticksPerWhole);
        flatItems.push({
          item,
          startTick: measureStartTick + offsetTick,
          durationTicks: durTicks,
        });
        offsetTick += durTicks;
      });
    });

    const tiedIndices = new Set<number>();

    flatItems.forEach((entry, idx) => {
      if (entry.item.type !== 'note' || tiedIndices.has(idx)) return;

      let totalDurTicks = entry.durationTicks;
      let look = idx;
      while (flatItems[look]?.item.isTied && look + 1 < flatItems.length) {
        const nextEntry = flatItems[look + 1];
        if (nextEntry.item.type === 'note') {
          totalDurTicks += nextEntry.durationTicks;
          tiedIndices.add(look + 1);
          look++;
        } else {
          break;
        }
      }

      const gateTicks = Math.max(
        20,
        Math.round(totalDurTicks * (entry.item.articulation === 'staccato' ? 0.45 : 0.92))
      );
      const velocity = Math.min(127, Math.max(30, Math.round(track.volume * 105)));

      const pitches =
        entry.item.pitches && entry.item.pitches.length > 0
          ? entry.item.pitches
          : entry.item.pitch
          ? [entry.item.pitch]
          : [];

      pitches.forEach((p) => {
        const midiNote = isDrum ? 38 : getMidiNoteNumber(p, score.keySignature);
        events.push({
          tick: entry.startTick,
          bytes: [0x90 | channel, midiNote, velocity],
        });
        events.push({
          tick: entry.startTick + gateTicks,
          bytes: [0x80 | channel, midiNote, 0],
        });
      });
    });

    events.sort((a, b) => a.tick - b.tick);

    const trackBytes: number[] = [];
    let lastTick = 0;
    for (const ev of events) {
      const delta = Math.max(0, ev.tick - lastTick);
      trackBytes.push(...encodeVarLen(delta), ...ev.bytes);
      lastTick = ev.tick;
    }
    trackBytes.push(0x00, 0xff, 0x2f, 0x00);

    trackChunks.push(
      new Uint8Array([
        0x4d,
        0x54,
        0x72,
        0x6b,
        ...writeUint32BE(trackBytes.length),
        ...trackBytes,
      ])
    );
  });

  const header = new Uint8Array([
    0x4d,
    0x54,
    0x68,
    0x64,
    ...writeUint32BE(6),
    ...writeUint16BE(1),
    ...writeUint16BE(trackChunks.length),
    ...writeUint16BE(ticksPerQuarter),
  ]);

  const totalLen = header.length + trackChunks.reduce((s, c) => s + c.length, 0);
  const midiBytes = new Uint8Array(totalLen);
  midiBytes.set(header, 0);
  let offset = header.length;
  for (const chunk of trackChunks) {
    midiBytes.set(chunk, offset);
    offset += chunk.length;
  }

  const blob = new Blob([midiBytes as unknown as BlobPart], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const safeTitle = (score.title || 'Untitled_Composition').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeTitle}.mid`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Exports the score as a standard MusicXML (.musicxml) file compatible with Flat.io, Noteflight, MuseScore, and Finale.
 */
export function exportScoreToMusicXml(score: Score): void {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const keyFifthsMap: Record<Score['keySignature'], number> = {
    C: 0,
    G: 1,
    D: 2,
    A: 3,
    E: 4,
    B: 5,
    'F#': 6,
    'C#': 7,
    F: -1,
    Bb: -2,
    Eb: -3,
    Ab: -4,
    Db: -5,
    Gb: -6,
    Cb: -7,
  };
  const fifths = keyFifthsMap[score.keySignature] ?? 0;
  const [beats, beatType] = score.timeSignature;
  const divisions = 12; // 12 divisions per quarter note (supports 16ths and triplets cleanly)

  const durationTypeMap: Record<number, string> = {
    1: 'whole',
    0.5: 'half',
    0.25: 'quarter',
    0.125: 'eighth',
    0.0625: '16th',
  };

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n`;
  xml += `<score-partwise version="4.0">\n`;
  xml += `  <work><work-title>${esc(score.title || 'Untitled Composition')}</work-title></work>\n`;
  xml += `  <identification><creator type="composer">${esc(score.composer || 'Student')}</creator></identification>\n`;
  xml += `  <part-list>\n`;
  score.tracks.forEach((t, i) => {
    xml += `    <score-part id="P${i + 1}"><part-name>${esc(t.name)}</part-name></score-part>\n`;
  });
  xml += `  </part-list>\n`;

  score.tracks.forEach((track, tIdx) => {
    xml += `  <part id="P${tIdx + 1}">\n`;
    track.measures.forEach((measure, mIdx) => {
      xml += `    <measure number="${mIdx + 1}">\n`;
      if (measure.repeatStart) {
        xml += `      <barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>\n`;
      }
      if (measure.ending) {
        xml += `      <barline location="left"><ending number="${measure.ending}" type="start">${measure.ending}.</ending></barline>\n`;
      }
      if (mIdx === 0) {
        const clefSign = track.clef === 'bass' ? 'F' : 'G';
        const clefLine = track.clef === 'bass' ? 4 : 2;
        xml += `      <attributes>\n`;
        xml += `        <divisions>${divisions}</divisions>\n`;
        xml += `        <key><fifths>${fifths}</fifths></key>\n`;
        xml += `        <time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>\n`;
        xml += `        <clef><sign>${clefSign}</sign><line>${clefLine}</line></clef>\n`;
        xml += `      </attributes>\n`;
        xml += `      <direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${score.tempo}</per-minute></metronome></direction-type><sound tempo="${score.tempo}"/></direction>\n`;
      }

      measure.items.forEach((item) => {
        const durDivs = Math.max(1, Math.round(getItemDuration(item) * 4 * divisions));
        const noteType = durationTypeMap[item.duration] || 'quarter';

        if (item.type === 'rest') {
          xml += `      <note>\n`;
          xml += `        <rest/>\n`;
          xml += `        <duration>${durDivs}</duration>\n`;
          xml += `        <type>${noteType}</type>\n`;
          if (item.isDotted) xml += `        <dot/>\n`;
          xml += `      </note>\n`;
        } else {
          const pitches =
            item.pitches && item.pitches.length > 0
              ? item.pitches
              : item.pitch
              ? [item.pitch]
              : [];

          pitches.forEach((p, pIdx) => {
            const alter = p.accidental === 'sharp' ? 1 : p.accidental === 'flat' ? -1 : 0;
            xml += `      <note>\n`;
            if (pIdx > 0) xml += `        <chord/>\n`;
            xml += `        <pitch>\n`;
            xml += `          <step>${p.step}</step>\n`;
            if (alter !== 0) xml += `          <alter>${alter}</alter>\n`;
            xml += `          <octave>${p.octave}</octave>\n`;
            xml += `        </pitch>\n`;
            xml += `        <duration>${durDivs}</duration>\n`;
            xml += `        <type>${noteType}</type>\n`;
            if (item.isDotted) xml += `        <dot/>\n`;
            if (pIdx === 0 && item.lyric) {
              xml += `        <lyric number="1"><text>${esc(item.lyric)}</text></lyric>\n`;
            }
            xml += `      </note>\n`;
          });
        }
      });

      if (measure.ending) {
        xml += `      <barline location="right"><ending number="${measure.ending}" type="${measure.ending === 1 ? 'stop' : 'discontinue'}"/></barline>\n`;
      }
      if (measure.repeatEnd) {
        xml += `      <barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>\n`;
      }
      xml += `    </measure>\n`;
    });
    xml += `  </part>\n`;
  });

  xml += `</score-partwise>\n`;

  const blob = new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const safeTitle = (score.title || 'Untitled_Composition').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeTitle}.musicxml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
