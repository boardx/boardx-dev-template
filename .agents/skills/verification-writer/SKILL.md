---
name: verification-writer
description: >
  激活条件：用户提到 写验证、验证命令、断言、怎么测、verification、端到端验证、
  防假阳性、验收命令 等关键词时触发。
  产出可执行的端到端验证命令，作为实现前就定下的「完成契约」。
---

# Verification Writer Skill

## 何时使用

要为一个 feature 写 `verification` 命令时。**这一步发生在写实现代码之前**——
verification 是生成者和评审者共同认可的「完成契约」，先定契约再动手。

> 端到端验证标准见 [testing-standards.md](.harness/instructions/testing-standards.md)。
> 本 skill 提供命令库与防假阳性手法。

---

## 一条合格的 verification 命令

必须满足：
1. **可执行**：复制粘贴就能跑，退出码 0 = 通过、非 0 = 失败。
2. **断言真实出口**：检查 `user_visible_behavior` 描述的可观察结果，不是「跑起来不报错」。
3. **可复现**：在干净环境重跑结果一致，不依赖一次性手工状态。

---

## 命令库（按出口类型）

| 出口 | 模板 |
|------|------|
| HTTP JSON | `curl -sf localhost:3000/api/x \| jq -e '.field == "expected"'` |
| HTTP 状态码 | `test "$(curl -s -o /dev/null -w '%{http_code}' localhost:3000/x)" = "200"` |
| CLI 退出码 | `pnpm harness verify --sprint 01/01 --feature F01` |
| 文件产物 | `test -f dist/out.js && grep -q 'expected' dist/out.js` |
| 日志行 | `grep -q 'server listening' evidence/F01.run.log` |
| 状态转移 | `jq -e '.features[] \| select(.id=="F01") \| .status=="passing"' phases/.../feature_list.json` |
| 证据已入库（L1） | `git cat-file -e HEAD:phases/<phase>/evidence/F01.verify.log` |

**证据入库断言（L1 三连事故的固化）**：verification 数组里应包含一条断言证据文件
真实在 git 树中（如上 `git cat-file -e HEAD:...`），防止 evidence 被 `.gitignore`
挡住变成「指向空气的引用」而无人发现。

---

## 防假阳性（最容易翻车的地方）

> 这些坑直接对应 harness-workflow 里沉淀的「verify:base 空跑成功」教训。

- ❌ `echo TODO && exit 0` —— 占位命令永远绿，等于没验证。
- ❌ `curl localhost:3000/x` 不带 `-f` —— 服务 500 也返回退出码 0。用 `curl -sf`。
- ❌ `grep foo` 不带 `-q` 且不检查退出码 —— 没匹配到也可能被忽略。
- ❌ 断言「不报错」而非断言「正确输出」—— 改用 `jq -e` 断言具体值。
- ✅ 每条命令写完后，**先手动跑一遍并故意制造失败**，确认它真的会变红。

---

## 专项要求

**迁移类 feature（L4，PR #312 事故）**：verification 必须包含 DB 级**全库不变量断言**
（如 `psql -c "select count(*) from ... where <违反不变量>"` 断言 count=0），
且该命令的**原始输出必须留在 evidence 里**。回填/变更目标的判据禁止用 name/自然键
（会误伤用户同名数据），必须用专用标记列（如 `created_by_migration`）。

**契约缺口显式归属（L10）**：`user_visible_behavior` 里暂时无法在本 feature 断言的行，
必须在 notes/spec 注释中写明「由 FXX 交付时断言」，禁止静默跳过。

---

## 产出后

把命令写进 feature 的 `verification` 数组（feature_list.json）。
真正的门控由 `pnpm harness verify` 执行——它跑这些命令、落证据到 `evidence/`、
全绿才把 feature 升 `passing`（不可逆）。需要起服务走活体路径时，交给
**e2e-verifier** subagent。绝不手改 status。
