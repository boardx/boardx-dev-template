---
name: session-closer
description: >
  激活条件：用户提到 收尾、关闭会话、结束、done、交接、下一轮、干净状态、
  写 handoff、progress 等关键词时触发。
  按 clean-state-checklist 干净收尾，写 handoff，确保下一轮全新上下文能仅靠仓库续上。
---

# Session Closer Skill

## 何时使用

一轮会话结束前。目标：让**下一轮以全新上下文启动的 agent，仅凭仓库内文件就能无缝续上**，
无需任何口头补充。

> 收尾方法论与写作模板见 **session-handoff** skill。
> 本 skill 是「关闭动作清单」。

---

## 为什么是「全新上下文」而非「带着记忆继续」

文章原则：长任务用**上下文重置 + 结构化交接产物**，而不是把旧对话压缩着拖下去
（压缩会诱发「context anxiety」，模型临近上限会草草收尾）。
所以收尾质量 = 下一轮的启动质量。**你写进仓库的，才是下一轮唯一能看到的。**

---

## 关闭动作清单

```bash
# 1. 逐项过干净状态检查清单
cat .harness/rubrics/clean-state-checklist.md
```

2. **更新 `progress.md`**：本轮目标、完成项、未完项、下一步。
3. **写 `session-handoff.md`**：下一步动作具体到**命令级别**（能直接复制粘贴跑），
   不是「继续做 F03」而是「跑 `pnpm harness verify --sprint 01/01 --feature F03`，若 X 则 Y」。
4. **状态真实性**：feature 清单如实反映 passing / 未验证边界，**没有假 passing**。
5. **无未记录的半成品**：任何「代码写了没验证」的中间态都要在 handoff 里写明。
6. **证据文件在 git 树中（硬项，L1 三连事故）**：

```bash
git ls-tree HEAD -- phases/**/evidence/
```

   本轮引用的每个 evidence 路径都必须出现在输出中且 blob 非空。
   被根 `.gitignore`（如 `*.log`）挡住 = 异常，立即上报，**禁止以「本地留存」收尾**。

```bash
# 6. 基础路径仍可用（收尾前最后一道）
pnpm -w run verify:base
```

---

## 收尾自检（任一为否则没收干净）

- [ ] 新 agent 只读 `progress.md` + `session-handoff.md` 就知道下一步该跑什么命令？
- [ ] `verify:base` 仍绿？
- [ ] 没有 feature 处于未记录的中间态？
- [ ] 没有手改过 status 或 `active-features.json`？
- [ ] evidence 文件经 `git ls-tree HEAD` 实测在 git 树中且非空？
- [ ] 起的服务/后台进程都收掉了？
- [ ] push 成功？（fresh worktree 的 pre-push 会因缺 node_modules 报 turbo not found：
      纯文档/配置改动可 `git push --no-verify` 并写明理由；代码改动必须先装依赖跑过再推）

全部 ✅ 才能结束本轮。
