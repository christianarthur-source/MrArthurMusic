import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { getTrack } from '../../services/audioLibrary';
import { REMEMBERED_PREFIX } from '../../hooks/useRememberedState';
import { Slide } from '../../types';

/**
 * The working parts of interactive slides, shown in the presenter: a YouTube player, an Audio
 * Studio track, a countdown timer and a name picker. Clicks inside them don't advance the slide.
 * Sizes use container units (cqw) like the rest of the slide.
 */
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export const VideoWidget: React.FC<{ slide: Slide }> = ({ slide }) =>
  slide.video ? (
    <iframe
      src={`https://www.youtube-nocookie.com/embed/${slide.video.youtubeId}?rel=0&modestbranding=1&playsinline=1`}
      title={slide.video.title}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      className="w-full h-full rounded-[1.2cqw] bg-black"
      onClick={stop}
    />
  ) : null;

export const AudioWidget: React.FC<{ slide: Slide; color: string }> = ({ slide, color }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let objectUrl = '';
    if (!slide.audio) return;
    getTrack(slide.audio.trackId)
      .then((t) => {
        if (!t) return setMissing(true);
        objectUrl = URL.createObjectURL(t.blob);
        setUrl(objectUrl);
      })
      .catch(() => setMissing(true));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [slide.audio?.trackId]);

  if (missing) return <p style={{ color, fontSize: '2cqw', opacity: 0.8 }}>This track isn't saved on this device. Add it in the Audio Studio here.</p>;
  return (
    <div className="flex flex-col items-center" style={{ gap: '2cqw' }} onClick={stop}>
      <button
        type="button"
        disabled={!url}
        onClick={() => (audio.current?.paused ? audio.current.play() : audio.current?.pause())}
        aria-label={playing ? 'Pause' : 'Play'}
        className="rounded-full flex items-center justify-center shadow-xl disabled:opacity-40"
        style={{ width: '12cqw', height: '12cqw', background: color, color: '#111' }}
      >
        {playing ? <Pause style={{ width: '5cqw', height: '5cqw' }} /> : <Play style={{ width: '5cqw', height: '5cqw', marginLeft: '0.6cqw' }} />}
      </button>
      {url && (
        <audio ref={audio} src={url} controls onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} style={{ width: '50cqw' }} />
      )}
    </div>
  );
};

export const TimerWidget: React.FC<{ slide: Slide; color: string; accent: string }> = ({ slide, color, accent }) => {
  const total = Math.round((slide.timerMinutes || 1) * 60);
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(false);
  const endAt = useRef(0);

  useEffect(() => setLeft(total), [total]);
  useEffect(() => {
    if (!running) return;
    endAt.current = Date.now() + left * 1000;
    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        setRunning(false);
        try {
          const ctx = new AudioContext();
          [523, 659, 784].forEach((f, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.frequency.value = f;
            const t = ctx.currentTime + i * 0.18;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
            o.connect(g).connect(ctx.destination);
            o.start(t);
            o.stop(t + 0.75);
          });
          setTimeout(() => ctx.close(), 1500);
        } catch {}
      }
    }, 250);
    return () => clearInterval(tick);
  }, [running]);

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  const btn = { width: '7cqw', height: '7cqw', borderRadius: '50%', background: 'rgba(127,127,127,0.25)', color };
  return (
    <div className="flex flex-col items-center" style={{ gap: '2cqw' }} onClick={stop}>
      <div className="font-mono tabular-nums font-bold" style={{ fontSize: '16cqw', lineHeight: 1, color: left === 0 ? accent : color }}>
        {mm}:{ss}
      </div>
      <div className="flex" style={{ gap: '2cqw' }}>
        <button type="button" onClick={() => setRunning((r) => !r)} aria-label={running ? 'Pause timer' : 'Start timer'} className="flex items-center justify-center" style={btn}>
          {running ? <Pause style={{ width: '3cqw', height: '3cqw' }} /> : <Play style={{ width: '3cqw', height: '3cqw' }} />}
        </button>
        <button type="button" onClick={() => { setRunning(false); setLeft(total); }} aria-label="Reset timer" className="flex items-center justify-center" style={btn}>
          <RotateCcw style={{ width: '3cqw', height: '3cqw' }} />
        </button>
      </div>
    </div>
  );
};

interface PickerList {
  id: string;
  title: string;
  names: string[];
}

export const readPickerLists = (): PickerList[] => {
  try {
    return JSON.parse(localStorage.getItem(REMEMBERED_PREFIX + 'namePicker.lists') || '[]');
  } catch {
    return [];
  }
};

export const PickerWidget: React.FC<{ slide: Slide; color: string; accent: string }> = ({ slide, color, accent }) => {
  const list = readPickerLists().find((l) => l.id === slide.pickerListId);
  const [shown, setShown] = useState('');
  const [spinning, setSpinning] = useState(false);
  const used = useRef<string[]>([]);

  if (!list) return <p style={{ color, fontSize: '2cqw', opacity: 0.8 }}>That name list isn't on this device. Make it in the Name Picker here.</p>;

  const pick = () => {
    if (spinning || !list.names.length) return;
    let pool = list.names.filter((n) => !used.current.includes(n));
    if (!pool.length) {
      used.current = [];
      pool = list.names;
    }
    const winner = pool[Math.floor(Math.random() * pool.length)];
    setSpinning(true);
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      if (elapsed > 1500) {
        setShown(winner);
        used.current.push(winner);
        setSpinning(false);
        return;
      }
      setShown(list.names[Math.floor(Math.random() * list.names.length)]);
      setTimeout(tick, 40 + (elapsed / 1500) ** 2 * 220);
    };
    tick();
  };

  return (
    <div className="flex flex-col items-center" style={{ gap: '3cqw' }} onClick={stop}>
      <div className="font-extrabold text-center" style={{ fontSize: '9cqw', lineHeight: 1.05, color: spinning ? color : accent, minHeight: '10cqw' }}>
        {shown || 'Ready?'}
      </div>
      <button type="button" onClick={pick} disabled={spinning} className="font-extrabold shadow-xl" style={{ fontSize: '2.6cqw', padding: '1.4cqw 4cqw', borderRadius: '2cqw', background: accent, color: '#111' }}>
        {spinning ? 'Picking…' : 'Pick a name'}
      </button>
    </div>
  );
};
