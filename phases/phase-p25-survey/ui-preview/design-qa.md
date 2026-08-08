# Survey Prototype Design QA

- Current source: `source-design-all-reference-latest.png`
- Prototype top view: `prototype-current-design-all-2048.png`
- New-tab toolbar view: `prototype-current-design-new-tab.png`
- Bottom actions view: `prototype-current-design-bottom-actions.png`
- Prototype final-question view: `prototype-current-design-question-7.png`
- Preview source: `source-preview-reference-latest.png`
- Preview implementation: `prototype-current-preview-2048.png`
- Standalone preview: `prototype-current-preview-solo-2048.png`
- Source pixels: 3326 x 2022
- CSS viewport: 2048 x 1150
- State: `#design`, light theme
- Final result: passed

## Layout Verification

- Design shell: x 219, width 1610.
- Survey column: x 219, width 1096.
- AI assistant: x 1335, width 494, minimum height 850.
- Column gap: 20.
- Survey summary: x 219, y 302, width 1096, height 243.
- First question begins at y 821.
- The measured geometry follows the latest `localhost:3001` Design screenshot after normalizing browser chrome and display density.

## Complete Questionnaire

- All seven source questions render simultaneously in the Design DOM.
- Questions are stacked in source order from Q1 to Q7 instead of replacing one selected editor.
- Q1 and Q4 render choice editors, Q2 renders a multi-choice editor, Q3 and Q5 render rating previews, Q6 renders NPS 0-10, and Q7 renders the paragraph area.
- `prototype-current-design-question-7.png` verifies that Q6 and Q7 are reachable at the end of the same scrolling canvas.
- The AI assistant remains sticky while the questionnaire column scrolls.
- A full-width Add Question action follows the final question card.
- Clicking Add Question creates the next question and scrolls to the new card.
- The Design toolbar is sticky at the top of the workspace, keeping Preview and Save Modification visible at the final question.

## Answer Preview

- Preview opens in a separate browser tab through a native `target="_blank"` link, leaving the Design editor unchanged.
- The new tab is a standalone questionnaire rather than a modal or another editor view.
- The Design toolbar contains only Preview and Save Modification; the adjacent Report Template action is removed.
- The preview hides the complete editor header, workflow, Back to List, Edit, and Report Template controls.
- Preview shell and survey sheet: x 564, width 920 at the 2048px QA viewport.
- Inner response form: x 644, width 760.
- The current `fluent-research-header.webp` asset renders in the 96px BoardX Survey banner.
- Progress, title, description, and all seven questions follow the production component order.
- Single choice, multiple choice, rating, NPS, and paragraph controls are interactive.
- Five answered questions update progress to `5 / 7`.
- The standalone tab keeps the response workflow focused on the questionnaire and submission.

## Interaction Verification

- Each card independently edits title, type, category, required state, and options.
- Editing Q2 leaves Q1 and Q3 unchanged.
- Add option, duplicate, move, and delete target the card that initiated the action and preserve the current scroll position.
- Duplicated questions receive an independent copy of their options.
- Rating and NPS preview controls return visible feedback.
- AI shortcut chips, Save Modification, Preview, and workflow navigation remain interactive.
- Updated static contract: 122 buttons and 79 delegated actions.
- Browser console errors: none.

## Fidelity Notes

- The compact workflow header, five bordered workflow cards, black active Design step, purple summary accent, neutral canvas, card radii, typography and copy follow the current implementation.
- The previous single-question-only editor and narrower 1590px workspace are no longer present.
- No photographic or generated assets are required for this operational interface.
