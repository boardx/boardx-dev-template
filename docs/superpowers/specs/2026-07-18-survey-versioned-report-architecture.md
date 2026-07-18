# Survey Versioned Report Architecture

## Decision

Survey 专业报告采用“版本化事实库快照 + 临时分析工作区 + 不可变报告产物”。
F16 先交付精简 UI、事实库修订和按需生成；F17 在独立 PR 中接入 Deep Agents/LangGraph。

这项拆分让每个 feature 都能独立验收，并避免把 UI、数据迁移、缓存语义和新的 agent runtime
一次性塞进同一个 PR。

## Why

报告不是实时仪表盘。新答卷到达后持续调用模型成本高，也会让同一个报告链接的内容无审计地变化。
专业研究报告更需要稳定事实基础、可追溯假设、明确数据截止点和可复现版本。

公开咨询研究方法强调：

- 建立广泛且一致的事实基础。
- 记录假设，并用新证据持续检验。
- 把分析综合为面向决策的执行摘要。

本设计借鉴这些公开方法，不推断或声称复刻任何机构的内部 AI 技术实现。

## End-to-end Flow

```mermaid
flowchart LR
  A["问卷或答卷变更"] --> B["计算内容哈希"]
  B --> C{"已有相同 sourceRevision?"}
  C -- "是" --> D["复用事实库快照"]
  C -- "否" --> E["创建只读事实库快照"]
  D --> F["显示最近成功报告"]
  E --> F
  F --> G{"报告键命中?"}
  G -- "是" --> H["直接复用报告产物"]
  G -- "否" --> I["标记数据或要求有更新"]
  I --> J{"用户点击生成或更新?"}
  J -- "否" --> F
  J -- "是" --> K["创建生成任务"]
  K --> L["生成并校验证据"]
  L --> M["保存不可变新版本"]
```

## Durable and Ephemeral Boundaries

### Durable

- `sourceRevision` 和 `contentHash`。
- 只读事实库快照及 manifest。
- 报告要求、`requirementHash` 和 `templateVersion`。
- 成功/失败任务元数据。
- 不可变报告版本、证据索引和最近成功版本指针。

### Ephemeral

- 单次生成的分析计划、检索结果、工作笔记和模块中间输出。
- F17 的 LangGraph `StateBackend` 工作区。
- 可由来源修订和要求重新构建，不作为审计事实来源。

因此，并非每次查看或生成报告都重新构建源文件。只有源内容变化才创建新快照；
只有缓存未命中且用户主动生成时才创建临时分析工作区。

## Stable Identities

```text
sourceRevision = hash(schemaVersion + normalizedSurvey + normalizedResponses)
requirementHash = hash(normalizedNaturalLanguageRequirement)
artifactKey = sourceRevision + requirementHash + templateVersion
reportVersion = immutable identifier for a successful generated artifact
```

- 归一化必须稳定排序，避免数据库返回顺序造成无意义新修订。
- 不把 `generatedAt` 放入内容哈希。
- 数据库记录变化但分析语义不变时不应产生新修订。
- 失败任务可以重试，但不能覆盖同键的成功产物。

## F16 Contract

F16 是完整、可独立使用的产品增量：

- 桌面端章节列表、报告要求、报告预览形成清晰的横向工作区。
- 用户只编辑章节标题、一个输出类型和自然语言要求；每章必须且只能输出图片、图表或文本。
- 图表从白名单 Apache ECharts 官方模板中选择，右栏同时提供效果预览和只读 Option JSON。
- 服务端以整份问卷和全部授权答卷创建版本化事实库。
- 新数据只产生 stale 状态；用户主动更新才生成新版本。
- 当前确定性证据聚合器继续生成真实统计和可验证报告。
- 对外暴露稳定的 `FactBaseReader` / `ReportGenerator` 边界，供 F17 替换生成实现。

F16 不引入 LangGraph，避免新 runtime 阻塞 UI 和版本机制交付。

## F17 Contract

F17 在 F16 合并后实现：

- `/source` 只读版本化事实库。
- `/workspace` 任务级临时 StateBackend。
- `/artifacts` 受控持久化报告产物。
- 总控和分析模块按需检索，而不是把所有答卷重复塞入每个模型提示。
- 每条模型结论必须引用可验证 evidence id，并经过服务端确定性校验。

生产环境不使用宿主机 `FilesystemBackend`。Web 服务器使用 StateBackend、StoreBackend
或项目实现的虚拟 backend，避免路径泄漏和跨租户访问。

## UI Information Architecture

### Desktop

```text
| 章节列表 | 报告要求                     | 报告预览                     |
|          | 标题                         | 当前版本 / 数据截止点         |
|          | 图片 / 图表 / 文本（单选）   | 效果预览 / 只读 Option JSON    |
|          | 一段自然语言约束             | 只读章节、证据和限制           |
|          | 保存要求 / 生成或更新报告     | 可折叠版本与生成记录           |
```

### Narrow viewport

```text
章节列表
报告要求
报告预览
版本与生成记录
```

不再展示逐题绑定、可添加问题、自由模块堆叠、可编辑 JSON 映射或常驻聊天栏；每章只保留图片、图表或文本单选。
图表配置只允许白名单 Apache ECharts 官方模板，右栏展示效果预览和只读 Option JSON。

## Data Privacy

- 完整答卷只在服务端授权上下文中读取。
- 快照存储按 survey/team/room 隔离，并记录 source revision。
- 浏览器不接收完整原始答卷。
- 开放题原声在进入报告前匿名化。
- F17 文件工具限制命名空间、路径和读写能力。

## Error Semantics

- 零样本：保留结构，不生成虚构结论。
- 新数据：显示 stale，但继续提供最近成功版本。
- AI 失败：保留确定性统计和最近成功版本。
- 校验失败：拒绝无证据结论，任务标记失败或部分成功。
- 重试：复用 source revision，不重建事实库。

## Feature and PR Boundaries

### F16 PR

- Requirements 15。
- 精简报告编排 UI。
- 事实库版本、产物复用、stale 和版本历史。
- 数据、Web 单元测试和 F16 Playwright 验收。
- PR 只 `Closes` F16 feature issue，并 `Refs #648`。

### F17 PR

- Requirements 16。
- Deep Agents/LangGraph virtual backend。
- 自主检索模块、预算、可观测性和证据校验。
- AI/Web 单元测试和 F17 Playwright 验收。
- F16 合并后复用 Survey 交付 worktree，同步最新 `main` 并切换到独立 F17 分支。
- PR 只 `Closes` F17 feature issue，并 `Refs #648`。

## Rejected Alternatives

### Every report run rebuilds a temporary source file

拒绝。内容未变化时重复构建没有价值，也让审计和缓存困难。临时工作区可以每次创建，
事实库快照必须按内容修订复用。

### Regenerate after every response

拒绝。它会产生不可控模型成本和频繁漂移。新响应只标记 stale，由用户主动更新。

### One PR for UI, versioning, LangGraph and export

拒绝。共享文件多、审查面过大，任何 runtime 问题都会阻塞完整交付。

### Host FilesystemBackend in the Web server

拒绝。宿主路径不适合多租户 Web API。采用受控虚拟 backend。

## Public References

- [McKinsey SCF Insights](https://www.mckinsey.com/capabilities/strategy-and-corporate-finance/how-we-help-clients/scfinsights)
- [How strategy champions win](https://www.mckinsey.com/capabilities/strategy-and-corporate-finance/our-insights/how-strategy-champions-win)
- [McKinsey Strategy](https://www.mckinsey.com/capabilities/strategy-and-corporate-finance/how-we-help-clients/strategy)
- [Putting the A back in FP&A](https://www.mckinsey.com/capabilities/operations/our-insights/putting-the-a-back-in-f-p-and-a)
- [Deep Agents backends](https://docs.langchain.com/oss/javascript/deepagents/backends)
- [Deep Agents customization](https://docs.langchain.com/oss/javascript/deepagents/customization)
- [Deep Agents subagents](https://docs.langchain.com/oss/javascript/deepagents/subagents)
