# 会话交接 — Sprint p17/01

## 当前已验证
- <哪些 feature 确认 passing,各自跑过的验证命令>

## 本轮改动（wrk-store-2 / F03）
- `apps/web/app/(app)/ai-store/store-browser.tsx`：视觉/文案层 reskin。把未被 e2e 断言锁定的
  中文提示英文化（load 失败提示、重试按钮、喜欢/取消喜欢 aria-label、分享操作失败提示、未发布
  订阅提示），标签筛选/卡片标签显示文案首字母大写（新增 `tagLabel()` helper，`data-testid`
  未变）。刻意保留了所有被 phase-p11 e2e 硬断言的中文字符串（`草稿已保存`/`已发布`/
  `已提交审核`/`已移除授权`/分享相关提示等），未改动任何功能逻辑或组件结构。

## 仍损坏或未验证
- `pnpm --filter @repo/web exec playwright test e2e/ai-store-*.spec.ts` 30 条里有 3 条失败：
  `ai-store-003-subscribe-use-item.spec.ts:13`、`ai-store-005-share-management.spec.ts:116`、
  `ai-store-005-share-management.spec.ts:174`。已用 `git stash` 对照证明这是 P11 遗留的
  `useEffect` + `history.replaceState` URL 清理时序竞争，与本次改动无关、在未改动的 baseline
  上同样 100% 复现（非随机 flake）。详见 `evidence/F03-analysis.md`。
- F03 因此**未能让第 3 条 verification 完全通过**，尚未 verify 为 passing。

## 下一步最佳动作
- 协调方决定：(a) 是否派独立 worker 先修 `store-browser.tsx` 里的 URL 清理时序 race（已
  spawn_task 提出建议），(b) race 修完后重新对 F03 跑 4 条 verification 转绿，(c) 再
  `pnpm harness verify --sprint p17/01 --feature F03` 翻 passing。
- 不要在 race 未修之前把 F03 标为 passing；也不要为了让测试通过而改动
  `store-browser.tsx` 之外、超出 F03 视觉 reskin 范围的功能代码。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p17/01`
- 调试:`pnpm --filter @repo/web exec playwright test e2e/ai-store-*.spec.ts`（本 worktree
  E2E_PORT 见 `apps/web/.env.local`）
