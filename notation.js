export const NOTATION_STORAGE_KEY = 'subtitle-folio.notation.v3';

export const NOTATION_FIELDS = [
  { kind: 'music', label: 'music', defaultValue: '#', maxLength: 3 },
  { kind: 'applause', label: 'applause', defaultValue: '$', maxLength: 3 },
  { kind: 'laughter', label: 'laughter', defaultValue: ')', maxLength: 3 },
  { kind: 'censored', label: 'censored', defaultValue: '________', maxLength: 8 },
];

export const DEFAULT_NOTATION = Object.freeze(Object.fromEntries(
  NOTATION_FIELDS.map(({ kind, defaultValue }) => [kind, defaultValue]),
));

export function normalizeNotation(values = {}) {
  return Object.fromEntries(NOTATION_FIELDS.map(({ kind, defaultValue, maxLength }) => {
    const hasValue = Object.prototype.hasOwnProperty.call(values, kind);
    const value = hasValue ? String(values[kind] ?? '') : defaultValue;
    return [kind, Array.from(value.replace(/[\r\n\t]/g, '')).slice(0, maxLength).join('')];
  }));
}

export function loadNotation(storage) {
  if (!storage) return normalizeNotation();
  try {
    const saved = JSON.parse(storage.getItem(NOTATION_STORAGE_KEY) ?? '{}');
    return normalizeNotation(saved);
  } catch {
    return normalizeNotation();
  }
}

export function saveNotation(storage, notation) {
  const normalized = normalizeNotation(notation);
  try {
    storage?.setItem(NOTATION_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // The worksheet still works when browser storage is unavailable.
  }
  return normalized;
}
