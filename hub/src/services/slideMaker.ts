/**
 * Drafts a slide deck from a lesson or a topic with the free AI (Gemma on Cloudflare), then
 * fills in pictures: AI drawings, openly licensed photos, or none. Without the AI (offline or
 * switched off), a plain deck is built straight from the lesson's own content.
 */
import { LessonPlan, Slide, SlideDeck, SlideLayout, SlideTheme } from '../types';
import { cloudSync } from './cloudSync';
import { firstPhoto, generateImage } from './imageTools';

export type ImageSource = 'ai' | 'photos' | 'none';

export const THEMES: { id: SlideTheme; name: string }[] = [
  { id: 'navy', name: 'Navy & Gold' },
  { id: 'chalkboard', name: 'Chalkboard' },
  { id: 'sunny', name: 'Sunny Classroom' },
  { id: 'paper', name: 'Paper' },
  { id: 'concert', name: 'Concert Hall' }
];

const LAYOUTS: SlideLayout[] = ['title', 'bullets', 'image-right', 'image-full', 'big-idea'];
/** AI pictures cost part of the daily free allowance, so a deck draws at most this many. */
const MAX_AI_IMAGES = 6;

export const newSlideId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const newDeckId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const blankSlide = (layout: SlideLayout = 'bullets'): Slide => ({ id: newSlideId(), layout, title: '', bullets: [] });

function lessonText(lesson: LessonPlan): string {
  return [
    `Lesson: ${lesson.title} (Grade ${lesson.grade}, ${lesson.durationMinutes} minutes, unit: ${lesson.unit})`,
    `Overview: ${lesson.overview}`,
    lesson.objectives.length ? `Objectives: ${lesson.objectives.join('; ')}` : '',
    lesson.musicalConcepts.length ? `Concepts: ${lesson.musicalConcepts.join(', ')}` : '',
    lesson.materialsNeeded.length ? `Materials: ${lesson.materialsNeeded.join(', ')}` : '',
    'Activities:',
    ...lesson.activities.map((a, i) => `${i + 1}. ${a.title} (${a.durationMinutes} min): ${a.description}`),
    lesson.assessmentStrategy ? `Assessment: ${lesson.assessmentStrategy}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

const SYSTEM = `You design classroom slide decks for an elementary (K-6) general music and chorus teacher.
The slides are projected for students, so on-slide text must be short, friendly and readable from the back of the room: titles under 8 words, at most 4 bullets of under 10 words each. Put teacher directions in "notes", never on the slide.
Choose a theme from: navy, chalkboard, sunny, paper, concert.
Use layouts: "title" (first slide), "bullets", "image-right" (text beside a picture), "image-full" (a big picture with a short caption title), "big-idea" (one key sentence or question as the title).
For slides that would benefit from a picture, set "imageIdea" to a short concrete description of a picture (e.g. "children tapping rhythm sticks in a circle"); otherwise leave it empty.
Respond ONLY with JSON in this shape (no code fences, no other text):
{"title": "string", "theme": "navy", "slides": [{"layout": "title", "title": "string", "subtitle": "string", "bullets": ["string"], "notes": "string", "imageIdea": "string"}]}`;

function parseDeck(text: string): Pick<SlideDeck, 'title' | 'theme' | 'slides'> {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('The AI reply did not contain slides. Please try again.');
  let raw: any;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error('The AI reply was not a complete deck. Please try again.');
  }
  const slides: Slide[] = (Array.isArray(raw.slides) ? raw.slides : [])
    .filter((s: any) => s && (s.title || (Array.isArray(s.bullets) && s.bullets.length)))
    .slice(0, 14)
    .map((s: any) => ({
      id: newSlideId(),
      layout: LAYOUTS.includes(s.layout) ? s.layout : 'bullets',
      title: String(s.title || ''),
      subtitle: s.subtitle ? String(s.subtitle) : undefined,
      bullets: Array.isArray(s.bullets) ? s.bullets.map(String).filter(Boolean).slice(0, 6) : [],
      notes: s.notes ? String(s.notes) : undefined,
      imageIdea: s.imageIdea ? String(s.imageIdea) : undefined
    }));
  if (!slides.length) throw new Error('The AI did not produce any slides. Please try again.');
  return {
    title: String(raw.title || slides[0].title || 'New deck'),
    theme: THEMES.some((t) => t.id === raw.theme) ? raw.theme : 'navy',
    slides
  };
}

/** A simple deck made directly from the lesson, for when the AI isn't available. */
export function deckFromLesson(lesson: LessonPlan): Pick<SlideDeck, 'title' | 'theme' | 'slides'> {
  const slides: Slide[] = [
    { id: newSlideId(), layout: 'title', title: lesson.title, subtitle: `${lesson.grade === 'Chorus' ? 'Chorus' : `Grade ${lesson.grade}`} · ${lesson.unit}`, bullets: [], image: lesson.displayImage },
    lesson.objectives.length
      ? { id: newSlideId(), layout: 'bullets', title: 'Today we will…', bullets: lesson.objectives.slice(0, 4), notes: lesson.overview }
      : null,
    ...lesson.activities.map((a) => ({
      id: newSlideId(),
      layout: 'image-right' as SlideLayout,
      title: a.title,
      bullets: [a.musicalConcept].filter(Boolean),
      notes: `${a.durationMinutes} min. ${a.description}`,
      imageIdea: `${a.title}, ${a.musicalConcept}`
    })),
    { id: newSlideId(), layout: 'big-idea', title: 'What did you learn about music today?', bullets: [], notes: lesson.assessmentStrategy }
  ].filter(Boolean) as Slide[];
  return { title: lesson.title, theme: 'navy', slides };
}

export interface DraftOptions {
  lesson?: LessonPlan;
  topic?: string;
  grade?: string;
  imageSource: ImageSource;
  onProgress?: (message: string) => void;
}

/** Writes a deck with the free AI, then adds pictures. Returns the finished (unsaved) deck. */
export async function draftDeck({ lesson, topic, grade, imageSource, onProgress }: DraftOptions): Promise<SlideDeck> {
  onProgress?.('Writing your slides…');
  const brief = lesson
    ? `Make a 6 to 9 slide deck to teach this lesson:\n${lessonText(lesson)}`
    : `Make a 6 to 9 slide deck for an elementary music class about: ${topic}${grade ? ` (grade ${grade})` : ''}.`;

  let draft: Pick<SlideDeck, 'title' | 'theme' | 'slides'>;
  try {
    const res = await cloudSync.hubFetch('/api/hub/free-ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ system: SYSTEM, prompt: brief })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.text) throw new Error(data?.error || `Free AI request failed (${res.status})`);
    draft = parseDeck(data.text);
  } catch (err) {
    if (!lesson) throw err;
    onProgress?.('The AI is unavailable, so building slides straight from the lesson…');
    draft = deckFromLesson(lesson);
  }

  const slides = [...draft.slides];
  if (imageSource !== 'none') {
    let drawn = 0;
    const wanting = slides.filter((s) => !s.image && s.imageIdea && s.layout !== 'bullets' && s.layout !== 'big-idea');
    for (const [i, slide] of wanting.entries()) {
      if (imageSource === 'ai' && drawn >= MAX_AI_IMAGES) break;
      onProgress?.(`${imageSource === 'ai' ? 'Drawing' : 'Finding'} picture ${i + 1} of ${imageSource === 'ai' ? Math.min(wanting.length, MAX_AI_IMAGES) : wanting.length}…`);
      try {
        slide.image = imageSource === 'ai' ? await generateImage(slide.imageIdea!) : (await firstPhoto(slide.imageIdea!)) || undefined;
        if (imageSource === 'ai') drawn++;
      } catch (err: any) {
        // Keep going without this picture; stop drawing if the daily allowance ran out.
        if (/allowance/i.test(err?.message || '')) break;
      }
    }
  }

  const now = new Date().toISOString();
  return { id: newDeckId(), title: draft.title, theme: draft.theme, lessonId: lesson?.id, slides, createdAt: now, updatedAt: now };
}
