export const NOTATION_STORAGE_KEY = 'subtitle-folio.notation.v4';
export const LEGACY_NOTATION_STORAGE_KEY = 'subtitle-folio.notation.v3';
export const CENSORED_MARK = '________';

export const EVENT_OPTIONS = Object.freeze([
  { kind: 'music', label: '[music]' },
  { kind: 'applause', label: '[applause]' },
  { kind: 'laughter', label: '[laugh]' },
]);

export const PICTOGRAM_OPTIONS = Object.freeze([
  '#', '$', ')', 'M', 'A', 'L', '+', '*', '~', '!', '♪', '♫', '★', '♥', '☺', '●', '○', '△', '□',
]);

const DEFAULT_MAPPINGS = Object.freeze([
  Object.freeze({ event: 'music', pictogram: '#', shortcut: 'Alt+1' }),
  Object.freeze({ event: 'applause', pictogram: '$', shortcut: 'Alt+2' }),
  Object.freeze({ event: 'laughter', pictogram: ')', shortcut: 'Alt+3' }),
]);

export const DEFAULT_NOTATION = Object.freeze({
  mappings: DEFAULT_MAPPINGS,
});

const EVENT_KINDS = new Set(EVENT_OPTIONS.map(({ kind }) => kind));
const PICTOGRAMS = new Set(PICTOGRAM_OPTIONS);
const MODIFIER_KEYS = new Set(['Alt', 'Control', 'Meta', 'Shift']);

function normalizeShortcutKey(key) {
  const value = String(key ?? '');
  if (value === ' ') return 'Space';
  if (value.length === 1) return value.toUpperCase();
  return value;
}

export function shortcutFromKeyboardEvent(event = {}) {
  const key = normalizeShortcutKey(event.key);
  if (!key || MODIFIER_KEYS.has(key) || key === 'Escape') return '';
  const parts = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');
  parts.push(key);
  return parts.join('+');
}

export function isSafeShortcut(shortcut) {
  const value = String(shortcut ?? '');
  if (!value) return false;
  const key = value.split('+').at(-1);
  if (key === 'Tab') return true;
  if ((key === 'Enter' || key === 'Space') && value.includes('Shift+')) return true;
  if (/^F(?:[1-9]|1[0-2])$/u.test(key)) return true;
  return /(?:^|\+)(?:Ctrl|Alt|Meta)\+/u.test(value);
}

function normalizeMappings(values = {}) {
  const suppliedMappings = Array.isArray(values.mappings) ? values.mappings : null;
  const legacySigns = suppliedMappings ? null : values;
  const usedEvents = new Set();
  const usedShortcuts = new Set();

  return DEFAULT_MAPPINGS.map((fallback, index) => {
    const supplied = suppliedMappings?.[index] ?? {};
    let event = EVENT_KINDS.has(supplied.event) && !usedEvents.has(supplied.event)
      ? supplied.event
      : fallback.event;
    if (usedEvents.has(event)) {
      event = EVENT_OPTIONS.find(({ kind }) => !usedEvents.has(kind))?.kind ?? fallback.event;
    }
    usedEvents.add(event);

    const legacyPictogram = legacySigns?.[event];
    const candidatePictogram = suppliedMappings ? supplied.pictogram : legacyPictogram;
    const pictogram = PICTOGRAMS.has(candidatePictogram) ? candidatePictogram : fallback.pictogram;

    const candidateShortcut = String(supplied.shortcut ?? fallback.shortcut);
    const shortcut = isSafeShortcut(candidateShortcut) && !usedShortcuts.has(candidateShortcut)
      ? candidateShortcut
      : DEFAULT_MAPPINGS.find((mapping) => !usedShortcuts.has(mapping.shortcut))?.shortcut ?? '';
    usedShortcuts.add(shortcut);
    return { event, pictogram, shortcut };
  });
}

export function normalizeNotation(values = {}) {
  return { mappings: normalizeMappings(values) };
}

export function notationForEvent(notation, kind) {
  if (kind === 'censored') return CENSORED_MARK;
  return normalizeNotation(notation).mappings.find((mapping) => mapping.event === kind)?.pictogram ?? '';
}

export function mappingForShortcut(notation, shortcut) {
  if (!shortcut) return null;
  return normalizeNotation(notation).mappings.find((mapping) => mapping.shortcut === shortcut) ?? null;
}

export function loadNotation(storage) {
  if (!storage) return normalizeNotation();
  try {
    const current = storage.getItem(NOTATION_STORAGE_KEY);
    if (current) return normalizeNotation(JSON.parse(current));
    const legacy = storage.getItem(LEGACY_NOTATION_STORAGE_KEY);
    return normalizeNotation(legacy ? JSON.parse(legacy) : {});
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
