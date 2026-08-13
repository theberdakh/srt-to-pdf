import {
  DEFAULT_NOTATION,
  EVENT_OPTIONS,
  PICTOGRAM_OPTIONS,
  loadNotation,
  notationForEvent,
  saveNotation,
} from './notation.js?v=__BUILD_VERSION__';

let notation = typeof window === 'undefined' ? DEFAULT_NOTATION : loadNotation(window.localStorage);

export const transcript = [
  {
    time: '00:12',
    events: [
      { kind: 'music', label: 'Music', position: 0.06 },
      { kind: 'applause', label: 'Applause', position: 0.13 },
      { kind: 'music', label: 'Music', position: 0.2 },
      { kind: 'applause', label: 'Applause', position: 0.27 },
    ],
    segments: [
      { event: 'music', label: 'Music' }, { event: 'applause', label: 'Applause' },
      { event: 'music', label: 'Music' }, { event: 'applause', label: 'Applause' },
      { text: 'Good evening, Austin. It is wonderful to be here.' },
    ],
  },
  {
    time: '00:28',
    events: [{ kind: 'laughter', label: 'Laughter', position: 0.58 }],
    segments: [
      { text: 'I told my therapist I needed a second opinion. ' },
      { event: 'laughter', label: 'Laughter' },
      { text: ' She said, “Fine. You are also impatient.”' },
    ],
  },
  {
    time: '00:47',
    events: [
      { kind: 'censored', label: 'Censored word', position: 0.48 },
      { kind: 'laughter', label: 'Laughter', position: 0.82 },
    ],
    segments: [
      { text: 'My mother called the review ' },
      { event: 'censored', label: 'Censored word' },
      { text: ' and asked whether I could use it on the poster. ' },
      { event: 'laughter', label: 'Laughter' },
    ],
  },
  {
    time: '01:09',
    events: [
      { kind: 'music', label: 'Music', position: 0.04 },
      { kind: 'applause', label: 'Applause', position: 0.88 },
    ],
    segments: [
      { event: 'music', label: 'Music' },
      { text: ' That is the first honest review I have received all year. ' },
      { event: 'applause', label: 'Applause' },
    ],
  },
  {
    time: '01:31',
    events: [
      { kind: 'applause', label: 'Applause', position: 0.42 },
      { kind: 'censored', label: 'Censored word', position: 0.7 },
    ],
    segments: [
      { text: 'Then my phone rang during the show. ' },
      { event: 'applause', label: 'Applause' },
      { text: ' I answered, but all we heard was ' },
      { event: 'censored', label: 'Censored word' },
      { text: '.' },
    ],
  },
  {
    time: '01:52',
    events: [
      { kind: 'applause', label: 'Applause', position: 0.18 },
      { kind: 'music', label: 'Music', position: 0.78 },
    ],
    segments: [
      { event: 'applause', label: 'Applause' },
      { text: ' Thank you, everybody. You have been extremely specific. ' },
      { event: 'music', label: 'Music' },
    ],
  },
];

export const approaches = [
  { id: 'inline', name: 'Inline signs', rule: 'Every annotation stays at its exact position as a small handwritten mark.' },
  { id: 'superscript', name: 'Superscript signs', rule: 'Personal signs sit above the reading line like quiet editorial proof marks.' },
  { id: 'gutter', name: 'Event gutter', rule: 'All events leave the prose and collect in a narrow rail beside each block.' },
  { id: 'timeline', name: 'Mini timeline', rule: 'Marks sit on a vertical time track according to when each event occurs.' },
  { id: 'summary', name: 'Block summary', rule: 'Each event type appears once beside the timestamp; position and repetition disappear.' },
  { id: 'proof', name: 'Abstract proof marks', rule: 'Simple geometry replaces illustrative icons and relies on a single legend.' },
  { id: 'hybrid', name: 'Semantic hybrid', rule: 'Music, applause, and laughter move to the gutter; censored speech stays inline.' },
];

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(kind, label, className = '') {
  const ringClass = kind === 'censored' ? '' : 'notation-mark';
  const mark = element('span', `event-icon event-icon--${kind} ${ringClass} ${className}`.trim());
  mark.setAttribute('role', 'img');
  mark.setAttribute('aria-label', label);
  mark.title = label;
  mark.textContent = notationForEvent(notation, kind);
  return mark;
}

function proofMark(kind, label) {
  const mark = element('span', `proof-mark proof-mark--${kind}`);
  mark.setAttribute('role', 'img');
  mark.setAttribute('aria-label', label);
  mark.title = label;
  return mark;
}

function uniqueEvents(events) {
  const seen = new Set();
  return events.filter(({ kind }) => {
    if (seen.has(kind)) return false;
    seen.add(kind);
    return true;
  });
}

function appendSegments(target, block, approach) {
  for (const segment of block.segments) {
    if (segment.text) {
      target.append(segment.text);
      continue;
    }

    if (approach === 'proof') target.append(proofMark(segment.event, segment.label));
    else target.append(icon(segment.event, segment.label, approach === 'superscript' ? 'event-icon--superscript' : ''));
  }
}

function appendTextWithoutEvents(target, block) {
  block.segments.forEach((segment) => {
    if (segment.text) target.append(segment.text);
  });
}

function makeGutter(block, approach) {
  const gutter = element('aside', `event-rail event-rail--${approach}`);
  gutter.setAttribute('aria-label', 'Audio events');
  const events = approach === 'hybrid'
    ? uniqueEvents(block.events.filter(({ kind }) => kind !== 'censored'))
    : uniqueEvents(block.events);
  events.forEach((event) => gutter.append(icon(event.kind, event.label)));
  return gutter;
}

function makeTimeline(block) {
  const timeline = element('aside', 'event-timeline');
  timeline.setAttribute('aria-label', 'Audio event timeline');
  uniqueEvents(block.events).forEach((event) => {
    const mark = icon(event.kind, event.label);
    mark.style.setProperty('--event-position', `${event.position * 100}%`);
    timeline.append(mark);
  });
  return timeline;
}

function makeBlock(block, approach) {
  const row = element('section', `specimen-block specimen-block--${approach}`);
  const transcriptArea = element('div', 'specimen-transcript');
  const header = element('header', 'block-header');
  header.append(element('time', '', block.time));

  if (approach === 'summary') {
    const summary = element('span', 'event-summary');
    uniqueEvents(block.events).forEach((event) => summary.append(icon(event.kind, event.label)));
    header.append(summary);
  }

  transcriptArea.append(header);
  const copyRow = element('div', 'copy-row');
  const paragraph = element('p');

  if (approach === 'inline' || approach === 'superscript' || approach === 'proof') {
    appendSegments(paragraph, block, approach);
  } else if (approach === 'hybrid') {
    for (const segment of block.segments) {
      if (segment.text) paragraph.append(segment.text);
      else if (segment.event === 'censored') paragraph.append(icon(segment.event, segment.label));
    }
  } else {
    appendTextWithoutEvents(paragraph, block);
  }

  if (approach === 'gutter' || approach === 'hybrid') copyRow.append(makeGutter(block, approach));
  if (approach === 'timeline') copyRow.append(makeTimeline(block));
  copyRow.append(paragraph);
  transcriptArea.append(copyRow);

  const notes = element('aside', 'specimen-notes');
  notes.setAttribute('aria-label', 'Handwritten notes area');
  row.append(transcriptArea, notes);
  return row;
}

function makeLegend(approach) {
  const legend = element('footer', 'specimen-legend');
  const items = [
    ['music', 'music'], ['applause', 'applause'], ['laughter', 'laughter'],
  ];
  items.forEach(([kind, label]) => {
    const item = element('span');
    item.append(approach === 'proof' ? proofMark(kind, label) : icon(kind, label), label);
    legend.append(item);
  });
  return legend;
}

function makePage(approach, index) {
  const page = element('article', `comparison-page comparison-page--${approach.id}`);
  page.setAttribute('aria-labelledby', `approach-${approach.id}`);

  const header = element('header', 'specimen-header');
  const titleGroup = element('div');
  titleGroup.append(
    element('h1', '', approach.name),
    element('p', '', approach.rule),
  );
  titleGroup.querySelector('h1').id = `approach-${approach.id}`;
  header.append(titleGroup, element('span', 'page-number', `${index + 1} / ${approaches.length}`));
  page.append(header);

  const blocks = element('div', 'specimen-blocks');
  transcript.forEach((block) => blocks.append(makeBlock(block, approach.id)));
  page.append(blocks, makeLegend(approach.id));
  return page;
}

function renderComparison() {
  const pages = document.querySelector('#comparison-pages');
  pages.replaceChildren();
  approaches.forEach((approach, index) => pages.append(makePage(approach, index)));
}

function renderNotationEditor() {
  const fields = document.querySelector('#comparison-notation-fields');
  fields.replaceChildren();
  updateNotationSummary();

  EVENT_OPTIONS.forEach(({ kind, label }) => {
    const field = element('label', 'comparison-notation-field');
    const input = element('select');
    PICTOGRAM_OPTIONS.forEach((value) => {
      const option = element('option', '', value);
      option.value = value;
      input.append(option);
    });
    input.value = notationForEvent(notation, kind);
    input.setAttribute('aria-label', `${label} pictogram`);
    input.addEventListener('change', () => {
      const mappings = notation.mappings.map((mapping) => (
        mapping.event === kind ? { ...mapping, pictogram: input.value } : { ...mapping }
      ));
      notation = saveNotation(window.localStorage, { mappings });
      updateNotationSummary();
      renderComparison();
    });
    field.append(element('span', '', label), input);
    fields.append(field);
  });
}

function updateNotationSummary() {
  const summary = document.querySelector('#comparison-notation-summary');
  summary.replaceChildren();
  EVENT_OPTIONS.forEach(({ kind }) => {
    const sign = notationForEvent(notation, kind);
    if (!sign) return;
    summary.append(element(
      'span',
      kind === 'censored' ? 'comparison-summary__blank' : 'notation-mark comparison-summary__mark',
      sign,
    ));
  });
}

if (typeof document !== 'undefined') {
  renderNotationEditor();
  renderComparison();
  document.querySelector('#comparison-reset-notation').addEventListener('click', () => {
    notation = saveNotation(window.localStorage, DEFAULT_NOTATION);
    renderNotationEditor();
    renderComparison();
  });
}
