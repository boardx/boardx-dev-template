# Survey 未提交源状态保真修正

## 原始反馈

当前 `/surveys` 仍展示旧版 `AI Survey` Command Center，没有同步
`boardx-survey` 的 `codex-survey-home-nav-redesign` 工作状态。

## 事实来源

- 仓库：`/Users/shenyangjun/boardx/boardx-survey`
- 分支：`codex-survey-home-nav-redesign`
- 未提交状态：`stash@{0}`（`WIP on codex-survey-home-nav-redesign`）
- 权威页面：stash 中的 `apps/web/app/(app)/surveys/page.tsx`

## 可见需求

1. `/surveys` 使用 `BoardX Survey` 工作台壳层，而不是旧版 `AI Survey` Command Center。
2. 左侧导航提供 `Home Page`、`我的问卷`、`问卷模版`。
3. `/surveys?view=templates` 直接恢复问卷模版管理视图。
4. 模版管理视图展示总数、自定义数、分类、标签、题目数、预计时长和编辑/删除操作。
5. 保留主仓已验证的 Survey 生命周期、Room/Team 权限、公开答题和千问接口，不从 stash 覆盖这些边界。

## 验收

- Playwright 验证默认工作台和模板 URL 恢复。
- Web lint、typecheck 和 Harness base verification 通过。
- 桌面截图与 stash 中的工作台信息架构一致。
