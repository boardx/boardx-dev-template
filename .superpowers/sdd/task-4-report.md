# Task 4 Report

## Status

DONE

## RED

- Test-first file: `apps/web/lib/survey-report-category-plan.test.ts`
- Command: `pnpm --filter @repo/web run test -- survey-report-category-plan`
- Result: failed as expected with 2 failing assertions.
- Chart failure: expected `inputModes: ["chart"]` and a `line-simple` simulated
  chart, but received `inputModes: ["text"]` with no chart.
- Image failure: expected `inputModes: ["image"]` and an image requirement,
  but received `inputModes: ["text"]` with no image.
- The text-only case passed, confirming the failure was the old forced-text
  implementation rather than test setup.

## GREEN

- Command: `pnpm --filter @repo/web run test -- survey-report-category-plan`
- Result: passed, 27 test files and 131 tests.
- Final focused command:
  `pnpm --filter @repo/web run test -- survey-report-chart-templates survey-report-category-plan`
- Final result: passed, 27 test files and 131 tests.
- `pnpm --filter @repo/web run lint`: passed.
- `pnpm --filter @repo/web run typecheck`: passed.
- `git diff --cached --check`: passed before commit.

The test runner still emits the repository's existing Vite CJS deprecation
warning and expected stderr from error-path API tests. Design lint still emits
the existing non-blocking language-consistency warnings.

## Files

- `apps/web/components/survey/survey-report-output-preview.tsx`
  - Adds chapter-scoped image, chart, and text previews.
  - Registers only the ECharts chart/component modules used by the eight
    allowlisted templates.
  - Uses a stable canvas, `ResizeObserver`, replacement `setOption`, disposal,
    semantic tabs, complete read-only JSON, and clipboard feedback.
  - Does not fabricate generated text or image assets.
- `apps/web/components/survey/survey-versioned-report-composer.tsx`
  - Adds the image/chart/text single-selection segmented control.
  - Adds the compact eight-template chooser.
  - Replaces the embedded full report with the selected chapter preview.
  - Retains parent-owned generation status, timestamp, and immutable history.
  - Bounds the desktop grid to the viewport with internal column scrolling and
    keeps the mobile layout single-column and horizontally contained.
- `apps/web/lib/survey-report-category-plan.ts`
  - Builds exactly one preview output from `category.outputType`.
  - Keeps explicit chart sample rows isolated in the simulated draft preview.
  - Derives chart type from the allowlisted template identifier.
- `apps/web/lib/survey-report-category-plan.test.ts`
  - Covers mutually exclusive chart, image, and text planner output.

## Commit

- `258a0da feat(survey): preview one output per report chapter`

## Visual Self-check

- Compared the implementation structure against all three supplied references:
  compact middle configuration, scan-friendly chart choices, and a right-side
  render/JSON preview are preserved.
- Desktop tracks match the approved
  `240px / minmax(360px, 0.9fr) / minmax(480px, 1.1fr)` layout.
- Configuration and preview use independent vertical scrolling at desktop
  height; JSON uses contained horizontal scrolling instead of widening the page.
- The chart canvas has stable `h-80 min-h-80 w-full` dimensions and receives a
  non-empty allowlisted option.
- Text and image states show requirements and explicit generated-artifact empty
  states without placeholder content or fake assets.

## Accessibility Self-check

- Output and template choices are native buttons with `aria-pressed`, visible
  check state, icon, text, contrast, and existing focus-ring behavior.
- Preview controls use `tablist`, `tab`, `tabpanel`, `aria-selected`,
  `aria-controls`, roving `tabIndex`, and left/right arrow navigation.
- Chart canvas has an accessible image label.
- JSON copy action has an accessible name plus success/error live feedback.
- Generation and empty states use polite status announcements.

## Concerns

- No Task 4 blocker.
- Browser-level canvas pixel proof, reference-viewport screenshots, persistence
  reload coverage, and mobile overflow assertions remain intentionally deferred
  to Task 5. No E2E or harness evidence file was changed in this task.

## Review Follow-up (2026-07-18)

- `apps/web/components/survey/survey-versioned-report-composer.tsx`
  - Removes the right preview column's clipping `overflow-hidden` at desktop height.
  - Keeps the preview as the remaining constrained flex area with `overflow-y-auto`.
  - Makes expanded version history a bounded desktop grid and gives its version list
    its own `overflow-y-auto`; mobile keeps natural document height.
- `apps/web/components/survey/survey-report-output-preview.tsx`
  - Clears copied and copy-error feedback whenever the rendered Option JSON or chart
    template changes, so feedback cannot persist across templates.

## Review Follow-up Verification

- `pnpm --filter @repo/web run test -- survey-report-chart-templates survey-report-category-plan`
  - Passed: 27 test files, 131 tests.
- `pnpm --filter @repo/web run lint`
  - Passed. Existing non-blocking `LABEL-LANG-MIX` warnings remain outside this change.
- `pnpm --filter @repo/web run typecheck`
  - Passed.
- `git diff --check`
  - Passed before the report update; repeated on the final staged diff before commit.

No browser E2E was added or run; that coverage remains scoped to Task 5.

## Product Decision Correction (2026-07-18)

- Final user confirmation supersedes the earlier right-column generated-artifact
  wording: `章节效果预览` is now configuration/effect preview only. Complete generated
  reports and immutable historical versions are viewed on `分析报告`.
- Chart previews now prominently state `示例数据，仅用于模板配置，不会写入报告证据。`.
  Text and image panels describe configuration/structure and direct users to the full
  report instead of claiming to render generated content.
- The composer retains generation status and version-history summaries. Selecting a
  historical version awaits its load before navigating to `分析报告`; a failed load does
  not navigate.
- Added `survey-report-version-navigation` unit coverage for the ordered success path
  and failed-load no-navigation path.
- Updated the single-output design and implementation plan to record the final product
  decision. No E2E spec or Sprint 16 evidence file changed; those remain Task 5 scope.

## Product Decision Correction Verification

- `pnpm --filter @repo/web run test -- survey-report-chart-templates survey-report-category-plan survey-report-version-navigation`
  - Passed: 28 test files, 133 tests.
- `pnpm --filter @repo/web run lint` - Passed. Existing non-blocking
  `LABEL-LANG-MIX` warnings remain outside this task.
- `pnpm --filter @repo/web run typecheck` - Passed.
