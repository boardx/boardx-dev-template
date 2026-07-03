# BoardX UI 差距审计 Round 2 — Ava / Store / Surveys / Admin

> 参照物：`docs/design/boardx-prototype-mapping.md`（同类文档，P0-P4 已用这个方法论完成 reskin）。
> 权威设计稿：`docs/design/boardx-prototype-v1.bundle.html`（单页 SPA，桌面 App Shell + icon rail，
> 本轮通过本地静态 http server 打开并逐屏点击 AVA/Store/Survey/Admin 四个 rail 项截图对比）。
> 现状实现：本 worktree 起 `apps/web`（`pnpm -w run dev`，DB 已迁移到最新 migration），
> 用新注册账号 + `/api/dev/grant-sysadmin` 开发态提权登录，逐屏访问 `/ava` `/ai-store` `/surveys`
> `/admin` `/admin/users`。
>
> 覆盖范围：Ava(空态+对话态) / AI Store(Explore 列表) / Surveys(空态) / Admin(Overview + Users)，
> 共 6 个真实截图状态 + 对应 5 个设计稿状态，逐条比对。

---

## 0. 审计范围与方法

- **范围**：phase-p16 F02 指定的 4 个模块——Ava（AI 对话）、AI Store（agent 商店）、Surveys（问卷）、
  Admin（后台管理，仅 SysAdmin 可见）。这 4 个模块在 `boardx-prototype-mapping.md` §4 中被列为
  "设计有/现无，本轮不做，留作后续"；实际上现状 code 里这 4 个路由**已经存在并可工作**
  （`apps/web/app/(app)/{ava,ai-store,surveys,admin}`），只是从未与该设计稿做过映射+差距分析。
  本文档补上这一步。
- **方法**：
  1. 起 dev server（本 worktree 独立 docker compose 端口 51512/51513/51515，`pnpm --filter @repo/data run migrate` 应用到最新 migration `021_presentation_revisions.sql`）。
  2. 用 Preview 工具登录测试账号 `gapaudit@example.com`，对 SysAdmin 相关屏用
     `POST /api/dev/grant-sysadmin`（仅 dev 环境可用的测试后门）提权。
  3. 逐屏访问真实路由，用 `preview_snapshot`（accessibility tree，比截图更精确地拿到逐字文案）+
     `preview_screenshot`（视觉布局参考）双重取证。
  4. 用本地 `python3 -m http.server` 把 `docs/design/boardx-prototype-v1.bundle.html` 当静态站点打开
     （直接 `file://` 打开被 Preview 工具的同源沙箱拦截，改用 http 服务绕过），点击顶部 icon rail 的
     AVA / Store / Survey / Admin 四项，拿到设计稿对应屏的 accessibility tree。
  5. 关键判断另外用**源码交叉验证**（比截图更可靠地判断文案语言/token 使用），对每个模块列出
     具体文件路径 + 行号。
- **产出形态**：本文档以结构化文字表格为主（而非嵌入图片）——与 `boardx-prototype-mapping.md`
  一致的风格。原因：Preview 工具的截图是会话内 inline 图像，没有可靠的落盘路径写进 `docs/`
  仓库；而 accessibility snapshot + 源码行号提供的是**逐字精确**证据，比压缩截图更适合做 diff。
  `docs/design/ui-gap-round2-screenshots/` 目录已建但当前为空——如需图片留档，建议下一轮用
  `computer-use` 或 Playwright `page.screenshot()` 落盘（`preview_screenshot` 目前无 `save_to_disk` 参数）。

---

## 1. 逐模块差距表

### 1.1 Ava（AI 对话）

**设计稿**（bundle.html → AVA rail）：三栏布局——左侧会话历史（"+ New chat" / Today / Earlier 分组 /
每条会话 hover 显示 "⋯" 菜单）、中间对话流（角色气泡 + Edit/Delete/Copy/Regenerate/👍👎/"→ Send to
board" 操作 + "· Expert ▾" / "GPT-4o ▾" 下拉）、底部输入框（📎/🖼/🎙 附件 + "@ Expert" "# Skill"
"✦ Deep Research" 快捷标签）。顶部有 "Share" 按钮。

**现状**（`/ava`，源码 `apps/web/app/(app)/ava/page.tsx`）：

| 区块 | 设计 | 现状 | 差距类型 | 优先级 |
|---|---|---|---|---|
| 空态标题/建议 | 未特别展示空态文案（设计默认给出历史会话） | `我能帮你做什么？`（line 1215）+ 4 个建议 chip：`理解文件`/`起草邮件`/`总结趋势`/`头脑风暴`（line 151-154），**全中文** | 语言不统一：sidebar 是英文（Home/Rooms），Ava 主区大面积中文 | 高——是本轮最直接可见的语言撕裂点 |
| 会话历史分组标签 | "Today" / "Earlier" | `threadDateGroup()`（line 2106-2114）已经是英文（"Today"/"Yesterday"/"Last 7 days"/"Older"），与设计**一致** | 无 | — |
| 空态列表提示 | — | `还没有会话，开始聊天即可创建。`（中文），中英混排在同一屏（旁边 "New chat" 按钮是英文） | 语言不统一 | 高 |
| 会话操作按钮 | Edit / Delete / Copy / Regenerate / Send to board | 需要在有会话内容时进一步核对（本轮只验证到空态+新建对话的 composer 态，未验证已有多轮对话的消息操作按钮文案） | 未覆盖 | 中——下一轮建议补验证 |
| 输入区标签 | Model/Agent/Tools 下拉在设计里是内嵌于 composer 顶部一行 | 现状也有一行 `Model: Stub Default · Agent: Default AVA · Tools: Web Search`（下拉展开显示 `Model`/`Stub Default`/`Stub Planner`/`Team Pro Stub (restricted)`、`Agent`/`Default AVA`/`Research Agent`、`Tools`/`Web Search`/`Board Context`/`File Reader`），**结构接近，全英文**，布局/信息架构对齐良好 | 无重大差距 | 低 |
| 分享按钮 | "Share" | `分享`（中文按钮，`AI credits` 卡片英文：`Buy credits or upgrade your plan before a heavy AVA run.` + `Upgrade`） | 语言不统一（同一个 header 里中英并列） | 中 |
| Deep Research 模式切换 | ✦ Deep Research 快捷标签内嵌在输入框 | 现状是独立的 Tab 按钮组 `Chat` / `Deep Research`（英文，位置更显眼，非输入框内联标签） | 布局不同（信息架构变了，非纯 token 差距） | 中——如果保留现状架构需要在 p17 明确这是有意简化还是要向设计对齐 |

### 1.2 AI Store（agent 商店）

**设计稿**（bundle.html → Store rail）：左侧两组导航——`BROWSING`（Explore / Subscribe）+
`CREATION`（Create / Authorized / Shared），主区 "Explore" 标题 + 结果计数 + "+ Create" 按钮 + 搜索框
`Search by name or description…` + 分类 tab（Agents/Skills/Templates/Image Tools）+ tag chips
（Strategy/Research/Writing/Data/Design/Meetings）+ 卡片网格（图标+名称+作者+描述+♡ 收藏数+👁 浏览数+
Subscribe 按钮），"★ FEATURED" 标签置顶。

**现状**（`/ai-store`）：

| 区块 | 设计 | 现状 | 差距类型 | 优先级 |
|---|---|---|---|---|
| 左侧分组标题 | `BROWSING` / `CREATION` | 现状同样是 `BROWSING` / `CREATION` 两组，子项 `Explore`/`Subscribe`/`Create`/`Authorized Agents`/`Shared`，**英文命名基本一致**（"Authorized Agents" 比设计的 "Authorized" 更完整，属于优化） | 无重大差距 | 低 |
| 搜索框 placeholder | `Search by name or description…` | `Search AI Store`（更短，信息量略少） | 文案差异（小） | 低 |
| 分类 tab | Agents / Skills / Templates / Image Tools | `All` / `Agent` / `AI Tool` / `Image Tool` / `Template`（多了 "All"，"Skills" 改叫 "AI Tool"，单复数不统一：Agent 是单数，其余是复数） | 分类命名与设计不完全对应，且现状内部单复数不一致 | 中 |
| Tag chips | Strategy/Research/Writing/Data/Design/Meetings（首字母大写） | `research`/`writing`/`design`/`productivity`/`meetings`/`featured`（全小写，多了 featured/productivity，少了 Strategy/Data） | token/大小写规范不一致 + 标签集合本身不同 | 中 |
| 卡片交互文案 | `♡ 2.1k · 👁 12k` `Subscribe` | `喜欢 👁 9100` `Subscribe`（**"喜欢" 是中文**，混入英文卡片中；数字格式也不同：设计用 `2.1k` 千分位缩写，现状是裸数字 `9100`） | 语言不统一（"喜欢"是现状唯一的中文元素） + 数字格式风格不同 | 高——"喜欢"是全屏唯一一处中文，非常突兀 |
| 结果计数 | "12 results"（现状） vs 例（设计里为 3，两边都用相同格式） | 一致 | 无 | — |
| Featured 徽章 | `★ FEATURED` | `★ FEATURED`，一致 | 无 | — |

### 1.3 Surveys（问卷）

**设计稿**（bundle.html → Survey rail）：Tab 切换 `My Surveys` / `Team Surveys` / `Room Surveys`，
下方是**数据表格**（列：Survey / Scope / Responses / Status），示例行含 4 条问卷（`Q2 Customer
Satisfaction` Team·248 responses·Published；`Alpha Beta Feedback` Room·Alpha·37·Published；
`Onboarding Pulse` Team·—·Draft；`Pricing Survey` Team·512·Closed），每行有 `View` + `⋯` 操作。

**现状**（`/surveys`，空态）：

| 区块 | 设计 | 现状 | 差距类型 | 优先级 |
|---|---|---|---|---|
| 顶部 tab 分组 | `My Surveys` / `Team Surveys` / `Room Surveys` | **完全没有** scope tab，只有 `Surveys` 标题 + `New survey` 按钮 | 缺失组件——设计的核心信息架构（按归属域筛选）现状未实现 | 高——如果 p17 要对齐设计，这是结构性改动，不是纯 CSS |
| 列表呈现形式 | 数据表格（Survey/Scope/Responses/Status 四列 + 行内操作） | 现状是空态卡片（`No surveys yet` + 说明段落 + `Create survey` 按钮），未验证有数据时是否是表格还是卡片网格（本轮账号无既有问卷，未能进一步截图） | 未覆盖——需要下一轮建一条真实问卷后再截图对比列表态 | 中——需要补验证 |
| 空态文案 | 设计未展示空态（默认有示例数据） | `No surveys yet` / `Create a survey to collect responses and share it with answerers.`，**全英文，文案质量好** | 无语言问题，但信息架构（scope tab）差距仍在 | — |
| Status 徽章 | Published / Draft / Closed（语义色区分） | 未验证（现状空态无数据行可对比） | 未覆盖 | 中 |

### 1.4 Admin（后台管理，仅 SysAdmin）

**设计稿**（bundle.html → Admin rail）：`Admin Panel` 标题，四个二级 tab `Overview` / `Users` /
`Teams` / `Store Approval`。Overview 展示统计卡片 `12.4k Total users`、`880 Teams`、
`23 Pending approvals`、`4.2M Tokens / day` + `Usage · last 14 days` 图表区。Users tab 是数据表格
（User/Role/Credits/Joined 列 + 每行 $/⧉/✎/🗑 操作图标），顶部有搜索框
`Search by email…` + `All`/`Admin`/`User` 筛选 + `+ Add user`。

**现状**（`/admin` + `/admin/users`，源码 `apps/web/app/(app)/admin/admin-home.tsx`
全文件、`apps/web/app/(app)/admin/users/page.tsx`）：

| 区块 | 设计（全英文） | 现状（源码逐字确认，全中文） | 差距类型 | 优先级 |
|---|---|---|---|---|
| 页面标题 | `Admin Panel` | `后台管理`（admin-home.tsx:122） | **语言** | **最高** |
| 副标题 | — | `平台统计摘要与管理模块导航`（line 123） | 语言 | 最高 |
| 统计卡片标签 | `Total users` / `Teams` / `Pending approvals` / `Tokens / day` | `用户总数` / `团队总数` / `AI Store 项目数`（line 111-113，且**没有** Pending approvals / Tokens per day 这两项——统计维度本身比设计少） | 语言 + 缺失指标 | 最高 |
| 占位徽章 | — | `占位`（mock 数据角标，line 148，中文） | 语言 | 高 |
| 模块导航卡片标题 | `Users` / `Teams` / `Store Approval` | `用户管理` / `团队管理` / `AI Store 审核` / `AI Store 精选`（line 32/40/48/56，四张卡片，设计只有 3 个 tab 没有细分"审核"和"精选"两个卡片——现状信息架构比设计更细） | 语言 + 结构差异（现状拆得更细） | 最高 |
| "即将上线" 徽章 | — | `即将上线`（line 180，AI Store 审核/精选两个卡片当前未建成，用这个徽章诚实标注——**这个设计意图是好的**，只是文案语言问题） | 语言 | 高 |
| Users 列表标题/搜索/按钮 | `Search by email…` / `All`/`Admin`/`User` / `+ Add user` | `用户管理` 标题、`查看、搜索、创建/编辑/删除用户，手动上分` 副标题、搜索框 placeholder `按邮箱或姓名搜索…`、`查询`/`重置` 按钮、`添加用户` 按钮 | 语言 | 最高 |
| Users 表格列 | User / Role / Credits / Joined | 未来得及在本轮截图确认（页面渲染到搜索区即可确认语言，表格本体因测试账号无其他用户数据未验证列头文案，但已可判定整屏基调是中文） | 未覆盖（列头细节） | 中——不改变整体判断 |

**Admin 模块结论**：这是四个模块里**语言差距最大、最系统性**的一个——不是个别文案漏翻译，
而是整个模块（标题/副标题/统计标签/卡片标题/按钮/占位符/徽章）从设计到实现全部替换成了中文，
与 Home/Sidebar/AI Store/Surveys 的英文基调形成鲜明反差。且现状统计维度（用户总数/团队总数/
AI Store 项目数）比设计（Total users/Teams/Pending approvals/Tokens per day）少两项——
"Pending approvals" 和 "Tokens / day" 这类运营强相关指标现状完全没有。

---

## 2. 跨模块通用问题

1. **文案语言不统一（本轮最大的跨模块发现）**——不是简单的"某几个字符串忘翻译"，而是**按模块整体倾向**
   分裂成三档：
   - 纯英文：AI Store（除"喜欢"一处）、Surveys（空态）、Sidebar rail 标签、Ava 的会话分组/模型选择器。
   - 纯中文：**Admin 整个模块**、Ava 的空态标题+建议 chip+分享按钮、Board 画布工具条
     （`选择`/`平移`/`便利贴`/`手绘`/`文本`/`连接线`/`形状`/`资源`/`嵌入`/`模板`/`撤销`/`重做`，
     见 `apps/web/components/board/board-canvas.tsx:767-908`）、`/boards`（"最近白板"）列表页。
   - 同屏混排（两种语言在同一个视觉区域内并存，比"整屏一种语言"更刺眼）：Ava 顶部
     header（英文 "AI credits" 卡片 + 中文 "分享" 按钮同一行）、AI Store 卡片（英文卡片信息中
     嵌一个中文"喜欢"）、Home dashboard（英文 "Profile"/"Settings" 按钮旁一个中文"登出"按钮）。
   - **根因猜测**：这些中文字符串大多数是`data-testid`旁边的展示文案，看起来是不同批次开发时
     直接写了母语字符串、没有走统一的 i18n/文案规范检查——`sidebar.tsx` 甚至连 `aria-label`
     （无障碍层，用户通常看不到）都写成中文（"主导航"/"账号菜单"/"切换主题"），说明这不是"英文
     文案没写完"，而是整个团队没有一套"新页面必须用英文"的默认约定或 lint 规则。
   - phase-p16 F03（design lint 覆盖扩大）如果要抓这类问题，建议直接规则化：**新增/改动的
     用户可见文案默认应为英文**（除非该页面本身是设计明确要求中文的，本项目目前没有这种页面），
     lint 应该能扫出 JSX 文本节点/`label`/`title`/`placeholder`/`aria-label` 属性中的中文字符
     （Unicode CJK 范围）并报警。

2. **信息架构缺口 vs 纯视觉差距的比例**——四个模块里，Ava 和 AI Store 主要是**视觉/文案层面**的差距
   （token、语言、措辞），可以用 reskin 方式解决；而 **Surveys 缺少 scope tab（My/Team/Room）**、
   **Admin 缺少 Pending approvals / Tokens per day 统计维度**属于**信息架构层面**的差距，
   需要先补数据模型/API（谁的问卷属于哪个 scope、token 用量怎么统计），reskin 之前可能要先过一轮
   产品澄清，不能直接套用 P0-P4 那种"改 token/组件基座即可"的轻量 reskin 打法。

3. **占位/mock 数据的诚实标注是好实践，值得保留**——Admin 的 `占位` badge 和 `即将上线` badge
   （`admin-home.tsx` line 148/180）是很克制的设计（不假装功能已建成），这个模式在 p17 reskin 时
   应该保留其行为逻辑，只需要把文案换成英文即可，不要连这个"诚实标注"的机制一起去掉。

4. **数字格式风格不统一**——设计用千分位缩写（`2.1k`/`12k`/`12.4k`/`4.2M`），现状 AI Store 卡片是裸数字
   （`9100`/`7600`）。这个是较小的 token 层差距，reskin 阶段顺手可以统一成缩写格式（可复用同一个
   格式化 util）。

---

## 3. 给 phase-p17 reskin 工作的优先级建议

按"影响面 × 修复成本"排序：

1. **P0 — Admin 模块整体英文化**（最高优先级，最大反差点）。工作量小（都是静态字符串替换，无
   信息架构改动），影响面大（整个模块，且是 SysAdmin 高频操作页）。建议同一批把
   `admin-home.tsx`、`admin/users/page.tsx`、`admin/teams`、`admin/coming-soon.tsx` 一起处理，
   顺带把统计卡片补齐 `Pending approvals`/`Tokens per day`（如果后端暂无这两个数据源，至少先用
   `占位`→`Placeholder` 的英文 mock 徽章占住 UI 位置，避免这轮只做语言不做结构又要再翻工）。

2. **P0 — Ava 空态 + 分享按钮英文化**（`ava/page.tsx` line 151-154/1215 的建议 chip 与标题，
   "分享"按钮）。这是用户第一次打开 Ava 就会看到的空态，可见度最高，工作量也是纯文案替换。

3. **P1 — AI Store "喜欢"单点修复**（`ai-store/store-browser.tsx`，具体行号下一轮实现时定位）。
   全屏唯一中文词，改起来是最低成本的一处，建议和 P0 一起顺手做掉。

4. **P1 — 全局文案 lint 规则化**（对应 F03）：与其逐个模块人工找中文，不如先把"新文案默认英文"的
   lint 规则建起来，让后续所有 p17 reskin PR 自动卡住残留中文，避免本轮修完、下轮又混进新的。

5. **P2 — Surveys 增加 scope tab（My/Team/Room Surveys）**：这个需要先确认后端 API 是否已经能
   区分 survey 的归属域（个人/团队/room），如果数据模型已支持，只是前端加个 tab filter，成本不高；
   如果后端还没有这个字段，需要先补一个小的 requirement 澄清，不建议在 p17 reskin sprint 里直接
   摸黑实现。

6. **P2 — AI Store 分类 tab 命名对齐设计**（Skills→AI Tool 的映射、Tags 大小写统一、补
   Strategy/Data 标签或说明为什么现状用 research/productivity 代替）——视觉细节级，优先级低于
   语言统一类问题。

7. **P3（可选，工作量较大，需要先立项）** — Ava 对话内的消息操作按钮（Edit/Delete/Copy/
   Regenerate/Send to board）、Surveys 列表数据表格化、Admin Users 表格逐列文案 —— 这些本轮
   因测试账号无真实数据未能截图验证，建议下一轮先造测试数据（seed 一条已发送的 Ava 对话 + 一条
   已发布的 survey + 多个 admin 列表用户）再针对性核对，避免在没看到真实渲染态之前就动手改。

---

## 附：本轮取证的已知局限

- 未落盘图片文件（`docs/design/ui-gap-round2-screenshots/` 目前为空）——Preview 工具的
  `preview_screenshot` 无 `save_to_disk` 选项，本文档用 accessibility snapshot（逐字文案）+
  源码行号代替截图作为可复核证据；下一轮如需要图片存档，建议改用 Playwright
  `page.screenshot({ path: ... })` 脚本跑一遍四个路由自动落盘。
- Ava 的多轮对话消息操作、Surveys 有数据时的列表形态、Admin Users 表格列头未能在真实渲染态下
  验证（本轮测试账号是全新账号，无历史数据）——已在 §3 P3 中列为下一轮待办，不影响本轮已发现的
  语言/结构差距结论。
- Board（`/boards`、`board-canvas.tsx`）不在本 feature 的四个目标模块内，但因为任务 brief 明确要求
  记录"工具条中文 vs sidebar 英文"这个已知案例，本文档在 §2.1 用源码引用的方式核实并记录，
  未对 Board 模块做完整的设计稿逐屏对比（那是独立的审计范围，`boardx-prototype-mapping.md` §2.3
  已经覆盖过 Board 的雏形映射）。
