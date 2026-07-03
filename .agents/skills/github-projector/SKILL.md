---
name: github-projector
description: >
  激活条件：用户提到 GitHub 同步、投影、issue、milestone、sync、把进度发到 GitHub、
  对外可见 等关键词时触发。
  包装 harness sync，确认单向投影结果，判断何时该同步。
---

# GitHub Projector Skill

## 何时使用

需要把仓库内的 feature 状态投影到 GitHub（Milestone / Issue / label）时。

> 核心铁律：**单向投影。文件是唯一事实来源，GitHub 只读、可重建。**
> 绝不从 GitHub 往回改 feature 状态。

---

## 投影映射

| 仓库内 | → GitHub |
|--------|----------|
| phase | Milestone |
| sprint | label `sprint:<phase>-<sprint>` |
| feature | Issue（标题 `[F0X] 标题`，body 含 verification 勾选项） |
| feature.owner | Issue assignee（owner 为 null 则不设） |
| feature.status | label / 关闭动作（按 `github-sync.yaml` 的 status_actions） |

---

## label 纪律（不得制造漂移，见 ADR-004）

- **`status:*` 是互斥生命周期 label**，流转必须与
  [multi-agent-coordination.md](.harness/instructions/multi-agent-coordination.md) 的
  状态机一致（`feature_list.json` 的 `passing` ⇔ `status:merged`）。
  投影只能写规范 label 集合，禁止发明新 label 或复活已废弃的裸 label
  （`in-progress`/`blocked`/`passing`）。
- **`review:*-ok` / `review:changes` 是 reviewer verdict，只能由 coordinator
  编排的 reviewer agent 产出。** 本 skill 的同步动作**绝不**打/摘任何 `review:*` label；
  worker 更不得自打 `review:*-ok`（实战事故：双 coordinator 并行导致两轮 review
  结论冲突，假绿险些放行）。发现 verdict label 与可核验事实（如 evidence 是否在
  git 树中）冲突时，以事实为准并升级给 coordinator，不要用投影"修正"它。

---

## 何时同步（判断）

- ✅ 一个 sprint 的 feature 集合/归属变化后 → 同步，让对外视图跟上。
- ✅ feature 升 `passing` 后 → 同步，关闭对应 Issue。
- ❌ 实现进行到一半、状态没变 → 不必同步，避免噪音。
- 默认只对**当前/近期 sprint** 开 Issue（由 `issue_policy.near_term_window` 控制），
  不要一次性把所有历史 sprint 都投影出去。

---

## 落地命令

```bash
# 先 dry-run，看清楚要执行哪些 gh 操作（不实际改 GitHub）
pnpm harness sync --phase <NN>

# 确认无误后真正执行（需先 gh auth login）
pnpm harness sync --phase <NN> --apply
```

**始终先 dry-run 再 --apply。** 看清楚计划里的每条 gh 命令，确认投影方向对、
assignee 对、不会误关 Issue，再执行。投影是单向的，但误操作仍可能在 GitHub 侧
造成需要手工清理的噪音。
