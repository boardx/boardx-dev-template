# 并行开发编排日志（主 agent 自动维护）

> 用户睡觉期间自动编排：3 路并行 worktree subagent 开发 ready-for-dev issues，
> 完成→集成(e2e+合并)→派下一批，直到全部完成或 ~7h 预算用尽。
> 非阻塞问题一律先跳过并记录在此。

## 批次进度

### Batch 1（启动）
- A) #64 uc-credits-001-view-wallet → /credits
- B) #68 uc-kb-001-upload-file → /knowledge-base
- C) #40 uc-ai-store-001-browse-items → /ai-store
状态：✅ 已派发 3 路并行 worktree subagent（运行中，等完成通知）

## 集成记录
（每个 subagent 完成后：跑 e2e、tsc、lint，合并其分支到 feat/ui-prototype-v1，关 issue）

## 跳过/待人工确认
（非阻塞问题记录于此）

## 运行机制
- 驱动：background-agent 完成通知（harness 原生）自动重新唤醒主 agent → 集成 + 派下一批。
- 定时心跳：调度 MCP 暂 404，未能设置；依赖完成通知推进。
- 预算：起 01:55 CST，止 ~08:57 CST。

### Batch 1 完成（merged → in-review，待 CI e2e）
- ✅ #64 credits /credits · #68 kb /knowledge-base · #40 ai-store /ai-store
- 均合并入 feat/ui-prototype-v1；tsc+lint 绿；e2e spec 已落；本地无 DB，完整 e2e 待 push CI。

### Batch 2（启动）
- #73 share(view-shared-chat) · #75 survey(create-survey) · #67 invite(accept-invite-link)

### Batch 2 完成（merged → in-review）
- ✅ #73 share /share/[id] · #67 invite /invite/[token] · #75 survey /surveys （均合并，tsc+lint 绿）

### Batch 3（启动）
- #66 recent(/recent 增强) · #74 studio(/studio) · #44 billing(/billing)

进度：已合并 6 个 feature（credits/kb/ai-store/share/invite/survey）入 feat/ui-prototype-v1；均 tsc+lint 绿，e2e 待 CI。

### Batch 3 完成（merged → in-review）
- ✅ #44 billing /billing · #66 recent /recent · #74 studio /studio
- 注：#65 feedback 被【其它会话 agent】认领（in-progress）→ 本编排跳过（认领锁生效）。

### Batch 4（启动）
- #69 presentations(/presentations) · #39 admin(/admin) · #43 ava(/ava, 大)
进度：已合并 9 个 feature（credits/kb/ai-store/share/invite/survey/billing/recent/studio）。

### Batch 4 完成（merged → in-review）
- ✅ #69 presentations · #39 admin · #43 ava（AVA 聊天主流程）
### Batch 5（启动）
- #42 confirm-email · #70 user-menu(增强 sidebar) · #72 room-chat-send
进度：已合并 12 个 feature。剩余多为 board 子件(同文件，需串行)+ 少量独立件。

### Batch 5/6 完成（merged → in-review）
- ✅ #42 confirm-email · #70 user-menu · #72 room-chat-send · #76 team-invite · #41 social-login（共 17 merged）
- ⚠️ #46 board-share 首次因 API Overloaded 崩溃(未提交)→ 丢弃重试。
### Batch 7（启动）
- #71 room-members · #62 global-search · #46 board-share(retry)

## ===== 编排中段汇总（~04:30 CST）=====

### 已完成：24 个 feature 合并入 feat/ui-prototype-v1（均 tsc + design-lint 绿，e2e spec 已落）
credits, kb, ai-store, share, invite, survey, billing, recent, studio, presentations, admin, ava,
confirm-email, user-menu, room-chat-send, team-invite, social-login, board-share, room-members,
team-settings(冲突已解), shortcuts-help, create-text, global-search, sync-status(冲突已解)。
对应 issues 标 status:in-review（待 push 后 CI 跑全量 e2e）。

### 关键结构性发现（影响后续并行）
**所有 worktree 子 agent 从固定 base `35a3378` 分支**（非 live tip），而非各自最新。
→ 凡触碰「已被前序 feature 改过的共享文件」(`board-canvas.tsx`、`boards/[id]/page.tsx`、`teams/page.tsx`)
  的 feature，合并时必冲突；部分是语义冲突（如 #57 bold 与 #51 text 共用 color 字段编码）。
→ 新建独立路由/文件的 feature 合并干净（前 18 个几乎都是）；共享文件 feature 需逐个手解。

### 剩余（~13，几乎全是 board 子件，均共享 board-canvas.tsx / boards 页 → 并行会冲突）
#45,49,50,52,53,54,55,56,58,59,60,61,77 + #57(已释放，需重做)。少量非 board：#63 feedback(疑与 #65 重)。

### 建议续作方式（二选一）
1. **串行、直接在 live tip 上做**（不走 stale-base worktree）：board 子件一次一个，改 board-canvas.tsx/board 页 → tsc+lint → commit。无冲突。
2. 若仍用 worktree 并行：让每个 worktree 从「当前 tip」rebase 后再交付，或编排器接受逐个手解冲突。

### 收尾动作（待人工/下一轮）
- push feat/ui-prototype-v1 → CI(harness-verify) 跑全量 e2e（本地无 DB，e2e 未本地执行）；按结果修红。
- 把 in-review 的 24 个 issue 在 CI 绿后置 passing/关闭。

## ===== 续作（直接 live tip，无冲突）=====
- ✅ #49 board-statistics（直接做，合并干净）→ 共 25 个 feature 落地。
- 方式确认：board 子件改用「直接在 tip 上串行做」可完全避开 stale-base worktree 冲突。
