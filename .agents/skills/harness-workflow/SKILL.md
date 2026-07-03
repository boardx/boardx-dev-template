---
name: harness-workflow
description: >
  激活条件：用户提到 harness、新功能、开工流程、feature、sprint、phase、verify、passing、
  证据落盘、干净收尾、会话交接 等关键词时触发。
  提供完整的 harness engineering 工作流：开工→执行→验证→收尾。
---

# Harness Workflow Skill

## 何时使用

你正在这个 monorepo 中开发新功能时，始终按本 skill 的流程操作。

---

## 开工三步（每个新会话必做）

```bash
# Step 1: 初始化环境（依赖 + 基础验证）
./init.sh

# Step 2: 读当前 sprint 状态
cat phases/phase-<NN>-*/sprints/sprint-<MM>/progress.md
cat phases/phase-<NN>-*/sprints/sprint-<MM>/session-handoff.md

# Step 3: 找到唯一 in_progress 的 feature
cat phases/phase-<NN>-*/sprints/sprint-<MM>/active-features.json | jq '[.features[] | select(.status=="in_progress")]'
```

**规则：只做那一个 feature。没有 in_progress？先问用户要做哪个，再用 harness 开新 sprint。**

---

## 执行中的纪律

| 纪律 | 原因 |
|------|------|
| 只动当前 feature 涉及的代码 | 范围纪律 — 顺手重构 = 引入未经验证的改动 |
| 每次改完立刻局部验证 | 不要攒到最后一起 verify，失败难定位 |
| 不要手改 `active-features.json` | 它是脚本派生的只读视图 |
| 不要自己把 status 改成 passing | 只有 `pnpm harness verify` 能做这件事 |
| status/owner/evidence 字段**严禁出现在你手写的 diff 里** | PR #310/#311/#312 三连事故：diff 里手改 status = review 直接阻断 |
| 多 agent 并行时认领**双写** | `pnpm harness claim` + issue label 同时打；长任务定期用 lease 评论刷新认领，防止被判失联重派 |

---

## 验证门控（唯一合法路径）

```bash
# 验证当前 sprint 的所有 feature
pnpm harness verify --sprint <NN>/<MM>

# 只验证一个 feature
pnpm harness verify --sprint <NN>/<MM> --feature F01
```

verify 会：
1. 逐条执行 `feature.verification` 中的命令
2. 运行 `pnpm -w run verify:base`（基础验证必须通过）
3. 把命令输出写入 `evidence/F<NN>.verify.log`
4. 全部通过后把 feature 升为 `passing`（不可逆）

---

## 干净收尾（每个会话结束前）

```bash
# 对照检查清单逐项过一遍
cat .harness/rubrics/clean-state-checklist.md
```

```bash
# 证据入库自查（L1，收尾前必跑）：evidence 必须真实在 git 树中
git ls-tree HEAD -- phases/**/evidence/
```
- 上述命令必须列出本轮引用的每个 evidence 文件且 blob 非空；
  被根 `.gitignore`（如 `*.log`）挡住 = 异常，**立即上报**，禁止写「本地留存」蒙混。

必须确认：
- `progress.md` 已更新（写本轮目标、完成项、下一步）
- `session-handoff.md` 已更新（具体到命令级别的下一步动作）
- 没有 feature 处于"代码写了但没 verify"的中间态
- `pnpm -w run verify:base` 仍然通过

---

## 常用命令速查

```bash
# 新建阶段
pnpm harness new-phase --id 03 --name "my-feature" --goal "..."

# 新建 sprint，把 feature 分配进去
pnpm harness new-sprint --phase 03 --id 01 --goal "..." --features F01,F02

# 验证
pnpm harness verify --sprint 03/01

# GitHub 同步（dry-run）
pnpm harness sync --phase 03
# 真正执行（需要 gh auth login）
pnpm harness sync --phase 03 --apply

# 查看总进度
cat .harness/state/PROGRESS.md
```

---

## 经验教训（从 Phase 01 沉淀）

> **陷阱 1**：`verify:base` 空跑成功  
> 子包的 `package.json` 里 scripts 是 `echo TODO`，turbo 跑了个寂寞。  
> **防护**：每个子包必须有真实的 `vitest run`/`tsc --noEmit`，不接受 echo 占位。

> **陷阱 2**：config 是假文档  
> `harness.config.yaml` 的配置没有接入运行时，改了 yaml 对行为零影响。  
> **防护**：所有可配置行为必须通过 `loadHarnessConfig()` 读取，不能硬编码。

> **陷阱 3**：passing 状态被手动篡改  
> 直接编辑 `feature_list.json` 把 status 改成 passing 绕过了验证门控。  
> **防护**：pre-commit hook 检测 passing 状态变更，要求必须有 evidence 文件。

> **陷阱 4**（PR #310/#311/#312 三连事故）：evidence 是「指向空气的引用」  
> feature_list 指向 `evidence/*.verify.log`，但文件被根 `.gitignore` 的 `*.log` 挡住没进仓库。  
> **防护**：收尾前 `git ls-tree HEAD -- phases/**/evidence/` 实测；reviewer 也会实测，不信声称。

> **陷阱 5**：fresh worktree 的 pre-push hook 失败（turbo not found）  
> 无 node_modules 的 worktree 直接 push 会被 pre-push 拦。  
> **防护**：纯文档/配置改动可 `git push --no-verify`（commit message 写明理由）；
> 代码改动必须先 `pnpm install` 并本地跑过验证再推。
