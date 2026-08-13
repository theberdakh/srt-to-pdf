import test from 'node:test';
import assert from 'node:assert/strict';

import {
  blockNumberBadgeWidth,
  createPdfDefinition,
  estimatePdfPageCount,
  paginateNotesForPdf,
  prepareTranscriptSegments,
  pdfFilename,
  resolveBrowserPdfFonts,
  splitTranscriptForPdf,
} from '../pdf-generator.js';
import { DEFAULT_NOTATION } from '../notation.js';

test('creates an A4 definition with red timestamps and quiet centered badges in the left gutter', () => {
  const definition = createPdfDefinition({
    title: 'A long editable title',
    notation: DEFAULT_NOTATION,
    blocks: [{ startMs: 62_000, endMs: 70_000, speaker: '', text: 'A setup [Laughter] The next thought.' }],
  });

  assert.equal(definition.pageSize, 'A4');
  assert.equal(definition.info.title, 'A long editable title');
  assert.match(JSON.stringify(definition.content[0]), /2 minutes/);
  assert.match(JSON.stringify(definition.content[0]), /1 laugh · 0.9 laughs\/min/);
  assert.equal(definition.content[0].stack.at(-1).columns.length, 3);
  assert.equal(typeof definition.header, 'function');
  assert.equal(typeof definition.footer, 'function');
  assert.equal(definition.header(1, 3), null);
  assert.match(JSON.stringify(definition.header(2, 3)), /A long editable title/);
  assert.equal(definition.header(2, 3).stack[0].alignment, 'center');
  assert.match(JSON.stringify(definition.footer(2, 3)), /2 \/ 3/);
  assert.equal(definition.content[2].pageBreak, 'after');
  assert.equal(definition.content.at(-1).unbreakable, true);
  assert.equal(definition.content.at(-1).margin[3], 7);
  assert.equal(definition.content.at(-1).table.widths.length, 2);
  assert.equal(definition.content.at(-1).layout.vLineWidth(2), 0);
  const gutter = definition.content.at(-1).table.body[0][0];
  assert.match(JSON.stringify(gutter.stack[0]), /01:02/);
  assert.equal(gutter.stack[0].color, '#ad322a');
  assert.equal(gutter.stack[0].fontSize, 6.4);
  assert.equal(gutter.stack[0].alignment, 'center');
  assert.match(gutter.stack[1].svg, />1<\/text>/);
  assert.match(gutter.stack[1].svg, /#67645c/);
  assert.equal(gutter.stack[1].alignment, 'center');
  const transcriptBackground = definition.background(2, { width: 595.28, height: 841.89 });
  assert.ok(transcriptBackground.canvas.length > 30);
  assert.equal(transcriptBackground.canvas[1].x1, transcriptBackground.canvas.at(-1).x1);
  assert.equal(definition.background(1, { width: 595.28, height: 841.89 }).canvas.length, 1);
  assert.equal(definition.defaultStyle.font, 'Roboto');
});

test('widens the block badge for two- and three-digit counts', () => {
  assert.ok(blockNumberBadgeWidth(12) > blockNumberBadgeWidth(1));
  assert.ok(blockNumberBadgeWidth(123) > blockNumberBadgeWidth(12));
});

test('prints computer-entered notes in quiet italic gray over the ruled half-page', () => {
  const definition = createPdfDefinition({
    title: 'Editable notes',
    notation: DEFAULT_NOTATION,
    notes: 'Topic: misplaced confidence\nFormula: ordinary setup -> sharp reversal',
    blocks: [{ startMs: 0, endMs: 8_000, text: 'Opening transcript line.' }],
  });

  const background = definition.background(2, { width: 595.28, height: 841.89 });
  assert.equal(background.stack.length, 2);
  assert.equal(background.stack[1].italics, true);
  assert.equal(background.stack[1].color, '#67645c');
  assert.match(JSON.stringify(background.stack[1]), /misplaced confidence/);
  assert.equal(definition.background(1, { width: 595.28, height: 841.89 }).canvas.length, 1);
});

test('paginates long computer notes without dropping intentional blank lines', () => {
  assert.deepEqual(paginateNotesForPdf('first\n\nsecond', 2, 48), ['first\n', 'second']);
  assert.equal(paginateNotesForPdf('one '.repeat(80), 4, 24).length > 1, true);
  assert.equal(estimatePdfPageCount([], Array.from({ length: 85 }, (_, index) => `note ${index}`).join('\n')), 4);
});

test('aligns a timestamp with the first transcript line below a speaker label', () => {
  const definition = createPdfDefinition({
    title: 'Speaker alignment',
    notation: DEFAULT_NOTATION,
    blocks: [{ startMs: 7_000, endMs: 10_000, speaker: 'Comedian', text: 'Opening transcript line.' }],
  });

  assert.equal(definition.content.at(-1).table.body[0][0].margin[1], 12.5);
});

test('carries transcript emphasis into PDF inline runs', () => {
  const definition = createPdfDefinition({
    title: 'Formatted transcript',
    notation: DEFAULT_NOTATION,
    blocks: [{
      startMs: 0,
      endMs: 10_000,
      text: 'Bold italic underlined red',
      formats: [
        { format: 'bold', start: 0, end: 4 },
        { format: 'italic', start: 5, end: 11 },
        { format: 'underline', start: 12, end: 22 },
        { format: 'highlight', start: 23, end: 26 },
      ],
    }],
  });
  const transcript = JSON.stringify(definition.content.at(-1).table.body[0][1]);
  assert.match(transcript, /"bold":true/);
  assert.match(transcript, /"italics":true/);
  assert.match(transcript, /"decoration":"underline"/);
  assert.match(transcript, /"color":"#ad322a"/);
});

test('splits unusually long blocks into PDF-safe worksheet segments', () => {
  const longTranscript = Array.from({ length: 70 }, (_, index) => `line ${index + 1}`).join('\n');
  const chunks = splitTranscriptForPdf(longTranscript, 12);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.flat().length, 70);
});

test('estimates pages from content height rather than elapsed minutes', () => {
  assert.equal(estimatePdfPageCount([{ startMs: 0, endMs: 40 * 60_000, text: 'One short line.' }]), 2);
  assert.equal(estimatePdfPageCount([{ startMs: 0, endMs: 119_000, text: 'Another short line.' }]), 2);
  assert.equal(estimatePdfPageCount([]), 1);
});

test('keeps natural transcript flow without elapsed-minute dividers', () => {
  const segments = prepareTranscriptSegments([
    { startMs: 0, endMs: 180_000, text: 'first\nsecond\nthird\nfourth' },
  ]);
  assert.equal(segments.length, 1);
  assert.equal(segments[0].lines.length, 4);
  assert.equal(segments[0].lines.some((line) => 'minuteMarkersBefore' in line), false);
});

test('balances unusually long continuations instead of leaving one orphan line', () => {
  const segments = prepareTranscriptSegments([{
    startMs: 0,
    endMs: 180_000,
    text: Array.from({ length: 58 }, (_, index) => `logical worksheet line ${index + 1}`).join('\n'),
  }]);

  assert.ok(segments.length > 1);
  assert.ok(segments.at(-1).lines.length >= 3);
});

test('does not add elapsed-minute content or forced transcript page breaks', () => {
  const definition = createPdfDefinition({
    title: 'Natural flow',
    notation: DEFAULT_NOTATION,
    blocks: [{ startMs: 0, endMs: 180_000, text: 'first\nsecond\nthird\nfourth' }],
  });

  assert.doesNotMatch(JSON.stringify(definition.content.slice(3)), /"pageBreak"/);
  assert.doesNotMatch(JSON.stringify(definition.content.slice(3)), /\d+ MIN/);
});

test('makes a filesystem-safe PDF filename from the edited title', () => {
  assert.equal(pdfFilename('  My / special: title?  '), 'My special title.pdf');
  assert.equal(pdfFilename('...'), 'subtitle-folio.pdf');
});

test('registers the PDF font as an absolute same-site URL for browser fetching', () => {
  const fonts = resolveBrowserPdfFonts('http://127.0.0.1:4173/tools/index.html');
  assert.equal(fonts.FolioLatin.normal, 'http://127.0.0.1:4173/tools/assets/source-serif-4-regular.ttf');
  assert.equal(fonts.FolioLatin.bold, 'http://127.0.0.1:4173/tools/assets/source-serif-4-bold.ttf');
  assert.equal(fonts.FolioLatin.italics, 'http://127.0.0.1:4173/tools/assets/source-serif-4-italic.ttf');
  assert.equal(fonts.FolioLatin.bolditalics, 'http://127.0.0.1:4173/tools/assets/source-serif-4-bold-italic.ttf');
  assert.equal(fonts.FolioCyrillic.normal, fonts.FolioLatin.normal);
});
