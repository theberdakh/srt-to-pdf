import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_NOTATION,
  NOTATION_STORAGE_KEY,
  loadNotation,
  normalizeNotation,
  saveNotation,
} from '../notation.js';

test('provides compact handwriting-friendly defaults', () => {
  assert.deepEqual(DEFAULT_NOTATION, {
    music: '#', applause: '$', laughter: ')', censored: '________',
  });
});

test('normalizes custom values, permits hidden signs, and limits their length', () => {
  const notation = normalizeNotation({ laughter: '$', music: '', censored: '____________' });
  assert.equal(notation.laughter, '$');
  assert.equal(notation.music, '');
  assert.equal(notation.censored, '________');
  assert.equal(notation.applause, DEFAULT_NOTATION.applause);
});

test('persists notation when storage is available and falls back safely', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  saveNotation(storage, { laughter: '#' });
  assert.equal(JSON.parse(values.get(NOTATION_STORAGE_KEY)).laughter, '#');
  assert.equal(loadNotation(storage).laughter, '#');
  assert.deepEqual(loadNotation({ getItem: () => '{broken' }), DEFAULT_NOTATION);
});
