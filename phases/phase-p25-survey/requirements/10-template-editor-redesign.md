# Survey Template Editor Redesign

## Goal

Redesign survey template creation as a compact, consistent editing workspace. A user should be able to choose an existing template as a starting point, edit reusable survey content, use AI assistance, preview the result, and save without entering the survey publishing workflow.

## Selected Direction

Use a single-page 6:4 split workspace:

- Left 60%: template editing and preview.
- Right 40%: AI assistant, open by default.
- Template source selection, name, description, tags, and categories stay inside the left editing surface.
- Preview is a mode inside the left surface, not a third column.

This keeps the editor visually aligned with the existing survey design workspace while preserving a clear distinction between reusable template management and survey publishing.

## Information Architecture

### Command Bar

The top command bar contains only:

- Back to template list
- Current template name and saved/unsaved state
- Edit/preview segmented control
- Primary save action

No survey workflow steps, publish controls, response tabs, or report actions appear in template mode.

### Left Workspace

The left workspace is the primary surface.

In edit mode it contains:

1. A compact `模板设置` section with template name, description, searchable base-template selector, and removable tags.
2. A compact category manager.
3. The question list and add-question action using the same controls and spacing language as the survey editor.

In preview mode it renders the template as a respondent-facing form preview. Switching modes does not discard edits.

### Right AI Assistant

The right panel occupies 40% of the available workspace on desktop and is open by default. It provides:

- Context showing the current template name and question count
- Suggested actions for generating, rewriting, categorizing, or checking questions
- A conversational input area
- Clear applying/loading states

AI changes update the same template draft shown on the left. The panel stacks below the editor on narrow screens.

## Interaction Rules

- Searching the base-template selector filters by template name, description, category, and tags.
- Selecting a base template fills the draft while preserving the ability to edit every field.
- Tags are added with Enter or the add action and removed directly from their chips.
- Save is disabled until the template has a non-empty name and at least one valid question.
- Unsaved edits remain visible when switching between edit and preview.
- Editing an existing custom template updates it; starting from a system template creates a new custom template.

## Visual Rules

- Use the existing neutral BoardX Survey palette, border treatment, typography, and Lucide icon set.
- Keep card radius at 8px or less and avoid nested decorative cards.
- Use tighter vertical spacing than the current screen: 12-16px within controls and 16px between major sections.
- Reserve the dark filled style for the primary save action and active segmented state.
- Remove the purple top border and purple button styling from template mode.
- Keep labels in Chinese and use `标签` rather than mixed `Tags`/`Tag` wording.

## Responsive Behavior

- At wide desktop widths, use a stable `minmax(0, 3fr) minmax(360px, 2fr)` grid.
- At tablet and mobile widths, stack the AI assistant below the editor.
- Inputs and command actions wrap without horizontal scrolling.

## Verification

- Create a blank template, add tags and categories, add/edit a question, preview, and save.
- Create a template from a searched base template and verify inherited content.
- Edit an existing custom template and verify the update path.
- Check desktop and narrow viewport layouts for overlap, clipping, and text overflow.


