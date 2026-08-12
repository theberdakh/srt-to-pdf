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
- Keeps only music, applause, laughter, and in-sentence censorship as user-defined, ringed signs; other bracketed audio descriptions are omitted.
- Saves notation preferences in the browser and repeats their legend on every printed page.
- Starts a new line after the shorter silence threshold, sentence punctuation, or a natural 7–11-word breath length; larger boundaries create clearly separated thought groups.
- Keeps each performance mark at the end of its line and starts following speech on a fresh, paragraph-indented line.
- Gives every block a minimum writing area, then adds space according to its duration.
- Prints the special title on a full ruled front page before the transcript.
- Places each start time above its transcript and keeps a wider ruled formula/notes area on the right.
- Leaves block boundaries open, using writing space instead of separator lines.
- Uses the special title on the front page and as the browser print title, without repeating it on transcript pages.
- Uses the browser’s native “Save as PDF” destination.

The app does not infer laugh ratings or joke structure. Choose the marks that fit your own paper method. No file content is uploaded or stored.
