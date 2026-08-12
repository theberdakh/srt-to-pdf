import test from 'node:test';
import assert from 'node:assert/strict';

import { approaches, transcript } from '../event-styles.js';

test('comparison study contains seven distinct treatments of one shared transcript', () => {
  assert.equal(approaches.length, 7);
  assert.equal(new Set(approaches.map(({ id }) => id)).size, 7);
  assert.deepEqual(
    approaches.map(({ id }) => id),
    ['inline', 'superscript', 'gutter', 'timeline', 'summary', 'proof', 'hybrid'],
  );
  assert.equal(transcript.length, 6);
});
