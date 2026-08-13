import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const readProjectFile = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('critical browser assets share the deployment build version', () => {
  const index = readProjectFile('index.html');
  const app = readProjectFile('app.js');
  const workflow = readProjectFile('.github/workflows/pages.yml');

  for (const asset of ['styles.css', 'pdfmake.min.js', 'vfs_fonts.js', 'app.js']) {
    assert.match(index, new RegExp(`${asset.replace('.', '\\.') }\\?v=__BUILD_VERSION__`));
  }

  for (const module of [
    'srt.js',
    'audio-events.js',
    'laugh-stats.js',
    'notation.js',
    'pdf-generator.js',
    'text-formatting.js',
    'title-sizing.js',
    'transcript-edit.js',
    'transcript-layout.js',
  ]) {
    assert.match(app, new RegExp(`${module.replace('.', '\\.') }\\?v=__BUILD_VERSION__`));
  }

  assert.match(workflow, /s\/__BUILD_VERSION__\/\$\{GITHUB_SHA\}\/g/);
  assert.match(workflow, /title-sizing\.js/);
  assert.match(workflow, /text-formatting\.js/);
});

test('transcript formatting controls and block gutters ship together', () => {
  const index = readProjectFile('index.html');
  const app = readProjectFile('app.js');
  const styles = readProjectFile('styles.css');

  assert.match(index, /id="text-format-toolbar"[\s\S]*?data-format="bold"[\s\S]*?data-format="highlight"/);
  assert.match(app, /makeElement\('span', 'block-number'\)/);
  assert.match(app, /makeElement\('span', 'block-number__badge'/);
  assert.match(app, /applyTranscriptFormat/);
  assert.match(styles, /\.block-number__badge[\s\S]*?color: var\(--muted\)/);
  assert.match(styles, /\.transcript-area time[\s\S]*?color: var\(--accent\)/);
  for (const face of ['regular', 'bold', 'italic', 'bold-italic']) {
    assert.match(styles, new RegExp(`source-serif-4-${face}\\.ttf`));
    assert.ok(statSync(new URL(`../assets/source-serif-4-${face}.ttf`, import.meta.url)).size > 100_000);
  }
});

test('download control supports the previous deployed button id', () => {
  const app = readProjectFile('app.js');

  assert.match(app, /querySelector\('#download-button, #print-button'\)/);
  assert.match(app, /elements\.downloadButton\?\.addEventListener/);
});

test('live PDF filename is derived from the edited cover title', () => {
  const index = readProjectFile('index.html');
  const app = readProjectFile('app.js');

  assert.match(index, /id="pdf-filename"/);
  assert.match(app, /pdfFilename\(currentTitle\(\)\)/);
  assert.match(app, /elements\.printTitle\.addEventListener\('input'/);
  assert.match(app, /updatePdfFilename\(\)/);
});

test('settings rail is three separate cards without a collapse shell', () => {
  const index = readProjectFile('index.html');
  const app = readProjectFile('app.js');

  assert.equal((index.match(/class="settings-card/g) ?? []).length, 3);
  assert.doesNotMatch(index, /id="settings-toggle"|class="setting-note"/);
  assert.doesNotMatch(app, /setSettingsCollapsed|settingsToggle/);
});

test('notation selects replace native arrows with the folio chevron', () => {
  const styles = readProjectFile('styles.css');

  assert.match(styles, /\.notation-field select[\s\S]*?appearance: none/);
  assert.match(styles, /background-image: url\("data:image\/svg\+xml/);
  assert.match(styles, /stroke='%2367645c'/);
});

test('the ruled notes half is directly editable and included in PDF export', () => {
  const index = readProjectFile('index.html');
  const app = readProjectFile('app.js');

  assert.match(index, /id="notes-editor"[\s\S]*?aria-label="Worksheet notes"[\s\S]*?role="group"/);
  assert.match(app, /elements\.notesEditor\.addEventListener\('input'/);
  assert.match(app, /createNoteInput/);
  assert.match(app, /notes: state\.notes/);
  assert.match(app, /estimatePdfPageCount\(state\.blocks, state\.notes\)/);
});
