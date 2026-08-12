import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readProjectFile = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('critical browser assets share the deployment build version', () => {
  const index = readProjectFile('index.html');
  const app = readProjectFile('app.js');
  const workflow = readProjectFile('.github/workflows/pages.yml');

  for (const asset of ['styles.css', 'pdfmake.min.js', 'vfs_fonts.js', 'app.js']) {
    assert.match(index, new RegExp(`${asset.replace('.', '\\.') }\\?v=__BUILD_VERSION__`));
  }

  for (const module of ['srt.js', 'audio-events.js', 'notation.js', 'pdf-generator.js', 'transcript-layout.js']) {
    assert.match(app, new RegExp(`${module.replace('.', '\\.') }\\?v=__BUILD_VERSION__`));
  }

  assert.match(workflow, /s\/__BUILD_VERSION__\/\$\{GITHUB_SHA\}\/g/);
});

test('download control supports the previous deployed button id', () => {
  const app = readProjectFile('app.js');

  assert.match(app, /querySelector\('#download-button, #print-button'\)/);
  assert.match(app, /elements\.downloadButton\?\.addEventListener/);
});
