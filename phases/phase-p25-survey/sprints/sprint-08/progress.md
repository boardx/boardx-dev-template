# 进度日志 — Sprint p25/08

## 当前已验证状态(唯一真相)
- 仓库根目录: `/private/tmp/boardx-p25-survey-fidelity`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: 无，F08 passing
- 当前 blocker: 无

## 会话记录
### 2026-07-14 09:42:35
- 本轮目标: 补同步 `boardx-survey` 源分支 stash 中未提交的首页与模板导航 UI。
- 已完成: 定位漏同步的 stash；替换旧 AI Survey Command Center；同步 BoardX Survey 左侧导航、紧凑页头、模板统计/分类/卡片和 URL 恢复；更新旧 UI 回归契约。
- 运行过的验证: `pnpm harness verify --sprint p25/08 --feature F08`，包含 web lint、typecheck、2 条 Playwright 和 `verify:base`，全部退出码 0。
- 已记录证据: `evidence/F08.verify.log`。
- 提交记录: 待本轮提交。
- 已知风险或未解决问题: stash 还包含整仓脚手架、构建产物和未在主仓落地的 ECharts/导出依赖，本 feature 按范围只同步已确认的 Survey 首页与模板导航，不覆盖主仓后端边界。
- 下一步最佳动作: code review 后 push，并创建关联 #617 的修正 PR。
