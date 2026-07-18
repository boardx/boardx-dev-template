---
name: mod-room
description: >
  激活条件：接到 Room（房间/协作空间） 模块的 feature/bug/review/勘探任务时，动手前先读本 skill。
  这是该模块的活知识库（定位/代码地图/契约/经验），由每个在此干活的开发者与 agent
  持续回流迭代（规则见文末）。
---

# Room（房间/协作空间） — 模块知识库

> 本文件是 room 模块的**单一经验沉淀点**（人类拍板 2026-07-12：每模块一个 skill，
> 让任何开源开发者都能持续迭代模块的 SOP/技巧/知识结构）。读完你应该知道：
> 代码在哪、什么不能破坏、前人踩过什么坑。

## 一句话定位
多人协作的容器：房间生命周期、成员/邀请、房间内 Boards/Chats/Files/Surveys/Studio 分区导航（主从双栏 IA，见 p20/p22 重排）。

## 代码地图
- 页面：`apps/web/app/(app)/rooms/`（列表 + `[id]/` 下 boards/chats/files/members/studio/surveys 子页）
- 组件：`apps/web/components/room/`、`components/rooms/`、`components/room-files/`
- API：`apps/web/app/api/rooms/`
- 数据：`packages/data`（rooms/members 表；public_id 见 #471/#530/#586）

## 关键契约与不变量（改代码前必读）
- 房间列表左栏 + 详情右栏是**主从双栏**，不是互相跳转的两个整页（p20 核心修复，别退回去）。
- Files 在 Files-tab 与 Chat 内面板职责有边界约定（p20 需求文档）。
- rooms.public_id：对外 URL 用 public_id，内部 id 不外露；新建/复制必须补写（#586 的教训）。路由层用 `resolveRoomId(idParam)` 把 public_id 或旧数字 id 解析成内部 id（查无落 `-1` 哨兵，让既有 `if(!room) return 404` 接管，别让 `NaN` 直传 pg），不要在 route 里裸写 `Number(params.id)`。
- 房间元信息（name/description/ai_instruction/visibility）写路径统一走 `packages/data` 的 `updateRoom()`；删除走 `deleteRoom()`（FK 级联清 members/favorites/boards…）。

## 关联阶段 / ADR / 文档
phases/phase-p20-room-realignment、p22-room-ia-realignment、p24-room-board-management；ADR-001

## 模块 SOP
1. 动手前：读本文件 + 对应 feature 的 `user_visible_behavior`/`verification`；跑 `pnpm harness doctor --phase <相关 phase>` 确认没接手一个带审计债的现场。
2. 开发中：独立 worktree（ADR-005）；UI 改动跑 `lint-design.sh`；敏感 area（auth/billing/admin/share/invite）主动挂 rev-security。
3. 交付：`verify --sprint` 门控；PR 描述里写清对上述契约的影响面。
4. 收尾：有新经验 → 按下方规则回流本文件。

## 踩坑与经验（append-only，最新在上）
- 2026-07-11：Room 设置别塞进 Members tab——改名/描述/AI instruction/删除拆到独立 `/rooms/[id]/settings`（tab 仅 owner/admin 可见），Members tab 只留成员/邀请/角色管理（人类反馈，issue #587）。房间元信息写路径统一走 `updateRoom(name/description/ai_instruction)`，rename 直接复用不必新建端点。
- 2026-07-11：`verify --sprint` 翻 passing 前查两坑——① feature 的 `sprint` 字段必须非 null（漏填会让 `--sprint` 匹配不到、只能走已被 #534 禁的 `--phase`，产出裸时间戳 evidence 被 doctor 判 FAIL）；② worktree 缺依赖（rebase 带进新包如 @repo/devportal）会让 `verify:base` 报 `Cannot find module`，先 `pnpm install`（出处：#541 F04 收尾）。
- 2026-07-10：做「现状差距/勘探」判断前先 `git fetch origin main` + `git rev-list --count HEAD..origin/main`——worktree 落后会把现状误报（p24 读了落后 17 commit 的旧 boards 页，把已是卡片版的现状误报成"纯文本行"，被人类真机截图纠正，#518）。用户真机跑的是 main。
- 2026-07-10：Room 内 Board 列表管理契约——卡片三点更多菜单（删/重命名/编辑标签/上传·移除封面/移动）+ 多标签（`boards.tags text[]`，migration 032，tag 过滤客户端做、allTags 从全量算）+ 封面直传（服务端 `putObject`→`cover` 存 objectKey→展示端点 `presignGetUrl` 302）；main 已有卡片化/Grid-List/创建弹窗，**扩展现有页别重造**（#518）。
- 2026-07-09：Room 的 Studio tab 是沉浸式全屏三栏工作台（脱房间壳：不渲染左侧房间列表 `room-list-panel`、不渲染六 tab，仅留最左 app 导航），不是落地页（人类 2026-07-09 拍板，#487 / p22 F03）。脱壳判断在 `rooms/layout.tsx` + `rooms/[id]/layout.tsx` 对 studio 路由做。
- 2026-07-09：前端泛文案「创建失败」= `res.json().catch(()=>({}))` 的兜底，只在**响应非 JSON**（服务端/DB 崩、返回 HTML 错误页）时出现；真 500 会显示具体 error 文本。多个不相关接口同时挂 → 优先查环境/DB（docker/资源耗尽），别当代码 bug 逐行找（team room「创建失败」排障结论）。
- 2026-07-11：#530 收紧 NOT NULL 后新建/复制 room 500——写路径没补 public_id（#586 修复）。凡加列收紧约束，先 grep 全部 INSERT 路径。

## 知识回流规则（本文件怎么迭代——这是这个 skill 存在的意义）

1. **谁干活谁回流**：在本模块交付 feature/修 bug/做 review 时，踩到新坑、建立新做法、
   推翻旧假设 → 在同一个 PR（或紧随的小 PR）往下方"踩坑与经验"**追加**一条：
   `- YYYY-MM-DD：一句话结论（出处：PR/issue/postmortem 链接）`。append-only，不删旧条目
   （被推翻的旧经验标 ~~删除线~~ 并注明被哪条取代）。
2. **module coordinator 每 C-cycle 复盘**：检查本周期内本模块合并的 PR，有值得沉淀而
   没回流的，补写（这是 ADR-010 "SOP 持续迭代"的落点）。
3. **结构变更**（新增章节/重组）走正常 review；追加"踩坑与经验"条目可随任意 PR 顺带。
4. 开源贡献者同权：任何人对本模块的经验修订都走 PR，以可验证事实为准，不看资历。
