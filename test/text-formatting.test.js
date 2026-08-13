import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formattedSegments,
  locateTranscriptRuns,
  mergeFormattedTranscripts,
  normalizeFormattedTranscript,
} from '../text-formatting.js';

test('normalizes formatted transcript text without losing active ranges', () => {
  assert.deepEqual(normalizeFormattedTranscript('  First  \n\n\n Second ', [
    { format: 'bold', start: 2, end: 7 },
    { format: 'highlight', start: 13, end: 19 },
  ]), {
    text: 'First\n\nSecond',
    formats: [
      { format: 'bold', start: 0, end: 5 },
      { format: 'highlight', start: 7, end: 13 },
    ],
  });
});

test('merges two rich blocks and shifts the second block ranges', () => {
  assert.deepEqual(mergeFormattedTranscripts(
    { text: 'Setup', formats: [{ format: 'italic', start: 0, end: 5 }] },
    { text: 'Punchline', formats: [{ format: 'underline', start: 0, end: 9 }] },
  ), {
    text: 'Setup\nPunchline',
    formats: [
      { format: 'italic', start: 0, end: 5 },
      { format: 'underline', start: 6, end: 15 },
    ],
  });
});

test('locates visible transcript runs around notation events', () => {
  const source = 'Setup [Laughter] Punchline';
  const lines = [{ runs: [
    { type: 'text', value: 'Setup ' },
    { type: 'event', kind: 'laughter', label: 'Laughter' },
    { type: 'text', value: ' Punchline' },
  ] }];
  const located = locateTranscriptRuns(source, lines)[0].runs;
  assert.deepEqual(located.map(({ sourceStart, sourceEnd }) => [sourceStart, sourceEnd]), [[0, 6], [6, 16], [16, 26]]);
});

test('splits a text run at every formatting boundary', () => {
  assert.deepEqual(formattedSegments('abcdef', 10, [
    { format: 'bold', start: 11, end: 14 },
    { format: 'underline', start: 13, end: 15 },
  ]), [
    { value: 'a', formats: [] },
    { value: 'bc', formats: ['bold'] },
    { value: 'd', formats: ['bold', 'underline'] },
    { value: 'e', formats: ['underline'] },
    { value: 'f', formats: [] },
  ]);
});
