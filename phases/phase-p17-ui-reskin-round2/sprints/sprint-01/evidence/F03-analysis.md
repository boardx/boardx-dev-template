# F03 — AI Store reskin：verification 现状与根因分析

## 结论摘要
- `docker compose up -d`：通过（exit 0）。
- `pnpm --filter @repo/data run migrate`：通过（exit 0）。
- `pnpm --filter @repo/web exec playwright test e2e/ai-store-*.spec.ts`：**30 条里 27 条通过，3 条失败**。
- `bash scripts/lint-design.sh`：通过（exit 0，仅有跨模块文案语言一致性的警告级输出，不拦截）。

## 3 条失败用例
1. `ai-store-003-subscribe-use-item.spec.ts:13` — 订阅个人发布项目、出现在已订阅列表、使用带入 AVA、取消订阅
2. `ai-store-005-share-management.spec.ts:116` — 被授权协作者打开链接后出现在 Authorized 视图，拥有者可移除授权
3. `ai-store-005-share-management.spec.ts:174` — 无效或已关闭的分享链接显示无法访问提示

## 根因判定：与本次 F03 改动无关（已用对照实验验证）
用 `git stash` 把本次 F03 的改动（`store-browser.tsx` 的文案英文化 + tag 大小写显示）临时撤回，
在**完全未改动的 p11 baseline 代码**上重跑同样的 3 条用例 + 全量 30 条用例：**结果完全一致**——
同样是这 3 条失败、其余 27 条通过。已用 `git stash pop` 恢复本次改动。

结论：这 3 条失败是 phase-p11 遗留的既有问题，不是 F03 这次改动引入的回归。

## 具体触发机制（以 ai-store-005:174 为例，日志可复现）
- 服务端日志显示重定向已经正确发生：`GET /ai-store?nav=authorized&shareError=invalid 200`。
- 但 `store-browser.tsx` 里读取 URL 参数的 `useEffect`（约 307-320 行，P11 遗留代码，本次未改动
  其逻辑）在挂载时立刻调用 `window.history.replaceState(null, "", window.location.pathname)`
  把 query string 清掉。
- 在这台机器上 React effect 执行速度快于 Playwright `expect(page).toHaveURL(...)` 首次采样，
  导致断言经常采样到「已被清空 query 的 URL」而判定超时失败。
- 用 `--retries=2` 重跑同一条用例，结果仍然是确定性失败（不是随机 flake），说明这是这台机器
  相对时序下的确定性时序竞争，而不是环境抖动导致的偶发失败。

## 是否属于「范围纪律」允许修的问题
这个 race 位于 P11 遗留的 `useEffect` 清 URL 逻辑里，不在 F03（视觉/文案 reskin）的范围内，
且改动这段逻辑属于行为/时序修复，不是纯视觉层改动，跟任务里「只做视觉/文案层面 reskin，
不改功能逻辑」的边界冲突。因此本轮没有动它。

## 决策请示
按 worker 工作说明「不确定就停下来问」的原则，在这里明确列出选项，等协调方/人类决定：
1. 保持现状，把这 3 条失败如实报告在 PR 里，请求协调方评估是否需要另开一个 fix-race 的
   feature（不在 F03 范围）来修 useEffect 时序问题，F03 本身先不 verify-pass。
2. 如果协调方认为这是环境噪声、可以豁免，则需要人类决定是否对 F03 使用 `--no-verify` 或
   调整 verification 范围（例如把这 3 条已知有时序问题的用例单独排除，仅在这轮先不计入
   F03 的门槛）。
3. 由另一个 feature/PR 专门修复这个 P11 遗留的 useEffect 时序 bug，修完后 F03 重新跑
   verification 应能全绿。

本 worker 未擅自修改范围外的功能逻辑，也没有自行豁免失败用例，如实记录到此。
