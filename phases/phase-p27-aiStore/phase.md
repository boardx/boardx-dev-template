# Phase p27 — aiStore

- **slug**: aiStore
- **状态**: not_started
- **创建于**: 2026-07-16 04:26:35

## 目标
梳理并迁移现有 AI Store 能力，强制 Agent/Skill/Template 按 Team 归属与隔离，将 AI Tool 与 Image Tool 统一为 Skills。

## 范围与边界
- 本阶段交付:盘点 `boardx-web` 与 `boardx-backend` 的 AI Store 契约；为所有 Agent/Skill/Template 建立强制 Team 归属与租户隔离；将 AI Tool 与 Image Tool 统一为 Skills；迁移数据/API/Web/AVA 使用入口；保留已有订阅、收藏、分享、审核和精选关系。
- 兼容边界:新写入和新响应只使用规范类型 `skill`；旧 `ai-tool`、`image-tool`、`AI_TOOL`、`AI_IMAGE_TOOL` 作为迁移期输入别名可读，不再作为用户可见分类。
- 明确不做:重做 AI Store 视觉设计；把 Team 归属降级为客户端可选字段；引入旧代码中仅有枚举但没有完整商店闭环的 Model/Dataset；重写具体文本或图片执行引擎。

## GitHub 总追踪

- Parent Issue: [#662](https://github.com/boardx/boardx-dev-template/issues/662)
- 仓库是唯一事实来源；#662 是外部协调与汇总视图。
- 单个 Feature 完成不关闭 #662；仅全部 Feature passing 后由 coordinator 关闭。

## 需求 → 功能清单 流水线
1. **原始需求**写进同目录的 `requirements/` 文件夹（可按领域放多份 `*.md`，人类语言、可模糊）。
2. 调 **requirement-author** 智能体：读 `requirements/` 全部 `*.md` → 生成/更新 `feature_list.json`
   （每个 feature 带可执行 `verification`）。
3. `requirements/` 是输入/上下文,**不是权威**;权威永远是 `feature_list.json`。

## 权威功能清单
本阶段的唯一权威功能来源是同目录的 `feature_list.json`。
sprint 通过 `feature.sprint` 字段领取功能;`active-features.json` 是脚本派生的只读视图。

## 退出条件(Definition of Done for this Phase)
- `feature_list.json` 中本阶段所有 feature 均为 `passing`。
- `.harness/state/quality-document.md` 相关领域评级未下降。
- 阶段 `progress.md` 已收尾,无未记录的半成品。
