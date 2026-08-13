import { classifyAudioEvent } from './audio-events.js?v=__BUILD_VERSION__';

export const TRANSCRIPT_FORMATS = Object.freeze(['bold', 'italic', 'underline', 'highlight']);

function normalizeRanges(ranges, textLength) {
  const safeLength = Math.max(0, Number(textLength) || 0);
  const normalized = (Array.isArray(ranges) ? ranges : [])
    .filter(({ format }) => TRANSCRIPT_FORMATS.includes(format))
    .map(({ format, start, end }) => ({
      format,
      start: Math.max(0, Math.min(safeLength, Math.trunc(Number(start) || 0))),
      end: Math.max(0, Math.min(safeLength, Math.trunc(Number(end) || 0))),
    }))
    .filter(({ start, end }) => end > start)
    .sort((left, right) => left.format.localeCompare(right.format) || left.start - right.start || left.end - right.end);

  return normalized.reduce((merged, range) => {
    const previous = merged.at(-1);
    if (previous?.format === range.format && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
    return merged;
  }, []);
}

export function normalizeFormattedTranscript(rawText, rawRanges = []) {
  const source = String(rawText ?? '').replace(/\u00a0/gu, ' ');
  const ranges = normalizeRanges(rawRanges, source.length);
  const characters = Array.from({ length: source.length }, (_, index) => ({
    value: source[index],
    formats: ranges
      .filter(({ start, end }) => start <= index && index < end)
      .map(({ format }) => format),
  }));
  const compacted = [];

  characters.forEach((character) => {
    if (character.value === '\n') {
      while (/[ \t]/u.test(compacted.at(-1)?.value ?? '')) compacted.pop();
      if (compacted.at(-1)?.value === '\n' && compacted.at(-2)?.value === '\n') return;
      compacted.push(character);
      return;
    }
    if (/[ \t]/u.test(character.value) && compacted.at(-1)?.value === '\n') return;
    compacted.push(character);
  });

  while (compacted.length && /\s/u.test(compacted[0].value)) compacted.shift();
  while (compacted.length && /\s/u.test(compacted.at(-1).value)) compacted.pop();

  const text = compacted.map(({ value }) => value).join('');
  const formats = [];
  TRANSCRIPT_FORMATS.forEach((format) => {
    let start = null;
    compacted.forEach((character, index) => {
      const active = character.formats.includes(format);
      if (active && start === null) start = index;
      if (!active && start !== null) {
        formats.push({ format, start, end: index });
        start = null;
      }
    });
    if (start !== null) formats.push({ format, start, end: compacted.length });
  });

  return { text, formats: normalizeRanges(formats, text.length) };
}

export function mergeFormattedTranscripts(first, second, separator = '\n') {
  const left = normalizeFormattedTranscript(first?.text, first?.formats);
  const right = normalizeFormattedTranscript(second?.text, second?.formats);
  const combined = `${left.text}${separator}${right.text}`;
  const offset = left.text.length + separator.length;
  return normalizeFormattedTranscript(combined, [
    ...left.formats,
    ...right.formats.map((range) => ({ ...range, start: range.start + offset, end: range.end + offset })),
  ]);
}

function findEvent(source, run, cursor) {
  const pattern = /(\[[^\]\n]{1,80}\]|\([^()\n]{1,80}\))/gu;
  pattern.lastIndex = cursor;
  for (const match of source.matchAll(pattern)) {
    const label = match[0].slice(1, -1).replace(/\s+/gu, ' ').trim();
    if (classifyAudioEvent(label) === run.kind) {
      return { start: match.index, end: match.index + match[0].length };
    }
  }
  return null;
}

export function locateTranscriptRuns(text, lines) {
  const source = String(text ?? '');
  let cursor = 0;
  return (Array.isArray(lines) ? lines : []).map((line) => ({
    ...line,
    runs: line.runs.map((run) => {
      if (run.type === 'event') {
        const match = findEvent(source, run, cursor);
        if (match) cursor = match.end;
        return { ...run, sourceStart: match?.start ?? cursor, sourceEnd: match?.end ?? cursor };
      }

      let start = source.indexOf(run.value, cursor);
      let renderedValue = run.value;
      if (start < 0) {
        renderedValue = run.value.trim();
        start = source.indexOf(renderedValue, cursor);
      }
      if (start < 0) start = cursor;
      const leadingOffset = run.value.indexOf(renderedValue);
      const sourceStart = Math.max(start - Math.max(0, leadingOffset), cursor);
      const sourceEnd = sourceStart + run.value.length;
      cursor = Math.max(cursor, sourceEnd);
      return { ...run, sourceStart, sourceEnd };
    }),
  }));
}

export function formattedSegments(value, sourceStart, ranges = []) {
  const text = String(value ?? '');
  const start = Number.isFinite(sourceStart) ? sourceStart : -1;
  if (!text || start < 0) return [{ value: text, formats: [] }];
  const end = start + text.length;
  const relevant = normalizeRanges(ranges, Number.MAX_SAFE_INTEGER)
    .filter((range) => range.start < end && range.end > start);
  const boundaries = new Set([start, end]);
  relevant.forEach((range) => {
    boundaries.add(Math.max(start, range.start));
    boundaries.add(Math.min(end, range.end));
  });
  const points = [...boundaries].sort((left, right) => left - right);
  return points.slice(0, -1).map((point, index) => ({
    value: text.slice(point - start, points[index + 1] - start),
    formats: relevant
      .filter(({ start: rangeStart, end: rangeEnd }) => rangeStart <= point && point < rangeEnd)
      .map(({ format }) => format),
  })).filter(({ value: segment }) => segment);
}
