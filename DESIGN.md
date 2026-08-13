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

Subtitle Folio prints evidence and leaves interpretation to the analyst. The interface contains one grouping rule—silence—and the paper contains only a titled ruled front page, transcript, block references, time, and ruled notes. Warm paper and an editorial serif make long reading comfortable; proof red identifies primary references and deliberate editorial emphasis.

## Layout

Before upload, the title and file choice lead. After upload, the introduction disappears and a compact settings rail sits beside the paper preview. The rail is three separate rounded surfaces: notation, spacing, and PDF download. It has no enclosing panel, collapse control, internal dividers, or explanatory timing note. The download surface stays at the bottom of the viewport while the transcript scrolls. The active filename and Replace file action sit together in the masthead. The paper itself is always editable, including its cover title.

The printed document begins with the special title and a full ruled page. Transcript pages are divided once: speech occupies the left half and uninterrupted horizontal writing rules fill the right half from top to bottom. The right field is a page surface, never a stack of block-owned note areas. Every rule is an independent direct note line: clicking anywhere on the ruled field selects that exact line, Enter advances without shifting existing notes, and the resulting quiet italic gray manuscript flows into the downloaded PDF. A larger proof-red timestamp occupies the left gutter with a compact muted-gray sequential block-number badge centered directly underneath. The outlined badge grows from a circle into a short capsule for multi-digit counts. Neither consumes a transcript row. Blocks are separated by writing space rather than visible rules. A block has a 16mm base height plus 0.35mm per second of content, capped at 48mm; text expands it whenever needed. Pages fill naturally from these blocks rather than reserving a fixed amount of video time.

At phone widths the transcript stays first, while the ruled notes move beneath it. The browser-side PDF generator restores the right-hand notes lane, uses fixed A4 geometry, splits unusually long blocks into safe continuations, and keeps ordinary blocks together when possible.

## Typography

Folio Serif is reserved for the opening statement, document title, transcript, and digital notes. Its real regular, bold, italic, and bold-italic faces preserve editorial emphasis in both browser and PDF. The system sans carries controls, metadata, and timestamps. Transcript copy prints at 10.2pt.

## Color and Material

The palette is warm paper, graphite controls, black ink, and one proof-red annotation voice. Fine neutral rules are functional writing guides. Each ruled surface distributes lines from the centers of equal-height rows, leaving identical space above the first line and below the last. The workbench and paper use soft offset shadows in the browser; print removes all depth.

## Components

- **Inline title editor:** the cover title is the title control. It wraps naturally, accepts up to 200 characters, and scales through three shared length tiers in both preview and PDF. The downloaded filename and PDF title stay synchronized without duplicating the field in settings.
- **Notation mapper:** three table rows connect a selectable pictogram, a captured safe shortcut, and one imported subtitle event: `[music]`, `[applause]`, or `[laugh]`. The palette contains compact letters and monochrome symbols that remain legible in print. Shortcuts must use Tab, a function key, or a modifier such as Alt, Ctrl, or Command, so ordinary transcript characters never become commands. Defaults are `# / Alt+1`, `$ / Alt+2`, and `) / Alt+3`; mappings persist only in local browser storage. Censorship keeps a fixed thin writing blank and has no setting.
- **Notation map:** the three active pictograms and meanings appear once as a compact horizontal key beneath the title statistics on the front page. Censorship is omitted. Transcript pages contain no repeated key and keep only the title header and page numbering.
- **Direct PDF export:** one click creates and downloads the A4 worksheet entirely in the browser. The sticky desktop export area remains visible while reviewing long transcripts and shows the exact sanitized PDF filename derived from the live cover title. The file uses embedded fonts, selectable text, fixed page margins, and a footer owned by the document rather than the browser, so no local URL or browser header is printed.
- **Natural pagination:** transcript blocks fill each available page in order. Time never forces a page break; only content geometry and unusually long safe continuations control pagination.
- **Transcript editor:** rendered speech is always directly correctable, with no mode switch or editing card. After a text selection finishes, a short horizontal toolbar appears beneath it for bold, italic, underline, and proof-red emphasis; familiar keyboard shortcuts remain available, and range-based formatting survives block splits, merges, rerenders, and PDF export. Pressing a mapped shortcut inserts its pictogram and finishes the line; censorship stays inline automatically. Typing punctuation or ordinary symbols always remains transcript text, and clicking any visual event removes it. Enter adds a flush-left internal line, while Enter on an already empty line splits the current worksheet block; Backspace at a block start or Delete at its end merges adjacent blocks. Grouping controls pause after the transcript diverges from the original SRT so a threshold change cannot silently erase edits.
- **Laugh summary:** every visible laughter event counts once, whether imported or manually inserted. The front page updates immediately with `total laughs · laughs/min`, using the exact subtitle runtime; no dashboard or inferred intensity is introduced.
- **Transcript rhythm:** a shorter silence threshold, sentence punctuation, performance marks, and a 7–11-word breath length create readable lines sized for the transcript column. Stronger boundaries add visible thought-group spacing. Only the longer silence threshold, defaulting to 2.5 seconds, creates a new block and writing area.
- **Flush-left transcript:** internal lines and speech following performance marks share one left edge. Line breaks carry rhythm without paragraph indentation. Censorship stays inline as a word replacement.
- **Front page:** the special title with transcript duration in minutes, its compact three-pictogram notation map, and a bounded writing area that leaves a clean lower margin and never spills onto the transcript page.
- **Worksheet page:** larger proof-red start times sit in the left paper gutter beside their first transcript line, with small outlined muted-gray block-number badges centered underneath. The right half is one page-level field of horizontal writing rules with no vertical divider, block seams, or content-dependent gaps.
- **Digital notes:** the ruled half is a permanently available grid of independent single-line editors rather than one highlighted text box or a separate mode. Notes use the editorial serif in quiet italic gray, preserve intentional empty rules, never displace neighboring entries, expand the preview when necessary, and paginate independently beside the transcript in the browser-generated PDF.
- **Paper preview:** one continuous document whose browser geometry matches the natural print flow.

## Rules

- Do not add analytical laugh ratings, joke classifications, prompts, formulas, bit identities, or semantic guesses; audio-event marks only represent annotations already present in the SRT.
- Do not split on speaker, character count, or elapsed duration; silence alone creates a new block.
- Keep the notes lane visually quieter than the transcript.
- Keep personal notation inline and subordinate to speech; never let bracketed descriptions occupy transcript lines when the user's compact mark can carry them.
- Preserve keyboard focus, local processing, responsive reading, and direct browser-side PDF export without uploads or external font requests.
