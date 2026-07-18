# Survey HTML Fidelity Design QA

source visual truth path: `/Users/shenyangjun/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/yy774650019_32de/msg/file/2026-07/AI 问卷诊断平台(1).html`

source screenshot paths: `phases/phase-p25-survey/sprints/sprint-12/evidence/source-html-{home,my-surveys,editor,templates,report-template,insight}.png`

implementation screenshot paths: `phases/phase-p25-survey/sprints/sprint-12/evidence/survey-{home-desktop,my-surveys-desktop,unified-editor-viewport,template-center-desktop,report-template-viewport,insight-report-desktop}.png`

viewport: `1280 x 720`

state: Six authenticated Survey workspace screens in light theme, with real persisted fixtures.

## Full-View Comparison Evidence

Each source screenshot and implementation screenshot was combined into one `2560 x 720` WebP, with the source on the left and implementation on the right:

- `comparison-home.webp`
- `comparison-my-surveys.webp`
- `comparison-editor.webp`
- `comparison-templates.webp`
- `comparison-report-template.webp`
- `comparison-insight.webp`

All six pairs were opened and reviewed after the final semantic and responsive fixes.

## Focused Region Comparison Evidence

The six full-view pairs keep navigation, typography, cards, controls, and dense report content readable at original scale, so separate crops were not required. Focused review covered:

- Shared Survey navigation and the `x=390` desktop content boundary.
- Home metrics, method band, recommendation cards, and real zero states.
- My Surveys creation paths, status rows, and action density.
- Editor workflow steps, summary, hypothesis area, first question, and AI panel.
- Template filters, paired report actions, report-composer columns, and toolbars.
- Insight header, low-sample banner, sample table, hypothesis signals, and report actions.

## Findings

- No remaining P0, P1, or P2 mismatch.
- Fonts and typography: The implementation preserves the reference hierarchy, weights, Chinese line lengths, and zero letter spacing using repository typography tokens.
- Spacing and layout rhythm: Primary regions, desktop content boundary, three-column report composition, compact list density, border radii, and vertical rhythm match the reference. The editor's first question remains approximately 14px lower because production type and dimension controls are interactive.
- Colors and visual tokens: The workspace remains neutral black, white, and gray; Survey violet is limited to AI, selected, and semantic emphasis states. Contrast lint passes in both themes.
- Image quality and assets: The public answer header uses a compressed WebP bitmap. Workspace controls use the project's Lucide icon library; no placeholder or CSS-drawn visual replaces a source asset.
- Copy and content: Product copy follows the reference information architecture while numbers, user identity, sample status, and report counts come from real session or persisted data. Low samples are explicitly directional and raw open-text answers are absent from the summary.
- Responsiveness: The results page has a mobile navigation control and no horizontal body overflow at `390 x 844`.

## Comparison History

### Iteration 1

- Earlier P1: My Surveys used a resource-library table instead of the reference creation paths and compact survey list.
- Earlier P1: Insight lacked shared Survey navigation; editor and report template retained mismatched shell structure.
- Earlier P2: Home content boundary, metric height, and list start position drifted from the source.
- Fixes: Restored the six-screen diagnostic information architecture, shared Survey navigation, source-aligned home/list/editor/report shells, and matched desktop content boundaries.

### Iteration 2

- Earlier P2: The editor hypothesis input permanently displaced the first question; template dimensions exposed English slugs.
- Earlier P2: Report-template proportions and insight capture scroll position did not match the source state.
- Fixes: Made hypothesis input on demand, mapped dimensions to Chinese labels, restored seven real report categories, and reset capture scroll state.

### Final Iteration

- Review findings: Low samples produced definitive hypothesis/NPS language; summary regions exposed raw open text and response IDs; return routes lost their origin; the mobile results shell overflowed; the home report metric was session-only.
- Fixes: Applied the shared 30-response threshold, removed raw summary content, preserved editor/workflow/list return targets, added mobile navigation and fluid results width, and aggregated persisted ready report artifacts.
- Post-fix evidence: All six `comparison-*.webp` files listed above.

## Primary Interactions Tested

- Home and five Survey navigation destinations.
- Three creation paths, template filtering and application.
- Editor question, hypothesis, AI assistant, and workflow steps.
- Report-template editing, chart/image/text modes, preview, and save.
- Insight tabs, CSV/PDF/share actions, origin-aware return navigation, low-sample and privacy behavior.
- Mobile workflow and mobile insight navigation.

## Console Errors Checked

The 35-test Playwright run completed without application console errors. Node emitted only the existing `NO_COLOR` warning.

## Follow-up Polish

- P3: The BoardX global product rail is 60px while the reference is 72px; the Survey secondary rail compensates so the main content boundary aligns.
- P3: The editor's first question starts about 14px lower because production editing controls remain visible.
- P3: Real fixture data differs from the reference's illustrative counts and conclusions by design.

The public answer-page comparison remains recorded in `phases/phase-p25-survey/sprints/sprint-12/evidence/2026-07-17-fluent-answer-design-qa.md`.

## F15 Incremental Home Review

The 2026-07-18 user annotation supersedes the two optional home cards from the original HTML reference:

- Source annotation: `phases/phase-p25-survey/sprints/sprint-13/evidence/source-home-dashboard-adjustments.png`
- Normalized source: `phases/phase-p25-survey/sprints/sprint-13/evidence/source-home-dashboard-adjustments-1672.png`
- Implementation: `phases/phase-p25-survey/sprints/sprint-13/evidence/survey-home-f15-desktop.png`
- Side-by-side comparison: `phases/phase-p25-survey/sprints/sprint-13/evidence/comparison-home-f15.png`
- Comparison viewport: `1672 x 996` per side.

The organization and consultant-community cards are gone, the metrics band fills the row, the owner survey count is aligned after “我的问卷”, and each recent survey has a real publication-time state. No P0, P1, or P2 visual issue remains; the `390 x 844` mobile check has no horizontal overflow.

## F15 Create Dialog Review Rework

The 2026-07-18 PR review identified a compressed `448px` create chooser whose inherited `white-space: nowrap` caused descriptions to cross card boundaries.

- Source review screenshot: `phases/phase-p25-survey/sprints/sprint-13/evidence/source-create-dialog-usability.png`
- Normalized source: `phases/phase-p25-survey/sprints/sprint-13/evidence/source-create-dialog-usability-1624.png`
- Implementation: `phases/phase-p25-survey/sprints/sprint-13/evidence/survey-create-dialog-f15-desktop.png`
- Side-by-side comparison: `phases/phase-p25-survey/sprints/sprint-13/evidence/comparison-create-dialog-f15.png`
- Comparison viewport: `1624 x 934` per side.

The implementation uses a wider three-card chooser with wrapped descriptions, explicit action labels, an AI recommendation badge, and stable initial focus. The source and implementation were reviewed together at the same dimensions. No text crosses a card boundary, no control is clipped, and spacing, border radii, icon treatment, and hierarchy remain consistent with the Survey design system. The `390 x 844` test confirms single-column cards and no horizontal overflow. No P0, P1, or P2 issue remains.

## F16 Versioned Report Composer

The 2026-07-18 report-composer review supersedes the reference screen's mixed question binding,
output-module controls, simulated chart settings, and permanent AI assistant:

- Source review: `phases/phase-p25-survey/ui-preview/2026-07-18-report-composer-length-review.png`
- Implementation: `phases/phase-p25-survey/sprints/sprint-16/evidence/survey-report-composer-desktop.png`
- Side-by-side comparison: `phases/phase-p25-survey/sprints/sprint-16/evidence/comparison-report-composer-f16.png`
- Comparison viewport: `1653 x 1024` per side.

The source and implementation were opened together in one comparison image. The implementation
keeps the existing Survey shell and compact chapter list, replaces the overlong center column with
one natural-language requirement editor, and uses the third column for the real versioned report.
The generated report is visibly distinct from configuration, stale/current state remains adjacent
to the preview, and history is collapsed below it. No text or control overlaps, the primary actions
remain visible without scrolling, and the `768 x 900` plus `390 x 844` checks have no horizontal
overflow. The removed question assignment, output-module picker, simulated chart, and AI assistant
are intentional product changes rather than fidelity defects. No P0, P1, or P2 issue remains.

final result: passed
