import test from 'node:test';
import assert from 'node:assert/strict';

import { pdfTitleFontSize, titleSizeFor } from '../title-sizing.js';

test('scales titles down at predictable cover-length thresholds', () => {
  assert.equal(titleSizeFor('A short title'), 'large');
  assert.equal(titleSizeFor('x'.repeat(61)), 'medium');
  assert.equal(titleSizeFor('x'.repeat(111)), 'compact');
});

test('uses the same title scale for the generated PDF', () => {
  assert.equal(pdfTitleFontSize('A short title'), 28);
  assert.equal(pdfTitleFontSize('x'.repeat(61)), 24);
  assert.equal(pdfTitleFontSize('x'.repeat(111)), 21);
});
