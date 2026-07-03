# 原始需求 — UI 导航接线与差距审计（Phase p16）

## 背景 / 为什么做

2026-07-03 的流程复盘发现：Ava（AI 对话，核心产品能力）、Surveys（问卷）、Admin（对
SysAdmin）这三个模块都已经有多个 feature `passing`（功能本身端到端可用），但**全站没有
任何导航入口**——真实用户注册登录后，永远不会在任何按钮/菜单里看到它们，只有手动敲
URL 才能到达。根因是 `pnpm harness verify` 只验证"给定 URL，行为符合预期"，从不验证
"用户能不能从产品里走到这个 URL"。

同时，`docs/design/boardx-prototype-mapping.md`（2026-06-30 产出）明确记录了 Ava/Store/
Surveys/Admin 这些模块当时"本轮不做 reskin，留作后续"——但这些模块后来已经被功能
pipeline 实现完，从未回头对照 prototype 做过 UI 对齐审计，两条线完全脱钩。

本阶段是后续 reskin 工作（phase-p17）的地基：先把已有功能接上导航让用户找得到，
再做一次系统性的差距审计产出权威 gap 表，reskin 才有依据可循。

## 原始需求

- 作为已登录用户，我想要在导航（sidebar rail 或 account 菜单）里看到 Ava 的入口，
  以便我能开始和 AI 助手对话，而不需要知道 `/ava` 这个 URL。
- 作为已登录用户，我想要在导航里看到 Surveys 的入口，以便我能创建/管理问卷。
- 作为 SysAdmin，我想要在导航里看到 Admin 后台的入口，以便我能进入后台管理，而不需要
  手动敲 `/admin`；作为普通用户，我不应该在导航里看到这个入口。
- 作为产品/设计负责人，我想要一份 Ava/Store/Surveys/Admin 当前真实页面 vs
  `docs/design/boardx-prototype-v1.bundle.html` 对应设计稿的并排差距报告，以便后续
  reskin 工作有权威依据，而不是每个 worker 各凭感觉写 UI。
- 作为工程负责人，我想要新增页面也被 design lint（`apps/web/scripts/lint-design.sh`）
  覆盖，以便中英文案混用、token 用错这类问题在 CI 就被拦下，而不是留到人工发现。

## 验收线索

- 一个新注册用户登录后，不需要知道任何 URL，点几下鼠标就能进入 Ava 对话、Surveys
  列表；SysAdmin 账号能看到 Admin 入口，普通账号看不到。
- 有一份文档（结构类似 `boardx-prototype-mapping.md`）逐屏列出 Ava/Store/Surveys/
  Admin 当前实现 vs 设计稿的差距，附真实截图对比。
- `lint-design.sh` 跑过新增的 Ava/Store/Surveys/Admin 页面文件，能检测出中英文案混用
  等既有问题（用现状里已知的 Board 工具条中文标签 vs Home/Sidebar 英文标签这个真实
  案例来验证 lint 确实能抓出来）。

## 范围与边界

- 本阶段要做：导航接线（复用已确认的 P0-P4 rail 设计模式，不发明新视觉）、差距审计
  （产出报告，不动代码）、design lint 覆盖扩大。
- 明确不做：任何像素级 UI 重构（reskin 本身）——那是 phase-p17 的范围，且 p17 按
  ADR-003 需要先过 UI 先行确认关卡才能开工。
- Studio/Presentations 保持现状（room-chat 内嵌面板可达即可，不需要独立顶层入口，
  这是设计上合理的，不在本阶段范围）。

## 已知约束 / 依赖

- 依赖 p9(ava-chat)/p11(ai-store)/p13(survey)/p15(admin) 的现有功能与页面已存在。
- Admin 入口的显隐要用真实的 SysAdmin 判定（复用 `apps/web/lib/admin.ts` 的
  `requireSysAdmin`/等价的客户端可读判定，不要重新发明鉴权逻辑）。

## 切分提示

- F01 导航接线（Ava+Surveys+Admin 条件显示）— 一次会话可完成，纯前端接线 + e2e。
- F02 UI 差距审计 — 建议用 ui-prototyper 或等价的截图比对流程完成，产出物是文档
  而非代码，不阻塞 F01。
- F03 design lint 覆盖扩大 — 独立、机械性改动，与 F01/F02 无依赖顺序。
- 三者互不依赖，可并行。
