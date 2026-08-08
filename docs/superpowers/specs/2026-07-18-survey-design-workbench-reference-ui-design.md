# Survey Design Workbench Reference UI Design

## Status

Confirmed by the user on 2026-07-18 using
`codex-clipboard-da6c5774-2e3f-4f8f-8e3f-02d393ae8bc4.png` as the selected
visual target.

## Goal

Replace the current three-column form-oriented Survey design workbench with
the confirmed reference layout while preserving all existing editing and
navigation behavior.

## Visual Target

The implementation must match the selected reference rather than inventing a
new visual direction:

- constrained centered workspace instead of a full-width administration grid;
- a compact top command row followed by five workflow step cards;
- a two-column desktop body with the survey document on the left and a sticky
  AI assistant on the right;
- a survey summary with a purple top rule, diagnostic tags and segmentation
  controls;
- an optional diagnostic-hypothesis section;
- all questions shown as vertically stacked editable cards;
- subtle neutral borders, white surfaces and restrained purple accents.

The current left outline panel is removed from this view. Its navigation value
is replaced by direct scanning and editing of all question cards.

## Information Architecture

### Top Command Row

The command row contains:

- Back to list
- `Survey Workflow` context badge
- Preview
- Report template
- Publish survey

Save feedback remains visible near the survey document actions without adding a
second global action row.

### Workflow Steps

The existing five workflow destinations remain unchanged. The active step uses
the black selected treatment from the reference. Step cards retain their
number, label and short description.

### Survey Summary

The summary reads from existing survey and question state:

- editable title;
- editable description;
- category tags derived from assigned question categories;
- real question count;
- estimated duration derived deterministically from question count;
- segmentation variables derived from demographic-style categories.

No new persisted fields are introduced. When a summary value has no source,
the UI omits it instead of fabricating data.

### Diagnostic Hypotheses

Hypotheses are a presentation-only summary derived from the first three
categorized questions. They are not persisted and do not affect report
generation. Each row uses the question title and category label so the section
always remains grounded in current survey content.

### Question Cards

Every question is rendered in sequence. Cards retain the existing controlled
inputs and callbacks:

- title;
- type;
- category;
- required state;
- choice options;
- move up/down;
- delete;
- add option;
- add question.

The compact default card shows the respondent-facing answer preview. Editing
controls remain visible and usable without opening a modal or switching a
separate outline selection.

### AI Assistant

The existing `SurveyAiPanel` behavior remains authoritative. Its visual
composition is adjusted to the reference:

- contextual introduction;
- current suggestion message;
- quick prompt chips;
- bottom prompt composer;
- preview/apply actions after generation.

Desktop uses a sticky right column. Tablet and mobile place the assistant after
the survey document.

## Responsive Behavior

- `>= 1280px`: centered two-column layout, `minmax(0, 1fr) 320px`.
- `768px-1279px`: single-column document followed by AI assistant.
- `< 768px`: compact command row, horizontally scrollable workflow steps,
  single-column question cards and full-width controls.

No viewport may introduce horizontal page scrolling or clipped primary
actions.

## Accessibility

- Keep native labels for editable inputs.
- Preserve keyboard activation for all buttons and workflow steps.
- Use `aria-current="step"` for the active workflow step.
- Use icon buttons only when the icon meaning is familiar and provide
  `aria-label` and `title`.
- Keep visible focus rings and existing token-based contrast.

## Data and Error Handling

The redesign does not change API calls or persistence. Existing `saving`,
`saveError` and `actionMessage` states remain visible. Empty question lists show
an add-question action rather than a blank document. Existing callbacks remain
the only mutation path.

## Verification

1. Component tests cover summary derivation and question-card visibility.
2. Existing Survey unit, lint and typecheck commands remain green.
3. A focused Playwright test verifies desktop structure, editing all visible
   questions, moving a question, toggling required state, adding a question and
   navigating workflow steps.
4. Playwright screenshots at desktop and mobile are compared with the selected
   reference for hierarchy, spacing, borders, radii and overflow.

## Out of Scope

- Report composer redesign
- New survey schema fields
- New AI generation behavior
- New chart or report output behavior
- Reimplementation of the reference HTML outside the existing BoardX design
  system

