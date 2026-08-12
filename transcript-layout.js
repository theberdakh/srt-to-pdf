import { eventEndsTranscriptLine, tokenizeTranscript } from './audio-events.js';

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
