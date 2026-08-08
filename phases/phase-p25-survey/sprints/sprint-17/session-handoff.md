# 会话交接 — Sprint p25/17

## 当前已验证
- F17 已通过全部 feature verification、`harness doctor` 和 `./init.sh`，并由 harness 迁移为 `passing`。
- 证据位于 `sprints/sprint-17/evidence/F17.verify.log`。

## 本轮改动
- `packages/ai` 新增只读整卷事实文件系统和 LangGraph 章节分析图。
- Web 报告 API 将完整问卷和全部答卷映射为统一快照，由章节按需检索并校验证据引用。
- 增加相同输入缓存、模型预算控制、失败降级和 F17 端到端测试。

## 仍损坏或未验证
- 没有已知 F17 回归。
- F13 UI 尚未实现：中间输出类型单选、各类型自然语言约束、图表 option JSON、右侧仅预览当前章节。

## 下一步最佳动作
- 提交、推送并创建关联 #648 的 F17 独立 PR。
- F17 合并后从最新 `main` 开始 F13，避免把 UI 改动堆入本 PR。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/17 --feature F17`
- 调试:`pnpm --filter @repo/web exec playwright test e2e/survey-p25-017-langgraph-report-analysis.spec.ts`
