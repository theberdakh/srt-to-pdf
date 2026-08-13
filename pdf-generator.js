import { formatTimestamp } from './srt.js?v=__BUILD_VERSION__';
import { layoutTranscript } from './transcript-layout.js?v=__BUILD_VERSION__';
import { calculateLaughStats, formatLaughStats } from './laugh-stats.js?v=__BUILD_VERSION__';
import { notationForEvent } from './notation.js?v=__BUILD_VERSION__';
import { pdfTitleFontSize } from './title-sizing.js?v=__BUILD_VERSION__';
import { formattedSegments, locateTranscriptRuns } from './text-formatting.js?v=__BUILD_VERSION__';

const POINTS_PER_MM = 72 / 25.4;
const STANDARD_PAGE_MARGIN = 18 * POINTS_PER_MM;
const PAGE_MARGIN = Object.freeze([6 * POINTS_PER_MM, 17 * POINTS_PER_MM, STANDARD_PAGE_MARGIN, 22 * POINTS_PER_MM]);
const COVER_INSET = STANDARD_PAGE_MARGIN - PAGE_MARGIN[0];
const BLOCK_GUTTER_WIDTH = COVER_INSET;
const TRANSCRIPT_FONT_SIZE = 8;
const TRANSCRIPT_LINE_HEIGHT = 1.2;
const MAX_TRANSCRIPT_LINE_UNITS_PER_PAGE = 40;
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const NOTES_START_X = A4_WIDTH / 2 + 9;
const NOTES_END_X = A4_WIDTH - STANDARD_PAGE_MARGIN;
const TRANSCRIPT_COLUMN_WIDTH = NOTES_START_X - 18 - PAGE_MARGIN[0] - BLOCK_GUTTER_WIDTH;
const NOTES_LINES_PER_PAGE = 40;
const NOTES_CHARACTERS_PER_LINE = 48;
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
  const sourceSerif = {
    normal: new URL('./assets/source-serif-4-regular.ttf', baseUrl).href,
    bold: new URL('./assets/source-serif-4-bold.ttf', baseUrl).href,
    italics: new URL('./assets/source-serif-4-italic.ttf', baseUrl).href,
    bolditalics: new URL('./assets/source-serif-4-bold-italic.ttf', baseUrl).href,
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

export function blockNumberBadgeWidth(value) {
  return Math.max(11, 6 + Array.from(String(value ?? '')).length * 4.2);
}

function blockNumberMark(value) {
  const characters = Array.from(String(value ?? ''));
  const width = blockNumberBadgeWidth(value);
  return {
    svg: `<svg width="${width}" height="11" viewBox="0 0 ${width} 11"><rect x="0.5" y="0.5" width="${width - 1}" height="10" rx="5" fill="none" stroke="${COLORS.muted}" stroke-width="0.7"/><text x="${width / 2}" y="7.5" text-anchor="middle" font-family="Roboto" font-size="5.4" font-weight="700" fill="${COLORS.muted}">${escapeXml(characters.join(''))}</text></svg>`,
    width,
    alignment: 'center',
    margin: [0, 3, 0, 0],
  };
}

function inlineTranscriptText(line, notation) {
  const inlines = [];
  const marks = [];

  line.runs.forEach((run) => {
    if (run.type === 'text') {
      const properties = {
        bold: run.formats?.includes('bold') || undefined,
        italics: run.formats?.includes('italic') || undefined,
        decoration: run.formats?.includes('underline') ? 'underline' : undefined,
        decorationStyle: run.formats?.includes('underline') ? 'solid' : undefined,
        color: run.formats?.includes('highlight') ? COLORS.accent : undefined,
      };
      inlines.push(...splitFolioRuns(run.value).map((inline) => ({ ...inline, ...properties })));
      return;
    }
    const sign = notationForEvent(notation, run.kind);
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
  const margin = [0, line.thoughtBreakBefore ? 3 : 0, 0, 0.35];
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
  return Math.max(1, Math.ceil(visibleCharacters / 58)) + (line.thoughtBreakBefore ? 0.3 : 0);
}

function compactTranscriptLines(lines) {
  const compacted = [];
  lines.forEach((sourceLine) => {
    const line = {
      ...sourceLine,
      runs: sourceLine.runs.map((run) => ({ ...run })),
    };
    const previous = compacted.at(-1);
    const previousHasPerformanceMark = previous?.runs.some((run) => run.type === 'event' && run.kind !== 'censored');
    const lineHasPerformanceMark = line.runs.some((run) => run.type === 'event' && run.kind !== 'censored');
    const combinedCharacters = previous
      ? previous.runs.concat(line.runs).reduce((total, run) => total + (run.type === 'text' ? run.value.trim().length : 3), 0)
      : Number.POSITIVE_INFINITY;
    const canMerge = previous &&
      !line.thoughtBreakBefore &&
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
    const sameFormatting = JSON.stringify(lastRun?.formats ?? []) === JSON.stringify(firstRun?.formats ?? []);
    if (lastRun?.type === 'text' && firstRun?.type === 'text' && sameFormatting) {
      lastRun.value = `${lastRun.value.trimEnd()} ${firstRun.value.trimStart()}`;
      previous.runs.push(...line.runs.slice(1));
    } else {
      previous.runs.push({ type: 'text', value: ' ', formats: [] }, ...line.runs);
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

  blocks.forEach((block, blockIndex) => {
    const layout = layoutTranscript(block.text);
    const locatedLines = locateTranscriptRuns(block.text, layout.lines).map((line) => ({
      ...line,
      runs: line.runs.flatMap((run) => (
        run.type === 'text'
          ? formattedSegments(run.value, run.sourceStart, block.formats).map((segment) => ({
            type: 'text',
            value: segment.value,
            formats: segment.formats,
          }))
          : run
      )),
    }));
    const lines = compactTranscriptLines(locatedLines);
    if (!lines.length) return;

    const chunks = splitLinesByUnits(lines, maxLineUnits);
    chunks.forEach((chunk, segmentIndex) => {
      prepared.push({
        block,
        blockIndex,
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
  return Math.ceil(units * lineHeight * 1.02 + (includeHeader ? 12 : 9));
}

function worksheetSegment(block, blockIndex, lines, notation, hasHours, segmentIndex, segmentCount) {
  const includeHeader = segmentIndex === 0;
  const naturalHeight = blockHeightPoints(block) / segmentCount;
  const height = Math.max(48, naturalHeight, estimatedChunkHeight(lines, includeHeader));
  const left = [];

  if (includeHeader) {
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
  lines.forEach((line) => left.push(transcriptLine(line, notation)));

  const blockNumber = includeHeader ? {
    ...blockNumberMark(blockIndex + 1),
  } : { text: '' };

  const timestamp = includeHeader ? {
    text: formatTimestamp(block.startMs, hasHours),
    alignment: 'center',
    color: COLORS.accent,
    font: 'Roboto',
    fontSize: 6.4,
    bold: true,
    noWrap: true,
    margin: [0, 0, 0, 0],
  } : { text: '' };

  const gutter = includeHeader ? {
    stack: [timestamp, blockNumber],
    margin: [0, block.speaker ? 12.5 : 2.1, 5, 0],
  } : { text: '' };

  return {
    unbreakable: true,
    margin: [0, 0, 0, segmentIndex === segmentCount - 1 ? 7 : 0],
    table: {
      dontBreakRows: true,
      widths: [BLOCK_GUTTER_WIDTH, TRANSCRIPT_COLUMN_WIDTH],
      heights: [height],
      body: [[gutter, { stack: left }]],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 8,
      paddingBottom: () => 8,
    },
  };
}

function coverLegendItem(kind, label, notation) {
  const sign = notationForEvent(notation, kind);
  const symbol = { ...(eventMark(sign) ?? { text: ' ', width: 13 }), margin: [0, 0, 0, 0] };
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
  ];
}

function coverLegendRow(notation) {
  return {
    columns: legend(notation).map((item) => ({ ...item, width: 'auto' })),
    columnGap: 13,
    margin: [0, 13, 0, 0],
  };
}

function coverRules(limit = 500) {
  const rules = [];
  for (let y = 12; y <= limit; y += 25.5) {
    rules.push({ type: 'line', x1: 0, y1: y, x2: 493, y2: y, lineWidth: 0.5, lineColor: COLORS.lineSoft });
  }
  return { canvas: rules, margin: [COVER_INSET, 15, 0, 0] };
}

function pageHeader(title, currentPage) {
  if (currentPage === 1) return null;
  const compactTitle = title.length > 110 ? `${title.slice(0, 107).trimEnd()}…` : title;
  return {
    margin: [STANDARD_PAGE_MARGIN, 18, STANDARD_PAGE_MARGIN, 0],
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
    margin: [STANDARD_PAGE_MARGIN, 17, STANDARD_PAGE_MARGIN, 0],
    alignment: 'center',
    color: COLORS.muted,
    font: 'Roboto',
    fontSize: 7,
  };
}

function wrapNoteLine(value, maxCharacters) {
  if (!value) return [''];
  const wrapped = [];
  let remainder = value;
  while (Array.from(remainder).length > maxCharacters) {
    const characters = Array.from(remainder);
    const candidate = characters.slice(0, maxCharacters + 1).join('');
    const breakAt = Math.max(candidate.lastIndexOf(' '), candidate.lastIndexOf('\t'));
    const splitAt = breakAt > Math.floor(maxCharacters * 0.45) ? breakAt : maxCharacters;
    wrapped.push(characters.slice(0, splitAt).join('').trimEnd());
    remainder = characters.slice(splitAt).join('').trimStart();
  }
  wrapped.push(remainder);
  return wrapped;
}

export function paginateNotesForPdf(
  notes,
  linesPerPage = NOTES_LINES_PER_PAGE,
  maxCharacters = NOTES_CHARACTERS_PER_LINE,
) {
  if (!Number.isFinite(linesPerPage) || linesPerPage <= 0) return [];
  if (!Number.isFinite(maxCharacters) || maxCharacters <= 0) return [];
  const source = String(notes ?? '').replace(/\r\n?/gu, '\n').replace(/\u00a0/gu, ' ').trimEnd();
  if (!source) return [];
  const lines = source.split('\n').flatMap((line) => wrapNoteLine(line, maxCharacters));
  const pages = [];
  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage).join('\n'));
  }
  return pages;
}

function pageBackground(currentPage, pageSize = { width: A4_WIDTH, height: A4_HEIGHT }, notePages = []) {
  const width = Number(pageSize.width) || A4_WIDTH;
  const height = Number(pageSize.height) || A4_HEIGHT;
  const canvas = [{ type: 'rect', x: 0, y: 0, w: width, h: height, color: COLORS.paper }];
  if (currentPage > 1) {
    for (let y = 62; y < height - 54; y += 18) {
      canvas.push({
        type: 'line',
        x1: NOTES_START_X,
        y1: y,
        x2: Math.min(NOTES_END_X, width - STANDARD_PAGE_MARGIN),
        y2: y,
        lineWidth: 0.45,
        lineColor: COLORS.lineSoft,
      });
    }
  }
  const pageNotes = currentPage > 1 ? notePages[currentPage - 2] : '';
  if (!pageNotes) return { canvas };
  return {
    stack: [
      { canvas },
      folioText(pageNotes, {
        absolutePosition: { x: NOTES_START_X + 3, y: 50 },
        width: NOTES_END_X - NOTES_START_X - 3,
        color: COLORS.muted,
        fontSize: 8.5,
        italics: true,
        lineHeight: 18 / 8.5,
      }),
    ],
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

export function estimatePdfPageCount(blocks, notes = '') {
  const notesPageCount = 1 + paginateNotesForPdf(notes).length;
  if (!Array.isArray(blocks) || !blocks.length) return Math.max(1, notesPageCount);
  const segments = prepareTranscriptSegments(blocks);
  if (!segments.length) return Math.max(1, notesPageCount);
  let pageCount = 2;
  let usedHeight = 0;

  segments.forEach(({ block, lines, segmentIndex, segmentCount }) => {
    const height = Math.max(
      48,
      blockHeightPoints(block) / segmentCount,
      estimatedChunkHeight(lines, segmentIndex === 0),
    ) + 16 + (segmentIndex === segmentCount - 1 ? 7 : 0);
    if (usedHeight > 0 && usedHeight + height > PRINTABLE_PAGE_HEIGHT) {
      pageCount += 1;
      usedHeight = 0;
    }
    usedHeight += height;
  });

  return Math.max(pageCount, notesPageCount);
}

export function createPdfDefinition({ title, blocks, notation, notes = '' }) {
  const safeTitle = String(title ?? '').trim() || 'Untitled transcript';
  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  const duration = safeBlocks.at(-1)?.endMs ?? 0;
  const hasHours = duration >= 3_600_000;
  const durationMinutes = Math.max(1, Math.ceil(duration / 60_000));
  const titleSize = pdfTitleFontSize(safeTitle);
  const coverRuleLimit = safeTitle.length > 150 ? 430 : safeTitle.length > 100 ? 465 : 500;
  const laughSummary = formatLaughStats(calculateLaughStats(safeBlocks));
  const notePages = paginateNotesForPdf(notes);
  const content = [
    {
      margin: [COVER_INSET, 0, 0, 0],
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
        {
          text: laughSummary,
          color: COLORS.accent,
          font: 'Roboto',
          fontSize: 7.5,
          bold: true,
          margin: [0, 4, 0, 0],
        },
        coverLegendRow(notation),
      ],
    },
    coverRules(coverRuleLimit),
    { text: '', pageBreak: 'after' },
  ];

  prepareTranscriptSegments(safeBlocks).forEach(({ block, blockIndex, lines, segmentIndex, segmentCount }) => {
    content.push(worksheetSegment(block, blockIndex, lines, notation, hasHours, segmentIndex, segmentCount));
  });

  const transcriptPageCount = estimatePdfPageCount(safeBlocks);
  const noteOnlyPages = Math.max(0, 1 + notePages.length - transcriptPageCount);
  for (let index = 0; index < noteOnlyPages; index += 1) {
    content.push({ text: ' ', pageBreak: 'before' });
  }

  return {
    pageSize: 'A4',
    pageMargins: PAGE_MARGIN,
    background: (currentPage, pageSize) => pageBackground(currentPage, pageSize, notePages),
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

export async function downloadWorksheetPdf({ pdfMake = globalThis.pdfMake, title, blocks, notation, notes = '' }) {
  if (!pdfMake?.createPdf || !pdfMake?.addFonts) {
    throw new Error('The PDF generator did not load. Refresh the page and try again.');
  }
  configureBrowserEngine(pdfMake);
  const filename = pdfFilename(title);
  await pdfMake.createPdf(createPdfDefinition({ title, blocks, notation, notes })).download(filename);
  return filename;
}
