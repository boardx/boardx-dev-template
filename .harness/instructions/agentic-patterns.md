# 智能体编排 / 工具 / 记忆约定

## 编排(orchestrator)
- 单一编排入口,任务以显式 Task 对象进入,带 id、目标、验收标准。
- 规划与执行分离:planner 产出步骤,executor 执行,二者不耦合。

## 工具(tools)
- 每个工具 = 纯函数式契约:输入 schema、输出 schema、副作用声明、权限级别。
- 最小权限:新增工具需声明它"能做什么、不能做什么",登记到工具清单。
- 工具错误必须结构化返回,不抛裸异常给推理循环。

## 记忆(memory)
- 三层:working(本回合)、session(本会话)、durable(跨会话持久)。
- durable 必须可序列化、可恢复;恢复路径要在 `progress.md` 可读。

## "干活的人 / 检查的人"分离
- 生成代码的 agent 与评审代码的 evaluator 用不同的上下文/提示,避免自我背书。
  评审走 `.harness/rubrics/evaluator-rubric.md`。
