const SUPPORTED_EVENT_RULES = [
  { kind: 'censored', pattern: /^(?:[_\s–—-]+|.*\b(?:bleep|beep|censor(?:ed)?|expletive|profanity)\b.*)$/iu },
  { kind: 'music', pattern: /\b(?:music|musical|song|singing|sings|instrumental|melody|theme|lyrics?)\b/iu },
  { kind: 'applause', pattern: /\b(?:applause|clapping|claps)\b/iu },
  { kind: 'laughter', pattern: /\b(?:laugh(?:ter|ing|s)?|chuckl(?:e|es|ing)|giggl(?:e|es|ing))\b/iu },
];

const IGNORED_EVENT_PATTERNS = [
  /\b(?:inaudible|unintelligible|indistinct|unclear|crosstalk|overlapping)\b/iu,
  /\b(?:audience|crowd|cheer(?:s|ing)?|whoop(?:s|ing)?|boo(?:s|ing)?|murmur(?:s|ing)?)\b/iu,
  /\b(?:sigh(?:s|ing)?|gasp(?:s|ing)?|groan(?:s|ing)?|cough(?:s|ing)?|sniff(?:s|ing)?|cr(?:y|ies|ying)|whisper(?:s|ing)?|shout(?:s|ing)?|scream(?:s|ing)?|mutter(?:s|ing)?|hesitat(?:e|es|ing))\b/iu,
  /\b(?:door|footsteps?|phone|ring(?:s|ing)?|microphone|feedback|static|thud|bang|knock(?:s|ing)?|siren|wind|rain|glass|gunshot|silence)\b/iu,
];

const SPEAKER_LABELS = /^(?:narrator|host|comedian|announcer|interviewer|interviewee|audience member|speaker\s*\d*|man\s*\d*|woman\s*\d*|male voice|female voice)$/iu;
const ANNOTATION_TOKEN = /(\[[^\]\n]{1,80}\]|\([^()\n]{1,80}\))/gu;

function cleanLabel(value) {
  return value.slice(1, -1).replace(/\s+/g, ' ').trim();
}

export function classifyAudioEvent(label) {
  const normalized = String(label ?? '').replace(/\s+/g, ' ').trim();
  return SUPPORTED_EVENT_RULES.find(({ pattern }) => pattern.test(normalized))?.kind ?? null;
}

export function isKnownAudioEvent(label) {
  const normalized = String(label ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized || SPEAKER_LABELS.test(normalized)) return false;
  return SUPPORTED_EVENT_RULES.some(({ pattern }) => pattern.test(normalized)) ||
    IGNORED_EVENT_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function eventEndsTranscriptLine(kind) {
  return kind !== 'censored';
}

export function tokenizeTranscript(text) {
  const source = String(text ?? '').replace(
    /(^|\n)[ \t]*(?:[_–—-]{2,}|\[\s*[_–—-]+\s*\])[ \t]*(?=\n|$)/gu,
    '$1',
  );
  const rawTokens = [];
  let cursor = 0;
  let sawAnnotation = false;

  for (const match of source.matchAll(ANNOTATION_TOKEN)) {
    const before = source.slice(cursor, match.index);
    if (before) rawTokens.push({ type: 'text', value: before });

    const label = cleanLabel(match[0]);
    const squareBracketed = match[0].startsWith('[');
    if (squareBracketed || isKnownAudioEvent(label)) {
      sawAnnotation = true;
      const kind = classifyAudioEvent(label);
      if (kind) rawTokens.push({ type: 'event', kind, label });
    } else {
      rawTokens.push({ type: 'text', value: match[0] });
    }
    cursor = match.index + match[0].length;
  }

  const remainder = source.slice(cursor);
  if (remainder) rawTokens.push({ type: 'text', value: remainder });

  const supportedTokens = rawTokens.filter((token, index) => {
    if (token.type !== 'event' || token.kind !== 'censored') return true;
    const hasTextBefore = rawTokens.slice(0, index).some((candidate) => candidate.type === 'text' && candidate.value.trim());
    const hasTextAfter = rawTokens.slice(index + 1).some((candidate) => candidate.type === 'text' && candidate.value.trim());
    return hasTextBefore && hasTextAfter;
  });

  const compacted = [];
  let clusteredKinds = new Set();

  supportedTokens.forEach((token, index) => {
    if (token.type === 'text' && token.value.trim()) {
      const previousIsEvent = supportedTokens[index - 1]?.type === 'event';
      const nextIsEvent = supportedTokens[index + 1]?.type === 'event';
      let value = token.value;
      if (previousIsEvent) value = value.replace(/^\s+/u, ' ');
      if (nextIsEvent) value = value.replace(/\s+$/u, ' ');
      const previous = compacted.at(-1);
      if (previous?.type === 'text') previous.value += value;
      else compacted.push({ type: 'text', value });
      clusteredKinds = new Set();
      return;
    }
    if (token.type === 'text' || clusteredKinds.has(token.kind)) return;
    compacted.push(token);
    clusteredKinds.add(token.kind);
  });

  compacted.forEach((token, index) => {
    if (token.type !== 'text') return;
    token.value = token.value.replace(/[ \t]+([.,!?;:])/gu, '$1');
    if (index === 0) token.value = token.value.replace(/^\s+/u, '');
    if (index === compacted.length - 1) token.value = token.value.replace(/\s+$/u, '');
  });

  const visibleTokens = compacted.filter((token) => token.type !== 'text' || token.value);
  return visibleTokens.length ? visibleTokens : (sawAnnotation ? [] : [{ type: 'text', value: source }]);
}
