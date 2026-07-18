# ADR 009: GitHub 协调面整体退役——coord-service (D1) 成为唯一协调权威

- 状态: Accepted（人类直接决定，2026-07-08）
- 日期: 2026-07-08
- 关联: 取代 ADR-004 的"issue+label 是协调平面权威"结论；将 ADR-006 的 opt-in
  定位与 ADR-008 的分阶段路径提前终结（两者保留为历史决策记录，不删除）。
  GitHub issue 的 **feature 规格用途不受影响**（ADR-004 的规范/叙述层结论继续
  成立，`harness sync` 的 feature→issue 投影照旧）。

## 背景

ADR-008 定义了 coord-service 从 opt-in 增强升级为主协调机制的分阶段路径
（Stage A soak → B 投影化 → C 逐模块 → D 转正），设计意图是每一步可验证、可回滚。
2026-07-08，人类（仓库所有者）直接决定跳过剩余阶段的浸泡期，立即完成切换，并且
比原 Stage D 更进一步：**GitHub 协调面不是降级为投影，而是整体退役**——连 projector
的单向投影也不再作为协调机制的一部分运行。

人类决策高于分阶段协议的谨慎安排，这是明确记录在 coordinator-sop.md（"人类的
合并权高于协调协议"同源原则）里的既有立场。本 ADR 的职责是把这个决定的边界、
后果和激活条件写清楚，而不是重新辩论它。

## 决策

1. **coord-service (D1) 是认领/心跳/退位的唯一权威**：
   - `pnpm harness lock-*`（coord-main 租约）：acquire 必须取得 D1 claim，取不到
     （冲突/HTTP 失败/网络异常）→ 回滚本地文件锁并报错，不允许"本地以为拿到了、
     D1 里没有"的分裂状态。heartbeat 失败 → 可见报错。本地文件锁保留，但降级为
     同机多会话的本地快速互斥，不再是任何意义上的权威。
   - `pnpm harness module-lock-*`（module-coordinator 租约）：不再读写任何 GitHub
     issue/评论。acquire 先查 D1 是否被占（补齐了与 coordinator-lock 的对称性，
     即 ADR-008 里记录的 Stage C 已知阻塞），最终原子性以服务端 `uq_active_claim`
     唯一索引的 INSERT 冲突判定为准。
2. **fail-closed，不再 fail-open**：权威（D1）联系不上时，acquire 拒绝执行——
   联系不上权威就不假装能协调。这是对 ADR-006 "失败一律静默降级"原则的有意反转：
   当年降级的去处是 GitHub 权威，现在那个去处已经退役，降级无处可去。`--force`
   保留为人类授权的抢占仪式逃生门。
3. **凭据是硬前置**：`COORD_SERVICE_URL`/`COORD_SERVICE_TOKEN` 未配置的会话，
   lock/module-lock 命令直接报错退出并附领取指引，不再有零配置可用的协调路径。
4. **GitHub 协调面退役范围**：
   - coordination:lease / coordination:lease:<module> issue 的 claim/heartbeat/
     release/takeover 评论仪式：退役。存量 lease issue 保留为历史记录，不删除。
   - `parallel-dev-workflow.md` §8 的 `status:in-progress` label 认领锁：退役。
     跨会话认领互斥由 D1 claims（`issue:<n>` resource）承担；`harness claim` 的
     feature_list.json 原子认领（ADR-001）不变，仍是 feature 归属的事实来源。
   - projector（D1→GitHub 单向投影）：退役。代码保留在 `packages/coord-service/
     src/cron/projector.ts`（未来若人类想恢复只读投影，配置 GITHUB_TOKEN/
     GITHUB_REPO 即可重新点亮——`isGithubConfigured` 门控本来就是这么设计的），
     但部署环境**不得**配置这两个变量。
   - `sync-github.ts` 的 feature→issue 投影（status:*/sprint:*/area:* label）：
     **不在退役范围**——那是 feature 规格/叙述层，不是协调层。
5. **人类可见性由 dashboard + /status 承接**：GitHub 上不再有协调评论可看，
   人类看协调状态的入口变为 coord-service 的公开 `GET /status` 端点与
   `apps/web/app/(app)/admin/coordination` 仪表盘。仪表盘当前只有 slice 1
   （registry 静态名录）——**slice 2/3（Active Claims 实时卡片 + /status 接线）
   随本决定从可选变为必须**，作为紧随本 ADR 的独立工作项交付。

## 激活门槛（合并本 ADR ≠ 切换完成）

代码合并后，切换在每个会话真正生效的前提是凭据分发：

1. 有 Cloudflare 账号访问权的人（人类）运行 `packages/coord-service/scripts/
   seed-agents.ts` 为 registry.yaml 中的现役协调身份逐个 mint token（幂等，
   token 只显示一次）。
2. 每个协调会话配置 `COORD_SERVICE_URL`（staging Worker 地址）+ 本会话身份的
   `COORD_SERVICE_TOKEN`。
3. 未配置凭据的会话从此**无法参与协调**（命令直接报错）——这是有意的强制换轨，
   不是疏漏；换轨期间总线上要贴清楚领取路径。

## 后果

正面：
- 认领从"两个会话都可能'成功'的 label 竞态"变为真原子 CAS（uq_active_claim），
  这是整个 coord-service 立项要解决的原始问题，至此真正成为默认现实而不是可选项。
- 协调事件历史集中在 events 表（只增不改），比散落在数百条 issue 评论里可查询、
  可审计。
- 心跳/过期回收由服务端 sweeper 机械执行，不再依赖"下一个巡检会话恰好注意到
  心跳过期"。

负面 / 接受的代价：
- **Cloudflare 成为协调平面的单点依赖**：D1/Worker 不可用期间，除 --force 逃生门
  外无法取得新租约。原本 GitHub 是天然备援，现已主动放弃——人类知情并接受。
- **人类可见性暂时下降**：dashboard slice 2/3 交付之前，看实时协调状态只能 curl
  /status。这是本决定链上最紧迫的后续工作。
- ADR-008 的 Stage A 零漂移核对、Stage B/C 浸泡期全部跳过——如果 D1 侧存在
  未被测试覆盖的行为缺陷，将在生产切换后才暴露。人类选择承担这个风险以换取
  切换速度；本地 wrangler dev 的全链路冒烟（acquire/heartbeat/conflict/release/
  fail-closed 五条路径）已在切换 PR 里执行并通过，作为最低限度的兜底验证。
- 多了一步凭据管理负担（token 领取/轮换）；泄漏的 token 可冒充对应身份，轮换
  流程沿用 ADR-008 附录的 rotate 约定（UPDATE token_hash，不 DELETE）。

## 备选（已否决）

- **按 ADR-008 原计划走完 Stage B/C 浸泡**：更稳，但人类明确决定不等。否决记录
  在案，浸泡期检查项（如 D1 vs GitHub 时间线核对）在切换后失去意义——切换后
  GitHub 侧不再有可对照的时间线。
- **保留 projector 只读投影（原 Stage D 形态）**：人类在两个选项中明确选了
  "彻底停用 GitHub 协调面"。projector 代码保留、配置断开，未来可低成本恢复。
