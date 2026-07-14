# Survey 非规范集成回退与重新交付

## 背景

合并提交 `9cc1c25` 的第一 parent 带入 `c43a8fb`、`47a3dc6`、`cb09e92`，这些
Survey 改动未经过 phase feature、sprint、验证证据和 Harness 状态门禁，并引入了
设计 lint 失败、迁移编号冲突、绕过共享 AI 层等问题。

## 本轮范围

1. 从第二 parent `61e5ec1` 重建 `main` 后续历史，使 `9cc1c25` 及其第一 parent
   Survey 提交不再是 `main` 的祖先，同时保留 Room、Harness、DevPortal 等主线改动。
2. 远端更新必须使用 `--force-with-lease`，只在远端仍指向已审计的 `9cc1c25` 时改写。
3. 恢复 phase p13 已验证的 F01-F07 Survey 能力及其 API、数据层和端到端测试。
4. 证明 Survey 设计 lint 与既有 F01-F07 回归验证仍通过。
5. 后续新增的完整 Survey 工作台、模板、报告编排和 AI 能力必须拆成独立 feature，
   逐个走需求、实现、验证、证据和 review；不得把回退掉的大提交整体重新落回。

## 明确不做

- 本 feature 不重新实现 `9cc1c25` 第一 parent 中未经确认的 Survey 扩展功能。
- 不调用外部 `boardx-backend`，也不保留绕过 `packages/ai` 的应用内模型客户端。
- 不修改已经 passing 的 F01-F07 状态与证据。
