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

The user chooses an SRT, sets the minimum silence that starts a new block, reviews the worksheet, and saves it through the browser's native print dialog. On paper, the user marks laughs with one to three dots and writes their own interpretation without a printed analytical taxonomy.

## Capabilities and Constraints

- Accept one SRT file at a time and process it locally.
- Parse standard timestamps, multiline cues, basic inline formatting, and common speaker labels.
- Create a new block only when the silence between cues reaches the selected threshold.
- Give every block a minimum writing height and increase that height with the block's duration.
- Print the special title on a full ruled front page before the transcript.
- Print each start time above its subtitle and give the wider right-hand lane to formula notes.
- Separate blocks with space rather than visible horizontal rules.
- Use the special title on the front page and as the browser print title, without repeating it on transcript pages.
- Export through native browser print-to-PDF.
- Do not print joke-structure markers, laugh symbols, Bone Cards, Desk Maps, bit packets, or formula templates.
- Transcript editing, saved projects, media playback, automatic analysis, and AI suggestions are outside this version.

## Product Principles

- The page should never tell the analyst what the joke means.
- Silence is the only automatic grouping signal.
- Printed space should follow time while retaining a practical minimum.
- Keep the complete worksheet visible before export.
- Load immediately and keep private files on the device.

## Accessibility & Inclusion

File selection, settings, and export remain keyboard-accessible, readable at narrow widths, and usable with reduced motion.
