# Agent 接入清单 — 任何平台的 agent 加入协作的最小成本

> 📌 **接入的执行顺序看 `agent-bootstrap.md`**（第 1 步做什么、第 2 步做什么、
> 每步的完成标志）。本文是它背后的**规则清单**（平台无关的不变量），两份互补：
> bootstrap 告诉你怎么走，本清单告诉你哪些线不能踩。

> ⚠️ **2026-07-09 起（ADR-009 + ADR-010）读本文前先知道两件事**：
> 1. **协调权威已迁到 coord-service (D1)**，不再是 GitHub issue/label。本文下方仍有
>    多处把 issue/label 描述成"协调权威"的表述，那是 ADR-009 之前的历史框架——认领/
>    心跳/租约现在一律走 `pnpm harness lock-*` / `module-lock-*`（需 coord-service
>    凭据），GitHub 只保留 feature 规格 + 人类可读叙述用途。以 ADR-009 为准。
> 2. **组织模型见 ADR-010**：三级 coordinator（main/module/architecture）+ 角色子
>    agent（必须登记进 coord-service）+ 全员 3h 性能周期 + 防断链。人类开发者带
>    agent 加入看 `human-developer-onboarding.md`。

> 维护者：architecture-coordinator（`coord-architecture`，见 registry.yaml）。目标读者
> 不是"这批 Claude Code 会话"，而是**任何**未来能读写 GitHub 的 agent——不同厂商的模型、
> 不同工具集、甚至开源社区贡献的自定义脚本/机器人。协议本体只依赖 git + GitHub
> issue/label/PR，不要求任何 Claude 专属能力；本清单是这条设计原则的落地检查表。
> 每次协作协议本身发生变化（新 ADR、label 集合变化、门禁规则调整），维护者应回来
> 复核本清单是否需要同步更新。

## 最少要读的文档（按顺序）

1. **`AGENTS.md`**（仓库根目录）——项目全貌、完成定义（DoD）、不可违反的硬约束。
   这是任何 agent 冷启动的第一站。
2. **`.harness/instructions/multi-agent-coordination.md`**——协议本体：`status:*` label
   状态机、认领锁、review 路由、通信信道分层（§7：GitHub issue/PR 总线是唯一权威，
   任何"消息"渠道都只是通知，不算数）。
3. **`.harness/agents/registry.yaml`**——找到/确认自己的身份条目（`id`/`kind`/`areas`）。
   没有条目 → 见下方"新增身份"一节，不要自行编号硬凑。
4. **`docs/adr/ADR-004-issues-as-coordination-bus.md`** +
   **`ADR-005-shared-checkout-isolation.md`** +
   **`ADR-006-coord-service-d1-gating.md`**——三条决定"你能怎么碰 git/GitHub"的
   硬约束：状态机权威在哪、共享工作目录的隔离规则、认领动作的可选原子性增强
   （`COORD_SERVICE_URL`/`COORD_SERVICE_TOKEN` 未配置 = 完全不受影响，两个都配了
   才会额外问一次 D1）。
5. 按自己的 `kind` 再读对应角色文档：
   - `worker` → `.harness/instructions/parallel-dev-workflow.md` §5（执行循环）+
     要认领的那个 `phases/<phase>/feature_list.json` 条目（行为契约 + 验收命令）。
   - `coordinator` → `.agents/skills/coordinator/SKILL.md` + `coordinator-sop.md`。
   - `module-coordinator` → `.agents/skills/module-coordinator/SKILL.md`。
   - `architecture-coordinator` → `.agents/skills/architecture-coordinator/SKILL.md`
     （就是本文档所在的这个角色）。
   - `reviewer` → 对应 `.harness/agents/<name>.yaml` 的评审标准。

## 最少要遵守的规则（平台无关，不因为"不是 Claude"而降低）

1. **身份来自 registry.yaml，不是自封的**。`id` 用于 `agent:<id>` label 与
   `harness claim --owner`。没有条目的新 agent，先在 issue 里请求 `coord-architecture`
   或人类补一条（这是 schema 变更，走 PR + review，不是自己改）。
2. **认领是原子双写**：能跑 `pnpm harness claim` 的（本地跑 harness CLI 的 agent）
   两边都写；不能跑 harness CLI 的（纯外部 agent，只能操作 GitHub API）至少完成
   GitHub 侧的双写（`agent:<id>` + `status:in-progress`）——issue label 才是 ADR-004
   定义的权威协调状态，feature_list 侧的登记可以由任一能跑 harness 的 agent 事后
   补齐，不因为"工具不全"就可以跳过 label 认领这一步。
3. **`passing`/`review:*-ok` 只能由实际验证产出**，不能自己声称。任何"已验证"的说法
   必须能被 `git ls-tree`/`git show`/命令退出码验证到；查不到证据的一律视为未完成
   （coordinator-sop.md 铁律 §4）。
4. **不能自己合并 PR**，除非你就是 `coord-main`（唯一被授权执行合并的角色，`registry.yaml`
   里 `kind: coordinator` 的那一条——同一时刻只应该有一个会话在扮演它，唯一性由
   `coordination:lease` issue 的心跳裁定，见 multi-agent-coordination.md §1.2）。
5. **共享 git 工作目录隔离**（ADR-005）：只要会落地写文件/提交，一律用独立 worktree
   或独立 clone，不在共享主 checkout 上做 `reset`/`stash`/`branch -f`/`checkout
   <branch>` 这类整体性操作；分支建好立即 push 到 origin。本地如果启用了
   `reference-transaction` hook，违反这条在共享主 checkout 里会被直接拦截
   （非快进的分支 ref 更新）。
6. **状态变化必须发生在总线上**：GitHub issue/PR 的评论 + label 才是协调层面"发生过"
   的唯一凭证（多 agent 协调 §7）。任何仅存在于私有消息/聊天记录里的"我已经……"
   一律不算数——这条对非 Claude agent 尤其关键：你大概率根本没有跨会话消息这种
   私有通道，而协议设计本来就不应该要求你有。
7. **敏感 area（`auth`/`billing`/`admin`/`share`/`invite`）强制过 `rev-security`**，
   不因为"自己是新来的/信任等级不明"而加严，也不因为"自己审过一遍"而降低——门禁
   规则对所有 agent 一视同仁（architecture-coordinator 设计原则）。

## 新增身份（把自己注册进协议）

registry.yaml 的 schema 只要求平台无关字段：`id`/`kind`/`model`/`areas`（`model` 字段
只是标注这个身份背后是什么模型/工具，不影响协议逻辑，可以填 `external` 或具体工具名）。
新增一个身份是控制平面变更，走正常 PR 流程：改 registry.yaml → review → coord-main
合并；不要自己直接往 label 体系里塞一个从未注册过的 `agent:*` 值。

## 这份清单不覆盖什么

- **各阶段的产品需求/验收细节**——那是 `phases/<phase>/feature_list.json` 的事，
  每次认领具体 feature 时单独读。
- **本地开发环境搭建**（Node 版本、pnpm、docker compose 端口分配等）——见
  `AGENTS.md` 的"首次运行"一节与 `parallel-dev-workflow.md` §5 的 worktree 环境初始化。
- **服务端分支保护的当前限制**（私有仓 + 免费套餐暂不可用 rulesets）——见
  `multi-agent-coordination.md` §5，不是"新 agent 要遵守的规则"，是已知的基础设施
  限制，v0 靠 coordinator 独占合并权兜底。
