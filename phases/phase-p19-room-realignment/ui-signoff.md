---
phase: "p19"
status: pending          # pending | confirmed —— 人类工程师确认 UI 后，把这里改成 confirmed
confirmed_by:            # 确认人（姓名/邮箱）
confirmed_at:            # 确认时间（ISO，如 2026-07-01T10:00:00Z）
---

# UI 先行确认 — Room Realignment（Phase p19）

> 这是本阶段的 **UI 签核关卡**（ADR-003）。本文件顶部 `status` 不是 `confirmed` 时，
> `pnpm harness new-sprint` 直接拒绝开 sprint。

## 交付形态（本阶段的特殊情况，沿用 p17 模式）
- 本阶段**不是从零设计**：权威设计参照物已存在——`phases/requirements/BoardX UI Prototype V1.html`
  里 Room 的每一屏都有原型（ROOM DETAIL、ROOM WORKSPACE 三栏、New Room dialog、Room Settings
  dialog / Danger Zone）。
- 因此这里的确认动作是：**核对下面每一屏的原型设计 + 本阶段做出的取舍仍然是你想要的**。
  如果某一屏想改，在「人类确认意见」里写清楚，不要直接 confirmed。
- `feature_list.json` 已按这些取舍先行草拟（draft）；你确认后它才算定稿，若你在下面提出修改，
  requirement-author 需按意见修订 feature_list 再进入开发。

## 需要你核对的取舍（关键决策点）

1. **Tab 结构 = 五 tab**：`Boards / Members / Files / Chat / Survey`。
   原型是六 tab（多一个 Studio）；本阶段决定 Studio **不做顶级 tab**，维持 p12 已实现的
   「聊天工作区右栏 Studio 面板」——这与旧前端最终落地（oldcode RoomTabsContainer 三 tab +
   Chat 内三栏）一致。☐ 同意 / ☐ 要六 tab
2. **Files 是房间级 tab**（uc-rr-003）：房间统一文件库，聊天左栏展示同一批文件，
   `chat_thread_id` 只是来源标注。这推翻了 uc-room-005 的「文件绑定当前聊天线程」。☐ 同意
3. **可见性词汇 = `private | team`**（不用原型的 public 字样，语义同「团队内可发现加入」）。☐ 同意
4. **Survey tab 只列本房间问卷**（uc-rr-007），团队问卷入口只是跳转链接；surveys 表加可空
   room_id。☐ 同意
5. **删除房间为永久删除**（uc-rr-005，无回收站），确认弹窗列出级联范围并要求输入房间名。☐ 同意
6. **权限矩阵**（uc-rr-006 表格）：admin 拥有除「管理 admin / 删房间 / 动 owner」外的全部管理权。☐ 同意

## UI 范围清单（对照原型逐屏核对）
- [ ] Room Detail 壳：面包屑 + 房间名 + 可见性 pill + 成员头像堆叠 + Invite 按钮 + 五 tab —
      原型 `<!-- ROOM DETAIL -->` 屏（roomTabDefs）
- [ ] New Room dialog：名称 + Private/Team 可见性二选一卡片 — 原型 New Room dialog
- [ ] Room Settings dialog：INVITE NEW MEMBERS（含未注册邮箱 pending 列表）+ CURRENT MEMBERS
      角色徽章 + DANGER ZONE — 原型 Room Settings dialog
- [ ] Files tab：上传区 + 搜索 + 文件列表（房间级）— 原型 ROOM DETAIL Files tab
- [ ] 聊天三栏工作区左栏：Room Files sources 勾选（替换现占位文案）— 原型 ROOM WORKSPACE 三栏
- [ ] Survey tab：本房间问卷卡片 + 新建入口 — 原型 SURVEYS 屏的 Room scope
- [ ] 房间设置 About & AI 区块：description + AI instruction — 原型无对应屏（新增，样式沿用
      settings 表单 token）
- [ ] 房间列表卡片：星标收藏 + Favorites 筛选 — 原型 Rooms 列表屏

## 组件落点（apps/web 下真实路径，开发时锚定 data-testid）
- 壳与 tab：`apps/web/app/(app)/rooms/[id]/layout.tsx`（新增）+ 现有 boards/members/chats 子页
- Files tab：`apps/web/app/(app)/rooms/[id]/files/page.tsx`（新增）
- Survey tab：`apps/web/app/(app)/rooms/[id]/surveys/page.tsx`（新增）
- 聊天左栏：`apps/web/app/(app)/rooms/[id]/chats/[chatId]/page.tsx`（改造占位区）
- New Room / 设置弹窗：`apps/web/app/(app)/rooms/page.tsx` 及成员管理组件

## 截图证据
<!-- 若需要新 mock 截图再补充到 ui-preview/；原型屏可直接打开 Prototype V1.html 核对 -->
- 原型文件：`phases/requirements/BoardX UI Prototype V1.html`（浏览器打开 → Rooms → 任一房间）

## 人类确认意见
-

---
**确认动作**：核对无误后，把顶部 frontmatter 的 `status` 改为 `confirmed`，填 `confirmed_by` /
`confirmed_at`，提交。之后 feature_list 定稿、`pnpm harness new-sprint` 才会放行。
