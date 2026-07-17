# 进度日志 - Phase p27 AI Store

## 当前状态

- Parent Issue: [#662](https://github.com/boardx/boardx-dev-template/issues/662)
- 当前最高优先级: Phase 完成，等待同步与人工验收
- 计划规模: 14 Features / 7 Sprints / F01-F14 全部 `passing`
- Runtime 实现: Team-scoped Agent/Skills/Template、审核发布、订阅使用、统计、分享编辑、独立复制和 Resource Library UIUX 均已完成。
- UI 签核: Resource Library Option 1 已由用户确认，见 `ui-signoff.md`。
- 基线门禁: F14 verification、`pnpm -w run verify:base` 与 `pnpm harness doctor --phase p27` 已通过。

## 已完成

- 对照 `boardx-web`、`boardx-backend` 和模板仓库整理完整 AI Store 功能基线。
- 固定 Agent/Skill/Template Team 归属、BoardX 全员可见、USER/TEAM 订阅、实时版本、编辑分享和独立复制契约。
- 将 AI Tool 与 AI Image Tool 合并为 Skills，保留 `skillKind=text|image`。
- Harness 支持 `tracking_issue: 662`，Feature Issue body 自动回链 Parent Issue。
- 14 个 Feature 已按依赖分入 7 个 Sprint，派生视图一致。
- F01 已建立 `origin_team_id` / `consumer_team_id`、跨 Team 数据约束和无猜测迁移隔离。
- F02 已统一 `type=skill`、`skillKind=text|image`，增加 version、并发 409 和 RevisionAudit。
- F03 已完成 Team-aware Explore、Skills 分类、分页、搜索、详情来源/版本和稳定错误重试。
- F04 已完成三类资源预览、text/image Skill、跨 Team 授权实时编辑、来源 Team 防伪和 owner-only 软归档。
- F05 已完成 Team owner/admin 审核、撤回、精选、权限隔离、非法状态 409 和免复审内容更新。
- F06 已完成 BoardX 审核/精选、approved 实时更新、既有订阅最新版本读取与撤回可用性限制。
- F07 已完成个人/团队订阅、管理员权限、团队继承、Team 隔离、独立取消及 Agent/Skill/Template 使用。
- F08 已完成 Team-scoped 收藏、服务端原子喜欢数、授权详情浏览统计、失败回滚和并发不漂移。
- F09 已完成 Team-scoped 编辑授权、来源 Team 展示、Authorized/Shared、不可变所有权和即时撤销。
- F10 已完成 allowCopy 开关、Team 归属的独立 draft、副本来源记录和 Template Board 深拷贝。
- F11 已完成 Agent/Skills/Template 在真实运行入口中的集成。
- F12 已完成旧 AI Tool/Image Tool 数据兼容和完整回归。
- F13 已完成 Option 1 Resource Library 响应式目录、筛选、详情和角色导航。
- F14 已完成统一编辑器、即时生效更新、分享、复制确认和 Team/BoardX 审核工作区。

## 验证边界

- F01/F02 evidence 位于 `sprints/sprint-01/evidence/`，F03/F04 evidence 位于 Sprint 02。
- F06 evidence 位于 `sprints/sprint-03/evidence/F06.verify.log`；F07/F08 evidence 位于 Sprint 04。
- F09/F10 evidence 位于 Sprint 05；F11/F12 位于 Sprint 06；F13/F14 位于 Sprint 07。
- `pnpm harness doctor --phase p27` 返回 `0 FAIL / 0 WARN`。

## 下一步

1. 运行 `pnpm harness sync --phase p27 --apply` 将完成状态投影到 Parent Issue #662。
2. 启动 Web，人工验收 `/ai-store` 的 Explore、订阅、创建、授权、分享和审核路径。
3. 由 coordinator 根据全部 Feature passing 状态决定是否关闭 Parent Issue #662。
