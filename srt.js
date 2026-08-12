import { isKnownAudioEvent } from './audio-events.js?v=__BUILD_VERSION__';

const TIMING_LINE = /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})(?:\s+.*)?$/;
const BRACKETED_SPEAKER_LINE = /^\[([^\]]{1,40})\][ \t]+(.+)$/u;
const COLON_SPEAKER_LINE = /^([^:]{1,40}):[ \t]+(.+)$/u;
const VTT_SPEAKER = /^<v(?:\.[^ >]+)*\s+([^>]+)>(.*)$/i;
const GENERIC_SPEAKER_LABEL = /^(?:narrator|host|comedian|announcer|interviewer|interviewee|audience member|speaker\s*\d*|man\s*\d*|woman\s*\d*|male voice|female voice)$/iu;

function timestampToMs(parts) {
  const [hours, minutes, seconds, milliseconds] = parts.map(Number);
  return hours * 3_600_000 + minutes * 60_000 + seconds * 1000 + milliseconds;
}

function decodeBasicEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function cleanText(lines) {
  return decodeBasicEntities(
    lines
      .join(' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/?(?:i|b|u|font)(?:\s[^>]*)?>/gi, '')
      .replace(/\{\\[^}]+}/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function extractSpeaker(text) {
  const voiceMatch = text.match(VTT_SPEAKER);
  if (voiceMatch) {
    return { speaker: voiceMatch[1].trim(), text: voiceMatch[2].trim() };
  }

  const bracketedMatch = text.match(BRACKETED_SPEAKER_LINE);
  if (bracketedMatch) {
    if (isKnownAudioEvent(bracketedMatch[1])) return { speaker: '', text };
    return { speaker: bracketedMatch[1].trim(), text: bracketedMatch[2].trim() };
  }

  const colonMatch = text.match(COLON_SPEAKER_LINE);
  if (!colonMatch) return { speaker: '', text };

  const speaker = colonMatch[1].trim();
  const words = speaker.split(/\s+/).filter(Boolean);
  const hasSentencePunctuation = /[.!?…«»]/u.test(speaker);
  const isAllUppercase = speaker === speaker.toUpperCase() && /\p{L}/u.test(speaker);
  const isTitleCase = words.every((word) => /^(?:\p{Lu}|\p{N})/u.test(word));
  const isGenericSpeakerLabel = GENERIC_SPEAKER_LABEL.test(speaker);
  const looksLikeSpeaker =
    words.length <= 4 &&
    !hasSentencePunctuation &&
    (isAllUppercase || isTitleCase || isGenericSpeakerLabel);

  return looksLikeSpeaker
    ? { speaker, text: colonMatch[2].trim() }
    : { speaker: '', text };
}

export function parseSrt(source) {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) throw new Error('This file is empty. Choose an SRT file that contains subtitles.');

  const blocks = normalized.split(/\n{2,}/);
  const cues = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const timingIndex = lines.findIndex((line) => TIMING_LINE.test(line));
    if (timingIndex === -1) continue;

    const timing = lines[timingIndex].match(TIMING_LINE);
    const text = cleanText(lines.slice(timingIndex + 1));
    if (!timing || !text) continue;

    const { speaker, text: spokenText } = extractSpeaker(text);
    const startMs = timestampToMs(timing.slice(1, 5));
    const endMs = timestampToMs(timing.slice(5, 9));
    if (endMs < startMs) continue;

    cues.push({
      index: cues.length + 1,
      startMs,
      endMs,
      speaker,
      text: spokenText,
    });
  }

  if (!cues.length) {
    throw new Error('No valid subtitle cues were found. Check that the file uses standard SRT timestamps.');
  }

  return cues;
}

function joinCueText(previous, next) {
  if (!previous) return next;

  const previousEndsWithDash = /[-–—]\s*$/.test(previous);
  const nextStartsLowercase = /^\p{Ll}/u.test(next);
  const previousEndsWithWord = /[\p{L}\p{N}]$/u.test(previous);

  if (previousEndsWithDash) return `${previous.replace(/[-–—]\s*$/, '')}${next}`;
  if (previousEndsWithWord && nextStartsLowercase) return `${previous} ${next}`;
  return `${previous} ${next}`;
}

function isStageDirection(text) {
  return /^(?:\[[^\]]+\]|\([^\)]+\))$/.test(text.trim());
}

function isOrphanCensorCue(text) {
  return /^(?:[_–—-]{2,}|\[\s*[_–—-]+\s*\])$/u.test(text.trim());
}

function isStandaloneCheerCue(text) {
  return /^เฮ้?[.!…]*$/u.test(text.trim());
}

function wordCount(text) {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

function lineSeparator(currentText, nextText, gapMs, lineThresholdMs) {
  const currentLine = currentText.split('\n').at(-1) ?? '';
  const currentThought = currentText.split('\n\n').at(-1) ?? '';
  const lineWords = wordCount(currentLine);
  const thoughtWords = wordCount(currentThought);
  const nextWords = wordCount(nextText);
  const sentenceEnded = /[.!?…][”’"'»\)\]]*$/u.test(currentText.trim());
  const pauseBreak = gapMs >= lineThresholdMs;
  const breathBreak = lineWords > 0 && lineWords + nextWords > 11;
  const strongPause = gapMs >= Math.max(lineThresholdMs + 400, lineThresholdMs * 1.6);
  const thoughtBreak = strongPause || thoughtWords >= 20 || (sentenceEnded && thoughtWords >= 12);

  if (thoughtBreak) return '\n\n';
  if (pauseBreak || sentenceEnded || breathBreak) return '\n';
  return ' ';
}

export function structureCues(cues, pauseThresholdMs = 2500, lineThresholdMs = 800) {
  const threshold = Math.max(500, Number(pauseThresholdMs) || 2500);
  const lineThreshold = Math.min(
    Math.max(100, threshold - 100),
    Math.max(100, Number(lineThresholdMs) || 800),
  );
  const paragraphs = [];

  for (const cue of cues) {
    if (isOrphanCensorCue(cue.text) || isStandaloneCheerCue(cue.text)) continue;
    const current = paragraphs.at(-1);
    const gapMs = current ? Math.max(0, cue.startMs - current.endMs) : 0;
    const meaningfulPause = current && gapMs >= threshold;

    if (!current || meaningfulPause) {
      paragraphs.push({
        startMs: cue.startMs,
        endMs: cue.endMs,
        gapBeforeMs: gapMs,
        speaker: cue.speaker,
        text: cue.text,
        cueCount: 1,
        kind: isStageDirection(cue.text) ? 'direction' : 'speech',
      });
      continue;
    }

    const speakerChanged = cue.speaker && current.speaker && cue.speaker !== current.speaker;
    const separator = lineSeparator(current.text, cue.text, gapMs, lineThreshold);
    if (speakerChanged) {
      current.text = `${current.speaker}: ${current.text}${separator}${cue.speaker}: ${cue.text}`;
      current.speaker = '';
    } else if (separator !== ' ') {
      current.text = `${current.text}${separator}${cue.text}`;
      if (!current.speaker && cue.speaker) current.speaker = cue.speaker;
    } else {
      current.text = joinCueText(current.text, cue.text);
      if (!current.speaker && cue.speaker) current.speaker = cue.speaker;
    }
    current.endMs = cue.endMs;
    current.cueCount += 1;
    if (!isStageDirection(current.text)) current.kind = 'speech';
  }

  return paragraphs;
}

export function formatPause(milliseconds) {
  const seconds = Math.max(0, milliseconds) / 1000;
  const precision = seconds < 10 && !Number.isInteger(seconds) ? 1 : 0;
  return `${seconds.toFixed(precision)}s pause`;
}

export function formatTimestamp(milliseconds, includeHours = false) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (includeHours || hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function titleFromFilename(filename) {
  const withoutExtension = filename.replace(/\.srt$/i, '');
  return withoutExtension
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)\p{L}/gu, (match) => match.toUpperCase()) || 'Untitled transcript';
}
