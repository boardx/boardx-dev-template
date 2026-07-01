# Definition of Ready (DoR) — Ready for Dev 门槛

> 一个 feature / issue 只有**同时满足**以下全部条件，才能进入 `status:ready-for-dev`，
> 才允许被 agent 认领开发。不满足 = `status:needs-spec`，先补规格，不准开发。
> 这是「开发的准入契约」，与 AGENTS.md 的 DoD（完成契约）对称：DoR 管「能不能开始」，DoD 管「算不算做完」。

## 准入清单（全绿才 ready）

1. **可观察行为**：`user_visible_behavior` 描述单一、可观察的结果（用户/系统做什么 → 看到什么）。
   - ✗ 「支持登录」「优化体验」 ✓ 「POST /api/auth/login 凭据正确→302 到 /，set-cookie 会话」
2. **可执行验收标准**：`verification[]` 至少 1 条可运行命令（退出码 0 即通过）= 完成契约。
   - 由 [verification-writer] 产出；契约定不下来=需求没想清楚，不准 ready。
3. **粒度**：一次会话内可完成并验证；过大必须拆（见 [feature-writing]）。
4. **依赖已解**：`depends_on` 全部列出，且其中每一项都已 `passing`（或本 feature 无依赖）。
   - 有未完成依赖 = `blocked`，不进 ready。
5. **落点明确**：`area`（模块）+ `capability` + **目标 UI**（路由/组件 + 设计参照：prototype 区块或
   `interface-operation-inventory.md` 路由）都已指定。复用既有设计 token / shadcn 组件（见 uiux-standards）。
6. **无悬而未决**：澄清问题清单（见 requirement-author）已全部回答，无 TODO/待定。
7. **证据位**：`evidence` 路径已约定（如 `evidence/<id>.verify.log`）。

## 并行可调度补充字段（不影响 ready，但调度需要）

- `wave`：依赖拓扑层级（派生，见 workflow 文档）。
- `parallel_safe`：与同 wave 兄弟 feature 改动文件/区域不相交（可同时开，低冲突）。

## 状态机

```
needs-spec ──(补齐 DoR 7 条)──▶ ready-for-dev ──(claim)──▶ in-progress ──(verify 绿)──▶ passing
     ▲                                                          │
     └──────────────(依赖未过 / 缺验收)──── blocked ◀───────────┘
```

`ready-for-dev` 的判定可被脚本门控：feature 满足 1–7 → 打 `ready:true`；sync 只为 `ready:true` 开 issue。
