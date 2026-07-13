---
name: mod-ai-store
description: >
  激活条件：接到 AI Store（智能体商店） 模块的 feature/bug/review/勘探任务时，动手前先读本 skill。
  这是该模块的活知识库（定位/代码地图/契约/经验），由每个在此干活的开发者与 agent
  持续回流迭代（规则见文末）。
---

# AI Store（智能体商店） — 模块知识库

> 本文件是 ai-store 模块的**单一经验沉淀点**（人类拍板 2026-07-12：每模块一个 skill，
> 让任何开源开发者都能持续迭代模块的 SOP/技巧/知识结构）。读完你应该知道：
> 代码在哪、什么不能破坏、前人踩过什么坑。

## 一句话定位
Agent 的发布/评审/安装/分享：store 列表、team 评审流（admin 侧 review）。

## 代码地图
- 页面：`apps/web/app/(app)/ai-store/`（`store-browser.tsx` 是核心组件，Explore/Subscribe/Create/Authorized/Shared 五个视图都在这一个文件里）、
  `apps/web/app/(app)/ai-store/share/[id]/page.tsx`（分享落地页，服务端 redirect）、
  `apps/web/app/(app)/teams/[id]/ai-store-review/page.tsx`（团队侧评审入口）、
  `apps/web/app/(app)/admin/ai-store/review/page.tsx` + `featured/page.tsx`（平台侧审核/精选）。
- 全局导航：`apps/web/components/app-shell/sidebar.tsx` 的 `RAIL_ITEMS`（AI Store 的
  rail 入口在这里，见下方"踩坑"——曾经很长一段时间不存在）。
- 数据：`packages/data/src/aiStore.ts`（主表 + 审核/精选）、`aiStoreSubscriptions.ts`
  （订阅）。

## 关键契约与不变量（改代码前必读）
- 上架必经评审流，评审动作要留痕（谁批的/何时）。
- `store-browser.tsx` 里任何"读一次性 URL 参数 / 拉取列表数据"的逻辑，动之前先读下面
  "踩坑与经验"里 share-url 竞态那条——同一类根因在这个文件里出现过不止一次。

## 关联阶段 / ADR / 文档
phases/phase-p11-ai-store

## 模块 SOP
1. 动手前：读本文件 + 对应 feature 的 `user_visible_behavior`/`verification`；跑 `pnpm harness doctor --phase <相关 phase>` 确认没接手一个带审计债的现场。
2. 开发中：独立 worktree（ADR-005）；UI 改动跑 `lint-design.sh`；敏感 area（auth/billing/admin/share/invite）主动挂 rev-security。
3. 交付：`verify --sprint` 门控；PR 描述里写清对上述契约的影响面。
4. 收尾：有新经验 → 按下方规则回流本文件。

## 踩坑与经验（append-only，最新在上）
- 2026-07-08：**新增顶层页面记得同步全局 sidebar 入口，光有内部子菜单不够**。
  AI Store 自己的左侧子菜单（探索/订阅/创建/已授权/已分享）一直做得很完整，但
  `components/app-shell/sidebar.tsx` 的全局 `RAIL_ITEMS` 里长期没有 Store 的入口——
  p16-F01 补 Ava/Surveys/Admin 三个全局入口时的 notes 里已经承认"AI Store 入口已存在
  （home 页空态按钮），本 feature 不重复处理"，但从未真正跟进，用户只能靠 home 页
  空态按钮间接摸到或手敲 URL。人类用户直接反馈截图才发现。教训：一个页面/模块自己
  内部导航再完整，不代表全局能发现它；新增顶层路由时要同时检查 sidebar rail，不要
  假设"之前谁谁谁说过要顺手做"就等于已经做了。（出处：PR #475）
- 2026-07-08：**e2e 断言不要去抓一个应用代码"故意、主动"清理掉的瞬时状态**。
  `ai-store-005-share-management.spec.ts` 曾断言分享落地后 URL 仍带着
  `?nav=authorized&shared=...` 查询参数——但 `store-browser.tsx` 的挂载 effect 会
  读完这些一次性参数后立刻清空它们（这是有意设计：不留分享 token 相关信息在地址栏/
  历史记录里）。断言一个"读完就要被清空"的状态，天生和清空动作抢时序，抓不抓得到全看
  运气。修法：改断言目标为清空完成后的稳定终态（干净 pathname + 卡片/提示文案），
  而不是想办法卡时机去抓那个瞬间——`toHaveURL` 的轮询会自然等到稳定态出现，不需要
  和应用代码的清理逻辑赛跑。同理适用于任何"一次性展示后自我清理"的 UI 模式。
  （出处：PR #430）
- 2026-07-08：**"点击后按钮文案变了"不等于"服务端写入已经落地"，测试和代码都可能
  被这个假象误导**。`ai-store-003-subscribe-use-item.spec.ts` 反复出现"订阅后没有
  出现在已订阅列表"的偶发失败，一度被误判为"主机资源紧张导致环境噪音"（花了好几轮
  排查、加大 timeout 到 20s 都没能稳定复现修复）。真正原因：`subscribeItem()` 的
  `setSubscribedIds` 乐观更新发生在 `await fetch(...)` **之前**，详情弹窗按钮文案
  几乎瞬间从 Subscribe 变成 Unsubscribe，早于 POST 真正到达服务端、事务提交——用
  DB 直接核对过写入本身完全正确，是测试在按钮文案变化后就立刻去读订阅列表，读到了
  写入还没落地的窗口。修法：显式 `page.waitForResponse` 等这次 POST 的真实网络响应，
  而不是等 UI 文案或加大 timeout（等错信号，加多少 timeout 都不稳定）。（出处：PR #459）
- 2026-07-08：**⚠️ 上面这条修的是"测试怎么等"，不是"应用代码本身的竞态"——真正的
  应用层竞态可能仍未修**。事后翻历史发现，2026-07-05 有另一个完全独立、未经协调的
  会话（分支 `claude/pensive-wiles-8a8154`，commit `0730653`）已经诊断出**几乎同一个
  症状**并给出了应用代码层面的修复：① `loadSubscribed()` 在挂载/切视图/订阅成功三处
  都会被并发调用，异步 resolve 顺序不保证和调用顺序一致，早发晚至的响应会用旧数据
  覆盖新数据——修法是加一个自增请求序号，只接受"最新发起的那次调用"的结果，丢弃过期
  响应；② `subscribeItem()` 里判断是否要刷新用的是发起时 `nav` 的闭包快照，如果
  fetch 还没 resolve 时用户就已经手动切到了 Subscribe 视图，会永远读不到最新数据。
  这个分支**从未合并**（不是 main 的祖先），当时也没人知道有这个分支存在。核实
  现状（2026-07-10）：**main 上这两处应用代码层面的竞态依然原样存在**——我这次的
  PR #459 只是让测试不再依赖一个不可靠的 UI 信号，真实用户在网络抖动/多个并发操作
  时理论上仍可能遇到"已订阅但列表暂时没刷新"的旧数据覆盖问题，只是概率低、e2e 环境
  下的（更慢更不稳定的网络）更容易触发。**遗留跟进项**：值得考虑把 `0730653` 里的
  请求序号 + 修正 nav 闭包快照这两处应用代码修复正式补回来，做真正的根治而不只是让
  测试变绿。教训：两个完全不知道对方存在的会话独立解决了同一个问题，一个从应用代码
  下手做了根治，一个从测试下手让 CI 通过——只顾着让门禁转 passing 而不去翻一遍是否
  已经有人诊断过同一症状，可能会让更彻底的修复方案被埋没。（出处：PR #459、分支
  `claude/pensive-wiles-8a8154` commit `0730653`，未合并）

## 知识回流规则（本文件怎么迭代——这是这个 skill 存在的意义）

1. **谁干活谁回流**：在本模块交付 feature/修 bug/做 review 时，踩到新坑、建立新做法、
   推翻旧假设 → 在同一个 PR（或紧随的小 PR）往下方"踩坑与经验"**追加**一条：
   `- YYYY-MM-DD：一句话结论（出处：PR/issue/postmortem 链接）`。append-only，不删旧条目
   （被推翻的旧经验标 ~~删除线~~ 并注明被哪条取代）。
2. **module coordinator 每 C-cycle 复盘**：检查本周期内本模块合并的 PR，有值得沉淀而
   没回流的，补写（这是 ADR-010 "SOP 持续迭代"的落点）。
3. **结构变更**（新增章节/重组）走正常 review；追加"踩坑与经验"条目可随任意 PR 顺带。
4. 开源贡献者同权：任何人对本模块的经验修订都走 PR，以可验证事实为准，不看资历。
