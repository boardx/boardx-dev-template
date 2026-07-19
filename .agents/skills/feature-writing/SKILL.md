---
name: feature-writing
description: >
  激活条件：用户提到写 feature、feature_list、定义功能、feature 粒度、
  user_visible_behavior、verification 命令、功能拆分 等关键词时触发。
  提供 feature 定义的黄金标准和常见反模式。
---

# Feature Writing Skill

## Feature 的黄金粒度

**一个 feature = 一次 agent 会话能完成并验证的工作单元**

太大 → 会话超时，中途无法交接  
太小 → 交接成本高于开发成本

经验值：4-8 小时人工等效工作量。

---

## user_visible_behavior 写法

**公式**：`[用户/系统] [做了什么操作] 时，[产生什么可观察的结果]`

✅ 好的写法：
```
"GET /api/health 返回 HTTP 200 且 body 为 {\"ok\": true}"
"pnpm harness verify --sprint 01/01 执行完毕，F01 状态变为 passing"
"用户在浏览器访问 localhost:3000，页面标题显示 'Orchestrator Dashboard'"
```

❌ 差的写法：
```
"实现健康检查"          # 太模糊，无法验证
"完成 memory 模块"      # 不描述用户可见行为
"代码写完并通过审查"    # 审查不是端到端行为
```

---

## verification 命令写法

**每条命令 = 一个 shell 断言，exit 0 = 通过**

### 层级选择（优先高层）

| 优先级 | 类型 | 示例 |
|--------|------|------|
| ⭐⭐⭐ | HTTP 断言 | `curl -sf localhost:3000/health \| jq -e '.ok==true'` |
| ⭐⭐⭐ | 行为输出断言 | `tsx src/main.ts --task-id T01 \| grep "status=done"` |
| ⭐⭐ | 文件内容断言 | `jq -e '.features[0].status=="passing"' feature_list.json` |
| ⭐ | 文件存在检查 | `test -f package.json` |
| ❌ | 无断言检查 | `pnpm build`（成功≠行为正确） |

### 常用断言模板

```bash
# HTTP 状态 + 响应体
curl -sf http://localhost:3000/api/health | jq -e '.ok == true'

# 命令输出包含关键字
tsx apps/orchestrator/src/main.ts --goal "test" 2>&1 | grep -q "status=done"

# JSON 字段验证
node -e "const p=require('./package.json'); if(!p.scripts.harness) process.exit(1)"

# 文件存在 + 可执行
test -f AGENTS.md && test -x init.sh

# 数值比较
[ $(jq '[.features[] | select(.status=="passing")] | length' feature_list.json) -gt 0 ]
```

---

## feature_list.json 结构

```json
{
  "id": "F04",
  "priority": 4,
  "area": "orchestrator",
  "title": "简短动词短语（<50字）",
  "spec_ref": "<requirements 下文件名>.md#R<n>",
  "user_visible_behavior": "完整的可观察行为描述（1-3句）",
  "status": "not_started",
  "sprint": null,
  "verification": [
    "从用户角度断言的 shell 命令 1",
    "从用户角度断言的 shell 命令 2"
  ],
  "evidence": "",
  "notes": "补充说明、依赖关系、注意事项"
}
```

**字段约定：**
- `id`：`F` + 两位数字，全 phase 唯一
- `spec_ref`：**必填**（2026-07-19 起，机械门控）。指向 `requirements/` 下具体
  章节，格式 `<文件名>.md#R<n>`。缺失或指向不存在的文件/章节 → `claim` 和
  `verify` 都会拒绝（见 [requirement-author] 的四元组说明）。
- `priority`：越小越重要（1 = 阻断其他所有工作的最高优先级）
- `area`：对应代码平面（`orchestrator`/`tools`/`memory`/`agent-core`/`harness`/`ci`/`tooling`）
- `sprint`：未分配时为 `null`；由 `pnpm harness new-sprint --features` 分配
- `notes`：除依赖外，**标注本 feature 预计要改的共享文件热点**
  （如「会改 `apps/web/.../rooms/page.tsx`」）。多 agent 并行分派时以此判断
  parallel-safe：同文件热点的 feature 必须串行（前者合并后再派，见 L11 事故 #301/#299）。

---

## 常见反模式

| 反模式 | 问题 | 正确做法 |
|--------|------|---------|
| verification 只检查"文件存在" | 代码错误也能通过 | 加行为断言（HTTP/输出内容） |
| 一个 feature 跨越多个 area | 难以定位失败原因 | 按 area 拆分 |
| status 直接写 passing | 绕过了验证门控 | 只能通过 harness verify 升级 |
| notes 留空 | 下一轮 agent 没有上下文 | 写清楚依赖和注意事项 |
| verification 命令依赖本地服务已启动 | CI 环境失败 | 在 verification 前加启动步骤，或用独立的 setup 命令 |
| user_visible_behavior 里有本 feature 无法断言的行，静默跳过 | 契约缺口无人接盘（L10） | 在 notes 里显式写「该行为由 FXX 交付时断言」，并在 FXX 的 notes 里对应记录 |

---

## 分批填写建议（新项目启动时）

1. **第一批**：先写 3-5 个最高优先级 feature（知道这些必须做）
2. **分配 sprint-01**：只取前 2-3 个，保持 sprint 小而聚焦
3. **迭代补充**：每个 sprint 结束后再补下一批 feature

不要一次写完所有 feature——需求会变，过早细化是浪费。
