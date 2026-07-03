---
name: feature-implementer
description: >
  激活条件：用户提到 实现、开发、写代码、做 feature、in_progress、开始干活、
  把 feature 做出来 等关键词时触发。
  固化 AGENTS.md 工作流：只做一个 feature、先有验证再写码、自测留证据、干净收尾。
---

# Feature Implementer Skill

## 何时使用

要动手实现一个 feature 时。本 skill 把 AGENTS.md 的「开工流程 + 硬约束」
落成可执行步骤。

> 编码规范见 [coding-standards.md](.harness/instructions/coding-standards.md)。
> 本 skill 只讲实现者的纪律与顺序。

---

## 实现者五步

```bash
# 1. 锁定唯一目标 feature（只能有一个 in_progress）
cat phases/<phase>/sprints/sprint-<MM>/active-features.json \
  | jq '[.features[] | select(.status=="in_progress")]'
```

2. **先确认「完成契约」存在**：这个 feature 的 `verification` 命令必须已经写好。
   没有就先停下，回到 [verification-writer] 把契约定下来——**绝不先写实现再补验证**
   （那是自我背书，文章明确反对生成者给自己定标准）。

3. **只写满足契约的最小实现**。范围纪律见下表，别顺手重构无关区域。

4. **自测留证据**：本地逐条跑 `verification`，把输出留到 `evidence/`。
   长输出/起服务的活体验证，委托 **test-runner** / **e2e-verifier** subagent，
   别让冗长日志污染主线程。
   **证据必须入库**（PR #310/#311/#312 教训）：提交后用
   `git ls-tree HEAD -- phases/**/evidence/` 实测文件在 git 树中且非空；
   被 `.gitignore` 挡住是异常，立即上报，禁止「本地留存」。

5. **收尾**：交给 [session-closer]。

---

## 范围纪律 checklist

| 检查 | 红线 |
|------|------|
| 只动当前 feature 涉及的文件？ | 顺手改无关文件 = 引入未验证改动 |
| 没碰 `active-features.json`？ | 它是脚本派生只读视图 |
| 没手改 status 成 passing？ | 只有 `pnpm harness verify` 能升级状态 |
| status/owner/evidence 字段没出现在手写 diff 里？ | 出现即 review 阻断嫌疑（L2） |
| 没跨包深路径 import？ | 走包的公共入口 |
| 错误用结构化返回（非裸 throw）？ | 见 coding-standards |
| 500 分支没把 `String(err)` 回给客户端？ | 错误响应用通用文案，详情 `console.error` 落服务端日志（PR #310 教训） |
| e2e/fixture 没有 `any`？ | 用 `Page`、`PlaywrightWorkerArgs["playwright"]`，禁 `(page: any)` |

---

## 返工 PR 最小化（正面案例 PR #314）

review 打回后的返工只包含：**review 要求项的修复 + 必要证据**，不顺手带无关改动。
在 PR 描述里给出「逐条修复映射表」（review 意见 → 对应 commit/文件），reviewer 会核对。

---

## 完成的硬定义（来自 AGENTS.md，不可放宽）

一个 feature 只有同时满足才算 `passing`：
1. `user_visible_behavior` 端到端真实可见、可复现。
2. 每条 `verification` 命令退出码 0。
3. 证据已写入 `evidence/`。
4. `./init.sh` 基础验证仍通过，没引入新失败。

**没有证据 = 没有完成。**「代码写完了」「看起来能跑」都不算。

---

## 多 agent 并行（owner）

并行模式下用 `pnpm harness claim --phase NN --feature F0X --owner <id>` 认领，
每个 owner 各自最多一个 in_progress。认领后只做自己那一个。
