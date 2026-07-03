# Coordinator SOP — 分层监控循环（v1）

> `multi-agent-coordination.md` §2 定义了 coordinator 单轮循环"做什么"（ADR-004 §4 确立 coordinator 角色）；本文定义"什么节奏做、每层必查什么"。
> 目标：事件驱动为主、定期扫描兜底，任何一层漏掉的问题都会被更大的循环接住。

## 三层循环

### L0 事件层（~60s，事件驱动，非轮询开销）
监听总线变化（issue 的 `status:*`/`review:*` label、open PR 的 CI check 结论），**有变化才动作**：

| 事件 | 动作 |
|---|---|
| issue → `status:in-review`（新 PR） | 导出 diff，按 §3 路由调起必需 reviewer |
| reviewer verdict 齐 | 全绿 → 走合并门禁；任一 CHANGES → `status:changes-requested` + PR 评论逐条返工清单 + @worker |
| 返工 push（changes-requested 的 issue 回到 in-review） | 复核返工 commit：逐条对照原返工清单实测（git ls-tree / git show，不信任声称），到位即翻绿 |
| CI check 失败 | **先分诊**：job steps 为空 + 秒级失败 + annotation 含 billing/runner 字样 = 基础设施问题，升级人类、不退回 worker；否则读失败日志归因到代码，退回 worker |
| `status:blocked` 出现 | 读原因评论，能解则解（缺依赖→调整分派；缺 key/环境→升级人类） |

### L1 队列层（~5min 或每次事件处理完顺手做）
1. **合并队列**：`status:approved` ∩ CI 绿 ∩ 分支 up-to-date → 按约定顺序合并（动共享文件多的最后合），置 `status:merged`、关 issue、跑 `pnpm harness verify`。
2. **review 在途**：调起 >15min 未回的 reviewer agent 是否还活着，死了重派。
3. **分派补给**：有空闲 worker 且存在 `status:ready-for-dev` ∩ 依赖全绿 ∩ 与在途 PR 无同文件热点 → 分派（认领双写：`harness claim` + label）。

### L2 全局层（~15min）
1. **lease 巡检**：`status:in-progress` 最后活动 > LEASE_TTL(6h) → 回收重分派（ADR-004 §4）。
2. **漂移巡检**：抽查 label 与事实一致性——`review:*-ok` 是否都有对应 reviewer 产出记录（评论）；有无非 coordinator 编排的 verdict label（出现即摘除并留言，见"verdict 权威"）。
3. **阻塞升级**：`status:blocked` 超过 1 个 L2 周期无进展 → 评论 + 通知人类。
4. **基础设施健康**：CI 是否整体可用（账单/runner）；不可用时在追踪评论里刷新状态。
5. **背景任务盘点**：自己派出的 reviewer/verifier agent、监控任务有无僵死；scratchpad worktree 有无该清理的。

### L3 会话层（每轮会话收尾/交接时）
- 未完成的协调状态写进总线（issue 评论），不留在会话记忆里——下一个 coordinator 冷启动只读总线即可续上。
- 更新 `.harness/state/PROGRESS.md` 中协调平面相关条目。

## 铁律（任何层都不可违反）
1. **verdict 权威**：`review:*-ok` 只能由 coordinator 编排的 reviewer 产出。发现来路不明的 verdict → 摘除 + 留言，以可核验事实（git ls-tree、命令退出码）重裁。
2. **coordinator 唯一**：接管协调前先向存量协调会话广播；双 coordinator 结论冲突时，以可核验事实为准，并立即收敛为单 coordinator。
3. **合并独占**：只有 coordinator 执行合并；review 全绿 + CI 绿 + up-to-date 缺一不可（CI 因基础设施不可用时，合并冻结并升级人类，不得以"本地验过"绕行）。
4. **证据实测**：任何"已验证/已入库"声称都用 `git ls-tree` / `git show` / 退出码实测，不信任 diff 注释、progress 叙述或打分。

## 事故分诊速查（来自实战）
- CI 秒级失败 + steps 空 → 账单/runner，非代码（2026-07-04 账单事故）。
- evidence 指针存在但文件不在 git 树 → 假 passing（PR #310/#311/#312 三连）。
- 迁移回填用自然键（name）匹配 → 用户数据混入风险（PR #312 初版）。
- 无 node_modules 的 worktree push 失败（turbo not found）→ pre-push hook，纯文档改动可 --no-verify。

## 生命周期（启动/退位/抢占）
coordinator 是**单例角色**，由会话通过启动仪式认领，不是常驻 subagent。
完整仪式见 `.agents/skills/coordinator/SKILL.md`（唯一性握手 → 认领广播 → 冷启动读总线 →
挂监控 → SOP 循环）。要点：
- **唯一性来源**：label 为 `coordination:lease` 的专用 issue；heartbeat（每个 L2 tick 一条评论）
  < 30 分钟视为在任，禁止第二个 coordinator 启动。
- **抢占**：heartbeat 过期后任何会话可 takeover；冲突以 lease issue 最新合法 claim 为准。
- **退位**：release 评论 + 交接要点写进 lease issue，状态永远在总线上，不在会话记忆里。
