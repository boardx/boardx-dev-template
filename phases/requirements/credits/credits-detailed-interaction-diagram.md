# Credits 详细交互图

本图按 Credits 模块当前 Use Case 的主流程展开，重点表达每个界面能看到什么、能操作什么、操作后出现什么状态。若某个 UC 继续细化，应该同步更新该 UC 的主流程和本图。

## 模块交互展开

该部分保留当前模块已有交互图，用于表达模块内主要页面区域之间的流转。

```mermaid
flowchart TD
  Entry["进入 Credits 或 Team Credits"] --> Wallet["查看余额和钱包信息"]
  Wallet --> Buy["点击购买 Credit"]
  Buy --> Plan["选择额度或计划"]
  Plan --> Payment["打开支付二维码"]
  Payment --> Paid["支付成功后余额刷新"]
  Payment --> Pending["未支付时保持待支付状态"]
  Payment --> Failed["支付失败或订单过期提示"]
  Wallet --> Records["查看 Credit 记录"]
  Records --> RecordList["显示充值、消费、调整记录或空状态"]
```

## Use Case 主流程展开

```mermaid
flowchart TD
  subgraph D1G["查看积分钱包"]
    D1Start["Actor：Team Owner、Team Admin、Team Member、<br/>注册用户"]
    D1Entry["可见入口/区域：Team 设置页面 > Credits。；Team Credits 页面 > 钱包摘<br/>要卡片。；Team Credits 页面 > Usage 标签页。；Team Cre<br/>dits 页面 > Purchase 标签页。；用户菜单中的 Credit 余额区域<br/>。"]
    D1Start --> D1Entry
    D1S1["1. Team Owner 或 Team Admin 进入 Team Credits 页<br/>面，系统先读取当前团队信息。"]
    D1Entry --> D1S1
    D1S2["2. 如果团队信息尚未就绪，系统展示 loading team 状态。"]
    D1S1 --> D1S2
    D1S3["3. 如果当前计费模式不是 credits，系统展示 credits not enabl<br/>ed 提示。"]
    D1S2 --> D1S3
    D1S4["4. 如果当前用户不是 Team Admin 或 Owner，系统展示 no permi<br/>ssion 提示，不展示团队钱包数据、购买按钮或团队流水。"]
    D1S3 --> D1S4
    D1S5["5. 有权限时，系统展示团队 Credits 页面标题、说明和 Buy Credits <br/>按钮。"]
    D1S4 --> D1S5
    D1S6["6. 系统展示四个摘要卡片：当前余额、累计购买、累计授予、累计消耗；余额加载中时显示占位<br/>符。"]
    D1S5 --> D1S6
    D1S7["7. 页面默认展示 Usage 标签页，表格列出消耗时间、用户、消耗原因、消耗数量和消耗<br/>后余额。"]
    D1S6 --> D1S7
    D1S8["8. 用户切换 Purchase 标签页，系统展示购买、赠送或管理员授予记录，包括时间、<br/>类型、描述、来源、增加数量和变更后余额。"]
    D1S7 --> D1S8
    D1S9["9. 如果某个表格没有记录，系统展示对应空状态。"]
    D1S8 --> D1S9
    D1S10["10. 注册用户在 credits 计费模式下打开用户菜单时，可以看到个人 Credit<br/> 余额区域；点击该区域可打开个人 Credit 记录弹窗。"]
    D1S9 --> D1S10
    D1Alt{"备选：A1：Team 管理角色只查看摘要，不切换标签页。；A2：普通用户只从用户菜单查看个人余<br/>额。"}
    D1S10 --> D1Alt
    D1Err{"异常：E1：团队信息缺失，系统停留在 loading team 状态。；E2：当前不是 cre<br/>dits 计费模式，系统提示积分功能未启用。；E3：当前 Team 角色无权限，系统提示<br/>仅 Team Owner/Admin 可管理团队 Credit。"}
    D1S10 --> D1Err
    D1Perm["权限/可见性：1. Team Owner/Admin 可以查看 Team 钱包、购买积分并查看 Tea<br/>m 维度流水。；2. Team Member 在 Team Credits 页面中看到无<br/>权限提示，不能查看团队钱包、团队流水或购买按钮。；3. 注册用户只能在用户菜单查看自己的<br/>个人 Credit 余额和个人记录入口。；4. 系统管理员可以在后台为用户或团队手动上分<br/>，但不等同于进入某个 Team Credits 页面代替 Team Owner/Admi<br/>n 操作。"]
    D1S10 --> D1Perm
  end
  subgraph D2G["购买积分"]
    D2Start["Actor：注册用户、Team Owner、Team Admin、支付系统"]
    D2Entry["可见入口/区域：用户菜单 > 购买 Credit 按钮。；Team Credits 页面 > Buy<br/> Credits 按钮。；Buy Credits 弹窗 > Credit 套餐列表。<br/>；Buy Credits 弹窗 > 支付方式按钮、Generate QR Code <br/>按钮、二维码和 Refresh Status 按钮。"]
    D2Start --> D2Entry
    D2S1["1. 注册用户在用户菜单点击购买 Credit，或 Team Owner/Admin 在<br/> Team Credits 页面点击 Buy Credits，系统打开购买弹窗。"]
    D2Entry --> D2S1
    D2S2["2. 弹窗展示标题、说明、可选 Credit 套餐列表和支付区域。"]
    D2S1 --> D2S2
    D2S3["3. 系统加载套餐时展示“加载套餐中”；加载成功后，每个套餐展示 Credit 数量、价<br/>格和赠送额度。"]
    D2S2 --> D2S3
    D2S4["4. 用户点击某个套餐，系统高亮选中套餐，并清空旧订单二维码。"]
    D2S3 --> D2S4
    D2S5["5. 系统展示支付方式按钮；微信支付可选，支付宝暂未接入时显示不可用或置灰。"]
    D2S4 --> D2S5
    D2S6["6. 用户点击 Generate QR Code，系统创建支付订单并展示加载状态。"]
    D2S5 --> D2S6
    D2S7["7. 订单创建成功后，右侧区域展示二维码、订单号、等待支付状态和 Refresh Sta<br/>tus 按钮。"]
    D2S6 --> D2S7
    D2S8["8. 用户使用外部支付工具扫码支付；弹窗在待支付状态下定时查询订单状态，用户也可以点击 <br/>Refresh Status 主动查询。"]
    D2S7 --> D2S8
    D2S9["9. 支付系统确认成功后，系统展示成功提示，并刷新钱包余额或交易记录。"]
    D2S8 --> D2S9
    D2S10["10. 弹窗底部展示最近交易记录；每条记录展示类型、时间、描述、来源、上下文信息、Cre<br/>dit 增减和变更后余额。"]
    D2S9 --> D2S10
    D2Alt{"备选：A1：用户取消支付或关闭弹窗，系统不增加积分，订单仍以支付系统最终状态为准。；A2：用户<br/>稍后重新进入购买弹窗，系统展示最新交易记录。"}
    D2S10 --> D2Alt
    D2Err{"异常：E1：订单创建失败，系统展示本地化错误提示和重试建议。；E2：支付失败、关闭或超时，系统<br/>保持订单未成功状态，并允许用户重新生成二维码或稍后查询。；E3：状态查询失败，系统展示查<br/>询失败提示。"}
    D2S10 --> D2Err
    D2Perm["权限/可见性：1. 注册用户可以发起个人 Credit 购买。；2. Team Owner/Admin<br/> 可以在 Team Credits 页面发起 Team Credit 购买。；3. Te<br/>am Member 在 Team Credits 页面中不能发起团队购买，也不能看到团队<br/>购买按钮。；4. 支付系统只确认订单状态和收款结果，不能绕过 BoardX 的 Team<br/> 权限。"]
    D2S10 --> D2Perm
  end
  subgraph D3G["查看积分流水"]
    D3Start["Actor：Team Owner、Team Admin、注册用户"]
    D3Entry["可见入口/区域：用户菜单 > Credit 余额区域 > Credit Records 弹窗。；Te<br/>am Credits 页面 > Usage 标签页。；Team Credits 页面<br/> > Purchase 标签页。；Buy Credits 弹窗 > 最近交易记录。"]
    D3Start --> D3Entry
    D3S1["1. 注册用户点击用户菜单中的 Credit 余额区域，系统打开 Credit Reco<br/>rds 弹窗。"]
    D3Entry --> D3S1
    D3S2["2. 弹窗加载个人钱包摘要，并展示剩余 Credit 和累计消耗 Credit 两个摘要<br/>卡片。"]
    D3S1 --> D3S2
    D3S3["3. 弹窗加载个人消费记录时，列表区域展示“加载记录中”。"]
    D3S2 --> D3S3
    D3S4["4. 加载完成后，弹窗展示个人消费记录；每条记录展示消费类型或原因、Credit 消耗数<br/>量和变更后余额等信息。"]
    D3S3 --> D3S4
    D3S5["5. 如果没有个人消费记录，系统展示“暂无消费记录”空状态。"]
    D3S4 --> D3S5
    D3S6["6. 用户可以滚动弹窗列表，查看更多记录；关闭弹窗后返回原页面。"]
    D3S5 --> D3S6
    D3S7["7. Team Owner/Admin 在 Team Credits 页面通过 Usag<br/>e 标签页查看团队消耗记录。"]
    D3S6 --> D3S7
    D3S8["8. Team Owner/Admin 在 Team Credits 页面通过 Purc<br/>hase 标签页查看团队购买、赠送和管理员授予记录。"]
    D3S7 --> D3S8
    D3S9["9. 用户在 Buy Credits 弹窗底部查看最近交易记录，包括购买、赠送、授予或消<br/>耗等记录。"]
    D3S8 --> D3S9
    D3Alt{"备选：A1：用户只查看摘要卡片后关闭弹窗。；A2：Team 管理角色只查看 Usage 或 P<br/>urchase 中的一个标签页。"}
    D3S9 --> D3Alt
    D3Err{"异常：E1：记录加载失败，系统保持弹窗或页面可见，并允许用户稍后重新打开或刷新。"}
    D3S9 --> D3Err
    D3Perm["权限/可见性：1. Team Owner/Admin 可以查看 Team 维度记录。；2. Team <br/>Member 在 Team Credits 页面中不能查看团队钱包和团队流水。；3. 注<br/>册用户只能查看自己被允许访问的个人 Credit Records。；4. 系统管理员可以<br/>在 Admin Panel 查看或触发手动上分相关操作，但不能把后台权限下放给 Team<br/> Member。"]
    D3S9 --> D3Perm
  end
```

