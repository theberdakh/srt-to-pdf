import test from 'node:test';
import assert from 'node:assert/strict';

import { layoutTranscript, markElapsedMinutes } from '../transcript-layout.js';

test('keeps censorship inline but finishes a line after performance marks', () => {
  assert.deepEqual(layoutTranscript('That was [ __ ] useful. [Laughter] Next thought.'), {
    eventsOnly: false,
    lines: [
      {
        indent: false,
        thoughtBreakBefore: false,
        runs: [
          { type: 'text', value: 'That was ' },
          { type: 'event', kind: 'censored', label: '__' },
          { type: 'text', value: ' useful. ' },
          { type: 'event', kind: 'laughter', label: 'Laughter' },
        ],
      },
      {
        indent: true,
        thoughtBreakBefore: false,
        runs: [{ type: 'text', value: 'Next thought.' }],
      },
    ],
  });
});

test('preserves thought spacing independently of line indentation', () => {
  assert.deepEqual(layoutTranscript('First line.\n\nSecond thought.').lines, [
    {
      indent: false,
      thoughtBreakBefore: false,
      runs: [{ type: 'text', value: 'First line.' }],
    },
    {
      indent: false,
      thoughtBreakBefore: true,
      runs: [{ type: 'text', value: 'Second thought.' }],
    },
  ]);
});

test('identifies a compact events-only transcript', () => {
  assert.equal(layoutTranscript('[Music] [Applause]').eventsOnly, true);
});

test('marks each elapsed minute at the nearest following transcript line', () => {
  const source = layoutTranscript('first\nsecond\nthird\nfourth').lines;
  const marked = markElapsedMinutes(source, 0, 180_000);

  assert.deepEqual(marked.lines.map((line) => line.minuteMarkersBefore), [[], [1], [2], [3]]);
  assert.equal(marked.nextMinute, 4);
});

test('carries the next minute across separate worksheet blocks', () => {
  const first = markElapsedMinutes(layoutTranscript('first\nsecond').lines, 30_000, 75_000);
  const second = markElapsedMinutes(layoutTranscript('third').lines, 80_000, 125_000, first.nextMinute);

  assert.deepEqual(first.lines.map((line) => line.minuteMarkersBefore), [[], [1]]);
  assert.deepEqual(second.lines[0].minuteMarkersBefore, [2]);
});
