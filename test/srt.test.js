import test from 'node:test';
import assert from 'node:assert/strict';

import { formatPause, formatTimestamp, parseSrt, structureCues, titleFromFilename } from '../srt.js';

const basicSrt = `1
00:00:01,000 --> 00:00:03,500
Hello there.

2
00:00:04,000 --> 00:00:06,000
This is the next sentence.

3
00:00:12,000 --> 00:00:14,000
MAYA: A new paragraph starts here.`;

test('parses standard SRT cues and timing', () => {
  const cues = parseSrt(basicSrt);
  assert.equal(cues.length, 3);
  assert.equal(cues[0].startMs, 1000);
  assert.equal(cues[0].endMs, 3500);
  assert.equal(cues[2].speaker, 'MAYA');
  assert.equal(cues[2].text, 'A new paragraph starts here.');
});

test('supports BOM, CRLF, multiline text, dot milliseconds, and basic tags', () => {
  const cues = parseSrt('\uFEFF1\r\n00:00:00.250 --> 00:00:02.000\r\n<i>First line</i>\r\nsecond line');
  assert.deepEqual(cues[0], {
    index: 1,
    startMs: 250,
    endMs: 2000,
    speaker: '',
    text: 'First line second line',
  });
});

test('merges nearby cues and splits only on the chosen pause', () => {
  const paragraphs = structureCues(parseSrt(basicSrt), 2500);
  assert.equal(paragraphs.length, 2);
  assert.equal(paragraphs[0].cueCount, 2);
  assert.equal(paragraphs[0].text, 'Hello there. This is the next sentence.');
  assert.equal(paragraphs[1].speaker, 'MAYA');
  assert.equal(paragraphs[1].gapBeforeMs, 6000);
});

test('uses the selected silence threshold to split blocks', () => {
  const cues = [
    { startMs: 0, endMs: 1000, speaker: '', text: 'Setup.', index: 1 },
    { startMs: 2900, endMs: 3900, speaker: '', text: 'Punch.', index: 2 },
  ];

  assert.equal(structureCues(cues, 1800).length, 2);
  assert.equal(structureCues(cues, 2500).length, 1);
  assert.equal(structureCues(cues, 5000).length, 1);
});

test('keeps unlabeled continuation cues with the current speaker', () => {
  const cues = parseSrt(`1
00:00:01,000 --> 00:00:03,000
EDITOR: This sentence begins here,

2
00:00:03,100 --> 00:00:05,000
and continues in the next cue.`);

  const paragraphs = structureCues(cues);
  assert.equal(paragraphs.length, 1);
  assert.equal(paragraphs[0].speaker, 'EDITOR');
  assert.equal(paragraphs[0].text, 'This sentence begins here, and continues in the next cue.');
});

test('does not mistake a sentence containing a colon for a speaker label', () => {
  const cues = parseSrt(`423
00:25:24,820 --> 00:25:28,940
Что-то не живу я такой с мыслю: «Господи, как же охуительно».

424
00:25:30,410 --> 00:25:33,590
Я вот женился еще недавно, кстати.`);

  assert.equal(cues[0].speaker, '');
  assert.equal(
    cues[0].text,
    'Что-то не живу я такой с мыслю: «Господи, как же охуительно».',
  );

  const paragraphs = structureCues(cues);
  assert.equal(paragraphs.length, 1);
  assert.equal(paragraphs[0].speaker, '');
  assert.equal(
    paragraphs[0].text,
    'Что-то не живу я такой с мыслю: «Господи, как же охуительно». Я вот женился еще недавно, кстати.',
  );
});

test('still recognizes common explicit speaker label formats', () => {
  const cues = parseSrt(`1
00:00:01,000 --> 00:00:02,000
John Smith: Welcome.

2
00:00:03,000 --> 00:00:04,000
[Narrator] The story begins.

3
00:00:05,000 --> 00:00:06,000
<v Interviewer>What happened next?`);

  assert.deepEqual(
    cues.map(({ speaker, text }) => ({ speaker, text })),
    [
      { speaker: 'John Smith', text: 'Welcome.' },
      { speaker: 'Narrator', text: 'The story begins.' },
      { speaker: 'Interviewer', text: 'What happened next?' },
    ],
  );
});

test('does not create extra boundaries for stage directions', () => {
  const cues = [
    { startMs: 0, endMs: 1000, speaker: '', text: 'Welcome.', index: 1 },
    { startMs: 1100, endMs: 1800, speaker: '', text: '[Door closes]', index: 2 },
    { startMs: 1900, endMs: 2600, speaker: '', text: 'Sit down.', index: 3 },
  ];
  const paragraphs = structureCues(cues);
  assert.equal(paragraphs.length, 1);
  assert.equal(paragraphs[0].kind, 'speech');
  assert.match(paragraphs[0].text, /Door closes/);
});

test('does not split a continuous thought for speaker, length, or duration', () => {
  const cues = [
    { startMs: 0, endMs: 60_000, speaker: 'A', text: 'A'.repeat(900), index: 1 },
    { startMs: 60_100, endMs: 180_000, speaker: 'B', text: 'B'.repeat(900), index: 2 },
  ];
  const paragraphs = structureCues(cues, 2500);
  assert.equal(paragraphs.length, 1);
  assert.equal(paragraphs[0].speaker, '');
  assert.match(paragraphs[0].text, /^A:/);
  assert.match(paragraphs[0].text, /B:/);
});

test('rejects empty or non-SRT text with useful errors', () => {
  assert.throws(() => parseSrt(''), /empty/i);
  assert.throws(() => parseSrt('just some plain text'), /No valid subtitle cues/i);
});

test('formats timestamps and filename titles', () => {
  assert.equal(formatTimestamp(65_900), '01:05');
  assert.equal(formatTimestamp(3_665_900), '01:01:05');
  assert.equal(formatPause(2800), '2.8s pause');
  assert.equal(formatPause(12_000), '12s pause');
  assert.equal(titleFromFilename('my_interview-final.srt'), 'My Interview Final');
  assert.equal(titleFromFilename('пример_интервью.srt'), 'Пример Интервью');
});
