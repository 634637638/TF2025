# 销售与调货事务标准

> 2026-11-14结构状态更新：用户确认可恢复备份、停写并授权后，T22本批9项迁移已在当前配置云库执行并逐项核验；发布结构检查10项均ready。未回填历史积分/采购/工资，未创建真实交易；配置启用及真实业务验收仍未完成。执行证据与剩余事项见[T22](../development/TECHNICAL_DEBT_PROGRESS.md#t22-配件商品业务闭环2026-11-12)。

本文说明销售、批发、划拨等出库流程中发票序号初始化和数据库事务的约束，避免序列表建表语句破坏业务事务。

## 销售门店范围

普通、批量销售均由公共 `SalesPhoneService` 在事务内核验表单销售店及锁定后的每台手机来源店。来源店和销售店可不同，两者必须属于当前授权范围；附加商品候选和扣库沿用所选销售店。任一设备越界时整单回滚手机、收款、客户写入和积分，不允许仅完成合法子集。无门店绑定拒绝销售；完整权限管理员保留全店例外。可售候选、库存统计和导出按来源店；月销售统计按当前有效销售店，避免将来源店当销售归属。

## 业务客户档案授权

销售和批量销售、快速出库、共同结算、调货/代划拨及设备编辑仅关联已有客户时不要求客户新增或编辑。创建新档案须 `customers:create`，修改已有姓名或 Apple ID 须 `customers:edit`；同值不执行资料更新。调用方传入真实认证用户，权限主体不能使用表单销售员ID。授权失败返回403并回滚所在交易，不保留手机、收款、积分或客户的部分写入。直接调用客户 API 与交易内自动创建/更新遵守同一边界，服务端复用 `CustomerMutationAccessService`。

业务候选检索不开放客户管理列表；各业务入口和公共客户控件约定见[客户操作权限](../frontend/customer-search-standard.md#客户操作权限)。正式隔离回归包括 `backend/test/permission-boundaries.check.js`、`sales-phone-service.check.js`、`inventory-controller.check.js` 和前端 `customer-name-lock.spec.ts`、`sales-customer-name.spec.ts`，不代表真实员工、云端数据库或手机实机验收。

## 批量销售表单

`/sales` 的批量销售复用 `MobileDialog`、公共 `useMobile`、客户姓名保护/检索及支付组件，弹窗显式声明期望宽度 `800px`，实际宽度继续受公共视口边界约束。客户电话在姓名前；手机端电话与姓名并排、Apple ID 独占下一行，销售信息与支付信息均每行两个字段。统一售价与“应用”同行，按钮使用公共 `.tf-dialog-toolbar`，不维护私有尺寸或颜色。

设备价格明细在手机端使用逐台卡片，完整显示品牌型号、颜色、容量和 IMEI，入库价格与销售价格并排，单台利润另行显示；销售出库设备信息面板不展示设备图片，PC、平板和手机均由设备详情占满可用宽度，避免图片挤压型号、序列号和价格等字段；PC/平板保留表格，两个价格列各 `120px`、利润列 `110px`，剩余宽度分配给设备信息，型号与 IMEI 优先同行、留有间距。超长型号或窄表格可自然换行，成本、售价与利润继续遵守原字段权限，负利润使用危险色。所有价格数字输入复用公共 `AmountInput`，整数不补零、真实小数不取整。所有明细随公共弹窗正文滚动，底部操作沿用公共 footer。

两种布局共用同一组逐台价格和更新事件，切换屏幕不清空草稿；统一售价仅在点击“应用”时批量设置。最底部使用公共 `tf-textarea`、固定两行展示备注信息，绑定现有 `batchSaleForm.remarks` 并随既有销售请求提交。提交等待期间禁用清空、统一应用、逐台价格及备注，避免变更正在提交的数据。正式组件回归入口：`npm --prefix frontend run test:unit -- tests/sales-batch-form.spec.ts tests/sales-customer-name.spec.ts`。

设备标识沿用已选设备构建明细时的统一规则：优先非空 IMEI，没有 IMEI 时显示 SN（`serial_number`），取值前去除首尾空格；两端展示标签始终为“IMEI”，不新增重复的 SN 展示字段。两者均为空时回退设备 ID。两端仅“IMEI：”标签使用公共危险色，号码保留原颜色；PC 表格的号码使用公共成功色与正文字号，优先与设备名称同行。

### 批量销售落账与收款

`POST /sales/phone` 仅处理零售，兼容页面的 `sale_type: batch` 及旧 `batch_item` 请求，但每台实际写入 `sales.sale_type = retail`。批发及供应商划拨必须走原专项权限入口，不能通过零售权限切换交易类型。每台手机独立创建销售记录、`XS`单号及积分凭据，整批使用同一连接事务；任一收款、设备状态更新或积分处理失败，整批回滚。

批量使用一个公共备注。请求含 `remarks` 时（包括空字符串）统一写入每台手机和对应销售记录；未提交字段的调用保留各台原备注。销售备注分别持久保存，不能理解为逐台可编辑备注。

原手机销售入口 `payment_records.order_id` 的契约是 `sales.id`，不是 `phones.id`，共同订单关联使用下文独立的 `sales_order_id`。批量逐条创建对应销售价的收款记录，合计使用分计算，不能把整批金额挂到首台手机。成功响应保留 `payment_id`（第一条）并增加 `payment_ids`（全部）；单台同样返回单元素数组。传入收款金额时须等于明细合计，省略时使用明细合计；状态只允许成功。该接口尚不支持任意部分收款。预定交付仍沿用原定金/尾款流程，不能据此认定共同结算的定金冲抵已完成。

独立 `POST /sales/phone` 成交后，会在同一事务内创建已完成的共同订单及逐台手机明细，并将原收款记录补关联到 `sales_orders`，原 `payment_records.order_id = sales.id` 保持不变。自动赠送贴膜按实际出库结果追加零价商品明细，并在 `customer_film_services` 追加一条与对应手机销售ID关联的免费贴膜记录；使用对应手机销售ID作为 `linked_phone_sale_id`，综合查询贴膜历史按该关系只展示本机消耗的膜。缺少免费专用模板、门店普通库存不足、结构未迁移或商品无法唯一确定时整笔销售拒绝，不能只完成手机销售。销售出库弹窗中添加的付费配件、赠送商品和付费贴膜由 `POST /api/sales/checkout` 一次结算，均写在同一共同订单并关联所选手机；手机销售服务在复用外层连接时不再创建第二张订单。订单快照、收款、手机积分、配件库存/SN、自动赠品成本及贴膜历史处于同一事务，任一步失败整体回滚。

销售、快速出库及手机编辑复用 `backend/src/utils/sale-payment.js`，按 `payment-methods.json` 校验方式和渠道。渠道缺失或错配拒绝保存，现金渠道为空。综合查询回读渠道只精确匹配销售ID及该销售客户，不再使用手机ID兜底；历史关联不明时不猜测渠道。应用业务请求禁止关闭外键检查。

共同订单头、手机搭售/商品单卖、积分抵扣与商品退货的当前契约见下文；各阶段实施及云端状态统一登记[T22](../development/TECHNICAL_DEBT_PROGRESS.md#t22-配件商品业务闭环2026-11-12)。用户已确认每条搭售/赠送商品选择关联哪台手机，须保存真实ID关系。综合查询贴膜购买或赠送的商品销售时间、贴膜服务业务时间及收款时间均由后端在提交时生成同一秒级北京时间，忽略客户端所带销售日期；重试请求的幂等身份不包含该服务端生成时间，确保重放返回原结算凭据。普通独立商品销售仍使用用户选择的销售日期。

### 收款方式字段迁移

`payment_records.payment_method` 由旧 `ENUM('cash','card','mobile','transfer','mixed')` 改为 `VARCHAR(20) NOT NULL`，容纳公共配置的 `bank_card`、`subsidy_card`，旧值原样保留。`sales.payment_method` 本来就是 `VARCHAR(20)`；本迁移不新建订单表、不修改 `sales_orders`、不猜测或重写历史 `order_id`，应用请求不执行DDL。

```bash
npm --prefix backend run migrate:sale-payment-methods
npm --prefix backend run migrate:sale-payment-methods -- --apply --backup-file=backups/.migrations/sale-payment-methods/before.json
```

预览零写入，执行必须具备目标与备份授权并提供未占用的备份路径。脚本先保存结构、行数、内容摘要（不输出客户/交易行），目录0700、文件0600，再改列并核对原记录摘要；字段结构不符合预期时拒绝覆盖。备份文件记录结构及摘要，原业务数据的可恢复备份仍需按项目备份规范保留。相同结构重复执行返回 `already_ready`。

回退先加 `-- --rollback` 预览，确认后带 `--apply --backup-file=...`。已有银行卡、国补或其他旧枚举无法容纳的值时禁止回退，不通过删记录、转换为空值或关闭严格模式恢复旧枚举。迁移后仍需发布应用代码；不能把结构迁移当成销售页面验收。

正式行为及迁移回归：`node --test backend/test/sales-phone-service.check.js backend/test/sale-payment-migration.check.js backend/test/query-payment-channel.check.js backend/test/phone-update-payment.check.js backend/test/inventory-controller.check.js backend/test/sales-remarks-sync-contract.check.js`。真实SQL与并发、浏览器、真机分别验收，mock回滚不代表云端并发验证。

## 销售管理调货与划拨表单

`/sales` 的调货、划拨共用 `WholesaleModal` 和 `MobileDialog`，PC 与手机均只保留一个“客户信息”区。调货顶部只读显示已选设备列表第一台的来源供应商，单台取该台，多台不强制同供应商；底部每条明细显示各自供应商。供应商字段沿用 `sale.supplier_id` 的查看权限，顶部和明细同步隐藏。顶部展示不写入调货请求，也不修改设备来源供应商；划拨仍要求同一供应商并沿用现有提交规则。

设备明细保持简洁的两行信息：桌面首行是序号、完整品牌型号/颜色/容量和金额，次行保留带字段名的供应商、门店、入库时间。长文本自然换行；手机端金额输入分为两列，调货利润另占一行，来源信息按宽度换行，不截断数据。单台和多台共用同一布局，列表不再限制为独立的固定高度滚动区，长内容随弹窗正文滚动；划拨金额仍只读，调货编辑金额后逐台利润和汇总自动联动。

备注区只保留“备注信息”标题，文本域取消左侧标签占位、与设备卡片左右对齐，上方区块间距使用 `--tf-space-6`。设备列表与金额汇总复用公共主题色设置外边框和背景；预估利润不添加独立虚线及顶部留白。

调货自动价格与批发报价页 `/price-query` 一致：复用 `api/price-list.ts` 的 `getAllPrices` 实时请求，按品牌、型号、颜色、内存完整匹配，优先读取后端计算的 `display_wholesale_price`，缺省时使用 `wholesale_price`，与报价页同样保留真实小数，展示复用全局金额格式。前端不重复计算加减价规则，不跨规格借价，也不将零售价或入库成本充作报价。没有有效报价时保留设备已有有效批发价，否则留空供手动填写；请求失败保留设备明细并提示手动填写。

等待报价使用公共 `LoadingOverlay`，文案为“正在获取批发报价…”，等待期间禁止确认。更换选择、切换模式、关闭及卸载取消过期请求，旧报价不得覆盖当前设备。划拨继续零成本、零划拨价，不读取调货报价。定向行为回归入口：`npm --prefix frontend run test:unit -- tests/wholesale-supplier-price.spec.ts`。

### 批发与划拨输入预检

`utils/transfer-input.js` 复用公共校验解析手机ID、客户姓名/手机号、销售员、门店和备注。手机ID必须完整正整数且不重复；批发价为0.01至99999999.99的两位金额，显式成本允许0，未提交或空成本仍读取原设备成本。非法字符串不得经 `Number` 部分或隐式转换后保存。

逐台价格在租借连接、序列结构检查和客户创建前预检。全部无效返回原逐台失败结果，不创建客户；有效与无效混合仍保留逐台成功/失败语义，有效明细继续原保存点机制，后段积分或销售写入失败只回滚该台。代划拨不读取批发价，仍使用既定零成本、零价格。受控输入错误返回400，不改变路由权限、门店范围或支付契约。正式回归：`backend/test/transfer-input.check.js`。

## 手机与商品共同结算

销售出库的利润明细统一展示手机和附加商品，字段为项目、数量、进价、销售价和利润；赠送商品销售价按0计入。商品进价仅在 `price_info.purchase_cost` 字段可见时由销售候选接口返回，未授权或未读取时显示待核对，结算时以实际出库批次成本为准。

附加商品的一键积分抵扣区分账户总余额与服务端可用来源积分；零抵扣明确说明未启用、历史来源待核对、余额不足或商品范围/金额限制，不能把“有积分”误解释为均可消费。提示与验收入口见[销售页有余额但不能抵扣的提示](customer-points-standard.md#销售页有余额但不能抵扣的提示)。


`POST /api/sales/checkout` 由 `SalesCheckoutController → SalesCheckoutService → SalesCheckoutRepository` 编排，复用手机销售的外层事务入口和配件 `issueSale`。支持手机单、商品单卖，以及手机购买/赠送配件；综合查询商品模式顶部“商品销售”、销售管理单台/批量手机弹窗及综合查询快速出库的“配件”共用 `SalesGoodsCheckoutDialog`；混合单沿用已填的手机售价、逐台入库成本和客户/支付草稿，逐条选择关联手机。出库时可调整手机入库成本，按 `sale.purchase_cost` 字段权限提交；后端沿用手机销售的金额校验，并在同一事务内保存销售成本及手机当前成本，不要求恢复原入库价格。积分抵扣试算按手机销售价和商品明细，不因成本调整失效。手机搭售窗口标题为“附加商品”，沿用 `MobileDialog` 公共默认宽度，不单独指定960px；直接继承原手机销售表单的客户姓名、手机号、销售门店、销售员、销售日期、支付方式、支付渠道和交易流水号，不重复展示这些字段。顶部用公共语义标签区分会员号、姓名、积分，不展示手机号；手机搭售复用 `SalesAdditionalGoods`，一个“附加商品”入口同时检索名称、型号、条码和SN，选择出库方式及关联手机后确认加入表格。表格显示商品、购买/赠送、数量、价格，SN完整显示且每件数量固定1；普通数量及价格分别使用全局 `el-input-number` / `AmountInput`。价格右侧用公共危险色减号按钮移除草稿，数量与价格控件读取公共宽度、尺寸和禁用样式，不增加私有覆盖。来源资料缺失或方式/渠道无效时，提示关闭窗口返回原手机销售表单完善，不默认替换为当前人员、当天或其他门店。独立商品销售及贴膜办理仍展示完整销售表单；仅赠送订单的支付方式固定为现金并禁用选择，不展示支付渠道或现金收取输入。独立商品销售日期默认使用北京时间当天，允许改选历史日期；提交时服务端保留所选日期并使用当前北京时间时分秒，购买、赠送及收款时间一致。贴膜时间始终由服务端生成提交时的当前完整北京时间，弹窗不提供时间选择。预定交付继续原流程，本入口不接预定定金。实施及验证边界见 T22。共同结算接受积分抵扣后的完整收款，商品明细支持积分抵扣；不接预定定金、部分收款或手机/整单积分抵扣；商品、手机关联商品退货及换货见下文，正式商品工资保存/发放已接入代码，云端迁移与真实验收仍见T22。

手机模式底部“确认添加”只向外层回传本地草稿，不调用结算接口、不写库存/积分/销售、不显示结算成功。单台、批量及快速出库统一使用 `useAdditionalGoodsCheckout`；重新打开恢复商品、数量、SN、关联手机和仍匹配的积分试算，取消编辑保留上次确认草稿，确认空清单清除附加商品。备注只在外层销售表单维护，附加商品弹窗不重复展示。最终点击“确认销售/确认出库”时，以最新外层资料一次提交共同结算，不能先提交手机旧接口或回落为只卖手机。积分依据绑定客户手机号、门店及实际手机/商品明细，不因字段排列或日期/备注/渠道改变失效；影响积分的内容变动须重新确认附加商品。结果未知时冻结外层及附加编辑，保留原请求键和载荷重试，成功后关闭原表单并无缓存刷新。独立商品销售及贴膜仍由各自窗口最终确认提交。

请求包含 `request_key`（32位十六进制或UUID）、`store_id`、`operator_id`、`customer_info: {name, phone, apple_id?}`、显式 `sale_time`、唯一公共 `remarks`、`phones: [{phone_id, sale_price}]`、`accessories: [{key, accessory_id, quantity, unit_price, sale_type, linked_phone_id?, serial_numbers?, redeem_points?, gift_return_unit_price?}]` 和 `payment_info`。商品须选实际库存ID，`sale_type` 为 `sale/gift`；混合单每条商品必须关联本单的一台手机，单卖商品不关联手机。所有明细共用客户、销售门店和备注。手机按表单所选销售门店正常出库，不把原入库门店作为同店销售限制；原库存门店与所选销售门店均须通过后端统一门店范围校验，积分试算和最终提交执行相同检查，不要求两店相同。附加商品的名称、条码及SN候选检索和实际扣库均使用所选销售门店；该店商品不足或SN属于其他门店时整单拒绝，不能借用手机来源店库存。手机销售和共同订单记录实际销售门店，手机原入库门店及原成本快照保留，不隐式划拨。SN数量须等于本行数量，普通数量不能占用SN库存。API保留赠品原单扣款单价 `gift_return_unit_price`，只允许赠品携带；新建独立商品销售及手机附加赠品不再填写该字段，由界面保存本次候选零售价作为原单快照，缺少可核验零售价时拒绝加入。后续商品改价不追改原单；历史及兼容调用省略/NULL仍表示未约定，明确0表示约定0元，不按当前价或成本补算。该值受配件售价字段写权限约束。商品行 `redeem_points` 为整行使用积分，赠品必须0；手机行和整单非零抵扣返回 `POINTS_REDEMPTION_NOT_READY`，不静默忽略。

结算组件的隔离浏览器入口为 `node frontend/scripts/test-checkout-order.mjs --sales-only`。复用正式 `SalesGoodsCheckoutDialog`、商品行、金额/支付控件、公共弹窗和样式，执行实际键鼠检索、选择及填写；服务边界使用内存响应并阻断业务网络。覆盖单台、批量与商品单卖在360/390/430/768/1440px明暗主题下的条码检索、普通数量、SN自动计数及重复拒绝、赠品0元与原约定、逐台关联、整批备注、附加确认零提交及恢复草稿、外层最终日期、积分试算失效、提交期间禁用、结果未知原载荷/原幂等键重试、商品单卖切店清空及撤权。该入口验收结算组件，不代表销售整页入口、真实库存/积分事务、物理扫码枪、真机或真实订单已通过；本批迁移和实际验收仍以T22为准。普通手机凭证的配件购买/赠送、打印及图片内容见[销售凭证约定](../business/sales-receipt-standard.md#手机随单配件)。

销售整页的隔离浏览器入口为 `node frontend/scripts/test-checkout-order.mjs --sales-page-only`，复用上述宿主和服务替身，挂载真实 `SalesView`、内存路由和公共组件。通过页面按钮及手机记录双击详情进入单台出库，切换表格勾选设备进入批量销售，同时核验销售管理顶部不提供独立“销售商品”；以一店库存手机由二店销售为单台/批量场景，核对名称及SN候选均检索二店、最终共同结算沿用二店；核对原客户资料、销售/支付信息、逐台售价与整批备注传入“附加商品”，客户及重复销售/支付控件不展示，取消后保留手机草稿、逐条购买/赠送关联手机，附加确认后原手机仍在库且外层继续显示、重开取消保留商品草稿、外层最新备注最终确认，以及成功关闭原表单并绕过缓存刷新设备列表。覆盖同样五个视口和明暗主题。权限来源、服务及数据均为内存替身，撤权用例只验收页面反应，不能替代真实登录、后端鉴权、云端事务、真机或整页全部状态的视觉验收。

快速出库窗口联动的隔离浏览器入口为 `node frontend/scripts/test-checkout-order.mjs --quick-sale-only`。复用真实 `QuickSaleModal` 与共同结算组件，通过原表单选择手机品牌/型号/颜色/内存、供应商、门店，填写SN/IMEI、成本、售价、客户及备注；核对客户资料继承且不重复录入、取消保留草稿、重新打开带入最新售价、购买及赠品关联临时手机，附加确认零提交且原出库窗口继续显示、最终修改售价/备注后才提交一次共同结算、原快速出库窗口关闭。最终载荷包含`quick_phone`、空`phones`及逐条`linked_phone_id=1`，由后端解析成真实手机及销售关系；不能将临时ID写成真实库存ID。该入口覆盖同样五个视口及明暗主题，仅挂载快速出库窗口，不代表综合查询整页入口、父页面刷新、云端创建设备、真实客户或后端事务验收。

动作权限分别沿用 `sales:sell/inventory:sell`、收费商品 `accessories:sell` 或综合查询 `view/goods-view/goods-sell`、赠品 `accessories:gift` 或综合查询 `view/goods-view/goods-gift`；服务逐域重新校验，入口任一获权不能代替其他明细的权限。字段写入由公共 `FieldAccessService` 检查嵌套客户、价格、门店、时间、备注、SN及支付字段。响应仅含订单号、明细/销售关联、总额及积分，不返回内部采购成本或主档快照。

共同结算的手机/商品字段读取，以及商品退换货和手机联合售后的字段读取均显式使用严格模式。综合查询商品模式独立开单的会员摘要、试算和提交使用 `/query/goods/checkout` 系列接口，沿用同一结算服务与事务，但商品字段明确读取综合查询 `goods` 子范围；商品管理保留原配件字段来源，手机搭售按公共能力来源选择字段范围。原 `/sales/checkout` 入口对没有商品管理查看权限的用户同样采用商品子范围，不能借旧入口绕过限制。商品原单、凭证、退换货与关联商品核对使用商品子范围，手机字段不变；旧角色回退规则见[字段权限指南](../frontend/field-permission-guide.md#综合查询的手机与商品字段)。角色/字段查询失败或存储配置损坏时，在试算/交易执行前返回统一故障，不按没有隐藏字段继续；退货核对若在读取原单后无法核验商品字段，也不返回部分原单。完整失败边界及正式回归见[字段权限指南](../frontend/field-permission-guide.md#后端边界)。

复用 `sales_orders` 作为共同头，新增 `sales_order_items` 保存逐台手机/商品销售ID、搭售对应的真实手机销售ID、数量/金额/成本、积分及主档快照。未知历史成本保持NULL。手机继续逐台创建 `sales` 和收款（`payment_records.order_id = sales.id`）；每笔收款同时关联 `sales_order_id`。商品收款 `order_id=NULL`、只关联 `sales_order_id`，避免与旧手机销售ID撞号。纯赠品不伪造0元收款。客户资料、手机/商品出库、SN、批次流水、明细、收款和积分在同一连接事务中完成；任一失败全部回滚。

商品数量积分经 `quoteCheckoutPoints` 复用单件规则，逐件取整后汇总；新商品 `snapshot.points_units` 保存数量、单件使用/累计积分、抵扣分值和实付分组，最多两组，不按几十万件展开。商品抵扣明细同事务保存实际分摊及来源消费，规则与测试见[数量试算规范](customer-points-standard.md#商品积分配置与明细计算基础)。

`request_key` 唯一，规范化载荷摘要绑定操作者及内容；完全相同请求返回原保存结果，不重复扣库存/积分。同键改内容或换人返回409；受控死锁、重复键和锁等待最多重试三次，每次在开始新事务前清空单号预留，其他错误不自动重放。共同结算的正式提交和积分试算在事务启动失败时销毁连接；业务或提交失败先回滚，回滚失败只尝试一次、销毁连接并返回失败，不在该连接上自动重试。只有正常回滚后才允许整体重试，正常提交或回滚仍复用连接；所有退出路径由共享连接helper释放。该边界也适用于复用共同结算的贴膜办理。当前并发及连接故障替身用例不替代独立库多连接或真实MySQL故障验收。

内部商品事务步骤统一复用：`checkout-goods-input.normalizeCheckoutGoods` 规范化商品行，保持旧字段顺序、稳定排序、未约定赠品金额及零抵扣字段的省略语义，避免重构改变已保存请求摘要；`SalesCheckoutService.issueGoods` 在外层已授权、锁定客户并取得结算前积分来源快照的同一连接内建立出库、明细和积分消费，不创建订单头、收款、不发放奖励或提交事务。销售编排继续负责先消费后发奖、一次收款及完成订单，未知成本沿用NULL。原单返库及积分处理统一复用 `SalesGoodsReturnService.returnGoods`，由商品退货、手机关联商品退货及换货共同调用；步骤返回原应退、追回/补退、账户变化和原批次/SN事件，资金确认与售后单仍由外层统一保存。未退赠品的0件扣款不触发实物返库。这些内部步骤不自行暴露HTTP入口；完整换货编排、替换链、净差价凭据及办理入口见下文，不能直接拼接两个独立事务。

积分来源账结构就绪后，手机正差额复用公共积分入口保存来源，商品入账附带已保存的真实订单明细ID及各自积分；来源、余额和原销售凭据同事务提交。来源表未安装时暂兼容原累计，两表只安装一张时拒绝；商品明细非零抵扣必须来源账就绪；发分前留存来源截止点，先扣后发，不用本单新积分或未知历史余额。历史余额和迁移要求见[积分来源与消费分配账](customer-points-standard.md#积分来源与消费分配账)。

订单头原价 `total_amount` 与净额 `final_amount/paid_amount` 分开，商品销售的单价保留抵扣前值、总额/毛利按净额，数量分币不平均改单价。商品快照保存 `points_used/deduction_cents/gross_cents/points_per_yuan` 及原分摊；API结果返回 `paid_amount/deduction_amount`（老幂等结果可能缺失）。零现金收费商品不造收款，未知成本保持NULL。综合查询读取原抵扣事实，价格和数量字段权限同时遮蔽衍生值；当前只读核对不办理退款。具体规则见[积分规范](customer-points-standard.md)。

商品成交另在原明细 `snapshot.commission` 冻结实际销售员、规则及真实净额/采购成本形成的提成事实；三条售后入口在原实物分摊区间下追加 `fact_snapshot.commission_return`，与客户资金和积分凭据分开。部分/SN退回累计冲回守恒，读取时核对原事实，旧无凭据单不补造。这些字段仅供服务端内部核对，不透传查询、凭证或售后回执；工资模板商品配置已接入原接口和字段权限，受控字段已于2026-11-14授权迁移并回读；汇总、正式保存/发放及当月净结/跨月原工资扣回已接入代码，云端迁移已于2026-11-14执行并核验，真实工资验收尚未执行；配置和迁移见[工资模板商品提成配置](../business/salary-record-standard.md#工资模板商品提成配置)，完整凭据规则和状态边界见[商品提成内部原始凭据](../business/salary-record-standard.md#商品提成内部原始凭据)。

### 商品销售页面与候选检索

附加商品选择器对同一实际商品、同一关联手机及同一出库方式的普通库存行合并数量，不重复创建草稿行；同商品购买与赠送保留独立行，SN商品按实际串码逐件保留，避免收费与赠送混计。

独立商品“商品销售”入口仅放在综合查询商品模式的公共页头，手机模式不展示，销售管理页头不再提供；原手机销售底部“配件”保持。开单同时要求 `query:view`、`query:goods-view` 和商品销售/赠送任一动作，弹窗逐明细及后端继续核验真实动作，不新增权限模块。入口点击重新核验，关闭或撤销任一必要查看权限/全部商品动作后卸载弹窗。成功回商品模式第一页，禁缓存重读成交列表；取消不刷新或改变当前分页。复用原 `SalesGoodsCheckoutDialog`，不增加第二套商品销售接口。隔离浏览器命令 `node frontend/scripts/test-checkout-order.mjs --goods-page-only` 查询场景覆盖实际商品面板，销售场景挂载真实 `QueryView` 核对手机/商品模式切换、页头“销售”与弹窗交接、普通销售、仅赠送权限、取消/成功刷新和撤权；服务使用内存替身，不代表真实登录或数据库交易验收。

`SalesGoodsCheckoutDialog` 复用公共客户检索与姓名保护、门店/操作员选项、支付方式及渠道、金额输入、北京时间、Loading 和 MobileDialog。附加商品只使用原手机表单的客户快照，不允许在子窗口修改客户；原表单姓名编辑须先保存。独立商品销售继续使用公共姓名锁，姓名更新只提交姓名并重新锁定。贴膜沿用 `SalesGoodsLine`，独立商品单和手机搭售复用 `SalesAdditionalGoods`（独立收银用卡片清单，手机附加商品用表格），共享结算类型、API及提交校验；同模板的不同实际品牌使用各自库存 ID。SN模式按录入SN计数，支持扫码枪、批量粘贴及公共摄像头扫码器；普通数量不占用SN库存。赠品售价为0，新建销售按候选零售价冻结未退扣款依据，移除手动约定价输入；贴膜和换货沿用原售后契约，不补改历史。原商品名称、条码和成本不由销售表单覆盖。

普通商品数量编辑允许暂时清空，空白时草稿不能通过原有正整数校验，不会自动当作1件结算；重新输入按实际数量计价。SN数量仍由实际录入SN确定，换货数量仍受原售后数量控制。

独立商品销售分选购、结算、收款成功三步，复用同一草稿及结算接口。先选择门店，顶部商品检索输入支持商品名称、类型、品牌、型号、条形码和SN，扫码作为独立入口；桌面左侧多列商品卡片直接加入，点击名称在右侧展开规格资料，右侧当前订单标题右侧展示价格，卡片下方的数量、销售价、小计同一行展示，支持删除及清空。选购阶段不提供积分输入。手机/平板采用上下布局。确认结算后才展示销售员、客户、日期、支付及积分核对；输入有效客户手机号或选择已有客户后自动读取会员号、账户积分、可用积分和余额，点击“积分抵扣”才按后端规则分配已有积分；进入此步不写库存，返回选购保留清单并重新读取本店候选。现金可填写本次收取金额并展示找零，不足应收不能提交；找零不作为额外销售收入，后端仍只接收积分抵扣后的应收净额，未填写现金收取时按应收处理，此辅助金额不作为持久化付款字段。

收款成功保留服务端单号、实际收款、消耗及获得积分，发出一次成功事件刷新商品列表；点击完成关闭，不重新提交。按返回的真实 `accessory_sale_id` 打开已有 `CheckoutOrderDialog` 的销售凭证模式，复用原单只读 API 和字段权限；没有原销售ID不伪造凭证，旧幂等结果缺少净额及抵扣金额时提示查看原单核对。凭证及打印见[销售凭证约定](../business/sales-receipt-standard.md)。手机附加商品仍只确认草稿，由外层手机销售成交；贴膜免费在手机详情内直接确认，后台按当前型号和服务门店匹配；收费保留专用选品结算，完整契约见[模板贴膜匹配](../backend/accessory-entry.md#贴膜服务后端与模板匹配)。

手机相机扫码复用 `OptimizedScanner` 的商品编码配置（`serialProfile=product`，保留条码大小写、符号和前导零；SN检索独立按既有规则归一化）。普通商品连续扫码累加数量，SN逐件追踪且拒绝重复，购买与赠送分行；清单小计为抵扣前金额，积分试算后的本单实收独立显示；相同条码对应多个实际品牌或同时命中条码/SN时必须人工选择，不默认取第一项。扫码按输入顺序串行处理，保留出库方式和关联手机；识别中禁用试算与提交，换店、关闭、撤权及卸载取消在途请求和队列，迟到响应不得加入新草稿。名称等模糊检索保留合法中文；编码输入沿用公共指令，中文输入法确认不触发扫码。物理扫码枪及手机相机实扫须另行验收。

`GET /api/accessories/sale-options` 沿用 `accessories:view`，必填当前授权 `store_id`，可选 `search/page/page_size`（默认1/20，最多100）、`search_mode=regular/serial` 和 `match_mode=exact`。精确模式要求非空 `search` 及明确模式，regular只按完整可见条码等值查询，serial只按完整可见在库SN等值查询；不使用名称/型号模糊兜底，隐藏条码不能通过命中数量反推。重复条码返回准确总数与可分页候选，前端仅在两类候选总数为1时自动加入。未传模式保持旧契约；regular只返回扣除同店在库SN后的普通可售数量，serial按同店每件在库SN返回候选及完整字符串 `serial_number`，每项数量为1，仅按可见SN匹配关键词。计数、分页及门店条件一致，SN字段隐藏时拒绝serial模式。精确SN候选按该件校验，不能把多件SN累加与某个候选的1件比较；普通数量仍合计校验，所有模式均拒绝重复SN。返回启用商品的 `id/name/category/brand_name/product_model/color_name/unit/barcode/sale_price/quantity/serial_quantity` 及准确分页总数，仅含所选店铺现有库存，不返回其他店库存、供应商或采购成本。关键词匹配可见名称、商品类型、品牌、配件型号、条码及同店在库SN；类型名称沿用模板关联的类型资料，类型隐藏时不参与检索；分页滚动可访问全部结果，不将首屏当作完整集合。字段脱敏复用配件配置，名称、门店、数量隐藏时拒绝查询。搜索、切换门店、关闭/卸载丢弃旧响应；换店清空原商品与SN，已选商品跨关键词保留回显。 综合查询来源使用 `GET /api/query/goods/sale-options`，复用同控制器、字段权限及候选服务，要求 `query:view/goods-view` 和共享销售/赠送任一动作（本页 `goods-sell/goods-gift` 或商品管理 `create/gift`）；不能借此进入商品管理页面。

`GET /api/sales/checkout/customer-summary` 必填有效 `phone` 和授权 `store_id`；可选 `context=phone/goods`，省略按phone处理。返回 `member_number/points/available_points/balance`，账户总积分与来源账真实可用积分分别展示，不将历史未追溯余额冒充可抵扣积分。要求共享商品查看及销售或赠送能力（商品管理原动作，或综合查询 `view/goods-view` 及 `goods-sell/goods-gift`），phone场景额外要求手机销售动作；goods场景无需手机销售权限，也不读取手机字段配置。会员号、积分（连同available_points）及余额按客户字段权限脱敏，必要客户字段不可读时拒绝。服务端在同连接事务中先锁客户，再复用积分来源快照，结束回滚释放锁，不创建客户、不修改余额或消费积分；无客户或来源账未安装时可用为0，账表部分安装或来源不一致拒绝返回。字段权限故障严格关闭。前端复用 `unifiedApi` 禁缓存、公共Loading和 `useLatestRequest`，进入结算且手机号/门店有效后自动读，不依赖支付资料填写；换客户、换店、返回选购、关闭、重开及必要字段撤权清除旧摘要与抵扣，丢弃迟到响应，失败可重试。

独立商品收银与手机附加商品不再逐行输入抵扣积分；手机附加商品也不提供“添加商品/积分试算”；本单实收后的“积分抵扣”向试算接口发送可选布尔 `auto_redeem:true`，服务端仅为符合配置的收费商品按稳定顺序分配结算前可用积分，遵守每件最高比例和精确到分的兑换步长，不占用手机金额或赠品，不使用本单新积分。返回逐行分配核对总量、原价及净额后回填，并显示试算后的剩余积分，支持取消抵扣；修改影响试算的商品草稿废弃旧抵扣。确认添加将试算及逐行分配存入外层草稿，重开时只恢复仍匹配的结果；取消编辑保留上次确认结果，关闭整个销售流程才清除。正式提交不接受auto_redeem，仍发送明确逐行积分并事务重验。账户总积分不等于可抵积分，旧无来源积分不自动可用。已有规则由客户管理“积分设置”维护；固定金额封顶尚未实现，手机抵扣也未因设置页允许勾选新机/二手而开放。

整单提交金额按分合计，须完整收取积分抵扣后的净额。独立商品收银在结算阶段一键请求后端分配逐行抵扣，贴膜专用明细保留原积分输入与“积分试算”；修改内容后废弃旧试算，提交重新校验。`POST /api/sales/checkout/quote` 沿用实际销售权限/字段/门店边界，只读事务回滚释放锁，不保留额度。整单请求键在当前窗口内失败重试保持不变；服务端以原载荷核对幂等。同键改内容不能重复落账；服务端首次明确拒绝（400 `CHECKOUT_INVALID/CHECKOUT_RETURN_INVALID/POINTS_AVAILABLE_INSUFFICIENT`，或409 `CHECKOUT_RETURN_QUOTE_CHANGED/CHECKOUT_RETURN_PAYMENT_REQUIRED`）时，保留录入及原请求键、废弃旧积分或售后试算及资金确认，允许修正和重新核对；错误状态、`success:false`和业务码均须匹配。请求冲突、处理中、结构未就绪及其他未识别错误不解除冻结。若此前已有一次结果未知，后续明确拒绝也不能证明此前未成交，继续冻结并仅允许原请求重试或查原单。贴膜首次400/409且明确 `FILM_SERVICE_INVALID/FILM_DEVICE_REQUIRED/FILM_TEMPLATE_OVERLAP/FILM_TEMPLATE_REQUIRED/FILM_STOCK_AMBIGUOUS/FILM_STOCK_INSUFFICIENT/FILM_PRODUCT_REQUIRED/FILM_SERVICE_NOT_READY` 同样可修正；此前未知结果不解冻。此判断统一复用 `sales-checkout.ts` 的 `isCheckoutSubmissionRejected`，通过 `api-response.ts` 读取公共错误，不改变后端事务及幂等约束。网络或异常响应导致结果未知时，保留表单内核对提示，冻结客户、门店、支付、备注及商品明细，禁止添加商品和重新试算，只允许原内容及原请求键重试或关闭后到综合查询核对。姓名锁和显式禁用属性不能覆盖表单的冻结状态。取消、顶部关闭及允许的Escape沿用公共规范直接关闭，不二次确认、不在关闭时提交；销售或姓名保存进行中阻止关闭，重新打开重置商品草稿。成功发出 `success`，父销售页绕过缓存刷新库存候选；纯商品单不增加手机销量。入库用途仅用于记录收费/赠送批次来源和库存流向，不限制后续收费或赠送；收费库存、赠送库存及历史库存均可按本次销售方式出库，批次采购成本和用途流水继续保留。

正式回归：`npm --prefix frontend run test:unit -- tests/sales-goods-checkout.spec.ts tests/accessory-scan.spec.ts tests/device-scan.spec.ts tests/identifier-input.spec.ts`；收银布局、类型检索、连续条码/SN及独立商品开单的隔离浏览器可分别运行 `node frontend/scripts/test-checkout-order.mjs --sales-only --scenario=goods --viewports=390,1440` 和 `--goods-sale-only --viewports=390,1440`；后端候选及整单回归：`node --test backend/test/accessory-sale-options.check.js backend/test/sales-checkout.check.js`。这些替身测试不代表云端真实交易、并发或实物扫码验收。

### 快速出库携带配件

综合查询快速出库仅在零售状态且有 `query:view/create`、`inventory:sell`、共享商品查看及销售或赠送能力时展示“配件”。填写设备及客户/支付资料后进入共同结算，打开窗口不创建手机或销售；取消共同结算保留原快速出库草稿。批发调货及划拨不显示此入口。服务端独立校验实际商品动作，不用 `sales:sell` 代替快速出库权限。

请求使用原 `/sales/checkout`，提交空 `phones` 与 `quick_phone: {brand_id, model_id, color_id, memory_id, supplier_id, is_new, imei, serial_number, purchase_cost, sale_price, inventory_time}`，至少包含一条搭售或赠品。采购成本允许明确NULL，不把未知成本当0；不接受自定状态、操作员、门店或内部快照。商品行的 `linked_phone_id: 1` 只标识这台待建设备，不读取ID为1的真实手机；服务端在事务内新建设备后替换为真实ID，保存真实销售关联。已有库存手机与待建设备互斥。

服务端先校验幂等请求，再核验启用门店/销售员、锁客户、校验手机资料及供应商手机业务范围，拒绝同IMEI在库/预订设备和同客户重复设备。`InventoryService.stageQuickCheckoutPhone` 复用现有入库仓储，只在外层连接创建暂存的在库设备，不另开/提交事务；随后走公共手机销售、商品出库、批次、积分和收款。任何一步失败回滚新设备与整单事实。请求摘要基于原规范化设备资料，不含本次生成的设备ID；重试返回原结果，不重复新建设备。无需新增数据表或迁移。

结算成功后由 `unifiedApi` 的销售写入依赖统一失效配件候选/库存、手机库存、客户及销售查询缓存，父页立即重读；不依赖用户手动刷新。缓存行为回归见 `frontend/tests/inventory-shop-cache.spec.ts`，无关门店资料缓存保留。

快速设备采购字段按 `sales_salesview` 的 `sale.*` 字段权限检查，客户/交易公共字段和商品字段继续分别校验。隐藏成本等必要字段时禁止此合单入口；可选备注和Apple ID隐藏后不提交。返回仍为共同订单结果，不返回内部成本或完整设备快照。正式回归：`npm --prefix frontend run test:unit -- tests/quick-sale-goods.spec.ts tests/sales-goods-checkout.spec.ts tests/query-amount.spec.ts`、`node --test backend/test/sales-checkout.check.js backend/test/inventory-controller.check.js`。云端真实交易、多连接竞争、摄像头和真机仍需单独验收。

### 商品明细查询

手机销售凭证已按原销售ID核对同单购买及赠送配件，预览、打印和保存图片共用原明细及净额；读取权限、字段保护及失败阻断契约见[销售凭证](../business/sales-receipt-standard.md#手机随单配件)。

共同单的商品明细可通过综合查询商品模式读取：`GET /api/query/goods` 与 `/api/query/goods/:id` 同时要求 `query:view`、`query:goods-view`，按销售门店限定范围，读取原商品快照、共同单号及关联手机单号；成本、客户、SN与批次按配件字段权限脱敏。旧无快照记录明确显示当前档案，原销售成本与来源批次进价分别展示。返回共同 `order_id/order_item_id` 及原数量、`returned_quantity/remaining_quantity`；已退数量来自原销售关联的返库流水，列表“实收”为原商品扣积分后的成交金额，接口字段仍保留原成交净额语义；换货新件可含原件抵付，不能等同本次现金实收或售后净业绩。具备退库或换货权限的共同商品明细可进入对应办理；旧无共同明细记录不补造订单。详细参数与历史边界见[配件查询契约](../backend/accessory-entry.md#综合查询商品模式)。

### 商品原单退货

综合查询商品模式的“退货”由 `SalesAftersaleController → SalesGoodsReturnService → SalesAftersaleRepository` 编排，复用原批次返库和积分来源账；不删除原销售、订单、明细、收款或采购记录。支持收费商品和赠品、分次退货、SN按原单逐件选择，以及退回其他授权且启用的门店。员工须确认实物可重新入库；待检、维修、报废及自动售后期限尚未开放。手机与关联赠品及商品换货分别由下文专门入口办理；商品提成内部冲回凭据及正式工资保存/发放已接入代码，云端结构迁移已于2026-11-14执行并核验，真实业务验收尚未执行；旧共同手机删除式退库保护继续保留。

内部编排分为原积分冲回 `reverseGoodsPoints` 与实物返库 `returnGoods`；后者先复用前者再返还原批次/SN。共用 `normalizeOperation` 处理身份、门店、时间和资金校验，`runInput` 处理持久请求、同事务和完整重试；普通商品退货的原请求摘要顺序保持不变。单独的积分步骤不写库存、不保存售后单或提交事务，扩展调用方必须在同一连接追加完整业务凭据。当前[贴膜撤销内部事务](../backend/accessory-entry.md#贴膜撤销内部事务与迁移)使用该基础，未开放HTTP，不使普通商品退货可以跳过实物返库确认。

| 接口 | 契约 |
| --- | --- |
| `GET /api/sales/checkout/:orderId/items/:itemId/return` | 核对原共同商品明细，返回名称、出库类型、原数量、已退量、可退量、SN模式及仍可退原SN；全退返回可退0。使用事务锁及回滚，无持久写入 |
| `POST /api/sales/checkout/:orderId/items/:itemId/return/quote` | 提交下述退货资料，执行与办理相同的库存/积分事务后回滚；返回退款/补款试算，不保留额度，不执行真实资金退款 |
| `POST /api/sales/checkout/:orderId/items/:itemId/return` | 额外提交资金确认 `settlement`，事务内重新核对并提交，返回试算字段及 `aftersale_id` |

三个接口和服务均要求 `query:view`、`query:return-to-stock`、`query:goods-view`，原销售门店和退回门店都必须在操作者授权范围内。办理前检查配件名称、用途、门店、数量、单价、总额、业务时间及备注字段可见；读取原SN上下文或提交SN时额外要求SN字段可见。隐藏必要字段返回403 `FIELD_PERMISSION_DENIED`，不能先写入再遮蔽结果。上下文可能包含SN，因此前端统一要求SN字段可见。试算和提交不允许客户端改原客户、售价、采购成本或奖励规则。

共同资料为 `request_key`（UUID或32位十六进制）、`store_id`、正整数 `quantity`、原单 `serial_numbers`（数量商品为空）、公共 `return_reason`、北京时间 `reversal_date`、可选200字 `remarks`、`restock_confirmed:true`。原数量商品按成交时 `points_units` 的顺序分摊，SN按原快照位置取逐件原事实；历史缺少必要分摊、原销售/共同明细不一致、重复SN、超额或损坏售后历史均拒绝猜测。

服务端金额遵循 `净应退 = 原实付应退 + 已追回优惠补退 - 本次已用积分优惠追回`：非负时为 `refund_amount`，负数绝对值为 `collection_amount`，两者不能同时非零。同时返回 `base_refund_amount/points_recovery_amount/points_compensation_amount`、本次积分变化与原奖励/抵扣返还量、剩余可退数量。原来源返分/补退规则见[积分售后追加账](customer-points-standard.md#积分售后追加账)。提交的 `settlement` 必须包含准确的 `refund_amount/collection_amount`、`method/channel` 和 `confirmed`；金额变化返回409 `CHECKOUT_RETURN_QUOTE_CHANGED`，未确认非零资金返回 `CHECKOUT_RETURN_PAYMENT_REQUIRED`。退款复用公共refund场景，补款复用sale场景，无资金往来方式和渠道均为NULL。

资金字段只记录员工确认的线下退款或收款，不调用第三方支付，也不向原 `payment_records` 写负收款。退款不足时页面展示“客户需补差价”，须确认收到补款，不能造负退款。售后头与明细保存原单、数量区间、返库事件、积分凭据、原销售门店、接收门店、办理人和资金确认；原采购应付不因客户退货而减少。工资和全站净额报表仍需后续接入，不把原销售金额当成退货后的净收入。

请求键持久绑定操作者及规范化内容，相同请求返回原售后回执，改内容返回409 `CHECKOUT_RETURN_REQUEST_CONFLICT`；锁等待、死锁、唯一键冲突最多整体重试三次，不在部分扣分后继续。试算可执行可回滚写SQL，最终回滚；正式办理的库存、SN、积分及售后凭据任一步失败整体回滚。原单上下文、试算及提交在启动失败时销毁连接，回滚失败也销毁连接并立即停止；试算结束或原回执重放的回滚失败不再二次回滚或自动重试。正常业务失败、提交失败回滚成功后可复用连接，受控重试仍须先确认正常回滚。商品换货和手机联合退货沿用同一售后事务入口，不另建失败清理规则。页面修改内容废弃旧试算，提交失败保留原键和内容；取消直接关闭，提交中禁止关闭。接口JSON还核对原明细、数量与金额守恒，异常回执不显示成功。办理成功立即无缓存重读商品列表。

### 商品售后凭据迁移

新增 `sales_aftersales`、`sales_aftersale_items`、主换入关系 `sales_goods_exchanges` 与额外购买关系 `sales_goods_exchange_additions` 四张追加凭据表，复用既有共同订单和商品库存/积分账。头保存请求键/摘要、原单/客户/门店/办理人、业务日期/备注、原应退/追回/补退/退款/补款整数分、积分变化、支付方式/渠道和结果JSON；明细保存原共同明细ID、数量及原区间、SN、积分和返库事件凭据。请求键使用ASCII区分大小写唯一索引，原单、客户、门店及原明细均有索引。此表不代替原销售或库存主表。

```bash
npm --prefix backend run migrate:sales-aftersales
npm --prefix backend run migrate:sales-aftersales -- --apply --backup-file=backups/.migrations/sales-aftersales/before.json
npm --prefix backend run migrate:sales-aftersales -- --rollback
```

前置为共同结算结构完整；办理还须积分来源/售后账及原库存返库流水扩展均就绪。默认预览零写入，未迁移返回409 `CHECKOUT_RETURN_NOT_READY`。实际执行须目标授权、可恢复完整备份并暂停相关业务写入；脚本先独占保存0600结构/原十一表摘要文件（包含 sales、phones），再建表或原地升级与回读核验，摘要不能代替完整备份。结构或索引冲突拒绝覆盖，部分DDL可补缺失表和本次新增列。手机售后将 operation_type 扩展为 goods_return/phone_return，并新增 gift_charge_cents BIGINT UNSIGNED NOT NULL DEFAULT 0；换货进一步追加 goods_exchange、replacement_cents/additional_cents BIGINT UNSIGNED NOT NULL DEFAULT 0、主换入关系及额外购买关系，记录原明细、新订单/明细、最初根原单/明细、数量、旧件抵付金额和额外购买金额，唯一约束新明细及额外购买明细。已有售后表原地升级，历史新增金额保持0，不重建或重解释旧JSON。四张追加表任一有历史时连回退预览都拒绝删表；空表实际回退也须新的 `--backup-file`。迁移后重启后端清理结构缓存。新增结构尚未执行云端迁移，不能把本地测试视为线上就绪。

正式回归为 `backend/test/sales-goods-return.check.js`、`backend/test/sales-aftersale-migration.check.js`、`frontend/tests/goods-return.spec.ts` 和 `frontend/tests/query-goods.spec.ts`。它们验证原单、部分/SN、优惠追回/补退、资金确认、幂等、权限及失败回滚；SQL替身/串行锁替身不代表真实数据库多连接验收。原单列表展示退回数量，售后资金历史按下节查询，不将原成交金额改成售后净额。

### 商品换货内部事务

换货v4在同一换货订单中保存主换入商品和多个额外商品。主换入数量与退回数量相等，额外商品数量独立，购买按正常金额收款，赠送按零元出库。售后头增加 `additional_cents`，额外商品关系保存于 `sales_goods_exchange_additions`，差价公式同时扣除主换入净应付和额外购买净应付；历史读取会核验额外订单明细、库存/SN和金额关系。前端差价区域分别展示换入金额、额外购买金额、各自实收和最终应收/应退。

`SalesGoodsExchangeService → SalesGoodsExchangeRepository` 在同一连接内复用原商品退货步骤、`SalesCheckoutService.issueGoods` 及公共积分入口。普通商品退货、手机退货清单、联合退货和商品换货历史共用可核验的跨订单替换链。换货HTTP及综合查询商品模式入口已接入；旧售后/积分结构已迁移回读，本次 v4 `additional_cents` 与额外购买关系结构仍需迁移预览并经授权执行；未验真实业务，不把替身测试记作上线或真实数据库验收。

每次针对一条原共同商品明细，按原可退数量/SN处理，可部分办理；一条新商品数量等于本次退回数量。新商品使用真实库存ID、当前门店、销售员、售价和可选SN/抵扣积分；不允许客户端指定新客户、根原单、关联手机、采购成本、用途或积分奖励。新件不足、停用、原事实损坏、实物未确认或后段记账失败，旧件返库与整笔操作全部回滚。门店沿用原退货范围，动作独立要求 `query:exchange`，不以普通退库权限替代；收费新件另验 accessories:create，赠品另验 accessories:gift。换货主行统一按当前换入商品的销售用途办理，收费原件按新件现价与原件实际成交净额核算，未收费赠品原实收为0，换入收费商品时按新件现价收款；额外赠送商品仍通过独立“赠送”明细办理。已结清未退扣款的赠品按下述规则以原实际扣款抵付收费新件。

已扣款赠品换货复用原赠品退款事实，旧件仍保存原gift销售及扣款售后，新件按sale记账、赠品约定为空，权限按共享商品销售能力（商品管理create或综合查询goods-sell及查看前置）重新校验。原实际扣款12元换50元商品，只确认38元补款；换8元商品退4元；明确0元扣款仍保留原扣款售后ID，不误判为尚未扣款。新件按现行商品规则累计积分，使用结算前已有积分抵扣时不累计；旧赠品不补发积分。v3返库事实追加 `gift_refund_cents` 与 `gift_charge_aftersale_id`，按实际退回区间/SN分摊，不占用仍未退赠品的扣款。完整换货链只有核验原扣款历史、退款金额和原售后ID后才允许gift转sale；缺失、重复或伪造凭据拒绝。后续换货/退货按新件净成交处理，不重复返还旧赠品扣款，也不改变原关联手机或采购应付；整个过程仍在一次事务内，失败整体回滚。

旧件按原批次/SN/积分凭据退回，新件建立独立共同订单及明细，不改原成交头、销售或收款。新明细继续保存原关联手机销售ID，在不可变 `snapshot.exchange_source` 保存上一级原单/明细及最初根原单/明细，并通过 `sales_goods_exchanges` 双向核对原售后事实。连续换货逐级核验客户、用途、赠品约定、关联手机、数量、新金额、实际收款分配及根关系；新明细ID须晚于原明细，缺关系、循环或跨客户关系拒绝。新订单请求键由换货请求键加业务域摘要派生，不与原共同销售请求混用；售后仍沿用原请求幂等、报价回滚及整体重试。换货链核验统一在 `SalesGoodsReturnService.load/lineage`，商品退货的只读核对、试算和提交也必须执行，不能绕开换货服务直接退款。根关联手机必须真实属于根共同单及原客户，手机后来取消销售不妨碍保留配件继续独立退货。查不到关系、重复关系、缺上一级原件或快照/关系/售后事实不一致均拒绝，缺少换货表时原普通商品仍按原售后结构办理，不自动补造关系。

资金使用严格v4逐行凭据，在v3基础增加 `additional_cents`：`原应退 + 原优惠补退 - 原优惠追回 - 赠品扣款 - 主换入净应付 - 额外购买净应付 = 实际退款 - 实际补款`。当前一笔换货对应一个原明细和一个换货订单，订单内保存主换入及所有额外购买明细；原实物事实仍为 return，另保存完整 exchange 及 additions 关系。20元换50元只记录30元补款；50元换20元只记录30元退款。实际资金仅在售后头确认一次，不给新件再建全额 payment_records。新订单 `final_amount` 是全部换入及额外购买明细扣积分后的净价，`paid_amount` 按主换入和额外购买分别分配本次补款，旧件抵付只计入主换入。原优惠追回不足形成的旧单补款单列 `original_collection_amount`，不混入商品实收。各明细实收与主换入抵付之和等于其净价，整笔退款/补款与原件、主换入及额外购买金额守恒。原采购应付不随客户换货减少，工资和全站售后净额仍须后续接入。

换货抵扣在任何返分、发奖前取得逐源限额快照；本次恢复的旧积分不能替代原可用额度，撤回的奖励不能继续消费，新奖励也不进入本次抵扣。抵扣行不累计，新奖励保存真实新明细来源；退原抵扣的已撤销来源只补退金额、不复活积分。新订单保留其完整成交价和逐件积分分摊，之后退换按新单事实办理。原SN与新SN独立核验，数量模式和SN模式可以互换，不能借普通数量占用SN库存。

#### 换货办理接口与页面

`GET /api/sales/checkout/:orderId/items/:itemId/exchange` 返回原单可退量/SN及原 `sale_type`，另返回必需的 `replacement_sale_type` 和布尔 `gift_charge_settled`：收费原件和所有赠品换货主行均按收费新件办理，赠品原实收为0；已扣款赠品仍额外保留原实际扣款抵付事实。前端严格核验两字段的一致性，缺失不按原赠品标记自行猜测；`POST .../exchange/quote` 试算并完整回滚，`POST .../exchange` 提交。三者均要求 `query:view`、`query:exchange`、`query:goods-view`，服务内再次核验。请求复用商品退货输入及实物确认，另带 `operator_id`、主换入 `replacement:{accessory_id,quantity,unit_price,serial_numbers?,redeem_points?}` 及可选的 `additional_goods:[{key,accessory_id,quantity,unit_price,sale_type,gift_return_unit_price?,serial_numbers?}]`；主换入数量由换入商品行提交，服务端在锁定原单后核对不超过剩余可换数量，并要求原件SN数量与换入数量一致，额外商品数量独立计算，购买按正常金额收款、赠送按零元出库，分别要求对应商品销售或赠送权限，不接受客户端绕过原单剩余数量、客户、关联手机或用途校验。结果复用原件资金/积分事实，分别返回主换入与额外商品金额、各自实收、抵扣/奖励积分和原单另需补款；提交还返回售后ID、同一换货订单及多条订单明细、根原单/明细和抵付金额。缺结构409、无权403、原单不存在404；内部错误统一脱敏。

字段权限复用 `SalesAftersaleController` 的商品公共字段入口，原退货必要字段外还要求销售员可见；上下文与原件或新件含SN的输入均要求SN字段可见。所有校验在试算/写入前完成，不回传采购成本或原始凭据。权限能力清单、映射和权限页动作中文名同步登记 `exchange`；不自动替角色授予新动作，发布前由权限管理按角色配置。

综合查询商品模式“换货”复用统一商品清单的远程分页库存检索、公共扫码和金额控件。类型提供换货、购买、赠送，换货首条数量跟随原件且用途按服务端核对结果锁定，后续商品数量独立；有SN商品直接通过名称、条码或SN检索，不展示重复的SN编辑控件。购买按正常金额收款，赠送按零元出库，均独立维护库存、数量和SN。已扣款赠品显示按原实际扣款抵付及主换入收费说明。读取权限与实际新件动作分别校验，不能以原赠品权限替代收费商品权限；动作撤权废弃旧报价。门店改变清除新件、额外商品清单与旧报价。新销售员默认当前登录人并可按权限选择，退款或补款只确认一次净差价；变更草稿取消旧试算，回执校验新旧商品/SN、数量、额外商品明细、积分净价和分项实收。提交结果不确定时冻结草稿，保留同键同内容重试，禁止重新试算后重复办理。取消直接关闭，提交中阻止关闭；旧响应和撤权不得回填。

换货窗口的隔离浏览器入口为 `node frontend/scripts/test-checkout-order.mjs --goods-exchange-only`，复用 `frontend/scripts/lib/sales-aftersale-browser-fixture.mjs`、共同结算宿主及真实键鼠工具。挂载正式 `GoodsReturnDialog`、`SalesGoodsLine`、公共弹窗/金额/支付控件和样式，覆盖补差价换货、降价退款和已扣款赠品抵付三场景，以及360/390/430/768/1440px明暗主题。逐项核对原件剩余SN、当前门店商品条码检索、新销售员、锁定用途/件数、新件SN或积分抵扣、改单废弃报价、净资金确认、未知结果冻结及原载荷重试、撤权清理和横向边界。原单、报价及权限均为内存样本，阻断业务和外站网络；该入口不能替代综合查询整页入口、真实后端优惠计算、返库出库/积分事务、实际资金或真机验收。

正式回归入口：`node --test backend/test/sales-goods-exchange.check.js backend/test/sales-aftersale-settlement.check.js backend/test/sales-aftersale-migration.check.js backend/test/customer-points-ledger.check.js backend/test/query-goods-aftersales.check.js`，前端 `frontend/tests/goods-return.spec.ts`、`query-goods.spec.ts`、`goods-aftersale-history.spec.ts` 及 `sales-goods-checkout.spec.ts`。运行时沿用测试规范隔离配置；事务及锁为SQL替身，不代表MySQL多连接、真实扫码、资金或真机验收。

### 商品售后历史查询

#### 售后逐明细资金归属

新商品退货在原 `sales_aftersale_items.fact_snapshot` 中增加 `settlement`，不新建表、不回填历史。唯一计算入口为 `backend/src/utils/sales-aftersale-settlement.js`：`version:1` 及 `base_refund_cents/recovery_cents/compensation_cents/refund_cents/collection_cents/points_delta/offset_cents`。头仍保存整笔实际确认金额；每条保存本商品的原应退、追回、补退及积分事实。`base + compensation - recovery - offset = refund - collection`，全部明细合计须与头守恒，offset合计为0。普通商品退货继续使用v1；手机联合售后和已扣款赠品退款使用严格v2，增加 gift_charge_cents，公式为 base + compensation - recovery - gift_charge - offset = refund - collection。同笔不允许混版，头/行金额、事实与稳定分币归属必须一致，不重解释旧JSON。

同笔互抵时，净退款只按正应退明细的金额比例归属，净补款只按负应退明细归属；整数分采用最大余数，余数相同按原明细ID升序，输入排序不改变结果。不为每条明细重复记录整笔资金。offset正值表示本行应退抵扣同单款项，负值表示本行款项由同单退款抵扣，均不是第二笔资金往来，也不修改原积分消费或返库分摊。未退赠品扣款和后来退款的事实及原单关联见下文手机联合售后规则。

售后历史整个请求由 `QueryGoodsService` 开启同连接只读REPEATABLE READ事务，原销售授权、COUNT/分页、完整头行及下述换货链核验共享快照；成功或异常结束读取后回滚，下一请求重新读取。生命周期和回归入口见[综合查询商品模式](../backend/accessory-entry.md#综合查询商品模式)。

查询先按双门店范围取得本页售后头，再将头ID去重、一次读取同笔全部明细及原共同明细归属。普通同单历史不逐行追加查询；手机联合退货若涉及其他订单的替换商品，再按唯一售后头核验真实原手机、根共同单/客户/原门店及每件完整换货链，复用只读 `load(..., { lock:false })`，不使用 FOR UPDATE 或执行写操作。资金工具默认拒绝跨单；仅接受服务端完成上述核验后生成的 `verifiedItemOrders` 映射，且只允许 phone_return 的v2商品明细跨单，不接受JSON或请求参数声称的根关系。不返回其他明细的SN、资金或内部快照。缺行、无实证跨单、重复、坏JSON、版本/分币归属或头合计异常均拒绝。旧无settlement的历史只在确切为一条商品明细、`goods_return`、原应退一致时读取头金额，不猜测多明细归属、不回写。正式行为回归为 `backend/test/sales-aftersale-settlement.check.js`，查询与实际提交回归继续复用本节测试入口。

`GET /api/query/goods/:id/aftersales` 的 `id` 为原 `accessory_sales.id`，仅接受 `page/page_size`，默认1/20、每页上限100；返回公共 `{ data, pagination }`。要求 `query:view` 与 `query:goods-view`，不要求办理退货权限。先核验原销售门店，再按原销售门店、售后办理门店均在授权范围内分页，COUNT与数据使用相同条件、按售后ID倒序。不跨门店扩大查看范围；原列表已退/未退仍是原销售的全量库存事实，不能从部分可见历史计算全单净额。

复用 `sales_aftersales/sales_aftersale_items`，只执行SELECT，不新建表、不试算或改变库存、积分、资金。同时读取 goods_return/phone_return/goods_exchange，以 `operation_type` 区分；每条返回本次 `quantity/serial_numbers/return_reason`、`gift_charge_quantity/gift_charge_amount`（未退赠品扣款件数/金额）、`base_refund_amount/points_recovery_amount/points_compensation_amount/refund_amount/collection_amount/settlement_offset_amount`（元）、`points_delta/points_award_returned/points_redemption_returned`、办理门店、办理人ID及当前姓名、`settlement_method/settlement_channel`、`business_time/created_at/remarks`。金额及积分读取上述本明细归属；方式渠道是整笔确认凭据的方式，不代表另有一笔收付。办理人姓名来自当前用户资料，缺失显示空值，不冒充历史姓名快照。原抵扣积分处理量不等同于实际恢复的账户积分，已追回部分按原规则补退金额，账户实际变化以 `points_delta` 为准。金额从原整数分凭据转换，不按现价和当前规则重算；不向客户端透传请求键/摘要、原始JSON及内部积分/库存事件ID。

换货行额外返回 `replacement_amount/additional_amount/exchange_credit_amount`（主换入净应付、额外购买净应付、原件抵付主换入），以及主换入 `replacement:{order_no,sale_no,name,operator_name,serial_numbers}`；额外购买关系保留在同一换货订单内并逐项核验金额、数量、用途、库存和SN。非换货 replacement 为null、三项金额为0。金额随完整资金组脱敏为null，嵌套新件单号、名称、SN及销售员沿用原字段遮蔽；新销售员显示成交快照，与办理人当前姓名区分。v4守恒公式同时扣除主换入和额外购买净应付，抵付不作为现金重复累计。历史核验同连接读取真实关系表、完整祖先链和原件/新件客户门店，要求 aftersale_id 确属本历史头，不能仅信JSON。替换件后来已退/换，原历史仍展示当次新件事实。内部 SELECT a.* 兼容旧头没有 replacement_cents 的结构，服务层严格白名单重建公开响应，不透传其他头字段；只有真实换货才读取换货扩展结构。缺关系、缺新件或额外明细金额不一致返回409，不伪装为空记录。

字段遮蔽复用商品查询的 `FieldAccessService`：用途隐藏同时遮蔽实物/扣款数量及完整资金/积分/方式渠道组，防止通过扣款反推用途；数量隐藏同时遮蔽数量及全部资金/积分；单价或总额隐藏同样遮蔽资金/积分和方式渠道；SN、门店、办理人及ID、两个时间、原因备注分别使用既有对应字段。该商品域无独立支付字段权限，方式与渠道共同跟随资金字段，不另造权限模块。损坏快照、重复SN、非整数或资金不守恒返回409 `CHECKOUT_RETURN_CONFLICT`；缺表/字段返回409 `CHECKOUT_RETURN_NOT_READY`，普通原单查询继续独立可用；其他异常统一脱敏500，不把失败伪装成空历史。无授权原销售统一404；无共同明细的旧单不查询售后表，返回空分页，页面不为其展示共同售后区域。

综合查询详情嵌入非路由单元 `GoodsAftersaleHistory`，沿用原 `MobileDialog`、公共表格横向滚动、编号、分页、支付文本、Loading、空态与北京时间。首次和每次重新打开均无缓存读取，失败显示错误及重试；切换原单、撤销查看权限或关闭卸载时取消在途请求，旧响应不得回填。前端校验分页与公开资金凭据，脱敏NULL不当作0。专项回归为 `backend/test/query-goods-aftersales.check.js` 和 `frontend/tests/goods-aftersale-history.spec.ts`；迁移应用状态和浏览器/真机验收仍以T22为准。

### 手机退货原单核对

`GET /api/sales/checkout/:orderId/phones/:saleId/return-checklist` 是只读核对入口，要求 `query:view`、`query:return-to-stock`，有关联商品时额外要求 `query:goods-view`。仓储按原手机共同单和真实销售ID联查全部关联商品，不能用商品订单等于手机原订单的条件遗漏换货后的商品。替换候选必须按其真实订单重建完整换货链，核对根原单及原手机销售，逐层遵守门店范围；只读核验不加行锁，不接受任意跨单关联。手机仅接受仍有效的当前零售事实；错单、越权或已被后续销售替代的记录统一404，替换链损坏或缺失拒绝核对。原单损坏、数量/金额/积分/SN不一致时拒绝猜测。

按手机定位的 `GET /api/sales/checkout/phones/:phoneId/return-checklist` 先确定最新未取消销售，再按真实销售ID关联共同明细；不能关联同设备早期的共同单。取消历史不参与当前销售、再次销售或客户有效消费统计，但继续保护历史原单、积分和单号；唯一口径见[销售记录有效性与当前归属](../backend/phone-status-standard.md#销售记录有效性与当前归属)。旧独立手机退库只核对当前共同关系，永久删除仍检查全部共同历史。只读核对本身不提交退款；共同手机退款须调用下文专用事务入口。

原单明细 `item_id`、`accessory_id`、`accessory_sale_id` 在公共事实解析及核对服务边界统一转换为数字。数据库的 BIGINT 字符串只接受正安全整数，超过 JavaScript 安全范围、0 或非整数拒绝核对；不误用32位ID上限，也不放宽前端 JSON 契约。商品已删除时允许原 `accessory_id:null`，但实际销售及共同明细标识仍必须完整。纯金额分摊内部用途可不带关联标识，公开原单核对不能缺失必需标识。

返回手机原金额/奖励积分，以及每件搭售/赠品的原名称、原SN、原数量、`returned_quantity/remaining_quantity`（已退/剩余）、`available_serial_numbers`（未退SN）、原价/净额、抵扣积分/金额、累计积分、`gift_return_unit_price/gift_return_total/gift_agreement_state`和`remaining_gift_return_total`（剩余赠品原约定总额）；缺约定仍为NULL，0元约定保留。原抵扣及逐件分摊须与数量、金额、累计积分守恒，全额抵扣仍是收费商品；历史无抵扣字段按0，损坏快照拒绝猜测。响应不含内部快照，手机和配件字段分别经公共 `FieldAccessService` 脱敏；隐藏关联门店时拒绝核对，避免从共同头反推位置。该响应不办理退款、不返库、不扣回积分或工资，也不能作为结清凭据；实际提交通过下文专用入口在事务内重查。正式回归为 `node --test backend/test/sales-aftersale.check.js`，完整售后进度见T22。

手机定位同时校验当前手机和销售门店范围；只有确认无共同明细的有效当前销售返回 `mode:standalone`，共同单返回 `mode:checkout`。缺订单或售后表/字段明确409 `CHECKOUT_RETURN_NOT_READY`，不能当作无搭售或已退0件。已退量读取同台关联商品完整售后事实，不按售后办理店范围截断，也不披露其他门店的办理人、时间和资金详情；原赠品约定总额保留，剩余约定只按未退数量计算。隐藏数量时同时遮蔽已退/剩余及剩余约定金额，隐藏SN时同步遮蔽未退SN。

配件 `unit` 仅取原销售快照，缺失或非文本保持NULL，不查当前商品单位。复用 `basic_info.unit` 字段权限脱敏，不把单位加入办理必要权限。前端兼容旧响应缺少单位，缺失、空值或隐藏时使用通用“件”。核对表“SN”列显示 `serial_numbers` 原串码，空数组明确显示“无SN”，脱敏NULL显示“-”；`available_serial_numbers` 继续只供退回选择，不能将已退SN重新办理。

核对区只保留类型标题：仅有关联收费商品显示“存在收费商品”，仅有关联赠品显示“存在赠送商品”，两者同时存在显示“存在收费-赠送商品”；用途隐藏或无关联项时使用中性“关联商品”，不从标题反推隐藏类型。不展示冗长订单说明，原订单标识仍随原清单用于核对及提交。“商品价格”列居中显示原单单价：收费商品用 `unit_price`，赠品用原单留存的 `gift_return_unit_price`，未知显示“未记录”，明确零元保留；不将剩余赠品总额当作商品单价。此列遵守用途和单价字段权限，不依赖数量可见性，也不影响赠品扣款规则。

`ReturnStockModal` 打开即读取原单，复用公共Loading/空态、最新请求和字段权限；关闭、卸载、切换手机或权限变化取消旧请求，失败可重试。加载、损坏响应、错误或无权限均不放行旧提交。共同单核对成功后嵌入下文专用 `PhoneReturnForm`；独立销售保留原行为，后端旧入口仍在事务内保护共同单。正式回归为 `frontend/tests/return-stock-modal.spec.ts` 与 `backend/test/sales-goods-exchange.check.js` 的替换清单用例。

### 手机与关联商品退货

联合退货保留与旧手机退库相同的“退货类型/处理方式”公共选项，仅登记线下后续处理意向，本次仍按实物确认返还库存；不在售后事务中执行返厂或报废。选项变更须重新核对报价，结果未知时冻结，保存至手机事实且纳入幂等摘要；旧请求省略时保持原摘要兼容。系统退库记录同时展示联合售后手机凭据，来源、双门店、整单净退款/补款及只读保护见[系统退库列表的联合售后记录](../business/inventory/transaction-reversal.md#系统退库列表的联合售后记录)。


`POST /api/sales/checkout/:orderId/phones/:saleId/return/quote` 与同路径去掉 `/quote` 的提交接口，由 `SalesPhoneReturnService` 复用商品售后事务、重试和持久幂等入口。综合查询 `ReturnStockModal` 取得共同原单后嵌入 `PhoneReturnForm`；独立销售保留原入口，共同单不能回退旧删除式退库。

请求共用商品售后的 request_key、接收 store_id、原因、北京时间、备注、restock_confirmed 和 settlement；必须逐条提交全部关联 accessories：item_id、非负 quantity、原 serial_numbers、charge_missing/charge_confirmed 布尔值。收费搭售0件表示保留；赠品默认退回剩余实物，未退部分按原单约定金额自动扣款，并由服务端校验 `accessories:gift` 权限；界面不再提供额外确认复选框，明确0元有效，缺约定禁止按当前售价补算。手机数量、原客户/售价/积分不得由客户端改写。

关联商品使用紧凑响应式卡片展示，不再使用横向表格。收费卡片显示“购买数量X、已退X、剩余X、价格X元、SN …”，赠送卡片显示“赠送数量X、已退X、剩余X、价格单价×（总数量−本次退回数量）=金额、SN …”；每个 `item_id` 独立展示，数量输入后实时更新已退、剩余和赠品价格合计。退回控件显示“退回数量X”，收费商品自动显示绿色“（退回XX元）”，赠品未退部分自动显示红色“（扣除XX元）”；不再显示“确认未退”复选框，扣款由服务端按原单约定和权限校验。无SN商品数量范围为0至剩余数量，有SN商品只能从该行未退SN中多选。收费行默认0件（保留），赠送行默认退回全部剩余数量/SN。缺少赠品约定时明确提示并阻止核价。下方表单仅保留接收门店、退货原因、退货类型、处理方式、时间、备注、实物核验和退款/补款确认，不再重复显示商品、数量、SN或赠品扣款控件。商品历史数量、SN和价格仍按原单字段权限遮蔽，所有修改继续废弃旧退款报价和资金确认。

JWT及路由要求 query:view、query:return-to-stock；有关联商品还要求 query:goods-view。控制器通过公共字段权限核验手机售价、门店、销售时间、备注和商品名称、用途、SN、门店、数量、金额、业务时间、备注。服务校验原销售店、当前手机所在店、接收店均在授权范围内。待完成pending、非当前真实sale、错客户/共同单、损坏金额或积分凭据均拒绝。

同连接依次锁共同单、客户、原手机销售和手机、逐项关联商品及历史；原商品、已退祖先及换货后的商品均须逐条核对，每件按其真实订单读取并核验根原单、客户和原手机关联，不简单放开跨单。按原来源冲手机奖励，逐商品退奖励/抵扣、原批次/SN返库，取消原 sales 状态并恢复 phones 至接收店，最后追加售后头与明细。替换赠品继续执行最初原约定扣款，之后退回按该实际扣款退款；联合售后的逐行资金归属仍须一次守恒。原销售价格、积分和销售员以及共同明细、采购和收款事实保留。手机来源已被本次退回商品消费时，先追回原优惠，再对已追回区间补退金额，不恢复已撤销奖励。任一步失败全部回滚，报价执行相同事务后回滚；提交重新计算并核对一次净退款/补款及线下资金确认。

实物 quantity/unit_ranges/serial_numbers 只代表真正返库。未退赠品 `fact.kind=gift_charge` 可为0件返库，部分退回兼扣款为 return_and_charge；`gift_charge` 保存未退 quantity、原约定 unit_cents、实际 amount_cents、未退SN，须结清全部剩余赠品且不能重复扣款。扣款不减少在外实物、不将SN置为在库。后续在商品模式退回该赠品，依据实际扣款返还，保存 gift_charge_aftersale_id/gift_refund_cents；不按当前价格重算、不再次扣款。历史表分列返库件数与扣款件数/金额。

新手机售后使用 operation_type=phone_return，头/行资金v2守恒，净应退为原实付及已扣赠品应退＋优惠补退－优惠追回－未退赠品扣款；负值显示客户补差，不造负退款。每条配件仍关联原手机销售ID，整批备注不拆成不同备注。取消直接关闭，提交中阻止关闭；编辑废弃旧报价和资金确认，提交结果未知时冻结接收门店、退回数量/SN、赠品扣款、备注及资金确认，禁止重新核对退款，保留原内容及原请求键重试。成功通过既有写操作缓存失效入口刷新销售、库存、客户、综合查询及相关统计缓存。

联合退货的隔离浏览器入口为 `node frontend/scripts/test-checkout-order.mjs --phone-return-only`，正式夹具为 `frontend/scripts/lib/sales-aftersale-browser-fixture.mjs`。复用真实 `ReturnStockModal`、`PhoneReturnForm` 及共同结算浏览器公共宿主和键鼠工具，覆盖退款/客户补款两场景、360/390/430/768/1440px明暗主题；核对收费配件默认保留及部分退回、剩余赠品SN选择、原约定扣款、资金确认门槛、提交期间禁用、未知结果冻结和原载荷重试，并检查页面及字段横向边界。原单、权限、积分追回及报价均为内存样本，业务与外站网络阻断；不代表综合查询整页入口、后端资金计算、实际退款、云端库存积分事务或真机验收。

正式回归为 `backend/test/sales-phone-return.check.js`、`backend/test/query-goods-aftersales.check.js`、`backend/test/sales-aftersale-settlement.check.js` 与 `frontend/tests/phone-return.spec.ts`、`frontend/tests/return-stock-modal.spec.ts`。售后/积分结构已于2026-11-14授权迁移回读，真实业务未验收；SQL事务替身不替代MySQL多连接测试。换货、工资当月/跨月冲回及贴膜办理已有各自代码与契约，仍须按T22核对云端迁移及真实验收；采购退供资金处理、贴膜撤销及商品编辑/作废仍未落实，不能据此宣称T22闭环。

### 共同结算结构迁移

```bash
npm --prefix backend run migrate:sales-checkout
npm --prefix backend run migrate:sales-checkout -- --apply --backup-file=backups/.migrations/sales-checkout-20261113/before.json
```

只读预览后，依据本次既有执行授权及用户完整备份再执行；脚本额外保存原结构、字段投影、数量和摘要，备份权限0600，路径不可覆盖。2026-11-13云端返回 `migrated_and_verified / originalDataUnchanged:true`。`sales_orders` 新增请求摘要、结果/积分配置快照、积分合计和支付渠道，方式改VARCHAR20，成本/利润允许NULL；收款新增共同头关联和索引，旧 `order_id` 改可空。原行数据不回填、不重新关联。新增明细表，不新建重复订单头；运行时请求不执行DDL。部分DDL后可核对结构继续，冲突结构拒绝覆盖。

`--rollback` 默认预览，执行仍需新备份路径；出现共同订单事实、任何明细/共同收款、NULL手机收款ID、旧枚举不支持的方式或未知成本即拒绝回退。应用回滚保留新历史。共同手机改价仍未接入；手机售后使用专用追加凭据入口，原手机编辑、旧退库入口在事务内发现当前共同销售关联时返回 `CHECKOUT_AFTERSALE_NOT_READY`，永久删除入口检查全部共同历史，禁止拆单或删除关联事实；旧独立手机单继续原行为。上线界面前需完成共同售后，不能把此保护视为退换货功能。

## 规则

- `invoice_sequences` 只允许在业务事务开始前初始化。业务入口统一先调用 `prepareInvoiceNumberTransaction(connection)`，再调用 `beginTransaction()`；前者复用内部建表预检，同时建立当前事务的号码预留作用域。
- MySQL 的 `CREATE TABLE` 可能隐式提交当前事务并清除 `SAVEPOINT`；禁止在销售、批发或划拨事务内部首次初始化序列表。
- 销售（单台和批量）、综合查询编辑/快速出库、批发、划拨、租赁买断和历史缺号回填均遵守同一入口；禁止在业务事务中再次调用预检来重置预留。
- 批发和划拨按设备使用保存点；单台失败应记录失败设备并继续处理，不能因为回滚保存点失败而把请求升级为 500。
- 综合查询快速出库不含配件时使用 `POST /inventory/quick-sale` 事务，按交易类型生成统一单据号；含配件的零售使用 `/sales/checkout` 同事务新建设备及共同结算。失败均统一回滚并释放连接。
- 统计查询必须复用销售库存筛选条件所需的品牌、型号、颜色和内存关联，不能只查询 `phones` 表却引用 `b`、`m`、`co` 或 `mem` 别名。

### 单据号类型后缀

单据号格式为 `YYYYMMDD + 四位序号 + 类型后缀`。调货和批发属于同一种同行交易类型，必须共用 `PF` 后缀；供应商划拨仍使用 `HB`，普通销售使用 `XS`。

| 业务类型 | 后缀 | 说明 |
| --- | --- | --- |
| `retail` | `XS` | 普通销售 |
| `wholesale` | `PF` | 批发 |
| `peer_transfer` | `PF` | 调货，与批发共用序列空间 |
| `supplier_proxy` | `HB` | 供应商划拨 |

公共工具 `backend/src/utils/invoice-number.js` 是唯一的新单号规则入口。解析工具继续识别 `DH`，用于处理导入或旧备份中的历史值；云端现有 `DH` 和三位单号已统一迁移为四位 `XS/PF/HB`，任何新建、补生成或完整性修复都不得再生成 `DH`。

### 商品与共同单号

- 商品销售和赠送统一使用 `PS + YYMMDD + 6位日序号`，商品采购批次使用 `RK + YYMMDD + 6位日序号`，共同订单使用 `SO + YYMMDD + 8位日序号`。
- 手机采购使用 `PO + YYMMDD + HHmm + 4位分钟序号`，如 `PO26112114300001`。序号按北京时间分钟隔离，来自 `invoice_sequences` 的事务行锁。
- 商品与共同单号使用 `invoice_sequences` 对应日期和前缀的唯一行锁及当前事务预留；共同换货在售后事务开始前也必须完成编号预检。
- 历史重编号入口为 `backend/scripts/repair-legacy-document-numbers.js`，默认只读。执行前须有数据库完整备份；脚本按业务时间和主记录 ID 生成新号，并同步共同单明细快照与幂等回执。无法确认采购分钟或业务日期的记录会阻止整批修复。

### 空号自动补齐

最后核实日期：2026-11-02。

- 新建销售、改期、转换类型或补生成缺失单号时，按业务日期和后缀查找**从 `0001` 开始的最小未使用序号**。有空号先补空号，无空号才继续增加；禁止用 `COUNT + 1` 分配号码。
- 例如 `202611020001XS～202611020010XS` 中 `0003`、`0007` 的记录改到其他日期，后续在 11 月 2 日新增销售依次使用 `0003`、`0007`，填满后再使用 `0011`。改到 11 月 1 日的记录按 11 月 1 日的空号规则分配。
- 只给需要新号的记录分配号码；其他已存在的单据不重新排列，销售记录 ID 和原收款关联不变。同日只改备注、时分秒等信息不换号。
- 每个日期、每种后缀独立分配；`wholesale` 与 `peer_transfer` 共用 `PF`，`batch_item` 与 `retail` 共用 `XS`。四位正序号全部占满时拒绝新增，不能悄悄生成无法正确解析的五位号。
- 分配时先写锁定 `invoice_sequences` 对应的日期/类型行，再以 `FOR UPDATE` 当前读检查销售单号，避免事务旧快照漏读刚提交的记录。并发分配使用同一数据库连接和业务事务，失败按原业务入口回滚，不吞掉数据库错误。
- 同一事务还维护内存预留，同连接并行调用也依次分配；允许先生成多号再写销售记录。**提交前必须把成功使用的单号写入同一连接的 `sales`**；单纯预览或生成号码不作为永久占号。
- 完整回滚不占号。批量单台回滚保存点时，其内存预留保留到本批结束，避免批内重复返回同号；未落库的空号可在下一次操作重新使用。连接复用前由事务预检清除上次预留；禁止修改或拦截连接的 `commit`/`rollback` 方法实现隐式清理。
- `invoice_sequences.current_sequence` 仅保留历史高水位，不再决定下一个号码。历史空号会随后续新增逐个补齐，无需批量重排已有单据。
- 日期选择器保留原业务日期，手机入库、快速出库入库、综合查询/库存管理/销售管理编辑、销售、批发和划拨写入时由后端公共业务时间入口补齐提交时的当前北京时间时分秒；完整日期时间输入保留其时分秒。配件采购入库按完整秒级时间提交并校验。单号日期仍通过公共 `formatBeijingDate` 按北京时间取日，不依赖主机时区。

**数量统计仍以实际销售记录为准，不能读取最大单号尾数当台数。** 多个空号尚未补满、单据删除、历史不规则编号等情况下，最大尾数和实际台数仍可能不一致；单张凭证总数量继续按其实际商品行计算。

## 当前实现

- `backend/src/utils/invoice-number.js` 暴露 `prepareInvoiceNumberTransaction` 作为业务事务统一预检及预留入口；`ensureInvoiceSequenceTable` 仅保留独立建表预检能力，不用于分配号码。
- `backend/src/routes/sales.js` 在销售事务前预检，统计接口补齐参考资料关联。
- `backend/src/services/transfer.service.js` 在批发、划拨事务前预检。
- `backend/src/routes/rentals.js` 在租赁买断事务前预检。
- `backend/src/controllers/inventory.controller.js` 的快速出库保持独立事务回滚；`backend/src/routes/inventory.js` 仅保留按交易类型授权和 controller 委托。
- `backend/src/services/data-import.service.js` 的每一行导入使用独立事务；新增销售、补号和改期统一调用公共生成器，单行失败时设备、客户、销售记录和单号一起回滚。
- 调货和批发的新单号均由公共工具生成 `PF`；手机编辑接口的历史补生成分支也遵循该规则。
- 批发页面不再接受手工覆盖内部单据号；批发多台按设备逐号生成，避免同一输入值写入多条销售记录。
- `npm run repair:sale-invoice-integrity` 默认预览规范单号重复、日期/后缀错位及旧三位/`DH` 格式；确认后使用 `-- --apply` 在同一事务内统一改为四位规范单号。2026-11-02 云端复核：15,749 条销售记录全部为规范格式，空值、旧格式、其他格式和重复均为 0。
- `npm run migrate:sale-invoice-constraints` 默认检查所有非空单号重复及数据库结构；确认后使用 `-- --apply`。数据库同时保留规范单号条件索引，并对 `sales.invoice_number` 建立全字段唯一索引，任何格式的非空重复值都会由数据库拒绝。

## 交易类型转换

综合查询、库存编辑提交 `status` 为 `sold`、`peer_transfer` 或 `supplier_proxy` 时，设备状态和对应的 `sales` 记录必须在同一事务内联动更新：

- `sold` 对应销售，单据后缀为 `XS`；`peer_transfer` 对应批发/调货，后缀为 `PF`；`supplier_proxy` 对应划拨，后缀为 `HB`。
- 转换后按目标类型重新生成单据号，销售时间只决定单号日期，不能直接沿用错误后缀的旧号。
- 转为划拨时交易记录的销售金额和成本统一为 `0`，并清理设备的批发日期和批发金额；设备原始入库成本保留，便于之后转换回销售或批发；转为销售或批发时必须有大于 `0` 的交易价格。
- 转换使用 `FOR UPDATE` 锁定设备，并在失败时回滚设备、销售记录和单号序列变更。
- 执行类型转换时，除原页面编辑权限外，还必须具备目标交易权限：销售为 `sales:sell` 或 `inventory:sell`，批发/调货为 `sales:wholesale`，划拨为 `sales:proxy-transfer`。快速出库同样按所选类型校验权限。
- 已存在成功收款（`payment_status=success/paid`）的设备允许转换为批发或划拨；转换保留原收款流水，不删除、不伪造、不自动冲正财务历史。后续退款或冲正仍按原收款流水处理。

快速出库也支持上述三种类型。销售要求支付方式；批发/调货使用批发价格；划拨金额归零并生成 `HB` 单据，不伪造销售收款。快速出库销售会以新建的 `sales.id` 写入成功收款流水，批发/调货和划拨不自动写销售收款流水。

### 客户积分联动

- 所有创建、更新或删除 `sales` 的入口必须调用 `backend/src/services/customer-points.service.js`，不得在路由内复制积分公式。
- 零售按每条销售记录独立计算；批发、调货和划拨固定为 0。快速出库、租赁买断与正常销售使用同一规则。
- 综合查询修改售价、全新/二手、客户或交易类型时，在同一事务内根据 `sales.points_awarded` 调整差额；零售转批发/划拨必须冲减，反向转换必须新增。
- 退库或删除销售记录前必须先冲减该销售积分；任何一步失败都回滚设备、销售和客户积分变更。
- 历史无逐单凭据销售禁止按当前规则盲目反算，迁移与首次触达边界以[客户销售积分统一规范](customer-points-standard.md)为准。

## 综合查询编辑日期

最后核实日期：2026-11-02；适用于综合查询 `QueryEditModal` 调用的 `PUT /phones/:id`。

- 销售日期变更时，按新销售日期及当前交易类型，调用唯一公共单号生成器重新分配该日的四位流水号。销售仍用 `XS`、批发/调货用 `PF`、划拨用 `HB`；不能只替换旧单号中的日期。
- 仅修改入库日期、备注、金额等其他信息时，不重新生成单据号。同一天从日期时间格式变为 `YYYY-MM-DD`、只调整时分秒或重复保存，不重新消耗流水号；日期比较统一使用公共时间工具的日期格式入口。
- 销售、批发与调货使用相同编辑接口；销售日期同步到设备及其关联的最新销售记录。联动更新 `sales WHERE id = ?` 必须绑定已查询到的 `existingSale.id`，禁止绑定手机 ID，避免两个表主键不同时漏更新或误改其他单据。
- 关联销售记录的 `updated_at` 使用数据库 `NOW()` 记录本次保存时间；`created_at` 不改写。销售日期是业务发生日期，与记录修改时间不是同一字段。
- 当前编辑框是日期选择器，提交 `YYYY-MM-DD`，不会自动拼接保存时的时分秒，也不能视作保留原销售时分秒。
- 转换交易类型时，按目标类型和提交的销售日期生成新单号；日期和类型同时修改也只生成一次。没有单号的历史销售记录复用同一公共生成器补号，禁止在编辑路由内维护另一套查最大序号逻辑。

单号、设备日期和关联销售记录在原有事务中一起提交，失败时回滚；原收款流水保持原关联关系，不因重新编号创建新销售记录。编号更新日志记录设备 ID、销售记录 ID、旧号和新号，便于追溯。

`test/transaction-conversion-contract.check.js` 用手机 ID 与销售记录 ID 不同的模拟记录，执行实际销售更新分支和公共单号生成器，覆盖销售、批发、历史调货、划拨的日期修改、同日保存不换号、缺号补号及日期/类型同时改变；不连接或修改云端数据库。

## 验证

```bash
cd backend
node --test test/invoice-number.check.js test/sales-filters-contract.check.js test/transaction-conversion-contract.check.js test/sales-remarks-sync-contract.check.js
TZ=UTC node --test test/invoice-number.check.js test/transaction-conversion-contract.check.js
node --check src/utils/invoice-number.js
node --check src/routes/sales.js
node --check src/services/transfer.service.js
node --check src/routes/rentals.js
```

线上验证应分别执行：销售单台、批量销售、批发多台、划拨多台，并检查接口返回 2xx、设备状态、销售记录、发票号和失败设备明细。若仍出现 500，优先查看 `TransferController`、销售路由及数据库错误码，不要按弃用接口处理。

自动补号专项使用模拟事务验证空号优先、改期释放原号、类型隔离、批量预留、并发提交/等待、回滚与连接复用、四位号耗尽及北京日期边界。2026-11-02 另在明确授权的云端 MySQL 使用 8 个并发事务、每个事务 20 次预留完成回滚验收，未出现重复或死锁；该结果仅是当时快照。当前真实数据库入口统一使用 `npm --prefix backend run test:db`，默认要求独立测试库；业务库模式必须按[后端数据库回归测试](../backend/database-testing.md)提供本次授权、备份确认和准确目标。测试预留全部回滚，不写入销售记录。

## 相关资料

- [API 调用标准](api-standards.md)
- [历史兼容接口退役台账](compatibility-route-retirement-ledger.md)
- [后端数据库回归测试](../backend/database-testing.md)

### 原共同单只读核对

手机及商品查询使用原销售ID打开同一“整单明细”。`QueryGoodsService.originalOrder` 在既有只读快照中读取头及完整原行，核对原销售客户/门店/员工、数量/金额/积分/SN，跨单关联仅接受经真实换货链核验的后继。原成交净额与本单现金入账分列，换货旧件抵付不计成再次现金入账。原单保留全部原购买/赠品，退换历史另读；完整投影、双模块字段及合计防反推规则见[销售凭证整单明细](../business/sales-receipt-standard.md#整单明细)。接口只读，不改变结算或售后事务。

### 批发及代供应商划拨的门店边界

批发、代供应商划拨在事务中锁定每台设备后，逐台检查原门店授权，并检查实际销售门店授权。来源店与销售店可以不同，但两者均须在操作人当前范围内；混合批次中外店设备回滚至保存点，不修改状态、成本、销售或积分，也不返回其 IMEI。记录列表和统计同样按当前门店范围过滤，并读取库存模块字段配置；成本隐藏时同时隐藏利润及相关汇总。隔离行为回归见 `backend/test/transfer-input.check.js`。
