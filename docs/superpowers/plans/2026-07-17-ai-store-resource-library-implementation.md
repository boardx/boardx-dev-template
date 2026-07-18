# AI Store Resource Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete p27 AI Store behavior and replace the current monolithic Store screen with the approved Resource Library UI backed entirely by real BoardX APIs.

**Architecture:** Keep PostgreSQL and Next.js route handlers authoritative for Team context, roles, lifecycle, subscriptions, sharing, copying, and audits. Finish the currently claimed F06 first, then advance one Harness feature at a time; split the 1884-line browser into focused Store components and hooks while preserving existing route contracts and stable E2E selectors.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, PostgreSQL through `@repo/data`, Tailwind CSS, shadcn/ui, Lucide icons, Playwright, Vitest, pnpm Harness.

## Global Constraints

- Every Agent, Skill, and Template has a non-null immutable `originTeamId`.
- Public resource types are exactly `agent | skill | template`; Skill execution is `skillKind=text|image`.
- First BoardX publication requires BoardX Admin review; later content edits preserve approval and become live immediately.
- USER subscriptions are user + consumer Team scoped; TEAM subscriptions require current-Team owner/admin.
- Edit authorization changes the original item without changing ownership or Team; copy creates an independent current-Team draft.
- Reuse existing APIs and packages; do not introduce a new state library or UI dependency.
- Follow `.harness/instructions/uiux-standards.md`, including semantic tokens, shadcn controls, loading/empty/error/success states, keyboard support, and 375/768/1280 layouts.
- Preserve Harness one-feature-at-a-time ownership and use `pnpm harness verify` for status transitions.

---

### Task 1: Finish F06 BoardX review and live approved updates

**Files:**
- Modify: `packages/data/src/aiStoreSubscriptions.ts`
- Modify: `apps/web/app/api/ai-store/items/route.ts`
- Modify: `apps/web/app/(app)/ai-store/store-browser.tsx`
- Modify: `apps/web/e2e/admin-003-ai-store-approval.spec.ts`
- Modify: `apps/web/e2e/admin-004-featured-ai-store.spec.ts`
- Create: `apps/web/e2e/ai-store-009-live-approved-updates.spec.ts`
- Verify through: `phases/phase-p27-aiStore/feature_list.json`

**Interfaces:**
- Consumes: `canSubscribeAiStoreItem({ status, scope })`, `getAiStoreItemForSubscription(id)`.
- Produces: approved platform resources can be subscribed; revoked approved resources remain in existing subscription lists as `unavailable: true`; edits preserve `approved` and expose the latest version.

- [ ] **Step 1: Run the focused F06 suite against healthy PostgreSQL and capture the actual failing assertion**

Run:
```bash
docker compose --env-file .env -p main -f infra/docker-compose.yml up -d postgres redis
pnpm --filter @repo/web exec playwright test e2e/admin-003-ai-store-approval.spec.ts e2e/admin-004-featured-ai-store.spec.ts e2e/ai-store-009-live-approved-updates.spec.ts --workers=1
```
Expected: any failure identifies a business assertion; infrastructure connection failures are fixed before code changes.

- [ ] **Step 2: Keep subscription eligibility explicit**

Required implementation:
```ts
export function canSubscribeAiStoreItem(item: {
  status: string;
  scope: AiStoreItemScope;
}): boolean {
  return item.status === "published" ||
    (item.scope === "platform" && item.status === "approved");
}
```

- [ ] **Step 3: Return existing revoked subscriptions as unavailable**

Required mapping in the subscribed-list route:
```ts
const unavailable = item.archived_at != null ||
  (item.scope === "platform"
    ? item.status !== "approved" && item.status !== "published"
    : item.status !== "published");
```

- [ ] **Step 4: Verify the Store detail permits approved platform subscriptions and waits for durable server success**

The action predicate must be shared rather than repeated:
```ts
function isSubscribable(item: Pick<StoreItem, "scope" | "status">) {
  return item.status === "published" ||
    (item.scope === "platform" && item.status === "approved");
}
```

- [ ] **Step 5: Run the F06 verification and transition it through Harness**

Run:
```bash
pnpm harness verify --sprint p27/03
```
Expected: F06 becomes `passing` with evidence; no manual status edit.

- [ ] **Step 6: Commit only F06 files**

```bash
git add packages/data/src/aiStoreSubscriptions.ts packages/data/src/index.ts apps/web/app/api/ai-store/items/route.ts 'apps/web/app/(app)/ai-store/store-browser.tsx' apps/web/e2e/admin-003-ai-store-approval.spec.ts apps/web/e2e/admin-004-featured-ai-store.spec.ts apps/web/e2e/ai-store-009-live-approved-updates.spec.ts phases/phase-p27-aiStore/feature_list.json .harness/state/PROGRESS.md
git commit -m "feat(ai-store): complete BoardX approved lifecycle"
```

### Task 2: Record the approved UI expansion in Harness

**Files:**
- Modify: `phases/phase-p27-aiStore/phase.md`
- Create: `phases/phase-p27-aiStore/requirements/08-resource-library-ui.md`
- Create: `phases/phase-p27-aiStore/ui-signoff.md`
- Modify: `phases/phase-p27-aiStore/feature_list.json`
- Reference: `docs/superpowers/specs/2026-07-17-ai-store-resource-library-redesign.md`

**Interfaces:**
- Consumes: approved design spec and selected Resource Library visual direction.
- Produces: a confirmed UI gate plus F13 `Resource Library workspace` and F14 `Resource Library authoring and review` contracts with executable selectors and viewport checks; no existing passing feature is reopened.

- [ ] **Step 1: Remove the obsolete phase exclusion**

Replace the statement excluding visual redesign with a bounded scope statement: redesign only AI Store surfaces, preserve application shell and backend contracts.

- [ ] **Step 2: Write the UI requirement with exact destinations and states**

The requirement must name Explore, Featured, My subscriptions, Created by me, Authorized editing, Shared with me, Team review, BoardX review, and Create resource, plus `loading`, `empty`, `403`, `409`, and `410` behavior.

- [ ] **Step 3: Record human confirmation**

`ui-signoff.md` must contain:
```yaml
status: confirmed
confirmed_at: 2026-07-17
direction: resource-library-option-1
spec: docs/superpowers/specs/2026-07-17-ai-store-resource-library-redesign.md
```

- [ ] **Step 4: Add UI feature contracts through the repository requirement-author workflow**

F13 covers navigation, catalog, detail, subscriptions, and responsive states. F14 covers editors, sharing/copy actions, Team review, BoardX review, and local error states. Each contract must have a real Playwright command and stable `data-testid` targets. Run the Harness validation command used by this phase and fix schema errors before implementation.

- [ ] **Step 5: Commit the requirement delta**

```bash
git add phases/phase-p27-aiStore/phase.md phases/phase-p27-aiStore/requirements/08-resource-library-ui.md phases/phase-p27-aiStore/ui-signoff.md phases/phase-p27-aiStore/feature_list.json
git commit -m "docs(ai-store): add confirmed resource library UI scope"
```

### Task 3: Build the Resource Library workspace shell

**Files:**
- Create: `apps/web/app/(app)/ai-store/_components/store-types.ts`
- Create: `apps/web/app/(app)/ai-store/_components/store-navigation.tsx`
- Create: `apps/web/app/(app)/ai-store/_components/store-toolbar.tsx`
- Create: `apps/web/app/(app)/ai-store/_components/resource-catalog.tsx`
- Create: `apps/web/app/(app)/ai-store/_components/resource-detail-panel.tsx`
- Create: `apps/web/app/(app)/ai-store/_hooks/use-store-query.ts`
- Modify: `apps/web/app/(app)/ai-store/store-browser.tsx`
- Test: `apps/web/e2e/ai-store-015-resource-library-shell.spec.ts`

**Interfaces:**
- Produces: `StoreDestination`, `StoreItem`, `StoreQuery`, `StoreCapabilities`, and `useStoreQuery()`.

```ts
export type StoreDestination =
  | "explore" | "featured" | "subscriptions" | "created"
  | "authorized" | "shared" | "team-review" | "boardx-review";

export interface StoreQuery {
  destination: StoreDestination;
  type: "all" | "agent" | "skill" | "template";
  q: string;
  tags: string[];
  page: number;
  sort: "featured" | "updated" | "name";
}
```

- [ ] **Step 1: Write the failing shell E2E**

Assert all role-appropriate destinations, `create-resource`, `store-search`, type segmented controls, loading skeleton, compact empty state, row selection, and detail panel retention.

- [ ] **Step 2: Run the shell E2E and confirm failure**

```bash
pnpm --filter @repo/web exec playwright test e2e/ai-store-015-resource-library-shell.spec.ts
```
Expected: FAIL because Resource Library selectors do not exist.

- [ ] **Step 3: Extract shared types and URL query state**

`useStoreQuery` must parse only known values, update `history.replaceState`, and reset `page=1` when search/type/tags change.

- [ ] **Step 4: Implement stale-request protection**

```ts
const requestIdRef = useRef(0);
async function load(query: StoreQuery) {
  const requestId = ++requestIdRef.current;
  const response = await fetch(buildStoreUrl(query), { signal });
  if (requestId !== requestIdRef.current) return;
  setState(await response.json());
}
```

Abort and clear Team-scoped state synchronously when the current Team changes.

- [ ] **Step 5: Implement desktop table, tablet condensed table, and mobile list**

Use existing `Button`, `Input`, `Select`, `Badge`, `Dialog`, `DropdownMenu`, and Lucide icons. Do not add a table dependency; use semantic table markup and responsive CSS.

- [ ] **Step 6: Run E2E, design lint, and type check**

```bash
pnpm --filter @repo/web exec playwright test e2e/ai-store-015-resource-library-shell.spec.ts
pnpm lint-design
pnpm --filter @repo/web typecheck
```
Expected: all pass with no overflow at 375, 768, and 1280.

### Task 4: Complete F07 USER/TEAM subscriptions and current-Team use

**Files:**
- Modify: `packages/data/src/aiStoreSubscriptions.ts`
- Modify: `apps/web/app/api/ai-store/items/[id]/subscribe/route.ts`
- Modify: `apps/web/app/api/ai-store/items/route.ts`
- Create: `apps/web/app/(app)/ai-store/_components/subscription-manager.tsx`
- Create: `apps/web/e2e/ai-store-010-user-team-subscriptions.spec.ts`

**Interfaces:**
- Produces:
```ts
type SubscriptionScope = "personal" | "team";
type SubscriptionAvailability = {
  personal: boolean;
  team: boolean;
  canManageTeam: boolean;
};
```

- [ ] **Step 1: Write E2E for ordinary USER subscription, admin TEAM subscription, 403 ordinary TEAM mutation, Team isolation, use, and cancellation.**
- [ ] **Step 2: Run it and confirm the missing TEAM behavior fails.**
- [ ] **Step 3: Add server-authoritative scope validation and idempotent USER/TEAM keys.**
- [ ] **Step 4: Add the `For me` / `For team` control and inherited Team availability state.**
- [ ] **Step 5: Wait for the POST/DELETE response before success and invalidate the latest subscription query only.**
- [ ] **Step 6: Run the F07 E2E and `pnpm harness verify --sprint p27/04`.**

### Task 5: Complete F08 favorites and view statistics

**Files:**
- Modify: `apps/web/app/api/ai-store/items/[id]/favorite/route.ts`
- Modify: `packages/data/src/aiStore.ts`
- Modify: `apps/web/app/(app)/ai-store/_components/resource-catalog.tsx`
- Modify: `apps/web/app/(app)/ai-store/_components/resource-detail-panel.tsx`
- Modify: `apps/web/e2e/ai-store-004-favorite-item.spec.ts`

**Interfaces:**
- Produces Team-keyed favorite state and server-authoritative aggregate counters.

- [ ] **Step 1: Extend the E2E with two Teams and a forced mutation failure rollback assertion.**
- [ ] **Step 2: Run it and confirm the cross-Team/rollback assertion fails.**
- [ ] **Step 3: Key favorite writes by user, current Team, and item and reject invisible items.**
- [ ] **Step 4: Apply optimistic updates only with a complete row/detail rollback snapshot.**
- [ ] **Step 5: Run F08 verification and advance through Harness.**

### Task 6: Complete F09 cross-Team edit sharing

**Files:**
- Modify: `packages/data/src/aiStore.ts`
- Modify: `apps/web/app/api/ai-store/items/[id]/share/route.ts`
- Modify: `apps/web/app/api/ai-store/items/[id]/share/redeem/route.ts`
- Modify: `apps/web/app/api/ai-store/items/[id]/share/grantees/[userId]/route.ts`
- Create: `apps/web/app/(app)/ai-store/_components/share-access-manager.tsx`
- Create: `apps/web/e2e/ai-store-011-cross-team-edit-share.spec.ts`

**Interfaces:**
- Produces accepted `edit` authorization on the original item; owner and source Team never change.

- [ ] **Step 1: Write E2E for link creation, cross-Team acceptance, content edit, forbidden lifecycle/share/copy/archive fields, user revocation, and link closure.**
- [ ] **Step 2: Run it and record the first missing behavior.**
- [ ] **Step 3: Make share acceptance idempotent and authorization checks server-side.**
- [ ] **Step 4: Implement incoming Shared with me and accepted Authorized editing states with source Team labels.**
- [ ] **Step 5: Preserve unsaved editor content when a save receives 403 after revocation.**
- [ ] **Step 6: Run F09 E2E and Harness verification.**

### Task 7: Complete F10 independent copies

**Files:**
- Modify: `packages/data/src/aiStore.ts`
- Create: `apps/web/app/api/ai-store/items/[id]/copy/route.ts`
- Create: `apps/web/app/(app)/ai-store/_components/copy-resource-dialog.tsx`
- Create: `apps/web/e2e/ai-store-012-copy-resources.spec.ts`

**Interfaces:**
- Consumes `Idempotency-Key` and current Team context.
- Produces a new private draft with `copiedFromItemId` and `copiedFromVersion`.

- [ ] **Step 1: Write E2E for disabled copy, Agent/Skill copy independence, Template Board deep copy, and idempotent retry.**
- [ ] **Step 2: Run it and confirm the copy route is missing.**
- [ ] **Step 3: Implement one database transaction for resource/config/audit and Template Board deep copy.**
- [ ] **Step 4: Implement target-Team confirmation and route success to Created by me.**
- [ ] **Step 5: Run F10 E2E and Harness verification.**

### Task 8: Complete F11 runtime integrations

**Files:**
- Modify: `apps/web/lib/ava-agents.ts`
- Create: `apps/web/lib/ava-skills.ts`
- Modify: `apps/web/app/api/ava/capabilities/route.ts`
- Modify: `apps/web/app/(app)/ava/page.tsx`
- Modify: `apps/web/app/(app)/boards/page.tsx`
- Create: `apps/web/app/api/ai-store/items/[id]/use/route.ts`
- Create: `apps/web/app/api/ai-store/items/[id]/recommendations/route.ts`
- Create: `apps/web/app/api/ai-store/agent-builder/turn/route.ts`
- Create: `apps/web/e2e/ai-store-013-agent-builder-recommendations.spec.ts`
- Modify: `apps/web/e2e/ava-ai-store-skills.spec.ts`

**Interfaces:**
- Produces current-Team-only selectors that resolve the subscribed item's latest version at execution time.

- [ ] **Step 1: Pin the runtime contracts in failing tests before editing.**

`GET /api/ava/capabilities` supplies subscribed Agent and Skill options; `POST /api/ai-store/items/[id]/use` authorizes the latest item for the current Team; `POST /api/ai-store/agent-builder/turn` returns a validated editable Agent draft; `GET /api/ai-store/items/[id]/recommendations` returns only currently usable Agents.
- [ ] **Step 2: Write failing E2E for latest Agent, text/image Skill dispatch, Template target Team, Builder target Team, and filtered recommendations.**
- [ ] **Step 3: Enforce subscription and current-Team membership at each execution endpoint.**
- [ ] **Step 4: Clear stale selection/session state synchronously on Team change.**
- [ ] **Step 5: Return an empty recommendation array without failing the completed Skill result.**
- [ ] **Step 6: Run F11 E2E and Harness verification.**

### Task 9: Finish editor, review, error, and responsive Resource Library states

**Files:**
- Create: `apps/web/app/(app)/ai-store/_components/resource-editor.tsx`
- Create: `apps/web/app/(app)/ai-store/_components/review-queue.tsx`
- Modify: `apps/web/app/(app)/ai-store/store-browser.tsx`
- Modify: Team and BoardX review pages to reuse `review-queue.tsx`
- Test: UI feature E2E contracts added in Task 2

**Interfaces:**
- Consumes existing create/update/archive, Team review, BoardX review, Featured, share, copy, and subscription routes.
- Produces one consistent editor and review visual language with local 400/403/404/409/410 states.

- [ ] **Step 1: Write failing E2E for editor preview retention, version conflict, role-gated review destinations, and compact errors.**
- [ ] **Step 2: Extract the existing Agent/Skill/Template form without changing payload semantics.**
- [ ] **Step 3: Reuse one review queue for Team and BoardX with role-specific actions.**
- [ ] **Step 4: Add stable skeleton, empty, error, and success regions using required `data-testid` attributes.**
- [ ] **Step 5: Verify keyboard navigation and no overflow at 375/768/1280.**
- [ ] **Step 6: Run UI E2E, design lint, type check, and Harness verification.**

### Task 10: Complete F12 migration and regression closure

**Files:**
- Create: `apps/web/e2e/ai-store-014-legacy-compat.spec.ts`
- Modify only compatibility defects proven by the regression suite.
- Update through Harness: p27 evidence, progress, and handoff files.

**Interfaces:**
- Produces complete compatibility evidence; public responses expose only Agent/Skills/Template.

- [ ] **Step 1: Write legacy fixtures covering old item type aliases and their subscriptions, favorites, shares, reviews, Featured state, and statistics.**
- [ ] **Step 2: Run the exact F12 regression command and fix one proven defect at a time.**

```bash
pnpm --filter @repo/web exec playwright test e2e/ai-store-001-browse-items.spec.ts e2e/ai-store-002-create-update-item.spec.ts e2e/ai-store-003-subscribe-use-item.spec.ts e2e/ai-store-005-share-management.spec.ts e2e/ai-store-014-legacy-compat.spec.ts --workers=1
pnpm -w run verify:base
```

- [ ] **Step 3: Run every p27 feature verification plus design lint and viewport checks.**
- [ ] **Step 4: Run `pnpm harness doctor --phase p27` and fix evidence or derived-view drift.**
- [ ] **Step 5: Run final Harness verification, update handoff, and commit only verified closure files.**
- [ ] **Step 6: Start the web app and provide the reachable local URL for human validation.**
