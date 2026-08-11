# Subtitle Folio

A small local browser app that turns a stand-up SRT into a pause-based, pen-ready worksheet.

## Use online

[Open Subtitle Folio](https://theberdakh.github.io/srt-to-pdf/). The SRT is processed entirely in your browser and is not uploaded or stored.

## Run

No install or build step is required.

```bash
npm start
```

Open [http://localhost:4173](http://localhost:4173).

## Test

```bash
npm test
```

## How it works

- Reads one `.srt` locally in the browser.
- Starts a new worksheet block only after the selected amount of silence.
- Gives every block a minimum writing area, then adds space according to its duration.
- Prints the special title on a full ruled front page before the transcript.
- Places each start time above its transcript and keeps a wider ruled formula/notes area on the right.
- Leaves block boundaries open, using writing space instead of separator lines.
- Uses the special title on the front page and as the browser print title, without repeating it on transcript pages.
- Uses the browser’s native “Save as PDF” destination.

There are no printed laugh or joke-structure symbols. Mark laughs with your own one-to-three dots on paper. No file content is uploaded or stored.
