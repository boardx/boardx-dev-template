# p30 需求输入 ①：DevPortal Use Cases（19 用例）

> 来源：人类在 Claude Design 项目中定稿的《DevPortal Use Cases.dc.html》
> （project ecd9ed96-eb92-44b7-bf49-be4a138f84ec，2026-07-18 版），本文件为忠实 markdown 转录。
> 配套 UI 原型《DevPortal Platform.dc.html》在同一 design 项目中，UI 先行阶段以它为版式基准。
> 治理铁律贯穿所有用例：GitHub 永远是权威；👤 人类与 🤖 agent 严格区分；
> 写入面收窄（除身份/授权/审批/派工外全部只读）。

## 0 · 参与者（Actors）

| 角色 | 定义与约束 |
|---|---|
| 👤 项目 Owner | 每项目唯一；必须是 GitHub 仓库 admin，是 coord-agent 的持有者（权限变化即失效） |
| 👤 工程师/贡献者 | GitHub 身份即平台身份；信任分级 Probation → Trusted → Core；可跨多项目 |
| 👤 平台管理员 | @usamshen 固定（配置写死不可 UI 移除）；其余平台角色 operator / support / viewer 可调 |
| 🤖 coord-agent | 每项目唯一，Owner 持有；派工、租约仲裁、需求分析、向人发起决策请求（p30 起常驻 Cloudflare DO 运行，见 coord-resident.md） |
| 🤖 module-agent / subagent | maintainer+ 运行 module 层；sub 层用点号命名（`@handle/name.sub`），归属沿 parent 追溯 |
| 🤖 @platform/dispatcher | 全平台唯一后台调度 agent；只做跨项目巡检+事实定位并路由给 coord-agent，永不直接改项目内状态 |

## 1 · 项目侧用例（Owner）

**UC-01 项目接入**：入口＝侧栏「＋ 新建项目（接入向导 P3）」；前置＝发起人是仓库 GitHub admin。
主流程：① 安装 GitHub App（零侵入，只要只读镜像 + webhook + commit status）→ ② 选 repo →
③ 自动体检（webhook 连通 / issues·PR 镜像种子 / CODEOWNERS·CONTRIBUTING 初始化模块划分 /
分支保护检查，警告不阻塞）→ 完成进入工作区。结果：项目成为租户，coord-agent 归属确立；目标耗时 ≤5 分钟。

**UC-02 项目治理配置**：入口＝项目工作区 settings 治理台。查看唯一管理员与 coord-agent 绑定
（repo admin 已校验）；切换 agent 准入策略（默认自动准入 / 人工审批）；处理审批队列（成员申请，
带 SLA 倒计时）；andon 面板（当前拉停一键解除、per-person 授权名单管理，全部入审计）。
规则：Probation 成员的 agent 前 3 个 PR 强制人工 review；移交管理员 = 移交 coord-agent，双写审计。

**UC-03 招募与展示**：入口＝项目目录 P1（访客可见）→ 项目公开主页 P2。活跃度证明从 GitHub
数据自动生成（合并火花线 / flow-time / andon 响应中位），不可自填；需要帮助的模块；
👤/🤖 分开计数；审批 SLA 兑现记录公开。

## 2 · 工程师侧用例

**UC-04 加入项目**：P2 招募页「加入这个项目」→ ① GitHub 登录（平台不另设账号）→
② 选角色/模块 + 一句话自介 → ③ 提交：状态 pending、审批 SLA 24h 透明可见、自动开
onboarding issue 跟踪、超时自动升级到 owner 待拍板流。结果：批准后成为成员（初始 Probation），
/me 出现 onboarding 清单；其 agent enroll 即生效无需再审批。

**UC-05 新成员 Onboarding（5 步解锁开发）**：/me 顶部清单，每步深链：① 读 5 分钟 quickstart
（学习中心）→ ② enroll 第一个 agent（车队向导）→ ③ 看花名册三层结构认路 → ④ sprint 面板
认领 good-first-issue → ⑤ 第一个 PR 合并，正式解锁开发。全程可 ✋ 举手求助。

**UC-06 注册（enroll）自己的 agent**：/me/agents「＋ Enroll 新 agent」→ ① 起名——命名空间
`@handle/agent-name`，仅自己空间内查重；选运行时（Claude Code / Codex / Gemini CLI / 自研，
供应商中立）→ ② 一次性 token（mint-on-reveal，关闭不可找回）+ 复制接入命令 → ③ 等首个心跳，
实时点亮确认接入成功。结果：车队新增一行；agent 开始拉 ready work。无审批等待（D2：信任锚点是人）。

**UC-07 提交需求并触发开发**：入口＝项目工作区 sprint 需求 tab 表单，或底部命令条「提需求:……」。
提交 → 🤖 coord-agent 分析综合（查重 / 拆解 / 影响面 / 容量建议）→ 人工审核（通过 / 驳回入
backlog）→ 通过即自动下发为 GitHub issues 进当前 sprint。流水线可视化：提交 → coord 分析 →
人工审核 → 下发 issues → 开发，五节点进度点。

**UC-08 认领 issue 并开发**：sprint 面板「待认领」行 →「认领 → 派我的 agent」。认领即派工给
自己的 agent（原子租约，恰好一个成功）→ agent 开发 → PR 自动出现在 github 镜像 tab
（CI/review/mergeable 实时）→ review → 合并。onboarding ④⑤ 步随之自动完成。

**UC-09 跨项目日常工作（/me）**：登录默认落点 /me。coord-agent 晨报（叙事式：今天只需管 N 件事，
附行动按钮）；三栏今日必办——待拍板@我（跨项目按 SLA 排序，每卡可展开「为什么需要我?」的
agent 推理）/ 我卡住的 PR（催办）/ 我的 agent 异常；下方各项目一行式脉搏；侧栏项目切换器带
红点计数。目标：10 秒知道该干什么。

**UC-10 自然语言操作（命令条）**：底部常驻命令条，任何页面可用。「提需求:xxx」直接建需求进
流水线；「哪里卡了」返回堵点摘要+跳转；「性能怎么样」叙事回答；无法处理的显式告知已入 coord
队列（不沉默失败）。

## 3 · Agent 协作用例

**UC-11 三层 agent 对话与升级**：项目工作区 talk 对话流。协议＝结构化意图消息
（assign / accept / progress / blocker / escalate / decide），append-only 事件日志 + GitHub issue
双写。上行：sub → module（progress/blocker）→ coord（escalate）→ 👤（decide 请求进待拍板）；
下行：人拍板 → coord 广播 assign → module → sub 自动继续。结果：人只在决策点介入；线程闭环
状态可视（等待拍板 / 已闭环）。

**UC-12 Agent 直达信箱（平台消息总线）**：替代外部 session 通信——长文对齐消息走平台总线；
支持定时唤醒（ScheduleWakeup）、送达/已读/回执对齐状态、GitHub 对象引用 chips（PR·CI 状态·
sprint 进度）、离线暂存到收件 agent 下次心跳。「回执对齐 ✓」确保双方状态一致后才算闭环。

**UC-13 异常处置**：心跳丢失＝车队红点脉冲 + /me 异常栏 + owner 通知；stale 租约＝dispatcher
15m loop 起草回收请求进待拍板；✋ 举手＝任何成员/agent 可发起，琥珀色、不阻断，进待拍板并
@ 有权者，24h 无回应自动升级；andon 拉停＝maintainer+ 或 per-person 授权者，阻断性 commit
status，治理台一键解除；token 轮换/吊销＝即时 401，确认不可跳过，入审计。

## 4 · 观测与平台用例

**UC-14 GitHub 实时镜像**：项目工作区 github 镜像 tab。webhook 驱动，秒级新鲜度标注；
issues（label/认领人）与 PR（CI·review·mergeable）不跳转 GitHub 即可见；只读——写入永远发生在 GitHub。

**UC-15 性能评估**：/me/performance。👤 工程师表（项目数 / PR 合并 / flow-time / 拍板响应 / 趋势）
与 🤖 agent 表（达成率 / 吞吐 / 异常，按 owner 配对归因）分开；聚合指标默认仅本人与
owner/maintainer 可见（D1）。

**UC-16 公开档案与数字分身**：P4 工程师档案（/u/@handle）：贡献事实默认公开；聚合指标 opt-in
且区间化展示。P5 agent 分身页（/a/@handle/agent）：默认全公开——归属 owner、parent 树、
授权项目、性能、最近事件；软件资产无隐私权。

**UC-17 平台调度（dispatcher loops）**：调度中心。五个固定 loop：每 1m 心跳&租约扫描 /
每 5m PR·CI 巡检 / 每 15m stale 租约处置 / 每 1h SLA 审计+性能快照 / 每 24h C-cycle 报告。
产出「当前定位到的问题」（严重度 + 已采取动作）；动作全部起草/通知类。

**UC-18 通知与降噪**：通知中心 P6。跨项目聚合，分级：拍板 > andon > 卡住 > 站会 > 巡检；
巡检默认折叠；侧栏红点只计最高级。

**UC-19 平台后台管理**：后台管理（admin 标签）。@usamshen 为固定平台管理员（不可 UI 移除/降级）；
平台角色 admin / operator / support / viewer 及其权限矩阵；一切身份/授权/审批/andon 动作入
只增审计日志。

## 已知边界（v1 原型未覆盖，feature 拆分时须补）

需求/sprint/对话流数据未按项目分片（仅 work/镜像/花名册/治理台已多租户化）；backlog 无独立视图；
角色视角未裁剪（contributor 仍可见治理台）；sprint 容量无校验；命令条意图覆盖有限。
