---
name: session-handoff
description: >
  激活条件：用户提到收尾、交接、下一轮、session、handoff、会话结束、
  干净状态、progress、session-handoff 等关键词时触发。
  提供干净会话收尾的完整方法论和写作模板。
---

# Session Handoff Skill

## 为什么收尾比开工更重要

一次糟糕的收尾会让下一轮 agent（或你自己）从"破损状态"开始工作，浪费 20-30 分钟修复上下文。  
**"无需人工修复即可继续"是唯一可接受的收尾标准。**

---

## 收尾流程（逐步执行）

### Step 1：验证基础状态

```bash
# 基础验证必须通过（这是底线）
pnpm -w run verify:base

# 如果有 in_progress 的 feature，运行 verify 看是否能升 passing
pnpm harness verify --sprint <NN>/<MM>
```

### Step 2：对照检查清单

```bash
cat .harness/rubrics/clean-state-checklist.md
```

逐项检查（不是快速扫一眼）：
- [ ] `pnpm -w run dev` 路径仍然可用
- [ ] `pnpm -w run verify:base` 通过
- [ ] `progress.md` 已更新
- [ ] `session-handoff.md` 已更新
- [ ] 没有假 passing（每个 passing feature 都有 evidence 文件）
- [ ] evidence 文件已入 git 树（`git ls-tree HEAD -- phases/**/evidence/` 实测非空，
      不是仅存在于工作区/被 `.gitignore` 挡住）
- [ ] 没有半成品（要么 passing，要么 in_progress 且有说明）
- [ ] 同一时刻只有一个 feature 处于 in_progress
- [ ] 关键运行输出已归档到 `evidence/`

### Step 3：更新 progress.md

```markdown
### <日期时间>
- 本轮目标：<具体说做了什么>
- 已完成：<F01 passing（通过 verify）/ 修复了 X bug / 新增了 Y 文件>
- 运行过的验证：<列出跑过的命令>
- 已记录证据：<evidence/F01.verify.log>
- 提交记录：<git commit hash 或 "未提交">
- 已知风险或未解决问题：<无 / 描述>
- 下一步最佳动作：<具体命令，不是"继续做 F02"这种模糊描述>
```

### Step 4：更新 session-handoff.md

**关键原则：下一步动作必须具体到命令级别**

```markdown
## 当前已验证
- F01 passing — evidence/F01.verify.log @ 2026-06-29T...
- F02 passing — evidence/F02.verify.log @ 2026-06-29T...

> handoff 里引用的每个 evidence 路径**必须是已提交进 git 树的路径**
> （写之前 `git ls-tree HEAD -- <路径>` 实测）。禁止写「本地留存」「见本地日志」——
> 下一轮全新上下文只看得到仓库，指向未入库文件的引用就是指向空气（PR #310/#311/#312 事故）。

## 本轮改动
- 修改了 packages/memory/src/index.ts（新增 DurableMemory.findByTag）
- 修改了 packages/tools/src/index.ts（修复 ShellTool 超时处理）

## 仍损坏或未验证
- F03 in_progress — pnpm test 跑到一半，orchestrator.test.ts:42 失败
- 原因：memory 的临时目录清理有竞争条件

## 下一步最佳动作
1. `cd /path/to/repo && ./init.sh`
2. `pnpm harness verify --sprint 01/01 --feature F03` 查看当前失败原因
3. 修复 apps/orchestrator/src/orchestrator.test.ts:42 的竞争条件
4. 不要动 F01/F02，它们已经 passing

## 命令
- 验证: `pnpm harness verify --sprint 01/01`
- 测试单包: `pnpm --filter @repo/memory test`
- 调试特定测试: `pnpm --filter @repo/orchestrator test -- --reporter=verbose`
```

---

## 常见收尾错误

| 错误 | 影响 | 正确做法 |
|------|------|---------|
| "下一步继续做 F03" | 下轮 agent 不知道从哪行代码开始 | 写具体到命令的下一步 |
| 不更新 progress.md | 上下文断裂，下轮从头分析 | 每轮必须更新，哪怕几行 |
| 把失败的测试"暂时注释掉" | 留下未记录的半成品 | 要么修复，要么在 notes 里记录原因 |
| verify:base 失败但继续收尾 | 下轮从破损状态开始 | 先修基础状态 |
| evidence 写"本地留存"或指向未入库文件 | 下轮/reviewer 看到的是空气引用 | 证据文件提交进 git 树后再引用 |
| 把 not_started 的 feature 标 in_progress | 超过单一 in_progress 约束 | 一次只做一个 |

---

## 快速收尾模板（时间不够时的最低标准）

```bash
# 运行完这三条才能离开
pnpm -w run verify:base && \
pnpm harness verify --sprint <NN>/<MM> && \
echo "收尾验证通过"
```

然后至少写：
```markdown
# session-handoff.md 最低版本
## 当前状态
- F01 [passing/in_progress/not_started]
## 下一步
- <一条具体命令>
## 注意
- <一个已知风险>
```

---

## 跨项目（template）收尾额外检查

如果这个 monorepo 是用于孵化新项目的模板：

- [ ] 所有 placeholder（`your-org/my-monorepo`、`my-monorepo` 项目名等）已更新或有说明
- [ ] `.agents/skills/` 中的 skill 是否需要根据本项目经验更新
- [ ] `harness.config.yaml` 中的路径是否与实际项目结构匹配
- [ ] `README.md` 是否反映了当前实际可用的状态
