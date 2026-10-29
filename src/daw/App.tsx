/**
 * Site glue for the DAW: connects class-account saving and the profanity filter.
 * The DAW itself is DawCore.tsx (kept identical to the standalone "mrA DAW" project).
 */
import { DawApp as DawCore, DawAppProps } from './DawCore';
import { saveStudentProject, StudentSession } from '../utils/classroomApi';
import { containsProfanity } from '../utils/profanityFilter';

export function DawApp(props: DawAppProps & { studentSession: StudentSession | null; currentProjectId: string | null }) {
  const { studentSession, currentProjectId, onProjectSaved } = props;
  return (
    <DawCore
      {...props}
      textFilter={(t) => !containsProfanity(t)}
      cloudLabel="your class account"
      cloudSave={async (project) => {
        if (!studentSession) return { ok: false, message: 'Saved on this computer. Log in to save to your class account.' };
        const res = await saveStudentProject({
          studentId: studentSession.id,
          pin: studentSession.pin,
          projectId: currentProjectId,
          title: project.title,
          appType: 'daw',
          projectData: project, // schema v1 JSON; recordings stay on the device (see ARCHITECTURE.md)
        });
        if (res.saved && res.project) onProjectSaved?.(res.project.id);
        return { ok: res.saved, message: res.saved ? `Saved "${project.title}" to your class account.` : undefined };
      }}
    />
  );
}
