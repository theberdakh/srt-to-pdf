import { formatTimestamp, parseSrt, structureCues, titleFromFilename } from './srt.js';
import { countPdfPages } from './pagination.js';
import { eventEndsTranscriptLine, tokenizeTranscript } from './audio-events.js';
import { DEFAULT_NOTATION, NOTATION_FIELDS, loadNotation, saveNotation } from './notation.js';

const elements = {
  blocks: document.querySelector('#blocks'),
  body: document.body,
  documentContent: document.querySelector('#document-content'),
  documentTitle: document.querySelector('#document-title'),
  dropZone: document.querySelector('#drop-zone'),
  emptyState: document.querySelector('#empty-state'),
  error: document.querySelector('#error-message'),
  fileInput: document.querySelector('#file-input'),
  fileStatus: document.querySelector('#file-status'),
  lineThreshold: document.querySelector('#line-threshold'),
  notationFields: document.querySelector('#notation-fields'),
  coverNotationLegend: document.querySelector('#cover-notation-legend'),
  notationLegend: document.querySelector('#notation-legend'),
  notationSummary: document.querySelector('#notation-summary'),
  pauseThreshold: document.querySelector('#pause-threshold'),
  pageEstimate: document.querySelector('#page-estimate'),
  pageTotal: document.querySelector('#page-total'),
  printButton: document.querySelector('#print-button'),
  printTitle: document.querySelector('#print-title'),
  replaceButton: document.querySelector('#replace-button'),
  resetNotation: document.querySelector('#reset-notation'),
  sampleButton: document.querySelector('#sample-button'),
  uploadButton: document.querySelector('#upload-button'),
};

const state = {
  cues: [],
  filename: '',
  notation: loadNotation(window.localStorage),
};

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

function observeRuledSurfaces() {
  ruleObserver.disconnect();
  document.querySelectorAll('.cover-lines, .formula-notes').forEach((element) => {
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
  mark.title = event.label;
  mark.textContent = state.notation[event.kind] ?? '';
  return mark;
}

function appendTranscript(paragraph, text) {
  const tokens = tokenizeTranscript(text);
  paragraph.classList.toggle('transcript-events-only', tokens.length > 0 && tokens.every(({ type }) => type === 'event'));
  let line = makeElement('span', 'transcript-line');
  let indentNextSpeechLine = false;
  let eventClusterEndsLine = false;

  const finishLine = (addThoughtBreak = false) => {
    if (line.childNodes.length) paragraph.append(line);
    if (addThoughtBreak && paragraph.childNodes.length) paragraph.append(makeElement('span', 'thought-break'));
    line = makeElement('span', 'transcript-line');
  };

  tokens.forEach((token, tokenIndex) => {
    if (token.type === 'event') {
      line.append(makeAudioEventMark(token));
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
      if (!part) return;
      if (!line.childNodes.length && indentNextSpeechLine) {
        line.classList.add('transcript-line--after-event');
        indentNextSpeechLine = false;
      }
      line.append(line.childNodes.length ? part : part.replace(/^\s+/u, ''));
    });
  });

  finishLine();
}

function updateNotationDisplay() {
  elements.notationLegend.replaceChildren();
  elements.coverNotationLegend.replaceChildren();
  elements.notationSummary.replaceChildren();
  NOTATION_FIELDS.forEach(({ kind, label }) => {
    const sign = state.notation[kind];
    if (!sign) return;
    const isCensored = kind === 'censored';
    const item = makeElement('span', 'notation-legend__item');
    item.append(
      makeElement('b', isCensored ? 'notation-legend__blank' : 'notation-mark', sign),
      makeElement('span', '', label),
    );
    elements.notationLegend.append(item);
    elements.coverNotationLegend.append(item.cloneNode(true));
    elements.notationSummary.append(makeElement(
      'span',
      isCensored ? 'notation-summary__blank' : 'notation-mark notation-summary__mark',
      sign,
    ));
  });
}

function renderNotationFields() {
  elements.notationFields.replaceChildren();
  NOTATION_FIELDS.forEach(({ kind, label, maxLength }) => {
    const field = makeElement('label', 'notation-field');
    const input = makeElement('input');
    input.type = 'text';
    input.maxLength = maxLength;
    input.value = state.notation[kind];
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', `${label} sign`);
    input.addEventListener('input', () => {
      state.notation = saveNotation(window.localStorage, { ...state.notation, [kind]: input.value });
      input.value = state.notation[kind];
      updateNotationDisplay();
      if (state.cues.length) render();
    });
    field.append(makeElement('span', '', label), input);
    elements.notationFields.append(field);
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

function blockHeightMm(block) {
  const durationSeconds = Math.max(1, (block.endMs - block.startMs) / 1000);
  return Math.min(76, Math.round(28 + durationSeconds * 0.65));
}

function measurePrintBlockHeights() {
  const measurement = makeElement('div', 'pdf-measure');
  measurement.setAttribute('aria-hidden', 'true');
  Array.from(elements.blocks.children).forEach((block) => measurement.append(block.cloneNode(true)));
  elements.body.append(measurement);
  const millimetresPerCssPixel = 25.4 / 96;
  const heights = Array.from(measurement.children, (block) => (
    block.getBoundingClientRect().height * millimetresPerCssPixel
  ));
  measurement.remove();
  return heights;
}

function updatePageEstimate() {
  const pageCount = countPdfPages(measurePrintBlockHeights());
  elements.pageTotal.textContent = `${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`;
}

function render() {
  if (!state.cues.length) return;
  const threshold = pauseThresholdMs();
  const lineThreshold = lineThresholdMs(threshold);
  const blocks = structureCues(state.cues, threshold, lineThreshold)
    .filter((block) => tokenizeTranscript(block.text).length > 0);
  const duration = state.cues.at(-1).endMs;
  const hasHours = duration >= 3_600_000;

  elements.pauseThreshold.value = String(threshold / 1000);
  elements.blocks.replaceChildren();
  blocks.forEach((block, index) => {
    const section = makeElement('section', 'worksheet-block');
    section.style.setProperty('--block-height', `${blockHeightMm(block)}mm`);

    const transcript = makeElement('div', 'transcript-area');
    transcript.append(makeElement('time', '', formatTimestamp(block.startMs, hasHours)));
    if (block.speaker) transcript.append(makeElement('h3', '', block.speaker));
    const paragraph = makeElement('p');
    appendTranscript(paragraph, block.text);
    transcript.append(paragraph);

    const notes = makeElement('aside', 'formula-notes');
    notes.setAttribute('aria-label', `Formula and handwritten notes for block ${index + 1}`);
    section.append(transcript, notes);
    elements.blocks.append(section);
  });

  const title = elements.documentTitle.value.trim() || 'Untitled transcript';
  elements.printTitle.textContent = title;
  document.title = title;
  observeRuledSurfaces();
  updatePageEstimate();
}

function activateDocument(filename, source) {
  try {
    state.cues = parseSrt(source);
    state.filename = filename;
    clearError();
    elements.documentTitle.value = titleFromFilename(filename);
    elements.documentTitle.disabled = false;
    elements.printButton.disabled = false;
    elements.pageEstimate.hidden = false;
    elements.replaceButton.hidden = false;
    elements.fileStatus.textContent = filename;
    elements.fileStatus.title = filename;
    elements.emptyState.hidden = true;
    elements.documentContent.hidden = false;
    elements.dropZone.dataset.state = 'ready';
    elements.body.classList.add('has-document');
    render();
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
elements.printButton.addEventListener('click', () => window.print());
elements.documentTitle.addEventListener('input', render);
elements.pauseThreshold.addEventListener('change', render);
elements.lineThreshold.addEventListener('change', render);
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
window.addEventListener('beforeprint', () => {
  document.querySelectorAll('.cover-lines, .formula-notes').forEach(balanceRules);
});
document.fonts?.ready.then(() => {
  if (state.cues.length) updatePageEstimate();
});
renderNotationFields();
updateNotationDisplay();
if (new URLSearchParams(window.location.search).has('sample')) activateDocument('sample-standup.srt', sampleSrt);
