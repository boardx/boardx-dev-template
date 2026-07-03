---
name: requirement-author
description: >
  激活条件：用户提到 需求、PRD、用户故事、功能定义、验收标准、把想法变成 feature、
  需求澄清、user_visible_behavior 等关键词时触发。
  把模糊需求转成可验证的 feature 三元组（行为 + 可执行验证 + 证据位）。
---

# Requirement Author Skill

## 何时使用

用户给的是「想要什么」的自然语言（PRD / 用户故事 / 一句话需求），
你要把它落成 `feature_list.json` 里可执行、可验证的 feature。

> 规则不在这里复制。feature 的黄金粒度与反模式见 **feature-writing** skill；
> 字段结构见 [feature_list.template.json](.harness/templates/feature_list.template.json)。
> 本 skill 只讲「从模糊到可验证」的转换手法。

## 标准入口：phases/<phase>/requirements/ → feature_list.json

原始需求的固定家是每个阶段的 `phases/<phase>/requirements/` **文件夹**（`new-phase` 自动 scaffold，
内含 `README.md` + 起始 `00-overview.md`）。需求可按领域拆成多份 `*.md`（auth.md / teams.md / rooms.md）。
本 skill 的标准流水线：

1. **读** `phases/<phase>/requirements/` 文件夹里的**全部** `*.md`（跳过 README.md，原始需求、用户故事、验收线索、范围边界）。
2. **澄清**模糊处（用下面的澄清提问清单），不清楚就先问，别硬猜。
3. **转换**成 feature 三元组，**写入**同目录 `phases/<phase>/feature_list.json`。
4. `requirements/` 是输入/上下文，**不改它**；权威产物是 `feature_list.json`。

没有 requirements/ 内容时（用户直接口述需求），也可直接转换，但建议先把原始需求落进
该文件夹留痕，再生成 feature_list，保证可追溯。

### UI 相关阶段（roadmap `has_ui: true`）：UI 先行，确认后才生成

若本阶段是 UI 阶段（`new-phase --ui` 标记），流水线里多一道**前置关卡**（ADR-003）：

1. **先** 由 [ui-prototyper] 把真实 UI 做出来（`apps/web` + mock 数据）→ 人类工程师确认。
2. **只有** `phases/<phase>/ui-signoff.md` 的 `status` 为 `confirmed` 后，你才开始生成 `feature_list.json`。
   未 confirmed 就动手 = 违反关卡（`new-sprint` 也会拒绝开发）。
3. 生成时，**输入不只是 requirements/**，还包括**已确认的真实 UI**：把 `user_visible_behavior` 和
   `verification` **锚定到界面里真实存在的 `data-testid`/元素**（ui-signoff.md 已列出组件落点），
   让验证契约对着已确认的界面，而不是凭空描述。

---

## 转换公式：模糊需求 → feature 三元组

每个 feature 必须同时产出三样东西，缺一不可：

| 三元组 | 问题 | 反面（不可接受） |
|--------|------|----------------|
| `user_visible_behavior` | 用户/系统做什么操作，能观察到什么结果？ | "支持登录"（不可观察） |
| `verification`（可执行命令） | 用什么命令能证明上面这句为真？ | "测试通过"（没给命令） |
| `evidence`（证据落盘位） | 证据写到哪？ | 留空 = 没完成 |

两条附加纪律：
- **证据可入库（L1）**：`evidence` 路径必须能提交进 git 树（不被根 `.gitignore` 挡住，
  如 `*.log` 规则需白名单例外），并建议 verification 里含入库断言
  （`git cat-file -e HEAD:phases/.../evidence/FXX.verify.log`）。指向未入库文件的
  evidence = 指向空气，reviewer 会实测并阻断。
- **契约缺口显式归属（L10）**：`user_visible_behavior` 中暂时无法由本 feature 的
  verification 覆盖的行，必须在 notes 里写明「由 FXX 交付时断言」，禁止静默跳过。

**关键纪律：先有 verification，再谈实现。** verification 是「完成契约」——
实现者和评审者都读它。契约定不下来，说明需求还没想清楚，不要急着写码。
（这条顺序由 [verification-writer] 与 [feature-implementer] 接力执行。）

---

## 澄清提问清单（需求模糊时先问这些）

1. **可观察出口**：成功时用户具体看到/收到什么？（HTTP 响应？文件？日志行？页面元素？）
2. **触发输入**：什么操作触发它？（请求？命令？定时？）
3. **边界**：什么算失败？失败时应该发生什么？
4. **粒度**：能在一次会话内做完并验证吗？不能就拆（见 feature-writing）。

---

## 好 / 坏对照

❌ 坏需求（无法验证）：
```
"系统要有健康检查功能，要稳定可靠。"
```

✅ 转换后（可验证三元组）：
```json
{
  "id": "F03",
  "user_visible_behavior": "GET /api/health 返回 HTTP 200，body 为 {\"ok\":true}",
  "verification": [
    "curl -sf localhost:3000/api/health | jq -e '.ok == true'"
  ],
  "evidence": "evidence/F03.verify.log",
  "owner": null,
  "status": "not_started"
}
```

---

## 产出后

把 feature 写进对应阶段的 `phases/<phase>/feature_list.json`（唯一权威来源）。
不要碰 sprint 的 `active-features.json`（脚本派生的只读视图）。
排期分配交给 [sprint-planner]；验证命令打磨交给 [verification-writer]。
