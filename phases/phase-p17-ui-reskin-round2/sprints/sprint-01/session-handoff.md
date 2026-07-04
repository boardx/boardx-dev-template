# 会话交接 — Sprint p17/01

## 当前已验证
- F01（owner wrk-claude-1）：代码已实现，3 条 verification 命令自测全绿（见
  `evidence/F01-verification.txt`），typecheck/lint-design/verify:base 均通过。**尚未** 经
  `pnpm harness verify` 门控，仍是 `in_progress`（禁止手改 status）。PR #241 已开，Closes #235。
- F01 经 feature-evaluator 复审一轮：Revise → 已按意见修正（见下方"F01 复审修正"），
  已重新自测，evidence 字段已回填指向 evidence/ 下三份文件。仍待下一轮 evaluator/门控确认。
- F03（owner wrk-store-2，AI Store reskin，PR #242 已合并到 main）：2026-07-05 由
  coord/363-p17-f03-gate 跑过 `pnpm harness verify --sprint p17/01 --feature F03`，
  **门控未通过**，仍是 `in_progress`。过程中顺带修复了 `feature_list.json` 里 F03
  verification 第 3 条的一个既有 glob/cwd bug（与 F02 notes 记录的是同一个 harness 执行
  环境问题：`pnpm --filter @repo/web exec playwright test e2e/ai-store-*.spec.ts` 从 repo 根
  跑时 glob 展开落空 → "No tests found"；已改成 `cd apps/web && pnpm exec playwright test
  e2e/ai-store-*.spec.ts`，与 F02 一致）。修完 glob 后门控**依然不通过**，真实原因：
  `e2e/ai-store-*.spec.ts` 30 条里恒定 3 条失败（`ai-store-003:13`、`ai-store-005:116`、
  `ai-store-005:174`），根因是 `apps/web/app/(app)/ai-store/store-browser.tsx` 里 P11 遗留的
  `useEffect` 读 URL query 后立刻 `history.replaceState` 清空、与 Playwright 断言 URL 的
  时序竞争——**不是 F03 本次纯文案/样式改动引入**（已在合并 #384 docker 子网修复后的全新
  干净环境里独立复现，与之前 worker 的 stash 对照实验结论一致）。已 spawn 独立任务
  `task_20951276` 跟踪修复该竞态，修复合并后需重新对 F03 跑一次门控。详见
  `evidence/F03-analysis.md`。
- F02-F06：见各自 owner 的记录（本文件是共享 sprint 交接，非 F01 独占）。

## F01 复审修正（本轮，针对 feature-evaluator 的 Revise 意见）
1. **evidence 字段回填**：`feature_list.json` 的 F01.evidence 之前是空字符串，违反完成定义第 3 条。
   已回填为 `F01-verification.txt; F01-migrate.txt; F01-real-ai-verification.txt` 三份文件的相对路径。
2. **AI 回复改为真实生成，不再是写死模板**（核心问题）：
   - 新增 `apps/web/app/api/boards/[id]/ai-chat/route.ts`：鉴权（owner/editor/viewer 均可提问，
     无权限 403）→ 读取画布 `listBoardItems` 真实文字内容 → 组装 prompt 上下文 → 调用
     `@repo/ai` 的 `defaultGateway.streamChat`（与 AVA 完全相同的 CAP-AI 网关机制）→ 返回 reply。
   - 改 `packages/ai/src/gateway.ts`：`buildStubReply` 新增识别 `[画布内容: ...]` 标记
     （与既有 `[附件: ...]`/`[知识库引用: ...]` 标记同一套模式），真实在回复中引用画布上的
     具体文字，而非只报组件数量。新增单测覆盖（`packages/ai/src/index.test.ts`）。
   - 改 `apps/web/components/board/board-ai-panel.tsx`：删除本地 `buildAiReply` 正则模板函数，
     改为 `fetch(/api/boards/:id/ai-chat)` 真实调用；`board-canvas.tsx` 传入 `boardId`。
   - 范围说明：仍是单轮无状态生成（不新增持久化对话表/不做多轮历史落库/不做 SSE 流式），
     因为这些超出"reskin 阶段 + 复用既有 AI 调用能力"的合理范围；已按此边界完成，
     未发现需要升级给人类做产品决策的部分。
   - e2e 相应调整（`e2e/board-ai-overlay.spec.ts`）：预先在画布上创建一张带独特文字的便签，
     断言 AI 回复中包含这段独特文字（而非断言写死文案），证明回复真实基于画布内容生成。
3. **既有回归 `board-menu-001` 的可追溯指针**：本仓库中并无此前"已 spawn 后台任务"的可查记录，
   本轮已确认既有 `task_c97e1932`（标题："Fix flaky board-tool-shape e2e assertion"）覆盖同一
   问题（`board-tool-shape` 新建形状后 `toContainText("矩形")` 断言失败，text 为空）——
   **这就是应对上的后台任务，接手时按此 id 追踪**，不要重复 spawn。仍与 F01 无关，不阻塞 F01 verify。

## 本轮改动（F01，累计）
- 新增 `apps/web/components/board/board-bottom-dock.tsx`（底部悬浮工具 dock）。
- 改 `apps/web/components/board/board-ai-panel.tsx`（AI 浮层触发 + Board AI 停靠面板；
  复审后回复改为真实调用 ai-chat 路由）。
- 改 `apps/web/components/board/board-canvas.tsx`（接入以上两组件 + `aiOpen` 状态 +
  `chooseDockTool` + 传入 `boardId` 给 AI 浮层）。
- 新增 `apps/web/app/api/boards/[id]/ai-chat/route.ts`（Board AI 真实生成入口，复审新增）。
- 改 `packages/ai/src/gateway.ts` + `packages/ai/src/index.test.ts`（新增画布内容标记，复审新增）。
- 改 `apps/web/e2e/board-ai-overlay.spec.ts`（断言真实画布内容，复审新增）。
- 分支：`worker/wrk-claude-1-p17-f01-board-ai-overlay`。

## 仍损坏或未验证
- `e2e/board-menu-001-use-board-menu.spec.ts` 有既有回归（addShape 新建形状 item 断言
  `toContainText("矩形")` 失败，text 为空），**验证过与 F01 无关**（stash 掉 F01 全部改动后仍复现）。
  可追溯后台任务：`task_c97e1932`（"Fix flaky board-tool-shape e2e assertion"），不阻塞 F01 verify。
- `e2e/ava-chat-basic.spec.ts` 的"登录用户：空态建议…"用例在本地环境下稳定失败于
  `getByTestId("suggestion")` 找不到元素——本轮验证过与本次改动无关（stash 后同样失败），
  不属于 F01 范围，未单独 spawn 任务（不在本次 revise 要求范围内，留给下一轮視需要处理）。
- Board AI 面板当前无跨会话持久化（纯客户端会话内 state），已明确判断为超出 reskin 阶段合理
  范围，如需要后续单独立项（不在本次 F01 revise 范围内）。

## 下一步最佳动作
- Reviewer/evaluator：对 F01 的 PR #241 重新评审，确认"真实 AI 调用"是否满足预期。
- 下一轮如果继续 F01 相关工作，先看这个 handoff + PR 评论，不要跳过既有 review 意见重做。
- 不要顺手把 `board-menu-001`（task_c97e1932）或 `ava-chat-basic` 的既有问题揉进 F01 的提交里——
  那些是独立 task。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p17/01`
- F01 单独验证:`docker compose -f infra/docker-compose.yml up -d && pnpm --filter @repo/data run migrate && pnpm --filter @repo/web exec playwright test e2e/board-ai-overlay.spec.ts`
- F01 真实 AI 生成的补充验证:`pnpm --filter @repo/ai run test && pnpm --filter @repo/web run typecheck`
