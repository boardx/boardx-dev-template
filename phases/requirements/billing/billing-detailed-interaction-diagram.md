# Billing 详细交互图

本图按 Billing 模块当前 Use Case 的主流程展开，重点表达每个界面能看到什么、能操作什么、操作后出现什么状态。若某个 UC 继续细化，应该同步更新该 UC 的主流程和本图。

## 模块交互展开

该部分保留当前模块已有交互图，用于表达模块内主要页面区域之间的流转。

```mermaid
flowchart TD
  Upgrade["用户点击升级或购买"] --> Plan["查看计划、额度或价格"]
  Plan --> Confirm["确认购买"]
  Confirm --> QR["显示扫码支付二维码和订单状态"]
  QR --> Scan["用户扫码支付"]
  Scan --> Success["支付成功，计划或余额更新"]
  QR --> Close["关闭支付弹窗"]
  Close --> Pending["订单未完成，页面保持原状态"]
  QR --> Expired["二维码过期或支付失败"]
  Expired --> Retry["重新生成订单或返回"]
```

## Use Case 主流程展开

```mermaid
flowchart TD
  subgraph D1G["升级或管理个人计划"]
    D1Start["Actor：注册用户、支付系统"]
    D1Entry["可见入口/区域：用户菜单中的 Upgrade / Manage Plan / 购买 Credit 按<br/>钮。；AI 计费不足提示触发的 Upgrade Plan 弹窗或 Buy Credi<br/>ts 弹窗。；Upgrade Plan 弹窗中的升级或管理订阅按钮。"]
    D1Start --> D1Entry
    D1S1["1. 在 subscription 计费模式下，免费用户在个人菜单看到 Upgrade，<br/>付费用户看到 Manage Plan。"]
    D1Entry --> D1S1
    D1S2["2. 用户点击入口后，系统打开 Upgrade Plan 弹窗。"]
    D1S1 --> D1S2
    D1S3["3. 弹窗展示标题，免费用户看到 Upgrade，付费用户看到 Manage；同时展示当<br/>前用户类型 Free User 或 Pro User、说明文案和主要权益。"]
    D1S2 --> D1S3
    D1S4["4. 免费用户点击 Upgrade to Pro，系统根据支付链接、用户邮箱、用户 ID<br/> 和当前语言拼接外部支付链接，并在当前窗口打开。"]
    D1S3 --> D1S4
    D1S5["5. 付费用户点击 Manage Subscription，系统获取订阅管理链接，并在当<br/>前窗口打开管理页面。"]
    D1S4 --> D1S5
    D1S6["6. 如果 AI 计费不足发生在 subscription 计费模式，系统先展示权限不足<br/>提示，再打开 Upgrade Plan 弹窗。"]
    D1S5 --> D1S6
    D1S7["7. 在 credits 计费模式下，用户菜单中的按钮显示为购买 Credit；用户点击<br/>后打开购买 Credit 弹窗，而不是订阅升级弹窗。"]
    D1S6 --> D1S7
    D1S8["8. 在 credits 计费模式下，如果 AI 计费不足，系统展示 Credit 不足<br/>提示，并打开对应个人或团队的购买 Credit 弹窗。"]
    D1S7 --> D1S8
    D1S9["9. 用户关闭弹窗时，系统关闭当前计费弹窗，账号计划或 Credit 余额不因关闭而变化<br/>。"]
    D1S8 --> D1S9
    D1Alt{"备选：A1：用户打开弹窗后取消，系统保持当前计划或余额不变。；A2：外部支付或管理链接不可用，<br/>系统不跳转，用户停留在当前弹窗。"}
    D1S9 --> D1Alt
    D1Err{"异常：E1：获取订阅管理链接失败，系统无法打开管理页面。；E2：AI 计费不足事件缺少有效 o<br/>wner 信息时，购买 Credit 弹窗回退到个人范围。"}
    D1S9 --> D1Err
    D1Perm["权限/可见性：1. 用户只能从自己的用户菜单升级或管理个人计划。；2. Credit 购买弹窗可以按事<br/>件上下文打开个人或团队购买范围，但不能改变用户在 BoardX 的业务角色。；3. 支付<br/>系统只处理支付或订阅管理结果，不授予 BoardX 页面权限。"]
    D1S9 --> D1Perm
  end
  subgraph D2G["扫码支付"]
    D2Start["Actor：注册用户、支付系统"]
    D2Entry["可见入口/区域：Upgrade Plan 弹窗中的个人扫码支付区域。；Buy Credits 弹窗中<br/>的支付方式、生成二维码和刷新状态区域。；用户菜单中的购买 Credit 入口。；Te<br/>am Credits 页面中的 Buy Credits 入口。"]
    D2Start --> D2Entry
    D2S1["1. 用户打开支持扫码支付的弹窗。"]
    D2Entry --> D2S1
    D2S2["2. 在个人 Pro 开通场景中，系统展示扫码开通 Pro、后端下单金额说明、微信扫码支<br/>付和支付宝扫码支付两个支付方式、生成二维码按钮。"]
    D2S1 --> D2S2
    D2S3["3. 在 Credit 购买场景中，系统展示 Credit 套餐列表、支付方式按钮、生成<br/>支付二维码按钮，以及订单和最近交易记录区域。"]
    D2S2 --> D2S3
    D2S4["4. 用户选择支付方式；Credit 购买场景中微信可用，支付宝显示为不可用或置灰。"]
    D2S3 --> D2S4
    D2S5["5. 用户点击生成二维码，系统创建订单并展示生成中状态。"]
    D2S4 --> D2S5
    D2S6["6. 订单创建成功后，系统展示二维码、订单号或订单信息、订单状态和刷新支付状态按钮。"]
    D2S5 --> D2S6
    D2S7["7. 用户使用外部支付工具扫码付款；订单处于待支付时，系统展示等待支付状态。"]
    D2S6 --> D2S7
    D2S8["8. 系统会定时查询待支付订单状态，用户也可以点击刷新支付状态主动查询。"]
    D2S7 --> D2S8
    D2S9["9. 支付成功后，系统展示成功提示；个人 Pro 场景会触发账户状态同步或刷新，Cred<br/>it 场景会刷新余额或交易记录。"]
    D2S8 --> D2S9
    D2S10["10. 订单关闭、退款、失败、创建失败或状态查询失败时，系统展示对应提示，用户可重新生成<br/>二维码或稍后重试。"]
    D2S9 --> D2S10
    D2Alt{"备选：A1：用户关闭弹窗或取消支付，系统不立即增加余额或升级计划。；A2：二维码或订单过期后，<br/>用户重新生成二维码。"}
    D2S10 --> D2Alt
    D2Err{"异常：E1：创建支付订单失败，系统展示创建失败提示。；E2：查询支付状态失败，系统展示查询失败<br/>提示。；E3：订单仍为 pending，系统提示订单尚未支付完成。"}
    D2S10 --> D2Err
    D2Perm["权限/可见性：1. 用户只能为自己的个人 Pro 或个人 Credit 发起支付。；2. Team O<br/>wner/Admin 在 Team Credits 页面可以为当前 Team 发起 Cr<br/>edit 购买。；3. Team Member 无 Team Credits 管理权限时<br/>不能通过 Team Credits 页面发起团队购买。；4. 支付系统只确认订单状态，不<br/>授予 BoardX 页面权限。"]
    D2S10 --> D2Perm
  end
```

