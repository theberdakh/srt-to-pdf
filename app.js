import { formatTimestamp, parseSrt, structureCues, titleFromFilename } from './srt.js?v=__BUILD_VERSION__';
import { tokenizeTranscript } from './audio-events.js?v=__BUILD_VERSION__';
import {
  DEFAULT_NOTATION,
  EVENT_OPTIONS,
  PICTOGRAM_OPTIONS,
  isSafeShortcut,
  loadNotation,
  mappingForShortcut,
  notationForEvent,
  saveNotation,
  shortcutFromKeyboardEvent,
} from './notation.js?v=__BUILD_VERSION__';
import { downloadWorksheetPdf, estimatePdfPageCount, pdfFilename } from './pdf-generator.js?v=__BUILD_VERSION__';
import { layoutTranscript } from './transcript-layout.js?v=__BUILD_VERSION__';
import { calculateLaughStats, formatLaughStats } from './laugh-stats.js?v=__BUILD_VERSION__';
import { titleSizeFor } from './title-sizing.js?v=__BUILD_VERSION__';
import {
  approximateSplitTimestamp,
  EVENT_ANNOTATIONS,
  hasTrailingBlankLine,
  normalizeEditedTranscript,
} from './transcript-edit.js?v=__BUILD_VERSION__';
import {
  formattedSegments,
  locateTranscriptRuns,
  mergeFormattedTranscripts,
  normalizeFormattedTranscript,
  TRANSCRIPT_FORMATS,
} from './text-formatting.js?v=__BUILD_VERSION__';

const elements = {
  blocks: document.querySelector('#blocks'),
  coverLaughStats: document.querySelector('#cover-laugh-stats'),
  documentContent: document.querySelector('#document-content'),
  downloadButton: document.querySelector('#download-button, #print-button'),
  downloadLabel: document.querySelector('#download-label'),
  dropZone: document.querySelector('#drop-zone'),
  emptyState: document.querySelector('#empty-state'),
  error: document.querySelector('#error-message'),
  fileInput: document.querySelector('#file-input'),
  fileStatus: document.querySelector('#file-status'),
  mastheadFile: document.querySelector('#masthead-file'),
  lineThreshold: document.querySelector('#line-threshold'),
  notationFields: document.querySelector('#notation-fields'),
  notesEditor: document.querySelector('#notes-editor'),
  coverNotationLegend: document.querySelector('#cover-notation-legend'),
  resetTranscript: document.querySelector('#reset-transcript'),
  pauseThreshold: document.querySelector('#pause-threshold'),
  pageEstimate: document.querySelector('#page-estimate'),
  pageTotal: document.querySelector('#page-total'),
  pdfFilename: document.querySelector('#pdf-filename'),
  printTitle: document.querySelector('#print-title'),
  replaceButton: document.querySelector('#replace-button'),
  resetNotation: document.querySelector('#reset-notation'),
  sampleButton: document.querySelector('#sample-button'),
  textFormatToolbar: document.querySelector('#text-format-toolbar'),
  uploadButton: document.querySelector('#upload-button'),
};

const state = {
  blocks: [],
  cues: [],
  filename: '',
  notation: loadNotation(window.localStorage),
  notes: '',
  originalBlocks: [],
  transcriptDirty: false,
};

let savedFormattingRange = null;
let formatToolbarTimer = null;
let selectingTranscript = false;
const NOTE_LINE_HEIGHT = 24;
const NOTE_LINE_MAX_LENGTH = 48;

function balanceRules(element) {
  const height = element.getBoundingClientRect().height;
  if (height <= 0) return;
  const idealSpacing = Number.parseFloat(getComputedStyle(element).getPropertyValue('--ideal-rule-spacing')) || 24;
  const ruleCount = Math.max(1, Math.round(height / idealSpacing));
  if (element.childElementCount === ruleCount) return;
  const rules = Array.from({ length: ruleCount }, () => {
    const rule = document.createElement('span');
    rule.className = 'writing-rule';
    rule.setAttribute('aria-hidden', 'true');
    return rule;
  });
  element.replaceChildren(...rules);
}

const ruleObserver = new ResizeObserver((entries) => {
  entries.forEach(({ target }) => balanceRules(target));
});

const noteRowsObserver = new ResizeObserver(() => syncNoteRows());
noteRowsObserver.observe(elements.notesEditor);

function observeRuledSurfaces() {
  ruleObserver.disconnect();
  document.querySelectorAll('.cover-lines').forEach((element) => {
    balanceRules(element);
    ruleObserver.observe(element);
  });
}

const sampleSrt = `1
00:00:02,000 --> 00:00:05,200
Everything starts as a normal observation.

2
00:00:05,400 --> 00:00:08,500
The subtitles keep following the thought.

3
00:00:11,500 --> 00:00:15,000
After enough silence, a new block begins.

4
00:00:15,200 --> 00:00:20,800
Longer moments receive more room for handwritten analysis.

5
00:00:25,000 --> 00:00:28,500
The rest is yours to mark with a pen.

6
00:00:28,700 --> 00:00:29,400
[Laughter]

7
00:00:30,300 --> 00:00:32,000
[Music] [Applause] That was [ __ ] useful.`;

function pauseThresholdMs() {
  const seconds = Number(elements.pauseThreshold.value);
  return Math.round(Math.min(15, Math.max(0.5, Number.isFinite(seconds) ? seconds : 2.5)) * 1000);
}

function lineThresholdMs(blockThresholdMs) {
  const seconds = Number(elements.lineThreshold.value);
  const maximum = Math.max(0.1, blockThresholdMs / 1000 - 0.1);
  const normalized = Math.min(maximum, Math.max(0.1, Number.isFinite(seconds) ? seconds : 0.8));
  elements.lineThreshold.max = String(maximum);
  elements.lineThreshold.value = String(Math.round(normalized * 10) / 10);
  return Math.round(normalized * 1000);
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function makeAudioEventMark(event) {
  const ringClass = event.kind === 'censored' ? '' : ' notation-mark';
  const mark = makeElement('span', `audio-event audio-event--${event.kind}${ringClass}`);
  mark.setAttribute('role', 'img');
  mark.setAttribute('aria-label', event.label);
  mark.dataset.eventKind = event.kind;
  mark.contentEditable = 'false';
  mark.title = event.label;
  mark.textContent = notationForEvent(state.notation, event.kind);
  return mark;
}

function appendFormattedText(parent, run, formats) {
  formattedSegments(run.value, run.sourceStart, formats).forEach((segment) => {
    if (!segment.formats.length) {
      parent.append(segment.value);
      return;
    }
    const span = makeElement('span', segment.formats.map((format) => `transcript-format--${format}`).join(' '));
    span.textContent = segment.value;
    parent.append(span);
  });
}

function appendTranscript(paragraph, text, formats = []) {
  const layout = layoutTranscript(text);
  const lines = locateTranscriptRuns(text, layout.lines);
  paragraph.classList.toggle('transcript-events-only', layout.eventsOnly);
  lines.forEach((transcriptLine) => {
    if (transcriptLine.thoughtBreakBefore && paragraph.childNodes.length) {
      paragraph.append(makeElement('span', 'thought-break'));
    }
    const line = makeElement('span', 'transcript-line');
    transcriptLine.runs.forEach((run) => {
      if (run.type === 'event') line.append(makeAudioEventMark(run));
      else appendFormattedText(line, run, formats);
    });
    paragraph.append(line);
  });
}

function updateNotationDisplay() {
  elements.coverNotationLegend.replaceChildren();
  EVENT_OPTIONS.forEach(({ kind, label }) => {
    const sign = notationForEvent(state.notation, kind);
    if (!sign) return;
    const item = makeElement('span', 'notation-legend__item');
    item.append(
      makeElement('b', 'notation-mark', sign),
      makeElement('span', '', label),
    );
    elements.coverNotationLegend.append(item.cloneNode(true));
  });
}

function persistNotation(notation, rerenderFields = false) {
  state.notation = saveNotation(window.localStorage, notation);
  updateNotationDisplay();
  if (rerenderFields) renderNotationFields();
  if (state.cues.length) render();
}

function captureShortcut(button, mappingIndex) {
  const originalLabel = state.notation.mappings[mappingIndex].shortcut;
  button.dataset.capturing = 'true';
  button.textContent = 'Press keys';

  const stopCapture = () => {
    delete button.dataset.capturing;
    button.textContent = state.notation.mappings[mappingIndex]?.shortcut ?? originalLabel;
    button.removeEventListener('keydown', onKeyDown);
    button.removeEventListener('blur', stopCapture);
  };

  const onKeyDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      stopCapture();
      return;
    }
    const shortcut = shortcutFromKeyboardEvent(event);
    if (!shortcut) return;
    if (!isSafeShortcut(shortcut)) {
      showError('Use Tab, a function key, or a shortcut containing Alt, Ctrl, or Command.');
      return;
    }
    const duplicate = state.notation.mappings.some((mapping, index) => (
      index !== mappingIndex && mapping.shortcut === shortcut
    ));
    if (duplicate) {
      showError('That shortcut already inserts another pictogram. Choose a different one.');
      return;
    }
    clearError();
    const mappings = state.notation.mappings.map((mapping, index) => (
      index === mappingIndex ? { ...mapping, shortcut } : { ...mapping }
    ));
    persistNotation({ mappings });
    stopCapture();
  };

  button.addEventListener('keydown', onKeyDown);
  button.addEventListener('blur', stopCapture, { once: true });
}

function renderNotationFields() {
  elements.notationFields.replaceChildren();
  const heading = makeElement('div', 'notation-table__heading');
  heading.setAttribute('aria-hidden', 'true');
  heading.append(
    makeElement('span', '', 'pictogram'),
    makeElement('span', '', 'shortcut'),
    makeElement('span', '', 'subtitle'),
  );
  elements.notationFields.append(heading);

  state.notation.mappings.forEach((mapping, mappingIndex) => {
    const row = makeElement('div', 'notation-field');

    const pictogram = makeElement('select', 'pictogram-select');
    pictogram.setAttribute('aria-label', `Pictogram for ${mapping.event}`);
    PICTOGRAM_OPTIONS.forEach((value) => {
      const option = makeElement('option');
      option.value = value;
      option.textContent = value;
      pictogram.append(option);
    });
    pictogram.value = mapping.pictogram;
    pictogram.addEventListener('change', () => {
      const mappings = state.notation.mappings.map((candidate, index) => (
        index === mappingIndex ? { ...candidate, pictogram: pictogram.value } : { ...candidate }
      ));
      persistNotation({ mappings });
    });

    const subtitleEvent = makeElement('select', 'event-select');
    subtitleEvent.setAttribute('aria-label', `Subtitle event for ${mapping.pictogram}`);
    EVENT_OPTIONS.forEach(({ kind, label }) => {
      const option = makeElement('option');
      option.value = kind;
      option.textContent = label;
      subtitleEvent.append(option);
    });
    subtitleEvent.value = mapping.event;
    subtitleEvent.addEventListener('change', () => {
      const requestedEvent = subtitleEvent.value;
      const previousEvent = state.notation.mappings[mappingIndex].event;
      const mappings = state.notation.mappings.map((candidate, index) => {
        if (index === mappingIndex) return { ...candidate, event: requestedEvent };
        if (candidate.event === requestedEvent) return { ...candidate, event: previousEvent };
        return { ...candidate };
      });
      persistNotation({ mappings }, true);
    });

    const shortcut = makeElement('button', 'shortcut-button', mapping.shortcut);
    shortcut.type = 'button';
    shortcut.setAttribute('aria-label', `Change shortcut for ${mapping.event}`);
    shortcut.title = 'Choose a keyboard shortcut that cannot become transcript text';
    shortcut.addEventListener('click', () => captureShortcut(shortcut, mappingIndex));

    row.append(pictogram, shortcut, subtitleEvent);
    elements.notationFields.append(row);
  });
}

function showError(message) {
  elements.error.textContent = message;
  elements.error.hidden = false;
}

function clearError() {
  elements.error.hidden = true;
  elements.error.textContent = '';
}

function setDownloadLabel(label) {
  if (elements.downloadLabel) elements.downloadLabel.textContent = label;
}

function currentTitle() {
  return elements.printTitle.textContent.trim() || 'Untitled transcript';
}

function updateTitleSize() {
  elements.printTitle.dataset.titleSize = titleSizeFor(currentTitle());
}

function updatePdfFilename() {
  const filename = pdfFilename(currentTitle());
  elements.pdfFilename.textContent = filename;
  elements.pdfFilename.title = filename;
}

function updateLaughStats() {
  elements.coverLaughStats.textContent = formatLaughStats(calculateLaughStats(state.blocks));
}

function setGroupingControlsDisabled(disabled) {
  elements.lineThreshold.disabled = disabled;
  elements.pauseThreshold.disabled = disabled;
  const explanation = disabled ? 'Reset transcript edits before changing automatic grouping.' : '';
  elements.lineThreshold.title = explanation;
  elements.pauseThreshold.title = explanation;
}

function rebuildBlocks() {
  const threshold = pauseThresholdMs();
  const lineThreshold = lineThresholdMs(threshold);
  state.blocks = structureCues(state.cues, threshold, lineThreshold)
    .filter((block) => tokenizeTranscript(block.text).length > 0);
  state.originalBlocks = state.blocks.map((block) => ({ ...block, formats: [] }));
  state.blocks = state.blocks.map((block) => ({ ...block, formats: [] }));
  elements.pauseThreshold.value = String(threshold / 1000);
}

function blockHeightMm(block) {
  const durationSeconds = Math.max(1, (block.endMs - block.startMs) / 1000);
  return Math.min(48, Math.round(16 + durationSeconds * 0.35));
}

function updatePageEstimate() {
  const pageCount = estimatePdfPageCount(state.blocks, state.notes);
  elements.pageTotal.textContent = `${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`;
}

function render() {
  if (!state.cues.length) return;
  const blocks = state.blocks;
  const duration = state.cues.at(-1).endMs;
  const hasHours = duration >= 3_600_000;

  elements.blocks.replaceChildren();
  blocks.forEach((block, index) => {
    const section = makeElement('section', 'worksheet-block');
    section.style.setProperty('--block-height', `${blockHeightMm(block)}mm`);

    const transcript = makeElement('div', 'transcript-area');
    const blockNumber = makeElement('span', 'block-number');
    blockNumber.append(makeElement('span', 'block-number__badge', String(index + 1)));
    blockNumber.setAttribute('aria-label', `Block ${index + 1}`);
    transcript.append(blockNumber, makeElement('time', '', formatTimestamp(block.startMs, hasHours)));
    if (block.speaker) transcript.append(makeElement('h3', '', block.speaker));
    const paragraph = makeElement('p');
    paragraph.className = 'transcript-copy';
    paragraph.dataset.blockIndex = String(index);
    paragraph.contentEditable = 'true';
    paragraph.spellcheck = true;
    appendTranscript(paragraph, block.text, block.formats);
    transcript.append(paragraph);

    section.append(transcript);
    elements.blocks.append(section);
  });

  document.title = currentTitle();
  updateLaughStats();
  observeRuledSurfaces();
  updatePageEstimate();
}

function normalizeNotes(value) {
  return String(value ?? '')
    .replace(/\r\n?/gu, '\n')
    .replace(/\u00a0/gu, ' ')
    .replace(/[ \t]+\n/gu, '\n')
    .slice(0, 20_000);
}

function noteInputs() {
  return Array.from(elements.notesEditor.querySelectorAll('.notes-line'));
}

function createNoteInput(index, value = '') {
  const input = makeElement('input', 'notes-line');
  input.type = 'text';
  input.value = value;
  input.maxLength = NOTE_LINE_MAX_LENGTH;
  input.spellcheck = true;
  input.autocomplete = 'off';
  input.setAttribute('aria-label', `Worksheet note line ${index + 1}`);
  return input;
}

function syncNoteRows(minimumRows = 0) {
  const storedLines = state.notes ? state.notes.split('\n') : [];
  const visibleRows = Math.max(1, Math.ceil(elements.notesEditor.clientHeight / NOTE_LINE_HEIGHT));
  const desiredRows = Math.max(visibleRows, storedLines.length, minimumRows);
  let inputs = noteInputs();
  while (inputs.length < desiredRows) {
    const index = inputs.length;
    elements.notesEditor.append(createNoteInput(index, storedLines[index] ?? ''));
    inputs = noteInputs();
  }
}

function updateNotesState() {
  state.notes = noteInputs().map((input) => input.value).join('\n').trimEnd();
  updatePageEstimate();
}

function growNotesByOneLine() {
  const documentHeight = document.querySelector('.transcript-document').getBoundingClientRect().height;
  elements.documentContent.style.setProperty('--notes-document-height', `${Math.ceil(documentHeight + NOTE_LINE_HEIGHT)}px`);
}

function elementFormats(element, inheritedFormats) {
  const formats = new Set(inheritedFormats);
  const tag = element.tagName;
  if (['B', 'STRONG'].includes(tag) || /^(?:bold|[6-9]00)$/u.test(element.style.fontWeight)) formats.add('bold');
  if (['I', 'EM'].includes(tag) || element.style.fontStyle === 'italic') formats.add('italic');
  if (tag === 'U' || element.style.textDecoration.includes('underline')) formats.add('underline');
  const background = element.style.backgroundColor;
  if (tag === 'MARK' || (background && background !== 'transparent' && background !== 'rgba(0, 0, 0, 0)')) {
    formats.add('highlight');
  }
  const foreground = element.getAttribute('color') || element.style.color;
  if (foreground && /(?:#ad322a|rgb\(173,\s*50,\s*42\))/iu.test(foreground)) formats.add('highlight');
  TRANSCRIPT_FORMATS.forEach((format) => {
    if (element.classList.contains(`transcript-format--${format}`)) formats.add(format);
  });
  return formats;
}

function serializeRichEditorNode(node, activeFormats, result) {
  if (node.nodeType === Node.TEXT_NODE) {
    const start = result.text.length;
    result.text += node.nodeValue ?? '';
    activeFormats.forEach((format) => {
      if (result.text.length > start) result.formats.push({ format, start, end: result.text.length });
    });
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const element = node;
  if (element.classList.contains('thought-break')) {
    result.text += '\n\n';
    return;
  }
  if (element.classList.contains('audio-event')) {
    result.text += EVENT_ANNOTATIONS[element.dataset.eventKind] ?? '';
    return;
  }
  if (element.tagName === 'BR') {
    result.text += '\n';
    return;
  }

  const formats = elementFormats(element, activeFormats);
  Array.from(element.childNodes).forEach((child) => serializeRichEditorNode(child, formats, result));
  if (element.classList.contains('transcript-line') || ['DIV', 'P'].includes(element.tagName)) result.text += '\n';
}

function editorContentFromNodes(nodes) {
  const result = { text: '', formats: [] };
  Array.from(nodes).forEach((node) => serializeRichEditorNode(node, new Set(), result));
  return normalizeFormattedTranscript(result.text, result.formats);
}

function serializeEditorNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const element = node;
  if (element.classList.contains('thought-break')) return '\n\n';
  if (element.classList.contains('audio-event')) {
    return EVENT_ANNOTATIONS[element.dataset.eventKind] ?? '';
  }
  if (element.tagName === 'BR') return '\n';

  const contents = Array.from(element.childNodes).map(serializeEditorNode).join('');
  const blockLike = element.classList.contains('transcript-line') || ['DIV', 'P'].includes(element.tagName);
  return blockLike ? `${contents}\n` : contents;
}

function editorText(editor) {
  return editorContentFromNodes(editor.childNodes).text;
}

function markTranscriptDirty() {
  state.transcriptDirty = true;
  elements.resetTranscript.hidden = false;
  setGroupingControlsDisabled(true);
  updateLaughStats();
  updatePageEstimate();
}

function hideFormatToolbar() {
  clearTimeout(formatToolbarTimer);
  elements.textFormatToolbar.hidden = true;
  savedFormattingRange = null;
}

function scheduleFormatToolbar(delay = 120) {
  clearTimeout(formatToolbarTimer);
  formatToolbarTimer = setTimeout(updateFormatToolbar, delay);
}

function updateFormatToolbar() {
  const selection = window.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed) {
    if (!elements.textFormatToolbar.matches(':hover')) hideFormatToolbar();
    return;
  }
  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement;
  const editor = container?.closest('.transcript-copy[contenteditable="true"]');
  if (!editor) {
    hideFormatToolbar();
    return;
  }

  savedFormattingRange = range.cloneRange();
  elements.textFormatToolbar.hidden = false;
  const selectionRect = range.getBoundingClientRect();
  const surfaceRect = elements.textFormatToolbar.offsetParent.getBoundingClientRect();
  const toolbarWidth = elements.textFormatToolbar.offsetWidth;
  const preferredLeft = selectionRect.left - surfaceRect.left + selectionRect.width / 2 - toolbarWidth / 2;
  const maximumLeft = surfaceRect.width / 2 - toolbarWidth - 10;
  elements.textFormatToolbar.style.left = `${Math.max(10, Math.min(maximumLeft, preferredLeft))}px`;
  const offsetBorderTop = elements.textFormatToolbar.offsetParent.clientTop || 0;
  elements.textFormatToolbar.style.top = `${Math.max(8, selectionRect.bottom - surfaceRect.top + 7 - offsetBorderTop)}px`;
  elements.textFormatToolbar.querySelectorAll('[data-format]').forEach((button) => {
    const format = button.dataset.format;
    const active = format === 'highlight'
      ? /(?:#ad322a|rgb\(173,\s*50,\s*42\))/iu.test(String(document.queryCommandValue('foreColor')))
      : document.queryCommandState(format);
    button.setAttribute('aria-pressed', String(active));
  });
}

function applyTranscriptFormat(format) {
  if (!savedFormattingRange || !TRANSCRIPT_FORMATS.includes(format)) return;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(savedFormattingRange);
  const command = format === 'highlight' ? 'foreColor' : format;
  const highlightActive = format === 'highlight'
    && /(?:#ad322a|rgb\(173,\s*50,\s*42\))/iu.test(String(document.queryCommandValue('foreColor')));
  document.execCommand(command, false, format === 'highlight' ? (highlightActive ? '#171713' : '#ad322a') : undefined);
  const container = selection.anchorNode?.nodeType === Node.ELEMENT_NODE
    ? selection.anchorNode
    : selection.anchorNode?.parentElement;
  const editor = container?.closest('.transcript-copy[contenteditable="true"]');
  if (editor) synchronizeEditor(editor);
  scheduleFormatToolbar(0);
}

function synchronizeEditor(editor) {
  const blockIndex = Number(editor.dataset.blockIndex);
  if (!Number.isInteger(blockIndex) || !state.blocks[blockIndex]) return;
  const content = editorContentFromNodes(editor.childNodes);
  state.blocks[blockIndex].text = content.text;
  state.blocks[blockIndex].formats = content.formats;
  markTranscriptDirty();
}

function resetTranscriptEdits() {
  state.blocks = state.originalBlocks.map((block) => ({
    ...block,
    formats: (block.formats ?? []).map((range) => ({ ...range })),
  }));
  state.transcriptDirty = false;
  elements.resetTranscript.hidden = true;
  setGroupingControlsDisabled(false);
  render();
}

function insertNotationAtRange(editor, range, mapping) {
  try {
    clearError();
    const label = EVENT_OPTIONS.find(({ kind }) => kind === mapping.event)?.label ?? mapping.event;
    const mark = makeAudioEventMark({ kind: mapping.event, label });
    range.insertNode(mark);
    range.setStartAfter(mark);
    range.collapse(true);
    const lineBreak = document.createElement('br');
    range.insertNode(lineBreak);
    range.setStartAfter(lineBreak);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    synchronizeEditor(editor);
  } catch {
    showError('That transcript position changed. Place the cursor and press the shortcut again.');
  }
}

function editorTextBeforeRange(editor, range) {
  const prefixRange = range.cloneRange();
  prefixRange.setStart(editor, 0);
  const prefix = prefixRange.cloneContents();
  const serialized = Array.from(prefix.childNodes).map(serializeEditorNode).join('');
  const rangeElement = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer
    : range.startContainer.parentElement;
  const insideRenderedLine = rangeElement?.closest('.transcript-line');
  return insideRenderedLine ? serialized.replace(/\n$/u, '') : serialized;
}

function editorTextAfterRange(editor, range) {
  const suffixRange = range.cloneRange();
  suffixRange.setEnd(editor, editor.childNodes.length);
  const suffix = suffixRange.cloneContents();
  return Array.from(suffix.childNodes).map(serializeEditorNode).join('');
}

function isCaretOnEmptyEditorLine(editor, range, textBeforeCaret) {
  const container = range.startContainer;
  const containerElement = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;
  let line = containerElement?.closest('.transcript-line');
  if (!line && container === editor && range.startOffset > 0) {
    const previousNode = editor.childNodes[range.startOffset - 1];
    line = previousNode?.nodeType === Node.ELEMENT_NODE ? previousNode : null;
  }
  if (line?.classList.contains('transcript-line') && line.textContent.trim() === '') return true;
  return hasTrailingBlankLine(textBeforeCaret);
}

function focusEditorEdge(blockIndex, edge) {
  requestAnimationFrame(() => {
    const editor = elements.blocks.querySelector(`[data-block-index="${blockIndex}"]`);
    if (!editor) return;
    editor.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(edge === 'start');
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
}

function splitEditorBlock(editor, range) {
  const blockIndex = Number(editor.dataset.blockIndex);
  const block = state.blocks[blockIndex];
  if (!block) return;
  const prefixRange = range.cloneRange();
  prefixRange.setStart(editor, 0);
  const suffixRange = range.cloneRange();
  suffixRange.setEnd(editor, editor.childNodes.length);
  const beforeContent = editorContentFromNodes(prefixRange.cloneContents().childNodes);
  const afterContent = editorContentFromNodes(suffixRange.cloneContents().childNodes);
  const before = beforeContent.text;
  const after = afterContent.text;
  const splitMs = approximateSplitTimestamp(
    block.startMs,
    block.endMs,
    Array.from(before).length,
    Array.from(after).length,
  );
  state.blocks.splice(
    blockIndex,
    1,
    { ...block, text: before, formats: beforeContent.formats, endMs: splitMs },
    { ...block, text: after, formats: afterContent.formats, startMs: splitMs },
  );
  markTranscriptDirty();
  render();
  focusEditorEdge(blockIndex + 1, 'start');
}

function mergeEditorBlock(blockIndex, direction) {
  const neighborIndex = direction === 'previous' ? blockIndex - 1 : blockIndex + 1;
  const block = state.blocks[blockIndex];
  const neighbor = state.blocks[neighborIndex];
  if (!block || !neighbor) return;
  const first = direction === 'previous' ? neighbor : block;
  const second = direction === 'previous' ? block : neighbor;
  const mergedIndex = Math.min(blockIndex, neighborIndex);
  const merged = mergeFormattedTranscripts(first, second);
  state.blocks.splice(mergedIndex, 2, {
    ...first,
    text: merged.text,
    formats: merged.formats,
    endMs: second.endMs,
  });
  markTranscriptDirty();
  render();
  focusEditorEdge(mergedIndex, direction === 'previous' ? 'end' : 'start');
}

function activateDocument(filename, source) {
  try {
    state.cues = parseSrt(source);
    state.filename = filename;
    state.transcriptDirty = false;
    state.notes = '';
    elements.notesEditor.replaceChildren();
    clearError();
    elements.printTitle.textContent = titleFromFilename(filename);
    elements.resetTranscript.hidden = true;
    setGroupingControlsDisabled(false);
    if (elements.downloadButton) elements.downloadButton.disabled = false;
    elements.pageEstimate.hidden = false;
    elements.mastheadFile.hidden = false;
    elements.fileStatus.textContent = filename;
    elements.fileStatus.title = filename;
    elements.emptyState.hidden = true;
    elements.documentContent.hidden = false;
    elements.dropZone.dataset.state = 'ready';
    document.body.classList.add('has-document');
    rebuildBlocks();
    updateTitleSize();
    updatePdfFilename();
    render();
    syncNoteRows();
  } catch (error) {
    showError(error instanceof Error ? error.message : 'We could not read this subtitle file.');
  }
}

async function handleFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.srt')) {
    showError('Choose a file ending in .srt.');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showError('This file is larger than 10 MB. Choose a smaller subtitle file.');
    return;
  }
  try {
    activateDocument(file.name, await file.text());
  } catch {
    showError('The file could not be opened. Try saving it as UTF-8.');
  }
}

elements.uploadButton.addEventListener('click', () => elements.fileInput.click());
elements.replaceButton.addEventListener('click', () => elements.fileInput.click());
elements.fileInput.addEventListener('change', () => handleFile(elements.fileInput.files?.[0]));
elements.sampleButton.addEventListener('click', () => activateDocument('sample-standup.srt', sampleSrt));
elements.resetTranscript.addEventListener('click', resetTranscriptEdits);
elements.blocks.addEventListener('keydown', (event) => {
  if (event.isComposing) return;
  const editor = event.target.closest?.('.transcript-copy[contenteditable="true"]');
  const selection = window.getSelection();
  if (!editor || !selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (!range.collapsed || !editor.contains(range.commonAncestorContainer)) return;
  const mapping = mappingForShortcut(state.notation, shortcutFromKeyboardEvent(event));
  if (mapping) {
    event.preventDefault();
    insertNotationAtRange(editor, range, mapping);
    return;
  }
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const blockIndex = Number(editor.dataset.blockIndex);
  const before = editorTextBeforeRange(editor, range);
  const after = editorTextAfterRange(editor, range);

  if (event.key === 'Enter' && !event.shiftKey && isCaretOnEmptyEditorLine(editor, range, before)) {
    event.preventDefault();
    splitEditorBlock(editor, range);
  } else if (event.key === 'Backspace' && normalizeEditedTranscript(before) === '' && blockIndex > 0) {
    event.preventDefault();
    mergeEditorBlock(blockIndex, 'previous');
  } else if (event.key === 'Delete'
    && normalizeEditedTranscript(after) === ''
    && blockIndex < state.blocks.length - 1) {
    event.preventDefault();
    mergeEditorBlock(blockIndex, 'next');
  }
});
elements.blocks.addEventListener('input', (event) => {
  const editor = event.target.closest?.('.transcript-copy[contenteditable="true"]');
  if (!editor) return;
  synchronizeEditor(editor);
});
elements.blocks.addEventListener('pointerdown', (event) => {
  if (!event.target.closest?.('.transcript-copy')) return;
  selectingTranscript = true;
  hideFormatToolbar();
});
document.addEventListener('pointerup', () => {
  if (!selectingTranscript) return;
  selectingTranscript = false;
  scheduleFormatToolbar(0);
});
document.addEventListener('selectionchange', () => {
  if (selectingTranscript) return;
  scheduleFormatToolbar();
});
document.addEventListener('keyup', (event) => {
  if (event.shiftKey || ['Shift', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
    scheduleFormatToolbar(0);
  }
});
elements.textFormatToolbar.addEventListener('pointerdown', (event) => event.preventDefault());
elements.textFormatToolbar.addEventListener('click', (event) => {
  const button = event.target.closest('[data-format]');
  if (button) applyTranscriptFormat(button.dataset.format);
});
elements.blocks.addEventListener('click', (event) => {
  const mark = event.target.closest?.('.audio-event');
  if (!mark) return;
  const editor = mark.closest('.transcript-copy');
  if (mark.dataset.eventKind !== 'censored' && mark.nextSibling?.nodeName === 'BR') mark.nextSibling.remove();
  mark.remove();
  synchronizeEditor(editor);
});
elements.downloadButton?.addEventListener('click', async () => {
  clearError();
  elements.downloadButton.disabled = true;
  elements.downloadButton.setAttribute('aria-busy', 'true');
  setDownloadLabel('Building PDF…');
  try {
    await downloadWorksheetPdf({
      title: currentTitle(),
      blocks: state.blocks,
      notation: state.notation,
      notes: state.notes,
    });
  } catch (error) {
    showError(error instanceof Error ? error.message : 'The PDF could not be created. Try again.');
  } finally {
    elements.downloadButton.disabled = false;
    elements.downloadButton.removeAttribute('aria-busy');
    setDownloadLabel('Download PDF');
  }
});
elements.printTitle.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') event.preventDefault();
});
elements.printTitle.addEventListener('input', () => {
  const characters = Array.from(elements.printTitle.textContent);
  if (characters.length > 200) {
    elements.printTitle.textContent = characters.slice(0, 200).join('');
    const range = document.createRange();
    range.selectNodeContents(elements.printTitle);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
  document.title = currentTitle();
  updateTitleSize();
  updatePdfFilename();
});
elements.printTitle.addEventListener('blur', () => {
  if (!elements.printTitle.textContent.trim()) elements.printTitle.textContent = 'Untitled transcript';
  document.title = currentTitle();
  updateTitleSize();
  updatePdfFilename();
});
elements.notesEditor.addEventListener('input', (event) => {
  if (!event.target.classList.contains('notes-line')) return;
  event.target.value = normalizeNotes(event.target.value).replaceAll('\n', '').slice(0, NOTE_LINE_MAX_LENGTH);
  updateNotesState();
});
elements.notesEditor.addEventListener('keydown', (event) => {
  if (!event.target.classList.contains('notes-line')) return;
  const inputs = noteInputs();
  const index = inputs.indexOf(event.target);
  const direction = event.key === 'ArrowUp' ? -1 : ['Enter', 'ArrowDown'].includes(event.key) ? 1 : 0;
  if (!direction) return;
  event.preventDefault();
  const targetIndex = Math.max(0, index + direction);
  if (targetIndex >= inputs.length) {
    growNotesByOneLine();
    syncNoteRows(targetIndex + 1);
  }
  const target = noteInputs()[targetIndex];
  target?.focus();
  target?.setSelectionRange(target.value.length, target.value.length);
});
elements.notesEditor.addEventListener('paste', (event) => {
  if (!event.target.classList.contains('notes-line')) return;
  const pastedLines = event.clipboardData?.getData('text/plain').replace(/\r\n?/gu, '\n').split('\n') ?? [];
  if (pastedLines.length <= 1) return;
  event.preventDefault();
  const inputs = noteInputs();
  const startIndex = inputs.indexOf(event.target);
  const requiredRows = startIndex + pastedLines.length;
  while (noteInputs().length < requiredRows) growNotesByOneLine(), syncNoteRows(requiredRows);
  pastedLines.forEach((line, offset) => {
    noteInputs()[startIndex + offset].value = line.slice(0, NOTE_LINE_MAX_LENGTH);
  });
  updateNotesState();
  noteInputs()[requiredRows - 1]?.focus();
});
for (const thresholdElement of [elements.pauseThreshold, elements.lineThreshold]) {
  thresholdElement.addEventListener('change', () => {
    if (state.transcriptDirty) return;
    rebuildBlocks();
    render();
  });
}
elements.resetNotation.addEventListener('click', () => {
  state.notation = saveNotation(window.localStorage, DEFAULT_NOTATION);
  renderNotationFields();
  updateNotationDisplay();
  if (state.cues.length) render();
});

for (const eventName of ['dragenter', 'dragover']) {
  window.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add('is-dragging');
  });
}

for (const eventName of ['dragleave', 'drop']) {
  window.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove('is-dragging');
  });
}

window.addEventListener('drop', (event) => handleFile(event.dataTransfer?.files?.[0]));
document.fonts?.ready.then(() => {
  if (state.cues.length) updatePageEstimate();
});
renderNotationFields();
updateNotationDisplay();
updateTitleSize();
updatePdfFilename();
if (new URLSearchParams(window.location.search).has('sample')) activateDocument('sample-standup.srt', sampleSrt);
