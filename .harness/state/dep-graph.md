# 依赖图快照(自动生成)

> 本文件由 `pnpm harness dep-graph` 生成。手改会被覆盖。
> 取代 coordinator-loop-brief.md 里手写的「依赖图备份」小节——每次唤醒先跑一遍本命令刷新，别再手改那段 prose。

## 01 (Foundation（harness 元层）)

| Feature | 标题 | 状态 | owner | depends_on | wave |
|---|---|---|---|---|---|
| F01 | monorepo 骨架就位(pnpm + turbo) | passing | - | [] | - |
| F02 | harness 控制平面文件齐备 | passing | - | [] | - |
| F03 | 基础验证脚本可被发现(留到后续 sprint) | not_started | - | [] | - |

## p0 (基础设施 (P0))

| Feature | 标题 | 状态 | owner | depends_on | wave |
|---|---|---|---|---|---|
| F01 | web 首页与健康端点 | passing | - | [] | - |
| F02 | notes 写读闭环（API ↔ Postgres） | passing | - | [] | - |
| F03 | BullMQ 任务入队 → worker 处理 → 状态回写 | passing | - | [] | - |

## 04 (Auth/Team/Room 核心打包体（横跨 P1auth + P3team + P4room）)

| Feature | 标题 | 状态 | owner | depends_on | wave |
|---|---|---|---|---|---|
| F01 | 邮箱注册账号 | passing | claude | [] | - |
| F02 | 邮箱登录、会话与登出 | passing | - | [] | - |
| F03 | 修改密码（账号中心 Security） | passing | - | [] | - |
| F04 | 忘记/重置密码（DB 令牌 + dev 邮件） | passing | - | [] | - |
| F05 | 社交登录骨架（占位，不接真 OAuth） | passing | - | [] | - |
| F06 | 创建团队 | passing | claude | [] | - |
| F07 | 查看与切换团队 | passing | - | [] | - |
| F08 | 邀请成员与通过邀请加入 | passing | - | [] | - |
| F09 | 成员/角色管理与更新/删除团队 | passing | - | [] | - |
| F10 | 创建房间 | passing | claude | [] | - |
| F11 | 查看/搜索房间与权限可见性 | passing | - | [] | - |
| F12 | 房间成员管理与更新/删除 | passing | - | [] | - |
| F13 | [DEFERRED] 团队设置/Home/Memory/AI Store | not_started | - | [] | - |
| F14 | [DEFERRED] 房间文件/Studio/问卷 | not_started | - | [] | - |

## p1 (Profile/Common（P1 补全，配合 04 的 auth）)

| Feature | 标题 | 状态 | owner | depends_on | wave |
|---|---|---|---|---|---|
| F01 | 账号中心三分区 + 用户菜单入口 | passing | claude | [] | - |
| F02 | 编辑个人信息（显示名 + 头像） | passing | - | [] | - |
| F03 | 账号设置偏好（AI 模型 / 默认隐私） | passing | - | [] | - |

## p2 (Home 工作台 (P2))

| Feature | 标题 | 状态 | owner | depends_on | wave |
|---|---|---|---|---|---|
| F01 | Home 工作台壳与欢迎区 | passing | claude | [] | - |
| F02 | Agent 分组与卡片渲染（含空状态） | passing | claude | [] | - |
| F03 | Home 内 Agent 搜索过滤 | blocked | - | [] | - |
| F04 | Recent 页占位（忠于真实「开发中」状态） | passing | claude | [] | - |
| F05 | 最近白板入口（跳转 Board） | passing | claude | [] | - |
| F06 | Agent 快捷对话 / 继续上次对话 / 推荐功能启动 | blocked | - | [] | - |
| F07 | 新用户 Onboarding 空状态引导 | passing | claude | [] | - |

## p4 (Room-Chat (P4 补全))

| Feature | 标题 | 状态 | owner | depends_on | wave |
|---|---|---|---|---|---|
| F01 | 房间 Chat 页签与线程列表 | passing | claude | [] | - |
| F02 | 新建房间聊天线程并进入三栏工作区 | passing | claude | [] | - |
| F03 | 打开线程详情（含他人线程只读态） | passing | claude | [] | - |
| F04 | 删除房间聊天线程 | passing | claude | [] | - |
| F05 | 在房间聊天向 AVA 发送消息 | blocked | - | [] | - |

## p5 (Board 基础 (P5))

| Feature | 标题 | 状态 | owner | depends_on | wave |
|---|---|---|---|---|---|
| F01 | 创建 Board | passing | claude | [] | - |
| F02 | 打开 Board（容器壳） | passing | claude | [] | - |
| F03 | 列表 / 搜索 / 最近访问 | passing | claude | [] | - |
| F04 | 收藏 / 取消收藏 Board | passing | claude | [] | - |
| F05 | 更新 Board 元信息 | passing | claude | [] | - |
| F06 | 复制 Board | passing | claude | [] | - |
| F07 | 移动 Board 到其他房间 | passing | claude | [] | - |
| F08 | 删除 Board | passing | claude | [] | - |
| F09 | Board 可见范围（访问级别数据 + API） | passing | claude | [] | - |
| F10 | 通过公开链接查看/加入 Board | passing | claude | [] | - |

## p6 (Canvas & 组件 (P6))

| Feature | 标题 | 状态 | owner | depends_on | wave |
|---|---|---|---|---|---|
| F01 | 打开房间的板并渲染已有 item | passing | claude | [] | - |
| F02 | 添加 item（命令运行时） | passing | - | [] | - |
| F03 | 移动 / 编辑 item | passing | - | [] | - |
| F04 | 删除 item | passing | - | [] | - |
| F05 | 画布平移 / 缩放 / 导航 + 缩放控制条与小地图 | passing | claude | [] | - |
| F06 | 选择 / 多选组件 + 键盘操作 | passing | claude | [] | - |
| F07 | 拖动时的对齐参考线 | not_started | - | [] | - |
| F08 | 复制 / 粘贴画布内容 | passing | claude | [] | - |
| F09 | 撤销 / 重做 | passing | claude | [] | - |
| F10 | Widget 框架与能力边界 + Widget Menu 悬浮操作 | passing | claude | [] | - |
| F11 | 便利贴组件（内容 / 外观 / 状态） | passing | claude | [] | - |
| F12 | 文本组件 + 文本样式 + 文本转便利贴 | not_started | - | [] | - |
| F13 | 画布渲染引擎切换为 Fabric.js（既有行为不回归） | not_started | - | [] | - |
| F14 | packages/canvas 数据模型改造为字段级 patch（CRDT-ready） | not_started | - | [] | - |
| F15 | 形状组件 | not_started | - | [] | - |
| F16 | 连接线组件 + 连接线样式 | not_started | - | [] | - |
| F17 | 手绘组件 | not_started | - | [] | - |
| F18 | 图表组件 | not_started | - | [] | - |
| F19 | 组件样式调整 + 应用格式 | not_started | - | [] | - |
| F20 | 锁定/解锁 + 删除 + 刷新组件 | not_started | - | [] | - |
| F21 | 多选组合批量操作（移动/对齐/编组/锁定/删除） | not_started | - | [] | - |
| F22 | 图片组件 + 裁剪 | blocked | - | [] | - |
| F23 | 文件组件 + 下载 + 音频转文本 | blocked | - | [] | - |
| F24 | 组件 AI 助手 | blocked | - | [] | - |

## p7 (Board 壳 (P7))

| Feature | 标题 | 状态 | owner | depends_on | wave |
|---|---|---|---|---|---|
| F01 | Board Header 框架（状态/授权入口/返回/同步指示/撤销重做） | not_started | - | [] | - |
| F02 | Header 标题查看与编辑 | not_started | - | [] | - |
| F03 | 分享 Board（链接 / 二维码 / 访问范围） | not_started | - | [] | - |
| F04 | 协作计时器 | passing | claude | [] | - |
| F05 | Board 设置与交互偏好 | passing | claude | [] | - |
| F06 | Board 统计信息 | not_started | - | [] | - |
| F07 | 快捷键帮助 + 欢迎引导 | passing | claude | [] | - |
| F08 | Board 备份与恢复 | not_started | - | [] | - |
| F09 | 幻灯片管理 + 导出 PDF | blocked | - | [] | - |
| F10 | 语音转录到白板 | blocked | - | [] | - |
| F11 | Board Menu 工具栏框架 + 组件创建入口 | not_started | - | [] | - |
| F12 | 链接组件 | not_started | - | [] | - |
| F13 | 上传文件 / 资源模板 / Board AI 助手入口 | blocked | - | [] | - |
| F14 | 右键 Context Menu（框架 + 图层顺序 + 复用复制/编组） | not_started | - | [] | - |
| F15 | 导出选中内容 / 保存为模板 | blocked | - | [] | - |
| F16 | Local Workspace（Board Chat + Board Memory） | blocked | - | [] | - |

## p8 (实时协作 (P8))

| Feature | 标题 | 状态 | owner | depends_on | wave |
|---|---|---|---|---|---|
| F01 | WebSocket + Redis 广播骨架（不含 Yjs 语义） | not_started | - | [] | - |
| F02 | Yjs 实时同步组件变更 | not_started | - | [] | - |
| F03 | 在线成员头像 + 实时光标 | not_started | - | [] | - |
| F04 | 跟随协作者视角 | not_started | - | [] | - |
| F05 | 连接状态、断线重连与同步指示 | not_started | - | [] | - |

## p9 (AVA / Chat (P9))

| Feature | 标题 | 状态 | owner | depends_on | wave |
|---|---|---|---|---|---|
| F01 | AVA 聊天壳 + 新建会话 + 发首条消息 + AI 流式回复 | passing | wrk-ava-1 | [] | 0 |
| F02 | 聊天线程列表 CRUD（按日期分组/切换/重命名/删除/团队隔离） | passing | wrk-codex-1 | [F01(passing)] | 1 |
| F03 | 编辑/删除消息 + 重新生成后续回复 | passing | wrk-codex-ava-2 | [F01(passing)] | 1 |
| F04 | 分享聊天：生成/复用/关闭分享链接 | passing | wrk-codex-ava-3 | [F01(passing)] | 1 |
| F05 | 公开分享对话只读页 /chatShare/:threadId | passing | wrk-ava-1 | [F04(passing)] | 2 |
| F07 | AI 设置：模型/Agent/工具选择（发送前生效） | passing | wrk-codex-ava-5 | [F01(passing)] | 1 |
| F11 | 消息结果操作（复制/反馈/重新生成/发送到Board/发送邮件） | passing | wrk-ava-1 | [F03(passing)] | 2 |
| F06 | Deep Research（澄清→计划→执行时间线→报告） | passing | wrk-codex-ava-6 | [F01(passing)] | 1 |
| F08 | 向聊天附加文件/图片/音频 | passing | wrk-ava-1 | [p10:F01(passing)] | 1 |
| F10 | 建议动作（快捷问题填入输入框） | passing | wrk-codex-ava-4 | [F01(passing)] | 1 |
| F09 | 语音输入 / 实时转写 | blocked | - | [] | - |

## p10 (知识库 (P10))

| Feature | 标题 | 状态 | owner | depends_on | wave |
|---|---|---|---|---|---|
| F01 | 上传知识库文件（自动上传 + 类型/大小校验 + 处理状态） | passing | wrk-kb-1 | [] | 0 |
| F02 | 文件列表查看/搜索/刷新/分页/下载 | passing | wrk-codex-kb-1 | [F01(passing)] | 1 |
| F03 | 删除知识库文件 | passing | wrk-kb-1 | [F02(passing)] | 2 |
| F04 | AI 引用知识库上下文（RAG 检索 + 作用域隔离） | in_progress | wrk-kb-1 | [F03(passing), p9:F01(passing)] | 3 |

## p11 (AI Store (P11))

| Feature | 标题 | 状态 | owner | depends_on | wave |
|---|---|---|---|---|---|
| F01 | AI Store 浏览/筛选（Explore + 类型 Tab + 搜索/标签/分页 + 详情弹窗） | passing | wrk-store-1 | [] | 0 |
| F02 | 创建/更新 AI Store 项目（各类型创建器 + 草稿/发布/提交审核） | passing | wrk-codex-store-1 | [F01(passing)] | 1 |
| F03 | 订阅并使用项目（个人/团队订阅 + 使用入口带入 AVA/工具/模板） | in_progress | wrk-store-1 | [F02(passing), p9:F01(passing)] | 2 |
| F04 | 项目喜欢/收藏状态展示与切换 | passing | wrk-store-2 | [F01(passing)] | 1 |
| F05 | 项目分享管理（授权链接生成/关闭 + 已授权用户列表） | passing | wrk-store-2 | [F02(passing)] | 2 |
| F06 | 团队/项目审核与精选（PENDING/APPROVED 切换 + featured） | passing | wrk-store-2 | [F02(passing)] | 2 |

## p12 (Studio & 演示 (P12))

| Feature | 标题 | 状态 | owner | depends_on | wave |
|---|---|---|---|---|---|
| F01 | Studio 面板 + 音频概览/信息图生成（结果入聊天） | passing | wrk-studio-1 | [p9:F01(passing), p10:F01(passing)] | 1 |
| F02 | 生成演示文稿（配置弹窗 + 生成进度 + 预览卡片） | passing | wrk-studio-1 | [F01(passing)] | 2 |
| F03 | 修订演示文稿（方案修改 + 单页优化） | passing | wrk-studio-1 | [F02(passing)] | 3 |

## p13 (问卷 (P13))

| Feature | 标题 | 状态 | owner | depends_on | wave |
|---|---|---|---|---|---|
| F01 | 创建问卷（创建器 + 多题型 + 选项 + 预览） | passing | wrk-survey-1 | [] | 0 |
| F02 | 问卷列表管理（My/Team Surveys + 卡片操作） | passing | wrk-codex-survey-1 | [F01(passing)] | 1 |
| F03 | 填写并提交问卷（公开答题页） | passing | wrk-codex-survey-2 | [F01(passing)] | 1 |
| F06 | 发布/暂停问卷（公开答题开关） | passing | wrk-survey-2 | [F01(passing), F03(passing)] | 2 |
| F04 | 查看答卷与报告（Summary/Individual/Report + 导出） | in_progress | wrk-survey-1 | [F03(passing)] | 2 |
| F05 | 问卷模板管理（应用/保存/删除模板） | passing | wrk-codex-survey-3 | [F01(passing)] | 1 |

## p14 (积分 & 计费 (P14))

| Feature | 标题 | 状态 | owner | depends_on | wave |
|---|---|---|---|---|---|
| F01 | 积分钱包查看（Team Credits 页 + 用户菜单个人余额） | passing | wrk-credits-1 | [] | 0 |
| F05 | 扫码支付引擎（下单/二维码/轮询/回调，Pro+Credit 共用） | passing | wrk-payment-1 | [] | 0 |
| F02 | 购买积分（Buy Credits 弹窗 + 套餐 + 扫码下单） | passing | wrk-payment-1 | [F05(passing)] | 1 |
| F03 | 积分流水查看（个人 Credit Records 弹窗 + 团队记录） | passing | wrk-credits-1 | [F01(passing)] | 1 |
| F04 | 升级/管理个人计划（订阅弹窗 + credits 模式路由 + 额度不足触发） | in_progress | wrk-codex-billing-1 | [F05(passing)] | 1 |

## p15 (Admin 后台 (P15))

| Feature | 标题 | 状态 | owner | depends_on | wave |
|---|---|---|---|---|---|
| F01 | Admin Panel 首页 + 身份门控 + 统计摘要 + 模块导航 | passing | wrk-admin-1 | [] | 0 |
| F02 | 用户管理（列表/搜索/分页/增删改 + 手动上分） | passing | wrk-admin-1 | [F01(passing), p14:F01(passing)] | 1 |
| F03 | 团队管理（搜索/分页/编辑团队类型 + 手动上分） | passing | wrk-admin-2 | [F01(passing), p14:F01(passing)] | 1 |
| F04 | AI Store 平台审核页（APPROVED/PENDING 切换） | passing | wrk-admin-1 | [F01(passing), p11:F01(passing), p11:F02(passing)] | 2 |
| F05 | AI Store 官方精选页（isFeatured 切换） | passing | wrk-admin-1 | [F04(passing), p11:F02(passing)] | 3 |

## p16 (UI 导航接线与差距审计)

| Feature | 标题 | 状态 | owner | depends_on | wave |
|---|---|---|---|---|---|
| F01 | 全局导航接线：Ava / Surveys / Admin 入口 | passing | wrk-claude-1 | [] | - |
| F02 | UI 差距审计：Ava / Store / Surveys / Admin vs prototype | passing | wrk-nav-audit-1 | [] | - |
| F03 | Design lint 覆盖扩大到新增页面 | passing | wrk-lint-1 | [] | - |

## p17 (UI Reskin Round 2)

| Feature | 标题 | 状态 | owner | depends_on | wave |
|---|---|---|---|---|---|
| F01 | Board 内嵌 AI 浮层 + 底部工具 dock + board chat 面板 | not_started | - | [p16:F02(passing)] | 1 |
| F02 | Ava 对话界面 reskin | not_started | - | [p16:F02(passing)] | 1 |
| F03 | AI Store 页面 reskin | not_started | - | [p16:F02(passing)] | 2 |
| F04 | Admin 后台 reskin | not_started | - | [p16:F02(passing)] | 2 |
| F05 | Surveys 页面 reskin | not_started | - | [p16:F02(passing)] | 2 |
| F06 | Knowledge Base + Credits 页面收尾 reskin | not_started | - | [p16:F02(passing)] | 3 |

_最近生成:2026-07-03T04:46:37.868Z_
