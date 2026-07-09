---
phase: "24"
status: pending          # pending | confirmed —— 人类工程师确认 UI 后，把这里改成 confirmed
confirmed_by:            # 确认人（姓名/邮箱）
confirmed_at:            # 确认时间（ISO，如 2026-07-01T10:00:00Z）
---

# UI 先行确认 — room-board-management（Phase 24）

> ADR-003 UI 签核关卡：UI 阶段须先做真实界面、由人类确认，才能定稿 feature_list 并开 sprint。

## 背景与更正（2026-07-10）

差距分析初版曾把现状误报成"纯文本行列表"（读了落后 main 17 个 commit 的 worktree 旧代码）。
**已更正**：以最新 main 为准，Room 内 board 列表**已是卡片版**——卡片网格、Grid/List 切换
（`boards-view-grid`/`boards-view-list`）、创建 Dialog（#469 已闭，复用 `ui/dialog`）、缩略图色块兜底、
收藏、复制、room 徽章、更新日期、名称搜索都已就绪。

**本阶段只补 main 真实仍缺的部分，扩展 main 的真实 boards 页（`app/(app)/rooms/[id]/boards/page.tsx`），不另起炉灶**：
① 卡片"三点更多操作"菜单（删除/重命名/编辑标签/上传·移除封面/移动）；② 多标签全套（新建打标、卡片显示 chips、编辑、按 tag 过滤）。

## 交付形态
- 真实组件写在 `apps/web`，**直接接进 main 的 boards 页**（不再做独立 mock 预览页）。
- 后端多标签需 `boards.tags text[]` schema（F02）；封面上传复用 `/api/rooms/:id/files` presigned；删除/改名/移动/改封面复用已就绪端点。

## UI 范围清单（待真实页面实现后逐项截图确认）
- [ ] **卡片 tag chips 展示**（依赖 F02）— 扩展 main 卡片渲染
- [ ] **卡片三点"更多操作"菜单** — `ui/dropdown-menu.tsx`（新增）+ boards 页 — 重命名/编辑标签/上传·移除封面/复制/移动/删除
- [ ] **新建白板加多标签** — main 创建 Dialog 表单里加 `board-list/tag-input.tsx`（新增）+ 可选封面
- [ ] **编辑标签弹窗** — `board-list/edit-tags-dialog.tsx`（新增，复用增强后的 `ui/dialog` footer/description）
- [ ] **删除确认弹窗** — 复用 `ui/dialog`，二次确认
- [ ] **按 tag 过滤列表（净新增）** — boards 页顶部 tag 过滤 chips（多选）驱动 `?tags=`

## 组件落点（apps/web 下真实路径）
- `components/ui/dialog.tsx` — **增强**（main 已有）：加可选 `description` + `footer`，向后兼容
- `components/ui/dropdown-menu.tsx` — **新增**轻量 Dropdown 基座
- `components/board-list/tag-input.tsx` — **新增**多标签输入（chip/Enter/可移除）
- `components/board-list/edit-tags-dialog.tsx` — **新增**编辑标签弹窗
- `app/(app)/rooms/[id]/boards/page.tsx` — **扩展**（main 现有卡片页）：卡片菜单 + tag chips + tag 过滤 + 新建加标签

## 关键决策记录
- **多标签（非单值 category）**：人类 2026-07-10 拍板 → 后端 F02 需 `boards.tags text[]` migration。
- data-testid 锚点规划见 `requirements/00-overview.md` 末节。

## 截图证据
> 旧 mock 原型截图已移除（那批是 from-scratch 布局，与 main 真实页面不一致）。
> 真实实现接进 boards 页后，会在真实页面重拍并补回此处，再交人类确认。
- （待补：真实 boards 页扩展后的 grid/menu/tags/filter 截图）

## 人类确认意见
<!-- 确认人填写：通过 / 需修改（列出修改点）。改完再确认。 -->
-

---
**确认动作**：核对无误后，把顶部 `status` 改为 `confirmed`，填 `confirmed_by`/`confirmed_at`。之后才可定稿 feature_list、跑 new-sprint。
