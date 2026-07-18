# 会话交接 — Sprint p27/09

## 当前已验证
- F16 `Browser acceptance consistency and executable Templates` 已由 Harness 门控为 passing。
- 权威验证: `pnpm harness verify --sprint p27/09 --feature F16`
- 证据: `phases/phase-p27-aiStore/sprints/sprint-09/evidence/F16.verify.log`
- 基础验证 `pnpm -w run verify:base` 已通过。

## 本轮改动
- 需求新增真人浏览器验收差异，并将外发分享统一命名为 `Shared by me`。
- StoreBrowser 统一 PostgreSQL bigint ID、恢复 URL 查询后再加载、清除跨视图动作错误，并保持授权编辑来源 Team 上下文。
- Template 表单新增真实源 Board 选择，创建/更新 API 校验 Team 与所有者，Use 深复制源 Board。
- 详情 API 返回来源 Team 名；本地 seed 和受影响旧 E2E 均改用有效 Template Board。

## 仍损坏或未验证
- 无已知功能阻断。
- Chrome 验收使用 seed run `20260717130632`；账号密码记录在本轮 PR/Issue 更新中，不写入生产配置。

## 下一步最佳动作
- 先运行 `pnpm harness doctor --phase p27`，再 review PR #676。
- 不要回退 F01-F16 passing 状态，不要把 Template 改回无源 Board 的占位行为。

## 命令
- 启动: `pnpm --filter @repo/web exec next dev -p 3050`
- 验证: `pnpm harness verify --sprint p27/09 --feature F16`
- 调试: `pnpm --filter @repo/web exec playwright test e2e/ai-store-018-browser-acceptance-regressions.spec.ts --workers=1`
