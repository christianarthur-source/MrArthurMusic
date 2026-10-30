import { Clapperboard, Eye, EyeOff, Film, Maximize, Pause, Play, SkipBack, Unlink, Volume2, VolumeX, X } from 'lucide-react';
import { RefObject, useEffect, useRef, useState } from 'react';
import { secondsToTicks, ticksToSeconds } from '../model/time';
import { Project } from '../model/types';
import { togglePlay } from './actions';
import { cx, Modal, ProgressBar } from './controls';
import { useEngineState, useProject, useStudio, useUi } from './studio';
import { HEADER_W, ticksToPx } from './timeline/layout';
import { addVideo, detachVideoSound, removeVideo, removeVideoSound, seekToVideoStart, toggleVideoSoundMute, onVideoRestored, parseVideoLink, restoreVideoFromLink, thumbStep, VIDEO_ACCEPT, videoStartSec, videoThumbnails, videoUrl } from './video';
import type { Studio } from './studio';

/** The project's video as a playable URL (null while loading; 'missing' when not on this computer). */
function useVideoUrl(): string | null | 'missing' {
  const s = useStudio();
  const key = useProject((p) => (p.video ? `${p.video.assetId ?? ''}|${p.video.src ?? ''}` : ''));
  const [url, setUrl] = useState<string | null | 'missing'>(null);
  const [restoredCount, setRestored] = useState(0);
  useEffect(() => onVideoRestored(() => setRestored((n) => n + 1)), []);
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (key) void videoUrl(s.store.get()).then((u) => live && setUrl(u ?? 'missing'));
    return () => {
      live = false;
    };
  }, [s, key, restoredCount]);
  return url;
}

/**
 * Keeps a muted <video> on the audio clock. Playing: corrects drift by nudging the playback
 * rate, and jumps when it is far off. Stopped: shows the frame at the playhead (scrubbing).
 */
function useVideoSync(ref: RefObject<HTMLVideoElement | null>, url: string | null | 'missing') {
  const s = useStudio();
  useEffect(() => {
    if (!url || url === 'missing') return;
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const el = ref.current;
      const p = s.store.get();
      if (!el || !p.video || el.readyState < 1) return;
      const tick = s.engine.currentTick();
      const t = ticksToSeconds(p.tempoMap, Math.max(0, tick)) - videoStartSec(p);
      const dur = el.duration || p.video.durationSec;
      const inside = tick >= 0 && t >= 0 && t < dur;
      el.style.opacity = inside || s.engine.state !== 'playing' ? '1' : '0.25';
      const target = Math.max(0, Math.min(dur - 0.01, t));
      if (s.engine.state === 'playing' && inside) {
        const drift = el.currentTime - target;
        if (el.paused || Math.abs(drift) > 0.25) {
          if (!el.seeking) el.currentTime = target;
          el.playbackRate = 1;
          if (el.paused) void el.play().catch(() => undefined);
        } else {
          // Small drift: catch up smoothly instead of jumping (no visible stutter).
          el.playbackRate = Math.max(0.9, Math.min(1.1, 1 - drift * 1.5));
        }
      } else {
        if (!el.paused) el.pause();
        el.playbackRate = 1;
        if (!el.seeking && Math.abs(el.currentTime - target) > 0.04) el.currentTime = target;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ref.current?.pause();
    };
  }, [s, ref, url]);
}

// ------------------------------------------------------------------ add video

export function AddVideoDialog({ onClose }: { onClose: () => void }) {
  const s = useStudio();
  const [existing] = useState(() => s.store.get().video?.name); // as it was when the dialog opened
  const [mode, setMode] = useState<'file' | 'link'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState('');
  const linkCheck = link.trim() ? parseVideoLink(link) : null;
  const ready = mode === 'file' ? !!file : !!linkCheck && !('error' in linkCheck);
  const [withAudio, setWithAudio] = useState(true);
  const [busy, setBusy] = useState(false);
  const task = useUi((u) => u.task);
  return (
    <Modal title={existing ? 'Replace video' : 'Add a video to score'} onClose={onClose}>
      <div className="space-y-3 text-sm text-slate-300">
        <p>Compose music that fits a video. The video plays in sync with your song, and Theater Mode lets you watch it full screen with your music.</p>
        {existing && <p className="rounded-lg bg-amber-400/10 p-2 text-xs text-amber-200">This replaces “{existing}” and its sound track. You can undo it.</p>}
        <div className="flex gap-1 rounded-lg bg-slate-800/60 p-1 text-xs" role="tablist">
          {(['file', 'link'] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} className={cx('flex-1 rounded-md px-2 py-1.5 font-semibold', mode === m ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200')} onClick={() => setMode(m)}>
              {m === 'file' ? 'From this computer' : 'From a link (Google Drive)'}
            </button>
          ))}
        </div>
        {mode === 'file' ? (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-400">Video file</span>
            <input type="file" accept={VIDEO_ACCEPT} className="block w-full text-xs text-slate-300 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-slate-100" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        ) : (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-400">Video link</span>
            <input
              type="url"
              data-testid="video-link"
              placeholder="https://drive.google.com/file/d/…"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="h-9 w-full rounded-lg bg-slate-800 px-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-amber-400"
            />
            {linkCheck && 'error' in linkCheck ? (
              <span className="mt-1 block text-xs text-rose-300">{linkCheck.error}</span>
            ) : (
              <span className="mt-1 block text-xs text-slate-500">In Google Drive: right-click the video → Share → set “Anyone with the link” → Copy link. The video is downloaded and saved on this computer, and classmates who open your shared song get it automatically.</span>
            )}
          </label>
        )}
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-0.5 accent-amber-400" checked={withAudio} onChange={(e) => setWithAudio(e.target.checked)} />
          <span>
            Import the video’s sound
            <span className="block text-xs text-slate-500">It goes on its own track, so you can turn it down, mute it, detach it or remove it later. Leave this off to score a silent picture.</span>
          </span>
        </label>
        <p className="text-xs text-slate-500">Works best with an MP4 video (H.264), 720p, a few minutes or less. The video stays on this computer like your recordings.</p>
        {busy && task && <ProgressBar progress={task.progress} label={task.label} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready || busy}
            className="rounded-lg bg-amber-400 px-4 py-1.5 font-semibold text-slate-950 disabled:opacity-40"
            onClick={async () => {
              if (!ready) return;
              setBusy(true);
              const ok = await addVideo(s, mode === 'file' ? file! : link.trim(), withAudio);
              setBusy(false);
              if (ok) onClose();
            }}
          >
            {busy ? 'Adding…' : existing ? 'Replace video' : 'Add video'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ track strip

const STRIP_H = 58;

/** The video row above the tracks (only shown when the song has a video). */
export function VideoStrip() {
  const s = useStudio();
  useAutoRestoreVideo();
  const video = useProject((p) => p.video);
  const sound = useProject((p) => p.tracks.find((t) => t.id === p.video?.audioTrackId));
  const videoWindow = useUi((u) => u.videoWindow);
  const [menu, setMenu] = useState(false);
  if (!video) return null;
  return (
    <div className="flex shrink-0 border-b border-slate-800 bg-slate-950" style={{ height: STRIP_H }} data-testid="video-strip">
      <div className="relative flex shrink-0 flex-col justify-center gap-1 border-r border-slate-800 bg-slate-900 px-2" style={{ width: HEADER_W }}>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100">
          <Film size={14} className="shrink-0 text-amber-300" />
          <span className="truncate" title={video.name}>
            {video.name}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <StripButton label={videoWindow ? 'Hide video window' : 'Show video window'} onClick={() => s.ui.set({ videoWindow: !videoWindow })}>
            {videoWindow ? <Eye size={13} /> : <EyeOff size={13} />}
          </StripButton>
          <StripButton label="Theater Mode: watch full screen with your music" onClick={() => s.ui.set({ theater: true })}>
            <Clapperboard size={13} /> <span className="text-[10px]">Theater</span>
          </StripButton>
          {sound ? (
            <>
              <StripButton label={sound.mute ? 'Unmute the video sound' : 'Mute the video sound'} active={sound.mute} onClick={() => toggleVideoSoundMute(s)}>
                {sound.mute ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </StripButton>
              <StripButton label="Detach the sound: make it a normal audio track that moves on its own" onClick={() => detachVideoSound(s)}>
                <Unlink size={13} />
              </StripButton>
            </>
          ) : (
            <span className="text-[10px] text-slate-500" title="This video's sound was not imported, or it was detached or removed">no linked sound</span>
          )}
          <div className="relative ml-auto">
            <StripButton label="More video options" onClick={() => setMenu(!menu)}>
              ⋯
            </StripButton>
            {menu && (
              <div role="menu" className="absolute left-0 top-7 z-[70] w-52 rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-2xl" onPointerLeave={() => setMenu(false)}>
                {[
                  ['Go to video start', () => seekToVideoStart(s)],
                  ['Replace video…', () => s.ui.set({ dialog: 'video' })],
                  ...(sound ? [['Remove video sound', () => removeVideoSound(s)] as const] : []),
                  ['Remove video', () => removeVideo(s)],
                ].map(([label, run]) => (
                  <button
                    key={label as string}
                    type="button"
                    role="menuitem"
                    className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-800"
                    onClick={() => {
                      setMenu(false);
                      (run as () => void)();
                    }}
                  >
                    {label as string}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <ThumbLane />
    </div>
  );
}

function StripButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={active} onClick={onClick} className={cx('flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-md px-1 text-slate-300', active ? 'bg-sky-400 text-slate-950' : 'bg-slate-800 hover:bg-slate-700')}>
      {children}
    </button>
  );
}

/** Thumbnails laid out on the song's timeline, scrolled and zoomed with it. Click to jump. */
function ThumbLane() {
  const s = useStudio();
  const url = useVideoUrl();
  const project = useProject((p) => p);
  const scrollX = useUi((u) => u.scrollX);
  const v = project.video!;
  const step = thumbStep(v.durationSec);
  const [frames, setFrames] = useState<string[]>([]);
  useEffect(() => {
    setFrames([]);
    if (!url || url === 'missing') return;
    let live = true;
    videoThumbnails(url, v.durationSec, step)
      .then((f) => live && setFrames(f))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [url, v.durationSec, step]);
  const ppb = project.editor.pxPerBeat;
  const start = videoStartSec(project);
  const x = (sec: number) => ticksToPx(secondsToTicks(project.tempoMap, Math.max(0, start + sec)), ppb) - scrollX;
  const x0 = x(0);
  const x1 = x(v.durationSec);
  return (
    <div
      className="relative min-w-0 flex-1 cursor-pointer overflow-hidden"
      title="Video: click to jump here"
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const tick = Math.max(0, ((e.clientX - r.left + scrollX) * 960) / ppb);
        s.engine.seek(Math.round(tick));
      }}
    >
      {url === 'missing' ? (
        <div className="absolute inset-y-1 flex items-center rounded-md bg-rose-500/10 px-3 text-xs text-rose-200" style={{ left: Math.max(0, x0), width: Math.max(160, x1 - x0) }}>
          <MissingVideo />
        </div>
      ) : (
        <div className="absolute inset-y-1 overflow-hidden rounded-md bg-slate-800 ring-1 ring-amber-400/40" style={{ left: x0, width: Math.max(4, x1 - x0) }}>
          {frames.map((f, i) => {
            const a = x(i * step) - x0;
            const b = x(Math.min(v.durationSec, (i + 1) * step)) - x0;
            if (b - a < 1) return null;
            return <div key={i} className="absolute inset-y-0 bg-cover bg-left" style={{ left: a, width: b - a, backgroundImage: `url(${f})` }} />;
          })}
          {!frames.length && <div className="flex h-full items-center px-2 text-[11px] text-slate-400">{v.name}</div>}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ video window

/** Floating, draggable, resizable video window. */
export function VideoWindow() {
  const s = useStudio();
  const has = useProject((p) => !!p.video);
  const open = useUi((u) => u.videoWindow);
  const theater = useUi((u) => u.theater);
  const url = useVideoUrl();
  const ref = useRef<HTMLVideoElement>(null);
  const [pos, setPos] = useState({ x: Math.max(16, window.innerWidth - 760), y: 140 });
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  useVideoSync(ref, has && open && !theater ? url : null);
  if (!has || !open || theater) return null;
  return (
    <div className="fixed z-[60] flex flex-col overflow-hidden rounded-xl border border-slate-700 bg-black shadow-2xl" style={{ left: pos.x, top: pos.y, width: 400, minWidth: 220, maxWidth: '80vw', resize: 'horizontal' }} data-testid="video-window">
      <div
        className="flex cursor-move items-center gap-1 bg-slate-900 px-2 py-1 text-xs text-slate-300 select-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
        }}
        onPointerMove={(e) => drag.current && setPos({ x: Math.max(0, Math.min(window.innerWidth - 120, e.clientX - drag.current.dx)), y: Math.max(0, Math.min(window.innerHeight - 60, e.clientY - drag.current.dy)) })}
        onPointerUp={() => (drag.current = null)}
      >
        <Film size={12} className="text-amber-300" /> Video
        <button type="button" className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-slate-700" title="Theater Mode" onPointerDown={(e) => e.stopPropagation()} onClick={() => s.ui.set({ theater: true })}>
          <Maximize size={12} /> Theater
        </button>
        <button type="button" className="rounded p-0.5 hover:bg-slate-700" aria-label="Hide video window" title="Hide (show it again from the video track)" onPointerDown={(e) => e.stopPropagation()} onClick={() => s.ui.set({ videoWindow: false })}>
          <X size={13} />
        </button>
      </div>
      {url === 'missing' ? (
        <div className="p-4 text-xs text-rose-200">
          <MissingVideo />
        </div>
      ) : (
        <video ref={ref} src={url ?? undefined} muted playsInline preload="auto" className="aspect-video w-full bg-black" />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ theater mode

/** Full-screen picture with the song's music, from the start of the video. Esc to leave. */
export function TheaterMode() {
  const s = useStudio();
  const on = useUi((u) => u.theater);
  const video = useProject((p) => p.video);
  const url = useVideoUrl();
  const ref = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const playing = useEngineState().startsWith('playing');
  useVideoSync(ref, on ? url : null);

  useEffect(() => {
    if (!on) return;
    seekToVideoStart(s);
    box.current?.requestFullscreen?.().catch(() => undefined);
    const exit = () => s.ui.set({ theater: false });
    const onFs = () => !document.fullscreenElement && exit();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && exit();
    document.addEventListener('fullscreenchange', onFs);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      window.removeEventListener('keydown', onKey);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [on, s]);

  if (!on || !video) return null;
  return (
    <div ref={box} className="fixed inset-0 z-[120] flex flex-col bg-black" data-testid="theater">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {url === 'missing' ? <p className="text-slate-300">This video is not on this computer.</p> : <video ref={ref} src={url ?? undefined} muted playsInline preload="auto" className="max-h-full max-w-full" />}
      </div>
      <div className="flex shrink-0 items-center justify-center gap-3 bg-gradient-to-t from-black to-transparent p-4">
        <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Back to the start of the video" title="Back to the start of the video" onClick={() => seekToVideoStart(s)}>
          <SkipBack size={20} />
        </button>
        <button type="button" className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-slate-950 hover:bg-emerald-400" aria-label={playing ? 'Pause' : 'Play'} onClick={() => togglePlay(s)}>
          {playing ? <Pause size={26} /> : <Play size={26} fill="currentColor" />}
        </button>
        <TheaterClock s={s} project={() => s.store.get()} />
        <button type="button" className="ml-6 rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20" onClick={() => s.ui.set({ theater: false })}>
          Exit Theater (Esc)
        </button>
      </div>
    </div>
  );
}

/** mm:ss of the video, from the audio clock. */
function TheaterClock({ s, project }: { s: Studio; project: () => Project }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const f = () => {
      raf = requestAnimationFrame(f);
      const p = project();
      const t = Math.max(0, ticksToSeconds(p.tempoMap, Math.max(0, s.engine.currentTick())) - videoStartSec(p));
      if (ref.current) ref.current.textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [s, project]);
  return <span ref={ref} className="w-14 text-center font-mono text-lg text-white/80" />;
}

/** Shown when the song's video file is not on this computer; downloads it again when its link is known. */
function MissingVideo() {
  const s = useStudio();
  const link = useProject((p) => p.video?.link);
  const busy = useUi((u) => !!u.task);
  if (!link) return <span>This video is not on this computer. Use File → Replace video… to add it again.</span>;
  return (
    <span className="flex items-center gap-2">
      This video is not on this computer yet.
      <button type="button" disabled={busy} className="pointer-events-auto rounded-md bg-amber-400 px-2 py-0.5 font-semibold text-slate-950 disabled:opacity-50" onPointerDown={(e) => e.stopPropagation()} onClick={() => void restoreVideoFromLink(s)}>
        {busy ? 'Downloading…' : 'Download it'}
      </button>
    </span>
  );
}

/**
 * Opening a shared song or assignment whose video lives at a link: fetch it once, automatically.
 */
/** Videos already auto-downloaded this session (shared across every mount, incl. React StrictMode re-runs). */
const autoTried = new Set<string>();

export function useAutoRestoreVideo() {
  const s = useStudio();
  const key = useProject((p) => (p.video?.link && p.video.assetId ? p.video.assetId : ''));
  useEffect(() => {
    if (!key || autoTried.has(key)) return;
    autoTried.add(key);
    void videoUrl(s.store.get()).then((u) => {
      if (!u) void restoreVideoFromLink(s);
    });
  }, [s, key]);
}
