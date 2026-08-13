export const EVENT_ANNOTATIONS = Object.freeze({
  music: '[Music]',
  applause: '[Applause]',
  laughter: '[Laughter]',
  censored: '[ __ ]',
});

export function hasTrailingBlankLine(value) {
  return /\n{2,}$/u.test(String(value ?? '').replace(/[ \t]+$/gu, ''));
}

export function approximateSplitTimestamp(startMs, endMs, beforeLength, afterLength) {
  const start = Number(startMs);
  const end = Number(endMs);
  const duration = Math.max(0, end - start);
  if (!Number.isFinite(start) || !Number.isFinite(end) || duration <= 1) return start;
  const before = Math.max(0, Number(beforeLength) || 0);
  const after = Math.max(0, Number(afterLength) || 0);
  const ratio = before + after > 0 ? before / (before + after) : 0.5;
  return Math.min(end - 1, Math.max(start + 1, Math.round(start + duration * ratio)));
}

export function normalizeEditedTranscript(value) {
  return String(value ?? '')
    .replace(/\u00a0/gu, ' ')
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/\n[ \t]+/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}
