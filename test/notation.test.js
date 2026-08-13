import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_NOTATION,
  CENSORED_MARK,
  NOTATION_STORAGE_KEY,
  isSafeShortcut,
  loadNotation,
  mappingForShortcut,
  notationForEvent,
  normalizeNotation,
  saveNotation,
  shortcutFromKeyboardEvent,
} from '../notation.js';

test('provides compact handwriting-friendly defaults', () => {
  assert.deepEqual(DEFAULT_NOTATION.mappings, [
    { event: 'music', pictogram: '#', shortcut: 'Alt+1' },
    { event: 'applause', pictogram: '$', shortcut: 'Alt+2' },
    { event: 'laughter', pictogram: ')', shortcut: 'Alt+3' },
  ]);
  assert.equal(notationForEvent(DEFAULT_NOTATION, 'censored'), CENSORED_MARK);
});

test('normalizes selectable pictograms and migrates legacy signs', () => {
  const notation = normalizeNotation({ laughter: '$', music: '♪', censored: '____________' });
  assert.equal(notationForEvent(notation, 'laughter'), '$');
  assert.equal(notationForEvent(notation, 'music'), '♪');
  assert.equal(notationForEvent(notation, 'censored'), '________');
  assert.equal(notationForEvent(normalizeNotation({ music: 'not in palette' }), 'music'), '#');
});

test('persists notation when storage is available and falls back safely', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const custom = normalizeNotation({
    mappings: [
      { event: 'music', pictogram: '♫', shortcut: 'Tab' },
      { event: 'applause', pictogram: 'A', shortcut: 'Alt+A' },
      { event: 'laughter', pictogram: '☺', shortcut: 'Alt+L' },
    ],
  });
  saveNotation(storage, custom);
  assert.equal(notationForEvent(JSON.parse(values.get(NOTATION_STORAGE_KEY)), 'music'), '♫');
  assert.equal(notationForEvent(loadNotation(storage), 'laughter'), '☺');
  assert.deepEqual(loadNotation({ getItem: () => '{broken' }), DEFAULT_NOTATION);
});

test('accepts only non-text shortcuts and resolves them to mappings', () => {
  assert.equal(shortcutFromKeyboardEvent({ key: '1', altKey: true }), 'Alt+1');
  assert.equal(shortcutFromKeyboardEvent({ key: 'Tab', shiftKey: true }), 'Shift+Tab');
  assert.equal(shortcutFromKeyboardEvent({ key: 'Shift', shiftKey: true }), '');
  assert.equal(isSafeShortcut('A'), false);
  assert.equal(isSafeShortcut('Shift+A'), false);
  assert.equal(isSafeShortcut('Alt+A'), true);
  assert.equal(isSafeShortcut('Tab'), true);
  assert.equal(mappingForShortcut(DEFAULT_NOTATION, 'Alt+3').event, 'laughter');
});
