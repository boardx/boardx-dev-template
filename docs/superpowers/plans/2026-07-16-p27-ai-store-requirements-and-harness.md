# Phase p27 AI Store Requirements and Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current partial p27 AI Store draft with a standalone, source-backed requirements package, a 12-feature Harness execution plan, and reusable parent-Issue projection bound to GitHub Issue #662.

**Architecture:** Keep repository files as the sole source of truth. Add optional `tracking_issue` metadata to a roadmap phase, project that parent reference into every generated Feature Issue, and organize the AI Store requirements by functional baseline, lifecycle/permissions, sharing/copying, and data/API contracts. Runtime AI Store implementation remains future Feature work; this plan changes only the control plane and requirements.

**Tech Stack:** TypeScript, Node.js 22, Vitest, YAML, pnpm Harness CLI, Markdown, JSON.

## Global Constraints

- GitHub Issue #662 is the only Phase p27 umbrella issue.
- Agent, Skill, and Template resources require immutable `originTeamId`.
- BoardX-approved resources are visible to every authenticated BoardX user.
- Ordinary Team members may create only USER subscriptions in the current Team.
- Team owner/admin may create or cancel TEAM subscriptions for the current Team.
- Initial BoardX publication requires review; later edits take effect immediately without re-review.
- USER and TEAM subscriptions always resolve the latest source-resource version.
- Edit sharing grants cross-Team editing of the original resource without transferring ownership.
- `allowCopy=true` creates an independent draft in the copier's current Team.
- AI Tool and AI Image Tool become one public Skills category with `skillKind=text|image`.
- Do not modify existing unrelated changes in `.gitignore`, `apps/web/package.json`, or `apps/web/scripts/next-dev.mjs`.
- Do not hand-edit any `active-features.json`.
- Do not mark any Feature `passing`; only Harness verification may do that.

---

## File Structure

### Harness parent-Issue support

- Modify `.harness/scripts/lib/types.ts`: add optional `tracking_issue` to `RoadmapPhase`.
- Modify `.harness/scripts/lib/roadmap.ts`: preserve `tracking_issue` when rewriting roadmap YAML.
- Modify `.harness/scripts/sync-github.ts`: add `Parent: #662` to generated p27 Feature Issue bodies through generic tracking-Issue metadata.
- Modify `.harness/templates/github-issue-body.template.md`: document parent-Issue projection.
- Create `.harness/scripts/lib/roadmap.test.ts`: verify roadmap rendering preserves `tracking_issue`.
- Create `.harness/scripts/sync-github.test.ts`: verify Feature Issue bodies link to #662.

### Phase p27 requirements

- Modify `.harness/state/roadmap.yaml`: bind p27 to `tracking_issue: 662`.
- Modify `phases/phase-p27-aiStore/phase.md`: add #662 and the complete phase boundary.
- Modify `phases/phase-p27-aiStore/AGENTS.md`: add the parent-Issue and product invariants.
- Modify `phases/phase-p27-aiStore/requirements/README.md`: index the complete requirement set.
- Modify `phases/phase-p27-aiStore/requirements/00-overview.md`: replace the migration-only overview with the complete product summary.
- Modify `phases/phase-p27-aiStore/requirements/01-source-inventory.md`: list all relevant source capabilities and intentional exclusions.
- Modify `phases/phase-p27-aiStore/requirements/02-skills-unification.md`: align Skills with live version propagation.
- Modify `phases/phase-p27-aiStore/requirements/03-team-tenancy.md`: distinguish origin Team, consumer Team, USER subscription, TEAM subscription, and Authorized exceptions.
- Create `phases/phase-p27-aiStore/requirements/04-functional-baseline.md`: document the full user journey.
- Create `phases/phase-p27-aiStore/requirements/05-lifecycle-permissions.md`: document status machines and actor permissions.
- Create `phases/phase-p27-aiStore/requirements/06-sharing-copying.md`: document edit authorization and independent copying.
- Create `phases/phase-p27-aiStore/requirements/07-data-api-contract.md`: document canonical fields, API rules, migration, concurrency, and errors.

### Harness work breakdown

- Replace `phases/phase-p27-aiStore/feature_list.json`: define 12 independently verifiable Features.
- Modify existing Sprint 01 and Sprint 02 metadata/progress/handoff.
- Create Sprint 03 through Sprint 06 with Harness.
- Regenerate every `active-features.json` through Harness library functions.
- Update `phases/phase-p27-aiStore/progress.md`.

---

### Task 1: Add reusable parent-Issue metadata to Harness

**Files:**
- Create: `.harness/scripts/lib/roadmap.test.ts`
- Create: `.harness/scripts/sync-github.test.ts`
- Modify: `.harness/scripts/lib/types.ts`
- Modify: `.harness/scripts/lib/roadmap.ts`
- Modify: `.harness/scripts/sync-github.ts`
- Modify: `.harness/templates/github-issue-body.template.md`

**Interfaces:**
- Produces: `RoadmapPhase.tracking_issue?: number`
- Produces: `renderRoadmapPhase(phase: RoadmapPhase): string`
- Produces: `buildIssueBody(..., trackingIssue?: number): string`
- Consumes: existing roadmap YAML and Feature Issue projection flow

- [ ] **Step 1: Write the failing roadmap rendering test**

Create `.harness/scripts/lib/roadmap.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderRoadmapPhase } from "./roadmap";

describe("renderRoadmapPhase", () => {
  it("preserves a phase tracking issue", () => {
    const yaml = renderRoadmapPhase({
      id: "p27",
      slug: "aiStore",
      name: "AI Store",
      goal: "Complete AI Store",
      status: "not_started",
      depends_on: [],
      tracking_issue: 662,
    });

    expect(yaml).toContain('id: "p27"');
    expect(yaml).toContain("tracking_issue: 662");
  });
});
```

- [ ] **Step 2: Write the failing Feature Issue body test**

Create `.harness/scripts/sync-github.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildIssueBody } from "./sync-github";
import type { Feature, FeatureList } from "./lib/types";

describe("buildIssueBody", () => {
  it("links p27 feature issues to parent issue 662", () => {
    const feature: Feature = {
      id: "F01",
      priority: 1,
      area: "ai-store-data",
      title: "Team tenancy",
      user_visible_behavior: "Team resources are isolated.",
      status: "not_started",
      sprint: "01",
      owner: null,
      capability: "CAP-DATA",
      depends_on: [],
      wave: 0,
      verification: ["true"],
      evidence: "",
      notes: "Parent issue projection test.",
    };
    const featureList: FeatureList = { phase: "p27", features: [feature] };

    const body = buildIssueBody(
      feature,
      "p27",
      "01",
      "boardx/boardx-dev-template",
      featureList,
      662,
    );

    expect(body).toContain("## Parent Tracking Issue");
    expect(body).toContain("Parent: #662");
    expect(body).toContain(
      "https://github.com/boardx/boardx-dev-template/issues/662",
    );
  });
});
```

- [ ] **Step 3: Run the tests and verify they fail**

Run:

```bash
pnpm exec vitest run .harness/scripts/lib/roadmap.test.ts .harness/scripts/sync-github.test.ts
```

Expected: FAIL because `tracking_issue`, `renderRoadmapPhase`, and exported `buildIssueBody` do not exist.

- [ ] **Step 4: Add the roadmap type and renderer**

In `.harness/scripts/lib/types.ts`, add:

```ts
export interface RoadmapPhase {
  id: string;
  slug: string;
  name: string;
  goal: string;
  status: PhaseStatus;
  depends_on: string[];
  has_ui?: boolean;
  /** Existing GitHub umbrella issue used for external phase coordination. */
  tracking_issue?: number;
}
```

In `.harness/scripts/lib/roadmap.ts`, replace the private `dumpPhase` function with:

```ts
export function renderRoadmapPhase(p: RoadmapPhase): string {
  const dep = p.depends_on.length
    ? `[${p.depends_on.map((d) => `"${d}"`).join(", ")}]`
    : "[]";
  const lines = [
    `  - id: "${p.id}"`,
    `    slug: ${p.slug}`,
    `    name: ${p.name}`,
    `    goal: "${p.goal.replace(/"/g, '\\"')}"`,
    `    status: ${p.status}`,
    `    depends_on: ${dep}`,
  ];
  if (p.has_ui) lines.push(`    has_ui: true`);
  if (p.tracking_issue != null) {
    lines.push(`    tracking_issue: ${p.tracking_issue}`);
  }
  return lines.join("\n");
}
```

Change `saveRoadmap` to call:

```ts
const body = r.phases.map(renderRoadmapPhase).join("\n");
```

- [ ] **Step 5: Add the parent reference to Feature Issue bodies**

Export `buildIssueBody` from `.harness/scripts/sync-github.ts` and add a final argument:

```ts
export function buildIssueBody(
  f: Feature,
  phaseId: string,
  sprintId: string,
  repo: string,
  fl: FeatureList,
  trackingIssue?: number,
): string {
```

Insert this section before `## 交付契约`:

```ts
const parentSection = trackingIssue == null
  ? []
  : [
      `## Parent Tracking Issue`,
      ``,
      `Parent: #${trackingIssue}`,
      ``,
      `https://github.com/${repo}/issues/${trackingIssue}`,
      ``,
    ];
```

Include `...parentSection` at the start of the returned array.

Pass the phase metadata from `syncGithub`:

```ts
const body = buildIssueBody(
  f,
  phaseId,
  sid,
  cfg.repo,
  fl,
  phase.tracking_issue,
);
```

- [ ] **Step 6: Update the Issue body template specification**

Add this required section to `.harness/templates/github-issue-body.template.md`:

```markdown
## Parent Tracking Issue
Parent: #662
https://github.com/boardx/boardx-dev-template/issues/662
```

Document that phases without `tracking_issue` omit the section.

- [ ] **Step 7: Run the focused tests**

Run:

```bash
pnpm exec vitest run .harness/scripts/lib/roadmap.test.ts .harness/scripts/sync-github.test.ts
```

Expected: 2 test files pass, 2 tests pass.

- [ ] **Step 8: Commit the Harness capability**

```bash
git add .harness/scripts/lib/types.ts .harness/scripts/lib/roadmap.ts .harness/scripts/lib/roadmap.test.ts .harness/scripts/sync-github.ts .harness/scripts/sync-github.test.ts .harness/templates/github-issue-body.template.md
git commit -m "feat(harness): support phase tracking issues"
```

---

### Task 2: Bind p27 metadata and requirement entry points to Issue #662

**Files:**
- Modify: `.harness/state/roadmap.yaml`
- Modify: `phases/phase-p27-aiStore/phase.md`
- Modify: `phases/phase-p27-aiStore/AGENTS.md`
- Modify: `phases/phase-p27-aiStore/requirements/README.md`

**Interfaces:**
- Consumes: `RoadmapPhase.tracking_issue`
- Produces: stable repository-side links to Issue #662

- [ ] **Step 1: Add p27 tracking metadata**

Add to the p27 roadmap entry:

```yaml
    tracking_issue: 662
```

- [ ] **Step 2: Add the phase-level issue contract**

Add to `phase.md`:

```markdown
## GitHub 总追踪

- Parent Issue: [#662](https://github.com/boardx/boardx-dev-template/issues/662)
- 仓库是唯一事实来源；#662 是外部协调与汇总视图。
- 单个 Feature 完成不关闭 #662；仅全部 Feature passing 后由 coordinator 关闭。
```

- [ ] **Step 3: Add scoped agent instructions**

Add to `AGENTS.md`:

```markdown
## GitHub 投影

- 本阶段唯一总追踪 Issue 是 #662。
- 所有 Feature Issue 必须回链 `Parent: #662`。
- 禁止创建第二个 AI Store 总追踪 Issue。
```

- [ ] **Step 4: Update the requirements index**

Add the Issue URL and list `04` through `07` requirement files in `requirements/README.md`.

- [ ] **Step 5: Verify repository-side binding**

Run:

```bash
rg -n "issues/662|Parent: #662|tracking_issue: 662" \
  .harness/state/roadmap.yaml \
  phases/phase-p27-aiStore/phase.md \
  phases/phase-p27-aiStore/AGENTS.md \
  phases/phase-p27-aiStore/requirements/README.md
```

Expected: all four files contain the binding.

- [ ] **Step 6: Commit the phase binding**

```bash
git add .harness/state/roadmap.yaml phases/phase-p27-aiStore/phase.md phases/phase-p27-aiStore/AGENTS.md phases/phase-p27-aiStore/requirements/README.md
git commit -m "docs(ai-store): bind phase p27 to issue 662"
```

---

### Task 3: Write the complete AI Store requirements package

**Files:**
- Modify: `phases/phase-p27-aiStore/requirements/00-overview.md`
- Modify: `phases/phase-p27-aiStore/requirements/01-source-inventory.md`
- Modify: `phases/phase-p27-aiStore/requirements/02-skills-unification.md`
- Modify: `phases/phase-p27-aiStore/requirements/03-team-tenancy.md`
- Create: `phases/phase-p27-aiStore/requirements/04-functional-baseline.md`
- Create: `phases/phase-p27-aiStore/requirements/05-lifecycle-permissions.md`
- Create: `phases/phase-p27-aiStore/requirements/06-sharing-copying.md`
- Create: `phases/phase-p27-aiStore/requirements/07-data-api-contract.md`

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-07-16-p27-ai-store-requirements-design.md`
- Produces: complete input for `feature_list.json`

- [ ] **Step 1: Rewrite the overview**

Make `00-overview.md` explicitly state:

```markdown
- BoardX approved resources are visible to every authenticated user.
- Ordinary members may create USER subscriptions only.
- Team owner/admin may create TEAM subscriptions.
- Approved-resource edits take effect immediately without re-review.
- Subscriptions follow the latest source version.
- Edit sharing modifies the original resource.
- Copying creates an independent draft when allowCopy is enabled.
```

- [ ] **Step 2: Expand the source inventory**

Document these source capabilities in `01-source-inventory.md`:

```markdown
- List/search/pagination/detail/view count
- Create/update/delete
- Agent builder
- USER/TEAM subscriptions
- Favorites
- Team review and featured
- BoardX review and featured
- Management-share create/info/accept/access-list/revoke/revoke-user
- Agent, text Skill, image Skill, and Template use actions
- Skill-to-Agent next recommendations
```

For each capability, record `boardx-web` and `boardx-backend` source paths and whether p27 retains, changes, or excludes it.

- [ ] **Step 3: Complete Skills and Team contracts**

Update `02-skills-unification.md` and `03-team-tenancy.md` with:

```markdown
type=skill
skillKind=text|image
originTeamId is the immutable source Team
consumerTeamId is the subscribing Team
USER subscription belongs to one user in one Team
TEAM subscription belongs to all members of one Team
Authorized is a cross-Team edit capability, not Team membership
```

- [ ] **Step 4: Create the functional baseline**

Write `04-functional-baseline.md` with these exact top-level sections:

```markdown
## Navigation
## Explore
## Detail
## Create / Edit / Preview
## Archive
## Team Publish / Review / Featured
## BoardX Publish / Review / Featured
## USER and TEAM Subscription
## Agent Use
## Skills Use
## Template Use
## Favorite and View Statistics
## Shared / Authorized
## Copy
## Agent Builder
## Skill Next Recommendations
```

Each section must include trigger, visible result, permission failure, Team behavior, and stable error/empty state.

- [ ] **Step 5: Create lifecycle and permission rules**

Write `05-lifecycle-permissions.md` with:

```markdown
teamStatus: draft | pending | published | rejected
boardxStatus: not_submitted | pending | approved | rejected
```

Include:

- Team approve/reject/withdraw transitions.
- BoardX approve/reject/revoke transitions.
- Initial BoardX approval requirement.
- Immediate edits after approval without re-review.
- The full role/action matrix from the approved design.
- Audit requirements for actor, time, action, version, and changed fields.

- [ ] **Step 6: Create sharing and copying rules**

Write `06-sharing-copying.md` with:

```markdown
Edit share:
- edits original itemId
- does not change createdBy or originTeamId
- owner controls link, revocation, lifecycle, allowCopy, and archive

Copy:
- requires allowCopy=true
- creates new itemId in current Team
- starts private/draft/not_submitted
- records copiedFromItemId and copiedFromVersion
- does not inherit subscriptions, favorites, stats, review, featured, or shares
- Template deep-copies its Board into the target Team
```

- [ ] **Step 7: Create data and API rules**

Write `07-data-api-contract.md` with canonical Resource, Subscription, EditAuthorization, and RevisionAudit fields. Include:

- Trusted Team context.
- 400/403/404/409/410 behavior.
- Optimistic version conflict.
- Migration of old tool types and nullable Team relations.
- USER/TEAM subscription authorization.
- Latest-version resolution.
- Idempotency.

- [ ] **Step 8: Run the requirement completeness check**

Run:

```bash
node -e "const fs=require('fs'); const d='phases/phase-p27-aiStore/requirements'; const files=fs.readdirSync(d).filter(f=>f.endsWith('.md')).sort(); const text=files.map(f=>fs.readFileSync(d+'/'+f,'utf8')).join('\n'); const required=['Explore','Agent Builder','TEAM 订阅','USER 订阅','BoardX','Authorized','allowCopy','copiedFromItemId','RevisionAudit','skillKind']; for(const x of required){if(!text.includes(x)) throw new Error('missing '+x)} console.log(files.length+' requirement files cover '+required.length+' contracts')"
```

Expected: exit 0 and at least 9 Markdown files are reported.

- [ ] **Step 9: Commit the requirements**

```bash
git add phases/phase-p27-aiStore/requirements
git commit -m "docs(ai-store): define complete p27 requirements"
```

---

### Task 4: Replace the authoritative Feature list with 12 executable Features

**Files:**
- Replace: `phases/phase-p27-aiStore/feature_list.json`

**Interfaces:**
- Consumes: all p27 requirement files
- Produces: F01 through F12 as the only authoritative implementation list

- [ ] **Step 1: Define the Feature IDs and dependencies**

Use this exact dependency graph:

```text
F01 Team tenancy and migration audit
F02 Skills model and live versioning <- F01
F03 Explore/navigation/detail <- F01,F02
F04 Create/edit/preview/archive <- F01,F02
F05 Team review/featured <- F04
F06 BoardX review/featured/live edits <- F04,F05
F07 USER/TEAM subscriptions and use <- F03,F06
F08 Favorite/views <- F03
F09 Edit sharing and Authorized/Shared <- F04
F10 allowCopy and independent copies <- F04,F09
F11 AVA/Template/Agent Builder/recommendations <- F07
F12 Migration compatibility and complete regression <- F01-F11
```

- [ ] **Step 2: Define exact verification contracts**

Use these verification targets:

```json
{
  "F01": [
    "pnpm --filter @repo/data test -- src/aiStore.teamIsolation.test.ts",
    "pnpm --filter @repo/data test -- src/aiStore.migrationAudit.test.ts"
  ],
  "F02": [
    "pnpm --filter @repo/data test -- src/aiStore.skillsVersioning.test.ts",
    "pnpm --filter @repo/web test -- app/api/ai-store/items/skills-versioning.route.test.ts"
  ],
  "F03": [
    "pnpm --filter @repo/web exec playwright test e2e/ai-store-007-explore-complete.spec.ts"
  ],
  "F04": [
    "pnpm --filter @repo/web exec playwright test e2e/ai-store-008-authoring-archive.spec.ts"
  ],
  "F05": [
    "pnpm --filter @repo/web exec playwright test e2e/ai-store-006-approval-featured.spec.ts"
  ],
  "F06": [
    "pnpm --filter @repo/web exec playwright test e2e/admin-003-ai-store-approval.spec.ts e2e/admin-004-featured-ai-store.spec.ts e2e/ai-store-009-live-approved-updates.spec.ts"
  ],
  "F07": [
    "pnpm --filter @repo/web exec playwright test e2e/ai-store-010-user-team-subscriptions.spec.ts"
  ],
  "F08": [
    "pnpm --filter @repo/web exec playwright test e2e/ai-store-004-favorite-item.spec.ts"
  ],
  "F09": [
    "pnpm --filter @repo/web exec playwright test e2e/ai-store-011-cross-team-edit-share.spec.ts"
  ],
  "F10": [
    "pnpm --filter @repo/web exec playwright test e2e/ai-store-012-copy-resources.spec.ts"
  ],
  "F11": [
    "pnpm --filter @repo/web exec playwright test e2e/ava-ai-store-skills.spec.ts e2e/ai-store-013-agent-builder-recommendations.spec.ts"
  ],
  "F12": [
    "pnpm --filter @repo/web exec playwright test e2e/ai-store-001-browse-items.spec.ts e2e/ai-store-002-create-update-item.spec.ts e2e/ai-store-003-subscribe-use-item.spec.ts e2e/ai-store-005-share-management.spec.ts e2e/ai-store-014-legacy-compat.spec.ts",
    "pnpm -w run verify:base"
  ]
}
```

- [ ] **Step 3: Write each observable behavior**

Every `user_visible_behavior` must include:

- User action.
- Visible result.
- Team boundary.
- Permission failure.
- Immediate-version behavior where relevant.

Keep all statuses `not_started`, owners `null`, and evidence empty.

- [ ] **Step 4: Validate the Feature list**

Run:

```bash
node -e "const x=require('./phases/phase-p27-aiStore/feature_list.json'); if(x.phase!=='p27'||x.features.length!==12) process.exit(1); if(x.features.some((f,i)=>f.id!=='F'+String(i+1).padStart(2,'0')||f.status!=='not_started'||f.owner!==null||f.evidence!=='')) process.exit(2); console.log('p27 feature list: 12 clean features')"
```

Expected: `p27 feature list: 12 clean features`.

- [ ] **Step 5: Commit the Feature list**

```bash
git add phases/phase-p27-aiStore/feature_list.json
git commit -m "docs(ai-store): define p27 feature contracts"
```

---

### Task 5: Rebuild p27 into six focused Sprints

**Files:**
- Modify: `phases/phase-p27-aiStore/sprints/sprint-01/*`
- Modify: `phases/phase-p27-aiStore/sprints/sprint-02/*`
- Create: `phases/phase-p27-aiStore/sprints/sprint-03/*`
- Create: `phases/phase-p27-aiStore/sprints/sprint-04/*`
- Create: `phases/phase-p27-aiStore/sprints/sprint-05/*`
- Create: `phases/phase-p27-aiStore/sprints/sprint-06/*`

**Interfaces:**
- Consumes: F01 through F12
- Produces: two Features per Sprint, in dependency order

- [ ] **Step 1: Assign Features in `feature_list.json`**

Use:

```text
Sprint 01: F01,F02
Sprint 02: F03,F04
Sprint 03: F05,F06
Sprint 04: F07,F08
Sprint 05: F09,F10
Sprint 06: F11,F12
```

- [ ] **Step 2: Update existing Sprint 01 and 02 descriptions**

Use these goals:

```text
p27/01: Team tenancy, migration audit, Skills model, live versioning
p27/02: Complete Explore and authoring/archive workflows
```

- [ ] **Step 3: Scaffold Sprint 03 through 06**

Run:

```bash
node --import tsx .harness/scripts/cli.ts new-sprint --phase p27 --id 03 --goal "Team and BoardX review, featured, and live approved updates" --features F05,F06
node --import tsx .harness/scripts/cli.ts new-sprint --phase p27 --id 04 --goal "USER and TEAM subscriptions, use, favorites, and statistics" --features F07,F08
node --import tsx .harness/scripts/cli.ts new-sprint --phase p27 --id 05 --goal "Cross-Team edit sharing and independent resource copying" --features F09,F10
node --import tsx .harness/scripts/cli.ts new-sprint --phase p27 --id 06 --goal "AVA integrations, Agent Builder, recommendations, and final compatibility" --features F11,F12
```

Expected: each command creates one Sprint and derives two Features.

- [ ] **Step 4: Regenerate Sprint 01 and 02 derived views**

Run:

```bash
node --import tsx --input-type=module -e "const f=(await import('./.harness/scripts/lib/features.ts')).default; const p=(await import('./.harness/scripts/lib/progress.ts')).default; const fl=f.loadFeatureList('p27'); f.assertSingleInProgress(fl); for(const s of ['01','02','03','04','05','06']) f.writeActiveFeatures('p27',s,fl); p.refreshProgress();"
```

Expected: exit 0 with six consistent derived views.

- [ ] **Step 5: Validate Sprint allocation**

Run:

```bash
node -e "const fs=require('fs'); const fl=require('./phases/phase-p27-aiStore/feature_list.json'); for(const s of ['01','02','03','04','05','06']){const a=JSON.parse(fs.readFileSync('phases/phase-p27-aiStore/sprints/sprint-'+s+'/active-features.json','utf8')); if(a.features.length!==2) throw new Error(s+' must contain 2 features'); const expected=fl.features.filter(f=>f.sprint===s); if(JSON.stringify(a.features)!==JSON.stringify(expected)) throw new Error(s+' drift');} console.log('six sprints consistent')"
```

Expected: `six sprints consistent`.

- [ ] **Step 6: Commit the Sprint plan**

```bash
git add phases/phase-p27-aiStore/feature_list.json phases/phase-p27-aiStore/sprints .harness/state/PROGRESS.md
git commit -m "docs(ai-store): schedule p27 implementation sprints"
```

---

### Task 6: Update progress and handoff records

**Files:**
- Modify: `phases/phase-p27-aiStore/progress.md`
- Modify: every `phases/phase-p27-aiStore/sprints/sprint-*/progress.md`
- Modify: every `phases/phase-p27-aiStore/sprints/sprint-*/session-handoff.md`

**Interfaces:**
- Consumes: final Feature and Sprint structure
- Produces: command-level continuation instructions

- [ ] **Step 1: Update phase progress**

Record:

```markdown
- Parent Issue: #662
- Current highest priority: F01
- 12 Features / 6 Sprints / all not_started
- Runtime implementation has not started
- ./init.sh baseline must pass before F01 is claimed
```

- [ ] **Step 2: Update each Sprint progress**

For every Sprint, record its two Feature IDs, dependencies, verification targets, and blockers.

- [ ] **Step 3: Update each handoff**

Each handoff must identify:

- Exact first Feature to claim.
- Exact first failing test file to create.
- Exact Harness verify command.
- Features that must not start until dependencies pass.
- Parent Issue #662.

- [ ] **Step 4: Check for placeholders**

Run:

```bash
rg -n "repo 路径|无 / 描述|本轮目标:$|下一步最佳动作:$" phases/phase-p27-aiStore
```

Expected: no matches.

- [ ] **Step 5: Commit the handoff state**

```bash
git add phases/phase-p27-aiStore/progress.md phases/phase-p27-aiStore/sprints
git commit -m "docs(ai-store): finalize p27 handoff state"
```

---

### Task 7: Run final control-plane verification

**Files:**
- Verify only; modify files only if a check exposes drift.

**Interfaces:**
- Consumes: all prior tasks
- Produces: evidence that p27 is ready for implementation without claiming any Feature passing

- [ ] **Step 1: Run focused Harness tests**

Run:

```bash
pnpm exec vitest run .harness/scripts/lib/roadmap.test.ts .harness/scripts/sync-github.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run Harness doctor**

Run:

```bash
node --import tsx .harness/scripts/cli.ts doctor --phase p27
```

Expected: `0 FAIL / 0 WARN`.

- [ ] **Step 3: Run the GitHub sync dry-run**

Run:

```bash
node --import tsx .harness/scripts/cli.ts sync --phase p27
```

Expected:

- It plans one `Phase p27: AI Store` milestone.
- It plans Feature Issues only.
- It does not plan a second umbrella AI Store Issue.
- Unit tests prove every generated Feature body contains `Parent: #662`.

- [ ] **Step 4: Run base verification**

Run:

```bash
pnpm -w run verify:base
```

Expected: exit 0. If it fails because of the pre-existing workspace baseline, stop and record the exact failure without changing Feature status.

- [ ] **Step 5: Verify clean Feature state**

Run:

```bash
node -e "const x=require('./phases/phase-p27-aiStore/feature_list.json'); const counts=x.features.reduce((a,f)=>(a[f.status]=(a[f.status]||0)+1,a),{}); if(counts.not_started!==12||counts.in_progress||counts.blocked||counts.passing) process.exit(1); console.log(counts)"
```

Expected:

```text
{ not_started: 12 }
```

- [ ] **Step 6: Verify diff scope**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; unrelated pre-existing Web changes remain untouched.

- [ ] **Step 7: Commit any final derived-state corrections**

Only if doctor or derivation changed generated control-plane files:

```bash
git add .harness/state/PROGRESS.md phases/phase-p27-aiStore
git commit -m "chore(ai-store): verify p27 control plane"
```

---

## Execution Notes

- Do not run `pnpm harness verify --sprint p27/01` through `p27/06` during this documentation plan. The runtime verification files intentionally do not exist yet, and running verify would incorrectly move multiple planned Features to `in_progress`.
- Do not run `pnpm harness sync --phase p27 --apply` until `gh` CLI is installed, authenticated, and the dry-run is reviewed.
- When remote sync becomes available, first inspect Issue #662 and add any required labels or milestone linkage without replacing its existing body.
- Issue #662 remains open throughout implementation and closes only after every p27 Feature is passing.
