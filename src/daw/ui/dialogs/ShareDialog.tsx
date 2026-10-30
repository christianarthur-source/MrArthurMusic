import { Check, Copy, Link2, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { makeLongShareLink } from '../../persistence/shareLink';
import { Modal } from '../controls';
import { useStudio } from '../studio';

/**
 * File → Share: makes a link anyone can open to listen to this song. Opening it gives the
 * listener their own copy; nothing they do changes the creator's song.
 */
export function ShareDialog({ onClose }: { onClose: () => void }) {
  const s = useStudio();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const project = s.store.get();
  const ownAudio = Object.values(project.assets).filter((a) => a.ref.kind === 'user').length;

  useEffect(() => {
    let live = true;
    (async () => {
      const p = s.store.get();
      const short = s.host.share ? await s.host.share(p).catch(() => null) : null;
      return short?.url ?? (await makeLongShareLink(p));
    })()
      .then((u) => live && setUrl(u))
      .catch((e: Error) => live && setError(e.message || 'The link could not be made.'));
    return () => {
      live = false;
    };
  }, [s]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      input.current?.select();
      document.execCommand('copy');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal title="Share your song" onClose={onClose}>
      <div className="space-y-3 text-sm text-slate-300">
        <p>
          Anyone with this link can open <b className="text-slate-100">“{project.title}”</b> and listen. They get their own copy, so nothing they change affects your song.
        </p>
        {error ? (
          <p className="rounded-lg bg-rose-500/10 p-2 text-rose-200">Sorry, the link could not be made: {error}</p>
        ) : !url ? (
          <p className="flex items-center gap-2 text-slate-400">
            <Loader2 size={15} className="animate-spin" /> Making your link…
          </p>
        ) : (
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Link2 size={15} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-500" />
              <input ref={input} readOnly value={url} aria-label="Share link" data-testid="share-link" className="h-9 w-full rounded-lg bg-slate-800 pl-8 pr-2 font-mono text-xs text-slate-100 outline-none focus:ring-2 focus:ring-amber-400" onFocus={(e) => e.target.select()} />
            </div>
            <button type="button" onClick={() => void copy()} className="flex items-center gap-1 rounded-lg bg-amber-400 px-3 font-semibold text-slate-950 hover:bg-amber-300">
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
        {project.video?.link ? (
          <p className="text-xs text-slate-400">The video comes from a link, so people who open your song download it automatically.</p>
        ) : project.video?.assetId && (
          <p className="rounded-lg bg-amber-400/10 p-2 text-xs text-amber-200">Your video stays on this computer, so people opening the link hear your music without the picture. To share a video assignment, use a video provided by your teacher.</p>
        )}
        {ownAudio > 0 && (
          <p className="rounded-lg bg-amber-400/10 p-2 text-xs text-amber-200">
            Your own recordings and imported audio ({ownAudio}) stay on this computer, so they will be silent in the shared song. To share them, use Export to download the song as audio.
          </p>
        )}
        <p className="text-xs text-slate-500">The link shows the song as it is right now. Share again after you make changes.</p>
      </div>
    </Modal>
  );
}
