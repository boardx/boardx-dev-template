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

final result: passed
