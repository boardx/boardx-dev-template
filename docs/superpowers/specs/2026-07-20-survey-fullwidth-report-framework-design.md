# Survey Full-Width Report Framework Design

## Context

The Survey workflow already keeps one persistent five-step header across design,
template, collection, responses, and report views. The content below that header
still uses inconsistent width rules:

- the questionnaire designer gives the editor nearly all available width and
  leaves a fixed-width AI rail;
- the report-template editor is centered inside a narrower container;
- the analysis report constrains both its toolbar and reading surface to
  `max-w-*` containers;
- the zero-response report uses a fixed generic placeholder instead of the
  saved report template.

F26 keeps the persistent workflow header and makes the workspace below it match
the purpose of each step.

## Goals

1. Use a 60/40 questionnaire-and-assistant split on desktop.
2. Let the report-template editor use the full available workflow width.
3. Let the analysis report use the full available workflow width.
4. Assemble generated reports from the saved template snapshot, preserving
   chapter count, order, title, and output type.
5. When there are no valid responses, render the same ordered template as a
   report framework without calling a model or inventing evidence.

## Non-Goals

- No draggable or user-persisted column widths.
- No change to the persistent five-step workflow header.
- No simulated responses, placeholder metrics, or generated conclusions.
- No parallel chapter publication or partially published report.
- No redesign of collection or response-review business controls.

## Layout Design

### Questionnaire Design

The design workspace uses two columns at `xl` and above:

- left: `minmax(0, 3fr)`;
- right: `minmax(360px, 2fr)`.

This is the requested 60/40 relationship while retaining a usable minimum
assistant width. Below `xl`, the two surfaces stack vertically. Collapsing the
assistant may reduce its column to the existing compact icon rail, but opening
it restores the 60/40 split.

The questionnaire summary, hypotheses, and question cards remain in the left
column. Preview, report-template, and save actions remain associated with the
design step and do not move into a second page header.

### Report Template

The template workspace fills the shared workflow content frame. It retains its
three responsibilities:

1. chapter navigation;
2. chapter output and requirement editing;
3. selected-chapter preview.

The outer centered `max-width` constraint is removed. The three columns use
stable responsive tracks so the center editor receives the largest share while
the chapter list and preview remain independently scrollable. On narrower
screens they stack without horizontal overflow.

### Analysis Report

The report toolbar and report reading surface fill the shared workflow content
frame. The report document remains a coherent white reading surface, but it no
longer uses a narrow page-like `max-w-5xl` constraint. Internal text and chart
blocks may retain readable line-length constraints where needed; those
constraints apply to content blocks, not to the overall report canvas.

## Template-Driven Report Contract

The persisted report category plan is converted into an immutable template
snapshot before generation. Snapshot chapters are normalized by ascending
`order`, then assigned contiguous order values.

For a report with valid responses:

1. freeze the full survey and authorized response source revision;
2. freeze the saved template snapshot;
3. iterate snapshot chapters in order;
4. generate exactly one output for each chapter according to `outputType`;
5. validate chapter count, identifier, order, title, output type, chart
   template, and evidence references;
6. publish one versioned report artifact only after every chapter passes.

The existing sequential generation loop and template report validator remain
the authoritative implementation. F26 adds regression coverage so later UI
changes cannot bypass them.

If any chapter fails, generation releases its claim, publishes no partial
artifact, and leaves the latest successful version available.

## Empty Report Framework

Zero valid responses must not invoke text, chart, or image generation. GET still
returns a template-driven report-shaped preview built from the current saved
template snapshot:

- report title and template description;
- response count `0` and question count;
- one framework section per template chapter in exact saved order;
- chapter title and selected output type;
- the chapter's natural-language requirement;
- an output-specific empty state:
  - text: conclusion and evidence placeholders;
  - chart: chart type plus an empty data region;
  - image: image brief plus an empty image region.

Framework chapters contain no claims, metrics, chart series, images, or
evidence references. The report status is `empty`, and the generation action is
disabled with an explanation that at least one valid response is required.

POST keeps returning `422 report_requires_responses` before claiming a job or
calling any model. This preserves the no-fabrication boundary while making the
future report structure visible.

## Components and Boundaries

- `WorkspaceShell` continues to own the persistent header and full-width
  content frame.
- The survey editor owns only its 60/40 internal layout.
- The template editor owns only its three-column internal layout.
- `SurveyProfessionalReportWorkbench` owns the full-width toolbar and reading
  surface.
- `survey-template-report.ts` owns snapshot normalization, empty framework
  construction, and final report validation.
- The professional-report API owns authorization, source freezing, zero-data
  gating, artifact lookup, and atomic publication.
- `ProfessionalReportDocument` renders both generated chapters and empty
  framework chapters without switching to a separate fixed report design.

## Error Handling

- Missing or invalid chart configuration remains a template validation error.
- Duplicate, missing, reordered, or mistyped generated chapters fail report
  validation.
- Zero responses are a valid read state and a rejected generation state.
- A failed chapter generation never replaces the latest successful artifact.
- Existing authorization order and server-side response aggregation remain
  unchanged.

## Verification

### Unit and Route Tests

- template snapshot sorts saved chapters and preserves normalized order;
- empty framework contains every saved chapter in the same order and output
  type;
- empty framework contains no generated evidence or fabricated values;
- POST with zero responses returns `422` before job claim/model invocation;
- successful generation returns chapters in template order;
- reordered or partial chapter output is rejected.

### Browser Tests

At a desktop viewport:

- the open questionnaire assistant and editor approximate a 60/40 width ratio;
- the report-template workspace fills the shared workflow content width;
- the analysis report toolbar and reading surface fill the shared workflow
  content width;
- the persistent workflow header keeps its geometry while switching steps;
- a zero-response report displays every configured template chapter in order;
- the generate button remains disabled in the zero-response state.

Mobile verification confirms that the questionnaire and template columns stack
without clipping or overlap.

## Delivery

- Phase: `phase-p25-survey`
- Feature: F26
- GitHub Issue: `#811`
- Branch: `codex/p25-f26-fullwidth-report-framework`
- Dependency: F25 / PR `#806`
- One phase worktree is reused; F26 receives one independent commit series and
  pull request.
