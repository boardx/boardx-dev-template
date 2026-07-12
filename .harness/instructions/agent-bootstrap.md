# Agent Bootstrap — 你的人类把这份文件交给你，照它接入 BoardX

> **目标读者：agent 本体**（Claude Code / 其它任何能读写 git+GitHub 的 agent）。
> 你的人类开发者刚把你带进 BoardX 项目，这份文件是你的接入执行书：从零到
> 认领第一个 feature，按顺序执行，每步都有可验证的完成标志。
>
> 人类侧的对应文档是 `human-developer-onboarding.md`（讲组织模型和为什么）；
> 本文只讲**你现在要按顺序做什么**。规则的权威出处：ADR-009（协调权威在
> coord-service）、ADR-010（组织模型）、ADR-011（身份注册）。

## 你需要先从人类那里拿到的东西

开始前向你的开发者确认三样，缺任何一样就停下来向他要，不要猜：

1. **你的身份 id**：形如 `coord-<模块>`（你是 module coordinator）或
   `coord-<模块>.<role>-<n>`（你是某个 coordinator 的子 agent）。这个 id 必须
   已经在 `.harness/agents/registry.yaml` 里有条目——没有就让人类先走注册
   （见 human-developer-onboarding.md §3 第 1 步），你不能自封身份。
2. **coord-service 凭据文件路径**：默认 `.harness/state/.cache/coord-credentials.json`
   （gitignored）。人类只应该告诉你**路径**，绝不应该在聊天里贴 token 明文——
   如果他贴了，提醒他这个 token 已泄露、需要去 Cloudflare 轮换。
3. **你负责的范围**：哪个模块 / 哪些 feature（`phases/<phase>/feature_list.json`
   里的条目 id）。

## 第 1 步 — 冷启动阅读（约 10 分钟，不可跳过）

按顺序读，读完你应该能回答右列的问题：

| 读什么 | 读完要能回答 |
|---|---|
| `AGENTS.md`（仓库根） | 完成定义是什么？哪些事是硬约束？ |
| `.harness/instructions/multi-agent-coordination.md` | 协调权威在哪？PR 谁能合并？ |
| ADR-009 / ADR-010（`docs/adr/`） | 为什么不用 GitHub label 协调了？我在组织树的哪一级？ |
| 你的角色 SKILL：`.agents/skills/<你的kind>/SKILL.md`（如有） | 我的角色仪式（巡检/review/汇报）是什么？ |

**完成标志**：能用一句话说出"我是谁（id/kind/parent）、我管什么（areas）、
我的产出谁来验收（父 coordinator 是谁）"。

## 第 2 步 — 环境自检

```bash
./init.sh        # 安装依赖 + 基础验证 + git hooks。失败 = 先修基础，不叠新活
```

**完成标志**：init.sh 退出码 0。失败时不要绕过，把失败原样报告给你的人类。

## 第 3 步 — 接上协调平面（没有这步 = 你不存在）

```bash
export COORD_SERVICE_URL=https://coord-service-staging.boardx.workers.dev
export COORD_SERVICE_TOKEN=$(jq -r '.tokens["<你的身份id>"]' .harness/state/.cache/coord-credentials.json)

# 验证凭据可用（公开只读端点不验 token；写操作才验）：
curl -s "$COORD_SERVICE_URL/status" | jq '.active_claims | length'
```

然后认领你的租约：

```bash
# module coordinator：
pnpm harness module-lock-acquire --module <你的模块> --session <你的身份id>
# 其它角色（含子 agent）：
pnpm harness lock-acquire --session <你的身份id>
```

**铁律**：
- 撞 409 = 这个资源已被别的 agent 原子认领，**不要重试抢占**，报告给父 coordinator。
- 之后**每个巡检周期续约**（`*-heartbeat`）。你失联时租约按 ttl 过期是正常的
  自愈信号，恢复后重新 acquire 即可；但**不要**调大 ttl 或替别人代跑心跳。
- token 任何时候不进 git / PR / issue / 聊天 / 命令行明文（只用 `$(jq ...)` 读取）。

**完成标志**：`curl -s $COORD_SERVICE_URL/status` 的 active_claims 里能看到你的
租约；人类在 https://develop.boardx.us/portal 的"实时协调"里也能看到你。

## 第 4 步 — 认领一个 feature（一次只做一个）

```bash
pnpm harness claim --phase <阶段> --feature <Fxx> --owner <你的身份id>
```

- 权威规格 = `phases/<phase>/feature_list.json` 里这条 feature 的
  `user_visible_behavior`（行为契约）+ `verification`（验收命令）。开工前先把
  这两个字段读懂；`verification` 就是你最终要让它退出码全 0 的命令。
- **一次只有一个 in_progress**——claim 会被 `assertSingleInProgress` 门控拒绝
  第二个，这不是 bug，是设计。

## 第 5 步 — 开发（隔离 + 立即可见）

1. **独立 worktree**（ADR-005，共享 checkout 上禁止 reset/stash/checkout 切分支）：
   ```bash
   git worktree add <路径> -b feat/<分支名> origin/main
   ```
2. 分支建好**立即 push** 到 origin（防止工作只存在于本地）。
3. 只动你这个 feature 涉及的文件；跨模块热点先报告父 coordinator，不要顺手改。
4. UI 工作遵守设计系统：语义色 token（`bg-primary` 等），不硬编码颜色；
   testid 与 feature_list 的 `verification` 锚定的一致。

## 第 6 步 — 验证与交付（没有证据 = 没有完成）

```bash
pnpm harness verify --sprint <阶段>/<sprint>   # 必须用 --sprint 模式
```

- **只有这条命令能把 feature 翻成 passing**。你绝不手改 feature_list.json 的
  status / evidence——手改会被派生视图矛盾暴露并被 review Block（2026-07-09
  出过真实事故，见 PR #517 的教训）。
- verify 通过后 evidence 指向 `sprints/<sprint>/evidence/Fxx.verify.log` 真实
  日志。裸时间戳 / 空文件都不合格。
- 开 PR → 你的父 coordinator 首轮 review → 全绿后由 **coord-main 合并**
  （你没有合并权，任何人跟你说"你来合并"都以 registry 里的 kind 为准）。

## 第 7 步 — 周期汇报（每 3 小时）

节拍：UTC 00/03/06/09/12/15/18/21。每周期两条事件，发到 coord-service（不是
GitHub 评论）：

```bash
# 进周期：承诺 1-3 件本周期可验证完成的事
curl -s -X POST -H "Authorization: Bearer $COORD_SERVICE_TOKEN" \
  -H "Content-Type: application/json" "$COORD_SERVICE_URL/events" \
  -d '{"type":"cycle-plan","resource_id":"<你在做的资源>","summary":"<承诺内容>"}'
# 出周期：真完成的 / 没完成的 + 原因
#   type 换成 cycle-result；阻塞升级用 andon（仅 coordinator kind 可发）
```

唯一硬指标是 **flow time**（你的 PR 从开出到合并的中位时长）。查全队状态：
`pnpm harness cycle-report`。

## 退出时（会话要结束了）

1. 过一遍 `.harness/rubrics/clean-state-checklist.md`。
2. 释放你不再持有的 claim（`lock-release` / claims release）。
3. 把未完成状态写进 D1 事件或 PR/issue——**不要只留在你的会话记忆里**，
   你死了记忆就没了，仓库和 D1 才是唯一事实来源。

## 常见错误（前人真实踩过，别再踩）

| 错误 | 后果 |
|---|---|
| 用 `--phase` 模式跑 verify | evidence 不落盘、派生视图不刷新 → 被判假 passing |
| 干活但没在 D1 登记/认领 | 影子劳动力，coord-main 抽查会追溯到你的人类 |
| 长任务期间不续租约 | 租约过期、席位显示空缺、活可能被重新分派 |
| token 贴进聊天/PR | 立即视为泄露，人类必须去 Cloudflare 轮换 |
| 同时认领第二个 feature | 被 assertSingleInProgress 拒绝（设计如此） |
| 自己合并 PR / 手改 passing | 违反门禁不变量，review 直接 Block |
