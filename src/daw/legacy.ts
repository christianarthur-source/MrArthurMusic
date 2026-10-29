import {
  createProject,
  createTrack,
  createMidiRegion,
  newId,
} from './model/factory';
import { Project, MidiNote, PPQ, TrackKind } from './model/types';

/**
 * Decompress a compact DAW Project payload back into an old DawProject structure.
 * Logic recovered from the legacy projectSharing.ts.
 */
export function decompressLegacyDawProject(compact: any): any {
  if (!compact || typeof compact !== 'object') return {};

  const tracks = Array.isArray(compact.tr)
    ? compact.tr.map((t: any) => {
        const clips = Array.isArray(t.cl)
          ? t.cl.map((c: any) => {
              const midiNotes = Array.isArray(c.mn)
                ? c.mn.map((n: any) => ({
                    id: String(n[0] || Math.random().toString(36).slice(2, 7)),
                    midi: Number(n[1] || 60),
                    startBeat: Number(n[2] || 0),
                    durationBeats: Number(n[3] || 1),
                    velocity: Number(n[4] || 0.8),
                  }))
                : [];

              return {
                id: String(c.i || Math.random().toString(36).slice(2, 8)),
                trackId: String(t.i),
                name: String(c.n || 'Clip'),
                type: c.y === 'midi' ? 'midi' : 'audio',
                startBeat: Number(c.sb || 0),
                durationBeats: Number(c.db || 8),
                color: String(c.c || t.c || '#F59E0B'),
                loopId: c.lid,
                audioUrl: c.url,
                originalBpm: c.ob ? Number(c.ob) : undefined,
                gain: c.g !== undefined ? Number(c.g) : 1,
                trimStartBeat: c.tsb !== undefined ? Number(c.tsb) : 0,
                isLooping: Boolean(c.lp),
                midiNotes: midiNotes.length > 0 ? midiNotes : undefined,
              };
            })
          : [];

        return {
          id: String(t.i || Math.random().toString(36).slice(2, 8)),
          name: String(t.n || 'Track'),
          type: t.y || 'audio',
          color: String(t.c || '#F59E0B'),
          icon: String(t.ic || '🎵'),
          muted: Boolean(t.m),
          solo: Boolean(t.s),
          armRecord: false,
          instrumentId: t.in,
          clips,
          fx: t.fx || {},
        };
      })
    : [];

  return {
    title: compact.t || 'Shared Studio Song',
    bpm: Number(compact.b || 120),
    timeSignature: compact.ts || [4, 4],
    masterVolume: compact.mv !== undefined ? Number(compact.mv) : 1.0,
    snapGrid: compact.sg || '1/4',
    loopRegion: Array.isArray(compact.lr)
      ? {
          enabled: Boolean(compact.lr[0]),
          startBeat: Number(compact.lr[1] || 0),
          endBeat: Number(compact.lr[2] || 16),
        }
      : { enabled: false, startBeat: 0, endBeat: 16 },
    tracks,
  };
}

/**
 * Checks whether raw data is an old full or compact DAW project and converts it to a v1 Project.
 * Returns new-format data when data is an old project, or returns data unchanged otherwise.
 */
export function convertLegacyProject(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;

  const raw = data as Record<string, any>;

  // If already v1 project with schemaVersion, leave unchanged
  if (typeof raw.schemaVersion === 'number') {
    return data;
  }

  let oldProj: Record<string, any> | null = null;

  // Check 1: Old compact format (has `tr` array)
  if (Array.isArray(raw.tr)) {
    oldProj = decompressLegacyDawProject(raw);
    if (raw.id) oldProj.id = raw.id;
  }
  // Check 2: Old full format: no schemaVersion, numeric bpm, and tracks array whose items have clips
  else if (
    typeof raw.bpm === 'number' &&
    Array.isArray(raw.tracks) &&
    raw.tracks.some((t: any) => t && Array.isArray(t.clips))
  ) {
    oldProj = raw;
  }

  if (!oldProj) {
    return data;
  }

  // Convert old project to new Project schema
  const title = typeof oldProj.title === 'string' ? oldProj.title : 'My Song';
  const bpm = typeof oldProj.bpm === 'number' && oldProj.bpm > 0 ? oldProj.bpm : 120;
  const project: Project = createProject(title, bpm);

  // Preserve old project id if present
  if (typeof oldProj.id === 'string' && oldProj.id) {
    project.id = oldProj.id;
  }

  // Master volume conversion
  if (typeof oldProj.masterVolume === 'number') {
    const vol = Math.max(0.0001, oldProj.masterVolume);
    const db = 20 * Math.log10(vol);
    project.master.volumeDb = Math.max(-60, Math.min(6, db));
  }

  // Loop region conversion
  if (oldProj.loopRegion && typeof oldProj.loopRegion === 'object') {
    const lr = oldProj.loopRegion;
    const startTicks = Math.round((Number(lr.startBeat) || 0) * PPQ);
    const endTicks = Math.round((Number(lr.endBeat) || 16) * PPQ);
    project.loop = {
      enabled: Boolean(lr.enabled),
      start: Math.max(0, startTicks),
      end: Math.max(startTicks + PPQ, endTicks),
    };
  }

  const skippedAudioClips: string[] = [];

  if (Array.isArray(oldProj.tracks)) {
    oldProj.tracks.forEach((oldTrack: any, trackIdx: number) => {
      if (!oldTrack || typeof oldTrack !== 'object') return;

      const clips: any[] = Array.isArray(oldTrack.clips) ? oldTrack.clips : [];
      const hasMidi = clips.some((c) => c && (c.type === 'midi' || Array.isArray(c.midiNotes)));
      const kind: TrackKind = hasMidi ? 'instrument' : 'audio';

      // Pick instrument
      let instrumentId = 'piano';
      if (typeof oldTrack.instrumentId === 'string' && oldTrack.instrumentId) {
        instrumentId = oldTrack.instrumentId;
      }

      const track = createTrack(
        kind,
        typeof oldTrack.name === 'string' ? oldTrack.name : `Track ${trackIdx + 1}`,
        trackIdx,
        instrumentId,
      );

      // Preserve track id if possible for internal references
      if (typeof oldTrack.id === 'string' && oldTrack.id) {
        track.id = oldTrack.id;
      }

      // Mute / Solo
      track.mute = Boolean(oldTrack.muted);
      track.solo = Boolean(oldTrack.solo);

      // Volume & Pan
      const fx = oldTrack.fx || {};
      const vol = typeof fx.volume === 'number' ? Math.max(0.0001, fx.volume) : 1.0;
      const volDb = 20 * Math.log10(vol);
      track.volumeDb = Math.max(-60, Math.min(6, volDb));

      const pan = typeof fx.pan === 'number' ? fx.pan : 0;
      track.pan = Math.max(-1, Math.min(1, pan));

      project.tracks.push(track);

      // Process clips
      for (const clip of clips) {
        if (!clip || typeof clip !== 'object') continue;

        if (clip.type === 'midi' || Array.isArray(clip.midiNotes)) {
          const startBeat = Number(clip.startBeat) || 0;
          const durBeats = Number(clip.durationBeats) || 4;
          const startTick = Math.max(0, Math.round(startBeat * PPQ));
          const lengthTicks = Math.max(PPQ / 4, Math.round(durBeats * PPQ));

          const rawNotes: any[] = Array.isArray(clip.midiNotes) ? clip.midiNotes : [];
          const notes: MidiNote[] = [];

          for (const n of rawNotes) {
            if (!n || typeof n !== 'object') continue;
            const noteStartTick = Math.max(0, Math.round((Number(n.startBeat) || 0) * PPQ));
            const noteLengthTick = Math.max(1, Math.round((Number(n.durationBeats) || 1) * PPQ));
            const pitch = Math.max(0, Math.min(127, Math.round(Number(n.midi) || 60)));
            // Old velocity 0..1 -> 1..127
            const rawVel = typeof n.velocity === 'number' ? n.velocity : 0.8;
            const velocity = Math.max(1, Math.min(127, Math.round(rawVel > 1 ? rawVel : rawVel * 127)));

            notes.push({
              id: typeof n.id === 'string' ? n.id : newId('note'),
              pitch,
              start: noteStartTick,
              length: noteLengthTick,
              velocity,
            });
          }

          const region = createMidiRegion({
            trackId: track.id,
            name: typeof clip.name === 'string' ? clip.name : 'MIDI',
            start: startTick,
            length: lengthTicks,
          });

          if (typeof clip.id === 'string' && clip.id) {
            region.id = clip.id;
          }
          region.notes = notes;
          region.loop = Boolean(clip.isLooping);
          region.loopLength = lengthTicks;

          project.regions.push(region);
        } else {
          // Audio clip: skip because old loops and generator IDs do not exist in the new catalog
          if (clip.name) {
            skippedAudioClips.push(String(clip.name));
          }
        }
      }
    });
  }

  if (skippedAudioClips.length > 0) {
    console.warn(
      `[convertLegacyProject] Skipped ${skippedAudioClips.length} old audio clip(s) incompatible with new library:`,
      skippedAudioClips,
    );
  }

  return project;
}
