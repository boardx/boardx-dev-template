Use Case 名称：
房间级文件库（核心模型修正）

Actor：
Room member、Room admin、Room owner

目标：
文件是**房间资产**而非聊天线程附属：房间有统一的 Files tab 文件库；任何聊天线程都能看到并
引用同一批房间文件；`chat_thread_id` 退化为可选的「来源标注/过滤」维度（对齐旧后端
`room-file.schema.ts` 的可选 `chatThreadId` 与原型的 Room Detail Files tab）。

系统边界：
BoardX / Room Files（复用 p10 CAP-FILE 上传平面：R2 预签名 + confirm）

前端入口：
1. 房间详情壳的 Files tab（uc-rr-001）。
2. 聊天三栏工作区左侧 Room Files 面板（展示同一房间文件库，替换现占位文案）。

前置条件：
- 用户已登录且是房间成员。**不要求已打开聊天线程**（这是对 uc-room-005 的修正）。

主流程：
1. 用户进入房间 Files tab，看到上传区（拖拽/点击）、允许类型说明、搜索框、文件列表
   （文件名/类型/大小/上传者/时间）。
2. 用户上传文件：预签名 → 直传 → confirm 落库，记录 room_id、uploader、可选 chat_thread_id=null。
3. 文件出现在 Files tab 列表，同时出现在该房间**所有**聊天线程的左侧文件面板。
4. 在聊天工作区左侧面板上传的文件同样落到房间文件库（附 chat_thread_id 标注来源），
   Files tab 可按来源线程过滤，但默认展示全部。
5. 用户搜索、预览（签名 URL）、删除（软删，二次确认）文件。
6. 左侧面板支持勾选文件作为 AI 上下文 sources（勾选状态与数量展示；内容进入 AI 的 RAG 细节归 p10）。

备选流程：
- A1：用户只在 Files tab 管理文件，从不进聊天。
- A2：用户在两个不同线程中看到并勾选同一份文件。

异常流程：
- E1：类型不支持 → 行内错误「Unsupported file type」。
- E2：上传失败 → 行内失败原因，可重试。
- E3：删除后其他线程的面板刷新后不再显示该文件。

权限与可见性：
- 房间成员均可查看/上传；删除仅上传者本人或 owner/admin。
- 非成员无任何访问。

后置条件：
- 一个房间只有一个文件集合；线程只是视图/过滤维度。

不包含：
- RAG/向量化（p10）；文件转码与预览服务内部实现。

业务规则：
- 数据模型：`room_files(room_id NOT NULL, chat_thread_id NULLABLE, uploader_id, file_name,
  file_type, file_size, storage_path, status, deleted_at)`——与旧后端字段对齐。
- 若已有线程级文件数据则迁移保留 chat_thread_id 值，不丢数据。
- 面板与列表带 `data-testid`（room-files-tab、room-files-upload、room-files-item 等）。
