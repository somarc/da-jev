# Authoring the field lab

DA is the source of truth for pages and public record files. This document defines
models, not a second copy of site content. Use da-cli to read current source before
editing it. Hydrated content and temporary validation material belong in the
resolver-selected external operational workspace.

## Document shape

Use a body with header, main, and footer. Every block is inside a section under
main. Use one section-nested Metadata block per page, never both body Metadata and
document-head metadata. Section Metadata owns styles such as `trace-stage`,
`muted`, `contrast`, and `reading`.

All models below have at most four cells per row. Rich text, headings, lists, and
links carry meaning. Do not paste executable code or instructions into data.

## Trace hero — standalone

One row with two cells:

| Copy | Trace |
| --- | --- |
| Eyebrow paragraph, H1, explanatory paragraph, formatted CTA links | Ordered list of actor/handoff summaries |

An H1 is required for the page, not an additional block-generated heading. The
trace is optional. Extra authored cells remain visible. Strong/emphasis on a
standalone paragraph link uses the existing button decoration contract.

## Trace path — collection

Each row is one stage, normally two cells:

| Stage | Evidence or responsibility |
| --- | --- |
| H3 and a short description | Rich text, code, and/or an evidence link |

Rows retain source order. The decorator supplies ordered-list semantics and the
continuous rail, not new facts. Missing optional evidence leaves the stage usable.

## Metric strip — collection

Each row is one metric with three cells: **value**, **label**, **qualification and
source link**. Values and units are authored together. Unknown is not zero. A
metric without its scope or qualification is not ready for release.

## Experiment list — collection

Each row has up to three cells: **category/status**, **H3-linked title and
description**, **scope or result summary**. The first paragraph in the first cell
is the filter category. All experiment links remain available without JavaScript.
Filtering covers this complete authored collection, not a partial page-index read.

## Case explorer — data configuration

The first row contains a link to a public DA JSON record file under `/data/`.
Its visible link text explains the source. Additional authored context is retained.
The block adds a native case picker, recorded input/decision/observation, a
probability distribution where present, and provenance. It never calls Jev or
executes a displayed command.

## Measurement chart — data configuration

The first row links to a public DA measurement sheet under `/data/`. Rows identify
the suite, workload, question count, token usage, estimated input cost, API upstream
time, and the precise measurement boundary. The chart never adds incompatible or
unmeasured durations into a fictional end-to-end result.

## Evidence table — tabular content

The first row supplies column headings; remaining rows supply cells. At most four
columns. Rich links and code remain intact. Overflow, if necessary, is inside the
table region rather than the whole page.

## Callout — standalone

One rich-text cell with a heading and explanation. A `warning` variant may emphasize
a limitation, but the heading must state the meaning; color is not the message.

## Accordion — collection

One row per disclosure: **question/heading**, then **rich answer**. A native
details/summary element owns keyboard interaction. A missing question does not
create an unnamed interactive control.

## Shared navigation and footer

`/nav.html` contains brand, primary links, and an optional secondary link in three
sections. `/footer.html` contains independent-lab context and reference links.
Both use noindex metadata. Interface controls use the site's English UI-label
contract in code; editorial claims and navigation destinations remain authored.

## Data records and validation

Match the DA editor's single-sheet source envelope: `total`, `limit`, `offset`,
`data`, `":sheetname": "data"`, and `":type": "sheet"`. Keep total/limit equal
to the complete row count and offset zero for this site's complete record files.
The abbreviated `:type` + `data` shape stored successfully but failed preview in
the initial field test; the canonical envelope previewed correctly with identical
records. Source persistence alone is not delivery proof.

This application keeps cells scalar and encodes a probability-option array in a
JSON string cell. The client validates that field before use. This is our tested
application convention, not a claim that the platform rejects all nested values.

Record IDs, expected labels, selected values, provenance, and units are explicit.
Keep credentials and private local paths out of public records. Retain raw private
execution evidence outside Git; publish only an allowlisted public projection.

## Validation content

Use an unlinked, noindex DA draft at `/drafts/field-lab/contracts.html` for canonical,
sparse, extra-cell, repeated-block, and long-copy checks. It is development content,
not a release candidate. Verify public block assets before sharing a feature
preview. No local content fixture belongs in this implementation repository.

## Source and delivery are different representations

The authored single-sheet envelope includes `:sheetname: "data"`; EDS delivery may omit that source-only field. Readers validate `:type: "sheet"`, integer pagination metadata, the complete `data` array, and unique safe record IDs. Compare the record arrays, not byte equality of the entire transport wrapper.

Measurement `questionCount` and `requestCount` are non-negative integers. A non-empty `scope` is required. Empty or absent measurements stay unmeasured, not zero. Known `matched`/`mismatched` states must agree with the selected and frozen expected IDs; this is label agreement, not a general task-success verdict.

Probability and measurement bars hide zero-valued fills while retaining their numeric labels. Data failures preserve the authored source link. Public evidence projections must omit credentials, private local paths, and unverified completion claims.
