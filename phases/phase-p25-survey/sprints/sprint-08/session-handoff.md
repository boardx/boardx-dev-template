# 会话交接 — Sprint p25/08

## 当前已验证
- F08 已由 Harness 升级为 passing；design lint、TypeScript、源 UI E2E 和全仓基础验证通过。

## 本轮改动
- `/surveys` 默认页改为 stash 中的 BoardX Survey 工作台信息架构。
- `/surveys?view=templates` 可刷新恢复 Template Manager，展示模板统计、分类和管理操作。
- 新增 F08 E2E，并把 F02 旧 Command Center 断言更新为当前源 UI 契约。

## 仍损坏或未验证
- 未迁入 stash 中的整仓新增文件、`.next` 构建产物和主仓缺少依赖的报告编辑器实验代码；这些不属于本次首页/导航纠偏。
- 真实千问外网调用仍依赖部署密钥，本次未改变 provider。

## 下一步最佳动作
- 审查、push、PR；不要再以源分支 HEAD 代替“分支 + 未提交状态”的完整源事实。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/08`
- 调试:`pnpm --filter @repo/web exec playwright test e2e/survey-p25-008-source-stash-ui.spec.ts`
