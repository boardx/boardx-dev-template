# 社区实践对照 Review（2026-07）——核心问题与解决方案

> 以 Claude Code / Codex 社区的 AI 原生开发实践为镜子照本模板，找结构性问题。
> 状态：proposal（逐项采纳后各自转 ADR/标准）。评审依据：官方文档 + 2026 年
> 社区共识文章（spec-driven、adversarial verification、ephemeral cloud agents、
> hooks-as-guardrails、MCP+skill 配对）。

## P1（最高优先）skills 放在两家工具都不认的位置——可发现性断裂

**问题**：模板的技能库在 `.agents/skills/`，但 Claude Code 原生自动加载的是
`.claude/skills/`，Codex 走 AGENTS.md 层级 + `.codex/`。stock 工具**不会自动发现**
我们的 skills——上游能用是因为会话被明确指路，模板使用者不会有这个待遇。
gen-subagents 已经把 agents 投影到 `.claude/agents` + `.codex/agents`，**skills 却没有
同样的投影**——同一个问题解过一半。

**方案**：扩展 gen-subagents 为 gen-surfaces：`.agents/skills/`（单一源）→ 生成
`.claude/skills/`（含 frontmatter description 供自动触发）+ AGENTS.md 尾部的 skill
索引（Codex 靠读文件发现）。CI 已有"生成物防漂移"检查，直接复用。

## P2 全套假设长驻会话，与 ephemeral/cloud agent 趋势冲突

**问题**：tick 循环（5/15 分钟）、session-handoff、C-cycle 都假设**长驻命名会话**。
社区主流正走向**任务级临时 agent**（Codex cloud 每任务一个沙箱、并行 worktree、
headless CI agent）——一个活 20 分钟的沙箱 agent 没有"每 15 分钟 tick"可言。

**方案**：租约+TTL 本来就兼容临时 agent，缺的是**显式的 ephemeral 契约**：
单任务生命周期 = claim → 干活 → verify → release（带 handoff note），一次跑完；
tick 声明为长驻会话专用。在 agent-bootstrap.md 加"两种接入形态"分叉，
registry 支持 task-scoped 身份（kind: ephemeral-worker，不参与租约巡检告警）。

## P3 feature 三元组对复杂功能欠深度——社区已走到 spec-driven

**问题**：`user_visible_behavior` 一句话 + verification 命令，对小 feature 足够；
对复杂 feature 就是社区所说的 **intent drift** 源头（"add login"式欠规格，agent
自选默认值）。requirements/ 有原始需求但被定位成"输入不是权威"，实现期 agent
未必回读。

**方案**：不推翻三元组（它的可执行性是优点），补两处：
① feature 增加可选 `spec_ref` 字段指向 requirements 的具体章节，实现前必读；
② feature-implementer skill 加 **plan-first 步骤**（社区共识：先出书面计划再动手，
Claude Code 有 plan mode 硬沙箱可用）。

## P4 验证存在自我背书通道——实现方可以偷偷改弱验证

**问题**：verify/doctor 分离防住了"翻状态"和"查证据"互相背书，但 **verification
命令本身**可被实现 agent 在实现期改弱（比如把 e2e 断言换成 `test -f README.md`），
doctor 不查验证命令的演变史。社区已是 adversarial verification / 每个产出 agent
配 checksum agent 的共识。

**方案**：**验证锁定**：new-sprint 派生工作集时对每个 feature 的 verification
数组取哈希存入 sprint 元数据；doctor 新增检查——passing 的 feature 其 verification
与 sprint 锁定哈希不一致 → FAIL（改验证必须走"重开 sprint 条目"这条响亮的路）。
高风险 area 再叠加独立评审 agent（feature-evaluator 已在，改为 required lane）。

## P5 上下文经济：深层文档体量大、无选择性加载线索、单语言

**问题**：AGENTS.md 92 行合格，但 instructions 总量数千行。社区实践是 lean 入口 +
**按需加载**（skill description 触发、上下文 scoping）。全中文对国际使用者是硬税
（结构是语言中立的，内容不是）。

**方案**：① 每份 instruction 头部加 3 行内的「适用场景」摘要（人和 agent 都用它
决定是否深读）；② P1 的 skills 投影天然带 description 自动触发，把最常用的三份
（bootstrap/coordinator-sop/testing）skill 化；③ README 已双语，下一步只译
AGENTS.md 与 CONCEPTS.md 两份（入口即可，深层按需社区共建）。

## P6 机械围栏没下沉到工具层——hooks 缺位

**问题**：我们的门控在脚本/CI 层（verify/doctor/lint/pre-push），但社区的第一道
围栏在**工具层 hooks**（写文件前拦截）。例：手改 feature_list 的 status 字段，
现在要等 doctor 才发现——工具层 hook 可以当场拒绝。

**方案**：模板附带**建议 hooks 配置**（`.claude/settings.json` 样例 + 文档说明
Codex 等价物）：① feature_list.json 的 status/evidence 字段人工编辑拦截提示；
② UI 文件写入后自动跑 lint-design；③ 保持 opt-in（不强加给使用者，符合诚实降级）。

## P7 协调协议只有裸 HTTP——社区标准接入面是 MCP

**问题**：coord/0.1 是自定义 HTTP + 自带 client。社区（两家生态一致）的工具接入
标准是 **MCP server + 配对 skill**。上游其实已建 MCP+CLI（p29-F07），模板没带。

**方案**：协议文档增加"MCP 适配层"一节：定义 coord MCP server 的工具面
（claim/heartbeat/release/tasks/time 一一映射），模板先带**接口说明**（与"实现
不打包"的既定立场一致），并链接上游参考实现。

## 采纳顺序建议

P1（半天，纯机械）→ P4（一天，doctor+new-sprint 各改一处）→ P2/P6（文档+样例）
→ P3 → P5 → P7。每项独立 PR，互不阻塞。

## 本 review 的边界

没有覆盖：安全面（prompt injection 对 issue/task 内容注入的防御姿态）值得单独
review；模板对超大仓（万文件级）的 --affected 性能未验证。
