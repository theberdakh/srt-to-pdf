import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPdfDefinition,
  estimatePdfPageCount,
  prepareTranscriptSegments,
  pdfFilename,
  resolveBrowserPdfFonts,
  splitTranscriptForPdf,
} from '../pdf-generator.js';
import { DEFAULT_NOTATION } from '../notation.js';

test('creates an A4 definition with a cover, transcript headers, and page numbering', () => {
  const definition = createPdfDefinition({
    title: 'A long editable title',
    notation: DEFAULT_NOTATION,
    blocks: [{ startMs: 62_000, endMs: 70_000, speaker: '', text: 'A setup [Laughter] The next thought.' }],
  });

  assert.equal(definition.pageSize, 'A4');
  assert.equal(definition.info.title, 'A long editable title');
  assert.match(JSON.stringify(definition.content[0]), /2 minutes/);
  assert.equal(typeof definition.header, 'function');
  assert.equal(typeof definition.footer, 'function');
  assert.equal(definition.header(1, 3), null);
  assert.match(JSON.stringify(definition.header(2, 3)), /A long editable title/);
  assert.equal(definition.header(2, 3).stack[0].alignment, 'center');
  assert.match(JSON.stringify(definition.footer(2, 3)), /2 \/ 3/);
  assert.equal(definition.content[2].pageBreak, 'after');
  assert.equal(definition.content.at(-1).unbreakable, true);
  assert.equal(definition.content.at(-1).margin[3], 7);
  assert.equal(definition.defaultStyle.font, 'Roboto');
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

test('keeps natural transcript flow and adds elapsed-minute markers', () => {
  const segments = prepareTranscriptSegments([
    { startMs: 0, endMs: 180_000, text: 'first\nsecond\nthird\nfourth' },
  ]);
  assert.equal(segments.length, 1);
  assert.deepEqual(
    segments[0].lines.map((line) => line.minuteMarkersBefore),
    [[], [1], [2], [3]],
  );
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

test('does not force transcript page breaks for elapsed time', () => {
  const definition = createPdfDefinition({
    title: 'Natural flow',
    notation: DEFAULT_NOTATION,
    blocks: [{ startMs: 0, endMs: 180_000, text: 'first\nsecond\nthird\nfourth' }],
  });

  assert.doesNotMatch(JSON.stringify(definition.content.slice(3)), /"pageBreak"/);
  assert.match(JSON.stringify(definition.content.slice(3)), /1 MIN/);
  assert.match(JSON.stringify(definition.content.slice(3)), /2 MIN/);
  assert.match(JSON.stringify(definition.content.slice(3)), /3 MIN/);
});

test('makes a filesystem-safe PDF filename from the edited title', () => {
  assert.equal(pdfFilename('  My / special: title?  '), 'My special title.pdf');
  assert.equal(pdfFilename('...'), 'subtitle-folio.pdf');
});

test('registers the PDF font as an absolute same-site URL for browser fetching', () => {
  const fonts = resolveBrowserPdfFonts('http://127.0.0.1:4173/tools/index.html');
  assert.equal(fonts.FolioLatin.normal, 'http://127.0.0.1:4173/tools/assets/source-serif-4-variable.ttf');
  assert.equal(fonts.FolioCyrillic.normal, fonts.FolioLatin.normal);
});
