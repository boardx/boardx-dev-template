# Survey Single-output Report Chapter Design

## Status

Approved direction: Option A, confirmed by the user on 2026-07-18.

Final clarification, confirmed by the user on 2026-07-18: the right column is a
chapter configuration/effect preview only. Complete generated reports and immutable
historical artifacts are viewed exclusively on the `分析报告` page. This overrides all
earlier wording in this document that described rendering generated chapter artifacts
in the right column.

This document amends the F16 report composer UI described in
`2026-07-18-survey-versioned-report-architecture.md`. The versioned fact base,
on-demand generation, immutable report versions, and F17 LangGraph boundary
remain unchanged.

## Problem

The current F16 composer reduces every chapter to a title and one natural-language
requirement. That removes excessive controls, but it also removes an essential
authoring decision: whether the chapter should produce an image, a chart, or text.

The earlier multi-module editor had the opposite problem. It placed output selection,
question binding, settings, and preview in one vertical column, making the page long
and difficult to scan.

## Decision

Each report chapter selects exactly one output type:

- `image`
- `chart`
- `text`

The middle column edits the selected output and its natural-language constraints.
The right column is a configuration/effect preview for that output. A chapter cannot
combine multiple output types in this iteration. Complete generated content and version
history are opened in `分析报告`.

Existing chapters default to `text` when no valid output type has been saved. This
preserves existing report templates and avoids silently changing their generated
content.

## Information Architecture

### Desktop

```text
| Report chapters | Chapter configuration            | Chapter effect preview      |
|                 | Title                            | Template/configuration only |
|                 | [Image] [Chart] [Text]           | Render / read-only JSON     |
|                 | Contextual settings              | Data and evidence boundary  |
|                 | Natural-language requirement     |                             |
|                 | Save / generate new version      |                             |
```

The three columns have viewport-bounded heights and scroll internally. Changing
chapters or output types must not change the outer page width or cause large layout
shifts.

### Narrow viewport

The order becomes:

1. report chapters;
2. chapter configuration;
3. output preview.

The output-type control remains a single-selection segmented control. Preview content
uses a stable minimum height and never overflows horizontally.

## Output Configuration

### Shared fields

Every chapter contains:

- chapter title;
- one output type;
- one natural-language requirement;
- a saved requirement revision used by the report artifact key.

The requirement describes audience, analytical intent, emphasis, constraints, and
expected conclusion. It does not bind individual questions. The report generator
retrieves evidence from the complete authorized survey fact base.

### Image

The editor exposes only natural-language image requirements, such as subject,
composition, tone, annotation needs, and prohibited content. The preview explains the
configured image output and does not render generated image artifacts. Complete
generated images are viewed in `分析报告`.

Image-provider selection and free-form canvas controls are out of scope.

### Text

The editor exposes natural-language requirements for the chapter narrative. The
preview explains the configured report-like text structure:

- heading;
- decision-oriented conclusion;
- supporting evidence;
- limitations;
- recommended action.

No generated narrative is rendered in this panel. Generated text is viewed in
`分析报告`.

### Chart

The editor provides a curated gallery of mainstream ECharts chart types:

- line;
- bar;
- pie or doughnut;
- scatter;
- radar;
- funnel;
- gauge;
- heatmap.

Each choice maps to an allowlisted Apache ECharts example template. The initial line
template uses the official `line-simple` option:

```json
{
  "xAxis": {
    "type": "category",
    "data": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  },
  "yAxis": {
    "type": "value"
  },
  "series": [
    {
      "data": [150, 230, 224, 218, 135, 147, 260],
      "type": "line"
    }
  ]
}
```

The sample values are preview data only. They must never be persisted as survey
evidence or included in a generated report artifact.

## ECharts Option Contract

The application stores the selected chart type and allowlisted template identifier,
not an arbitrary executable option payload. This prevents unsafe configuration,
keeps chapter records small, and lets the product update templates centrally.

The right preview provides two tabs:

- `效果预览`: renders the allowlisted option with safe sample data solely for template
  configuration, and prominently states that it is never report evidence;
- `Option JSON`: displays the corresponding complete, read-only ECharts option and
  provides a copy action.

The JSON preview is not an editor. Script expressions, formatter functions, external
URLs, and executable JavaScript are not accepted.

During report generation, the selected template becomes an output contract. The
generator must replace sample fields with fact-base-derived values, including common
paths such as:

- `xAxis.data`;
- `series[].name`;
- `series[].data`;
- `legend.data`;
- `dataset.source`.

The exact paths vary by allowlisted template. The server validates that generated
chart data references real evidence and that series lengths and value types match the
selected template.

## Preview Behavior

The right column always previews the currently selected chapter configuration, not the
entire report or generated chapter output. The complete report and selected immutable
historical version remain available only through `分析报告`.

Preview states:

- unsaved changes: label the preview as draft;
- no artifact: show configuration preview or an explicit empty state;
- generated artifact: retain generation status and direct the user to `分析报告`;
- stale source data: retain the latest-version summary and show that data has updates;
- invalid chart contract: do not render the chart; show a recoverable validation error.

Switching output type updates the preview immediately but does not generate a report.
Generation remains an explicit user action.

The composer exposes only the chapter effect preview and generation summary. Complete
reports and immutable history are handled by `WorkspaceReportWorkbench` on
`分析报告`; its version list is independently scrollable. A historical version changes
the displayed report only after exact artifact selection and a successful matching load.
Failed or mismatched loads leave the current report selected.

## Data and Versioning

The normalized chapter output contract participates in `requirementHash`:

```text
requirementHash = hash(
  normalizedTitle +
  outputType +
  chartTemplateId? +
  normalizedNaturalLanguageRequirement
)
```

Changing output type, chart template, title, or natural-language requirement marks
the current report stale. It does not overwrite an existing immutable report version.

The fact-base contract remains whole-survey and server-side:

- no per-question binding in the UI;
- no raw answer bundle sent to the browser;
- no report generation on every response;
- no source snapshot rebuild when normalized survey content and responses are
  unchanged.

## Accessibility and Interaction

- The three output choices form one keyboard-accessible single-selection control.
- Selection is communicated by text, icon, contrast, and checked state, not color
  alone.
- Chart thumbnails have text labels.
- Preview tabs use proper tab semantics.
- The JSON copy button has an accessible name and confirmation state.
- Empty, loading, stale, validation-error, and generated states are announced without
  moving focus unexpectedly.

## Scope

Included in this amendment:

- one output type per chapter;
- image, chart, and text configuration;
- curated ECharts chart selection;
- live chart preview;
- read-only complete option JSON;
- chapter-level right-side configuration/effect preview;
- persistence and hashing of the output contract;
- unit and Playwright coverage for selection, persistence, preview, and stale state.

Not included:

- multiple modules in one chapter;
- arbitrary option editing or user-provided JavaScript;
- individual-question selection;
- drag-and-drop report canvas;
- automatic report generation after each answer;
- F17 LangGraph runtime or autonomous retrieval implementation.

## Acceptance Criteria

1. A chapter can select exactly one of image, chart, or text.
2. Reloading the composer restores the saved output type and chart template.
3. Existing chapters without a saved output type open as text chapters.
4. Choosing a chart displays a real ECharts template preview in the right column with
   a prominent sample-data-only evidence boundary.
5. The JSON tab displays the complete read-only option for that chart template.
6. The `line-simple` template matches the official Apache ECharts option structure.
7. The preview remains chapter-scoped and does not vertically stack configuration
   and preview in the middle column.
8. Natural-language requirements remain editable without individual-question binding.
9. Sample chart values never appear in persisted report evidence or generated report
   artifacts.
10. Changing the output contract marks the latest report stale and requires explicit
    generation of a new immutable version.
11. Text and image panels describe configuration/structure only; complete generated
    reports and historical artifacts are viewed in `分析报告`.

## Reference

- [Apache ECharts Basic Line Chart](https://echarts.apache.org/examples/zh/editor.html?c=line-simple)
