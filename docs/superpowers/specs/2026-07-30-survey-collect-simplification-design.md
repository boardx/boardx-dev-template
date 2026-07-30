# Survey Collect Simplification Design

## Status

Selected direction: option 1, confirmed by the user on 2026-07-30.

Visual target:
`phases/phase-p25-survey/ui-preview/collect-simplified-selected.png`

## Goal

Simplify the "发布回收" step so its primary purpose is immediately clear:

1. Show whether response collection is enabled.
2. Let the user configure when collection starts and ends.
3. Expose the respondent link after collection is enabled.
4. Save the configuration without leaving the current workflow step.

The workspace below the five-step navigation remains full width. The page should
feel consistent with the existing survey workflow while using a restrained warm
purple accent for selection and focus states.

## Page Structure

### 1. Status Header

A single full-width status band contains:

- Title: `发布回收`
- Supporting text: `设置问卷的开放状态和有效时间。`
- Current status badge: `回收中` or `已暂停`
- A standard switch labeled `启用回收`

The switch is the only primary control for starting or pausing collection. While
the status request is pending, the switch is disabled and the status text shows
that the change is being processed.

### 2. Collection Settings

One white settings surface contains the following sections.

#### Effective Time

- `开始时间`
- `结束时间`
- `立即开始` shortcut
- `长期有效` shortcut

Desktop displays start and end time in two equal columns. Narrow screens stack
the fields vertically.

`立即开始` clears the scheduled start value and means the configuration becomes
effective as soon as collection is enabled.

`长期有效` clears the end value and means collection remains open until manually
paused.

When a shortcut is active, its corresponding date-time field is disabled. A
manually entered date-time value turns off that shortcut.

Validation rules:

- End time must be later than start time when both values exist.
- Invalid time configuration prevents save and shows an inline message near the
  time fields.

#### Respondent Link

When collection is active, show the current respondent link and a copy icon
button. Copying provides a short success confirmation.

When collection is paused, show:
`启用回收后将生成可访问的问卷链接`

The paused link row is disabled and cannot be copied.

#### Advanced Settings

Advanced settings are collapsed by default. Expanding them preserves access to
the existing secondary configuration:

- Respondent identity mode
- One response per user
- Response limit
- Submission confirmation message

These controls are intentionally removed from the primary view but keep their
current data behavior and API contract.

### 3. Footer Actions

The settings surface ends with:

- Secondary action: `重置`
- Primary action: `保存设置`

`重置` restores values from the latest saved survey state. `保存设置` uses the
existing save request and is disabled while saving or when time validation
fails. A successful save uses the current page feedback pattern.

## Removed From The Primary View

The redesigned collect step does not show:

- Survey summary cards
- Report plan summary
- AI publishing assistant
- Response monitor
- Preflight checklist
- Duplicate previous-step and next-step buttons
- Share channel cards or QR blocks

Workflow navigation remains available through the persistent five-step header.

## Interaction And State

- Status changes use the existing status toggle handler and backend request.
- Time and advanced values remain local form state until `保存设置` is pressed.
- The status switch does not implicitly save unrelated form edits.
- Existing error responses remain visible near the affected control or in the
  page-level feedback region.
- The switch uses native switch semantics with an accessible label.
- Icon-only actions have tooltips and accessible names.
- Focus, active, and selected states use the existing purple accent; destructive
  or error states remain red.

## Responsive Behavior

- The lower workspace fills the available application width.
- The main settings surface has a readable internal content width without
  turning the whole workspace into a narrow centered column.
- At tablet and mobile widths, status controls wrap below the title and time
  fields become a single column.
- No horizontal scrolling is introduced.

## Verification

The implementation should prove:

1. The collect step renders only the simplified primary surface by default.
2. The status switch invokes the existing enable/pause behavior and exposes a
   pending state.
3. Start and end times can be edited and saved.
4. `立即开始` and `长期有效` clear and disable their associated fields.
5. Invalid time order blocks saving and shows an inline error.
6. The respondent link is copyable only while collection is active.
7. Advanced settings are collapsed initially and retain existing values after
   expansion and save.
8. The layout fills the workflow workspace and remains usable at desktop and
   mobile widths.

