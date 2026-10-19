import { DawProject, DawTrack, DawClip, DawMidiNote, DEFAULT_DAW_FX } from '../types';

/**
 * Returns the public app URL where anyone can open without Google or developer login.
 */
export const getPublicBaseUrl = (): string => {
  if (typeof window === 'undefined') return '';
  const currentOrigin = window.location.origin;
  if (currentOrigin.includes('ais-dev-')) {
    return currentOrigin.replace('ais-dev-', 'ais-pre-');
  }
  return currentOrigin;
};

/**
 * Compress a DAW Project into a compact JSON structure suitable for URL params.
 */
export const compressDawProject = (project: DawProject): any => {
  return {
    t: project.title,
    b: project.bpm,
    ts: project.timeSignature,
    mv: project.masterVolume,
    sg: project.snapGrid,
    lr: project.loopRegion ? [project.loopRegion.enabled ? 1 : 0, project.loopRegion.startBeat, project.loopRegion.endBeat] : undefined,
    tr: (project.tracks || []).map((t) => ({
      i: t.id,
      n: t.name,
      y: t.type,
      c: t.color,
      ic: t.icon,
      m: t.muted ? 1 : 0,
      s: t.solo ? 1 : 0,
      in: t.instrumentId,
      fx: t.fx,
      cl: (t.clips || []).map((c) => ({
        i: c.id,
        n: c.name,
        y: c.type,
        sb: c.startBeat,
        db: c.durationBeats,
        c: c.color,
        lid: c.loopId,
        url: c.audioUrl,
        ob: c.originalBpm,
        g: c.gain,
        tsb: c.trimStartBeat,
        lp: c.isLooping ? 1 : 0,
        mn: c.midiNotes?.map((n) => [n.id, n.midi, n.startBeat, n.durationBeats, n.velocity]),
      })),
    })),
  };
};

/**
 * Decompress a compact DAW Project payload back into a complete DawProject.
 */
export const decompressDawProject = (compact: any): Partial<DawProject> => {
  if (!compact || typeof compact !== 'object') return {};

  const tracks: DawTrack[] = Array.isArray(compact.tr)
    ? compact.tr.map((t: any): DawTrack => {
        const clips: DawClip[] = Array.isArray(t.cl)
          ? t.cl.map((c: any): DawClip => {
              const midiNotes: DawMidiNote[] = Array.isArray(c.mn)
                ? c.mn.map((n: any): DawMidiNote => ({
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
          fx: { ...DEFAULT_DAW_FX, ...(t.fx || {}) },
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
};

/**
 * Generate a shareable link that opens directly into the Studio DAW tool.
 */
export const createShareableDawUrl = (project: DawProject): string => {
  try {
    const compact = compressDawProject(project);
    const jsonStr = JSON.stringify(compact);
    const encoded = btoa(encodeURIComponent(jsonStr));

    const publicBase = getPublicBaseUrl();
    const url = new URL(window.location.pathname, publicBase);
    url.searchParams.set('app', 'daw');
    url.searchParams.set('project', encoded);
    return url.toString();
  } catch (err) {
    console.error('Error generating DAW shareable link:', err);
    return window.location.href;
  }
};

/**
 * Extract and decode a shared DAW project from either URL query parameters or hash fragment.
 */
export const extractProjectFromLocation = (): Partial<DawProject> | null => {
  if (typeof window === 'undefined') return null;

  try {
    const searchParams = new URLSearchParams(window.location.search);
    let projParam = searchParams.get('project') || searchParams.get('daw');

    if (!projParam && window.location.hash) {
      const hashContent = window.location.hash.replace(/^#/, '');
      const hashParams = new URLSearchParams(hashContent);
      projParam = hashParams.get('project') || hashParams.get('daw');
    }

    if (!projParam) return null;

    const decodedJson = decodeURIComponent(atob(projParam));
    const parsed = JSON.parse(decodedJson);
    return decompressDawProject(parsed);
  } catch (err) {
    console.warn('Could not parse shared DAW project from URL', err);
    return null;
  }
};
