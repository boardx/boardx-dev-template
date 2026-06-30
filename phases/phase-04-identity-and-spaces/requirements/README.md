# 原始需求 — identity-and-spaces（Phase 04）

> 这个**文件夹**是本阶段原始需求的家。已按领域分成三个子目录，每个子目录里是 use case（`uc-*.md`）与交互图：
>
> - `auth/` — 认证与身份（注册/登录/会话/找回密码/改密；**identity 即 auth，不单独分**）
> - `team/` — 团队（创建/切换/成员/角色权限/邀请/设置/Memory/AI Store）
> - `room/` — 房间/协作空间（创建/查看搜索/成员/文件/Studio/问卷）
>
> 需要时可再加子目录或 `*.md`。

## 流水线
1. 原始需求放进上面的子目录（use case / 交互图）。
2. 调 **requirement-author** 智能体：递归读取本文件夹**全部** `*.md`（跳过 README）→ 生成/更新 `../feature_list.json`。
3. 本文件夹是**输入/上下文，不是权威**；权威永远是 `../feature_list.json`（带可执行 `verification`）。

## 来源与同步
- 本阶段的 `auth/`、`team/`、`room/` 用例是 `phases/requirements/` 全量 Use Case 库的阶段快照。
- 同名 `uc-*.md` 应与全量库保持一致；如果阶段实现需要收窄范围，只在 `../feature_list.json` 的 feature 和 `source_use_cases` 中表达切分，不直接改写快照语义。
- `../feature_list.json` 中每个 feature 必须用 `source_use_cases` 记录对应的阶段快照路径，避免只靠 `notes` 中的短 ID 猜来源。
