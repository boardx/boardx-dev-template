# 会话交接 — Sprint p25/16

## 当前已验证
- F16 已由 `pnpm harness verify --sprint p25/16 --feature F16` 标记 `passing`。
- 六条 feature verification 与 58 项 `verify:base` 全部通过，证据在
  `evidence/F16.verify.log`。

## 本轮改动
- 新增版本化事实库快照、稳定修订哈希和不可变报告产物键。
- 专业报告 GET 只读取/复用，POST 显式生成；新答卷只标记 stale。
- 报告编排器收敛为章节列表、自然语言要求和真实报告/版本历史同屏。
- F17 交付说明改为复用同一个物理 worktree，合并 F16 后同步最新 main 并切独立分支。

## 仍损坏或未验证
- 尚未同步 F16 feature issue、推送分支或创建 Delivery PR。

## 下一步最佳动作
- 完成 F16 feature issue、Delivery PR 和 review；F16 合并前不要开始 F17。
- F16 合并后复用本 worktree，同步最新 `main`，再切换到独立 F17 分支。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/16 --feature F16`
- 调试:`pnpm --filter @repo/web exec playwright test e2e/survey-p25-016-versioned-report-composer.spec.ts`
