import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import pdfMake from 'pdfmake';

import { createPdfDefinition } from '../pdf-generator.js';
import { DEFAULT_NOTATION } from '../notation.js';

const projectRoot = resolve(import.meta.dirname, '..');
const outputDirectory = resolve(projectRoot, 'tmp/pdfs');
const outputPath = resolve(outputDirectory, 'subtitle-folio-fixture.pdf');

pdfMake.setUrlAccessPolicy(() => false);
pdfMake.setLocalAccessPolicy((fontPath) => {
  const resolvedPath = resolve(projectRoot, fontPath);
  return resolvedPath.startsWith(`${projectRoot}/assets/`) ||
    resolvedPath.startsWith(`${projectRoot}/node_modules/pdfmake/fonts/`);
});
pdfMake.addFonts({
  FolioLatin: {
    normal: resolve(projectRoot, 'assets/source-serif-4-variable.ttf'),
    bold: resolve(projectRoot, 'assets/source-serif-4-variable.ttf'),
    italics: resolve(projectRoot, 'assets/source-serif-4-variable.ttf'),
    bolditalics: resolve(projectRoot, 'assets/source-serif-4-variable.ttf'),
  },
  FolioCyrillic: {
    normal: resolve(projectRoot, 'assets/source-serif-4-variable.ttf'),
    bold: resolve(projectRoot, 'assets/source-serif-4-variable.ttf'),
    italics: resolve(projectRoot, 'assets/source-serif-4-variable.ttf'),
    bolditalics: resolve(projectRoot, 'assets/source-serif-4-variable.ttf'),
  },
  Roboto: {
    normal: resolve(projectRoot, 'node_modules/pdfmake/fonts/Roboto/Roboto-Regular.ttf'),
    bold: resolve(projectRoot, 'node_modules/pdfmake/fonts/Roboto/Roboto-Medium.ttf'),
    italics: resolve(projectRoot, 'node_modules/pdfmake/fonts/Roboto/Roboto-Italic.ttf'),
    bolditalics: resolve(projectRoot, 'node_modules/pdfmake/fonts/Roboto/Roboto-MediumItalic.ttf'),
  },
});

const blocks = [
  {
    startMs: 62_000,
    endMs: 78_000,
    speaker: '',
    text: 'this is exciting i was a little too excited i panicked\nand got this haircut what an insane [ __ ] up my hair was\nfine it was totally fine [Laughter]\n\nthen two days ago i thought the hair looked good',
  },
  {
    startMs: 84_000,
    endMs: 102_000,
    speaker: 'COMEDIAN',
    text: '[Music] [Applause] Добро пожаловать. Это проверка кириллицы.\nThe transcript remains selectable and the notes stay clear.',
  },
  {
    startMs: 108_000,
    endMs: 168_000,
    speaker: '',
    text: Array.from({ length: 58 }, (_, index) => `logical worksheet line ${index + 1}`).join('\n'),
  },
];

await mkdir(outputDirectory, { recursive: true });
await pdfMake.createPdf(createPdfDefinition({
  title: '[English auto Generated] Shane Gillis Live In Austin Stand Up Comedy — Editable Long Title',
  blocks,
  notation: DEFAULT_NOTATION,
})).write(outputPath);

console.log(outputPath);
