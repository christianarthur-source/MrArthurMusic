import { Score } from '../types/music';

/**
 * Generates and downloads a multi-page, print-ready PDF file directly from the rendered score SVG.
 * Preserves a strict 1:1 aspect ratio (never squished or stretched) and works whether the
 * editor is currently in Vertical Page mode, Horizontal Scroll mode, or Full Screen mode.
 */
export async function exportScoreToPdf(score: Score, svgElement?: SVGSVGElement | null): Promise<void> {
  const targetSvg =
    svgElement || document.querySelector<SVGSVGElement>('#staff-composer-score-svg');
  if (!targetSvg) {
    window.print();
    return;
  }

  // Clone SVG and clean up any interactive editor highlights
  const clonedSvg = targetSvg.cloneNode(true) as SVGSVGElement;
  const svgWidth = parseFloat(clonedSvg.getAttribute('width') || '1178');
  const svgHeight = parseFloat(clonedSvg.getAttribute('height') || '300');
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clonedSvg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
  clonedSvg.setAttribute('width', String(svgWidth));
  clonedSvg.setAttribute('height', String(svgHeight));
  clonedSvg.style.width = `${svgWidth}px`;
  clonedSvg.style.height = `${svgHeight}px`;

  // Hide playhead cursor and interactive editor highlights in export
  const playhead = clonedSvg.querySelector('#staff-playhead-cursor-line');
  if (playhead) playhead.remove();
  clonedSvg.querySelectorAll('.score-ui-only').forEach((el) => el.remove());

  // Serialize SVG to a high-DPI image (2x scale for crisp notation)
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clonedSvg);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = (err) => reject(err);
    image.src = url;
  });

  try {
    // Render full SVG onto an offscreen source canvas at 2x resolution
    const scale = 2;
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = Math.round(svgWidth * scale);
    srcCanvas.height = Math.round(svgHeight * scale);
    const srcCtx = srcCanvas.getContext('2d')!;
    srcCtx.fillStyle = '#FFFFFF';
    srcCtx.fillRect(0, 0, srcCanvas.width, srcCanvas.height);
    srcCtx.drawImage(img, 0, 0, srcCanvas.width, srcCanvas.height);

    // PDF Page Setup: US Letter Landscape (792pt x 612pt) at 2x DPI (1584px x 1224px)
    const pdfPtWidth = 792;
    const pdfPtHeight = 612;
    const pageW = pdfPtWidth * scale; // 1584px
    const pageH = pdfPtHeight * scale; // 1224px
    const marginX = 44 * scale;
    const marginY = 38 * scale;
    const contentW = pageW - marginX * 2; // 1408px

    // System geometry matching ScoreRenderer.tsx
    const measureCount = Math.max(...score.tracks.map((t) => t.measures.length), 1);
    const trackCount = score.tracks.length;
    const MEASURES_PER_PDF_SYSTEM = 2;
    const MEASURE_WIDTH = 480;
    const HEADER_END_X = 112 + 90; // staffStartX (8 + 104 = 112) + HEADER_WIDTH (90) = 202
    const STANDARD_SYSTEM_SVG_WIDTH = HEADER_END_X + MEASURES_PER_PDF_SYSTEM * MEASURE_WIDTH + 30; // 1192
    const TRACK_SPACING = 150;
    const TOP_PADDING = 40;
    const SYSTEM_GAP = 55;
    const singleSystemHeight = trackCount * TRACK_SPACING + 20;
    const systemCount = Math.ceil(measureCount / MEASURES_PER_PDF_SYSTEM);

    // Detect if the source SVG was rendered in Horizontal Scroll mode (all measures on 1 row)
    const isHorizontalSource = svgWidth > STANDARD_SYSTEM_SVG_WIDTH + 50;

    // True 1:1 aspect ratio scale factor from 2x source canvas pixels to 2x PDF page pixels
    const standardSrcW = STANDARD_SYSTEM_SVG_WIDTH * scale;
    const aspectScale = contentW / standardSrcW; // ~0.5976 (same for both X and Y!)

    // Build normalized 2-bar system canvases so both Vertical and Horizontal modes export identically
    const systemCanvases: { canvas: HTMLCanvasElement; destW: number; destH: number }[] = [];

    for (let s = 0; s < systemCount; s++) {
      if (!isHorizontalSource) {
        // Vertical mode: each system is stacked vertically at index s
        const sysTop = Math.max(0, TOP_PADDING + s * (singleSystemHeight + SYSTEM_GAP) - 22);
        const sysBottom = Math.min(
          svgHeight,
          TOP_PADDING + s * (singleSystemHeight + SYSTEM_GAP) + singleSystemHeight + 28
        );
        const sysH = sysBottom - sysTop;
        const srcY = Math.round(sysTop * scale);
        const srcH = Math.round(sysH * scale);

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = srcCanvas.width;
        sliceCanvas.height = srcH;
        const sliceCtx = sliceCanvas.getContext('2d')!;
        sliceCtx.fillStyle = '#FFFFFF';
        sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        sliceCtx.drawImage(
          srcCanvas,
          0,
          srcY,
          srcCanvas.width,
          srcH,
          0,
          0,
          srcCanvas.width,
          srcH
        );

        const trueScale = contentW / sliceCanvas.width;
        systemCanvases.push({
          canvas: sliceCanvas,
          destW: contentW,
          destH: Math.round(srcH * trueScale),
        });
      } else {
        // Horizontal mode: all measures are on systemIndex 0 horizontally
        const sysTop = Math.max(0, TOP_PADDING - 22);
        const sysBottom = Math.min(svgHeight, TOP_PADDING + singleSystemHeight + 28);
        const sysH = sysBottom - sysTop;
        const srcY = Math.round(sysTop * scale);
        const srcH = Math.round(sysH * scale);

        const measuresInThisSystem = Math.min(
          MEASURES_PER_PDF_SYSTEM,
          measureCount - s * MEASURES_PER_PDF_SYSTEM
        );
        const sliceMeasuresW = measuresInThisSystem * MEASURE_WIDTH + 24;
        const headerW = HEADER_END_X * scale;
        const measuresSrcX = Math.round((HEADER_END_X + s * MEASURES_PER_PDF_SYSTEM * MEASURE_WIDTH) * scale);
        const measuresSrcW = Math.round(sliceMeasuresW * scale);

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = standardSrcW;
        sliceCanvas.height = srcH;
        const sliceCtx = sliceCanvas.getContext('2d')!;
        sliceCtx.fillStyle = '#FFFFFF';
        sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);

        // Draw left clef/key/time header
        sliceCtx.drawImage(srcCanvas, 0, srcY, headerW, srcH, 0, 0, headerW, srcH);
        // Draw the 2 measures for this system right after the header
        sliceCtx.drawImage(
          srcCanvas,
          measuresSrcX,
          srcY,
          measuresSrcW,
          srcH,
          headerW,
          0,
          measuresSrcW,
          srcH
        );

        systemCanvases.push({
          canvas: sliceCanvas,
          destW: contentW,
          destH: Math.round(srcH * aspectScale),
        });
      }
    }

    const pageJpegs: Uint8Array[] = [];

    const createBlankPage = () => {
      const c = document.createElement('canvas');
      c.width = pageW;
      c.height = pageH;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, pageW, pageH);
      return { canvas: c, ctx };
    };

    const drawHeader = (ctx: CanvasRenderingContext2D, isFirstPage: boolean): number => {
      let curY = marginY;
      if (isFirstPage) {
        ctx.fillStyle = '#0F172A';
        ctx.font = `bold ${26 * scale}px Georgia, "Times New Roman", serif`;
        ctx.textAlign = 'center';
        ctx.fillText(score.title || 'Untitled Composition', pageW / 2, curY + 24 * scale);
        curY += 38 * scale;

        ctx.fillStyle = '#334155';
        ctx.font = `600 ${11.5 * scale}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(
          `Tempo: ${score.tempo} BPM  ·  Meter: ${score.timeSignature[0]}/${score.timeSignature[1]}  ·  Key: ${score.keySignature} Major`,
          marginX,
          curY
        );
        ctx.textAlign = 'right';
        ctx.font = `italic 600 ${11.5 * scale}px Georgia, serif`;
        ctx.fillText(`Composed & Arranged by: ${score.composer || 'Student'}`, pageW - marginX, curY);
        curY += 10 * scale;

        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 1.8 * scale;
        ctx.beginPath();
        ctx.moveTo(marginX, curY);
        ctx.lineTo(pageW - marginX, curY);
        ctx.stroke();
        curY += 16 * scale;
      } else {
        ctx.fillStyle = '#64748B';
        ctx.font = `600 ${11 * scale}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(`${score.title || 'Untitled Composition'} (continued)`, marginX, curY + 12 * scale);
        curY += 26 * scale;
      }
      return curY;
    };

    const drawFooter = (ctx: CanvasRenderingContext2D, pageNum: number, totalPages: number) => {
      const footerY = pageH - marginY + 8 * scale;
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(marginX, footerY - 15 * scale);
      ctx.lineTo(pageW - marginX, footerY - 15 * scale);
      ctx.stroke();

      ctx.fillStyle = '#64748B';
      ctx.font = `500 ${10 * scale}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('Student Name: ___________________________', marginX, footerY);
      ctx.textAlign = 'center';
      ctx.fillText('Date: ________________', pageW / 2, footerY);
      ctx.textAlign = 'right';
      ctx.fillText(`Staff Composer  ·  Page ${pageNum} of ${totalPages}`, pageW - marginX, footerY);
    };

    // Paginate systems across pages so no system is ever clipped vertically
    const pagesSystems: typeof systemCanvases[] = [];
    let currentGroup: typeof systemCanvases = [];
    let currentY = marginY + 80 * scale;
    const maxBottomY = pageH - marginY - 28 * scale;

    systemCanvases.forEach((sys) => {
      if (currentGroup.length > 0 && currentY + sys.destH > maxBottomY) {
        pagesSystems.push(currentGroup);
        currentGroup = [sys];
        currentY = marginY + 30 * scale + sys.destH + 14 * scale;
      } else {
        currentGroup.push(sys);
        currentY += sys.destH + 14 * scale;
      }
    });
    if (currentGroup.length > 0) {
      pagesSystems.push(currentGroup);
    }

    const totalPages = Math.max(1, pagesSystems.length);

    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
      const { canvas, ctx } = createBlankPage();
      let drawY = drawHeader(ctx, pIdx === 0);

      const systems = pagesSystems[pIdx] || [];
      for (const sys of systems) {
        // If single system is taller than available page height (e.g., many tracks), scale down proportionally
        const availH = maxBottomY - drawY;
        let finalW = sys.destW;
        let finalH = sys.destH;
        if (finalH > availH && availH > 100) {
          const shrink = availH / finalH;
          finalW = Math.round(finalW * shrink);
          finalH = Math.round(finalH * shrink);
        }
        const drawX = marginX + Math.round((contentW - finalW) / 2);

        ctx.drawImage(
          sys.canvas,
          0,
          0,
          sys.canvas.width,
          sys.canvas.height,
          drawX,
          drawY,
          finalW,
          finalH
        );
        drawY += finalH + 14 * scale;
      }

      drawFooter(ctx, pIdx + 1, totalPages);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const base64 = dataUrl.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      pageJpegs.push(bytes);
    }

    // Build multi-page PDF 1.4 binary document
    const pdfBytes = buildPdfFromJpegs(pageJpegs, pdfPtWidth, pdfPtHeight, pageW, pageH);
    const pdfBlob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    const pdfUrl = URL.createObjectURL(pdfBlob);

    const safeTitle = (score.title || 'Untitled_Composition').replace(/[^a-zA-Z0-9_-]+/g, '_');
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `${safeTitle}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 5000);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function buildPdfFromJpegs(
  jpegs: Uint8Array[],
  ptWidth: number,
  ptHeight: number,
  pxWidth: number,
  pxHeight: number
): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0]; // 1-based object indexing
  let currentLength = 0;

  const pushStr = (str: string) => {
    const arr = encoder.encode(str);
    chunks.push(arr);
    currentLength += arr.length;
  };

  const pushBytes = (arr: Uint8Array) => {
    chunks.push(arr);
    currentLength += arr.length;
  };

  const startObj = (id: number) => {
    offsets[id] = currentLength;
    pushStr(`${id} 0 obj\n`);
  };

  const endObj = () => {
    pushStr(`\nendobj\n`);
  };

  pushStr(`%PDF-1.4\n%\xFF\xFF\xFF\xFF\n`);

  // Object 1: Catalog
  startObj(1);
  pushStr(`<< /Type /Catalog /Pages 2 0 R >>`);
  endObj();

  // Each page uses 3 objects: Page (3 + i*3), Content (4 + i*3), Image (5 + i*3)
  const pageCount = jpegs.length;
  const kidsRefs = jpegs.map((_, i) => `${3 + i * 3} 0 R`).join(' ');

  // Object 2: Pages
  startObj(2);
  pushStr(`<< /Type /Pages /Kids [ ${kidsRefs} ] /Count ${pageCount} >>`);
  endObj();

  jpegs.forEach((jpegBytes, i) => {
    const pageObjId = 3 + i * 3;
    const contentObjId = 4 + i * 3;
    const imgObjId = 5 + i * 3;

    // Page object
    startObj(pageObjId);
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptWidth} ${ptHeight}] /Resources << /XObject << /Im0 ${imgObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>`
    );
    endObj();

    // Content stream
    const contentStream = `q\n${ptWidth} 0 0 ${ptHeight} 0 0 cm\n/Im0 Do\nQ`;
    startObj(contentObjId);
    pushStr(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);
    endObj();

    // Image XObject
    startObj(imgObjId);
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${pxWidth} /Height ${pxHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
    );
    pushBytes(jpegBytes);
    pushStr(`\nendstream`);
    endObj();
  });

  const totalObjs = 2 + pageCount * 3;
  const xrefOffset = currentLength;
  pushStr(`xref\n0 ${totalObjs + 1}\n`);
  pushStr(`0000000000 65535 f \n`);
  for (let id = 1; id <= totalObjs; id++) {
    const off = String(offsets[id] || 0).padStart(10, '0');
    pushStr(`${off} 00000 n \n`);
  }

  pushStr(
    `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  const result = new Uint8Array(currentLength);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
}
