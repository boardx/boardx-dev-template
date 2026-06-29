# 可观测性约定

> 对应 L11「让 agent 的运行过程可观测」。可观测性属于 harness 的一部分,不是事后补丁。

## 三件套
- 日志:结构化 JSON,带 task_id / session_id / feature_id。
- 指标:每个推理回合的步数、工具调用次数、耗时、失败率。
- 追踪:plan→act→observe 每步可串联,便于定位"卡在哪一步"。

## 证据落盘
- agent 在 sprint 内产生的关键运行输出写入 `sprints/<sprint>/evidence/`。
- verify 脚本的命令输出自动归档到 evidence,作为 feature.evidence 的来源。

## 归因优先
- 失败时先看追踪/日志做原因归因(任务不清 / 上下文不足 / 环境不可复现 /
  验证缺失 / 状态断裂),再决定改 harness 的哪个子系统。
