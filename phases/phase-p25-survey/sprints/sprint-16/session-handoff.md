# 会话交接 — Sprint p25/16

## 当前已验证
- F16 已由 `pnpm harness verify --sprint p25/16 --feature F16` 标记 `passing`。
- 最终单输出与审查修订完成定向验证；Data 92 项、Web 157 项、Data/Web typecheck、
  design lint、F16 Playwright 和 harness doctor 全部通过。
- `evidence/F16.verify.log` 已通过
  `pnpm harness verify --sprint p25/16 --feature F16 --backfill-evidence` 合法刷新；
  最终桌面截图在 `evidence/survey-report-single-output-desktop.png`。

## 本轮改动
- 新增版本化事实库快照、稳定修订哈希和不可变报告产物键。
- 专业报告 GET 只读取/复用，POST 显式生成；新答卷只标记 stale。
- 报告编排器收敛为章节列表、自然语言要求、单一输出类型和右栏配置预览。
- 图表章节支持 8 个白名单 ECharts 模板、真实 canvas 预览与只读 Option JSON。
- 完整报告和版本历史迁移到“分析报告”，生成期间版本切换被禁用。
- 新增持久化 generation claim，同一事实修订、章节要求和模板版本只允许一个请求创建会话
  并调用模型；并发请求返回 `202 in_progress` 或复用 ready 产物。
- 浏览器报告、历史版本与导出统一脱敏原始文本答卷；新答卷只标记 stale，用户显式生成后
  才增加不可变版本。
- F17 交付说明改为复用同一个物理 worktree，合并 F16 后同步最新 main 并切独立分支。

## 仍损坏或未验证
- F16 无已知 blocker。PR `#716` 尚待推送本轮最终单输出修订并刷新远端状态。

## 下一步最佳动作
- 完成全分支审查并推送 `#716`；PR 只 `Closes #715`、`Refs #648`，F16 合并前不要开始 F17。
- F16 合并后复用本 worktree，同步最新 `main`，再切换到独立 F17 分支。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/16 --feature F16`
- 调试:`pnpm --filter @repo/web exec playwright test e2e/survey-p25-016-versioned-report-composer.spec.ts`
