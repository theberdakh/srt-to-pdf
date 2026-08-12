import { formatTimestamp } from './srt.js?v=__BUILD_VERSION__';
import { layoutTranscript, markElapsedMinutes } from './transcript-layout.js?v=__BUILD_VERSION__';

const POINTS_PER_MM = 72 / 25.4;
const PAGE_MARGIN = Object.freeze([18 * POINTS_PER_MM, 17 * POINTS_PER_MM, 18 * POINTS_PER_MM, 22 * POINTS_PER_MM]);
const TRANSCRIPT_FONT_SIZE = 8;
const TRANSCRIPT_LINE_HEIGHT = 1.2;
const MAX_TRANSCRIPT_LINE_UNITS_PER_PAGE = 40;
const NOTES_COLUMN_WIDTH = 180;
const A4_HEIGHT = 841.89;
const PRINTABLE_PAGE_HEIGHT = A4_HEIGHT - PAGE_MARGIN[1] - PAGE_MARGIN[3];
const COLORS = Object.freeze({
  accent: '#ad322a',
  ink: '#171713',
  line: '#cfc8ba',
  lineSoft: '#e5dfd4',
  muted: '#67645c',
  paper: '#fffdfa',
});

export function resolveBrowserPdfFonts(baseUrl = globalThis.document?.baseURI) {
  if (!baseUrl) throw new Error('The page address is unavailable, so the PDF font could not be loaded.');
  const fontUrl = new URL('./assets/source-serif-4-variable.ttf', baseUrl).href;
  const sourceSerif = {
    normal: fontUrl,
    bold: fontUrl,
    italics: fontUrl,
    bolditalics: fontUrl,
  };
  return { FolioLatin: sourceSerif, FolioCyrillic: { ...sourceSerif } };
}

const configuredEngines = new WeakSet();
const CYRILLIC_CHARACTER = /[\u0400-\u052f\u2de0-\u2dff\ua640-\ua69f]/u;

function splitFolioRuns(value) {
  const runs = [];
  for (const character of String(value ?? '')) {
    const font = CYRILLIC_CHARACTER.test(character) ? 'FolioCyrillic' : 'FolioLatin';
    const previous = runs.at(-1);
    if (previous?.font === font) previous.text += character;
    else runs.push({ text: character, font });
  }
  return runs;
}

function folioText(value, properties = {}) {
  return { ...properties, text: splitFolioRuns(value) };
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function eventMark(sign, color = COLORS.muted) {
  const characters = Array.from(String(sign ?? ''));
  if (!characters.length) return null;
  const width = Math.max(13, 8 + characters.length * 5);
  return {
    svg: `<svg width="${width}" height="14" viewBox="0 0 ${width} 14"><rect x="0.7" y="0.7" width="${width - 1.4}" height="12.6" rx="6.3" fill="none" stroke="${color}" stroke-width="0.8"/><text x="${width / 2}" y="9.6" text-anchor="middle" font-family="Roboto" font-size="7.4" font-weight="500" fill="${color}">${escapeXml(characters.join(''))}</text></svg>`,
    width,
    margin: [1.5, 0.4, 0, 0],
  };
}

function inlineTranscriptText(line, notation) {
  const inlines = [];
  const marks = [];

  line.runs.forEach((run) => {
    if (run.type === 'text') {
      inlines.push(...splitFolioRuns(run.value));
      return;
    }
    const sign = notation[run.kind] ?? '';
    if (run.kind === 'censored') {
      if (sign) inlines.push({ text: sign, font: 'FolioLatin', color: COLORS.line, characterSpacing: -0.2 });
      return;
    }
    const mark = eventMark(sign);
    if (mark) marks.push(mark);
  });

  return { inlines, marks };
}

function transcriptLine(line, notation) {
  const { inlines, marks } = inlineTranscriptText(line, notation);
  const margin = [line.indent ? 11 : 0, line.thoughtBreakBefore ? 3 : 0, 0, 0.35];
  const text = {
    text: inlines.length ? inlines : ' ',
    width: 'auto',
    fontSize: TRANSCRIPT_FONT_SIZE,
    lineHeight: TRANSCRIPT_LINE_HEIGHT,
  };

  if (!marks.length) return { ...text, margin };

  return {
    columns: [text, ...marks],
    columnGap: 1,
    margin,
  };
}

function lineUnits(line) {
  const visibleCharacters = line.runs.reduce((total, run) => total + (
    run.type === 'text' ? run.value.trim().length : 3
  ), 0);
  const markerUnits = (line.minuteMarkersBefore?.length ?? 0) * 1.5;
  return Math.max(1, Math.ceil(visibleCharacters / 58)) + (line.thoughtBreakBefore ? 0.3 : 0) + markerUnits;
}

function compactTranscriptLines(lines) {
  const compacted = [];
  lines.forEach((sourceLine) => {
    const line = {
      ...sourceLine,
      runs: sourceLine.runs.map((run) => ({ ...run })),
      minuteMarkersBefore: [...(sourceLine.minuteMarkersBefore ?? [])],
    };
    const previous = compacted.at(-1);
    const previousHasPerformanceMark = previous?.runs.some((run) => run.type === 'event' && run.kind !== 'censored');
    const lineHasPerformanceMark = line.runs.some((run) => run.type === 'event' && run.kind !== 'censored');
    const combinedCharacters = previous
      ? previous.runs.concat(line.runs).reduce((total, run) => total + (run.type === 'text' ? run.value.trim().length : 3), 0)
      : Number.POSITIVE_INFINITY;
    const canMerge = previous &&
      !line.thoughtBreakBefore &&
      !line.minuteMarkersBefore.length &&
      !line.indent &&
      !previousHasPerformanceMark &&
      !lineHasPerformanceMark &&
      combinedCharacters <= 78;

    if (!canMerge) {
      compacted.push(line);
      return;
    }

    const firstRun = line.runs[0];
    const lastRun = previous.runs.at(-1);
    if (lastRun?.type === 'text' && firstRun?.type === 'text') {
      lastRun.value = `${lastRun.value.trimEnd()} ${firstRun.value.trimStart()}`;
      previous.runs.push(...line.runs.slice(1));
    } else {
      previous.runs.push({ type: 'text', value: ' ' }, ...line.runs);
    }
  });
  return compacted;
}

export function splitTranscriptForPdf(text, maxLineUnits = MAX_TRANSCRIPT_LINE_UNITS_PER_PAGE) {
  const { lines } = layoutTranscript(text);
  if (!lines.length) return [[]];
  const chunks = [];
  let chunk = [];
  let units = 0;

  lines.forEach((line) => {
    const nextUnits = lineUnits(line);
    if (chunk.length && units + nextUnits > maxLineUnits) {
      chunks.push(chunk);
      chunk = [];
      units = 0;
    }
    chunk.push(line);
    units += nextUnits;
  });
  if (chunk.length) chunks.push(chunk);
  return chunks;
}

function splitLinesByUnits(lines, maxLineUnits) {
  const chunks = [];
  let chunk = [];
  let units = 0;

  lines.forEach((line) => {
    const nextUnits = lineUnits(line);
    if (chunk.length && units + nextUnits > maxLineUnits) {
      chunks.push(chunk);
      chunk = [];
      units = 0;
    }
    chunk.push(line);
    units += nextUnits;
  });
  if (chunk.length) chunks.push(chunk);

  if (chunks.length > 1) {
    const minimumTrailingUnits = Math.min(8, maxLineUnits * 0.25);
    const previous = chunks.at(-2);
    const trailing = chunks.at(-1);
    let trailingUnits = trailing.reduce((total, line) => total + lineUnits(line), 0);

    while (trailingUnits < minimumTrailingUnits && previous.length > 1) {
      const movedLine = previous.pop();
      trailing.unshift(movedLine);
      trailingUnits += lineUnits(movedLine);
    }
  }

  return chunks;
}

export function prepareTranscriptSegments(blocks, maxLineUnits = MAX_TRANSCRIPT_LINE_UNITS_PER_PAGE) {
  if (!Array.isArray(blocks) || !Number.isFinite(maxLineUnits) || maxLineUnits <= 0) return [];
  const prepared = [];
  let nextMinute = 1;

  blocks.forEach((block) => {
    const marked = markElapsedMinutes(
      layoutTranscript(block.text).lines,
      block.startMs,
      block.endMs,
      nextMinute,
    );
    nextMinute = marked.nextMinute;
    const lines = compactTranscriptLines(marked.lines);
    if (!lines.length) return;

    const chunks = splitLinesByUnits(lines, maxLineUnits);
    chunks.forEach((chunk, segmentIndex) => {
      prepared.push({
        block,
        lines: chunk,
        segmentIndex,
        segmentCount: chunks.length,
      });
    });
  });

  return prepared;
}

function blockHeightPoints(block) {
  const durationSeconds = Math.max(1, (block.endMs - block.startMs) / 1000);
  const millimetres = Math.min(48, Math.round(16 + durationSeconds * 0.35));
  return millimetres * POINTS_PER_MM;
}

function estimatedChunkHeight(lines, includeHeader) {
  const units = lines.reduce((total, line) => total + lineUnits(line), 0);
  const lineHeight = TRANSCRIPT_FONT_SIZE * TRANSCRIPT_LINE_HEIGHT + 0.6;
  return Math.ceil(units * lineHeight * 1.02 + (includeHeader ? 26 : 9));
}

function writingRules(height) {
  const rules = [];
  const spacing = 15;
  for (let y = spacing; y < height - 7; y += spacing) {
    rules.push({ type: 'line', x1: 0, y1: y, x2: NOTES_COLUMN_WIDTH - 16, y2: y, lineWidth: 0.45, lineColor: COLORS.lineSoft });
  }
  return { canvas: rules };
}

function minuteDivider(minute) {
  const dividerRule = () => ({
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 68, y2: 0, lineWidth: 0.45, lineColor: COLORS.accent }],
    margin: [0, 4.2, 0, 0],
  });
  return {
    columns: [dividerRule(), {
      text: `${minute} MIN`,
      width: 'auto',
      color: COLORS.accent,
      font: 'Roboto',
      fontSize: 6.2,
      bold: true,
      characterSpacing: 0.55,
    }, dividerRule()],
    columnGap: 5,
    margin: [0, 5, 0, 4],
  };
}

function worksheetSegment(block, lines, notation, hasHours, segmentIndex, segmentCount) {
  const includeHeader = segmentIndex === 0;
  const naturalHeight = blockHeightPoints(block) / segmentCount;
  const height = Math.max(70, naturalHeight, estimatedChunkHeight(lines, includeHeader));
  const left = [];

  if (includeHeader) {
    left.push({
      text: formatTimestamp(block.startMs, hasHours),
      color: COLORS.accent,
      font: 'Roboto',
      fontSize: 6.8,
      bold: true,
      margin: [0, 0, 0, 6],
    });
    if (block.speaker) {
      left.push({
        text: String(block.speaker).toUpperCase(),
        color: COLORS.ink,
        font: 'Roboto',
        fontSize: 6.4,
        bold: true,
        characterSpacing: 0.45,
        margin: [0, 0, 0, 4],
      });
    }
  }
  lines.forEach((line) => {
    line.minuteMarkersBefore?.forEach((minute) => left.push(minuteDivider(minute)));
    left.push(transcriptLine(line, notation));
  });

  return {
    unbreakable: true,
    margin: [0, 0, 0, segmentIndex === segmentCount - 1 ? 7 : 0],
    table: {
      dontBreakRows: true,
      widths: ['*', NOTES_COLUMN_WIDTH],
      heights: [height],
      body: [[{ stack: left }, writingRules(height - 16)]],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: (index) => (index === 1 ? 0.55 : 0),
      vLineColor: () => COLORS.line,
      paddingLeft: (index) => (index === 0 ? 0 : 10),
      paddingRight: () => 0,
      paddingTop: () => 8,
      paddingBottom: () => 8,
    },
  };
}

function coverLegendItem(kind, label, notation) {
  const sign = notation[kind] ?? '';
  const symbol = kind === 'censored'
    ? { text: sign || ' ', font: 'FolioLatin', color: COLORS.line, fontSize: 7.5, width: 31 }
    : { ...(eventMark(sign) ?? { text: ' ', width: 13 }), margin: [0, 0, 0, 0] };
  return {
    columns: [symbol, { text: label, font: 'Roboto', fontSize: 6.8, color: COLORS.muted, margin: [4, 2.4, 0, 0] }],
    columnGap: 0,
    margin: [0, 0, 0, 5],
  };
}

function legend(notation) {
  return [
    coverLegendItem('music', 'music', notation),
    coverLegendItem('applause', 'applause', notation),
    coverLegendItem('laughter', 'laughter', notation),
    coverLegendItem('censored', 'censored', notation),
  ];
}

function coverRules(limit = 500) {
  const rules = [];
  for (let y = 12; y <= limit; y += 25.5) {
    rules.push({ type: 'line', x1: 0, y1: y, x2: 493, y2: y, lineWidth: 0.5, lineColor: COLORS.lineSoft });
  }
  return { canvas: rules, margin: [0, 15, 0, 0] };
}

function pageHeader(title, currentPage) {
  if (currentPage === 1) return null;
  const compactTitle = title.length > 110 ? `${title.slice(0, 107).trimEnd()}…` : title;
  return {
    margin: [PAGE_MARGIN[0], 18, PAGE_MARGIN[2], 0],
    stack: [
      folioText(compactTitle, {
        alignment: 'center',
        color: COLORS.muted,
        fontSize: 7.2,
        noWrap: true,
      }),
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 493, y2: 0, lineWidth: 0.45, lineColor: COLORS.line }],
        margin: [0, 5, 0, 0],
      },
    ],
  };
}

function pageFooter(currentPage, pageCount) {
  return {
    text: `${currentPage} / ${pageCount}`,
    margin: [PAGE_MARGIN[0], 17, PAGE_MARGIN[2], 0],
    alignment: 'center',
    color: COLORS.muted,
    font: 'Roboto',
    fontSize: 7,
  };
}

export function pdfFilename(title) {
  const safeTitle = String(title ?? '')
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .replace(/^\.+|\.+$/gu, '')
    .trim()
    .slice(0, 100);
  return `${safeTitle || 'subtitle-folio'}.pdf`;
}

export function estimatePdfPageCount(blocks) {
  if (!Array.isArray(blocks) || !blocks.length) return 1;
  const segments = prepareTranscriptSegments(blocks);
  if (!segments.length) return 1;
  let pageCount = 2;
  let usedHeight = 0;

  segments.forEach(({ block, lines, segmentIndex, segmentCount }) => {
    const height = Math.max(
      70,
      blockHeightPoints(block) / segmentCount,
      estimatedChunkHeight(lines, segmentIndex === 0),
    ) + 16 + (segmentIndex === segmentCount - 1 ? 7 : 0);
    if (usedHeight > 0 && usedHeight + height > PRINTABLE_PAGE_HEIGHT) {
      pageCount += 1;
      usedHeight = 0;
    }
    usedHeight += height;
  });

  return pageCount;
}

export function createPdfDefinition({ title, blocks, notation }) {
  const safeTitle = String(title ?? '').trim() || 'Untitled transcript';
  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  const duration = safeBlocks.at(-1)?.endMs ?? 0;
  const hasHours = duration >= 3_600_000;
  const durationMinutes = Math.max(1, Math.ceil(duration / 60_000));
  const titleSize = safeTitle.length > 120 ? 21 : safeTitle.length > 70 ? 24 : 28;
  const coverRuleLimit = safeTitle.length > 150 ? 430 : safeTitle.length > 100 ? 465 : 500;
  const content = [
    {
      columns: [
        {
          width: '*',
          margin: [0, 0, 24, 0],
          stack: [
            folioText(safeTitle, { fontSize: titleSize, lineHeight: 1.04, color: COLORS.ink }),
            {
              text: `${durationMinutes} ${durationMinutes === 1 ? 'minute' : 'minutes'}`,
              color: COLORS.accent,
              font: 'Roboto',
              fontSize: 7.5,
              bold: true,
              margin: [0, 9, 0, 0],
            },
          ],
        },
        { stack: legend(notation), width: 112, margin: [0, 2, 0, 0] },
      ],
      columnGap: 16,
    },
    coverRules(coverRuleLimit),
    { text: '', pageBreak: 'after' },
  ];

  prepareTranscriptSegments(safeBlocks).forEach(({ block, lines, segmentIndex, segmentCount }) => {
    content.push(worksheetSegment(block, lines, notation, hasHours, segmentIndex, segmentCount));
  });

  return {
    pageSize: 'A4',
    pageMargins: PAGE_MARGIN,
    background: () => ({
      canvas: [{ type: 'rect', x: 0, y: 0, w: 595.28, h: 841.89, color: COLORS.paper }],
    }),
    header: (currentPage) => pageHeader(safeTitle, currentPage),
    footer: (currentPage, pageCount) => pageFooter(currentPage, pageCount),
    info: {
      title: safeTitle,
      author: 'Subtitle Folio',
      subject: 'Pause-based transcript worksheet',
      creator: 'Subtitle Folio',
    },
    defaultStyle: {
      font: 'Roboto',
      color: COLORS.ink,
    },
    content,
  };
}

function configureBrowserEngine(pdfMake) {
  if (configuredEngines.has(pdfMake)) return;
  pdfMake.addFonts(resolveBrowserPdfFonts());
  configuredEngines.add(pdfMake);
}

export async function downloadWorksheetPdf({ pdfMake = globalThis.pdfMake, title, blocks, notation }) {
  if (!pdfMake?.createPdf || !pdfMake?.addFonts) {
    throw new Error('The PDF generator did not load. Refresh the page and try again.');
  }
  configureBrowserEngine(pdfMake);
  const filename = pdfFilename(title);
  await pdfMake.createPdf(createPdfDefinition({ title, blocks, notation })).download(filename);
  return filename;
}
