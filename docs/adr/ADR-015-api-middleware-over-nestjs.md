# ADR-015: API 中间件层（而非改用 NestJS）

- 状态：Accepted（人类 2026-07-16 问"后台是否该用 NestJS 而不是 Next.js"，评估后拍板走本方案）
- 日期：2026-07-16
- 作者：coord-architecture
- 关联：ADR-009（Cloudflare 协作面）、ADR-012/013/014（能机器判定的绝不交给人肉）、#539（String(err) 泄漏事故）

## 背景：痛点是真的，实测有数

| 症状 | 实测（152 路由 / 9670 行） |
|---|---|
| 鉴权样板重复 | **117** 个路由各写一遍 `currentUser()`，**211** 处手写 401 分支 |
| 输入校验 | **0** 个路由用校验库——**这一层根本不存在** |
| 错误处理 | 181 个 catch，其中 **51 个文件**把 `String(err)` 直接回传客户端 |

`String(err)` 泄漏不是孤例：#539 修过一次（cover 路由），但同款模式在全仓有 51 处
——把数据库连接串、对象存储 endpoint、SQL、stack 回给了任意客户端。

## 决策：不换 NestJS，补三层中间件

### 为什么不换（两条硬理由）

1. **根因不是 Next.js 弱，是这三层没人建。** `0 个校验库`说明的是纪律缺失，不是
   框架缺失——Next.js 完全支持 wrapper/middleware/zod/统一错误处理。换成 NestJS，
   若同样没人写 DTO，照样是 0 校验。**框架不会替你建纪律**（ADR-012/013/014 同款教训）。
2. **NestJS 跑不了 Cloudflare Workers**（需 Node runtime + 装饰器反射 + 常驻 DI 容器），
   而 devportal 有 **10 个 edge 路由**在 Workers 上。换过去只能 apps/web 用 NestJS →
   **两套后端范式、两套鉴权、两套错误处理**。刚统一了时钟/派工/证据纪律，这一刀砍反了。

其它成本：152 路由重写；失去 API 与 SSR/RSC 同进程共享 session；部署从 1 进程变 2 进程。

### 采用：`lib/api/handler.ts`（~120 行，拿 NestJS 90% 的收益）

| wrapper | ≈ NestJS | 作用 |
|---|---|---|
| `withAuth` | Guard | 干掉 117 处重复鉴权 + 211 处手写 401；handler 拿到非空 `user` |
| `withValidation(schema, h)` | Pipe + class-validator | zod DTO，**从 0 建起校验层**；失败 → 400 + 字段级 issues（不回显用户输入） |
| `withErrorBoundary` / `ApiError` | ExceptionFilter | 预期错误回稳定 code；**意外错误只回 `internal_error`，细节只进日志** |

- **纯函数 + Web 标准 Request/Response**：Node 与 Workers 都能跑，devportal 也可直接用
  ——**零运行时分裂**（这正是 NestJS 做不到的）。
- **可组合**：非 JSON 路由（multipart 上传）用 `withAuth` + `ApiError` 同样受保护。
- **零重写**：新路由直接用，老路由随手迁。

### 机械门控（照 ADR-013 双向套路）

`lint-design.sh §1.7`：**响应体里出现 `String(err)`/`err.message` 直接 lint 红**。
精准匹配 `NextResponse.json(... )` 内部——放行合法用途（`console.error` 日志、
入库 trace 的 `errorMessage: String(err)`）与行尾注释。双向实测：探针路由被拦、
清理后恢复绿。

## 后果

- **全仓 API 内部错误泄漏面清零**（51 个文件 + ai-report/attachments 的 502 分支）
  ——门控逐层揪出来的，远超最初肉眼估计的 3 处。
- 新路由从此有默认正确姿势；退化被 lint 当场拦住。
- 代价：老路由迁移是渐进的（本 PR 只迁了 studio/kb-files 两个样板 + 全仓泄漏修复），
  `withValidation` 的覆盖率要靠后续 PR 逐步爬升。

## 我们什么情况下会改主意（NestJS 的触发条件）

任意一条成立即重新评估：① 要开放公共 API 给第三方（需 OpenAPI/版本化/限流完整体系）；
② 后端团队规模大到需要强制模块边界；③ 需要 WebSocket 网关/微服务/CQRS 这类 NestJS
原生的重型编排。**2026-07 现状：三条都不成立。**

## 经验教训

1. **"该不该换框架"要先量化痛点归因**：117/0/51 这三个数字才让结论有支点——
   痛是真的，但归因到框架是错的。
2. **同 ADR-013**：肉眼估计 3 处泄漏，机器一扫 51 处。**能机器判定的一致性，绝不
   交给人肉抽查。**
