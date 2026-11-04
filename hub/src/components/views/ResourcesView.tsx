import React, { lazy, Suspense } from 'react';
import { Boxes, FolderSync, Loader2, Mic2 } from 'lucide-react';
import { useRememberedState } from '../../hooks/useRememberedState';
import { ResourceLibraryView } from './ResourceLibraryView';

const ChorusView = lazy(() => import('../resources/ChorusView').then((m) => ({ default: m.ChorusView })));
const InstrumentsView = lazy(() => import('../resources/InstrumentsView').then((m) => ({ default: m.InstrumentsView })));

type Section = 'links' | 'chorus' | 'instruments';

/** Resources: links & Drive files, the chorus library, and the instrument room. */
export const ResourcesView: React.FC = () => {
  const [section, setSection] = useRememberedState<Section>('resources.section', 'links');
  const tabs = [
    { id: 'links' as const, label: 'Links & Drive', icon: FolderSync },
    { id: 'chorus' as const, label: 'Chorus', icon: Mic2 },
    { id: 'instruments' as const, label: 'Instruments', icon: Boxes }
  ];

  return (
    <div>
      <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 max-w-7xl mx-auto">
        <div className="inline-flex p-1 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700" role="tablist" aria-label="Resources">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={section === t.id}
              onClick={() => setSection(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                section === t.id ? 'bg-white dark:bg-stone-900 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {section === 'links' ? (
        <ResourceLibraryView />
      ) : (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Suspense fallback={<Loader2 className="w-6 h-6 animate-spin text-stone-400 mx-auto my-16" />}>{section === 'chorus' ? <ChorusView /> : <InstrumentsView />}</Suspense>
        </div>
      )}
    </div>
  );
};
