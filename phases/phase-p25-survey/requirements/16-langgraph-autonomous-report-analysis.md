# 16 - LangGraph 自主报告分析文件系统

## 事实来源

- 用户于 2026-07-18 确认：整份问卷和全部答卷应作为一个事实库文件交给报告系统，
  各报告模块按需求自主读取所需内容，不再由用户逐题绑定数据。
- 用户指定采用 LangGraph 文件系统能力。
- 本 feature 依赖 F16 的版本化事实库、报告要求和产物版本契约。
- Umbrella issue：`boardx/boardx-dev-template#648`。本 feature 使用独立 feature issue、
  独立 worktree 和独立 Delivery PR，且仅在 F16 合并后开工。

## 目标

把 F16 的只读事实库快照挂载为 Deep Agents/LangGraph 虚拟文件系统，由报告总控和专业分析模块
按自然语言要求自主检索证据、形成结构化章节，并在进入报告产物前通过确定性校验。

## 文件系统模型

### `/source` - 只读、版本化

- `/source/survey-source.jsonl`：问卷、题目、匿名化答卷和统计口径的完整事实库。
- `/source/manifest.json`：`sourceRevision`、哈希、schema、样本量和生成时间。
- 同一报告任务内不可修改；任务间通过修订号引用同一持久化快照。

### `/workspace` - 临时分析空间

- 每次真正生成报告时创建一个任务级 `StateBackend` 工作区。
- 分析模块可写入中间提纲、假设、查询结果和证据索引。
- 任务结束后可丢弃；它不是事实来源，也不作为报告历史的唯一存储。

### `/artifacts` - 持久化产物

- 保存通过校验的结构化报告、证据清单、生成日志摘要和版本元数据。
- 由 F16 的产物键和版本契约管理，失败任务不得覆盖成功产物。

## Agent 结构

- `report-orchestrator`：解析自然语言要求、生成分析计划、分派模块、合并执行摘要。
- `sample-methodology`：样本、完成率、缺失、偏差和方法限制。
- `quantitative-analysis`：单选、多选、评分、NPS、数值题及必要交叉分析。
- `qualitative-analysis`：开放题主题、匿名原声、反例和未归类比例。
- `executive-synthesis`：把已验证证据组织为结论、决策影响和行动建议。

模块通过文件工具按需使用 `read_file`、`grep` 等检索 `/source`，不把整份事实库复制进每个
子模块提示。模块输出严格结构化结果和证据引用，不直接写最终报告。

## 生成与校验流程

1. F16 根据产物键判断是否已有可复用报告；命中时不启动 agent。
2. 未命中且用户主动生成时，创建任务级 `/workspace` 并挂载对应 `/source`。
3. 总控根据报告要求产生分析计划，模块自主检索事实库。
4. 服务端校验每条结论的 evidence id、数值、分母、题目口径和来源修订。
5. 无效或不可追溯结论被拒绝；有效结果合并为报告文档。
6. 成功结果写入 `/artifacts`；临时工作区释放。

## 技术约束

- 生产 Web/API 运行时不得使用指向宿主机路径的 `FilesystemBackend`。
- 使用 `StateBackend`、`StoreBackend` 或仓库实现的受控虚拟 backend。
- 所有路径限制在任务命名空间，禁止 `..`、绝对宿主路径或跨问卷访问。
- 模型必须经过 `packages/ai` 的 provider/gateway；测试使用确定性模型和内存 backend。
- 工具调用、模块耗时、token/模型用量、证据校验失败和重试需要结构化可观测性。
- 达到调用、token 或时间预算时停止扩张并返回部分可验证结果，不无限循环。

## 专业报告约束

- 采用“问题界定 -> 一致事实基础 -> 假设与分析 -> 证据校验 -> 执行摘要”的方法。
- 结论顺序为“结论、证据、限制、行动”，避免只罗列图表。
- 不把相关性写成因果，不在小样本上做强结论，不补造缺失数据。
- AI 失败时，F16 的真实统计和最近成功报告仍可使用。

## F17 范围

- 引入并封装 Deep Agents/LangGraph virtual backend。
- 实现报告总控、专业分析模块、文件检索工具、预算和证据校验。
- 把生成路径接到 F16 的事实库与报告产物接口。

## 非范围

- 不重新设计 F16 已确认的报告编排器 UI。
- 不改变事实库修订、产物复用或版本历史规则。
- 不在本 feature 实现 F13 的专业导出。

## 验收

- 生成任务能从只读 `/source/survey-source.jsonl` 自主检索跨题证据。
- 子模块只接收任务与检索结果，不默认接收全部原始答卷。
- 路径穿越、跨问卷读取和写入 `/source` 均被拒绝。
- 相同产物键命中缓存时不创建 LangGraph 运行。
- 证据引用或数值校验失败的结论不进入成功报告。
- 超时、预算耗尽和模型失败均产生可恢复状态，并保留最近成功版本。
- `pnpm --filter @repo/ai run test -- survey-report-agent`
- `pnpm --filter @repo/ai run typecheck`
- `pnpm --filter @repo/web run test -- survey-report`
- `pnpm --filter @repo/web run typecheck`
- `pnpm --filter @repo/web exec playwright test e2e/survey-p25-017-langgraph-report-analysis.spec.ts`
- `pnpm harness doctor --phase p25`
