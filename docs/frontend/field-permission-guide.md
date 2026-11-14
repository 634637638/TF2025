# 字段权限使用指南

字段权限用于控制业务字段是否展示、是否可编辑。它不能替代页面动作权限，也不能只靠浏览器隐藏数据；后端接口必须按相同的角色字段配置处理敏感响应和写入。

## 客户商品记录

客户详情商品购买/赠送记录使用 `GET /query/customers/:customerId/goods`，要求客户、综合查询及配件三模块查看权限；响应只含商品来源字段，不输出客户身份或采购成本；商品模块客户姓名/电话隐藏时，后端拒绝此定向筛选，前端清理记录及原单入口，避免通过客户ID反查隐藏关联。沿用 `accessories_accessoriesview` 严格脱敏和原销售门店范围，隐藏数量/用途/金额时同步隐藏派生积分；配置读取失败时不能回退完整数据。原共同单入口继续按自身双模块权限、逐行字段及全部门店核验。原客户手机统计不混入此列表；契约见[客户商品历史](../backend/accessory-entry.md#客户商品购买及赠送历史)。

## 客户贴膜服务

贴膜上下文 `GET /query/customers/:customerId/film-services` 和共同结算的 `film_service` 扩展复用严格 `FieldAccessService`，模块为 `accessories_accessoriesview`。办理须名称、类型、用途、门店、数量、单价、总价、客户姓名/电话、时间和办理人可见，提交SN仍校验原SN权限；字段或权限读取故障在写入前拒绝。

客户详情“查看贴膜记录”复用手机详情的同一贴膜弹窗，入口同时核验客户/查询/配件查看和专用 `query:film`，客户模块姓名/电话及配件模块客户姓名/电话均须可见。服务端客户姓名或电话隐藏时，在定向查询前403 `FIELD_PERMISSION_DENIED`，不返回次数或资格。关闭父详情、切客及必要权限丢失卸载子窗；配件任一字段权限变化取消在途请求并清空旧历史，按最新权限重读，失败不保留旧次数/资格。

历史按原字段递归遮蔽名称、门店、办理人、时间、订单编号、用膜数量及费用。数量、用途、单价或总价任一隐藏时连同收费金额遮蔽；耗膜总量跟随数量，服务次数由专用 `query:film` 授权，独立于耗材数量。资格只返回布尔值，不公开原购买单/门店；内部创建人、成本和资格来源不透传。专用动作跨店最小历史与实际服务店范围见[贴膜契约](../backend/accessory-entry.md#权限与最小历史)。

## 前端入口

使用 `frontend/src/composables/useFieldPermissions.ts`：

```ts
import { useFieldPermissions } from '@/composables/useFieldPermissions'

const {
  init,
  isFieldVisible,
  isFieldEditable,
  getHiddenFields,
  filterFieldsByPermission
} = useFieldPermissions()

await init()
```

- `isFieldVisible(moduleKey, fieldKey)` 控制字段是否展示。
- `isFieldEditable(moduleKey, fieldKey)` 只在字段可见且字段被列入 `editable_fields` 时返回 `true`。
- `getHiddenFields(moduleKey)` 和 `filterFieldsByPermission(...)` 用于统一过滤。
- `shouldShowActionColumn(fieldVisible, actionPermissions)` 用于计算操作列是否展示。

具体模块名与字段 ID 应使用页面注册值，不要依赖短名称猜测兄弟页面的字段配置。

## 必须覆盖的区域

同一字段权限应一致应用于统计卡片、筛选项、表格、移动卡片、详情、表单、打印、导出和字段相关计算。表单提交应从允许字段构造请求，不能把被隐藏字段的旧值或默认值一并提交。

动作权限与字段权限分开判断：

- 字段权限决定数据列是否可见、字段是否可编辑。
- 页面动作权限决定创建、编辑、审批、到账、上传等操作能否执行。
- 所有业务操作列、卡片操作区和手机详情底部操作区必须使用公共 `shouldShowActionColumn(fieldVisible, actionPermissions)`，列可见性按“操作字段可见或至少一个列内动作获权”计算；禁止页面自行写 AND 条件。按钮仍单独校验自己的动作权限。
- 关闭操作字段后，只要用户仍拥有编辑、删除、匹配等任一动作权限，PC 操作列和手机详情底部操作区仍保留对应操作入口。
- 普通业务字段（例如状态、时间、金额）只由自身字段权限控制，不能因为用户拥有某个动作权限而被强制显示。

## 后端边界

配件业务的库存/选项、商品查询及随单凭证、共同结算、商品/手机联合售后、采购付款使用严格字段读取。公共 `FieldAccessService({ strict: true })` 将角色或字段配置读取故障向调用方抛出；角色配置JSON损坏、非对象、隐藏/可编辑字段列表格式错误时同样拒绝，不能忽略出错角色并按完整权限继续。明确没有字段限制的有效配置或查询成功且没有配置，仍按原规则处理，动作权限另行核验。HTTP层返回统一故障响应，不返回原单数据，不在权限未核验时执行交易；合法隐藏字段仍为403，与读取故障区分。

配件路由字段守卫将已核验配置保存在本次请求的 `req.fieldPermissions`，供后续字段守卫和响应脱敏共用；不建立跨请求权限缓存，不在采购成功后因再次读取权限故障而误报失败。严格解析复用原归一化入口，日志不打印损坏配置正文。正式故障回归：`ENV_FILE=test/missing-unit-env RUN_DB_TESTS=false node --test backend/test/accessory-field-failure.check.js`，使用真实解析及数据库替身，不连接云端。

整单明细分别使用 `query_queryview` 手机字段和 `accessories_accessoriesview` 商品字段，不将两模块递归套在整张订单上。共享头取交集；隐藏任一必要售价/数量/用途时完整整单金额及积分合计为null，防相减推断。前端监听公共隐藏字段变化，清理旧请求和结果后重读；模块撤权清空。接口与正式回归见[整单明细](../business/sales-receipt-standard.md#整单明细)。

供应商详情的采购/手机统计分别服从真实来源模块，不能仅凭 `suppliers:view` 暴露成本。配件来源为货款 `supplier-payments:view` 和 `payments_supplierphonepaymentsview` 的供应商、店铺、采购数量及成本字段；手机来源为 `inventory:view` 和 `inventory_inventoryview` 的供应商、店铺、数量、进价及库存价值字段。两来源使用严格公共 `FieldAccessService`，读取故障失败关闭；隐藏或未知返回 `null`，不以0拼出完整合计。页面关闭/撤权取消详情请求并清空统计，完整契约见[供应商详情采购统计](../payments/SUPPLIER_PAYMENT_BATCH_STANDARD.md#供应商详情采购统计)。

配件采购入库 `request_key` 为事务元数据，在业务字段过滤后附加，仅采购入口转发，模板编辑不携带；后端仍要求 `accessories:create` 和原字段写权限。会话恢复原载荷时，任一原字段已隐藏均禁止重试，不能借恢复绕过字段拒写。原采购回执 `stock_in_id` 跟随 `basic_info.batch_no` 遮蔽，数量/总额/时间沿用原权限；不返回防重键或摘要。契约见[采购入库防重](../backend/accessory-entry.md#采购入库防重与异常恢复)。

采购 `product_snapshot` 仅内部存储：服务端先校验身份/版本并投影固定白名单，再对名称、品牌、型号、供应商及店铺等执行原模块字段脱敏，原始JSON不得进入响应以绕过隐藏字段。公开 `has_snapshot` 只表达原资料来源，不授予字段权限；页面拒绝缺该布尔标记的采购响应。入库历史列表同时核验原入库及全部历史分配店的整单授权，不能因当前库存划到本店而读取原整单。新单与旧无快照资料、坏快照拒读及受控迁移见[采购入库原资料留存](../backend/accessory-entry.md#采购入库原资料留存)。

角色字段配置保存在 `role_field_permissions.field_config`，当前格式由后端 `field-permission-normalizer` 解析。用户字段权限由受认证接口 `GET /permissions/user-field-permissions` 返回。

后端必须针对具体业务接口执行字段过滤和写入校验。前端 `v-if`、本地权限缓存或只读样式都不是数据安全边界。新增字段权限时，应同步更新字段登记、后端响应/写入处理和契约测试。

提醒与经验分享通过 `backend/src/services/field-access.service.js` 统一字段权限读取、递归响应脱敏和隐藏字段写入判定，复用 `data-masking.service.js`；HTTP 403 与异常转交由 `backend/src/middleware/field-access.js` 负责。各业务 controller 保留自己的模块键、响应键/请求字段映射和特殊别名转换，不能将不同模块的同名字段混用。请求显式提交 `null`、空字符串、`false` 或 `0` 仍算写入；未提交的字段才不参加拒写判定。提醒类型隐藏名称时仍遮蔽类型对象的 `name`，分享隐藏作者时仍遮蔽 `author` 与 `author_id`。

定向回归：`node --test backend/test/field-access.check.js backend/test/reminder-controller.check.js backend/test/shared-controller.check.js`。租赁的“多个字段全部隐藏才拒写”和动作权限例外仍由原模块处理，不能直接套用单字段拒写规则。

相关入口：

- 字段登记：`frontend/src/config/moduleFields.js`
- 字段权限归一化：`backend/src/utils/field-permission-normalizer.js`
- 字段配置接口：`backend/src/routes/permission-management.js`
- 字段契约：`backend/scripts/config/field-contracts.json`
- 覆盖检查：`cd frontend && npm run check:field-permissions`

不要使用旧文档中提到的 `v-field-permission`、`FieldPermissionWrapper` 或 `useFieldPermission`；当前项目没有这些统一入口。

配件采购用途 `usage_type` 登记为 `basic_info.usage_type`，入库表单隐藏后不提交且禁止隐式默认入库，HTTP写入由原统一字段中间件拒绝。综合查询商品模式沿用该字段控制销售/赠送筛选和批次用途；`GET /query/goods` 及详情复用商品字段配置，原成本、客户、SN、门店与嵌套批次同样后端脱敏。隐藏字段不能参与关键词检索；隐藏门店、用途或销售日期时显式筛选返回403。累计积分随数量/单价/总额权限遮蔽，不能反推隐藏成交金额。完整映射及历史快照边界见[商品查询契约](../backend/accessory-entry.md#综合查询商品模式)。

配件详情当前批次库存 `GET /accessories/:id/batches` 使用同模块严格公共字段服务；门店或数量隐藏时拒绝读取，避免通过正余额行和分页反推。原成本、供应商、批次号、用途、SN管理、品牌型号、原入库时间和人员分别脱敏；来源核对标记仅表达流水完整性，原采购内部ID不公开。列表与手机双击详情沿用同一字段入口，撤权废弃旧数据。契约见[当前批次库存查询](../backend/accessory-entry.md#当前批次库存查询)。

配件类型统计的件数与零售参考价值不得反推隐藏库存或售价：隐藏当前库存/入库数量时件数及价值为NULL，隐藏零售价时价值为NULL，隐藏类型拒绝分组。库存预警需要预警值、数量和库存状态可见，隐藏任一即拒绝读取或低库存筛选。派生利润还依赖进价与零售价，派生剩余依赖当前库存，服务端递归遮蔽，前端公共配件字段入口同步控制列和详情；阈值或库存状态不可见时不显示对应低库存颜色。详细范围和专项回归见[库存读取、预警与类型统计](../backend/accessory-entry.md#库存读取预警与类型统计)。

商品采购“退供核对”额外同时要求 `supplier-payments:view/accessories:view`。原采购模块的数量、供应商、店铺、成本/总额、付款状态和库存模块的门店/数量均为必要字段，隐藏任一即拒读；其余原采购资料与库存成本/用途/SN管理分别按对应模块严格遮蔽。两个模块的权限读取故障均失败关闭，前端撤权清除内容及在途请求。此查看入口不授予退供/退款动作，契约见[原采购单退供核对](../backend/accessory-entry.md#原采购单退供核对)。

该核对响应内原采购在库 `serials` 由配件 `basic_info.serial_number` 控制；隐藏时不查询逐件数据，整个SN分页对象为NULL，传SN搜索或页码也会403。普通批次核对仍可使用，不能通过SN命中总数推断隐藏值。页面SN搜索、分页及手机详情共享该字段权限，撤权取消请求并清空旧内容。

退供试算 `POST /supplier-payments/accessory-purchases/:id/return/quote` 在核对必要字段之外，还要求库存成本、用途、SN管理可见；非空SN选择另要求SN可见，SN隐藏可只选普通数量。响应仅含已授权的原价格、数量、用途、门店、SN及付款状态，不含可隐藏的商品资料。撤权取消试算并清理选择，普通/SN原来源及当前库存仍由服务端只读重核；试算不授予退供、退款或应付冲减动作。

商品查询新增已退/未退数量，与原数量共同受 `stock_info.total_quantity` 控制，不能通过相减反推。商品退货三个接口复用 `SalesAftersaleController` 的公共字段服务，在任何试算写入或提交前要求名称、出库类型、门店、数量、单价、总额、业务时间和备注可见；原单上下文含SN，读取上下文或提交SN还须SN字段可见。缺必要字段返回403 `FIELD_PERMISSION_DENIED`，不允许先办理再脱敏。前端 `GoodsReturnDialog` 复用同一配件字段入口和页面动作权限；返回不含采购成本或内部库存/积分原始快照。契约见[商品原单退货](../guides/sales-transfer-transaction-standards.md#商品原单退货)。

商品详情售后历史 `GET /query/goods/:id/aftersales` 复用上述查询映射。用途隐藏时同步遮蔽实物/扣款数量和完整资金组；数量/单价/总额任一隐藏时同时遮蔽全部退款、补款、同单抵扣调整（`settlement_offset_amount`）、优惠追回/补退、积分及支付方式/渠道；门店、办理人和ID、SN、业务/记录时间、原因备注各跟随原对应字段。前端历史列同步控制，NULL不显示为0，运行时拒绝半脱敏资金。查看只要求双模块view，原销售与办理门店范围在服务端核验，不能用前端隐藏替代；同笔其他明细仅服务端核验合计，不向客户端透传。契约见[商品售后历史查询](../guides/sales-transfer-transaction-standards.md#商品售后历史查询)。

商品换货的上下文/试算/提交复用同一字段服务，额外要求销售员字段可见；原件或新件SN输入均检查SN权限。操作独立要求 `query:exchange`，新件收费/赠送另校验原配件动作。历史 `replacement_amount/exchange_credit_amount` 并入完整资金组，嵌套换入商品的名称、单号、SN及原销售员分别跟随既有字段递归遮蔽；`operation_type` 仅表示退货/联合退货/换货，不公开内部关系或凭据。契约见[换货办理接口与页面](../guides/sales-transfer-transaction-standards.md#换货办理接口与页面)。

换货上下文的 `replacement_sale_type/gift_charge_settled` 来源于原单扣款核验，读取前仍完整校验用途、数量、金额及其他必要字段，不作为普通详情的脱敏例外。已扣款赠品换入新件按收费动作授权；前端读取后按该用途决定可办理状态，实际提交由后端重查，不能用原gift标记或客户端改售价绕过收费权限。

共同结算 `POST /sales/checkout` 复用 `FieldAccessService`，分别按 `sales_salesview` 和 `accessories_accessoriesview` 检查实际明细。手机嵌套售价、客户姓名/电话/Apple ID、门店/销售员/时间、备注、支付方式/渠道及交易号按 `sale.*` 拒写；商品数量/售价/SN/出库方式、客户及门店/备注/销售员/销售时间按配件既有字段拒写。`sale.customer_apple_id` 已补入销售字段登记，与现有销售表单映射一致。请求支持已有库存商品和手机ID；快速出库专用 `quick_phone` 接受采购新设备的成本和资料，各字段按 `sale.brand/model/color/memory/supplier_id/imei/serial_number/condition/purchase_cost/sale_price/inventory_time` 拒写，禁止同时携带已有库存手机。不接受内部快照；响应不含客户资料、采购成本/利润及SN快照，不能靠修改请求取得这些数据。共同结算页面复用 `canViewAccessoryField`，手机合单同时检查销售字段；必要字段隐藏时禁止结算，隐藏备注及交易号不随默认值提交。商品候选接口的搜索列及响应同步按配件字段配置过滤，详见T22验证边界。

手机退货原单核对同时复用手机与商品字段服务：商品原数量、已退/剩余及剩余赠品约定额随数量权限遮蔽；原SN和未退SN随SN权限遮蔽；剩余约定额还受单价和总额控制；出库类型隐藏时同步遮蔽赠品约定及状态。核对不返回完整历史凭据，数量汇总包含原商品的全部已退事实，历史详情仍独立执行双门店范围。接口及弹窗边界见[手机退货原单核对](../guides/sales-transfer-transaction-standards.md#手机退货原单核对)。

手机与关联商品的报价/提交在写入前复用手机和商品公共字段服务，要求各自必要字段可见；未退赠品扣款确认复用 `accessories:gift`，后端独立校验。商品售后历史新增扣款件数/金额，由用途、数量和资金字段共同约束，不能以0件返库误记实物退回。契约见[手机与关联商品退货](../guides/sales-transfer-transaction-standards.md#手机与关联商品退货)。

## 工资记录商品提成字段

工资记录控制器复用严格 `FieldAccessService`，团队用 `salary_salaryrecordsview`，本人用 `salary_mysalaryview`；本人仍只读自身已发工资。`salary.commission_amount` 同时遮蔽 `commission_amount`、手机 `commission_detail` 和只读 `goods_commission`，页面编辑、结算、详情及手机记录同步遵守。隐藏工资字段写入和权限读取失败在事务写入前拒绝；内部快照、成本、规则、来源摘要及工资基数不进入公开响应。`calculation_version` 仅核对预览变化，不授予权限；自动保存持锁后区分 create/edit，手工表单不能直接paid。契约及回归见[正式工资金额、保存与页面](../business/salary-record-standard.md#正式工资金额保存与页面)。

## 工资模板商品提成字段

`salary_salarytemplatesview` 新增整组字段 `template.goods_commission_rule`，沿用原 view/create/edit 动作及“用户 → 角色 → 权限”。商品规则可见性和可编辑性独立核对：隐藏不回填、不提交，只读不提交；关闭与零费率不能被默认值覆盖。保存中所有相关控件禁用。

后端工资模板控制器复用 `FieldAccessService`：隐藏字段写入（包括null清除、关闭规则）返回403，权限读取失败拒绝写入；详情、列表及嵌套保存响应递归遮蔽。完整对象校验、缺省/null语义与受控迁移见[工资模板商品提成配置](../business/salary-record-standard.md#工资模板商品提成配置)。正式回归入口为 `frontend/tests/salary-template-goods.spec.ts` 和 `backend/test/salary-template-goods.check.js`。
