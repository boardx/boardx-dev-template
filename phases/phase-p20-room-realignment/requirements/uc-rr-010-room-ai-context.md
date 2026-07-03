Use Case 名称：
Room AI 上下文字段回补

Actor：
Room owner、Room admin（配置方）；Room member（受益方）

目标：
回补旧 Room 实体中丢失的 AI 上下文能力（oldcode room.schema.ts 的 `description`、
`aiInstruction`、`memories[]`）：房间可配置描述与 AI 指令，房间聊天的 AI 回复遵循该指令。

系统边界：
BoardX / Room + AVA（CAP-AI，注入部分依赖 p9 真实模型链路）

前端入口：
房间设置（页头设置入口）中的「About & AI」区块。

前置条件：
- 用户是房间 owner/admin。

主流程：
1. rooms 表增加 `description text`、`ai_instruction text`（memories 本期不做，见「不包含」）。
2. owner/admin 在房间设置填写/修改描述与 AI instruction 并保存（PATCH /api/rooms/[id]）。
3. 房间详情页头/Boards tab 空态展示 description。
4. 房间聊天发消息时，系统把 ai_instruction 注入该房间所有线程的系统提示；AI 回复体现指令
   （在 p9 真实链路未就绪前，先保证注入路径与存储契约 + 桩层可断言注入内容）。

异常流程：
- E1：member 尝试 PATCH → 403。
- E2：ai_instruction 超长（>4000 字符）→ 校验拒绝。

后置条件：
- 字段持久化；同房间全部聊天线程共享同一指令。

不包含：
- `memories[]`（房间记忆）——依赖 p9 记忆机制成型后另立 feature。
- AI 效果质量评估。

业务规则：
- 设置区块带 `data-testid`（room-settings-description、room-settings-ai-instruction）。
