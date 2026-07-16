# Survey template list filter verification

Date: 2026-07-16

## User-visible behavior

- The new-survey template library is rendered as a compact single-column list.
- Templates can be filtered by their category or saved tags.
- Built-in and saved templates remain selectable from the same list.
- The editor no longer renders the internal Responses and Settings tabs. Those workflows remain in the five-step Survey navigation.

## Verification

- `pnpm --filter @repo/web typecheck` - passed.
- `pnpm --filter @repo/web test` - passed, 19 files and 99 tests.
- `bash apps/web/scripts/lint-design.sh` - passed.
- `E2E_PORT=62352 COLLAB_WS_PORT=62353 pnpm exec playwright test e2e/survey-p25-002-professional-ui.spec.ts --grep "editor shell"` - passed before the final native-button-to-Button component-only cleanup.
- The final E2E rerun reached the same test but was blocked during test-user registration because local PostgreSQL returned `57P03: the database system is in recovery mode`. Typecheck, unit tests, design lint, and the focused behavior test had already passed; no database code changed in this patch.
