# Survey Reference Home UIUX Evidence

Date: 2026-07-17

## Reference

`AI 问卷诊断平台(1).html`

## Implemented

- `/surveys` is now the Survey diagnostic workspace home.
- `/surveys?view=my` preserves the operational survey list.
- `/surveys?view=templates` preserves the template manager.
- The sidebar now separates Home, My Surveys, Survey Templates, and Report Templates.
- The home view includes workspace metrics, organization/community context, the WHY/HOW/THEN workflow, recommended templates, and recent surveys.
- All metrics, templates, and survey rows use existing application data and actions.

## Verification

```text
pnpm --filter @repo/web typecheck
exit 0
```

```text
bash apps/web/scripts/lint-design.sh
design lint passed
```

```text
pnpm exec playwright test \
  e2e/survey-p25-008-source-stash-ui.spec.ts \
  e2e/survey-p25-002-professional-ui.spec.ts \
  --grep "diagnostic workspace reference|professional dashboard exposes"
2 passed
```

## Visual QA

Screenshot: `survey-reference-home.png`

- Information architecture matches the reference.
- Desktop density and content hierarchy match the reference.
- Existing BoardX global rail remains intact.
- Empty/new-account data is represented honestly with zero metrics.

Final result: passed.
