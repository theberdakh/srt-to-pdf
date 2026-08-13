import test from 'node:test';
import assert from 'node:assert/strict';

import { A4_CONTENT_HEIGHT_MM, countPdfPages } from '../pagination.js';

test('uses the printable A4 content height', () => {
  assert.equal(A4_CONTENT_HEIGHT_MM, 252);
});

test('includes the cover and packs worksheet blocks onto A4 pages', () => {
  assert.equal(countPdfPages([100, 100, 70]), 3);
});

test('moves a whole block to the next page when it does not fit', () => {
  assert.equal(countPdfPages([200, 70, 200]), 4);
});

test('ignores invalid measured heights and supports a document with only a cover', () => {
  assert.equal(countPdfPages([0, Number.NaN, -10]), 1);
});

test('handles content taller than one printable page', () => {
  assert.equal(countPdfPages([600]), 4);
});

test('rejects an invalid printable page height', () => {
  assert.throws(() => countPdfPages([20], 0), /positive number/i);
});
