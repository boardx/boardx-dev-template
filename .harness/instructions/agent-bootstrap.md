# Agent Bootstrap — 你的人类把这份文件交给你，照它接入 BoardX

> **目标读者：agent 本体**（Claude Code / 其它任何能读写 git+GitHub 的 agent）。
> 你的人类开发者刚把你带进 BoardX 项目，这份文件是你的接入执行书：从零到
> 认领第一个 feature，按顺序执行，每步都有可验证的完成标志。
>
> 人类侧的对应文档是 `human-developer-onboarding.md`（讲组织模型和为什么）；
> 本文只讲**你现在要按顺序做什么**。规则的权威出处：ADR-009（协调权威语义）、
> ADR-017（权威载体 = coord-gateway / RepoHub DO，2026-07-18 割接）、
> ADR-010（组织模型）、ADR-011（身份注册）。

## 你需要先从人类那里拿到的东西

开始前向你的开发者确认三样，缺任何一样就停下来向他要，不要猜：

1. **你的身份 id**：形如 `coord-<模块>`（你是 module coordinator）或
   `coord-<模块>.<role>-<n>`（你是某个 coordinator 的子 agent）。这个 id 必须
   已经在 `.harness/agents/registry.yaml` 里有条目——没有就让人类先走注册
   （见 human-developer-onboarding.md §3 第 1 步），你不能自封身份。
2. **coord-gateway 凭据**：按仓 scoped token，你的人类（或你自己，若已有 Access
   登录）在 devportal（develop.boardx.us → 加入开发 → 第 5 步）自助领取（p29-F08），
   保存到本机 gitignored 文件（如 `.harness/state/.cache/` 下）。人类只应该告诉你
   **文件路径**，绝不应该在聊天里贴 token 明文——如果他贴了，提醒他这个 token
   已泄露、需要在 devportal 再点一次领取（轮换，旧 token 即时失效）。
   旧 coord-service 凭据（COORD_SERVICE_*）已随 ADR-017 割接退役。
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
| **你负责模块的知识库：`.agents/skills/mod-<模块名>/SKILL.md`** | 代码在哪？什么契约不能破坏？前人踩过什么坑？ |

**完成标志**：能用一句话说出"我是谁（id/kind/parent）、我管什么（areas）、
我的产出谁来验收（父 coordinator 是谁）"。

## 第 2 步 — 环境自检

```bash
./init.sh        # 安装依赖 + 基础验证 + git hooks。失败 = 先修基础，不叠新活
```

**完成标志**：init.sh 退出码 0。失败时不要绕过，把失败原样报告给你的人类。

## 第 3 步 — 接上协调平面（没有这步 = 你不存在）

```bash
export COORD_GATEWAY_URL=https://coord-gateway.boardx.workers.dev
export COORD_REPO=boardx/boardx-dev-template
export COORD_API_TOKEN=$(cat <你的 token 文件路径>)   # devportal 自助领取的按仓 scoped token

# 验证凭据可用（gateway 读端点也验 token）：
curl -s -H "Authorization: Bearer $COORD_API_TOKEN" \
  "$COORD_GATEWAY_URL/api/coord/repos/$COORD_REPO/claims" | jq '.leases | length'
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

**完成标志**：上面 `/claims` 的 leases 里能看到你的租约；人类在
https://develop.boardx.us/portal 的"实时协调"里也能看到你。

## 第 3.5 步 — 挂上你的 loop（ADR-014 统一时钟 + 分级 loop 纪律）

**每个 agent 必须有 loop，且必须用统一时钟**——不是可选项。协调决策（租约还新鲜吗、
当前哪个周期、还剩多久）一律以 coord-gateway 的权威时钟（`GET /api/coord/time`）
为准，**不信本机 `date`**
（机器时钟一漂就误判；真实事故：coord-architecture 租约静默过期 8 小时）。

每个 loop 只需跑**一条命令**，它把该做的四件事做完：

```bash
pnpm harness tick --session <你的身份id>     # 或设 COORD_AGENT_ID；--json 供脚本消费
#  1. 读权威时钟 → 当前周期 id / 还剩多久（决定何时发 cycle-result）
#  2. 时钟漂移检测（>60s 告警——你按错误时间协调会误判）
#  3. 续自己的租约（acquire-or-renew，防静默过期）
#  4. 拉任务收件箱（#594）→ 有 pending 就按提示 ack 开工
```

**你的 loop 周期按层级定（ADR-014 D3）**：

| 你是 | tick 周期 | 每 tick 除 tick 外还做 |
|---|---|---|
| coord-main | 5 分钟 | 合并队列（CI 绿即合）、andon、review 积压升级 |
| module-coordinator | 15 分钟 | 本模块收件箱/PR 队列、首轮 review、派子 agent |
| sub-agent / worker | 15 分钟 | ack 待接任务、推进当前 feature |

**实现随你的 runtime**：Claude Code 用 `/loop` 或 Monitor，Codex 用其等价物，裸脚本
cron 也行——契约只规定**节奏 + 跑 tick**，不绑任何私有通道。

**loop ≠ C-cycle**：loop 是操作节拍（分钟级），C-cycle（3h）是汇报/度量节拍。
只有后者没有前者，就是"租约过期 8 小时没人知道"的成因。

**完成标志**：`pnpm harness tick` 输出权威时刻 + 当前周期 + 你的租约状态；
且你的循环里真的在按上表周期调它。

### 旧版说明（收件箱轮询细节，tick 已包含）

coordinator 派工写进你所在仓 RepoHub DO 的 tasks 收件箱（F10-pre 起，#732），
**不依赖任何 runtime 私有通道**（Claude Code 的 session message 只是可选加速器，
Codex/自研 agent 没有它也一样收到活）。你的义务：**周期 ≤15 分钟**轮询自己的收件箱：

```bash
BASE="$COORD_GATEWAY_URL/api/coord/repos/$COORD_REPO"
# 有 pending 任务 → ack 确认 → 按 task.issue 读 GitHub 规格 → 认领开工
curl -s -H "Authorization: Bearer $COORD_API_TOKEN" "$BASE/tasks?status=pending" | jq '.tasks'
curl -s -X POST -H "Authorization: Bearer $COORD_API_TOKEN" "$BASE/tasks/<id>/ack"   # 认领确认（然后照第 4 步 lock/claim）
# 交付完成后：POST $BASE/tasks/<id>/complete
```

轮询实现随你的 runtime：Claude Code 用 /loop 或 Monitor，Codex 用其等价物，
裸脚本 cron 也行——契约只规定"≤15min 查一次、pending 必须 ack"。收件箱是私有的
（只能查自己）；派工/撤回（POST /tasks、/recall）是 coordinator 层专属。

**完成标志**：`GET $BASE/tasks` 返回 200（空列表也算通），且你的巡检循环里有这一步。

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

节拍：UTC 00/03/06/09/12/15/18/21（周期 id 以 `pnpm harness tick` 输出为准）。
每周期两条评论，发到 label 为 `coordination:work-cycle` 的专用 issue（这是
`cycle-report` 实际读取的权威位置；ADR-017 割接注记：旧 coord-service 的
POST /events 叙述通道已随退役下线，gateway 的 events 由协调动作自动产生、只读）：

```bash
# 进周期：cycle-plan 开头 + cycle:<周期id> + by:<你的身份id>，承诺 1-3 件可验证完成的事
# 出周期：cycle-result 开头，真完成的 / 没完成的 + 原因
gh issue comment <work-cycle issue 编号> --body "cycle-plan cycle:<周期id> by:<你的身份id>
commit: <承诺内容>"
# 阻塞升级用 andon（仅 maintainer 级：gateway 管理面 POST /andon，见 F06）
```

唯一硬指标是 **flow time**（你的 PR 从开出到合并的中位时长）。查全队状态：
`pnpm harness cycle-report`。

## 第 8 步 — 经验回流（干完活的最后一个动作）

本次工作若踩了新坑/建立了新做法/推翻了旧假设，往 `.agents/skills/mod-<模块名>/SKILL.md`
的"踩坑与经验"追加一条（日期 + 一句话 + PR/issue 链接），随交付 PR 一起提交。
**没有回流的经验会随会话消亡**——这是"仓库即唯一事实来源"对经验的延伸。

## 退出时（会话要结束了）

1. 过一遍 `.harness/rubrics/clean-state-checklist.md`。
2. 释放你不再持有的 claim（`lock-release` / claims release）——release 必须带
   handoff note（没有交接就不能放手，lease.md）。
3. 把未完成状态写进 handoff note 或 PR/issue——**不要只留在你的会话记忆里**，
   你死了记忆就没了，仓库和 RepoHub 事件日志才是唯一事实来源。

## 常见错误（前人真实踩过，别再踩）

| 错误 | 后果 |
|---|---|
| 用 `--phase` 模式跑 verify | evidence 不落盘、派生视图不刷新 → 被判假 passing |
| 干活但没在协调层登记/认领（RepoHub 租约） | 影子劳动力，coord-main 抽查会追溯到你的人类 |
| 长任务期间不续租约 | 租约过期、席位显示空缺、活可能被重新分派 |
| token 贴进聊天/PR | 立即视为泄露，人类必须去 Cloudflare 轮换 |
| 同时认领第二个 feature | 被 assertSingleInProgress 拒绝（设计如此） |
| 自己合并 PR / 手改 passing | 违反门禁不变量，review 直接 Block |
