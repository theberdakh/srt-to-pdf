---
name: Subtitle Folio
description: A quiet pause-based stand-up transcript worksheet for handwritten analysis.
colors:
  proof-red: "#ad322a"
  proof-red-deep: "#8e251f"
  paper: "#fffdfa"
  canvas: "#f2efe7"
  panel: "#ebe7de"
  preview-bed: "#d8d2c5"
  ink: "#171713"
  muted-ink: "#67645c"
  rule: "#cfc8ba"
  soft-rule: "#e5dfd4"
  focus-blue: "#116bb5"
typography:
  display:
    fontFamily: "Folio Serif, Georgia, serif"
    fontSize: "4rem"
    fontWeight: 500
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  document-title:
    fontFamily: "Folio Serif, Georgia, serif"
    fontSize: "2.5rem"
    fontWeight: 500
    lineHeight: 1.04
  manuscript:
    fontFamily: "Folio Serif, Georgia, serif"
    fontSize: "1.02rem"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "ui-sans-serif, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  control:
    fontFamily: "ui-sans-serif, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 720
    lineHeight: 1.2
  metadata:
    fontFamily: "ui-sans-serif, sans-serif"
    fontSize: "0.68rem"
    fontWeight: 400
    lineHeight: 1.35
rounded:
  field: "8px"
  control: "12px"
  surface: "14px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "24px"
  lg: "48px"
  xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.proof-red}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    height: "48px"
  button-export:
    backgroundColor: "{colors.ink}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    height: "48px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    height: "40px"
---

# Design System: Subtitle Folio

## Overview

**Creative North Star: “The Unprescribed Worksheet”**

Subtitle Folio prints evidence and leaves interpretation to the analyst. The interface contains one grouping rule—silence—and the paper contains only a titled ruled front page, transcript, time, and ruled notes. Warm paper and an editorial serif make long reading comfortable; proof red is restricted to the file action and time anchors.

## Layout

Before upload, the title and file choice lead. After upload, the introduction disappears and a 270px settings rail sits beside the paper preview. The settings rail contains a generous wrapping title editor, line and block silence thresholds, a collapsed personal-notation editor, and export.

The printed document begins with the special title and a full ruled page. The title does not repeat on transcript pages. Each worksheet block has two regions: the transcript with its start time directly above it, and a wider ruled formula/notes lane. Blocks are separated by writing space rather than visible horizontal rules. A block has a 16mm base height plus 0.35mm per second of content, capped at 48mm; text expands it whenever needed. Pages fill naturally from these blocks rather than reserving a fixed amount of video time.

At phone widths the transcript stays first, while the ruled notes move beneath it. The browser-side PDF generator restores the right-hand notes lane, uses fixed A4 geometry, splits unusually long blocks into safe continuations, and keeps ordinary blocks together when possible.

## Typography

Folio Serif is reserved for the opening statement, document title, and transcript. The system sans carries controls, metadata, and timestamps. Transcript copy prints at 10.2pt.

## Color and Material

The palette is warm paper, graphite controls, black ink, and one proof-red annotation voice. Fine neutral rules are functional writing guides. Each ruled surface distributes lines from the centers of equal-height rows, leaving identical space above the first line and below the last. The workbench and paper use soft offset shadows in the browser; print removes all depth.

## Components

- **Title editor:** a tall, wrapping text area for comfortably editing long special titles.
- **Personal notation:** users can assign up to three characters to music, applause, and laughter. Those signs print inside a thin ring so even punctuation cannot be confused with dialogue. Censorship remains an eight-character writing line. Defaults are `#`, `$`, `)`, and `________`; choices persist only in local browser storage.
- **Notation map:** the active signs and meanings appear once beside the title on the front page. Transcript pages use that space for a compact title header and keep only page numbering in the footer.
- **Direct PDF export:** one click creates and downloads the A4 worksheet entirely in the browser. The file uses embedded fonts, selectable text, fixed page margins, and a footer owned by the document rather than the browser, so no local URL or browser header is printed.
- **Natural pagination:** transcript blocks fill each available page in order. Time never forces a page break; only content geometry and unusually long safe continuations control pagination.
- **Minute markers:** a compact proof-red divider marks `1 MIN`, `2 MIN`, `3 MIN`, and later elapsed-video milestones at the nearest safe transcript line. It stays inside the transcript lane, keeps the notes lane clear, and never appears alone at the bottom of a page.
- **Transcript rhythm:** a shorter silence threshold, sentence punctuation, performance marks, and a 7–11-word breath length create readable lines sized for the transcript column. Stronger boundaries add visible thought-group spacing. Only the longer silence threshold, defaulting to 2.5 seconds, creates a new block and writing area.
- **After-event line:** speech following a music, applause, or laughter mark begins on a modest paragraph indent, making the event boundary immediately scannable without shifting ordinary breath lines. Censorship stays inline as a word replacement.
- **Front page:** the special title with transcript duration in minutes, its compact four-sign notation map, and a bounded writing area that leaves a clean lower margin and never spills onto the transcript page.
- **Worksheet block:** start time above the transcript and a wide right-hand ruled notes lane that always spans the complete transcript block. The center divider stops for a small clean gap between completed blocks, but remains continuous through internal continuations of one oversized block.
- **Paper preview:** one continuous document whose browser geometry matches the natural print flow.

## Rules

- Do not add analytical laugh ratings, joke classifications, prompts, formulas, bit identities, or semantic guesses; audio-event marks only represent annotations already present in the SRT.
- Do not split on speaker, character count, or elapsed duration; silence alone creates a new block.
- Keep the notes lane visually quieter than the transcript.
- Keep personal notation inline and subordinate to speech; never let bracketed descriptions occupy transcript lines when the user's compact mark can carry them.
- Preserve keyboard focus, local processing, responsive reading, and direct browser-side PDF export without uploads or external font requests.
