# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Plain HTML, CSS, and JavaScript. There is no framework, build step, backend, runtime dependency, or file upload.

## Users

People who print stand-up transcripts and analyze them by hand while watching a special.

## Product Purpose

Turn one SRT file into the simplest useful paper worksheet: a titled, ruled front page followed by speech grouped by silence with ruled space for formulas or other notes.

## Operating Context

The user chooses an SRT, sets the silences that start a new line and a new block, personalizes a compact notation legend, reviews the worksheet, and saves it through the browser's native print dialog. On paper, the user extends or annotates those marks and writes their own interpretation without a printed analytical taxonomy.

## Capabilities and Constraints

- Accept one SRT file at a time and process it locally.
- Parse standard timestamps, multiline cues, basic inline formatting, and common speaker labels.
- Render only music, applause, laughter, and in-sentence censorship as compact user-defined signs inside thin rings; omit other bracketed audio descriptions and orphan censorship blanks.
- Save the user's notation signs locally in the browser and repeat their legend on every printed page.
- Start a new transcript line after a shorter silence, sentence punctuation, a performance mark, or a natural 7–11-word breath length; create visible space between thought groups and a new worksheet block only after the longer silence threshold.
- Give every block a minimum writing height and increase that height with the block's duration.
- Print the special title on a full ruled front page before the transcript.
- Print the four-sign notation map beside the title on the front page.
- Print each start time above its subtitle and give the wider right-hand lane to formula notes.
- Mark every elapsed video minute inside the transcript without tying time to page breaks.
- Separate blocks with space rather than visible horizontal rules.
- Use the special title on the front page and as the browser print title, without repeating it on transcript pages.
- Export through native browser print-to-PDF.
- Do not infer analytical laugh ratings, joke-structure markers, Bone Cards, Desk Maps, bit packets, or formula templates; users own the meaning of their notation signs.
- Transcript editing, saved projects, media playback, automatic analysis, and AI suggestions are outside this version.

## Product Principles

- The page should never tell the analyst what the joke means.
- Silence is the only automatic signal that creates worksheet blocks; punctuation and breath length affect line rhythm only.
- Printed space should follow time while retaining a practical minimum.
- PDF pages should fill naturally from their content; elapsed time never creates an empty page.
- Keep the complete worksheet visible before export.
- Load immediately and keep private files on the device.

## Accessibility & Inclusion

File selection, settings, and export remain keyboard-accessible, readable at narrow widths, and usable with reduced motion.
