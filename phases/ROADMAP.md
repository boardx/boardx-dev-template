# BoardX 实施路线图（从真实需求推导）

> 依据 `phases/requirements/`（**168 个用例 / 22 个模块**）做的系统化分析与依赖排序。
> 这是**逻辑分阶段**的权威来源；物理 phase 目录已按本表对齐为 `phase-pN-<slug>`（P 前缀）。
> 旧系统代码在 `oldcode/`，实现每个模块前先检索参考。
>
> **编号对齐（2026-06-30）**：物理目录已重排为 `pN` 前缀直接对应 P 阶段（见 `.harness/state/roadmap.yaml`）。
> 两个例外保留旧物理号、不改名（避免动已 passing 的 CI 绿态）：`phase-01-foundation`（harness 元层）、
> `phase-04-identity-and-spaces`（auth/team/room 核心打包体 = P1/P3/P4 核心，未拆）。`phase-05-canvas` 的便签
> item CRUD 本质是画布素材，已并入 `phase-p6-canvas`（作为 F01-F04 种子）。
> **P2–P8 的 feature_list 已产出**（壳/数据层可建项 = `not_started`；跨模块依赖未就绪项 = `blocked` 并在 notes 标 blocked-on pN）。
> Team/Room 高级入口仍按「渐进点亮」在对应能力阶段补，不在本轮 P3/P4 硬塞。

## 一、依赖结构（决定先后顺序）

角色泛化链（README）：`Guest → User → TeamMember → TeamAdmin / RoomMember → BoardEditor`；`User → SysAdmin`。
由此得到硬依赖：

```
基础设施(web/data/queue/file/ai/collab/payment)
  → Auth(账号身份)            ← 一切 include Auth
    → Profile / Home / Common
    → Team(创建即 TeamOwner)
      → Room(TeamMember 创建)   + Room-Chat
        → Board(RoomMember 创建)        ← 77 个用例，需再拆
          → Canvas/Widgets → Board 壳(header/menu) → 实时协作(Yjs)
      → AVA/Chat(AI) · 知识库(File+AI) · AI Store(AI+审核) · 问卷 · 积分(Payment) · Studio/演示
  → Admin(SysAdmin 横切，最后)
```

要点：**Board 是 77 个用例的巨兽**，必须独立拆成「基础 → 画布/组件 → 壳 → 实时协作」4 个阶段；
Team/Room 的「高级入口」（Team AI Store、Team Memory、Room Studio、Room Survey）依赖后续能力模块，
所以 Team/Room 阶段只做**核心壳**，高级入口在对应能力阶段落地时**渐进点亮**。

## 二、分阶段路线图（按依赖排序）

| 逻辑阶段 | 模块（用例数） | 关键能力(CAP) | 依赖 | 现状 |
|---|---|---|---|---|
| **P0 基础设施** | web/data/queue/worker/infra | WEB/DATA/WORKFLOW | — | ✅ 已建（phase-p0） |
| **P1 Auth & 身份** | auth(6) + profile(4) + common(4) + feedback(1) | AUTH | P0 | 🟡 auth(phase-04)/profile(phase-p1) 已 passing；common/feedback 缺 |
| **P2 Home 工作台** | home-page(8) | WEB | P1 | 📋 feature_list 已产出（phase-p2，7F；AVA/最近板项 blocked） |
| **P3 Team & 邀请** | team 核心 + invite(2) | AUTH/DATA | P1 | 🟡 team 核心已建（phase-04）；高级入口随能力阶段点亮 |
| **P4 Room & Room-Chat** | room(7) + room-chat(4) | COLLAB/DATA | P3 | 🟡 room 核心已建（phase-04）；room-chat feature_list 已产出（phase-p4，5F） |
| **P5 Board 基础** | board 根(8) + access(2) | DATA | P4 | 📋 feature_list 已产出（phase-p5，10F，全可建） |
| **P6 Canvas & 组件** | canvas(5)+board/canvas(4)+widgets(10)+widget-menu(14) | CANVAS | P5 | 📋 feature_list 已产出（phase-p6，22F=4passing种子+18；图片/文件/AI 助手 blocked） |
| **P7 Board 壳** | header(15)+board-menu(12)+context-menu(6)+local-workspace(3) | WEB/CANVAS | P6 | 📋 feature_list 已产出（phase-p7，16F；语音/AI/导出/模板 blocked） |
| **P8 实时协作** | board/collaboration(3) + 在线状态/光标 | COLLAB(Yjs+Redis) | P6 | 📋 feature_list 已产出（phase-p8，4F，待建 packages/collab） |
| **P9 AVA / Chat** | ava(10) + share(1) | AI(LangGraph/LiteLLM) | P3 | ❌ |
| **P10 知识库** | knowledge-base(4) | FILE+AI | P3,P9 | ❌ |
| **P11 AI Store** | ai-store(6) | AI+审核流 | P3,P9 | ❌ |
| **P12 Studio & 演示** | studio(1) + presentations(2) | AI+FILE | P5,P9 | ❌ |
| **P13 问卷** | survey(6) | DATA | P3 | ❌ |
| **P14 积分 & 计费** | credits(3) + billing(2) | Payment | P3 | ❌ |
| **P15 Admin** | admin(5) | AUTH(SysAdmin) | 全部 | ❌ |

> 并行性：P9/P13/P14 只依赖 P3，可在 Board 线（P5-P8）之外并行；P10/P11 依赖 P9。

## 三、对前面已建阶段的修正（核心诉求）

已建 phase 与真实需求的差距，需按真实用例**修正/补全**：

- **phase-03 fullstack-skeleton** = P0。正确，仅作基础设施保留。
- **phase-04 identity-and-spaces** 把 auth+team+room **混成一个阶段且只做了核心**。真实需求里它们是 P1+P3+P4 三段，且各自更丰富：
  - auth：基本对齐（6 用例都在），但缺 profile/common/feedback（属 P1）。
  - team：只做了创建/切换/邀请/成员；真实 team(10) 还有**设置/首页/Memory/统计/Team-AI-Store/Team-Survey 入口**。
  - room：只做了创建/成员/权限；真实 room(7) 还有**文件/Studio/Survey 入口 + room-chat(4)**。
  - → **修正**：phase-04 的 requirements/ 重新指向 `phases/requirements/{auth,team,room,room-chat,profile,home-page,common,invite}` 的真实用例；按 P1/P3/P4 重切，核心保留、依赖后续模块的高级入口标 deferred。
- **phase-05 canvas** 是误命名 + 严重欠范围：我做的「board-items 便签」只是 Board(77) 的极小一角，且真实有 **board vs canvas** 之分（board=容器+生命周期，canvas=画布编辑）。
  - → **修正**：phase-05 重做为 **P5 Board 基础**（真实 `board/` 根 8 用例：创建/打开/列表搜索/收藏/改元数据/复制/移动/删除 + access），canvas/widgets 归 P6，壳归 P7，协作归 P8。

## 四、执行约定（每个阶段都走 harness 流程）

1. 该阶段对应 `phases/requirements/<模块>` 的真实用例 → **requirement-author** 生成 feature_list。
2. sync GitHub issue → claim → 实现（先检索 `oldcode/` 参考）→ 三层测试 → verify 留证据 → passing → 关 issue。
3. 跨阶段「渐进点亮」：Team/Room 的高级入口在其能力模块阶段补对应 feature，不在 P3/P4 硬塞。

## 五、建议执行顺序（关键路径）

**核心骨架优先**：P1 补全 → P2 → P3 补全 → P4 补全 → **P5→P6→P7→P8（Board 全线，产品心脏）**。
**并行/插入**：P9(AVA) 可在 P4 后随时插入；P13/P14 依赖轻可早做；P10/P11 在 P9 后；P12 在 P6/P9 后；P15 最后。
