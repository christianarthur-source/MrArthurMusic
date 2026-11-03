/**
 * Builds slide decks from a written brief (and optionally a lesson) in steps, so facts and
 * pictures are accurate:
 *   1. research   – the AI names the people/instruments/works involved; their Wikipedia
 *                   summaries become the deck's source facts
 *   2. outline    – a slide-by-slide plan the teacher reviews and edits
 *   3. write      – full slides from the approved outline, using only the source facts
 *   4. pictures   – real things get real photos (Wikipedia's image first), ideas and scenes get
 *                   AI illustrations in the deck's style
 * Claude writes when it's set up; otherwise the free model. Without any AI, a plain deck is made
 * straight from a lesson.
 */
import { DeckBrief, LessonPlan, PictureKind, Slide, SlideDeck, SlideLayout, SlideTheme } from '../types';
import { extractJson, writeWithAI } from './aiWriter';
import { firstPhoto, generateImage, keepImage, lookupWikipedia, WikiFact, wikiToImage } from './imageTools';

export const THEMES: { id: SlideTheme; name: string }[] = [
  { id: 'navy', name: 'Navy & Gold' },
  { id: 'chalkboard', name: 'Chalkboard' },
  { id: 'sunny', name: 'Sunny Classroom' },
  { id: 'paper', name: 'Paper' },
  { id: 'concert', name: 'Concert Hall' }
];

const CONTENT_LAYOUTS: SlideLayout[] = ['title', 'bullets', 'image-right', 'image-full', 'big-idea'];
const PICTURE_LAYOUTS: SlideLayout[] = ['title', 'image-right', 'image-full'];
/** AI pictures use part of the free daily allowance, so a deck draws at most this many. */
const MAX_AI_IMAGES = 8;

export const newSlideId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const newDeckId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const blankSlide = (layout: SlideLayout = 'bullets'): Slide => ({ id: newSlideId(), layout, title: '', bullets: [] });

export interface OutlineItem {
  id: string;
  title: string;
  purpose: string; // one line: what this slide does
  layout: SlideLayout;
  pictureKind: PictureKind;
  pictureIdea: string;
  subject?: string;
}

// ---------------------------------------------------------------------------
// Prompt pieces

function lessonText(lesson: LessonPlan): string {
  return [
    `Lesson: ${lesson.title} (Grade ${lesson.grade}, ${lesson.durationMinutes} minutes, unit: ${lesson.unit})`,
    `Overview: ${lesson.overview}`,
    lesson.objectives.length ? `Objectives: ${lesson.objectives.join('; ')}` : '',
    lesson.musicalConcepts.length ? `Concepts: ${lesson.musicalConcepts.join(', ')}` : '',
    'Activities:',
    ...lesson.activities.map((a, i) => `${i + 1}. ${a.title} (${a.durationMinutes} min): ${a.description}`)
  ]
    .filter(Boolean)
    .join('\n');
}

function briefText(brief: DeckBrief, lesson?: LessonPlan): string {
  return [
    `DECK REQUEST: ${brief.description}`,
    brief.grade ? `Audience: ${brief.grade === 'K' ? 'kindergarten' : `grade ${brief.grade}`} students` : 'Audience: elementary students',
    `Length: about ${brief.slideCount} slides`,
    `Tone: ${brief.tone}`,
    brief.mustInclude ? `MUST INCLUDE: ${brief.mustInclude}` : '',
    lesson ? `BASED ON THIS LESSON:\n${lessonText(lesson)}` : '',
    brief.sourceText ? `TEACHER'S OWN SOURCE MATERIAL (trust this):\n${brief.sourceText.slice(0, 6000)}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

const factsText = (facts: WikiFact[]) =>
  facts.length
    ? 'SOURCE FACTS (from Wikipedia; use these for any names, dates, numbers or claims):\n' +
      facts.map((f) => `### ${f.title}\n${f.extract}`).join('\n\n')
    : 'No outside sources were found: keep factual claims general and avoid specific dates, numbers or quotations.';

const ACCURACY_RULES = `Accuracy rules: Only state specific facts (names, dates, numbers, places, quotations) that appear in the SOURCE FACTS or the teacher's material. Never invent quotations. If a detail isn't in the sources, leave it out or keep it general.`;

const SLIDE_RULES = `The slides are projected for students, so on-slide text must be short and readable from the back of the room: titles under 8 words, at most 4 bullets of under 10 words each, vocabulary right for the audience. Teacher directions and extra details go in "notes".`;

const PICTURE_RULES = `For each slide choose "pictureKind":
- "photo" when the picture should show a specific real thing (a named instrument, composer, piece's performers, place, ensemble). Then also set "subject" to its exact Wikipedia article name, e.g. "Bassoon", "Camille Saint-Saëns".
- "illustration" for ideas, feelings, activities and scenes (e.g. "children marching to a steady beat").
- "none" when no picture is needed.
"pictureIdea" is a short concrete description of the picture.`;

// ---------------------------------------------------------------------------
// 1. Research

/** Finds Wikipedia summaries for the specific subjects the deck is about (up to 4). */
export async function research(brief: DeckBrief, lesson?: LessonPlan): Promise<WikiFact[]> {
  const { text } = await writeWithAI(
    'You find which specific, named subjects a classroom slide deck needs accurate facts about: people, musical instruments, musical works, ensembles, places, styles or historical events. Respond ONLY with a JSON array of up to 4 English Wikipedia article titles, most important first, or [] if the topic needs no outside facts.',
    briefText(brief, lesson),
    300
  );
  const subjects = extractJson<string[]>(text, 'array').filter((s) => typeof s === 'string' && s.trim()).slice(0, 4);
  const found = await Promise.all(subjects.map((s) => lookupWikipedia(s)));
  const unique = new Map<string, WikiFact>();
  found.forEach((f) => f && unique.set(f.title, f));
  return [...unique.values()];
}

// ---------------------------------------------------------------------------
// 2. Outline

export async function draftOutline(brief: DeckBrief, facts: WikiFact[], lesson?: LessonPlan): Promise<{ title: string; theme: SlideTheme; outline: OutlineItem[] }> {
  const { text } = await writeWithAI(
    `You plan classroom slide decks for an elementary (K-6) general music and chorus teacher.
${SLIDE_RULES}
${ACCURACY_RULES}
Layouts: "title" (first slide), "bullets", "image-right" (text beside a picture), "image-full" (big picture with a short caption), "big-idea" (one key sentence or question).
Theme options: navy, chalkboard, sunny, paper, concert.
${PICTURE_RULES}
Respond ONLY with JSON: {"title": "deck title", "theme": "navy", "outline": [{"title": "slide title", "purpose": "one line on what this slide teaches or does", "layout": "bullets", "pictureKind": "photo", "subject": "Bassoon", "pictureIdea": "a bassoon on a stand"}]}`,
    `${briefText(brief, lesson)}\n\n${factsText(facts)}\n\nPlan the deck now.`,
    2500
  );
  const raw = extractJson<any>(text);
  const outline: OutlineItem[] = (Array.isArray(raw.outline) ? raw.outline : [])
    .filter((o: any) => o?.title)
    .slice(0, 16)
    .map((o: any) => ({
      id: newSlideId(),
      title: String(o.title),
      purpose: String(o.purpose || ''),
      layout: CONTENT_LAYOUTS.includes(o.layout) ? o.layout : 'bullets',
      pictureKind: ['photo', 'illustration', 'none'].includes(o.pictureKind) ? o.pictureKind : 'none',
      pictureIdea: String(o.pictureIdea || ''),
      subject: o.subject ? String(o.subject) : undefined
    }));
  if (!outline.length) throw new Error('The AI did not plan any slides. Please try again.');
  return {
    title: String(raw.title || outline[0].title),
    theme: THEMES.some((t) => t.id === raw.theme) ? raw.theme : 'navy',
    outline
  };
}

// ---------------------------------------------------------------------------
// 3. Write

export async function writeSlides(brief: DeckBrief, facts: WikiFact[], outline: OutlineItem[], lesson?: LessonPlan): Promise<Slide[]> {
  const plan = outline
    .map((o, i) => `${i + 1}. [${o.layout}] ${o.title} — ${o.purpose}${o.pictureKind !== 'none' ? ` (picture: ${o.pictureKind}${o.subject ? `, subject "${o.subject}"` : ''}: ${o.pictureIdea})` : ''}`)
    .join('\n');
  const { text } = await writeWithAI(
    `You write classroom slides for an elementary (K-6) music teacher, following an approved outline exactly (same slides, same order, same layouts).
${SLIDE_RULES}
${ACCURACY_RULES}
Respond ONLY with JSON: {"slides": [{"title": "string", "subtitle": "string", "bullets": ["string"], "notes": "string"}]} with one entry per outline slide, in order.`,
    `${briefText(brief, lesson)}\n\n${factsText(facts)}\n\nAPPROVED OUTLINE:\n${plan}\n\nWrite the slides now.`,
    4000
  );
  const written: any[] = extractJson<any>(text).slides || [];
  return outline.map((o, i) => {
    const w = written[i] || {};
    return {
      id: o.id,
      layout: o.layout,
      title: String(w.title || o.title),
      subtitle: w.subtitle ? String(w.subtitle) : undefined,
      bullets: Array.isArray(w.bullets) ? w.bullets.map(String).filter(Boolean).slice(0, 6) : [],
      notes: w.notes ? String(w.notes) : o.purpose,
      pictureKind: o.pictureKind,
      imageIdea: o.pictureIdea || undefined,
      subject: o.subject
    };
  });
}

// ---------------------------------------------------------------------------
// 4. Pictures

/** One picture for a slide following the deck's picture choice, or undefined. */
async function pictureFor(slide: Slide, brief: DeckBrief, allowAi: boolean) {
  const idea = slide.imageIdea || slide.subject || slide.title;
  const realPhoto = async () => {
    if (slide.subject) {
      const wiki = await lookupWikipedia(slide.subject);
      const img = wiki && wikiToImage(wiki);
      if (img) return keepImage(img);
    }
    return (await firstPhoto(slide.subject || idea)) || undefined;
  };
  const drawn = async () => (allowAi ? generateImage(idea, true, brief.pictureStyle) : undefined);

  if (brief.pictureSource === 'photos') return realPhoto();
  if (brief.pictureSource === 'ai') return drawn();
  // auto: real things get photos, ideas and scenes get illustrations (photos if drawing fails)
  if (slide.pictureKind === 'photo') return (await realPhoto().catch(() => undefined)) || drawn();
  return (await drawn().catch(() => undefined)) || realPhoto();
}

export async function fillPictures(slides: Slide[], brief: DeckBrief, onProgress?: (message: string) => void): Promise<Slide[]> {
  if (brief.pictureSource === 'none') return slides;
  const wanting = slides.filter((s) => !s.image && s.pictureKind !== 'none' && PICTURE_LAYOUTS.includes(s.layout) && (s.imageIdea || s.subject));
  let aiUsed = 0;
  for (const [i, slide] of wanting.entries()) {
    onProgress?.(`Finding picture ${i + 1} of ${wanting.length}…`);
    try {
      const image = await pictureFor(slide, brief, aiUsed < MAX_AI_IMAGES);
      if (image) {
        slide.image = image;
        if (image.credit === 'AI illustration') aiUsed++;
      }
    } catch {
      // Leave this slide without a picture; it can be added later from the editor.
    }
  }
  return slides;
}

// ---------------------------------------------------------------------------
// Editing one slide

export const REWRITE_PRESETS = ['Simpler words', 'Add an example', 'Fewer words', 'Make it more fun', 'Turn it into a question for the class'];

/** Rewrites one slide's words, keeping its layout and picture. */
export async function rewriteSlide(deck: SlideDeck, slide: Slide, instruction: string): Promise<Partial<Slide>> {
  const facts = (await Promise.all((deck.sources || []).map((s) => lookupWikipedia(s.title)))).filter(Boolean) as WikiFact[];
  const { text } = await writeWithAI(
    `You revise one classroom slide for an elementary music teacher.
${SLIDE_RULES}
${ACCURACY_RULES}
Respond ONLY with JSON: {"title": "string", "subtitle": "string", "bullets": ["string"], "notes": "string"}`,
    [
      deck.brief ? briefText(deck.brief) : `Deck: ${deck.title}`,
      factsText(facts),
      `CURRENT SLIDE (layout ${slide.layout}):\n${JSON.stringify({ title: slide.title, subtitle: slide.subtitle, bullets: slide.bullets, notes: slide.notes })}`,
      `CHANGE REQUESTED: ${instruction}`
    ].join('\n\n'),
    1200
  );
  const w = extractJson<any>(text);
  return {
    title: String(w.title || slide.title),
    subtitle: w.subtitle ? String(w.subtitle) : undefined,
    bullets: Array.isArray(w.bullets) ? w.bullets.map(String).filter(Boolean).slice(0, 6) : slide.bullets,
    notes: w.notes ? String(w.notes) : slide.notes
  };
}

// ---------------------------------------------------------------------------
// Without AI

/** A simple deck made directly from a lesson, for when no AI is available. */
export function deckFromLesson(lesson: LessonPlan): Pick<SlideDeck, 'title' | 'theme' | 'slides'> {
  const slides: Slide[] = [
    { id: newSlideId(), layout: 'title', title: lesson.title, subtitle: `${lesson.grade === 'Chorus' ? 'Chorus' : `Grade ${lesson.grade}`} · ${lesson.unit}`, bullets: [], image: lesson.displayImage },
    lesson.objectives.length ? { id: newSlideId(), layout: 'bullets', title: 'Today we will…', bullets: lesson.objectives.slice(0, 4), notes: lesson.overview } : null,
    ...lesson.activities.map((a) => ({
      id: newSlideId(),
      layout: 'image-right' as SlideLayout,
      title: a.title,
      bullets: [a.musicalConcept].filter(Boolean),
      notes: `${a.durationMinutes} min. ${a.description}`,
      pictureKind: 'illustration' as PictureKind,
      imageIdea: `${a.title}, ${a.musicalConcept}`
    })),
    { id: newSlideId(), layout: 'big-idea', title: 'What did you learn about music today?', bullets: [], notes: lesson.assessmentStrategy }
  ].filter(Boolean) as Slide[];
  return { title: lesson.title, theme: 'navy', slides };
}
