import test from 'node:test';
import assert from 'node:assert/strict';

import { formatPause, formatTimestamp, parseSrt, structureCues, titleFromFilename } from '../srt.js';

const wordCountForTest = (text) => text.trim().split(/\s+/u).filter(Boolean).length;

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
  assert.equal(paragraphs[0].text, 'Hello there.\nThis is the next sentence.');
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

test('uses a shorter silence threshold for a new line inside the same block', () => {
  const cues = [
    { startMs: 0, endMs: 1000, speaker: '', text: 'First line.', index: 1 },
    { startMs: 1700, endMs: 2500, speaker: '', text: 'Second line.', index: 2 },
    { startMs: 5200, endMs: 6000, speaker: '', text: 'New block.', index: 3 },
  ];

  const paragraphs = structureCues(cues, 2500, 600);
  assert.equal(paragraphs.length, 2);
  assert.equal(paragraphs[0].text, 'First line.\nSecond line.');
  assert.equal(paragraphs[1].text, 'New block.');
});

test('keeps the line threshold below the block threshold', () => {
  const cues = [
    { startMs: 0, endMs: 1000, speaker: '', text: 'First.', index: 1 },
    { startMs: 2400, endMs: 3000, speaker: '', text: 'Second.', index: 2 },
  ];
  assert.equal(structureCues(cues, 1500, 5000)[0].text, 'First.\nSecond.');
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

test('creates short breath lines and thought groups when captions have no useful pauses', () => {
  const cues = [
    { startMs: 0, endMs: 900, speaker: '', text: 'this is exciting i was a little', index: 1 },
    { startMs: 920, endMs: 1800, speaker: '', text: 'too excited i panicked and got', index: 2 },
    { startMs: 1820, endMs: 2700, speaker: '', text: 'this haircut what an insane thing', index: 3 },
    { startMs: 2720, endMs: 3500, speaker: '', text: 'to do when you live in new york', index: 4 },
    { startMs: 3520, endMs: 4300, speaker: '', text: 'but it was totally fine', index: 5 },
    { startMs: 4320, endMs: 5000, speaker: '', text: 'until two days later.', index: 6 },
  ];

  const [paragraph] = structureCues(cues, 2500, 800);
  const groups = paragraph.text.split('\n\n');
  assert.ok(groups.length >= 2);
  assert.ok(groups.every((group) => group.split('\n').every((line) => wordCountForTest(line) <= 11)));
});

test('removes standalone censor cues without leaving empty blocks', () => {
  const cues = [
    { startMs: 0, endMs: 500, speaker: '', text: '[ __ ]', index: 1 },
    { startMs: 600, endMs: 1800, speaker: '', text: 'The spoken line begins here.', index: 2 },
  ];

  assert.deepEqual(structureCues(cues), [{
    startMs: 600,
    endMs: 1800,
    gapBeforeMs: 0,
    speaker: '',
    text: 'The spoken line begins here.',
    cueCount: 1,
    kind: 'speech',
  }]);
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
    'Что-то не живу я такой с мыслю: «Господи, как же охуительно».\n\nЯ вот женился еще недавно, кстати.',
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

test('keeps leading audio annotations in the transcript instead of treating them as speakers', () => {
  const cues = parseSrt(`1
00:00:01,000 --> 00:00:03,000
[Laughter] That was not the plan.

2
00:00:04,000 --> 00:00:05,000
[Door closes] We should go.`);

  assert.deepEqual(
    cues.map(({ speaker, text }) => ({ speaker, text })),
    [
      { speaker: '', text: '[Laughter] That was not the plan.' },
      { speaker: '', text: '[Door closes] We should go.' },
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
