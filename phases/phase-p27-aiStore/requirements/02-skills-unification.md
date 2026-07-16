# Skills 统一与实时版本契约

## 规范模型

- 用户可见名称为 Skills，单项为 Skill。
- 规范持久化/API 类型为 `type=skill`。
- Skill 执行属性为 `skillKind=text|image`。
- `skillKind` 只决定编辑字段、预览和运行时分派，不产生第二套分类、Tab、订阅或审核流程。
- 每个 Skill 与 Agent、Template 一样，必须有不可为空的 `originTeamId`。

## 旧值原位迁移

| 来源值 | 规范 `type` | `skillKind` |
| --- | --- | --- |
| `ai-tool` | `skill` | `text` |
| `AI_TOOL` | `skill` | `text` |
| `image-tool` | `skill` | `image` |
| `AI_IMAGE_TOOL` | `skill` | `image` |

- 迁移保持 `itemId` 不变，不重建资源。
- 已有明确执行配置时以配置为准，否则按表补齐。
- 迁移幂等，重复执行不能继续改变数据。
- 订阅、收藏、分享授权、审核、精选、likes/views 和推荐关系继续引用原 `itemId`。

## API 与 UI

- `GET /api/ai-store/items?type=skill` 返回可见的 text/image Skills。
- 列表、详情、订阅、Authorized 和分享响应只输出规范类型 `skill`。
- 新写入只持久化 `skill`；迁移窗口可接受旧别名并立即规范化。
- 未知类型或未知 `skillKind` 返回 400，不静默降级。
- Explore 只有 Skills Tab；Create 只有 Skill 入口。
- Skill 编辑器先选择 text/image，再显示对应字段；不得无提示丢弃已保存配置。
- 旧 `aitool`/`imagetool` 链接规范化到 Skills，已有分享链接仍定位原 `itemId`。
- AVA Skills 选择器按 `skillKind` 分派到现有文本或图片执行链路。

## 实时版本传播

- 每个资源有从 1 开始的 `version`。
- 有效内容编辑以乐观版本条件保存，成功后 `version + 1`。
- BoardX approved 或 Team published 资源的内容编辑不改变审核状态，不重新进入 pending。
- 保存成功后新版本立即成为源资源当前版本。
- USER 和 TEAM 订阅只保存源 `itemId`，不保存审核版本快照。
- 订阅列表、详情、AVA 和 Template 使用在读取或执行时解析最新版本。
- 并发编辑版本不匹配返回 409，客户端必须刷新后显式重试，禁止静默覆盖。
- RevisionAudit 记录版本、操作者、Team、动作和变更字段，但不延迟版本生效。

## 回归边界

- Agent 与 Template 的分类和执行方式不合并进 Skills。
- 文本和图片底层执行代码可以继续使用旧内部常量作为迁移适配，但公共 API 和用户界面不得再暴露两个商品分类。
- 取消订阅后资源立即从对应 AVA/Template 选择入口移除。
- 归档或 BoardX 撤回 approved 后，已有订阅显示不可用，不能开始新执行。
