/**
 * Exports a deck as a PowerPoint file (.pptx), which also opens in Apple Keynote and imports into
 * Google Slides (Drive → New → File upload, then Open with Google Slides). Text stays editable;
 * themes, pictures, credits and speaker notes come along. Interactive slides become a clickable
 * YouTube thumbnail (video) or a labelled placeholder (audio, timer, name picker).
 */
import { Slide, SlideDeck, SlideTheme } from '../types';
import { clockTime, THEME_STYLES } from '../components/slides/SlideCanvas';
import { downloadImage } from './imageTools';

const W = 10;
const H = 5.625;

const hex = (css: string) => {
  const m = css.match(/#([0-9a-f]{6})/i);
  return m ? m[1].toUpperCase() : 'FFFFFF';
};
const fontFor = (theme: SlideTheme) => (/Newsreader|Georgia/.test(THEME_STYLES[theme].titleFont) ? 'Georgia' : 'Arial');

/** Draws a theme's background (gradients included) as an image, since PowerPoint can't use CSS. */
function themeBackground(theme: SlideTheme): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 900;
  const ctx = canvas.getContext('2d')!;
  const bg = THEME_STYLES[theme].background;
  const colors = bg.match(/#[0-9a-f]{6}/gi) || ['#ffffff'];
  if (colors.length === 1) {
    ctx.fillStyle = colors[0];
  } else if (bg.startsWith('radial')) {
    const atRight = /at 100%/.test(bg);
    const g = ctx.createRadialGradient(atRight ? 1600 : bg.includes('50%') ? 800 : 0, 0, 0, atRight ? 1600 : bg.includes('50%') ? 800 : 0, 0, 1700);
    g.addColorStop(0, colors[0]);
    g.addColorStop(0.65, colors[1]);
    g.addColorStop(1, colors[1]);
    ctx.fillStyle = g;
  } else {
    const g = ctx.createLinearGradient(0, 0, 1600, 900);
    g.addColorStop(0, colors[0]);
    g.addColorStop(1, colors[1]);
    ctx.fillStyle = g;
  }
  ctx.fillRect(0, 0, 1600, 900);
  return canvas.toDataURL('image/jpeg', 0.9); // a JPEG is a fraction of a PNG's size, and it's on every slide
}

const stripDataPrefix = (dataUrl: string) => dataUrl.replace(/^data:/, '');

async function imageData(src: string): Promise<string | null> {
  try {
    return stripDataPrefix(src.startsWith('data:') ? src : await downloadImage(src));
  } catch {
    return null;
  }
}

async function addSlide(pptx: any, slide: Slide, deck: SlideDeck, background: string) {
  const t = THEME_STYLES[deck.theme];
  const titleColor = hex(t.title);
  const textColor = hex(t.text);
  const accent = hex(t.accent);
  const fontFace = fontFor(deck.theme);
  const s = pptx.addSlide();
  s.background = { data: stripDataPrefix(background) };

  const img = slide.image ? await imageData(slide.image.src) : null;
  const shade = (y: number, h: number) =>
    s.addShape(pptx.ShapeType.rect, { x: 0, y, w: W, h, fill: { color: deck.theme === 'sunny' || deck.theme === 'paper' ? 'FFFFFF' : '000000', transparency: 35 }, line: { type: 'none' } });
  const accentBar = (x: number, y: number, w = 0.6) => s.addShape(pptx.ShapeType.rect, { x, y, w, h: 0.05, fill: { color: accent }, line: { type: 'none' } });
  const bullets = (x: number, y: number, w: number, h: number, size = 20) =>
    slide.bullets.length &&
    s.addText(
      slide.bullets.map((b) => ({ text: b, options: { bullet: { code: '25CF' }, color: textColor, breakLine: true } })),
      { x, y, w, h, fontSize: size, fontFace: 'Arial', color: textColor, valign: 'top', paraSpaceAfter: 8 }
    );
  const title = (text: string, opts: Record<string, unknown>) =>
    s.addText(text || ' ', { fontFace, bold: true, color: titleColor, fit: 'shrink', ...opts });

  switch (slide.layout) {
    case 'title':
      if (img) {
        s.addImage({ data: img, x: 0, y: 0, w: W, h: H, sizing: { type: 'cover', w: W, h: H } });
        shade(0, H);
      }
      accentBar(W / 2 - 0.4, 1.75, 0.8);
      title(slide.title, { x: 0.6, y: 1.9, w: W - 1.2, h: 1.4, fontSize: 40, align: 'center', valign: 'middle' });
      if (slide.subtitle) s.addText(slide.subtitle, { x: 0.6, y: 3.3, w: W - 1.2, h: 0.6, fontSize: 20, color: textColor, align: 'center', fontFace: 'Arial' });
      break;
    case 'image-full':
      if (img) s.addImage({ data: img, x: 0, y: 0, w: W, h: H, sizing: { type: 'cover', w: W, h: H } });
      shade(H * 0.62, H * 0.38);
      title(slide.title, { x: 0.6, y: H * 0.66, w: W - 1.2, h: 0.8, fontSize: 30 });
      if (slide.subtitle) s.addText(slide.subtitle, { x: 0.6, y: H * 0.66 + 0.8, w: W - 1.2, h: 0.5, fontSize: 16, color: textColor, fontFace: 'Arial' });
      break;
    case 'image-right':
      title(slide.title, { x: 0.6, y: 0.5, w: 5, h: 1.1, fontSize: 28, valign: 'top' });
      accentBar(0.6, 1.65);
      bullets(0.6, 1.85, 5, 3.3, 18);
      if (img) s.addImage({ data: img, x: 5.9, y: 0.55, w: 3.55, h: 4.5, sizing: { type: 'cover', w: 3.55, h: 4.5 }, rounding: false });
      break;
    case 'big-idea':
      s.addText('“', { x: 0, y: 0.7, w: W, h: 1, fontSize: 72, color: accent, align: 'center', fontFace: 'Georgia' });
      title(slide.title, { x: 0.9, y: 1.6, w: W - 1.8, h: 2.2, fontSize: 34, align: 'center', valign: 'middle' });
      if (slide.subtitle) s.addText(slide.subtitle, { x: 0.9, y: 3.9, w: W - 1.8, h: 0.6, fontSize: 18, color: textColor, align: 'center', fontFace: 'Arial' });
      break;
    case 'video': {
      title(slide.title || slide.video?.title || 'Video', { x: 0.6, y: 0.35, w: W - 1.2, h: 0.8, fontSize: 26 });
      if (slide.video) {
        const thumb = await imageData(`https://img.youtube.com/vi/${slide.video.youtubeId}/hqdefault.jpg`);
        const url = `https://www.youtube.com/watch?v=${slide.video.youtubeId}`;
        if (thumb) s.addImage({ data: thumb, x: 1.6, y: 1.25, w: 6.8, h: 3.6, sizing: { type: 'cover', w: 6.8, h: 3.6 }, hyperlink: { url } });
        s.addText(`▶  Watch on YouTube${slide.video.title && slide.video.title !== 'YouTube video' ? `: ${slide.video.title}` : ''}`, { x: 0.6, y: 4.95, w: W - 1.2, h: 0.4, fontSize: 14, color: accent, align: 'center', hyperlink: { url } });
      }
      break;
    }
    case 'timer':
      title(slide.title || 'Timer', { x: 0.6, y: 0.5, w: W - 1.2, h: 0.8, fontSize: 28, align: 'center' });
      s.addText(clockTime(slide.timerMinutes || 1), { x: 0, y: 1.6, w: W, h: 2.4, fontSize: 110, bold: true, color: titleColor, align: 'center', fontFace: 'Courier New' });
      break;
    case 'audio':
    case 'picker':
      title(slide.title || (slide.layout === 'audio' ? 'Listen' : 'Name picker'), { x: 0.6, y: 0.5, w: W - 1.2, h: 0.8, fontSize: 28, align: 'center' });
      s.addText(slide.layout === 'audio' ? `♪  ${slide.audio?.title || 'Audio'} (plays from the Music Teacher Hub)` : 'Random name picker (works in the Music Teacher Hub)', {
        x: 0.6, y: 2.4, w: W - 1.2, h: 0.8, fontSize: 22, color: textColor, align: 'center', fontFace: 'Arial'
      });
      break;
    default:
      title(slide.title, { x: 0.7, y: 0.5, w: W - 1.4, h: 0.9, fontSize: 32 });
      accentBar(0.7, 1.45);
      bullets(0.7, 1.7, W - 1.4, 3.6, 22);
  }

  const credit = slide.image?.credit && slide.image.credit !== 'AI illustration' ? slide.image.credit : '';
  if (credit) {
    s.addText(credit, { x: W - 4.6, y: H - 0.35, w: 4.4, h: 0.25, fontSize: 8, color: 'FFFFFF', align: 'right', fill: { color: '000000', transparency: 50 }, hyperlink: slide.image?.creditUrl ? { url: slide.image.creditUrl } : undefined });
  }
  const notes = [slide.notes, slide.image?.creditUrl ? `Picture source: ${slide.image.creditUrl}` : ''].filter(Boolean).join('\n\n');
  if (notes) s.addNotes(notes);
}

export async function exportDeckToPptx(deck: SlideDeck, onProgress?: (message: string) => void): Promise<void> {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = deck.title;
  pptx.author = 'Music Teacher Hub';
  const background = themeBackground(deck.theme);

  for (const [i, slide] of deck.slides.entries()) {
    onProgress?.(`Preparing slide ${i + 1} of ${deck.slides.length}…`);
    await addSlide(pptx, slide, deck, background);
  }
  if (deck.sources?.length) {
    const s = pptx.addSlide();
    s.background = { data: stripDataPrefix(background) };
    s.addText('Sources', { x: 0.7, y: 0.5, w: 8.6, h: 0.8, fontSize: 28, bold: true, color: hex(THEME_STYLES[deck.theme].title), fontFace: fontFor(deck.theme) });
    s.addText(
      deck.sources.map((src) => ({ text: `${src.title} (Wikipedia)`, options: { hyperlink: { url: src.url }, breakLine: true, bullet: true } })),
      { x: 0.7, y: 1.5, w: 8.6, h: 3.5, fontSize: 16, color: hex(THEME_STYLES[deck.theme].text), valign: 'top' }
    );
  }
  const fileName = `${deck.title.replace(/[^\w\s-]/g, '').trim() || 'Slides'}.pptx`;
  await pptx.writeFile({ fileName });
}
