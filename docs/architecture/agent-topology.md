# 智能体拓扑

```
          ┌─────────────────────┐
  Task ──▶│   orchestrator      │  规划 / 调度 / 汇总
          └──────────┬──────────┘
                     │ 调用
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   agent-core      tools        memory
  (推理循环)    (最小权限能力)  (三层记忆)
        │            │            │
        └──── observe 回灌 ───────┘
```

- **agent-core**:plan→act→observe 循环,产出动作与停止判据。
- **tools**:契约式工具,结构化错误返回。
- **memory**:working/session/durable;durable 可序列化、可恢复。

详细约定见 `.harness/instructions/agentic-patterns.md`。
