import { eventEndsTranscriptLine, tokenizeTranscript } from './audio-events.js?v=__BUILD_VERSION__';

const MINUTE_MS = 60_000;

function makeLine(indent = false, thoughtBreakBefore = false) {
  return { runs: [], indent, thoughtBreakBefore };
}

export function layoutTranscript(text) {
  const tokens = tokenizeTranscript(text);
  const lines = [];
  let line = makeLine();
  let indentNextSpeechLine = false;
  let eventClusterEndsLine = false;
  let thoughtBreakBeforeNextLine = false;

  const finishLine = (addThoughtBreak = false) => {
    if (line.runs.length) lines.push(line);
    if (addThoughtBreak && lines.length) thoughtBreakBeforeNextLine = true;
    line = makeLine(false, thoughtBreakBeforeNextLine);
    thoughtBreakBeforeNextLine = false;
  };

  const appendText = (value) => {
    if (!value) return;
    if (!line.runs.length && indentNextSpeechLine) {
      line.indent = true;
      indentNextSpeechLine = false;
    }
    const normalized = line.runs.length ? value : value.replace(/^\s+/u, '');
    if (!normalized) return;
    const previous = line.runs.at(-1);
    if (previous?.type === 'text') previous.value += normalized;
    else line.runs.push({ type: 'text', value: normalized });
  };

  tokens.forEach((token, tokenIndex) => {
    if (token.type === 'event') {
      line.runs.push({ ...token });
      eventClusterEndsLine ||= eventEndsTranscriptLine(token.kind);
      if (tokens[tokenIndex + 1]?.type !== 'event') {
        if (eventClusterEndsLine) {
          finishLine();
          indentNextSpeechLine = true;
        }
        eventClusterEndsLine = false;
      }
      return;
    }

    token.value.split(/(\n\n|\n)/u).forEach((part) => {
      if (part === '\n' || part === '\n\n') {
        finishLine(part === '\n\n');
        return;
      }
      appendText(part);
    });
  });

  finishLine();

  return {
    eventsOnly: tokens.length > 0 && tokens.every(({ type }) => type === 'event'),
    lines,
  };
}

export function markElapsedMinutes(lines, startMs, endMs, startingMinute = 1) {
  const safeLines = Array.isArray(lines) ? lines : [];
  const safeStartMs = Math.max(0, Number(startMs) || 0);
  const safeEndMs = Math.max(safeStartMs, Number(endMs) || safeStartMs);
  let nextMinute = Math.max(1, Math.floor(Number(startingMinute) || 1));
  const lastLineIndex = Math.max(1, safeLines.length - 1);

  const markedLines = safeLines.map((line, lineIndex) => {
    const lineTimeMs = safeLines.length === 1
      ? safeEndMs
      : safeStartMs + (safeEndMs - safeStartMs) * (lineIndex / lastLineIndex);
    const minuteMarkersBefore = [];

    while (nextMinute * MINUTE_MS <= lineTimeMs) {
      minuteMarkersBefore.push(nextMinute);
      nextMinute += 1;
    }

    return { ...line, minuteMarkersBefore };
  });

  return { lines: markedLines, nextMinute };
}
