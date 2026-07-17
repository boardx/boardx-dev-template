# Survey Fluent Answer Experience

## Goal

Redesign the Survey preview and public answer page around the restrained visual language of Microsoft Forms. The experience should read as one continuous questionnaire rather than a stack of bordered cards.

## Scope

- Editor questionnaire preview.
- Public questionnaire answer page.
- Question headings, progress, answer controls, validation, and submit placement.
- No changes to survey persistence, publication, response submission, or question types.

## Visual Direction

### Page

- Use a quiet neutral page background and one centered white reading surface.
- Do not draw a border, rounded container, or shadow around the complete questionnaire.
- Retain a thin primary-color accent at the top as the only persistent decorative rule.
- Use the same width, title hierarchy, question spacing, and controls in preview and answer modes.

### Header

- Remove the outlined `BoardX Survey` badge.
- Present the survey title as the primary first-viewport signal, followed by its description.
- Show completion as compact text plus a thin progress bar.
- Avoid boxed metadata or heavy dividers.

### Questions

- Render questions in a continuous vertical reading flow.
- Do not use per-question borders, cards, horizontal separators, or alternating panels.
- Use question number, title weight, required marker, and whitespace for hierarchy.
- Keep the question type as quiet supporting text only when it helps the respondent.

### Controls

- Single and multiple choices use a Fluent-style radio or checkbox followed by text.
- Options have no permanent rectangular outline.
- Hover and keyboard focus use a subtle neutral background and visible focus ring.
- Selected options use the semantic primary color without shifting layout.
- Text fields use a restrained surface and bottom-edge emphasis instead of a heavy boxed treatment.
- Rating and scale controls remain compact and keyboard accessible.

### Footer

- Place the primary submit action at the lower left of the questionnaire flow.
- Show validation feedback next to the action area without adding an alert card.

## Responsive Behavior

- Desktop reading width remains constrained for comfortable scanning.
- Mobile uses the full available width with reduced horizontal padding.
- Labels and options wrap naturally without horizontal scrolling or overlapping controls.

## Interaction States

- Hover: subtle neutral background on selectable option rows.
- Focus: visible semantic focus ring for all keyboard-operable controls.
- Selected: primary-color indicator and faint primary tint.
- Disabled preview: visually matches the answer page while remaining non-interactive.
- Error: concise destructive text; no modal or full-width warning panel.

## Acceptance Criteria

1. Editor preview and public answer page share the same unboxed questionnaire structure.
2. The full questionnaire, individual questions, and choice options have no permanent card-style outlines.
3. Question separation relies on typography and spacing rather than horizontal rules.
4. Public answer controls preserve selection, validation, submission, and accessibility behavior.
5. Playwright verifies the shared Fluent surface and absence of legacy bordered question/option classes.
6. Typecheck, Web unit tests, Survey E2E tests, and design lint pass.

## Non-Goals

- Reworking the five-step Survey workspace.
- Changing report templates or generated reports.
- Adding new theming controls.
- Replacing existing UI primitives or introducing dependencies.
