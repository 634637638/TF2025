# 客户销售积分统一规范

> 2026-11-14结构状态更新：用户确认可恢复备份、停写并授权后，T22本批9项迁移已在当前配置云库执行并逐项核验；发布结构检查10项均ready。未回填历史积分/采购/工资，未创建真实交易；配置启用及真实业务验收仍未完成。执行证据与剩余事项见[T22](../development/TECHNICAL_DEBT_PROGRESS.md#t22-配件商品业务闭环2026-11-12)。

本文规定客户积分的唯一计算、入账、冲减和迁移边界。适用于正常销售、批量销售、快速出库、综合查询交易转换与编辑、退库、设备删除、租赁买断、批发、划拨和历史数据导入。

最后核实日期：2026-11-14。

## 积分规则

- 积分基数固定为每消费 100 元；全新和二手可多选参与，并分别设置每 100 元累计 1 至 100 积分。
- 每条 `sales` 记录独立计算并向下取整。批量销售中的每台设备都有独立销售记录和积分凭据，禁止先汇总整单金额再取整。
- 普通/批量手机累计与共同结算均复用公共 `quoteCustomerPoints` 规则，成交金额先转整数分，每台取整后再加总积分和消费额，避免余数合并发分或浮点累计误差。此处是新机/二手奖励累计，手机本身及整单积分抵扣仍未开放，不改写历史已发积分。
- 只有零售类型 `retail`、`sale`、`normal`、`batch`、`batch_item` 参与积分。
- `wholesale`、`peer_transfer`、`supplier_proxy` 以及其他非零售类型固定为 0 积分。
- 规则关闭、设备类型未参与、客户为空或金额按所设比率计算不足 1 积分时，本条销售积分为 0。

设置接口为 `GET /api/customers/points-config` 和 `PUT /api/customers/points-config`。读取要求 `customers:view`，修改要求 `customers:manage`；权限仍按“用户 → 角色 → 权限”统一校验，前端按钮隐藏不能代替后端鉴权。

## 商品积分配置与明细计算基础

客户管理的积分设置统一维护全新手机、二手手机、配件/商品三个来源。页面内部单元为 `frontend/src/views/customers/page/CustomerPointsSettings.vue`，唯一共享类型为 `frontend/src/types/customer-points.ts`。商品累计和商品明细抵扣已接入共同结算及销售页面；完整售后仍待 T22 后续。来源账迁移、期初核对和真实业务验收是启用前置。配置保存不改写客户余额或历史单据，不能据此认为已上线积分抵扣。

| 配置字段 | 取值与含义 |
| --- | --- |
| `include_accessories` / `accessory_points_per_100` | 商品累计开关及每100元累计1–100积分，旧配置默认关闭/1 |
| `redemption.enabled` | 抵扣独立开关，默认关闭，不依赖自动累计开关 |
| `redemption.points_per_yuan` | 抵扣1元需要1–1000000整数积分；未配置为 `null` |
| `redemption.max_percent` | 每件商品最高抵扣比例1–100整数百分比；未配置为 `null` |
| `redemption.sources` | 可抵扣来源 `new`、`used`、`accessory`，默认空数组 |
| `redemption.all_accessory_categories` / `category_ids` / `accessory_ids` | 全部商品参与，或指定类型内的具体商品ID；类型与商品均多选，默认关闭/空数组。旧配置没有商品ID字段时保留原类型语义 |

兑换数值由后台配置，不预设上线比例。启用前必须填写比例、上限、来源及商品类型范围；重复/非法ID、无效开关、越界及不完整启用配置返回400。新选择类型必须存在且启用，已有停用关联可保留；配置不使用的已选类型也不能提交不存在的ID。旧客户端省略扩展字段时保留原已存配置。读取旧配置兼容原手机默认值，缺少完整抵扣配置时不自动开启。

`GET /api/customers/points-config` 保留直接返回配置的契约；传 `include_options=1` 返回 `{ config, categories: [{ id, name, status }], products }`，只提供类型最小资料及 `products` 已选商品最小档案，沿用 `customers:view`，不额外要求配件管理权限。其他 `include_options` 值返回400。`PUT` 返回完整规范化配置。存储继续使用 `settings` 中的 `customer_points_config` 键，无需新增表或字段。

积分设置布局（2026-11-16）：累计与抵扣分区，各自展示开启状态，来源开关与每100元累计值同行配对。复用公共分区、表单栅格、弹窗宽度及按钮；长字段独占一行，类型和商品多选使用折叠标签，已选商品放入独立可展开、可滚动清单，可逐项移除，防止大量标签遮挡字段。关闭“全部商品参与”后，必须先选类型，再选择单个、多个或全选所选类型的商品；全选覆盖所选类型的全部分页，不局限于当前检索结果，最多1000个，读取失败不发布半批选择。取消某类型仅移除该类型商品，关键词变化不清空原选择。

商品候选接口 `GET /api/customers/points-products` 使用 `customers:view`，参数为逗号分隔的 `category_ids`（1–1000个唯一正整数）、`search`（名称/型号/品牌，最多100字符）、`page`、`page_size`（1–100，默认50）。返回 `data` 最小商品数组及顶层 `pagination`；字段为 `id/name/category_id/product_model/brand_name/color_name/status`，不返回库存、采购成本或供应商。分页候选只提供启用的实际商品，已有停用选项由设置读取回显，可保留或移除，不能新选停用商品。保存时核对所选商品存在、所属类型及停用规则；试算、自动分配和正式结算均按实际 `accessory_id` 与 `category_id` 双重匹配，同类型其他商品不会自动参与。开启“全部商品参与”时不限类型/具体商品。旧客户端省略商品ID字段不能清空已存在的限制；旧类型规则无ID字段继续兼容，使用新页面重新保存受限范围时必须明确选商品。配置沿用原 `settings` JSON，无需迁移数据库结构；不自动修改云端现有配置。

`backend/src/utils/customer-points-rules.js` 是规则规范化、严格保存校验及明细试算的唯一实现，由积分服务重导出。`quoteCustomerPoints` 接受 `items`、结算前 `available_points` 和配置，只计算、不读写数据库：

- 每件明细有唯一 `key`、来源、整数分 `amount_cents`、`is_gift`、`redeem_points`，商品限定范围时带 `category_id` 及实际 `accessory_id`。数量商品由下述公共数量试算入口处理，保持逐件比例及取整，不按整行金额累计。
- 金额为优惠后、积分抵扣前金额。赠品金额及使用积分必须为0；任何使用积分的明细不累计，其他明细正常累计，每件向下取整。
- 只能消费结算前余额，本单获得积分不能用于本单抵扣；按允许来源/类型/单件比例校验。兑换结果须精确到分，不足一分不吞积分，返回400要求调整数量。
- 返回逐件实付、抵扣、使用/累计积分、规则率及整单合计、结算后余额、独立规则快照。拒绝余额或合计越界。积分归客户账户，不按店铺拆余额。

`backend/src/utils/checkout-points.js` 的 `quoteCheckoutPoints` 是共同结算数量行试算入口，复用单件规则，不复制累计或兑换公式。输入为 `items`、服务端取得的 `availablePoints`、真实账户 `balance` 和配置；每行金额仍为单件整数分，另带正整数 `quantity`，行抵扣积分为整行总量。默认 `balance=availablePoints`，允许真实余额包含暂不能抵扣的历史积分，要求 `balance>=availablePoints`，本单新发积分不增加可用额度。

为避免999999件逐件展开，该入口按兑换到分的整数步长稳定分配成最多两组，余下步长放在前组；每组调用单件公共规则检查来源、类型及单件比例。任何使用抵扣的数量行整体不累计，即使其中部分件分到0抵扣；没有抵扣时每件取整后乘数量。最终一次核对整单已用、累计和真实余额，不能在每件试算时反复叠加原账户余额而错误报超限。输出包括逐行/整单原金额、使用/累计积分、抵扣分值、实付及 `balance_after`，行 `units` 各组包含 `quantity/points_used/deduction_cents/payable_cents/points_awarded`。该入口只计算，不自行扣分；实际扣分由共同结算事务和来源账服务负责。

共同结算 `POST /api/sales/checkout` 在同一事务锁客户及库存，保存规则快照、逐行累计及请求结果凭据。商品行可选 `redeem_points` 为整行0–2147483647整数；缺省/0保留旧规范化载荷摘要，非零必须明确提交抵扣后的 `payment_info.payment_amount`。手机行和整单非零抵扣仍返回 `POINTS_REDEMPTION_NOT_READY`，不能因配置选择了手机来源而静默放行。

结算发分前从来源账取得可消费余额及来源截止点；完成受控历史期初承接后，历史积分与新来源共同参与抵扣，本单新积分不增加本单可用额度。每条商品按真实锁定类型、兑换步长、逐件比例试算；保存真实明细ID后同连接FIFO消费，先扣完本单积分再通过公共入口发手机及其余商品奖励，避免临近余额上限先发后扣的误拒绝。抵扣的整条数量行不累计，赠品不抵扣/不累计。任一收款、SN、库存、明细、积分或订单失败均回滚全部事实。

新商品快照除 `points_units` 外保存 `points_used/deduction_cents/gross_cents/points_per_yuan`；历史缺失抵扣字段按0，不以当前配置补造。成交 `unit_price` 保留原价；商品销售及明细总额、利润、实际收款按净额计算，不能将多件分币抵扣平均为不准确的两位小数净单价。共同头 `total_amount` 为抵扣前合计，`final_amount/paid_amount` 为净额，响应 `total_amount/paid_amount/deduction_amount/points_used/points_earned` 保存幂等结果；未知成本仍为NULL。全额抵扣仍为收费销售，净额0时不伪造收款。

手机“附加商品”的一键抵扣复用本规则。试算可传 `auto_redeem:true`（严格布尔、默认false），按稳定商品顺序自动分配结算前可用积分，只处理收费配件，排除手机/赠品/不匹配分类；单件上限先按分取整，再按可精确兑换的积分步长分配，多件只输出至多两组。该参数只用于只读试算，正式结算须提交明确逐行积分，仍事务重验，不承诺预留余额。规则入口位于客户管理“积分设置”，可配置兑换率、每件最高比例和分类；固定金额上限尚未提供。配置基础支持新机/二手来源，但当前交易入口明确不开放手机及整单抵扣，不能将勾选项当作已接入；设置页将手机来源标注“暂未接入”并禁止勾选（已有配置保留但不代表已开放抵扣）；按用户要求不再展示抵扣范围的长提示，实际结算支持范围保持本节约束。

手机附加商品的“确认附加商品”仅保存本地商品/逐行积分及试算依据，不实际扣分或发分。单台、批量和快速出库由外层最终确认才共同提交；销售日期、备注、人员及渠道使用最终表单值，客户/门店/成交明细改变则要求重新核对抵扣。相同字段内容不因 JSON 属性顺序不同而失效。草稿不预留余额，最终事务仍按当时规则与来源账核验。

独立商品收银在选购阶段只填写商品、数量和销售价，进入结算后按有效手机号及授权门店自动读取会员摘要；摘要的账户积分与 `available_points` 分别来自客户账户和积分来源快照，不能混用。读取不依赖支付资料，不自动抵扣；点击“积分抵扣”后才请求后端按商品明细分配，赠品不参与，使用本单结算前的已有来源积分。客户、门店、商品或权限变化后废弃旧试算，返回选购和关闭清除旧摘要；再次结算重新读取。摘要不写账户、不保留额度，真实提交仍重新核验，具体权限及响应契约见[共同结算](sales-transfer-transaction-standards.md#商品销售页面与候选检索)。

`POST /api/sales/checkout/quote` 使用同一载荷规范、销售动作/门店/字段校验，事务只读并回滚释放锁，不创建客户、设备、销售或积分。响应含 `available_points/balance/redemption_ready/points_per_yuan`、按分的整单及逐行原价/抵扣/实收/积分和分组；未迁移来源账时可用0且不开放抵扣。前端通过公共API及 `useLatestRequest` 手动试算；内容变更或关闭废弃旧响应，抵扣须试算后按净额提交。试算不保留额度，实际提交重新核验配置、余额及库存。没有直接HTTP扣分入口。

## 积分来源与消费分配账

`customer-points.service.js` 委托 `CustomerPointsLedgerService` 记录来源和消费分配，SQL 仅在 `customer-points-ledger.repository.js`。`customers.points` 仍是唯一账户余额，账表不另建客户余额；所有方法使用调用方现有事务连接，不自行提交。共同结算商品明细通过此入口消费，手机和整单非零抵扣尚未开放；没有绕过销售校验的直接扣分接口。

| 表 | 事实 |
| --- | --- |
| `customer_points_entries` | 追加 `award/revoke/redeem` 事件：客户、原手机销售或共同商品明细ID、带符号积分、变动后余额、未知来源冲减量、原兑换比例/抵扣分值、来源快照、服务端时间。手机正差额保留当时售价、交易类型、成色和积分配置快照；原销售删除后不级联删除来源账 |
| `customer_points_allocations` | 一条冲减/消费对应哪些原奖励事件，保存每个来源的积分及该次消费实际抵扣分值；借贷事件外键禁止级联删除，同一借贷组合唯一 |

来源账安装后，正常/批量/快速出库、编辑、类型转换、租赁及导入通过原公共手机积分入口自动记录真实正差额和原单冲减；共同商品按已保存的订单明细ID登记，赠品和零积分不伪造奖励。重复同步相同销售状态不发第二次积分。客户转移继续按稳定客户ID顺序锁定并逐户处理，任一步失败随销售事务回滚。

来源余额由奖励事件减去其实际分配量得到。历史账户余额通过受控 `opening_balance` 事件承接到同一来源账，不改变客户余额；新历史积分可与销售获得积分一样抵扣，并保留其分配/退货轨迹。先锁客户，再对来源和分配执行当前锁定读；不使用等待前建立的RR快照。余额、来源量、数值范围异常均409拒绝，不自动修账。原来源尚未消费的积分可冲回；奖励已经消费且本次减少超出该来源剩余量时返回 `POINTS_RECOVERY_REQUIRED`，要求走后续售后追回，不能挪用其他新单奖励或最低归零放行。

两张表均未安装时，普通累计暂兼容原流程，消费明确返回 `POINTS_LEDGER_NOT_READY`；只安装其中一张返回 `POINTS_LEDGER_SCHEMA_INCOMPLETE`，不得降级。迁移前已有余额原样保留，作为未追溯余额，不按现行配置补造奖励。内部消费能力仅允许来源可核对的新积分；历史余额待 T22.10 有依据核对后再纳入，不能自动转成可抵扣期初。历史凭据冲减只可使用未追溯余额，不动其他新单的来源积分；未知余额不足时返回 `POINTS_BASELINE_REQUIRED`。

内部 `snapshot` 在本单发分前取得可用来源数量及最大来源ID。内部 `consume` 先验证兑换精确到分、客户与截止点，按截止点以内FIFO来源分配；本单新积分即使已增加到账户也不能参与本单消费。每项分值以累进整数分摊保存，例如3积分抵1元、来自三个各1积分的来源，保存33、33、34分；金额相加精确等于原抵扣。商品明细抵扣唯一键使相同参数重试不重复扣分，换客户/积分/兑换值返回 `POINTS_REDEMPTION_CONFLICT`。共同结算在销售权限、商品范围及比例校验后调用该方法，不能直接接受客户端伪造的余额或截止点。积分售后记账见下文；商品原单退货已接退款/补款确认、返库和办理页面，手机联合商品退货已接专用事务，商品换货已接同事务及办理入口，工资仍待接入。

客户资料 `PUT /api/customers/:id` 不允许直接覆盖积分或余额。人工充值/加减积分及余额统一走账户调整接口，和客户余额、积分来源账在同一事务保存操作人、变动值、变动后余额及说明；客户页面双击积分或余额可查看明细。历史流水迁移默认只预览，来源无法还原的旧销售余额以“历史期初”明示，不伪造成具体某笔购买或充值。

客户明细中的自动流水会按来源显示中文说明及操作人：手机销售显示“购买手机（自动生成）”，共同结算含关联商品时显示“购买手机+商品（自动生成）”；商品销售显示“购买商品（自动生成）”。手机或商品退货会追加负积分流水，分别显示“手机退货”或“商品退货”，操作人取实际出库/售后办理人；人工调整保留手动填写的说明和操作人。销售积分追回沿原来源账执行，不能通过客户页面直接覆盖余额。

换货内部事务使用 `snapshot(..., { preserveSources: true })`，除最大来源ID外，保存每个来源在结算前可用数量及累计原消费分配数量；后续消费同时受当前有效来源、原逐源限额和该快照之后已消费数量约束。来源累计分配取不可变消费分配账，不能使用售后会减少的“当前已消费数量”，防止返分后连续多行重复占用旧限额。本次返分、撤回奖励或新发积分不会补足原额度；消费凭据保留逐源截止事实。默认共同销售快照形状保持原样，该选项仅由服务端换货事务取得，不接受HTTP传入的来源快照。正式回归覆盖返分后再次消费、撤销原可用来源后不能由另一刚返来源顶替及换货实际事务；换货HTTP及办理入口已接入，发布边界见[商品换货内部事务](sales-transfer-transaction-standards.md#商品换货内部事务)。

已扣款赠品按原实际扣款抵付新收费商品时，原赠品不补发奖励，新件按商品规则处理；使用已有积分抵扣的新件不累计，原实际扣款退款不转换成新积分余额。

### 来源账迁移

```bash
npm --prefix backend run migrate:customer-points-ledger
npm --prefix backend run migrate:customer-points-ledger -- --apply --backup-file=backups/.migrations/customer-points-ledger/before.json
npm --prefix backend run migrate:customer-points-ledger -- --rollback

# 历史余额期初承接默认只读预览；确认备份、停写和具体范围后才可 apply
npm --prefix backend run migrate:customer-points-opening-balance
npm --prefix backend run migrate:customer-points-opening-balance -- --apply --backup-file=backups/.migrations/customer-points-opening-balance/before.json

# 将可由已完成手机销售逐笔核验的期初积分恢复为 phone_sale 来源
npm --prefix backend run migrate:customer-points-source-repair
npm --prefix backend run migrate:customer-points-source-repair -- --apply --backup-file=backups/.migrations/customer-points-source-repair/before.json

# 账户余额/积分人工调整流水结构
npm --prefix backend run migrate:customer-account-ledger
npm --prefix backend run migrate:customer-account-ledger -- --apply --backup-file=backups/.migrations/customer-account-ledger/before.json
```

默认预览零写入。执行前须有目标及数据库写入授权、完整可恢复备份，并暂停积分业务写入；前置为销售积分字段和共同结算结构已迁移。脚本只创建上述两张追加账表，校验引擎、字段、索引及禁止级联的外键，不改原表、不补期初或历史流水。执行先用独占创建的0600备份文件保存相关原结构及余额/积分凭据摘要，再执行DDL并回读对比；DDL中断可按已有合规结构继续，冲突拒绝覆盖。摘要文件用于核对，不替代完整备份；迁移期间有并发修改会报告失败，需保留备份核对。

回退预览或执行均拒绝删除任何已有来源/分配历史。空账实际回退也须 `--apply --backup-file=...`；两条不带 `--apply` 的命令均不写数据库。应用/回退结构后重启后端以清理公共结构缓存，再受控验收；不能在服务存量进程缓存旧结构时开放抵扣。云端执行和测试证据统一记录T22。

### 积分售后追加账

`CustomerPointsLedgerService.returnAward` 与 `returnRedemption` 为内部事务能力，复用来源账仓储和调用方连接；不自行提交事务，不直接开放HTTP扣分/返分接口。`customers.points` 仍是唯一余额。办理方必须从锁定的原销售/数量分摊确定本次积分，完成操作权限、门店与原单关联校验，并将退款或补款凭据、库存返还和原单剩余量在同一事务保存；不能只提交积分变化即认为已完成退货。共同单旧售后保护暂时保留。

[商品原单退货](sales-transfer-transaction-standards.md#商品原单退货)已由 `SalesGoodsReturnService` 同连接调用上述两项能力及原批次/SN返库，并追加售后头/明细与线下资金确认。分次数量和SN取原成交 `points_units`，原抵扣商品整行不累计规则不变；优惠追回超过应退金额时显示补差价，返还已追回区间转为补退款。试算执行相同事务后回滚，正式提交重查，不能把试算视为实际返分或资金结清。共同手机旧删除式退库仍受保护，手机/关联赠品退货已由 SalesPhoneReturnService 同事务接入，商品换货已接同事务及办理入口，工资已接入代码；新账/售后结构已于2026-11-14授权迁移回读，不能仅据结构就绪登记业务已上线。

- 退奖励来源：只处理该手机销售或商品明细的剩余奖励，先冲回其可用积分，再沿原消费分配FIFO追回已使用部分的原优惠。历史未知余额和其他新单来源不被占用；不足、超额或损坏凭据拒绝。已办理奖励售后的来源不能再通过普通 `applyDelta` 编辑/冲回（`POINTS_AFTERSALE_SOURCE_LOCKED`），避免双扣。
- 退抵扣商品：按原消费来源FIFO返还，仍有效的积分恢复到原来源，可再次使用；不生成新的奖励。已被来源退货追回的部分返回应补退金额，不能重新激活撤销的奖励，也不能让客户再次损失该优惠。调用方将其加入本次退款/补款核算。
- 内部结果以整数分返回 `recovery_cents` 或 `compensation_cents`，并返回 `points_delta` 和原记账余额。退款不足追回时，完整售后应展示需补差价；本记账层不发起资金退款，也不能替代补款记录。
- 部分退货保留原消费分配ID及 `[start,end)` 积分区间。区间金额使用原整笔抵扣的累进整数分摊，不能对单个来源重新均价或按现行兑换规则计算。原3积分/1元分到三个来源的33、33、34分，在分次追回/返还时仍守恒。
- 已追回区间与后来返还区间求交，决定恢复积分或补退金额；相同请求键及参数幂等返回原结果，改客户/来源/数量拒绝，其他请求不能超过原剩余量。返还、消费和来源冲回都先锁同一客户，使用当前锁定读；后段退款、库存或日志失败须随外层事务整体回滚。

新增 `customer_points_aftersales` 一张追加凭据表，保存请求键/摘要、客户、操作类型、原来源、积分数、余额变动、追回或补退金额及分配区间JSON。奖励、消费和分配旧表不改写，不维护第二份余额，不级联删除售后凭据；按客户与原来源建立索引，请求键使用区分大小写的ASCII唯一索引。每次来源状态由原账与售后事实重放，金额/数量/区间不符拒绝猜测修复。

```bash
npm --prefix backend run migrate:customer-points-aftersales
npm --prefix backend run migrate:customer-points-aftersales -- --apply --backup-file=backups/.migrations/customer-points-aftersales/before.json
npm --prefix backend run migrate:customer-points-aftersales -- --rollback
```

前置为两张来源账已完整安装。默认预览零写入；实际执行仍须目标数据库写入授权、完整可恢复备份并暂停积分业务写入。脚本先独占保存0600结构/原数据摘要文件，再执行DDL与回读；摘要不替代完整备份。有售后历史连回退预览都拒绝删表，空表回退也必须 `--apply --backup-file=...`。先回退空售后表，才可回退空来源账；只剩售后表时应用拒绝降级为旧累计。迁移后重启后端清理公共结构缓存。云端执行证据及实际验收边界统一记录T22，不能把替身回归视为已上线。

## 销售页有余额但不能抵扣的提示

手机附加商品顶部及独立商品结算的会员资料来自摘要，账户积分与可用积分分别展示。独立商品订单结算移除单独“积分试算”按钮，读取客户后在抵扣操作旁直接显示本次可用积分；可用值为0、未知、读取中或失败时禁止抵扣，不能拿账户总余额代替。点击“积分抵扣”时复用原 `POST /api/sales/checkout/quote` 自动核算并按明细应用，允许取消恢复原价；底部操作为“确认收款”，正式收款提交时重新校验并扣分。贴膜办理继续沿用原专用明细试算流程。一键抵扣最终以接口返回的 `available_points` 为准。来源账未核对的历史或手工余额不能因账户有余额而自动投入消费，不回填原销售、不生成虚构来源。

按钮零抵扣时复用公共通知分别说明：抵扣未启用或账表未就绪；总余额大于0但可用为0（明确显示账户积分与本次可用0，并提示核对历史来源）；账户无可用积分（本次新增积分须结算后供后单使用）；有可用积分但商品范围、单件上限或兑换步长不允许本次抵扣。响应缺少有效整数积分/余额或启用状态时显示试算资料不完整，不把异常响应当历史积分问题。零抵扣不应用分配、不改变商品金额、不提前提交销售，仍可按原价确认附加商品。

本次只修正展示与边界提示，不放宽来源账消费规则。正式回归为 `frontend/tests/sales-goods-checkout.spec.ts` 与 `frontend/tests/additional-goods-checkout.spec.ts`；隔离浏览器复用 `node frontend/scripts/test-checkout-order.mjs --sales-only --scenario=single --viewports=390,1440`，验证有余额但无可用来源的提示、未提前提交，以及恢复可用来源后的原抵扣/取消/最终确认链。

## 销售积分凭据

`sales` 表使用以下字段保存逐单事实：

| 字段 | 定义 | 用途 |
| --- | --- | --- |
| `points_awarded` | `INT UNSIGNED NOT NULL DEFAULT 0` | 该销售记录实际发放的积分，是后续冲减和差额调整的唯一数值凭据 |
| `points_accounted_at` | `DATETIME NULL` | 该销售首次纳入统一积分核算的时间；用于区分新核算记录和历史无凭据记录 |

新增销售必须在同一事务内调用 `reconcileCustomerPointsForSale` 并设置初始化标记，即使批发、划拨或规则关闭导致积分为 0，也要写入核算时间。禁止仅依赖 `customers.points` 推断某条销售曾发多少积分。

## 必须接入的业务入口

| 场景 | 当前入口 | 必须行为 |
| --- | --- | --- |
| 正常单台、批量销售 | `backend/src/routes/sales.js` | 每条销售记录独立初始化积分凭据 |
| 手机与商品共同结算 | `backend/src/services/sales-checkout.service.js` | 手机调用原入口、商品逐件试算及公共入账；同事务保存明细/规则快照及幂等结果；商品行抵扣先扣后发，手机和整单非零抵扣拒绝 |
| 快速出库 | `backend/src/controllers/inventory.controller.js` | 零售累计；批发、划拨登记 0 积分凭据 |
| 综合查询编辑与类型转换 | `backend/src/routes/phones.js` | 售价、全新/二手、客户或交易类型变化时同步差额 |
| 综合查询退库、设备删除 | `backend/src/services/query-mutation.service.js` | 同一事务连接内，删除销售记录前按 `points_awarded` 冲减 |
| 共同手机及商品退货 | `backend/src/services/sales-phone-return.service.js` | 原手机来源先追回，逐件抵扣返还或补退款，同连接保存库存和资金凭据，不删除原销售 |
| 租赁买断及买断价格编辑 | `backend/src/routes/rentals.js` | 按零售销售初始化，改价时更新差额 |
| 批发、供应商划拨 | `backend/src/services/transfer.service.js` | 强制登记 0 积分凭据 |
| 历史数据导入 | `backend/src/services/data-import.service.js` | 明确禁止重放积分；已有可核算销售转为 0 时先冲减 |

新增任何会创建、更新或删除 `sales` 的入口时，必须同步加入本表、行为测试和入口审计。只更新 `phones` 状态而不处理销售积分属于事务不完整。共同结算手机的旧编辑/退库/删除入口返回 `CHECKOUT_AFTERSALE_NOT_READY`，避免破坏共同商品及积分凭据；共同手机及商品退货使用专用追加售后入口，商品换货已接独立办理，工资仍待接入，不把旧路径拒绝保护计为售后完成。

## 变更行为

- 售价或全新/二手变化：用目标积分减去 `points_awarded`，只更新差额。
- 客户变化：从旧客户扣除本单 `points_awarded`，再给新客户增加目标积分。
- 零售转批发或划拨：目标积分为 0，冲减本单原积分。
- 批发或划拨转零售：按当前生效规则计算并增加目标积分。
- 重复保存同一业务状态：目标积分与凭据相同，不得重复累计。
- 退库或物理删除销售：删除前先冲减；冲减失败时整个业务事务回滚。
- 来源账尚未安装时，旧冲减积分不足继续最低归零。安装后遵守上述来源隔离及已消费保护；仅历史未追溯余额仍可按旧凭据冲到零，不能用此行为替代退款优惠追回。

## 历史销售与迁移

迁移入口为：

```bash
npm --prefix backend run migrate:customer-sale-points
npm --prefix backend run migrate:customer-sale-points -- --apply
```

第一条命令只预览；第二条命令才执行 DDL。生产应用进程不得自动建列。未得到目标数据库、备份和本次执行授权前，只能运行预览或静态检查，不能执行 `--apply`。

执行 `--apply` 并完成字段校验后，必须重启后端服务。结构检查结果会在应用进程内缓存；未重启的旧进程可能继续使用迁移前的“字段不存在”结果，导致销售或快速出库事务被拒绝。重启后应先检查健康接口，再进行一笔受控业务验收。

迁移不会按当前规则反算历史销售，也不会改写历史客户积分。原因是历史规则可能已经变化，且迁移前没有逐单凭据；盲目回填可能重复增加或错误扣除。历史行的 `points_accounted_at` 保持空值，普通编辑、导入、退库或删除触达时只建立 0 基线，不自动改变客户既有积分。

历史状态转换按目标交易类型处理：未登记积分的批发、调货或划拨记录转为零售时，原类型按规则应为 0，系统可按当前后台新机/二手机积分配置计算并首次发放，随后写入逐单凭据；未登记积分的历史零售转为批发、调货或划拨时，系统按 0 基线处理，不推测曾经发过多少积分。需要冲减旧零售积分时，必须根据可验证的原始单据和当时规则另行人工审计。

回滚命令仅在所有 `points_awarded` 都为 0 时允许删除字段：

```bash
npm --prefix backend run migrate:customer-sale-points -- --rollback
```

已有非零凭据时脚本必须拒绝回滚，避免丢失冲减依据。

## 测试门禁

至少覆盖：

- 单台、批量和快速出库零售积分。
- 全新、二手分别计分及多选配置。
- 批发、调货、划拨固定 0 积分。
- 售价和成色变化只调整差额。
- 客户变化时旧客户扣除、新客户增加。
- 零售与非零售双向转换。
- 重复保存不重复累计。
- 退库、删除及事务失败回滚。
- 历史无凭据记录不按当前规则反算。
- 所有销售写入、转换和删除入口引用公共积分服务。

专项检查使用 `node --test backend/test/customer-points.check.js backend/test/customer-controller.check.js`，前端设置行为回归为 `npm --prefix frontend run test:unit -- tests/customer-points-settings.spec.ts --maxWorkers=1`。新增配置及明细测试覆盖商品来源、抵扣互斥、旧余额、比例/类型/精度/余额上限、旧客户端保存、停用类型和失败重试。数据库结构验证必须使用已迁移的独立测试库；业务库测试遵循[后端数据库回归测试](../backend/database-testing.md)，跳过数据库测试不能写成数据库功能已通过。

来源账专项为 `node --test backend/test/customer-points-ledger.check.js backend/test/customer-points-ledger-migration.check.js`，覆盖真实仓储SQL的事务替身、历史余额隔离、FIFO/分币、重复抵扣、同账户竞争模拟、已消费来源保护、客户转移、普通资料覆盖保护、异常整体回滚，以及迁移零写预览/结构冲突/中断重跑/备份/有历史拒绝回退。竞争替身不代替独立数据库的多连接并发验收。

数量行专项为 `node --test backend/test/checkout-points.check.js backend/test/sales-checkout.check.js`，覆盖逐件取整、整条抵扣明细不累计、兑换步长、单件比例、最大数量的两组分摊、可用来源与真实余额分离、临近余额上限、金额/积分守恒、无效输入及共同单分组快照/重试。共同结算正式回归覆盖实际商品扣分与净额收款、全额抵扣SN、分币、高余额、多行/并发模拟、幂等、后段失败回滚和只读试算；仍不能替代云端真实结算、多连接并发及完整退货追回验收。

售后记账专项为 `node --test backend/test/customer-points-aftersale.check.js backend/test/customer-points-aftersale-migration.check.js`，覆盖先退来源/先退抵扣商品、24种部分退货顺序、原来源返分后再消费、不同兑换比例及分币尾差、幂等/并发模拟/后段事务回滚、旧来源保护、损坏凭据、余额上限与受控迁移/回退。商品售后API和页面联动专项为 `backend/test/sales-goods-return.check.js` 与 `frontend/tests/goods-return.spec.ts`；真实数据库、多连接、真实退款和库存业务仍须单独验收。

## 相关文档

- [销售与调货事务标准](sales-transfer-transaction-standards.md)
- [客户表结构说明](../database/customers-table-schema.md)
- [数据库资料索引](../database/INDEX.md)
- [权限文档索引](../permissions/INDEX.md)
- [全局测试与清理规范](TESTING_STANDARDS.md)
