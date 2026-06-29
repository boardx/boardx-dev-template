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

## 标准入口：phases/<phase>/requirements.md → feature_list.json

原始需求的固定家是每个阶段的 `phases/<phase>/requirements.md`（`new-phase` 自动 scaffold）。
本 skill 的标准流水线：

1. **读** `phases/<phase>/requirements.md`（原始需求、用户故事、验收线索、范围边界）。
2. **澄清**模糊处（用下面的澄清提问清单），不清楚就先问，别硬猜。
3. **转换**成 feature 三元组，**写入**同目录 `phases/<phase>/feature_list.json`。
4. `requirements.md` 是输入/上下文，**不改它**；权威产物是 `feature_list.json`。

没有 requirements.md 时（用户直接口述需求），也可直接转换，但建议先把原始需求落进
requirements.md 留痕，再生成 feature_list，保证可追溯。

---

## 转换公式：模糊需求 → feature 三元组

每个 feature 必须同时产出三样东西，缺一不可：

| 三元组 | 问题 | 反面（不可接受） |
|--------|------|----------------|
| `user_visible_behavior` | 用户/系统做什么操作，能观察到什么结果？ | "支持登录"（不可观察） |
| `verification`（可执行命令） | 用什么命令能证明上面这句为真？ | "测试通过"（没给命令） |
| `evidence`（证据落盘位） | 证据写到哪？ | 留空 = 没完成 |

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
