# Survey Five-Step Workspace Visual Unification

Date: 2026-07-30

## Goal

Unify the complete content area beneath the persistent five-step Survey workflow navigation. The five steps must read as one product and one continuous workflow while preserving each step's existing functionality and task-specific information architecture.

The approved direction is a restrained warm-purple treatment based on the Design Survey step. Purple is an accent for workflow state, selection, AI assistance, and diagnostic context; it is not a dominant page background.

## Scope

The change applies to all five workflow steps:

1. Design Survey
2. Report Template
3. Publish and Collect
4. Review Responses
5. Analyze Report

The persistent workflow header and step navigation remain the single shared navigation surface. Only the content below the step navigation changes between steps.

## Shared Workspace Shell

Every step uses the same content-shell contract:

- the content fills the available workflow viewport below the step navigation;
- a subtle warm-purple wash distinguishes the workflow workspace from the global application shell;
- one restrained purple top rule anchors the active workspace;
- consistent horizontal padding, maximum content width, section gaps, borders, 8px card radius, and shadows;
- a compact page-introduction row containing the step label, literal title, supporting sentence, and step-level actions;
- primary commands remain black; purple is reserved for workflow emphasis and AI/diagnostic actions;
- loading, empty, error, saved, disabled, and stale states retain semantic status colors.

The shell must not add decorative nested cards. Major tools may be framed once; internal sections use dividers, bands, or unframed layouts.

## Workflow Navigation

All five step controls use one visual grammar:

- inactive: neutral background and border;
- completed or available: neutral surface with a subtle warm-purple hover/focus treatment;
- active: warm-purple border/top emphasis and a lightly tinted surface, with strong foreground text;
- the active step must not switch to an unrelated all-black card treatment;
- number tile, icon, title, and subtitle align identically across steps.

Keyboard focus and hover states must remain visible and use semantic tokens.

## Step-Specific Content

### Design Survey

Keep the existing continuous question editor, metadata summary, hypotheses, and AI assistant. Use it as the density and spacing reference for the remaining steps. Preserve sticky workflow actions and internal scrolling.

### Report Template

Keep the three-column report-composer structure:

- chapter navigation;
- requirement and output editor;
- result preview.

Place the composer inside the shared workspace shell, replace its separate page-level visual language with the common introduction row, and apply warm purple only to selected chapters, selected output mode, and AI actions.

### Publish and Collect

Keep the publication summary, collection state, report binding, rules form, AI suggestions, and monitoring panels. Remove the isolated dashboard-card appearance by using the shared introduction row and consistent section framing. Publication success and warning states remain green and yellow, not purple.

### Review Responses

Keep response filters, sample list, response detail, and answer preview. Use the same page introduction, workspace background, panel borders, selected-row treatment, and spacing. Purple indicates the selected response or active filter; answer validity keeps semantic status colors.

### Analyze Report

Keep the report version controls, export actions, generation eligibility, and single-column professional report reading surface. Align the report toolbar and empty state to the shared shell. The report document remains white and readable; the surrounding workspace receives the subtle warm-purple wash and top rule.

## Responsive Behavior

- Desktop retains each step's optimal columns inside the shared shell.
- Tablet collapses secondary panels below the primary work area.
- Mobile uses one column and keeps critical actions reachable without horizontal scrolling.
- The shared workflow header stays visible while only the content workspace scrolls.
- No step may expose document-level scrolling or blank space below the fixed application shell.

## Implementation Boundaries

- Reuse existing semantic tokens: `survey`, `background`, `card`, `secondary`, `border`, and status tokens.
- Introduce a small shared workflow content-shell component or shared class contract rather than duplicating page-level classes in each step.
- Do not introduce new dependencies.
- Do not change Survey APIs, persistence, permissions, report generation, publication behavior, or answer data.
- Preserve existing `data-testid` contracts unless a new stable shell test id is required.

## Verification

1. Playwright visits all five deep links and asserts one shared content-shell contract.
2. The persistent header and step-navigation DOM identity and geometry remain stable across step changes.
3. Desktop screenshots confirm consistent width, introduction row, warm-purple accent, section borders, and spacing.
4. Mobile and desktop viewport checks confirm no horizontal overflow.
5. Long content verifies only the workflow content area scrolls and the page cannot scroll past the application shell.
6. Existing template composer, publication, response, report, save, preview, and export interaction tests continue to pass.
7. TypeScript typecheck and design lint pass.
