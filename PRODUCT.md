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

The user chooses an SRT, sets the silences that start a new line and a new block, personalizes a compact notation legend, edits the paper directly, and downloads the worksheet PDF. On paper, the user extends or annotates those marks and writes their own interpretation without a printed analytical taxonomy.

## Capabilities and Constraints

- Accept one SRT file at a time and process it locally.
- Parse standard timestamps, multiline cues, basic inline formatting, and common speaker labels.
- Render music, applause, and laughter as compact user-selected pictograms inside thin rings. Keep in-sentence censorship as one fixed writing blank, and omit other bracketed audio descriptions and orphan censorship blanks.
- Save each event-to-pictogram-to-shortcut mapping locally in the browser and print the three-event labeled key once on the cover.
- Start a new transcript line after a shorter silence, sentence punctuation, a performance mark, or a natural 7–11-word breath length; create visible space between thought groups and a new worksheet block only after the longer silence threshold.
- Give every block a minimum writing height and increase that height with the block's duration.
- Print the special title on a full ruled front page before the transcript.
- Print the three-pictogram notation map as one horizontal key beneath the title statistics on the front page; do not include censorship in the key.
- Print a larger proof-red start time in the left paper gutter with a compact muted-gray sequential block-number badge centered directly underneath; widen the badge safely for two- and three-digit counts.
- Let the user click any individual rule on the right half and type a fixed-line note directly on the worksheet; display it as quiet italic gray manuscript text, never shift notes on other rules, and include the notes in the downloaded PDF across as many pages as needed.
- Keep the cover title and transcript permanently editable without a separate mode switch or duplicate settings field.
- Scale long edited titles consistently in the preview and generated PDF.
- Show the exact generated PDF filename from the live edited title before download.
- Keep PDF export reachable while scrolling and show the active filename beside the replace action.
- Organize notation, spacing, and download into three separate rounded settings cards without an enclosing sidebar panel.
- Let the user correct transcript text, insert a configured pictogram with a safe captured keyboard shortcut, and click any inserted notation to remove it before export. Ordinary transcript characters never trigger conversion.
- Let the user select transcript text and apply bold, italic, underline, or proof-red emphasis; preserve that formatting through block edits, rerenders, and PDF export.
- Let the user split or merge worksheet blocks directly from the transcript with familiar Enter, Backspace, and Delete behavior.
- Count visible laughter events and print total laughs plus average laughs per minute on the front page.
- Keep every transcript line flush left while separating blocks with space rather than visible horizontal rules.
- Use the special title on the front page and as the browser print title, without repeating it on transcript pages.
- Export through the browser-side PDF generator.
- Do not infer analytical laugh ratings, joke-structure markers, Bone Cards, Desk Maps, bit packets, or formula templates; users own the meaning of their notation signs.
- Saved projects, media playback, automatic analysis, and AI suggestions are outside this version.

## Product Principles

- The page should never tell the analyst what the joke means.
- Silence is the only automatic signal that creates worksheet blocks; punctuation and breath length affect line rhythm only.
- Printed space should follow time while retaining a practical minimum.
- PDF pages should fill naturally from their content; elapsed time never creates an empty page.
- Keep the complete worksheet visible before export.
- Load immediately and keep private files on the device.

## Accessibility & Inclusion

File selection, settings, and export remain keyboard-accessible, readable at narrow widths, and usable with reduced motion.
