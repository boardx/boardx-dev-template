Use Case 名称：
管理 Room Board 基础内容

Actor：
Room Owner、Room Member

目标：
用户在 Room 的 Board 页面查看已有内容，并创建、移动、编辑、删除基础 item，使 Room 具备可持久化的白板内容。

系统边界：
BoardX / Room Board / Canvas

前端入口：
1. Room 列表或 Room 详情中的 Board 入口。
2. `/rooms/:id/board` 页面。

前置条件：
- 用户已登录 BoardX。
- 用户对目标 Room 具有查看权限。
- 目标 Room 已存在。

触发条件：
用户打开 Room Board 页面，或在该页面执行添加、移动、编辑、删除 item 的操作。

主流程：
1. 用户从 Room 进入 Board 页面。
2. 系统加载该 Room 下已有 item，并在 Board 区域按保存的位置和内容渲染。
3. 如果 Room Board 没有 item，系统展示空 Board 状态，同时保留添加入口。
4. 用户点击添加 item 入口。
5. 系统在 Board 上创建一个新的基础 item，并展示默认文字、位置和可选中状态。
6. 用户选中 item 后，可以移动 item 或修改文字。
7. 系统在用户操作后更新 Board 上的 item 位置或文字，并给出已保存或保存中状态。
8. 用户刷新页面或重新打开该 Room Board。
9. 系统仍展示上一次保存后的 item 列表、位置和文字。
10. 用户删除一个 item。
11. 系统从当前 Board 中移除该 item；用户刷新后，该 item 不再出现。

备选流程：
- A1：用户只查看已有 item，不做任何修改。
- A2：用户连续添加多个 item，系统在 Board 中分别展示这些 item。
- A3：用户移动 item 但不修改文字，系统只更新位置。
- A4：用户修改文字但不移动 item，系统只更新文字。
- A5：空 Board 时，用户可以直接通过添加入口创建第一个 item。

异常流程：
- E1：用户没有目标 Room 查看权限，系统阻止进入 Board 并展示无权限状态。
- E2：目标 Room 不存在，系统展示不存在或不可访问状态。
- E3：加载 item 失败，系统展示加载失败状态，并允许用户重试。
- E4：保存 item 失败，系统保留当前页面状态，提示保存失败，用户可重试。
- E5：删除 item 失败，系统保留该 item，并提示删除失败。

权限与可见性：
1. Room Owner 可以查看、添加、移动、编辑和删除 Room Board item。
2. Room Member 可以查看、添加、移动、编辑和删除 Room Board item，除非 Room 策略另有限制。
3. 非 Room 成员不能查看私有 Room 的 Board，也不能修改其中 item。
4. 无权限用户不应看到可操作的添加、编辑或删除入口。

后置条件：
- 成功时，Room Board 中的 item 状态与用户最后一次成功操作后的可见状态一致。
- 用户刷新或重新进入 Board 后，仍能看到已保存的 item。
- 失败时，系统不应把未成功保存的操作伪装成已完成状态。

不包含：
1. 不包含多人实时同步。
2. 不包含 Fabric.js 富画布适配。
3. 不包含撤销重做 UI。
4. 不包含图片、文件、连接线或复杂 widget。
5. 不包含 Board 分享、导出或访问策略配置。

业务规则：
1. Board item 必须归属于某个 Room。
2. 用户只能查看和修改自己有权限访问的 Room Board。
3. item 的位置和文字必须在成功保存后可再次读取。
4. 删除 item 后，该 item 不应再出现在该 Room Board 的列表或画布中。
