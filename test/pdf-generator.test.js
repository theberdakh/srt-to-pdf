import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPdfDefinition,
  estimatePdfPageCount,
  paginateTranscriptBlocks,
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

test('targets roughly two transcript minutes per PDF page plus the cover', () => {
  assert.equal(estimatePdfPageCount([{ endMs: 40 * 60_000 }]), 21);
  assert.equal(estimatePdfPageCount([{ endMs: 119_000 }]), 2);
  assert.equal(estimatePdfPageCount([]), 1);
});

test('assigns transcript lines to explicit two-minute page windows', () => {
  const pages = paginateTranscriptBlocks([
    { startMs: 0, endMs: 180_000, text: 'first\nsecond\nthird\nfourth' },
  ]);
  assert.equal(pages.length, 2);
  assert.match(JSON.stringify(pages), /first second third/);
  assert.match(JSON.stringify(pages), /fourth/);
  assert.equal(pages[0][0].segmentIndex, 0);
  assert.equal(pages[1][0].segmentIndex, 1);
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
