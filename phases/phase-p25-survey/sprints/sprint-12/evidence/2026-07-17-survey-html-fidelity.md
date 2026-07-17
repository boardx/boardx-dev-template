# Survey 诊断平台 HTML 视觉验收

日期: 2026-07-17

## 参考基线

- 原始文件: `/Users/shenyangjun/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/yy774650019_32de/msg/file/2026-07/AI 问卷诊断平台(1).html`
- 对照副本: `/Users/shenyangjun/Desktop/消费明细/AI 问卷诊断平台.html`
- 两份文件 SHA-256: `bfaaef440519aad4fd4b0e9b9d3934e947e72001758e724e287d04289df65755`
- 对比视口: `1280 x 720`
- 对比方式: 每张 WebP 左侧为同状态参考 HTML，右侧为当前实现，两侧均保持原始 `1280 x 720` 像素。

## 六界面对比证据

| 界面 | 参考 HTML 截图 | 当前实现截图 | 同视口并排对比 |
| --- | --- | --- | --- |
| Home Dashboard | `source-html-home.png` | `survey-home-desktop.png` | `comparison-home.webp` |
| 我的问卷 | `source-html-my-surveys.png` | `survey-my-surveys-desktop.png` | `comparison-my-surveys.webp` |
| 问卷编辑器 | `source-html-editor.png` | `survey-unified-editor-viewport.png` | `comparison-editor.webp` |
| 模版中心 | `source-html-templates.png` | `survey-template-center-desktop.png` | `comparison-templates.webp` |
| 报告模版推演 | `source-html-report-template.png` | `survey-report-template-viewport.png` | `comparison-report-template.webp` |
| 洞察报告 | `source-html-insight.png` | `survey-insight-report-desktop.png` | `comparison-insight.webp` |

截图夹具使用 3 份真实已发布问卷、7 个真实报告分类和 1 份真实已提交答卷。参考 HTML 的示例数字、模板文案和报告结论不复制到产品数据中。

## 设计 QA

- 视觉层级: 六个界面的标题、说明、筛选、内容区和辅助面板层级与参考一致；没有新增营销式大标题或装饰卡片。
- 导航与间距: Survey 二级导航主内容边界对齐参考稿 `x=390`；首页指标区、我的问卷列表、编辑器摘要、报告模板三栏和洞察报告首屏的关键纵向位置已逐项复核。
- 字体与颜色: 沿用 BoardX 字体和设计 token，主界面保持黑白灰工作台；紫色仅用于 AI、选中态和 Survey 语义强调。
- 图标与资源: 操作图标使用项目现有 Lucide 组件。公开答题页的研究横幅使用压缩 WebP 位图，不使用 CSS 绘图或占位图形。
- 内容真实性: 用户名来自真实会话；问卷数、答卷数、完成率、模板维度、报告样本和已生成报告数均来自实际数据或持久化 report artifact。低于 30 份样本只展示方向性统计，不形成假设或 NPS 结论。
- 隐私边界: 洞察摘要不展示原始开放题文本或内部答卷 ID；聚合主题只在服务端生成后展示，原始回答保留在授权的单份答卷视图。
- 交互完整性: 首页方法入口、三种新建方式、模板筛选与套用、编辑器题目和假设操作、报告模板编辑、洞察报告标签及返回动作均接入真实工作流。返回动作保留编辑器、工作流和列表来源。
- 响应式: 结果页在 `390 x 844` 提供移动导航，页面无横向溢出。
- 控制台检查: 聚焦 Playwright 截图与交互测试未发现应用控制台错误；仅有既有 `NO_COLOR` 环境警告。

## 对比修复记录

### 第一轮

- P1: “我的问卷”曾采用资源库表格，与指定 HTML 的三种创建入口和紧凑问卷列表不一致。
- P1: 洞察报告缺少共享 Survey 导航，编辑器和报告模板保留额外工具条。
- P2: 首页内容边界、指标卡高度和列表起点与参考稿偏移。
- 修复: 恢复诊断平台信息架构，新增六界面共享导航；重排首页、问卷列表、编辑器、报告模板和洞察报告首屏。

### 第二轮

- P2: 编辑器假设输入长期占位，导致首题被推出视口；模板维度直接显示英文 slug。
- P2: 报告模板模块数和三栏比例不一致；洞察报告截图因内层横向滚动产生额外裁切。
- 修复: 假设输入改为按需展开；slug 映射为中文；报告模板使用 7 个真实分类；截图前复位横向滚动。

### 最终轮

- 六张并排图按相同 `1280 x 720` 视口重新生成并人工复核。
- 审查后补齐低样本限制、摘要隐私、真实 report artifact 数量、返回来源和移动结果页导航，再次生成六张并排图。
- 没有剩余 P0、P1 或 P2 差异。
- P3: BoardX 全局产品栏宽 60px，参考 HTML 为 72px；Survey 二级导航已补偿，总内容边界一致。
- P3: 编辑器首题比参考稿低约 14px，且保留生产可用的类型/维度选择控件，而非参考稿的纯展示标签。
- P3: 真实业务数据与参考 HTML 示例内容不同，这是防止伪造指标和报告结论的有意差异。

final result: passed
