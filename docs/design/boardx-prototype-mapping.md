# BoardX Prototype → 现有 app 映射（UI Mapping）

> 输入设计：`docs/design/boardx-prototype.bundle.html`（可直接浏览器打开预览）
> 解包后的 dc 模板（源真相）：`docs/design/boardx-prototype.template.html`
> 设计来源：claude.ai/design `p/5dc8a7e9-...`，文件 `BoardX Prototype.dc.html`
>
> 目标（用户指令）：**先做映射 → 再把所有 UI 按设计 pixel-faithful 重构**。
> 本文是第 1 步「映射」的产物，作为重构的权威参照。

---

## 0. 设计的形态

原型是一个 **单页 SPA**（dc 模板 + `data-dc-script` 状态机），4 个顶层 route：
`auth` / `home` / `ava` / `room`，外加桌面「App Shell」内部的 icon rail 子区。
它同时内置 **5 个外壳（shell）**：

| Shell | 用途 | 现有 app 对应 |
|---|---|---|
| **Mobile Shell** | 390×800 手机壳：Home / Rooms / Ava / Profile + 底部 tab bar | ⚠️ 无（现有 app 仅桌面响应式） |
| **Auth** | 登录 / 注册 / 忘记密码 / 重置 | ✅ `app/(auth)/*` |
| **App Shell（桌面）** | icon rail + 主区，承载绝大多数桌面页面 | ✅ `app/(app)/layout.tsx` + `components/app-shell/sidebar.tsx` |
| **Board（全屏画布）** | FigJam 式白板：widgets/连线/AI float/工具条/计时器/分享… | 🟡 `app/(app)/boards` + `components/board/*`（雏形） |
| **Room Workspace（3 栏）** | Studio / Room Chat：左 sources · 中 chat · 右 studio 工具 | ❌ 无 |

---

## 1. 设计系统 token 映射

设计是 **单色中性灰 + 柔和语义色** 体系，与现有 `globals.css` 的黑白灰 HSL 体系**高度一致**，
但需要微调灰阶并**补语义柔彩**。

### 1.1 中性灰（与现有 token 对照）

| 设计 hex | 用途 | 现有语义 token | 动作 |
|---|---|---|---|
| `#fff` | 背景 | `--background 0 0% 100%` | ✅ 一致 |
| `#181818` | 正文 | `--foreground 0 0% 0%` | 🔧 微调到 ~9.4%（设计正文非纯黑） |
| `#000` | 强调/主按钮 | `--primary 0 0% 0%` | ✅ 一致 |
| `#282828`/`#383838` | 深色面（rail、tooltip、dock） | （无）| 🔧 新增 surface-dark 档 |
| `#505050`/`#707070` | 次要文字 | `--muted-foreground 0 0% 40%` | 🔧 对齐 ~31%/44% |
| `#909090`/`#a0a0a0` | 占位/弱文字 | （无中间档） | 🔧 补 placeholder 档 |
| `#c8c8c8`/`#d4d4d4` | 强边框/分隔 | — | 🔧 补 border-strong |
| `#e0e0e0` | 默认边框 | `--border 0 0% 85%` | 🔧 对齐到 88% |
| `#f0f0f0`/`#f5f5f5` | 浅面/hover | `--muted/--accent 0 0% 94–96%` | ✅ 接近 |
| `#fafafa`/`#f8f8f8` | 极浅面 | `--card 0 0% 96%` | ✅ 接近 |

### 1.2 语义柔彩（现有 token **缺失**，必须新增）

| 设计 hex | 含义 | 建议 token |
|---|---|---|
| `#d8efe6` | 绿 / 成功-soft / 标签 | `--tag-green` |
| `#dbe8f7` | 蓝 / 信息-soft | `--tag-blue` |
| `#e6e0f5` | 紫 / AI-soft | `--tag-purple` |
| `#fde2dd` | 粉红 / 警示-soft | `--tag-pink` |
| `#fff7cc` | 黄 / 便签-soft | `--tag-yellow` |
| `#e5484d` | **真红** destructive | 🔧 现有 `--destructive` 是灰(30%)，设计是真红 → **需改语义** |

### 1.3 字号 / 圆角 / 字重

- 字号主轴：**13 / 12 / 11 px**（正文/二级/标签），标题 22 / 24 / 26 / 17 / 16。
- 圆角主轴：**8px**（`--radius 0.5rem` ✅），常用 7 / 9 / 12 / 6。
- 字重：**600 主导**，标题 700，次要 500。
- 字体栈：`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`。

> 结论：token 层 80% 可复用现有体系，需 3 类改动：①微调灰阶 ②新增 5 档柔彩 ③destructive 改真红。
> 全部集中改 `globals.css` + `tailwind.config.ts`，组件只用语义类（符合 uiux-standards）。

---

## 2. 屏幕级映射表

状态图例：✅ 已存在（需重构对齐设计）｜🟡 部分存在｜❌ 设计有/现无（新建）

### 2.1 Auth
| 设计 | 现有文件 | 状态 |
|---|---|---|
| SIGN IN | `app/(auth)/login/page.tsx` | ✅ 重构 |
| SIGN UP | `app/(auth)/register/page.tsx` | ✅ 重构 |
| FORGOT | `app/(auth)/forgot-password/page.tsx` | ✅ 重构 |
| RESET | `app/(auth)/reset-password/page.tsx` | ✅ 重构 |

### 2.2 App Shell（桌面主区）
| 设计 | 现有文件 | 状态 |
|---|---|---|
| icon rail（多区：Home/Rooms/Ava/Store/Surveys/KB/Admin/Teams/Credits/Profile） | `components/app-shell/sidebar.tsx`（仅 4 项） | 🟡 大改 |
| HOME（agent 分组：subscribed/recent/team-recommended + 搜索 + 快捷动作） | `app/(app)/home/page.tsx` | 🟡 重构 |
| ROOMS（列表） | `app/(app)/rooms/page.tsx` | 🟡 重构 |
| ROOM DETAIL（Boards/Members/Files tab） | （无独立详情） | ❌ 新建 |
| AVA（AI 助手 chat：空态建议/消息/research card/clarify/plan/running 时间线/report 面板） | （无） | ❌ 新建（大） |
| STORE（agent 商店：submenu + 内容 + 详情/创建 modal） | （无） | ❌ 新建 |
| SURVEYS（list / editor / answer-preview / results-report） | （无） | ❌ 新建（大） |
| KNOWLEDGE BASE（文件 + 上传队列 + upload dialog） | （无） | ❌ 新建 |
| ADMIN（overview/users/teams/store-approval + 多 modal） | （无） | ❌ 新建（大） |
| TEAM MANAGEMENT（home/general/members/memory） | `app/(app)/teams/page.tsx` | 🟡 重构+补 tab |
| CREDITS（额度 + buy credits modal） | （无） | ❌ 新建 |
| PROFILE / account center（personal info/settings/personal memory） | `app/(app)/account/page.tsx` | 🟡 重构+补 tab |

### 2.3 Board（全屏画布）
| 设计区块 | 现有 | 状态 |
|---|---|---|
| header / canvas viewport / box widgets / 便签 | `components/board/board-canvas.tsx`,`canvas-viewport.tsx` | 🟡 已有 P6 雏形，重构对齐 |
| connectors / snap guides / marquee / 协作光标 | 部分 | 🟡 |
| widget menu / multi-select bar / zoom control | P6 有 widget menu | 🟡 |
| AI float / board chat docked panel | （无） | ❌ 新建 |
| FigJam bottom toolbar | （无） | ❌ 新建 |
| timer 运行覆盖 / timer 设置面板 | `components/board/timer.tsx` | 🟡 重构 |
| share panel / more menu / slides sidebar / context menu | （无） | ❌ 新建 |

### 2.4 Room Workspace（3 栏 Studio / Room Chat）
| 设计区块 | 现有 | 状态 |
|---|---|---|
| 左：room sources / 中：chat / 右：studio 工具（audio/slides/infographic 生成 modal） | （无） | ❌ 新建（大） |

### 2.5 Mobile Shell
| 设计区块 | 现有 | 状态 |
|---|---|---|
| 手机壳 Home / Rooms / Ava / Profile + 底部 tab bar | （现有 app 仅桌面响应式，无独立移动壳） | ❌ 待定（见决策） |

### 2.6 Modal / Dialog 清单（设计内置 ~20 个）
new room · room settings · store detail · store create · add question · kb upload ·
admin(manual credit / delete user / team edit / approval) · buy credits ·
memory delete confirms · studio generate(slides / infographic / audio) · toast。
→ 现有 app **基本无弹窗体系**，需建统一 Dialog/Toast 基座。

---

## 3. 现状 vs 设计：差距总览

- **可直接重构对齐**（已存在）：Auth ×4、Home、Rooms、Teams、Account、Board 雏形。≈ 现有 app 的全部。
- **设计有 / 现无（需新建）**：Ava、Store、Surveys、Knowledge Base、Admin、Credits、Room Workspace、
  Board 的 AI/工具条/分享/slides、Room Detail、整套 Modal/Toast、（可选）Mobile Shell。
- 设计的体量约为现有 app 的 **3 倍**。「重构所有 UI」据此分两类工作：**重皮（reskin）** vs **新建（build）**。

---

## 4. 重构计划（已确认范围）

> **用户确认范围（2026-06-30）**：**只 reskin 现有页**，不新建设计独有页面；**暂时跳过 Mobile Shell**。
> 因此 §2.2 中标 ❌「新建」的页面（Ava/Store/Surveys/KB/Admin/Credits/Room Workspace）
> 与 §2.5 Mobile Shell **本轮不做**，留作后续。
>
> 原则：先立地基（token），再按外壳逐屏 reskin；每屏改完用现有验证路径自测留证。

- **P0 地基** ✅：`globals.css`+`tailwind.config.ts` 落设计 token（灰阶/柔彩/真红 + 字号/间距/圆角/宽度网格）。
  `Input`/`Button` 基座对齐设计（h-10、8px 圆角、semibold、hover #282828）。
- **P1 Auth** ✅：login/register/forgot/reset 4 屏 reskin → 新增 `components/auth/auth-shell.tsx`（深色品牌面两栏）。
- **P2 App Shell + 导航** ✅：`sidebar.tsx` 重构为 60px icon rail（logo + Home/Rooms + 主题切换 + 账号弹出菜单），保留现有目的地（Teams/Profile 进账号菜单）。
- **P3 已有页 reskin** ✅：`/`(dashboard) · `/home`(agent 分组) · `/rooms`(卡片网格) · `/teams`(成员行) · `/account`(左导航两栏)。
- **P4 Board 画布 chrome** ✅：便签改设计柔彩（#fff7cc/#dbe8f7/#d8efe6/#fde2dd，7px 圆角）；header/toolbar/zoom/timer/widget-menu 经基座继承设计。未新建 AI float/share/slides 等设计独有件。

### 证据
- token/typecheck：`cd apps/web && npx tsc --noEmit`（exit 0）。
- 设计门控：`cd apps/web && bash scripts/lint-design.sh`（全部通过）。
- 视觉：各阶段 Playwright 截图比对设计（auth 两栏、icon rail、home/rooms/teams/account、画布柔彩便签）均一致。
- 功能：auth 全流程在隔离 3100 上 register→login→落地 `/`、`current-user` 正常；代表性 e2e 子集在 3100 通过。
- **不变量**：所有现有 `data-testid` 与服务端错误串保留；e2e 选择器不依赖被改文案。

### 仍待办（本轮范围外，已与用户确认暂不做）
- 设计独有页：Ava / Store / Surveys / KB / Admin / Credits / Room Workspace（3 栏 Studio）。
- 整套 Modal/Toast 体系、Board 的 AI float / share / slides / FigJam 工具条。
- Mobile Shell（移动端手机壳）。
- 收尾走 `.harness/rubrics/clean-state-checklist.md`。
