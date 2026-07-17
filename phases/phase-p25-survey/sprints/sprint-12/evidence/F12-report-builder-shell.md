# F12 Evidence: Report Template Builder Shell

Date: 2026-07-16

## Scope

- Stabilized the active report-template route as a responsive three-column workbench.
- Defined durable UI boundaries for the collapsible module list, live report preview, and compact AI/configuration assistant.
- Preserved the existing chart, image, text, layout, prompt, and resize behavior.

## TDD Evidence

RED:

```text
Timed out waiting for getByTestId('report-template-builder')
1 failed
```

GREEN:

```text
pnpm exec playwright test e2e/survey-p25-012-report-composer.spec.ts
3 passed (29.5s)
```

## Verification

```text
pnpm --filter @repo/web typecheck
tsc --noEmit
exit 0
```

```text
bash apps/web/scripts/lint-design.sh
design lint: all checks passed
exit 0
```

The design lint reported pre-existing non-blocking mixed-language warnings. No new blocking design violations were introduced.

## User-visible Result

At `/surveys?survey=<id>&step=template`, the report template editor now exposes:

- `report-module-list`: collapsible report chapter/module navigation.
- `report-module-preview`: live editable report canvas.
- `report-ai-assistant`: report configuration and AI-assisted controls.
- `report-template-builder`: responsive three-column desktop layout.
