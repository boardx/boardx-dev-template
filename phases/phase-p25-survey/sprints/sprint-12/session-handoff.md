# 会话交接 — Sprint p25/12

## 当前已验证
- Survey 统一创建界面已通过 10 条完整 Playwright、移动端视觉测试、Web typecheck、design lint 和独立代码复审。
- Survey 首页导航精简已通过聚焦 E2E、typecheck、design lint 和补丁格式检查。
- `/surveys` 参考诊断平台首页已通过聚焦 E2E、typecheck、design lint 和视觉截图对照。
- F12 仍为 `in_progress`，没有提前标记 passing。
- 专业报告链已通过 9 个 Vitest、typecheck、design lint 和 3 个聚焦 Playwright E2E。
- 报告分类 API 修复已通过 Web typecheck、86 个 Vitest 测试和 1 个聚焦 Playwright E2E。
- Survey AI 工作台第一版已通过布局单测、Web typecheck、design lint，以及 4 条聚焦 Playwright 路径。
- 报告模板真实入口的三栏工作台契约已通过 F12 Playwright 3/3、Web typecheck 和 design lint。

## 本轮改动
- 新建问卷统一为 AI、诊断模板、空白三路选择器；首页和我的问卷复用同一入口。
- 模板中心改为标签过滤的诊断模板列表，保留套用、报告模板及自定义模板管理动作。
- 编辑器改为单边界诊断摘要和连续纸面题目画布；AI draft/changeSet 均需确认后应用。
- 移动端编辑器改为单列，AI 助手在主内容后完整显示，桌面检查器只在 `xl` 断点显示。
- Survey 左侧四个菜单项统一为固定尺寸和描边的 Lucide 图标。
- 首页移除“组织”和“顾问社区”占位卡片，工作台指标改为完整横向区域。
- WHY / HOW / THEN 三个方法卡分别连接模板中心、AI 新建问卷和分析报告；没有可分析答卷时回到“我的问卷”。
- `/surveys` 改为诊断工作台首页；`?view=my` 为我的问卷；`?view=templates` 为模板中心。
- 首页按参考稿实现工作台指标、组织/社区、WHY/HOW/THEN、推荐模板和最近问卷。
- 报告不再使用模板模拟数字；服务端按真实答卷生成 `SurveyReportEvidenceBundle`。
- 不同题目独立聚合并保留有效回答分母；多选使用有效答题人数计算选择率。
- 千问只接收结构化证据，返回结论必须匹配 evidence ID、value 和 denominator；失败时保留真实统计。
- 页面使用专业报告文档组件；零样本明确为空，不生成管理结论。
- PDF/Word 使用独立 A4 文档 HTML，包含封面、样本口径、章节、来源和限制，不再复制工作台 DOM。
- 五步工作流保留原有功能，将第二步命名为“报告模板”。
- 设计页采用可折叠题目目录、单题编辑区和精简 AI 助手；AI 结果可预览或直接应用。
- 报告模板支持图表、图片、文本模块，具备预览、移动、缩放和独立提示词入口。
- 发布、查看答题、分析报告三个工作流同步采用目录 + 主工作区 + AI 助手结构。
- `POST /api/surveys/:id/report-categories` 接入千问 JSON 分类，并沿用主仓 Survey scope 管理权限。
- 千问缺少配置、超时或供应商失败时生成并保存确定性默认分类，页面可继续编辑。
- E2E 验证真实问题 ID 被持久化，且非管理者返回 403。
- `step=template` 当前入口已稳定为可折叠模块列表、实时报告预览和 AI/配置助手三栏结构，并新增可执行的 UI 契约断言。

## 仍损坏或未验证
- 尚未运行整个 Harness verify，因为 F12 的真实答卷生成、零/低样本限制和失败重试尚未全部形成可执行验收。
- 尚未以真实 `DASHSCOPE_API_KEY` 验证供应商成功分支；无密钥降级分支已验证。
- AI fallback 场景已在后续统一创建界面回归中通过；原本地数据库约束阻塞不再是当前 blocker。
- 尚未使用真实千问密钥验收 AI 成功措辞，也未完成不同打印机/PDF 驱动的分页视觉复核。

## 下一步最佳动作
- 继续 F12 的真实答卷报告、零/低样本限制和失败重试验收；不要手改 `active-features.json` 或把 F12 直接改为 passing。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p25/12`
- 调试:`pnpm --filter @repo/web exec playwright test e2e/survey-p25-012-report-composer.spec.ts --reporter=line`
