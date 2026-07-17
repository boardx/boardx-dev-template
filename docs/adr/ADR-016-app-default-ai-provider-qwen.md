# ADR 016: 应用端默认 AI provider 用 Qwen

- 状态: Accepted
- 日期: 2026-07-17

## 背景

BoardX 应用端（AVA 对话、问卷 AI 报告等）需要一个**默认真实模型**。`packages/ai` 的网关支持多 provider，"默认用哪个"是产品决策，不是实现细节。

这条决策在三天内被拍板过两次，方向相反：

| 日期 | 结论 | 语境 |
|---|---|---|
| 2026-07-14 | 统一 Claude 系，不引入 Qwen | coord-main 发现 p25 survey（#632）用了 Qwen/DashScope 做 AI 报告，判断"产品 AI 一直是 Claude 系"，请人类拍板，人类选了改 Claude。据此开了 #654。 |
| **2026-07-17** | **应用端默认 Qwen** | 人类原话：**「boardx 的应用端，默认使用 qwen，可以的」**。这条是**最新、最明确**的指令，覆盖上一条。 |

**本 ADR 存在的直接原因是第一条结论差点造成一次真实的来回改**：#654 的正文当时写着"把 AI 报告从 Qwen 换成 anthropicProvider、删除 DASHSCOPE_API_KEY"，而同期 #668 正在把 `DEFAULT_AVA_MODEL_ID` 设为 `qwen3.7-max`。两条指令同时挂在总线上，谁先落地谁算数——#668 的作者很可能根本不知道有 07-14 那条决策（它是在另一个会话里当场拍的，#654 派出去后一直零 ack）。

口头拍板不进仓库，就会以"某个 agent 记得/不记得"的形式随机生效。这正是 AGENTS.md「仓库即唯一事实来源：你看不到的东西就不存在」要防的事。

## 决策

**应用端（apps/web 面向用户的 AI 功能）默认 provider = Qwen（DashScope）。**

- `packages/ai` 的 `DEFAULT_AVA_MODEL_ID` = `qwen3.7-max`（见 #668）。
- survey 的 AI 报告链路（`apps/web/lib/qwen.ts`、`packages/data/src/surveyAi.ts`、`ai-report` 路由）**保持 Qwen，不改回 Claude**。
- 密钥走 `DASHSCOPE_API_KEY` / `QWEN_API_KEY`（env secret，不硬编码）。
- `anthropicProvider` **保留**为可选 provider——本 ADR 定的是"默认"，不是"唯一"。多 provider 并存是网关的既有能力，不因本决策收窄。

**作废**：07-14 的"统一 Claude 系"结论。#654 已据此修订——其中的"改用 Claude"P0 已划掉并标注作废，但该 issue **不关闭**，因为它其余几条与 provider 选择无关的安全项仍然有效（见"后果"）。

## 后果

### 正面
- 单一权威记录，止住来回改。下一个读到 07-14 旧结论的 agent 会被本 ADR 挡下。
- #668 方向获批，AVA legacy 同步可以推进。
- 网关多 provider 能力不变，将来换默认只需改一处 + 补一条 superseding ADR。

### 负面 / 需要盯的
- **付费调用面不因换 provider 而减轻，反而更需要收口。** #654 里这几条**仍然必须做**，且默认 Qwen 之后**更重要**：
  - AI 报告生成仅 `canViewSurvey` 鉴权且**无限流** → 任意团队可见者可反复触发付费 Qwen 调用（成本/DoS）。
  - `ai-report/route.ts:235`、`surveys/ai/route.ts:100` 把 `String(err)` / `error.message` 直接回客户端 —— provider 报文会随之外泄，**换成 Qwen 后泄漏的是 DashScope 的报文**，性质没变。（全仓错误泄漏清零见 #669 / ADR-015。）
- 引入对阿里云 DashScope 的运行时依赖：需要 `DASHSCOPE_API_KEY` 的发放/轮换流程，以及该服务不可用时的降级路径。
- 数据流向：用户内容（对话、答卷）会送到 DashScope。若将来有数据驻留/合规要求，本决策是第一个要复审的点。

### 对架构平面的影响
`packages/ai` 仍是唯一网关，本 ADR 只改它的默认值，不改其结构。消费方（AVA、survey）继续通过网关取 provider，不直连 SDK。
