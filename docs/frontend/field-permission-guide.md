# 字段权限使用指南

字段权限用于控制业务字段是否展示、是否可编辑。它不能替代页面动作权限，也不能只靠浏览器隐藏数据；后端接口必须按相同的角色字段配置处理敏感响应和写入。

## 配置入口的页面排序

角色字段权限弹窗的“页面模块”按完整有效菜单树的顺序展示，复用页面权限的公共菜单排序实现 `sortModulesByMenu`，接口 `GET /permissions/module-mappings` 直接返回已排序模块。页面模块同时复用页面权限的母子归属：母模块与子模块在同一组中显示，选中子模块后只配置该子模块字段；母子分组只用于查找和展示，不合并字段配置，也不会让母模块权限自动授予子模块。按模块键关联、重复绑定取首个位置，不按当前用户或目标角色的菜单可见性裁剪；未绑定有效菜单的模块保留原顺序并放在末尾。具体规则见[页面权限的展示顺序](permission-capability-standards.md#页面权限的展示顺序)。

每次打开弹窗重新获取模块列表，禁用该请求缓存，菜单调序后再次打开即可更新。仅调整页面模块的展示顺序，不调整业务字段分组、字段顺序或已保存的字段权限。回归覆盖在 `backend/test/permission-module-mapping-controller.check.js` 和 `frontend/tests/permission-lists-loading.spec.ts`。

## 综合查询的手机与商品字段

配置入口为“权限管理 → 角色 → 字段权限 → 综合查询 → 手机模式 / 商品模式”。母模块名称、排序跟随菜单映射；选中模式后显示对应字段分组和字段开关。配件管理（菜单可改名为商品管理）仍只控制其自身页面；“已售商品”属于 H5 商城，不控制综合查询商品模式。

商品模式字段名称使用简短业务名称，如“销售员”“销售时间”“收款金额”；说明只保留简短用途或必要的联动范围，不在每个字段重复整段适用页面说明。

复用 `query_queryview` 已有字段配置，不增加页面权限模块或动作：手机字段仍在原 `hidden_fields/editable_fields`，商品字段保存于 `field_config.scopes.goods`。角色字段 GET/PUT 使用 `module_key=query_queryview`、`field_scope=goods`，保存时事务合并并保留另一模式和既有可编辑规则；读取失败不能按空配置保存。前端仍使用公共 `useFieldPermissions`，后端仍使用严格 `FieldAccessService`；商品读取键 `query_goods` 仅为用户字段接口合成的子范围，不是新模块或可授予的动作。

兼容按角色分别计算：尚未保存商品子范围的角色沿用自身原 `accessories_accessoriesview` 限制；首次保存后独立使用商品子范围，显式空隐藏列表表示该角色无商品隐藏字段。多角色继续合并最严格限制，另一角色的隐藏或只读不能被空配置解除。无需数据库结构迁移，不自动修改现有角色授权。

商品名称、单号、条码、用途、品牌型号、颜色、单位、SN、数量、成本、参考售价、成交单价、收款金额、利润、门店、客户、人员、时间和备注按现有字段ID控制；数量/金额同时约束派生积分、已退/未退及售后资金。范围覆盖商品列表和详情、销售候选与结算、原单与凭证、客户商品历史和关联商品售后。商品模式关键词检索仍匹配隐藏字段，用于定位记录；命中的字段继续由后端脱敏，不能通过列表、详情、整单、导出或选项接口回显隐藏内容。隐藏字段的结构化筛选和名称选项仍按字段权限拒绝或隐藏。配件采购、配件库存和贴膜继续使用原配件字段；手机字段独立保留。母子页面动作权限及管理权限不随字段开关改变。

商品销售结算是业务动作，不是表格编辑。综合查询商品模式的销售/赠送入口可以使用已选客户、销售门店、销售员和销售日期完成交易，即使商品历史表格隐藏客户姓名、手机号、门店、销售员或时间；这些交易元数据由服务端按请求和认证身份保存，不能因为列表脱敏而返回到列表或详情。商品名称、数量、成交单价、出库用途、SN、积分和结算金额仍按商品字段校验，隐藏这些交易明细时拒绝候选、试算或提交。商品收银窗口保留完成客户选择和门店选择所需的输入，不把表格隐藏规则当作动作权限。普通资料编辑、库存更正、退换货和其他写入接口继续同时校验隐藏、只读及显式可编辑范围。

## 全模块三态权限

角色字段权限弹窗中，所有已登记字段统一使用“隐藏 / 只读 / 编辑”状态控件，并保存到同一 `hidden_fields`、`readonly_fields`、`editable_fields` 配置。隐藏状态只维护隐藏列表，不改变该字段此前的只读/编辑状态；重新显示后恢复原状态。只读与编辑互斥，保存时只更新当前模块或商品子范围，不覆盖综合查询的另一模式。

“编辑”仅对字段登记中 `editable: true` 的字段开放。字段登记必须对应页面中真实存在的编辑控件和字段级权限判断；统计、ID、操作列、只读来源快照及派生值不得标成可编辑。页面写入必须同时满足页面动作权限与字段编辑权限，字段只读优先于新增、编辑、审批等动作；后端继续使用公共 `FieldAccessService` 拒绝只读/隐藏字段写入，前端控件禁用不能替代服务端检查。

全模块保存和读取统一严格校验三类字段列表。损坏或类型错误的配置不得按空权限回退；批量保存和旧入口不能清除已存在的只读、编辑范围或综合查询子范围。角色配置仍按“用户 → 角色 → 权限”合并，多角色中隐藏/只读限制优先。

此统一的是字段权限配置入口和状态语义。每个字段是否可编辑仍以字段登记、对应页面的编辑控件以及后端写入守卫三者均已接入为准；未完成其中任一项时，该字段的“编辑”选项必须禁用，不能据此推断该页面的所有表单都已接入。

## 库存管理三态标杆

入口为“权限管理 → 角色 → 字段权限 → 库存管理”。库存是字段权限的行为标杆，其他模块复用同一状态控件、严格保存和字段级编辑检查。库存三态卡片在窄屏和窄内容区均采用“字段名称与说明在上、权限控件整行在下”，三个状态等宽展示，避免字段名称逐字竖排。按钮式状态控件仅复用全局 `.tf-state-selector` 的 Tab 按钮视觉令牌，不显示外层背景，不改变单选语义；详见[Tab 与状态选择器规范](tab-standards.md#状态选择器的共享视觉)。

| 状态 | 库存中的行为 |
| --- | --- |
| 隐藏 | 列表、卡片、详情和编辑表单隐藏；后端脱敏，禁止改写 |
| 只读 | 可查看，编辑控件禁用；请求不携带该字段，后端拒绝改写 |
| 编辑 | 字段允许编辑，仍须具有库存编辑动作并满足原状态、原/目标门店范围 |

`moduleFields.js` 的库存字段定义通过 `editable: true` 标明现有编辑能力；统计、ID、采购单号、入库员及操作列没有通用编辑控件，不能通过字段配置创造编辑能力。操作列仍遵循公共动作列规则。品牌变化会重置型号，型号不可编辑时品牌一并禁编；型号编辑还要求品牌可见。IMEI只读时双击和触摸切换均不能改值。保留手机短字段两列、状态/价格同行及顶部序列号/价格同行。

复用 `inventory_inventoryview` 原JSON：`hidden_fields` 存隐藏，`readonly_fields` 存明确只读；兼容已存在的 `editable_fields` 白名单，没有显式白名单时保留原动作下默认编辑。三态编辑白名单时只调整所选字段，保留未知及历史字段；旧隐藏入口和批量入口保存不能清掉库存只读/编辑范围。多角色的隐藏和只读取并集，不能被另一角色的编辑授权解除。只读列表必须是非空白字符串数组，错误配置拒绝读取或保存，不按空配置放宽。无需结构迁移，不自动修改角色授权。

库存编辑复用 `/phones/:id`，请求查询参数固定 `field_module=inventory_inventoryview`，服务端仅使用库存来源鉴权，锁定后再核当前门店与字段；成功只返回ID回执。该参数不授予其他模块权限，未知值400；其他页面继续使用自身模块，字段权限不能替代母子页面动作。只读/隐藏字段和销售默认字段不进入库存载荷；规格仅解析本次允许编辑的字段，避免隐藏规格导致保存备注失败。权限、账户变化或关闭弹窗取消旧详情，清空编辑状态，迟到响应不能回填。

正式行为回归复用 `frontend/tests/inventory-shop-entry.spec.ts`、`frontend/tests/permission-lists-loading.spec.ts`、`backend/test/role-field-permissions-controller.check.js`、`backend/test/user-field-permissions-controller.check.js`、`backend/test/phone-update-controller.check.js`；手机/桌面明暗隔离浏览器入口为 `npm --prefix frontend run test:input-flows -- --inventory-edit`，覆盖三态配置显示及库存编辑布局，不写云端角色或业务数据。新增入库、销售及其他页面仍按各自原权限链处理，本次三态标杆不改动这些动作授权。

## 客户商品记录

客户详情商品购买/赠送记录使用 `GET /query/customers/:customerId/goods`，要求客户查看以及综合查询查看、商品查询权限；响应只含商品来源字段，不输出客户身份或采购成本；商品模块客户姓名/电话隐藏时，后端拒绝此定向筛选，前端清理记录及原单入口，避免通过客户ID反查隐藏关联。沿用综合查询商品子范围严格脱敏和原销售门店范围，隐藏数量/用途/金额时同步隐藏派生积分；配置读取失败时不能回退完整数据。原共同单入口继续按自身双模块权限、逐行字段及全部门店核验。原客户手机统计不混入此列表；契约见[客户商品历史](../backend/accessory-entry.md#客户商品购买及赠送历史)。

## 客户贴膜服务

贴膜上下文 `GET /query/customers/:customerId/film-services` 和共同结算的 `film_service` 扩展复用严格 `FieldAccessService`，模块为 `accessories_accessoriesview`。当前手机详情办理（请求携带真实 `phone_id`）须名称、类型、用途、门店、数量、单价、总价、客户姓名、时间和办理人可见；手机号可以按内部要求隐藏，服务端通过客户 ID 与手机 ID 完成关联，界面和响应不返回手机号。当前手机的定向上下文及提交还校验 `query_queryview` 的 `basic_info.model` 与客户姓名，提交SN仍校验原SN权限；字段或权限读取故障在写入前拒绝。无当前手机 ID 的客户历史仍要求客户手机号字段可见，避免借客户 ID 反查隐藏关联。

模板唯一开关 `free_film`（免费专用）复用配件 `basic_info.usage_type` 字段权限，类型页不再维护贴膜规则；入库入口拒绝改写。旧 `film_enabled` 已退役，前端不展示或提交，后端明确拒绝旧字段写入。免费候选只返回当前型号适配且开启 `free_film` 的膜类商品；收费及授权赠送只返回当前型号适配、膜类且未开启 `free_film` 的商品，收费候选使用 `film_model_id` 时须型号字段可见。

客户详情“贴膜记录”复用手机详情的同一贴膜弹窗，仅只读历史；办理须从具体手机详情携带真实设备，入口同时核验查询查看、配件查看和专用 `query:film`，客户姓名必须可见，手机号可隐藏。服务端在带 `phone_id` 的定向查询中通过客户 ID/手机 ID 核验关联，不返回手机号；无 `phone_id` 的客户历史仍在手机号隐藏时403 `FIELD_PERMISSION_DENIED`，不返回次数或资格。关闭父详情、切客及必要权限丢失卸载子窗；配件任一字段权限变化取消在途请求并清空旧历史，按最新权限重读，失败不保留旧次数/资格。

历史按原字段递归遮蔽名称、门店、办理人、时间、订单编号、用膜数量及费用。数量、用途、单价或总价任一隐藏时连同收费金额遮蔽；耗膜总量跟随数量，服务次数由专用 `query:film` 授权，独立于耗材数量。当前手机上下文仅返回phone/model ID及型号名，历史手机型号取原快照并随 `basic_info.model_name` 遮蔽；不公开原购买单/门店，内部快照、创建人、成本和资格来源不透传。专用动作跨店最小历史与实际服务店范围见[贴膜契约](../backend/accessory-entry.md#权限与最小历史)。

贴膜双口径统计沿用上述权限：`device_service_count` 与客户总次数由专用贴膜权限控制，`device_film_quantity` 与 `film_quantity` 一同跟随 `stock_info.total_quantity` 递归脱敏。数量隐藏时仅显示本机/客户的办理次数，不显示张数；纯客户历史本机汇总为NULL，不展示本机项。统计口径与接口字段见[权限与最小历史](../backend/accessory-entry.md#权限与最小历史)。

## 商品库存更正

商品库存盘点沿用 `accessories:edit`，前端公共指令与页面能力、服务端鉴权同时检查。名称、门店、数量、成本、采购批次、SN管理、用途、原因备注和操作字段必须可见；隐藏任一字段即拒绝提交，不从已下载资料绕过。撤销动作/字段或切换商品时卸载盘点子窗。请求只接受原批次行键、原结存、实物数量、原因及幂等键，操作者使用认证身份；详情见[商品库存盘点](../backend/accessory-entry.md#商品库存盘点)。

配件新商品入库是独立的 `accessories:stock-in` 业务动作。配件字段隐藏继续作用于列表、详情、查询候选和普通响应脱敏，但不隐藏入库表单的必要输入，也不因字段隐藏拒绝新入库载荷；入库专用选项和模板读取入口只要求入库动作权限，仍执行服务端引用、门店、数量、金额、SN及幂等校验。原入库更正、库存盘点和商品档案编辑继续按各自字段写入规则检查。

原入库批次列表/编辑读取要求 `accessories:view/edit`，更正提交要求edit及原字段拒写守卫。名称、供应商、门店、数量、成本、用途与SN管理任一隐藏即403；原SN批次或新SN载荷必须有SN权限，不能改成普通模式绕过。原批次内部采购ID仅供已获编辑权限的定向操作，不公开审计JSON或防重摘要；其余业务资料按 `accessories_accessoriesview` 递归脱敏，隐藏可选字段不随默认值提交，账号/动作/字段变化清理在途读取及已加载资料。复用严格公共字段读取和本次请求已核验配置，保存后不再重读权限误报失败。契约见[商品库存原入库更正](../backend/accessory-entry.md#商品库存原入库更正)。

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
- `isFieldEditable(moduleKey, fieldKey)` 只在字段可见、非明确只读且字段允许编辑时返回 `true`。`{ allowUnconfigured: true }` 仅保留旧角色未配置编辑白名单时的动作权限默认行为，仍受隐藏/只读限制；调用方仍须单独核验对应页面动作权限。
- 库存编辑及工资表单通过同一方法的 `{ allowUnconfigured: true }` 选项对齐后端默认行为：没有明确可编辑范围时允许原动作下的编辑，仍拒绝隐藏和只读字段。字段接口按需返回 `readonly_fields` 和 `has_editable_scope`，公共 Composable 保留并合并这两项；工资页不能用新增/编辑动作代替字段限制。涨薪规则整组保存，任一子字段受限时整组禁编并省略提交，避免以默认值覆盖只读内容。
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

用户字段权限接口与后端数据脱敏统一复用 `access-control.service.getActiveUserRoles`，仅让启用角色、启用且未过期的用户角色绑定参与字段合并；到期时间等于当前时间也视为过期。公共入口兼容缺少可选列的旧结构，结构及配置读取故障一律拒绝业务读取或写入，不另维护字段专用角色SQL。

公共 `FieldAccessService` 的写入判定同时检查隐藏、明确只读和聚合JSON显式 `editable_fields` 范围；隐藏与只读优先，多角色可编辑取并集但不能解除明确限制。显式空可编辑列表拒绝已映射字段，未配置可编辑范围或未配置字段规则时保留原动作授权下的默认行为。只读字段仍可查看；null清除、零值和关闭开关同样算写入。HTTP字段守卫及工资记录复用同一判定，不各自只检查隐藏字段；同一请求已核验的配置可直接传入，避免重复读取。

公共存储解析 `normalizeStoredFieldConfig` 支持聚合 `field_config` JSON 与现存单字段列两种记录。仓储按实际结构读取列，并查询 `field_config IS NULL`；只有确认是SQL NULL且 `field_key/can_view/can_edit/is_hidden/permission_level` 完整合法时，才解析单字段权限。JSON文本 `null`、损坏JSON、缺失列或非法标志不能以空权限放行，严格业务入口继续拒绝。隐藏由不可见、隐藏标志或HIDDEN级别决定；只读由不可编辑或READ_ONLY级别决定，多角色取限制并集，其他角色FULL不能解除已有隐藏或只读。用户字段读取接口共用该解析，返回可编辑列表时排除隐藏和明确只读字段。结构探测复用公共schema缓存，不自动迁移或修改权限数据。

所有业务查询、详情、统计、导出和写入使用失败关闭的字段读取。公共 `data-masking.service.js` 与 `FieldAccessService` 将角色或字段配置读取故障向调用方抛出；旧调用即使传入 `strict: false` 也不能将读取失败解释为没有字段限制。角色配置JSON损坏、非对象、隐藏/可编辑字段列表格式错误时同样拒绝，不能忽略出错角色并按完整权限继续。明确没有字段限制的有效配置或查询成功且没有配置，仍按原规则处理，动作权限另行核验。HTTP层返回统一故障响应，不返回原单数据，不在权限未核验时执行交易；合法隐藏字段仍为403，与读取故障区分。 综合查询列表、手机详情及导出共用脱敏服务；库存替代入口与旧手机查询也核验门店和响应字段，汇总成本随原成本字段一起隐藏。

配件路由字段守卫将已核验配置保存在本次请求的 `req.fieldPermissions`，供后续字段守卫和响应脱敏共用；不建立跨请求权限缓存，不在采购成功后因再次读取权限故障而误报失败。严格解析复用原归一化入口，日志不打印损坏配置正文。正式故障回归：`ENV_FILE=test/missing-unit-env RUN_DB_TESTS=false node --test backend/test/accessory-field-failure.check.js`，使用真实解析及数据库替身，不连接云端。

整单明细分别使用 `query_queryview` 手机字段和该模块 `goods` 子范围商品字段，不将两模块递归套在整张订单上。共享头取交集；隐藏任一必要售价/数量/用途时完整整单金额及积分合计为null，防相减推断。前端监听公共隐藏字段变化，清理旧请求和结果后重读；模块撤权清空。接口与正式回归见[整单明细](../business/sales-receipt-standard.md#整单明细)。

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

配件采购用途 `usage_type` 登记为 `basic_info.usage_type`，入库表单隐藏后不提交且禁止隐式默认入库，HTTP写入由原统一字段中间件拒绝。综合查询商品模式沿用该字段控制销售/赠送筛选和批次用途；`GET /query/goods` 及详情复用商品字段配置，原成本、客户、SN、门店与嵌套批次同样后端脱敏。商品模式关键词仍可匹配隐藏字段，但结构化筛选和名称选项继续按字段权限拒绝或隐藏；命中结果不能回显隐藏内容。累计积分随数量/单价/总额权限遮蔽，不能反推隐藏成交金额。手机随单凭证及整单明细的赠品未退约定 `gift_return_unit_price/gift_return_total/gift_agreement_state` 同时受用途、数量、单价、总额控制，隐藏任一时三个字段同步NULL；前端即时隐藏，打印和图片不补回原约定或“未记录”状态。完整映射及历史快照边界见[商品查询契约](../backend/accessory-entry.md#综合查询商品模式)。

配件详情当前批次库存 `GET /accessories/:id/batches` 使用同模块严格公共字段服务；门店或数量隐藏时拒绝读取，避免通过正余额行和分页反推。原成本、供应商、批次号、用途、SN管理、品牌型号、原入库时间和人员分别脱敏；来源核对标记仅表达流水完整性，原采购内部ID不公开。列表与手机双击详情沿用同一字段入口，撤权废弃旧数据。契约见[当前批次库存查询](../backend/accessory-entry.md#当前批次库存查询)。

配件类型统计的件数与零售参考价值不得反推隐藏库存或售价：隐藏当前库存/入库数量时件数及价值为NULL，隐藏零售价时价值为NULL，隐藏类型拒绝分组。库存预警需要预警值、数量和库存状态可见，隐藏任一即拒绝读取或低库存筛选。派生利润还依赖进价与零售价，派生剩余依赖当前库存，服务端递归遮蔽，前端公共配件字段入口同步控制列和详情；阈值或库存状态不可见时不显示对应低库存颜色。详细范围和专项回归见[库存读取、预警与类型统计](../backend/accessory-entry.md#库存读取预警与类型统计)。

商品采购“退供核对”额外同时要求 `supplier-payments:view/accessories:view`。原采购模块的数量、供应商、店铺、成本/总额、付款状态和库存模块的门店/数量均为必要字段，隐藏任一即拒读；其余原采购资料与库存成本/用途/SN管理分别按对应模块严格遮蔽。两个模块的权限读取故障均失败关闭，前端撤权清除内容及在途请求。此查看入口不授予退供/退款动作，契约见[原采购单退供核对](../backend/accessory-entry.md#原采购单退供核对)。

该核对响应内原采购在库 `serials` 由配件 `basic_info.serial_number` 控制；隐藏时不查询逐件数据，整个SN分页对象为NULL，传SN搜索或页码也会403。普通批次核对仍可使用，不能通过SN命中总数推断隐藏值。页面SN搜索、分页及手机详情共享该字段权限，撤权取消请求并清空旧内容。

退供试算 `POST /supplier-payments/accessory-purchases/:id/return/quote` 在核对必要字段之外，还要求库存成本、用途、SN管理可见；非空SN选择另要求SN可见，SN隐藏可只选普通数量。响应仅含已授权的原价格、数量、用途、门店、SN及付款状态，不含可隐藏的商品资料。撤权取消试算并清理选择，普通/SN原来源及当前库存仍由服务端只读重核；试算不授予退供、退款或应付冲减动作。

商品查询新增已退/未退数量，与原数量共同受 `stock_info.total_quantity` 控制，不能通过相减反推。商品退货三个接口复用 `SalesAftersaleController` 的公共字段服务，在任何试算写入或提交前要求名称、出库类型、门店、数量、单价、总额、业务时间和备注可见；原单上下文含SN，读取上下文或提交SN还须SN字段可见。缺必要字段返回403 `FIELD_PERMISSION_DENIED`，不允许先办理再脱敏。前端 `GoodsReturnDialog` 复用综合查询商品字段入口和原页面动作权限；返回不含采购成本或内部库存/积分原始快照。契约见[商品原单退货](../guides/sales-transfer-transaction-standards.md#商品原单退货)。

商品详情售后历史 `GET /query/goods/:id/aftersales` 复用上述查询映射。用途隐藏时同步遮蔽实物/扣款数量和完整资金组；数量/单价/总额任一隐藏时同时遮蔽全部退款、补款、同单抵扣调整（`settlement_offset_amount`）、优惠追回/补退、积分及支付方式/渠道；门店、办理人和ID、SN、业务/记录时间、原因备注各跟随原对应字段。前端历史列同步控制，NULL不显示为0，运行时拒绝半脱敏资金。查看只要求双模块view，原销售与办理门店范围在服务端核验，不能用前端隐藏替代；同笔其他明细仅服务端核验合计，不向客户端透传。契约见[商品售后历史查询](../guides/sales-transfer-transaction-standards.md#商品售后历史查询)。

商品换货的上下文/试算/提交复用同一字段服务，额外要求销售员字段可见；原件或新件SN输入均检查SN权限。操作独立要求 `query:exchange`，新件收费/赠送另校验原配件动作。历史 `replacement_amount/exchange_credit_amount` 并入完整资金组，嵌套换入商品的名称、单号、SN及原销售员分别跟随既有字段递归遮蔽；`operation_type` 仅表示退货/联合退货/换货，不公开内部关系或凭据。契约见[换货办理接口与页面](../guides/sales-transfer-transaction-standards.md#换货办理接口与页面)。

换货上下文的 `replacement_sale_type/gift_charge_settled` 来源于原单扣款核验，读取前仍完整校验用途、数量、金额及其他必要字段，不作为普通详情的脱敏例外。已扣款赠品换入新件按收费动作授权；前端读取后按该用途决定可办理状态，实际提交由后端重查，不能用原gift标记或客户端改售价绕过收费权限。

共同结算 `POST /sales/checkout` 复用 `FieldAccessService`，手机明细按 `sales_salesview`、商品明细按来源字段范围检查实际明细。手机嵌套售价、客户姓名/电话/Apple ID、门店/销售员/时间、备注、支付方式/渠道及交易号按 `sale.*` 拒写；商品数量/售价/SN/出库方式、客户及门店/备注/销售员/销售时间按配件既有字段拒写。`sale.customer_apple_id` 已补入销售字段登记，与现有销售表单映射一致。请求支持已有库存商品和手机ID；快速出库专用 `quick_phone` 接受采购新设备的成本和资料，各字段按 `sale.brand/model/color/memory/supplier_id/imei/serial_number/condition/purchase_cost/sale_price/inventory_time` 拒写，禁止同时携带已有库存手机。不接受内部快照；响应不含客户资料、采购成本/利润及SN快照，不能靠修改请求取得这些数据。共同结算组件按来源复用 `canViewAccessoryField` 或 `canViewQueryGoodsField`，手机合单同时检查销售字段；必要字段隐藏时禁止结算，隐藏备注及交易号不随默认值提交。综合查询商品候选、会员摘要、试算和提交使用 `/query/goods/sale-options` 及 `/query/goods/checkout` 系列接口，明确使用商品子范围；商品管理保留配件来源，手机搭售按公共能力来源选择字段范围，旧结算入口在没有商品管理查看权限时也使用商品子范围，不能切旧URL绕过限制。商品候选接口的搜索列及响应同步按所选来源字段配置过滤，详见T22验证边界。

手机退货原单核对同时复用手机与商品字段服务：商品原数量、已退/剩余及剩余赠品约定额随数量权限遮蔽；原SN和未退SN随SN权限遮蔽；剩余约定额还受单价和总额控制；出库类型隐藏时同步遮蔽赠品约定及状态。核对不返回完整历史凭据，数量汇总包含原商品的全部已退事实，历史详情仍独立执行双门店范围。接口及弹窗边界见[手机退货原单核对](../guides/sales-transfer-transaction-standards.md#手机退货原单核对)。

核对中的原销售快照单位 `unit` 随 `basic_info.unit` 脱敏；单位隐藏不阻断办理，标题退回数量使用通用“件”，不读取当前商品资料补齐。SN列区分原串码、明确空数组“无SN”和脱敏未知“-”，字段隐藏时整列不显示。

核对表“商品价格”仅展示原单单价：收费原 `unit_price` 或赠品原 `gift_return_unit_price`，沿用用途和单价可见权限，不把剩余赠品总额当单价，不要求数量可见。用途隐藏时类型标题回退“关联商品”，不能通过“存在收费订单/存在赠送订单”反推隐藏用途。

手机与关联商品的报价/提交在写入前复用手机和商品公共字段服务，要求各自必要字段可见；未退赠品扣款确认复用 `accessories:gift`，后端独立校验。商品售后历史新增扣款件数/金额，由用途、数量和资金字段共同约束，不能以0件返库误记实物退回。契约见[手机与关联商品退货](../guides/sales-transfer-transaction-standards.md#手机与关联商品退货)。

## 工资记录商品提成字段

工资记录控制器复用严格 `FieldAccessService`，团队用 `salary_salaryrecordsview`，本人用 `salary_mysalaryview`；本人仍只读自身已发工资。`salary.commission_amount` 同时遮蔽 `commission_amount`、手机 `commission_detail` 和只读 `goods_commission`，页面编辑、结算、详情及手机记录同步遵守。隐藏、只读或不在明确可编辑范围内的工资字段写入，以及权限读取失败，在事务写入前拒绝；内部快照、成本、规则、来源摘要及工资基数不进入公开响应。`calculation_version` 仅核对预览变化，不授予权限；自动保存持锁后区分 create/edit，手工表单不能直接paid。契约及回归见[正式工资金额、保存与页面](../business/salary-record-standard.md#正式工资金额保存与页面)。

## 工资模板商品提成字段

`salary_salarytemplatesview` 新增整组字段 `template.goods_commission_rule`，沿用原 view/create/edit 动作及“用户 → 角色 → 权限”。商品规则可见性和可编辑性独立核对：隐藏不回填、不提交，只读不提交；关闭与零费率不能被默认值覆盖。保存中所有相关控件禁用。

后端工资模板控制器复用 `FieldAccessService`：隐藏、只读或不在明确可编辑范围内的已映射字段写入（包括null清除、关闭规则）返回403，权限读取失败拒绝写入；底薪、商品规则、嵌套涨薪配置和设为默认动作均受对应字段约束。详情、列表及嵌套保存响应递归遮蔽。完整对象校验、缺省/null语义与受控迁移见[工资模板商品提成配置](../business/salary-record-standard.md#工资模板商品提成配置)。正式回归入口为 `frontend/tests/salary-template-goods.spec.ts` 和 `backend/test/salary-template-goods.check.js`。


系统退库列表合并联合手机售后时，`record.refund_amount` 同时控制 `refund_amount/collection_amount`，隐藏退款时不能通过整单补款反推资金；前端手机详情与桌面均遵守同一字段权限。`record_source/id` 仅用于区分旧日志和只读新凭据，不授予编辑删除能力。联合表单的退货类型/处理方式沿用原退库公共选项，作为处理意向保存；详情分别按 `record.return_type/record.handle_method` 脱敏。完整范围见[系统退库列表](../business/inventory/transaction-reversal.md#系统退库列表的联合售后记录)。
