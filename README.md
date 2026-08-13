# Subtitle Folio

A small local browser app that turns a stand-up SRT into a pause-based, pen-ready worksheet.

## Use online

[Open Subtitle Folio](https://berdakh.uz/srt-to-pdf/). The SRT is processed entirely in your browser and is not uploaded or stored.

## Run

No install or build step is required.

```bash
npm start
```

Open [http://localhost:4173](http://localhost:4173).

To compare the seven audio-event notation treatments on identical A4 pages, open [http://localhost:4173/event-styles.html](http://localhost:4173/event-styles.html).

## Test

```bash
npm test
```

## How it works

- Reads one `.srt` locally in the browser.
- Keeps music, applause, and laughter as selectable ringed pictograms; in-sentence censorship stays a fixed writing blank and other bracketed descriptions are omitted.
- Maps each pictogram to an imported subtitle event and a safe keyboard shortcut, saves those mappings in the browser, and prints their key once on the cover.
- Starts a new line after the shorter silence threshold, sentence punctuation, or a natural 7–11-word breath length; larger boundaries create clearly separated thought groups.
- Keeps each performance mark at the end of its line and starts following speech on a fresh flush-left line.
- Gives every block a minimum writing area, then adds space according to its duration.
- Prints the special title on a full ruled front page before the transcript.
- Places each larger proof-red start time in the left gutter with a compact muted-gray block-number badge centered directly underneath; the badge widens for two- and three-digit counts.
- Lets you select transcript words and apply bold, italic, underline, or proof-red emphasis; formatting survives editing and PDF export.
- Lets you click any rule on the right half and type an independent quiet italic gray note without pushing notes on other lines; those notes are included in the downloaded PDF.
- Leaves block boundaries open, using writing space instead of separator lines.
- Uses the special title on the front page and as the browser/PDF title, with a compact header on transcript pages.
- Generates and downloads the A4 PDF entirely in the browser.

The app does not infer laugh ratings or joke structure. Choose the marks that fit your own paper method. No file content is uploaded or stored.
