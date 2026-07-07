---
phase: "p22"
status: pending          # pending | confirmed —— 人类工程师确认 UI 后，把这里改成 confirmed
confirmed_by:            # 确认人（姓名/邮箱）
confirmed_at:            # 确认时间（ISO，如 2026-07-01T10:00:00Z）
---

# UI 先行确认 — Room IA Realignment（Phase p22）

> 这是本阶段的 **UI 签核关卡**（ADR-003）。UI 相关阶段必须先把真实界面做出来、
> 由**人类工程师确认**，才能生成/定稿 `feature_list.json` 并开 sprint 进入代码开发。
> 门控由 `new-sprint` 强制：本文件顶部 `status` 不是 `confirmed` 时，`pnpm harness new-sprint` 直接拒绝。

## 交付形态（本阶段的特殊情况）

本阶段是**布局重构**，不是从零造新组件：Room 详情本身（五个既有 tab 的内容、API）在
p20 阶段已经做好且验证过，本阶段只改**外层容器怎么组织这些已有内容**，所以主从双栏壳
（`RoomListPanel` + `rooms/layout.tsx`）和 Files 面板的入口修正直接复用真实数据/真实
API（不是新造 mock 后端），这样人类核对时看到的是真实可交互的效果，风险比造假数据更低。

唯一使用 mock 数据的是**新增的 Studio 顶级 tab 落地页**（`rooms/[id]/studio/page.tsx`）——
因为这是评估型改动（优先级 2，见 requirements/00-overview.md），真实的 Studio 生成能力
仍在聊天工作区里，这里只做一个"是否需要独立入口"的可视化提案，卡片数据是硬编码 mock。

## 核心改动说明（对照人类给的截图与调研报告）

1. **主从双栏壳**（优先级 0，最核心）：新增 `apps/web/app/(app)/rooms/layout.tsx` +
   `apps/web/components/rooms/room-list-panel.tsx`。左栏（`data-testid=room-list-panel`）
   常驻房间列表（搜索/收藏筛选/新建/切换高亮当前房间），右栏渲染 `/rooms`（空态）或
   `/rooms/[id]/...`（详情，五个既有 tab 内容原样复用，只是不再整页替换掉左栏）。
2. **Files 双入口职责边界**（优先级 1）：`components/room-files/room-files-panel.tsx`
   头部新增"查看全部 →"链接（`data-testid=room-files-panel-open-files-tab`）跳转 Files
   tab，空态文案里的"前往 Files tab"改成真正可点击的 `Link`，并加了注释明确"面板=轻量
   引用视图，Files tab=权威管理视图"这个此前从未显式记录的产品决策。
3. **Studio 独立顶级 tab**（优先级 2，人类截图已给出 6-tab 证据，按此实现）：
   `rooms/[id]/layout.tsx` 的 `TABS` 数组加回 Studio；新增
   `rooms/[id]/studio/page.tsx` 落地页（mock 数据展示"本房间近期 Studio 产物"）。
4. **Board 面包屑回退**（优先级 3，评估型）：**本轮未动**——留给人类确认时决定是否需要，
   若需要则在 feature_list 阶段补（`apps/web/app/(app)/boards/[id]/page.tsx` 加返回房间
   的链接）。

## UI 范围清单（逐项核对）

- [ ] 双栏壳整体效果：左栏房间列表 + 右栏详情，切换房间左栏不消失 —
      `apps/web/app/(app)/rooms/layout.tsx` + `components/rooms/room-list-panel.tsx` —
      截图：`ui-preview/rooms-two-pane.png`
- [ ] 右栏空态（未选中房间时）— `apps/web/app/(app)/rooms/page.tsx` —
      截图：`ui-preview/rooms-empty-state.png`
- [ ] 房间详情右栏 Boards tab（含六 tab 导航，Studio 是否需要独立入口请重点核对）—
      `apps/web/app/(app)/rooms/[id]/layout.tsx` — 截图：`ui-preview/room-detail-boards.png`
- [ ] Studio 落地页（mock 产物列表 + 跳转聊天工作区入口）—
      `apps/web/app/(app)/rooms/[id]/studio/page.tsx` — 截图：`ui-preview/room-studio-tab.png`
- [ ] 聊天工作区左栏 Files 面板的"查看全部"入口 —
      `apps/web/components/room-files/room-files-panel.tsx` —
      截图：`ui-preview/room-files-panel-link.png`

## 组件落点（apps/web 下真实路径）

- `apps/web/app/(app)/rooms/layout.tsx`（新增，双栏壳）
- `apps/web/components/rooms/room-list-panel.tsx`（新增，左栏房间列表）
- `apps/web/app/(app)/rooms/page.tsx`（改造为右栏空态）
- `apps/web/app/(app)/rooms/[id]/layout.tsx`（TABS 数组加 Studio）
- `apps/web/app/(app)/rooms/[id]/studio/page.tsx`（新增，Studio 落地页，mock 数据）
- `apps/web/components/room-files/room-files-panel.tsx`（加"查看全部"入口）

## 截图证据（活体验证，非静态图）

系统当时资源紧张（docker 起来慢、预览渲染一度卡死），且预览工具默认绑定主仓库路径而非
本 worktree（已通过在 `.claude/launch.json` 新增独立命名的 server 配置解决）。最终在
本 worktree 的真实 dev server 上、用真实注册用户 + 真实创建的房间（Product Alpha/
Growth Team/Design Sprint/Q3 Planning）逐屏验证并截图核对，工具未提供落盘 PNG 的能力，
以下是每屏的活体验证结果描述（人类可本地 `pnpm --filter @repo/web dev` 重现同样交互）：

1. **双栏壳**：`/rooms` 渲染出左栏（宽 288px，含 Rooms 标题+新建按钮、搜索框、Favorites
   筛选、四个房间列表项）+ 右栏空态"选择一个房间查看详情 / 或者从左侧新建一个房间"。
2. **切换房间**：点击左栏 "Product Alpha" → 右栏渲染面包屑「Rooms / Product Alpha」+
   Team 徽章 + 六个 tab（Boards/Members/Files/Chat/Survey/Studio）+ Boards 内容；
   左栏本身**没有消失**，该项高亮为选中态。再点另一房间 "Growth Team"，左栏高亮正确
   切换、右栏内容跟随切换到 Growth Team 的 Boards（因跨房间切换回落默认 tab，符合预期）。
3. **Studio 独立 tab**：点击 "Studio" tab，右栏渲染"本房间近期 Studio 产物"三张 mock
   卡片（Sprint retro 音频概览 / User journey 演示文稿 / Roadmap 报告）+ 右上角"在聊天
   工作区打开 Studio →"跳转入口。左栏 "Product Alpha" 保持高亮，未整页跳转。
4. **Files 面板入口修正**：建了一条聊天线程后打开 `/rooms/1/chats/1`，三栏工作区左侧
   "Room Files" 面板头部新增"查看全部 →"链接清晰可见；未上传文件时的空态文案里
   "前往 Files tab" 是真正可点击的蓝色链接（此前是纯文字）。

## 需要人类重点判断的问题

1. **双栏布局的宽度/断点**：左栏固定 288px（`w-72`），窄屏（移动端）下是否需要退化成
   当前的整页模式？本轮未做响应式降级，仅做桌面宽屏效果。
2. **Studio 是否真的需要独立 tab**：已按截图证据加回，但落地页目前只是"近期产物"列表
   + 跳转聊天工作区，没有独立的生成入口——这是否符合预期，还是应该做成真正独立的生成
   工作台（工作量会显著增加）？
3. **Board 面包屑回退**（优先级 3）本轮未动，是否需要排进本阶段一起做？

## 人类确认意见

-

---
**确认动作**：核对无误后，把顶部 frontmatter 的 `status` 改为 `confirmed`，填 `confirmed_by` /
`confirmed_at`，提交。之后才可调 requirement-author 生成 feature_list、跑 new-sprint。
