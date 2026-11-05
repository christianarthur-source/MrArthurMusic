import React from 'react';
import { Clock, Dices, Music, PlayCircle } from 'lucide-react';
import { Slide, SlideTheme } from '../../types';
import { AudioWidget, PickerWidget, TimerWidget, VideoWidget } from './LiveWidgets';

/**
 * Draws one 16:9 slide. All sizes are in container-width units (cqw), so the same slide looks
 * identical as a thumbnail, in the editor and full screen on the projector.
 */
interface ThemeStyle {
  background: string;
  title: string;
  text: string;
  accent: string;
  titleFont: string;
  photoShade: string; // overlay that keeps text readable on top of a picture
}

export const THEME_STYLES: Record<SlideTheme, ThemeStyle> = {
  navy: {
    background: 'radial-gradient(120% 120% at 0% 0%, #22324a 0%, #13171d 60%)',
    title: '#ffffff',
    text: '#d6dde8',
    accent: '#fbbf24',
    titleFont: 'Inter, system-ui, sans-serif',
    photoShade: 'linear-gradient(to top, rgba(10,14,20,0.85), rgba(10,14,20,0.15))'
  },
  chalkboard: {
    background: 'radial-gradient(140% 120% at 50% 0%, #2f4a3d 0%, #1f3329 70%)',
    title: '#f8fafc',
    text: '#e2e8e4',
    accent: '#fde68a',
    titleFont: '"Newsreader", Georgia, serif',
    photoShade: 'linear-gradient(to top, rgba(18,32,25,0.88), rgba(18,32,25,0.15))'
  },
  sunny: {
    background: 'linear-gradient(135deg, #fff7e6 0%, #ffe9c7 100%)',
    title: '#9a3412',
    text: '#44403c',
    accent: '#0c87eb',
    titleFont: 'Inter, system-ui, sans-serif',
    photoShade: 'linear-gradient(to top, rgba(255,247,230,0.95), rgba(255,247,230,0.1))'
  },
  paper: {
    background: '#fbf7ee',
    title: '#1c1917',
    text: '#44403c',
    accent: '#be123c',
    titleFont: '"Newsreader", Georgia, serif',
    photoShade: 'linear-gradient(to top, rgba(251,247,238,0.95), rgba(251,247,238,0.1))'
  },
  concert: {
    background: 'radial-gradient(120% 120% at 100% 0%, #5b21b6 0%, #2e1065 65%)',
    title: '#ffffff',
    text: '#e9d5ff',
    accent: '#facc15',
    titleFont: '"Newsreader", Georgia, serif',
    photoShade: 'linear-gradient(to top, rgba(30,8,60,0.88), rgba(30,8,60,0.15))'
  }
};

interface Props {
  slide: Slide;
  theme: SlideTheme;
  className?: string;
  /** Slide number to show in the corner (presenter and print). */
  number?: number;
  /** Interactive slides work (play, count down, pick) only when live, i.e. in the presenter. */
  live?: boolean;
}

const INTERACTIVE = { video: PlayCircle, audio: Music, timer: Clock, picker: Dices } as const;

/** 0.25 minutes -> "0:15", 3 -> "3:00". */
export const clockTime = (minutes: number) => {
  const total = Math.round(minutes * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export const SlideCanvas: React.FC<Props> = ({ slide, theme, className = '', number, live = false }) => {
  const t = THEME_STYLES[theme] || THEME_STYLES.navy;
  const img = slide.image;
  const credit = img?.credit && img.credit !== 'AI illustration' ? img.credit : '';
  const fullBleed = !!img && (slide.layout === 'image-full' || slide.layout === 'title');

  const titleStyle: React.CSSProperties = { color: t.title, fontFamily: t.titleFont, fontWeight: 800, lineHeight: 1.1 };
  const bulletList = slide.bullets.length > 0 && (
    <ul style={{ color: t.text, fontSize: '2.6cqw', lineHeight: 1.35, marginTop: '2.2cqw' }} className="space-y-[1.2cqw]">
      {slide.bullets.map((b, i) => (
        <li key={i} className="flex gap-[1.4cqw]">
          <span style={{ color: t.accent }} aria-hidden>●</span>
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div
      className={`relative w-full aspect-video overflow-hidden select-none ${className}`}
      style={{ containerType: 'inline-size', background: t.background }}
    >
      {fullBleed && (
        <>
          <img src={img!.src} alt={img!.alt || ''} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
          <div className="absolute inset-0" style={{ background: t.photoShade }} />
        </>
      )}

      {slide.layout === 'title' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ padding: '6cqw' }}>
          <div style={{ width: '8cqw', height: '0.5cqw', background: t.accent, marginBottom: '2.5cqw', borderRadius: '1cqw' }} />
          <h1 style={{ ...titleStyle, fontSize: '6.2cqw' }}>{slide.title || 'Title'}</h1>
          {slide.subtitle && <p style={{ color: t.text, fontSize: '2.6cqw', marginTop: '1.8cqw' }}>{slide.subtitle}</p>}
        </div>
      )}

      {slide.layout === 'bullets' && (
        <div className="absolute inset-0" style={{ padding: '6cqw 7cqw' }}>
          <h2 style={{ ...titleStyle, fontSize: '4.4cqw' }}>{slide.title}</h2>
          <div style={{ width: '6cqw', height: '0.45cqw', background: t.accent, marginTop: '1.6cqw', borderRadius: '1cqw' }} />
          {bulletList}
        </div>
      )}

      {slide.layout === 'image-right' && (
        <div className="absolute inset-0 grid grid-cols-[1.15fr_1fr] items-center" style={{ gap: '4cqw', padding: '5cqw 5cqw 5cqw 6cqw' }}>
          <div>
            <h2 style={{ ...titleStyle, fontSize: '4cqw' }}>{slide.title}</h2>
            <div style={{ width: '6cqw', height: '0.45cqw', background: t.accent, marginTop: '1.5cqw', borderRadius: '1cqw' }} />
            {bulletList}
          </div>
          <div className="relative w-full h-full overflow-hidden" style={{ borderRadius: '2cqw', background: 'rgba(127,127,127,0.15)' }}>
            {img ? (
              <img src={img.src} alt={img.alt || ''} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-center" style={{ color: t.text, fontSize: '1.6cqw', opacity: 0.6, padding: '2cqw' }}>
                {slide.imageIdea ? `Picture: ${slide.imageIdea}` : 'No picture'}
              </div>
            )}
          </div>
        </div>
      )}

      {slide.layout === 'image-full' && (
        <div className="absolute inset-x-0 bottom-0" style={{ padding: '4cqw 6cqw' }}>
          <h2 style={{ ...titleStyle, fontSize: '4.4cqw' }}>{slide.title}</h2>
          {slide.subtitle && <p style={{ color: t.text, fontSize: '2.3cqw', marginTop: '1cqw' }}>{slide.subtitle}</p>}
          {!img && <p style={{ color: t.text, fontSize: '1.6cqw', opacity: 0.6, marginTop: '1cqw' }}>Add a picture to fill this slide.</p>}
        </div>
      )}

      {slide.layout === 'big-idea' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ padding: '8cqw' }}>
          <div style={{ color: t.accent, fontSize: '9cqw', lineHeight: 0.6, fontFamily: 'Georgia, serif' }} aria-hidden>“</div>
          <h2 style={{ ...titleStyle, fontSize: '5.2cqw', marginTop: '1cqw' }}>{slide.title}</h2>
          {slide.subtitle && <p style={{ color: t.text, fontSize: '2.4cqw', marginTop: '2cqw' }}>{slide.subtitle}</p>}
        </div>
      )}

      {slide.layout in INTERACTIVE && (
        <div className="absolute inset-0 flex flex-col" style={{ padding: '4.5cqw 6cqw' }}>
          {slide.title && <h2 style={{ ...titleStyle, fontSize: '3.8cqw', marginBottom: '2.5cqw' }}>{slide.title}</h2>}
          <div className="flex-1 min-h-0 flex items-center justify-center">
            {live ? (
              <>
                {slide.layout === 'video' && <VideoWidget slide={slide} />}
                {slide.layout === 'audio' && <AudioWidget slide={slide} color={t.accent} />}
                {slide.layout === 'timer' && <TimerWidget slide={slide} color={t.title} accent={t.accent} />}
                {slide.layout === 'picker' && <PickerWidget slide={slide} color={t.title} accent={t.accent} />}
              </>
            ) : slide.layout === 'video' && slide.video ? (
              <div className="relative w-full h-full" style={{ borderRadius: '1.2cqw', overflow: 'hidden' }}>
                <img src={`https://img.youtube.com/vi/${slide.video.youtubeId}/hqdefault.jpg`} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                <PlayCircle className="absolute inset-0 m-auto text-white drop-shadow-lg" style={{ width: '10cqw', height: '10cqw' }} />
              </div>
            ) : (
              <div className="flex flex-col items-center text-center" style={{ color: t.text, gap: '1.5cqw' }}>
                {React.createElement(INTERACTIVE[slide.layout as keyof typeof INTERACTIVE], { style: { width: '10cqw', height: '10cqw', color: t.accent } })}
                <span style={{ fontSize: '2.4cqw' }}>
                  {slide.layout === 'timer' && `${clockTime(slide.timerMinutes || 1)} timer`}
                  {slide.layout === 'audio' && (slide.audio?.title || 'Choose a track')}
                  {slide.layout === 'picker' && 'Name picker'}
                  {slide.layout === 'video' && 'Choose a video'}
                </span>
                <span style={{ fontSize: '1.4cqw', opacity: 0.6 }}>Works when presenting</span>
              </div>
            )}
          </div>
        </div>
      )}

      {credit && (
        <div className="absolute right-[1.2cqw] bottom-[1cqw]" style={{ fontSize: '1cqw', color: '#fff', background: 'rgba(0,0,0,0.45)', padding: '0.3cqw 0.8cqw', borderRadius: '0.5cqw' }}>
          {credit}
        </div>
      )}
      {number !== undefined && (
        <div className="absolute left-[1.5cqw] bottom-[1cqw]" style={{ fontSize: '1.2cqw', color: t.text, opacity: 0.6 }}>
          {number}
        </div>
      )}
    </div>
  );
};
