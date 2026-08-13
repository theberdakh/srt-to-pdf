import test from 'node:test';
import assert from 'node:assert/strict';

import { layoutTranscript } from '../transcript-layout.js';

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

test('tracks internal line boundaries without visually indenting them', () => {
  const lines = layoutTranscript('first\nsecond').lines;
  assert.equal(lines[0].indent, false);
  assert.equal(lines[1].indent, true);
});
