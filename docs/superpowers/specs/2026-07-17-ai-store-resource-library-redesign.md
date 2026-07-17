# AI Store Resource Library UIUX Redesign

- Date: 2026-07-17
- Status: Design approved; awaiting written-spec review
- Phase: `phase-p27-aiStore`
- Tracking issue: [boardx-dev-template#662](https://github.com/boardx/boardx-dev-template/issues/662)
- Selected visual direction: Option 1, Resource Library

## 1. Objective

Redesign AI Store as a professional, work-focused resource library while preserving and completing the existing product behavior. The result must use real backend APIs and support the full lifecycle of Team-scoped Agent, Skill, and Template resources.

This redesign is not a marketing page and not a visual-only prototype. It is the primary operational workspace for finding, subscribing to, creating, editing, sharing, copying, reviewing, and using AI resources.

## 2. Product Invariants

1. Every Agent, Skill, and Template has one immutable source Team (`originTeamId`).
2. AI Tool and Image Tool are one Store category named Skill. Execution differences remain under `skillKind=text|image`.
3. A resource must pass BoardX Admin review the first time it is published to BoardX.
4. An approved resource is visible to every authenticated BoardX user.
5. Visibility does not grant use. Use in a Team requires a USER subscription for the current user or a TEAM subscription for the current Team.
6. Only a current Team owner/admin can create or cancel a TEAM subscription. Any Team member can manage their own USER subscription.
7. Editing an approved or published resource increments its version and becomes effective immediately. It does not trigger another review, and existing subscribers resolve the latest version.
8. Edit sharing modifies the original resource. It never changes its owner or source Team.
9. Copying creates an independent draft in the current Team and is allowed only when `allowCopy=true`.
10. Permissions are enforced by the server. The client may hide unavailable actions for usability but must not be the authority.

## 3. Information Architecture

The AI Store workspace uses one persistent module navigation and one primary action.

### 3.1 Navigation

| Destination | Purpose | Visibility |
| --- | --- | --- |
| Explore | Search and browse all resources visible to the current Team | All authenticated Team members |
| Featured | Browse BoardX Featured and Team Featured resources | All authenticated Team members |
| My subscriptions | Manage USER and TEAM resources available in the current Team | All members; TEAM controls only for owner/admin |
| Created by me | Manage resources owned by the current user in the current Team | All authenticated Team members |
| Authorized editing | Edit original resources shared with the current user across Teams | Users with active edit authorizations |
| Shared with me | Review incoming share invitations and their acceptance state | Users with accepted or pending shares |
| Team review | Review publishing requests and Team Featured status | Current Team owner/admin only |
| BoardX review | Review BoardX submissions and BoardX Featured status | BoardX Admin only |

`Create resource` is the single persistent primary action. It opens the Agent, Skill, or Template creation flow and always creates in the explicitly displayed current Team.

### 3.2 Context Rules

- Explore, Featured, My subscriptions, Created by me, Shared with me, and Team review are scoped to the current Team.
- Authorized editing is scoped to the current user and may contain resources from multiple source Teams. Every row must display its source Team.
- Shared with me is the incoming-share inbox. Accepted, still-valid edit grants also appear in Authorized editing; Created by me and resource detail contain the owner's outgoing-share management.
- BoardX review is platform scoped and role gated.
- Changing Team immediately clears Team-scoped records, selections, and derived permissions before requesting the new Team data.
- Search, type, tags, sorting, pagination, and active destination are reflected in the URL when safe to retain.
- One-time share tokens are removed from the URL after successful consumption and must not remain in browser history.

## 4. Visual Direction

The selected direction is a compact Resource Library designed for repeated operational use.

### 4.1 Layout

- Reuse the existing BoardX application shell, typography, semantic color tokens, shadcn/ui components, spacing scale, and icon library.
- Use a restrained module sidebar for destinations and counts, a compact page toolbar, and a full-width resource table/list.
- Open resource details in a right-side panel so catalog position, search, and filters remain intact.
- Avoid oversized headings, decorative hero areas, nested cards, excessive pills, gradients, ornamental imagery, and marketing copy.
- Use cards only where the content is naturally repeated or framed, such as mobile resource items and modal workflows.
- Use an 8px maximum radius except where the existing component system requires a smaller radius.

### 4.2 Resource List

The desktop list is a dense table optimized for scanning. Its columns are:

- Resource name and concise description
- Type: Agent, Skill, or Template
- Source Team
- Current version
- Publication/availability status
- Subscription scope: none, personal, Team, or both
- Updated time
- Context action menu

Featured, copy-enabled, unavailable, and authorization states use icons or compact badges with tooltips. Status must not rely on color alone.

### 4.3 Toolbar

The toolbar contains:

- Search by name or description
- Segmented type control: All, Agent, Skills, Template
- Filter menu for tags, source Team, publication state, availability, and Featured state
- Sort menu
- Result count
- `Create resource` primary action

The toolbar remains compact. Filters with no active value live in menus rather than occupying permanent page width.

## 5. Core Interactions

### 5.1 Browse and Detail

- Selecting a row opens the detail panel without losing catalog context.
- The detail header shows name, type, source Team, owner, version, and availability.
- The body shows description, examples, configuration summary, statistics, update time, and publication history relevant to the viewer.
- The action area shows only actions permitted for the current user and Team: favorite, subscribe, use, copy, edit, share, submit, review, or archive.
- Missing, archived, revoked, and network-failed resources have distinct stable states.

### 5.2 Subscription and Use

- Subscription is an explicit choice between `For me` and `For team`.
- `For me` creates or cancels a USER subscription for the current user in the current Team.
- `For team` is visible to Team owner/admin and creates or cancels a TEAM subscription for the current Team.
- Ordinary members see the existing Team subscription as inherited availability but cannot alter it.
- My subscriptions separates personal and Team availability and indicates when both apply.
- The UI does not report subscription success until the server write has completed.
- Use is enabled only when a valid USER or TEAM subscription exists and the source resource remains available.
- Agent use launches the current Team AVA context, Skill use loads the correct text or image execution chain, and Template use creates or connects Board content in the current Team.

### 5.3 Create, Edit, and Preview

- The creation entry first selects Agent, Skill, or Template. Skill then selects text or image behavior.
- Each editor combines a structured form with a live preview. Preview errors do not discard form data.
- Save draft, publish submission, validation, and unsaved-change states are explicit.
- Created by me supports editing, previewing, sharing, `allowCopy`, Team submission, BoardX submission, and archive according to state and role.
- Authorized editing opens the same content editor for the original item but locks ownership, source Team, lifecycle, Featured, `allowCopy`, archive, and sharing controls.
- A version conflict returns a refresh/compare prompt rather than overwriting a newer version.
- Editing a published or approved item preserves its review state and immediately updates subscribers after the successful transaction.

### 5.4 Sharing and Authorization

- The owner can create or close an edit link, inspect accepted grantees, and revoke individual users.
- The share acceptance screen exposes only the minimum resource identity needed for an informed decision.
- Accepting a share adds the original resource to Authorized editing; it does not create a copy or Team membership.
- Authorized editing rows always display the source Team and owner.
- Closing a link or revoking a user takes effect on the next protected request. A stale editor receives a local `403` state that preserves unsaved content for manual recovery.

### 5.5 Copy

- Copy is available only for visible, available resources with `allowCopy=true`.
- Before copying, the confirmation screen displays the target Team and explains that the copy will not follow future source updates.
- A successful copy creates a new private draft owned by the current user in the current Team and opens it in Created by me.
- The copy does not inherit subscriptions, favorites, statistics, reviews, Featured state, links, or authorizations.
- Template copy must complete its Board deep copy transaction before the new resource is reported as created.

### 5.6 Review

- Team review and BoardX review reuse the same list, detail, status, and audit patterns as the rest of the Store.
- Review queues prioritize pending resources and display submitter, source Team, version, submitted time, and prior decision when applicable.
- Approve and reject require an explicit confirmation. Rejection captures a reason.
- Team Featured is available only for published source-Team resources.
- BoardX Featured is available only for approved, unarchived resources.
- Withdrawal/revocation explains its effect on new subscriptions, use, and existing subscription availability before confirmation.

## 6. Frontend Architecture

The current Store browser must be split by responsibility without changing unrelated application architecture.

| Unit | Responsibility |
| --- | --- |
| `StoreWorkspace` | Current Team context, role capabilities, active destination, URL state, and shared layout |
| `ResourceCatalog` | Search, filters, sorting, pagination, loading, empty, and list states |
| `ResourceDetailPanel` | Resource details and context-aware actions |
| `ResourceEditor` | Agent, Skill, and Template forms, validation, preview, version conflict handling |
| `SubscriptionManager` | USER/TEAM subscription state and mutations |
| `ShareAccessManager` | Link lifecycle, acceptance, grantees, and revocation |
| `ReviewQueue` | Team and BoardX review/Featured workflows |

Shared types and request helpers remain aligned with the existing repository patterns. No duplicate API layer or new state-management dependency is introduced unless implementation evidence proves the current stack cannot satisfy the behavior.

## 7. Data Flow and Server Integration

1. The workspace resolves authenticated user, current Team, membership, and BoardX role.
2. Destination-specific queries are issued with the current Team where required.
3. Each query has a request identity or cancellation signal. A stale response cannot overwrite a newer Team, filter, page, or mutation result.
4. Mutations send only editable fields. The server derives identity, current Team, ownership, and role from trusted context.
5. The server validates visibility, subscription scope, lifecycle transition, edit authorization, copy permission, and version precondition.
6. Successful mutations return the authoritative resource or relationship state.
7. The client replaces or invalidates affected records only after the response succeeds.
8. Audit creation is part of the same successful transaction as the protected mutation.

Existing API routes and domain operations are reused. Missing endpoints may be added only when required by an approved p27 feature contract; the frontend must not simulate absent backend behavior.

## 8. Error and State Model

Every data surface provides loading, empty, error, and success feedback without replacing the whole workspace.

| Condition | UI behavior |
| --- | --- |
| Loading | Stable-dimension skeletons matching the list or panel |
| Empty | Destination-specific explanation and one relevant next action |
| Network/server failure | Compact inline alert with retry; existing successful data remains when safe |
| `400` validation | Field-level messages plus form summary when needed |
| `401` | Follow the application authentication flow |
| `403` | Explain the unavailable action; do not imply the resource is missing |
| `404` | Resource-not-found state without leaking private metadata |
| `409` | Version or lifecycle conflict with refresh/compare action |
| `410` | Archived, revoked, expired, or withdrawn resource/link state |
| Success | Toast or inline confirmation tied to the completed server response |

Buttons are disabled while their mutation is in flight to prevent duplicate actions. Destructive or consequential actions require confirmation. Optimistic updates are permitted only where rollback is complete and the UI cannot mistake an in-flight state for durable success.

## 9. Responsive and Accessibility Requirements

### Desktop, 1280px and above

- Persistent module navigation, compact toolbar, resource table, and right detail panel.
- Stable table columns and panel width prevent action labels or status changes from shifting layout.

### Tablet, 768px

- Condense the table to name, type, source Team, status, and primary action.
- Secondary metadata moves into the detail panel.

### Mobile, 375px

- Replace the table with a single-column resource list.
- Use a full-screen detail drawer.
- Keep the active primary action reachable at the bottom without covering content.

All controls must support keyboard operation, visible focus, labels or accessible names, logical heading order, and screen-reader status announcements. Text and controls must meet the repository contrast rules. Status meaning must be conveyed with text or icon labels in addition to color.

## 10. Verification Strategy

### 10.1 End-to-End Journeys

Playwright tests use real APIs and verify:

1. Search, filter, pagination, URL restoration, and Team switching.
2. Agent, Skill text/image, and Template creation, validation, preview, and edit.
3. Team submission, Team review, BoardX submission, BoardX review, and both Featured dimensions.
4. Approved-resource edits retaining approval and immediately appearing to existing USER and TEAM subscribers.
5. Personal subscription by a normal member and Team subscription by a Team owner/admin.
6. Rejection of forged Team subscription, source Team, ownership, lifecycle, or role inputs.
7. Agent, Skill, and Template use only with a valid current-Team subscription.
8. Edit-link creation, acceptance, cross-Team authorized editing, link closure, and individual revocation.
9. Copy enabled/disabled behavior and independent target-Team copies, including Template Board deep copy.
10. Archive and BoardX revocation behavior for existing subscribers.
11. Favorite rollback and view/favorite consistency.
12. Loading, empty, `403`, `404`, `409`, `410`, and retry states.

### 10.2 Visual and Accessibility Checks

- Verify no horizontal overflow or incoherent overlap at 375px, 768px, and 1280px.
- Compare implemented screenshots with the approved Resource Library direction at equivalent viewport and state.
- Exercise keyboard navigation, focus order, dialogs/drawers, labels, and status announcements.
- Run the repository design lint, type check, focused unit/integration tests, and AI Store Playwright suite.

## 11. Delivery Boundaries

- This specification covers the full AI Store workspace and its real backend integration.
- It preserves p27's authoritative feature list and Harness one-feature-at-a-time rule.
- The currently claimed F06 work must be completed and verified before a later feature is claimed.
- UI redesign work must be represented by approved feature contracts and a confirmed UI signoff before Harness marks it executable.
- No implementation may mark a feature passing without its commands and evidence succeeding.
- This redesign does not add version rollback, paid Store commerce, public anonymous browsing, custom share permission levels, or archive recovery.

## 12. Acceptance Summary

The redesign is accepted when a user can enter a professional Resource Library, understand every resource's Team origin and availability, complete all permitted Store workflows through real APIs, and receive clear feedback for every stable state. The implementation must preserve Team isolation, distinguish subscription from authorization and copy, and keep approved-resource updates live for all existing subscribers without another review.
