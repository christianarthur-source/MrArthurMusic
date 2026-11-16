/**
 * Site glue for the DAW: connects class-account saving, legacy project conversion,
 * URL sharing (?daw= / ?project=, and short ?s= links for File → Share), and the profanity filter.
 * The DAW itself is DawCore.tsx (kept identical to the standalone "mrA DAW" project).
 */
import { useMemo, useRef, useState } from 'react';
import { DawApp as DawCore, DawAppProps } from './DawCore';
import { saveStudentProject, StudentSession } from '../utils/classroomApi';
import { containsProfanity } from '../utils/profanityFilter';
import { createShortLink } from '../utils/shortLinkService';
import { convertLegacyProject, decompressLegacyDawProject } from './legacy';

const DEFAULT_TITLES = new Set(['my song', 'untitled', 'my composition']);

function getCloudIdMap(studentId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(`mrdaw.cloudIds.${studentId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setCloudIdMap(studentId: string, map: Record<string, string>) {
  try {
    localStorage.setItem(`mrdaw.cloudIds.${studentId}`, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

function extractLegacyProjectFromLocation(): unknown | null {
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

    const decodedJson = decodeURIComponent(atob(projParam.replace(/ /g, '+')));
    const parsed = JSON.parse(decodedJson);
    const project = decompressLegacyDawProject(parsed);
    // The link has been read: take the song out of the address bar so a refresh or a later
    // sign-in can't load it again over whatever the student has made since.
    try {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      for (const k of ['project', 'daw']) {
        searchParams.delete(k);
        hashParams.delete(k);
      }
      const q = searchParams.toString();
      const h = hashParams.toString();
      window.history.replaceState(null, '', window.location.pathname + (q ? `?${q}` : '?app=daw') + (h ? `#${h}` : ''));
    } catch {
      // ignore
    }
    return project;
  } catch (err) {
    console.warn('Could not parse shared DAW project from URL', err);
    return null;
  }
}

function generateCopyId(): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 18);
  return `proj_${rnd}`;
}

export function DawApp(
  props: DawAppProps & {
    studentSession: StudentSession | null;
    currentProjectId: string | null;
  },
) {
  const {
    studentSession,
    currentProjectId,
    onProjectSaved,
    loadedProjectData,
    onClearLoadedProjectData,
  } = props;

  const currentProjectIdRef = useRef(currentProjectId);
  currentProjectIdRef.current = currentProjectId;
  const studentSessionRef = useRef(studentSession);
  studentSessionRef.current = studentSession;

  // Old ?daw= / ?project= links: read once when the DAW opens, never again.
  const [legacyFromUrl] = useState(() => extractLegacyProjectFromLocation());
  const [legacyOpened, setLegacyOpened] = useState(false);

  // Turns an incoming song into what the DAW should open. Reads the session through a ref so that
  // signing in or out never produces a new value (which would reload over the open song).
  const prepare = (raw: unknown) => {
    const studentSession = studentSessionRef.current;
    if (!raw) return null;

    // Convert old format to v1 schema
    const converted = convertLegacyProject(raw) as Record<string, any>;
    if (!converted || typeof converted !== 'object') return converted;

    // Fix A: Track cloud record per DAW song inside the wrapper
    // Opening a song from the song list (currentProjectId is non-null)
    if (currentProjectIdRef.current && converted.id && studentSession) {
      const map = getCloudIdMap(studentSession.id);
      map[converted.id] = currentProjectIdRef.current;
      setCloudIdMap(studentSession.id, map);
      return converted;
    }

    // Opening a shared link (currentProjectId is null): the listener's own copy, credited as a remix
    if (!currentProjectIdRef.current) {
      const title = String(converted.title || 'Song').slice(0, 60);
      return {
        ...converted,
        id: generateCopyId(),
        title: title.endsWith('(remix)') ? title : `${title.slice(0, 51)} (remix)`,
        remixOf: typeof converted.remixOf === 'string' && converted.remixOf ? converted.remixOf : title.replace(/ \(remix\)$/, ''),
      };
    }

    return converted;
  };

  const fromHost = useMemo(() => prepare(loadedProjectData), [loadedProjectData]); // eslint-disable-line react-hooks/exhaustive-deps
  const fromLegacyLink = useMemo(() => prepare(legacyFromUrl), [legacyFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  const effectiveProjectData = fromHost ?? (legacyOpened ? null : fromLegacyLink);

  return (
    <DawCore
      {...props}
      loadedProjectData={effectiveProjectData ?? undefined}
      onClearLoadedProjectData={() => {
        setLegacyOpened(true);
        onClearLoadedProjectData?.();
      }}
      textFilter={(t) => !containsProfanity(t)}
      // Short ?s= links, like Staff Composer and Beat Machine. If Supabase is unreachable the DAW
      // falls back to a long self-contained link. Opening either gives the listener a copy (see above).
      share={async (project) => {
        const link = await createShortLink('daw', project.title, project);
        return link ? { url: link.shortUrl } : null;
      }}
      cloudLabel="your class account"
      cloudSave={async (project) => {
        if (!studentSession) {
          return {
            ok: false,
            message: 'Saved on this computer. Log in to save to your class account.',
          };
        }

        const map = getCloudIdMap(studentSession.id);
        const resolvedCloudId = map[project.id] ?? null;

        // The default title check
        const cleanTitle = (project.title || '').trim().toLowerCase();
        if (resolvedCloudId === null && DEFAULT_TITLES.has(cleanTitle)) {
          return {
            ok: false,
            message: 'Give your song a name first (click the title at the top), then save again.',
          };
        }

        const res = await saveStudentProject({
          studentId: studentSession.id,
          pin: studentSession.pin,
          projectId: resolvedCloudId,
          title: project.title,
          appType: 'daw',
          projectData: project, // schema v1 JSON; recordings stay on the device
        });

        if (res.saved && res.project) {
          map[project.id] = res.project.id;
          setCloudIdMap(studentSession.id, map);
          onProjectSaved?.(res.project.id);
        }

        if (res.saved && res.offline) {
          return {
            ok: false,
            message: 'No connection: saved on this computer only. Save again when you are back online.',
          };
        }
        return {
          ok: res.saved,
          message: res.saved ? `Saved "${project.title}" to your class account.` : undefined,
        };
      }}
    />
  );
}
