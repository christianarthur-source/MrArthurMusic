import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Headphones, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { PartTrack } from '../../types';
import { getTrack } from '../../services/audioLibrary';

/**
 * Practice tracks for a piece's voice parts. Audio files (web links or files kept on this
 * device) play together in sync, each with its own volume, and "My part" brings one part forward
 * while the others drop to the background. YouTube and Google Drive tracks open in a player below.
 */

export const driveFileId = (url: string) => url.match(/\/d\/([-\w]{20,})/)?.[1] || url.match(/[?&]id=([-\w]{20,})/)?.[1] || null;
export const youTubeId = (url: string) => url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1] || null;
const isAudioFile = (url: string) => /\.(mp3|m4a|wav|ogg|oga|aac|flac|webm)(\?|#|$)/i.test(url);

type Resolved = PartTrack & { kind: 'audio' | 'youtube' | 'drive' | 'web' | 'missing'; src: string };

const fmt = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');

export const PartPlayer: React.FC<{ parts: PartTrack[] }> = ({ parts }) => {
  const [resolved, setResolved] = useState<Resolved[]>([]);
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [focus, setFocus] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [embed, setEmbed] = useState<Resolved | null>(null);
  const audios = useRef<Record<string, HTMLAudioElement | null>>({});

  // Turn each part into something playable (files kept on this device become object URLs)
  useEffect(() => {
    let urls: string[] = [];
    let cancelled = false;
    (async () => {
      const out: Resolved[] = [];
      for (const p of parts) {
        if (p.localId) {
          const t = await getTrack(p.localId).catch(() => undefined);
          if (t) {
            const src = URL.createObjectURL(t.blob);
            urls.push(src);
            out.push({ ...p, kind: 'audio', src });
          } else out.push({ ...p, kind: 'missing', src: '' });
        } else if (p.url) {
          const yt = youTubeId(p.url);
          const drive = driveFileId(p.url);
          if (yt) out.push({ ...p, kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1` });
          else if (drive) out.push({ ...p, kind: 'drive', src: `https://drive.google.com/file/d/${drive}/preview` });
          else if (isAudioFile(p.url)) out.push({ ...p, kind: 'audio', src: p.url });
          else out.push({ ...p, kind: 'web', src: p.url });
        }
      }
      if (!cancelled) setResolved(out);
    })();
    setPlaying(false);
    setTime(0);
    setFocus(null);
    setEmbed(null);
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls = [];
    };
  }, [JSON.stringify(parts)]);

  const audioParts = resolved.filter((r) => r.kind === 'audio');
  const otherParts = resolved.filter((r) => r.kind !== 'audio');
  const all = () => audioParts.map((p) => audios.current[p.id]).filter(Boolean) as HTMLAudioElement[];
  const master = () => all()[0];

  const levelFor = (id: string) => {
    const base = volumes[id] ?? 1;
    return focus && focus !== id ? base * 0.18 : base;
  };
  useEffect(() => {
    audioParts.forEach((p) => {
      const a = audios.current[p.id];
      if (a) a.volume = Math.min(1, Math.max(0, levelFor(p.id)));
    });
  }, [volumes, focus, resolved]);

  const toggle = async () => {
    const m = master();
    if (!m) return;
    if (playing) {
      all().forEach((a) => a.pause());
      setPlaying(false);
      return;
    }
    all().forEach((a) => (a.currentTime = m.currentTime));
    await Promise.all(all().map((a) => a.play().catch(() => undefined)));
    setPlaying(true);
  };

  const seek = (t: number) => {
    all().forEach((a) => (a.currentTime = t));
    setTime(t);
  };

  // Keep the parts lined up while playing (they can drift a little apart)
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const m = master();
      if (!m) return;
      setTime(m.currentTime);
      all()
        .slice(1)
        .forEach((a) => {
          if (Math.abs(a.currentTime - m.currentTime) > 0.12 && !a.ended) a.currentTime = m.currentTime;
        });
    }, 250);
    return () => window.clearInterval(id);
  }, [playing, resolved]);

  if (!parts.length) {
    return <p className="text-xs text-stone-500">No practice tracks yet. Edit the piece to add a link or audio file for each part.</p>;
  }

  return (
    <div className="space-y-3">
      {audioParts.length > 0 && (
        <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-800 space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? 'Pause' : 'Play all parts'}
              className="w-11 h-11 shrink-0 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow"
            >
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <button type="button" onClick={() => seek(0)} aria-label="Back to the start" className="p-2 rounded-lg text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700">
              <RotateCcw className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-stone-500 w-10 text-right">{fmt(time)}</span>
            <input type="range" min={0} max={duration || 0} step={0.1} value={time} onChange={(e) => seek(Number(e.target.value))} aria-label="Position" className="flex-1 accent-rose-600" />
            <span className="text-xs font-mono text-stone-500 w-10">{fmt(duration)}</span>
          </div>

          <div className="space-y-2">
            {audioParts.map((p, i) => {
              const muted = (volumes[p.id] ?? 1) === 0;
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <audio
                    ref={(el) => (audios.current[p.id] = el)}
                    src={p.src}
                    preload="metadata"
                    onLoadedMetadata={(e) => i === 0 && setDuration(e.currentTarget.duration)}
                    onEnded={() => i === 0 && setPlaying(false)}
                  />
                  <span className="w-28 sm:w-36 text-sm font-semibold truncate text-stone-800 dark:text-stone-100" title={p.name}>
                    {p.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setVolumes((v) => ({ ...v, [p.id]: muted ? 1 : 0 }))}
                    aria-label={muted ? `Unmute ${p.name}` : `Mute ${p.name}`}
                    className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700"
                  >
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volumes[p.id] ?? 1}
                    onChange={(e) => setVolumes((v) => ({ ...v, [p.id]: Number(e.target.value) }))}
                    aria-label={`${p.name} volume`}
                    className="flex-1 accent-rose-600"
                  />
                  {audioParts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setFocus(focus === p.id ? null : p.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${focus === p.id ? 'bg-rose-600 text-white' : 'bg-stone-200/70 dark:bg-stone-700 text-stone-600 dark:text-stone-300'}`}
                      title="Bring this part forward; the others play quietly underneath"
                    >
                      <Headphones className="w-3.5 h-3.5" />
                      My part
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {otherParts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {otherParts.map((p) =>
            p.kind === 'web' ? (
              <a key={p.id} href={p.src} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs font-bold text-stone-700 dark:text-stone-200 flex items-center gap-1.5 hover:bg-stone-200">
                {p.name}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : p.kind === 'missing' ? (
              <span key={p.id} className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs text-stone-400" title="This audio file was added on another device">
                {p.name} (on another device)
              </span>
            ) : (
              <button
                key={p.id}
                type="button"
                onClick={() => setEmbed(embed?.id === p.id ? null : p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${embed?.id === p.id ? 'bg-rose-600 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-200'}`}
              >
                <Play className="w-3.5 h-3.5" />
                {p.name}
                <span className="font-normal opacity-70">{p.kind === 'youtube' ? 'YouTube' : 'Drive'}</span>
              </button>
            )
          )}
        </div>
      )}
      {embed && (
        <div className={`rounded-2xl overflow-hidden bg-black ${embed.kind === 'youtube' ? 'aspect-video' : 'h-40'}`}>
          <iframe src={embed.src} title={embed.name} className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        </div>
      )}
    </div>
  );
};
