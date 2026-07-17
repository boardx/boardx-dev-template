# 12 — AI 问卷诊断平台 HTML 高保真 UIUX 变更

## 事实来源

- 唯一视觉与交互基线：
  `/Users/shenyangjun/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/yy774650019_32de/msg/file/2026-07/AI 问卷诊断平台(1).html`
- SHA-256：
  `bfaaef440519aad4fd4b0e9b9d3934e947e72001758e724e287d04289df65755`
- `/Users/shenyangjun/Desktop/消费明细/AI 问卷诊断平台.html` 是同一文件的字节级副本。
- GitHub 追踪入口：`boardx/boardx-dev-template#648`。

AI Store resource-library 截图不再作为 `/surveys` 首页的信息架构来源。实现不得把参考
HTML 的诊断工作台改写成通用资源商店或营销首页。

## 用户目标

咨询顾问进入 BoardX Survey 后，看到与参考 HTML 一致的诊断工作台，并可连续完成：

1. 从首页理解当前组织、诊断方法、推荐模板与最近问卷。
2. 从 AI 对话、诊断模板或空白问卷创建项目。
3. 编辑问卷并维护诊断维度、假设和题目。
4. 编排报告模板、图表、数据提示词和模块顺序。
5. 发布回收、查看答卷并生成真实证据驱动的洞察报告。

## 必须落地的六个界面

### 1. Home Dashboard

- 保留 BoardX 全局 rail，并在其右侧显示 Survey 二级导航。
- 显示问候、顾问身份和组织上下文。
- 显示工作台指标、组织摘要、顾问社区、WHY/HOW/THEN 诊断方法、
  推荐模板和最近问卷。
- 指标必须来自真实数据；数据不足时显示 `0` 或明确空态，不使用模拟比例。

### 2. 我的问卷

- 页面顶部提供 AI 对话、从模板开始、空白问卷三种创建入口。
- 问卷使用紧凑列式列表，显示名称、状态、真实回收信息和唯一主操作。
- 回收进度只有在存在真实分母时才显示比例；否则显示答卷数量或未设置目标。

### 3. 诊断模板中心

- 支持标签筛选、系统/团队归属、问卷模板与配套报告模板关系。
- 卡片内容、操作顺序和两列布局与参考 HTML 一致。
- “使用模板”“查看报告模板”“AI 生成模板”“手工新建”连接现有真实流程。

### 4. 报告模板推演

- 桌面端保持三栏：模块导航、实时预览、模块配置与 AI 助手。
- 支持模块启用、排序、图表类型、字段映射、提示词和样式配置。
- 导航、预览和设置三栏不重复展示同一信息或重复全局操作。

### 5. 问卷编辑器

- 保持参考 HTML 的五步工作流和沉浸式编辑布局。
- 问卷元数据、诊断维度、假设、连续题目编辑和 AI 建议各自职责清晰。
- AI 生成内容必须先预览、再确认应用，不得直接覆盖用户当前草稿。

### 6. 洞察报告

- 使用真实答卷、样本质量、假设验证、维度对比、分层差异、主题编码、
  关键引述和行动路线生成专业报告。
- 零样本和低样本明确显示限制；任务失败可重试。
- 原始答卷不全量发送到客户端。

## 视觉与交互约束

- 页面结构、信息顺序、密度、对齐、留白、字阶和交互层级以参考 HTML 为准。
- 使用仓库现有 shadcn/Tailwind 语义 token 和 Lucide 图标，不引入第二套颜色系统。
- 禁止硬编码 Tailwind palette 色、伪造指标、装饰性大图预加载和重复 `role="alert"`。
- 所有核心导航、创建入口、筛选、编辑、保存、发布、报告与重试操作必须可用。
- 桌面、平板和移动端不得重叠、截断或出现空白图表。

## 不变契约

- 保留 team/room/owner 权限和公开匿名答题边界。
- 保留现有 Survey API、千问 provider、URL 刷新恢复和服务端结果聚合。
- 保留 F01-F11 已 passing 的行为，不重写其状态或 evidence。
- F12 在 Harness verify 成功前保持 `in_progress`。

## 验收

- 参考 HTML 的六个 `data-screen-label` 均有对应真实界面与稳定 `data-testid`。
- `pnpm --filter @repo/web run lint`
- `pnpm --filter @repo/web run typecheck`
- `pnpm --filter @repo/web run test -- survey-report`
- Survey 相关 Playwright 套件覆盖六个界面、核心创建路径、URL 恢复、公开答题和报告编排。
- `pnpm harness verify --sprint p25/12 --feature F12`
- 同尺寸参考图与实现图完成视觉对比，截图和命令输出写入 sprint-12 evidence。
