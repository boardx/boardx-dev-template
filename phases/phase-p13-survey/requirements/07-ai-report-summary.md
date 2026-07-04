# 原始需求 — 问卷报告 AI 摘要（P13 后续增强）

## 背景 / 为什么做
F04（查看答卷与报告）交付时，notes 里明确写"分析报告的 AI 摘要为可选增强，核心导出不依赖
CAP-AI"——即当时刻意把 AI 摘要排除在核心交付之外，留到后续。现在 `packages/ai` 已具备
可复用的 CAP-AI 地基（均已合入 main，非某个未合并分支的产物）：`gateway.ts` 的
`defaultGateway`/`ChatGateway`（`anthropic:` 前缀走真实 `anthropicProvider.ts`，`stub:`
前缀走确定性 `stubProvider`，供 CI/e2e 无供应商额度也能跑通）+ `FORCE_FAIL_MARKER`
确定性失败触发约定；`studioGenerator.ts`/`presentationGenerator.ts` 是同一 sanctioned-stub
思路在非聊天生成场景的既有先例（各自有自己的 xxx_FORCE_FAIL_MARKER）。不需要再造一遍
AI 接入地基，跟着这套现有约定接线即可。

> 勘误：此前版本此处误引用了 `packages/ai/src/researchGenerator.ts` 作为先例——核实后
> 发现该文件只存在于一个尚未合并进 main 的 p18 分支（Deep Research 真实生成），并非当前
> 代码库里可依赖的东西。实现时请以本节列出的、已合入 main 的 `gateway.ts`/
> `studioGenerator.ts` 为准。

## 原始需求（用户故事）
- 作为问卷 owner，我想在 Report 视图里一键生成一段 AI 撰写的自然语言摘要（关键发现、
  显著趋势、值得关注的题目），以便不用自己逐题读图表就能快速把握整体结果。
- 作为问卷 owner，我想在回收变化后重新生成摘要，以便摘要内容不是一次性写死的。
- 作为访客/无权限者，我不应该能触发或看到别人问卷的 AI 摘要。

## 验收线索（可观察的成功是什么样）
- 打开某问卷 Report 视图（`report-view`，已有 `report-total`/`report-completion`/
  `report-question-*`），能看到一个新的"AI 摘要"区块和生成按钮。
- 点生成后进入 loading 态，成功后展示一段基于当前回收数据的自然语言摘要文本。
- 生成失败（如 provider 报错）展示失败态 + 重试，不吞掉已有的 Summary/Individual/Report
  三个既有视图的内容。
- 零回收（空态）时不可生成，或生成按钮禁用并给出提示。
- 非 owner／无权限者调用生成接口应被拒绝（复用 F04 已有的结果查看权限校验边界）。
- e2e 验证走 stub provider 确定性模式（参考 `gateway.ts` 的 `stubProvider` +
  `FORCE_FAIL_MARKER`，或 `studioGenerator.ts` 的 sanctioned-stub 写法），不依赖真实
  Anthropic API key 也能在 CI 里跑通。

## 范围与边界
- 本阶段要做：Report 视图新增 AI 摘要生成入口 + 后端路由（复用 `packages/ai` 网关，走
  stub provider 的 e2e 契约，真实 provider 走同一套 `anthropicProvider`）；摘要基于当前
  `survey_responses` 聚合数据生成，不落库持久化（每次生成都是即时请求，除非后续另开
  feature 做"保存摘要历史"）。
- 明确不做：多语言摘要、摘要历史版本管理、定时自动生成、导出 PDF/CSV 里嵌入摘要文本
  （核心导出维持 F04 现状，不依赖 CAP-AI，避免导出路径引入新的失败模式）。

## 已知约束 / 依赖
- 依赖的能力平面：CAP-DATA（F04 已有的结果聚合）+ CAP-AI（`packages/ai` 网关）。
- 依赖 F04（查看答卷与报告，已 passing）。
- 复用 F04 已有的结果查看权限校验（owner/team 权限边界），不新开权限模型。
- 复用 `packages/ai` 现有的 stub provider + force-fail marker 模式做确定性 e2e，不新造
  mock 机制。

## 切分提示
- 期望粒度：一次会话可完成并验证的单个 feature（F07）。
- 优先级：低于核心六件套，但有明确文档依据（F04 notes 里的显式排除项），不是凭空发明。
