---
name: mod-ava
description: >
  激活条件：接到 AVA（AI 对话与深度研究） 模块的 feature/bug/review/勘探任务时，动手前先读本 skill。
  这是该模块的活知识库（定位/代码地图/契约/经验），由每个在此干活的开发者与 agent
  持续回流迭代（规则见文末）。
---

# AVA（AI 对话与深度研究） — 模块知识库

> 本文件是 ava 模块的**单一经验沉淀点**（人类拍板 2026-07-12：每模块一个 skill，
> 让任何开源开发者都能持续迭代模块的 SOP/技巧/知识结构）。读完你应该知道：
> 代码在哪、什么不能破坏、前人踩过什么坑。

## 一句话定位
AVA 对话：线程/消息/Deep Research（双模板报告）/建议动作/语音；AI 网关与订阅能力位于 packages/ai。

## 代码地图
- 页面：`apps/web/app/(app)/ava/page.tsx`（大文件，线程/消息/Deep Research/研究类型选单/建议动作都在这）
- 侧车组件：`apps/web/app/(app)/ava/voice-input.tsx`（真实 MediaRecorder+AnalyserNode 录音）、
  `attachments.tsx`（RichAttachmentPreview 富渲染，签名直链接口）
- API：`apps/web/app/api/ava/`（threads/messages/research/capabilities/share 等）；
  `apps/web/lib/ava-agents.ts`（Agent 选项真实数据源，内置+订阅合并，见下方 #531 教训）、
  `apps/web/lib/mailer.ts`（分享邮件/消息邮件共用同一 dev transport + 频控）
- 包：`packages/ai`（gateway.ts 网关+stub、researchGenerator.ts 真实生成、avaSettings.ts 归一化）；
  研究会话表 027/028 迁移

## 关键契约与不变量（改代码前必读）
- ANTHROPIC_API_KEY 缺失 = 诚实降级（capabilities 端点不 500，#531）；任何外部依赖查询
  （AI Store 订阅、模型 provider）失败都要 try/catch 降级到内置默认，不能让异常冒泡打垮
  整个端点。
- researchType 贯穿：composer 显式选择 **优先于**模型输出与主题关键词推断（`explicitType ?? …`）
  → 落 `research_payload.report.researchType` → 刷新恢复（p18-F14，PR #516）。
- 调模型只经 packages/ai 网关，页面层不直连 Anthropic。
- 邮件类动作（分享邮件、消息发邮件）复用同一张 `outbound_emails` 表 + 共享
  `RateLimitedError`/`countRecentOutboundEmails`，新邮件动作接真实 provider 前必须先加频控，
  不新建基础设施（PR #321/#359 教训）。
- API 层任何 catch 块只 `console.error` 原始错误，绝不把 `String(err)` 回给客户端（F02/F07/F11
  review 反复揪出的同类问题）。

## 关联阶段 / ADR / 文档
phases/phase-p9-ava-chat、p18-ava-ai-realization、p19-ava-canvas-memory-expansion（注意不是
p21——p21 是 platform-accounts-hardening，与 AVA 无关，此前文档误写过）

## 模块 SOP
1. 动手前：读本文件 + 对应 feature 的 `user_visible_behavior`/`verification`；跑 `pnpm harness doctor --phase <相关 phase>` 确认没接手一个带审计债的现场。
2. 开发中：独立 worktree（ADR-005）；UI 改动跑 `lint-design.sh`；敏感 area（auth/billing/admin/share/invite）主动挂 rev-security。
3. 交付：`verify --sprint` 门控；PR 描述里写清对上述契约的影响面。
4. 收尾：有新经验 → 按下方规则回流本文件。

## 踩坑与经验（append-only，最新在上）
- 2026-07-14：非 /ava 的调用方（房间聊天、board AI chat 等）要接真实 CAP-AI 网关，
  正确姿势是复用 `packages/ai` 的 `runChatGraph` + `makeGenerateNode(defaultGateway.streamChat.bind(defaultGateway))`
  同款调用方式（`packages/data/src/roomChat.ts` 的 `generateRoomChatReply`），把网关的
  流式 token 收集成一整段字符串即可对接非流式契约，不用为每个调用方重新发明网关调用
  约定；system 角色消息（如房间级 ai_instruction）作为独立的 `messages[]` 条目传入，
  不要拼进 userText 字符串里再指望 stub provider 用正则抠出来（那是历史遗留的 attachment/
  kb/board 三个标记的旧口径，新调用方不必照抄，直接传 system 消息更干净）（出处：
  p4-F05/issue #615）。排查这个 feature 时意外发现一个更严重、完全无关的平台级 bug：
  `resolveRoomId`/`resolveBoardId`（`packages/data/src/rooms.ts`/`board.ts`）的
  public_id 查库分支忘了 `Number()` 归一化 pg bigint 的字符串返回值，导致所有通过
  public_id 链接（当前客户端导航的默认重定向目标）访问房间/白板详情一律 404——
  与本模块无关，但值得记一笔：**排查一个 feature 的 e2e 失败时，先用纯 curl 复现，
  排除是不是浏览器/Playwright 特有行为，再断定是不是自己改动引入的**（这次一开始
  怀疑是自己的改动，curl 复现后才确认是完全独立的既有 bug）（出处：PR #630）。
- 2026-07-12：研究类型按钮黑底黑字——`variant="default"` + 表外字号 text-12 被 tailwind-merge 吞配色（ADR-013 根治）。UI 改动记得跑 lint-design。
- 2026-07-11：订阅查询失败曾拖垮 capabilities 端点（#531）——外部依赖失败一律降级到内置默认。
- 2026-07-10：F14 研究类型选单上线前，主题分类曾对**每一次**研究请求都误判成
  user-research——根因是前端固定发送同一句 audience 文案（含"user research"四个字），
  把 audience 一起纳入关键词判定就必现同一个坑；判定只能看 topic，不能看 audience
  （`researchGenerator.ts` 的 `inferResearchType` 与 `gateway.ts` 的 stub 判定同一口径，
  出处：PR #516）。
- 2026-07-09：F13 界面按 prototype/oldcode 重排版时，只迁移了交互结构（JSX 布局/组件切换
  形态），**没有**照搬 oldcode 的 Redux 状态管理——数据层继续用现有 fetch+API routes；
  同时刻意把全部既有 `data-testid` 保留在等价的新控件上，才没有连带打掉 15 个既有
  e2e spec（出处：PR #477）。
- 2026-07-08：`confirmResearchPlan()` 早期实现"乐观更新"——先切前端状态再发 PATCH 持久化，
  Playwright 的 `.click()` 不会等待事件处理函数里的 promise，测试里立刻刷新页面就会读到
  持久化前的旧状态，看起来像"确认后又跳回草稿"。凡是"切状态"和"持久化"两件事，务必
  先 `await` 持久化成功再 `setState`（出处：p18-F03 交付过程）。
- 2026-07-04：迁移文件编号在并发分支下会撞车——多个 worker 同时在各自分支上新建迁移，
  编号只有在**合并那一刻**对照 origin/main 当前最新编号重新排列才是准的，不能在分支存活
  期内一次编定就不再检查（024→027 的 rename 教训，出处：PR #350 review）。
- 2026-07-04：这个仓库是共享工作目录、多会话并发，`git checkout -b` 前一定要显式
  `git fetch origin main && ... origin/main` 指定基底——曾经因为"从当前 checkout 分支
  新建"而误把还没合并的兄弟分支内容、甚至另一个会话直接提交在共享 checkout 上的无关
  commit，一起带进了 PR（出处：PR #366 review，同一模式在 canvas/collab 域也各出现过
  一次，属于系统性风险不只是 ava 特有，但 ava 域连续踩中两次）。

## 知识回流规则（本文件怎么迭代——这是这个 skill 存在的意义）

1. **谁干活谁回流**：在本模块交付 feature/修 bug/做 review 时，踩到新坑、建立新做法、
   推翻旧假设 → 在同一个 PR（或紧随的小 PR）往下方"踩坑与经验"**追加**一条：
   `- YYYY-MM-DD：一句话结论（出处：PR/issue/postmortem 链接）`。append-only，不删旧条目
   （被推翻的旧经验标 ~~删除线~~ 并注明被哪条取代）。
2. **module coordinator 每 C-cycle 复盘**：检查本周期内本模块合并的 PR，有值得沉淀而
   没回流的，补写（这是 ADR-010 "SOP 持续迭代"的落点）。
3. **结构变更**（新增章节/重组）走正常 review；追加"踩坑与经验"条目可随任意 PR 顺带。
4. 开源贡献者同权：任何人对本模块的经验修订都走 PR，以可验证事实为准，不看资历。
