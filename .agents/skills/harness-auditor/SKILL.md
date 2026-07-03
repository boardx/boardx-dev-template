---
name: harness-auditor
description: >
  激活条件：用户提到 评估 harness、审计系统、控制平面、harness 健康度、五子系统、
  控制变量实验、脚手架是否还需要 等关键词时触发。
  用五子系统给 harness 自身打分，跑承重测试，定位最弱子系统。
---

# Harness Auditor Skill（元层）

## 何时使用

要评估 harness 控制平面**自身**是否健康、是否过度工程时。这是元层 skill——
被审计的对象是 `.harness/` 本身，不是某个 feature。

> 这是「用 skill-creator 方法论维护的元层」。重活/写快照交给 **quality-auditor** subagent；
> 本 skill 提供评估框架。

---

## 五子系统打分（每维 0–2）

| 子系统 | 健康标志 | 不健康信号 |
|--------|---------|-----------|
| 指令（instructions/AGENTS.md） | 简洁、分层、按需加载 | 堆成百科、规则重复、没人读 |
| 模板（templates） | 用了就对、字段对齐 types | 模板和实际产物漂移 |
| 状态（state/feature_list） | 真实反映 passing 边界 | 假 passing、手改痕迹 |
| 脚本（scripts） | 命令可跑、错误结构化 | 空跑成功、裸 throw |
| 验证（verify/rubrics） | 门控真拦得住、证据齐 | verify 空绿、无 evidence |

给每维打分，**定位最弱子系统**，改进从最弱处下手。

---

## 承重测试（文章核心原则）

> 「每个 harness 组件都编码了一条关于模型局限的假设。定期逐个移除组件，
> 验证它是否仍然承重。模型变强后，删掉不再承重的脚手架。」

做法——**一次只改一个变量**：

1. 选一个怀疑冗余的脚手架（某条指令 / 某个门控 / 某个 subagent）。
2. 临时移除或关闭它。
3. 跑验证（`pnpm harness verify` + 一个代表性 feature），看结果是否变化。
4. 判定：
   - 结果变差 → **承重，保留**。
   - 结果不变 → 候选冗余，记进 quality 快照，考虑删除。
5. 恢复变量，一次只测一个，避免互相干扰。

**注意方向**：不是无脑加脚手架。文章明确——任务若已在模型稳定能力范围内，
就不该叠验证开销。harness 应随模型变强而**变瘦**。

### 承重测试固定用例：门控绕过类事故（真实发生过，每次审计必跑）

模拟以下攻击路径，验证现有流程**能否拦截**（拦不住 = 对应子系统扣分）：

1. **手改 passing + evidence 不入库**：在分支上直接把 feature_list.json 的
   `status` 改成 `passing`，evidence 指向一个被 `.gitignore` 挡住的 `*.log` 路径
   （`git ls-tree HEAD -- <路径>` 为空）。审查/verify 环节是否会质询"未经
   `pnpm harness verify` 门控"并阻断？reviewer 是否实测 evidence blob 在树中，
   而非轻信 diff/progress 的声称？
2. **status/owner/evidence 出现在 PR diff 中**：这类字段的手改是否被视为嫌疑并阻断？
3. **verdict 越权**：worker 自打 `review:*-ok`、或第二个 coordinator 并行给出
   冲突结论时，流程是否以可核验事实（git ls-tree 实测）为准而非打分/声称？

三条任何一条能溜过去，说明验证/状态子系统**不承重的是流程而非脚手架**——
这时该加固门控，而不是删脚手架。

---

## 产出

把打分、最弱子系统、承重测试结论交给 **quality-auditor** subagent 写入
`.harness/state/quality-document.md`，保留历史快照以便看趋势。
本 skill 不直接改任何 feature 状态或实现代码。
