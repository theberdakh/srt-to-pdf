import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateLaughStats, formatLaughStats } from '../laugh-stats.js';

test('counts imported and manually inserted laughter events', () => {
  const stats = calculateLaughStats([
    { startMs: 0, endMs: 60_000, text: 'Setup. [Laughter] Next line.' },
    { startMs: 62_000, endMs: 120_000, text: '[Laughter] Another one. [Applause]' },
  ]);

  assert.deepEqual(stats, { total: 2, perMinute: 1, durationMs: 120_000 });
  assert.equal(formatLaughStats(stats), '2 laughs · 1.0 laughs/min');
});

test('formats empty and singular laugh summaries safely', () => {
  assert.equal(formatLaughStats(calculateLaughStats([])), '0 laughs · 0.0 laughs/min');
  assert.equal(formatLaughStats({ total: 1, perMinute: 0.75 }), '1 laugh · 0.8 laughs/min');
});
