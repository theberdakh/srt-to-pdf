import assert from 'node:assert/strict';
import test from 'node:test';

import {
  approximateSplitTimestamp,
  EVENT_ANNOTATIONS,
  hasTrailingBlankLine,
  normalizeEditedTranscript,
} from '../transcript-edit.js';

test('uses one standard annotation for each manually added laugh', () => {
  assert.equal(EVENT_ANNOTATIONS.laughter, '[Laughter]');
});

test('normalizes browser-edited transcript whitespace without flattening thought breaks', () => {
  assert.equal(
    normalizeEditedTranscript('  First line \n\n\n  Second\u00a0line  '),
    'First line\n\nSecond line',
  );
});

test('recognizes an empty editor line as a direct block split', () => {
  assert.equal(hasTrailingBlankLine('Setup\n'), false);
  assert.equal(hasTrailingBlankLine('Setup\n\n'), true);
  assert.equal(hasTrailingBlankLine('Setup\n\n   '), true);
});

test('places a manual split proportionally inside the original time range', () => {
  assert.equal(approximateSplitTimestamp(1_000, 11_000, 25, 75), 3_500);
  assert.equal(approximateSplitTimestamp(1_000, 11_000, 0, 0), 6_000);
  assert.equal(approximateSplitTimestamp(1_000, 1_001, 5, 5), 1_000);
});
