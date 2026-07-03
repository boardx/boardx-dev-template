---
name: sprint-planner
description: >
  激活条件：用户提到 规划、sprint、排期、分配 feature、切 sprint、依赖、并行、
  迭代计划、new-sprint 等关键词时触发。
  把 feature_list 切成可执行的 sprint，处理依赖与并行，包装 harness new-sprint。
---

# Sprint Planner Skill

## 何时使用

一批 feature 已经写好（见 [requirement-author]），需要排成可执行的 sprint 时。

> feature 粒度标准见 **feature-writing**；本 skill 讲「怎么切、怎么排、怎么并行」。

---

## 切 sprint 的启发式

| 原则 | 说明 |
|------|------|
| **一个 sprint = 一个可交付的连贯目标** | 不是「这周能做多少塞多少」，而是「做完能验证出一个完整能力」 |
| **按依赖拓扑排序** | 被依赖的 feature 先做；A 的产物是 B 的输入 → A 进更早的 sprint |
| **同 sprint 内尽量解耦** | 同 sprint 的 feature 之间最好无强依赖，方便并行与独立验证 |
| **优先级 + 风险前置** | 高风险/高不确定的 feature 早做，早暴露问题 |

---

## 依赖与并行处理

1. **画依赖**：列出 feature 间的「谁依赖谁」。有环 → 需求没切干净，回 requirement-author。
2. **分层**：无依赖的进第一层，可并行。
3. **并行靠 owner**：同一 sprint 内要并行时，用 owner 字段分给不同 agent，
   每个 owner 各自最多一个 in_progress（见 [feature-implementer] 的 claim 流程）。

### 多 agent 并行分派纪律（实战教训，必查）

- **同文件热点串行化**：两个 feature 会改**同一个文件**（尤其共享页面/共享 spec）时，
  不得同 wave 派发——必须等前一个 PR 合并后再派下一个。派发前先比对各 feature
  预计触碰的文件清单，有交集即串行。
  （反例：两个 PR 并行改同一 `rooms/page.tsx`，后合者被迫返工。）
- **合并顺序按"动共享 spec 多的最后合"**：并行 wave 收尾时，改共享测试/spec 文件
  最少的 PR 先合，动共享 spec 最多的最后合，把 rebase 冲突集中到一处。
- **认领双写**：分派时 `harness claim` 与 issue label（`status:in-progress` + `agent:<id>`）
  必须同时落，lease 靠评论定期刷新（见 multi-agent-coordination.md §4）。

---

## 落地命令

```bash
# 切一个 sprint，并把 feature 分配进来
pnpm harness new-sprint --phase <NN> --id <MM> --goal "<连贯目标>" --features F01,F02

# 已 passing 的 feature 不会被重新分配（passing 归属不可变，命令会自动跳过并告警）
```

`new-sprint` 会：
1. 把指定 feature 的 `sprint` 字段写进 `feature_list.json`（唯一权威来源）。
2. 派生 `active-features.json`（只读视图，**禁止手改**）。
3. 生成 sprint 目录骨架（progress / handoff 模板 + `evidence/`）。

---

## 产出后

每个 sprint 同一时刻只推进一个（或每 owner 一个）in_progress feature。
实现交给 [feature-implementer]，验证走 `pnpm harness verify --sprint <NN>/<MM>`。
不要在这里手改任何状态字段。
