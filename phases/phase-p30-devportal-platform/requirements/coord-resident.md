# p30 需求输入 ②：coord-resident——常驻云端协调者（人类拍板 2026-07-18）

> 人类原话锚点：「main agent 需要是 DO 来运行，必须是常驻 Cloudflare 的，
> 不是在人和电脑端运行的」。本文件把它与 use-cases.md 的 UC-17（dispatcher loops）、
> coord-agent（每项目唯一）对齐成一份可拆 feature 的需求。

## 现状差距

p29 已把协调层的**状态与原语**搬进 DO（租约 TTL 回收 / webhook→镜像→事件 / 反向投影 cron /
tasks 收件箱全部常驻），但**协调者本体**（分派决策、review 编排、合并执行、升级裁决、
C-cycle 报告）仍运行在人的电脑上的 Claude 会话里。笔记本合盖 = 车队失去指挥。

## 目标架构

1. **CoordBrain DO（每项目一个，= use-cases 的 coord-agent 宿主）**：与 RepoHub 同 worker，
   Cron tick 驱动**机械 SOP**（不需要 LLM 的 80%）：
   - required checks 绿 + review verdict 齐 + up-to-date + 无 andon → **自动合并**
     （GitHub App token，App 已有 PR write）；
   - `ready-for-dev` 且无活跃租约 → 按 registry/模块亲和自动派 tasks（UC-08 的服务端）；
   - PR 等待超阈值 → 自动催办/升级（把 coordinator SOP 的"主动追踪 PR 等待时长"机械化）；
   - lease 心跳丢失/stale → 起草回收请求进待拍板（UC-13）；
   - andon 活跃 → 冻结一切合并动作。
2. **@platform/dispatcher（全平台唯一）**：跨项目巡检五 loop（UC-17：1m 心跳租约 / 5m PR·CI /
   15m stale 处置 / 1h SLA 审计+性能快照 / 24h C-cycle 报告）；只做事实定位与路由给各项目
   coord-agent，**永不直接改项目内状态**。
3. **LLM 判断面**：需求分析综合（UC-07）、晨报叙事（UC-09）、命令条意图（UC-10）、待拍板
   摘要与"为什么需要我"推理——经 `wsx-ai` provider 接口（已拍板：默认 Workers AI 托管开源
   模型，可插拔外接更强模型）。实现载体优先评估 Cloudflare Agents SDK（durable agent +
   scheduled tasks 原生匹配）。
4. **人类环不变**：andon、拍板、registry/治理变更仍是人类特权；决策请求走待拍板流（decide
   意图，UC-11）。
5. **唯一性移交**：`role:coord-main`（本仓）最终由常驻 CoordBrain 持有并自续心跳；本地会话
   降级为可来可走的 module-coordinator/worker。

## 渐进接管（安全约束，feature 拆分必须保序）

R1 **影子模式**：CoordBrain 只读观察，把"它将做的决策"写入事件流（`coord.shadow.*`）供人
核对，跑满一个完整工作周期且零误判后才放权；
R2 接管**机械合并**（全绿自动合并，含审计事件与可一键停用开关）；
R3 接管**派工**（tasks 下发 + 租约仲裁）；
R4 接管 **LLM 判断面**（需求分析/晨报/命令条）；
R5 **唯一性移交**（role:coord-main 由 DO 持有），人类保留 andon 与治理台的最终控制。

每级独立可回退：治理台一键把任意层级降回"人工模式"（fail-open 到人，绝不 fail-open 到自动）。

## 非功能

- 决策全留痕：每个自动动作一条事件 + GitHub 侧可见落点（评论/label/status），可追责可复盘；
- 机械规则纯代码、可单测；LLM 结论只能产出"起草/建议/摘要"，进入写路径必须过机械规则或人；
- 凭据：GitHub App installation token 即时铸造（已有 coord-projection 认证栈），不引入新长期密钥。
