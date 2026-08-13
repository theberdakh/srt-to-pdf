import { tokenizeTranscript } from './audio-events.js?v=__BUILD_VERSION__';

export function calculateLaughStats(blocks) {
  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  const total = safeBlocks.reduce((count, block) => count + tokenizeTranscript(block?.text)
    .filter((token) => token.type === 'event' && token.kind === 'laughter').length, 0);
  const durationMs = safeBlocks.reduce((maximum, block) => Math.max(
    maximum,
    Math.max(0, Number(block?.endMs) || 0),
  ), 0);
  const perMinute = durationMs > 0 ? total / (durationMs / 60_000) : 0;

  return { total, perMinute, durationMs };
}

export function formatLaughStats(stats) {
  const total = Math.max(0, Math.floor(Number(stats?.total) || 0));
  const perMinute = Math.max(0, Number(stats?.perMinute) || 0);
  return `${total} ${total === 1 ? 'laugh' : 'laughs'} · ${perMinute.toFixed(1)} laughs/min`;
}
