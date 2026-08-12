import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyAudioEvent,
  eventEndsTranscriptLine,
  isKnownAudioEvent,
  tokenizeTranscript,
} from '../audio-events.js';

test('classifies common caption annotations', () => {
  assert.equal(classifyAudioEvent('Music'), 'music');
  assert.equal(classifyAudioEvent('Audience applause'), 'applause');
  assert.equal(classifyAudioEvent('Laughter'), 'laughter');
  assert.equal(classifyAudioEvent(' __ '), 'censored');
  assert.equal(classifyAudioEvent('Unintelligible'), null);
  assert.equal(classifyAudioEvent('Coughs'), null);
  assert.equal(classifyAudioEvent('Door closes'), null);
});

test('distinguishes known audio events from speaker labels', () => {
  assert.equal(isKnownAudioEvent('Laughter'), true);
  assert.equal(isKnownAudioEvent('Door closes'), true);
  assert.equal(isKnownAudioEvent('Narrator'), false);
  assert.equal(isKnownAudioEvent('Audience member'), false);
});

test('turns annotations into compact event tokens and deduplicates clusters', () => {
  assert.deepEqual(
    tokenizeTranscript('[Music] [Applause] [Music] [Applause]'),
    [
      { type: 'event', kind: 'music', label: 'Music' },
      { type: 'event', kind: 'applause', label: 'Applause' },
    ],
  );
});

test('keeps event positions inside dialogue and leaves ordinary parentheses alone', () => {
  assert.deepEqual(tokenizeTranscript('I said [ __ ] and stopped.'), [
    { type: 'text', value: 'I said ' },
    { type: 'event', kind: 'censored', label: '__' },
    { type: 'text', value: ' and stopped.' },
  ]);
  assert.deepEqual(tokenizeTranscript('This is (I think) fine.'), [
    { type: 'text', value: 'This is (I think) fine.' },
  ]);
});

test('drops unneeded annotations and orphan censorship blanks', () => {
  assert.deepEqual(tokenizeTranscript('[Door closes] Keep talking [Unclear].'), [
    { type: 'text', value: 'Keep talking.' },
  ]);
  assert.deepEqual(tokenizeTranscript('[ __ ]\nThis starts with speech.'), [
    { type: 'text', value: 'This starts with speech.' },
  ]);
  assert.deepEqual(tokenizeTranscript('This ends with speech.\n[ __ ]'), [
    { type: 'text', value: 'This ends with speech.' },
  ]);
  assert.deepEqual(tokenizeTranscript('--\nThis starts with speech.'), [
    { type: 'text', value: 'This starts with speech.' },
  ]);
});

test('ends a line after performance marks but keeps censorship inline', () => {
  assert.equal(eventEndsTranscriptLine('music'), true);
  assert.equal(eventEndsTranscriptLine('applause'), true);
  assert.equal(eventEndsTranscriptLine('laughter'), true);
  assert.equal(eventEndsTranscriptLine('censored'), false);
});
