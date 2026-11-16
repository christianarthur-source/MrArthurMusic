import { lazyModal } from '../lazyModal';

/** The Tool Box window and its 8 mini-tools download the first time it is opened. */
export const LazyClassroomToolBoxModal = lazyModal(() =>
  import('./ClassroomToolBoxModal').then((m) => ({ default: m.ClassroomToolBoxModal })),
);
