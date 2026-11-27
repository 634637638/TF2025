# 供应商打款批次规范

## 手机货款门店范围

手机货款按采购来源门店 `phones.store_id` 过滤；统计、列表、导出和批次明细共用当前授权范围，展示的门店也是来源店。批量登记/取消先锁定全部请求手机，逐台核验范围及付款状态，任何缺失、不合条件或越界均整笔回滚；编辑批次核验批次内全部设备，不能静默只改授权部分。普通用户无绑定不能读取全店货款或付款；完整权限管理员保留全店例外。动作权限仍沿用原供应商货款岗位权限，绑定门店不授予付款动作。

隔离回归：`backend/test/supplier-payment-scope.check.js`，不连接真实数据库。

## 适用范围

适用于货款结算页面。手机批量打款、批次详情和已打款编辑沿用下列原规则；商品采购的独立口径见文末。

## 批次定义

新打款记录使用 `phones.payment_batch_id` 标记批次。已打款批次由以下规则确定：

- 批量打款：同一次请求的设备使用同一个 `payment_batch_id`，编辑时仍按供应商边界同步；
- 单条打款：`payment_batch_id` 为空，编辑时只更新当前记录；
- 历史数据没有批次编号时，回退使用 `supplier_id + payment_status + payment_time`（北京时间精确到秒）识别。

批量打款时所有选中设备使用同一个批次编号和北京时间；编辑时只同步该供应商在该批次中的记录。单条打款不会因为时间相同而误并入批量批次。

## 编辑规则

编辑批量打款批次中的任意一条记录，必须在一个数据库事务中同步整批记录的：

- 打款时间；
- 打款方式；
- 打款备注。

前端编辑控件使用 `TIME_FORMATS.DATETIME` 保存完整时间，不得只传日期后由当前时间补齐。后端使用 `backend/src/utils/time.js` 的 `normalizeDateTime()` 解析业务时间，禁止直接使用 `new Date(payment_time)`。

编辑完成后，页面必须刷新列表或批次详情，确保同批次记录显示一致。批次颜色依赖统一的打款时间，整批同步后不得出现同批次颜色分裂。

编辑单条打款记录只更新该记录。若编辑表单未修改打款时间，前端必须提交原记录完整的北京时间，后端不得用当前时间覆盖。

## 权限与取消

- 编辑接口继续使用 `supplier-payments:edit` 权限，由统一认证和权限中间件保护。
- 单手机撤销只取消该手机；旧手机批量批次通过原批量取消接口整批取消手机。
- 手机与商品合并批次通过 `POST /api/supplier-payments/unified-batches/:id/cancel` 整批撤销，必须同时撤销该批次的全部手机和商品采购单。手机付款状态清理与商品付款追加撤销事件在同一事务内完成；任一来源状态、金额、供应商、门店权限或追加账不一致时整笔回滚。
- 合并批次撤销继续使用 `supplier-payments:edit` 权限；商品撤销保留原付款事件并追加关联撤销原因，不覆盖采购原单或原付款备注。重复提交已撤销批次返回原批次明细数量，不重复写事件。
- 没有打款时间的历史异常数据不自动与其他记录合并，只更新当前记录。

## 对外核对图片

货款结算的单个打款、批量打款及批次详情使用公共 `frontend/src/utils/table-image.ts` 生成高清 PNG，并通过 `useImportExport().saveBlobFile()` 保存。列宽依据可见内容计算，不随弹窗宽度拉伸；表头与表体使用相同列宽，序列号、IMEI 等完整展示。

单个、批量打款图片保留供应商、数量、价格摘要和设备明细，整块打款填写区（打款方式、打款时间、打款人、备注）不出现在图片中；内部利润摘要和利润列继续排除。已打款批次详情图片保留顶部卡片及设备明细，仅排除总销售、总利润与利润列；供应商、打款时间、支付方式、打款人、备注、手机数量和总成本继续展示。仅调整导出副本，不改变页面表单、字段权限、提交逻辑或打款记录。

默认按三倍分辨率输出，高分屏最多四倍；超大数据按公共画布尺寸和像素预算限制分辨率。PNG 编码完成后才结束保存状态，成功、失败均清理导出副本。

## 验证

```bash
node --check backend/src/services/supplier-payment.service.js
cd frontend
npm run check:time
npm run type-check
```

## 商品采购整单货款（2026-11-13）

`/payments` 默认“手机货款”，新增“商品采购”页签，内部单元为 `frontend/src/views/payments/page/AccessoryPurchasePayments.vue`。商品按 `accessory_stock_in` 中已完成且有供应商的采购单逐单展示，采购数量、单价、总额来自原入库记录；已售、赠送、划拨和剩余数量不改变整单应付。新单名称、实际品牌、型号、类型、颜色、单位及供应商/原店名称来自入库时服务端快照，`has_snapshot=true`；旧单为false并明确展示“当前档案（旧单无快照）”，不补造历史原名。名称检索使用同一原值优先规则；非空坏快照返回409 `PURCHASE_SNAPSHOT_CONFLICT`。原JSON不透传，投影后仍执行既有字段脱敏；不把当前模板售价当采购成本。零金额单可查询，不登记付款。字段迁移前置及回退保护见[采购入库原资料留存](../backend/accessory-entry.md#采购入库原资料留存)，该字段已于2026-11-14授权迁移并回读，真实采购业务仍待验收。

当前支持列表、批次/商品名称搜索、供应商/入库店铺名称、采购日期及打款状态筛选、单笔或同供应商批量整单登记打款、撤销登记、分页历史；批量登记按真实采购整单金额提交，使用站内公共支付方式 `payment-methods.json` 的 `settlement` 选项。本功能登记已经实际完成的线下打款，不调用银行/第三方转账，也没有审批步骤。手机导出与手机原统计保持原业务口径，商品合计只显示在商品页签，不混为手机已售货款。

| 接口（`/api/supplier-payments`） | 权限 | 契约 |
| --- | --- | --- |
| `GET /accessory-purchases` | `supplier-payments:view` | `page/page_size`（默认1/20，最大100）、`supplier_id/store_id/supplier_name/store_name`、`keyword`、`payment_status=all/paid/unpaid`、`start_date/end_date`；返回 `data/summary/pagination` |
| `GET /accessory-purchases/:id/payments` | `supplier-payments:view` | 先验证原采购单可见范围，分页返回追加历史，不暴露内部幂等键/hash |
| `GET /accessory-purchases/:id/return-context` | `supplier-payments:view` + `accessories:view` | 同一只读快照核对原整单、完整付款链与授权当前门店的指定原采购批次，分页1–100；不执行退供或退款 |
| `POST /accessory-purchases/:id/return/quote` | `supplier-payments:view` + `accessories:view` | 普通批次数量/SN选择的原采购价只读试算，重核原单/付款/来源/库存；不退供、退款、冲应付或占库存 |
| `POST /accessory-purchases/:id/payment` | `supplier-payments:create` | `request_key`（32位小写hex）、`expected_event_id`（无历史为0）、`payment_method`、`payment_time`（完整北京时间）、可选 `remarks` |
| `POST /accessory-purchases/:id/cancel-payment` | `supplier-payments:edit` | `request_key`、`expected_event_id`、必填撤销原因 `remarks`；恢复未打款并保留原记录 |

响应汇总 `total/total_quantity/total_amount/paid_amount/unpaid_amount` 只针对当前筛选条件和授权整单；结束日期包含当天全天。列表不传销售状态，查询不依赖销售表或当前商品成本。前端使用 `useLatestRequest` 和无缓存读取；提交中禁止重复操作，失败保留草稿，同内容重试沿用请求标识，成功重新读取原单状态。

商品采购主表和打款历史首次读取时在空表显示公共 `TableLoadingRow`，后续刷新沿用区域遮罩。见[全局加载规范](../frontend/global-loading-standard.md)。

统一字段模块为 `payments_supplierphonepaymentsview`，新增 `purchase.*` 资料字段，共用原 `payment.*` 的供应商、店铺、品牌、型号、颜色、成本和付款字段。隐藏成本时单价、总额、分类汇总及历史金额均脱敏；隐藏打款状态时同时隐藏已付/未付金额汇总，禁止使用隐藏字段筛选；登记必须能查看供应商、成本、状态和操作字段，另外要求对应填写字段可见。后端通过公共 `FieldAccessService` 独立执行，前端按钮隐藏不是授权边界。

采购列表、付款历史、打款登记及撤销均使用严格字段读取，与原采购退供核对保持一致。角色/字段查询故障或存储配置损坏时停止处理，不按完整字段权限继续，也不返回采购或付款数据；故障边界及正式回归见[字段权限指南](../frontend/field-permission-guide.md#后端边界)。

列表及操作均使用认证用户门店范围。原采购单有历史多店分配时，主入库店及分配中全部门店都获授权才能查看/处理整单，不能只因商品后来划拨到本人门店而查看原采购款。无效的历史分配格式对受限用户不展示；管理员全店范围可核对。历史未绑定供应商/未完成单不自动补造应付。

### 供应商详情采购统计

`GET /api/suppliers/:id` 仍要求 `suppliers:view`，由 `SupplierController → SupplierManagementService → SupplierManagementRepository/AccessoryPurchaseRepository` 返回详情。`stats.accessories_count/accessories_total_cost` 为原采购累计数量和采购总额，复用采购货款仓储的已完成、有供应商及整单门店授权筛选；同商品不同批次/供应商分别归属，不从当前商品主档的供应商、进价或余量倒推。销售、赠送和店间划拨不改变原采购累计，不将此总额命名为当前欠款；付款/撤销历史与待付余额继续在商品采购页核对。

配件统计另需 `supplier-payments:view`，字段使用 `payments_supplierphonepaymentsview`：供应商或门店隐藏则整组不读取，数量跟随 `purchase.quantity`，金额跟随 `payment.purchase_cost`。手机统计另需 `inventory:view`，沿用库存字段的供应商、门店、数量、进价及库存价值权限，按授权手机门店汇总；手机数量包括原供应商仍有关联的在库和已售设备。任一来源无动作权限或字段隐藏返回 `null`；原手机成本未知也保留 `null`，页面不按零补算合计。四项均隐藏时不显示商品统计；数量和金额分别在两来源均已知且合计为安全整数时显示完整合计，金额按整数分相加。

同次详情内供应商、原采购和手机汇总使用同一只读一致性快照；原采购数量、单价、总额异常或累计超出安全整数范围返回错误，不输出截断金额。前端复用 `useLatestRequest` 和弹窗局部 Loading，无缓存读取；切换、关闭、卸载或权限更新时废弃旧响应和已展示内容。

删除供应商前在同一写事务锁定供应商，检查当前手机/配件关联及全部原采购/付款历史（含撤销），已有事实返回409并提示停用保留。事务内配件采购校验引用持有供应商共享锁，与该删除锁协调；外键拒删转为409。没有自动建表或忽略结构错误的兼容分支，缺采购付款结构的环境须先完成既有迁移。正式回归为 `backend/test/supplier-purchase-summary.check.js`、`backend/test/supplier-controller.check.js` 和 `frontend/tests/supplier-purchase-summary.spec.ts`；锁边界替身测试不代表真实MySQL多连接并发验收。

### 数据与一致性

新增一张 `accessory_purchase_payments`，配件专用表共十一张；不增加重复供应商或重复采购主表，不改手机付款字段。每次登记/撤销追加一条事件：`stock_in_id/supplier_id/action/amount/reference_event_id/request_key/request_hash/payment_method/payment_time/remarks/operator_id/operator_name/created_at/payment_batch_id`。原采购单不被更新；按该单最新事件判断状态，撤销事件关联原登记，旧记录永不覆盖或删除。当前整单全额核销，不支持拆分单张采购单金额；手机批量打款附带商品时，可在一个数据库事务内同时核销同一供应商的手机和商品采购单，批次明细保留 `source_type` 用于对账。纠错通过后续批次撤销流程处理。

### 手机打款附带商品

手机批量打款模态框保留原手机选择和打款流程，点击“添加商品”后调用 `GET /api/supplier-payments/unified-batches/options?supplier_id=...` 加载所选手机供应商授权范围内的未核销商品采购单。商品由操作员手动勾选；不添加商品时继续调用原手机批量打款接口。添加商品时必须是同一供应商，服务端在一个事务内锁定并核验手机和商品来源，按真实采购价计算应付，实付必须等于应付，任一来源写入失败整体回滚。商品页仍可通过原单独接口在没有手机款项时登记商品货款。内部批次接口为 `POST /api/supplier-payments/unified-batches`，批次明细通过 `source_type=phone|accessory` 与 `payment_batch_id` 关联；这只是跨来源对账关联，不再作为独立页面入口。迁移前置脚本为 `backend/scripts/migrate-supplier-payment-batches.js`，不得在请求内自动建表。

合并付款准备和付款后查看均保留手机货款原有明细字段、顺序及字段权限（销售时间、店铺、品牌、型号、颜色、内存、序列号、IMEI、入库价格、利润等）；存在商品来源时在手机明细下追加商品货款卡片，按原采购批次资料展示名称、品牌、型号、颜色、数量、单位、采购金额和入库店铺，没有商品来源则不显示该卡片。手机表格和商品表格中的批次记录通过真实 `payment_batch_id` 打开同一份双来源详情，单独付款记录继续使用原历史详情，不以备注或时间判断是否合并。

事务依次锁原采购单、核对幂等请求、验证采购数量×单价与整单金额、按游标核验完整付款追加链及最新事件版本，再追加事件。登记、撤销及退供核对共用完整链规则，核对每条原采购/供应商/金额、付款与撤销交替及撤销的原事件引用；早期记录异常返回409 `PURCHASE_PAYMENT_CONFLICT`，不能只凭最后状态继续登记。撤销沿用被撤销付款的方式及完整北京时间。同请求同内容返回原事件；改内容或过期页面操作返回409。重试旧登记即使原款后来已撤销，也只返回原结果，不重新设为已付。原单锁串行同单操作，唯一请求键补充并发保护，审计写失败回滚；不改变库存、销售或手机付款。操作员取认证身份，客户端金额/人员字段不参与结算。

完整链还核验每条原打款/撤销的方式来自公共`settlement`选项、时间为真实日历日期及完整秒级北京时间；缺失、非法或被截为日期/分钟的历史不自动补齐。撤销的方式和时间必须与其引用的原打款一致，精确到秒；后续重新登记可以采用新的合法方式/时间。核验覆盖全部游标分页，异常统一返回409 `PURCHASE_PAYMENT_CONFLICT`，不追加修补事件；退供核对及原价试算使用相同规则，在读取库存分配前拒绝坏账。新请求的相同输入问题仍为400 `VALIDATION_ERROR`，原幂等回执重放保持原结果。

采购打款登记及撤销的事务启动在异常保护内：启动失败销毁连接，不执行未启动事务的回滚；原单读取、完整付款链、追加或提交失败先回滚，回滚失败销毁连接并停止，不二次回滚或自动重放。正常提交及正常回滚仍复用连接，最终由仓储公共租借入口释放。原幂等回执的提交失败也执行同一清理，不能把未知结果作为成功登记返回；调用方仍须保持原请求标识核对。正式连接故障回归位于`backend/test/accessory-purchase-payments.check.js`，覆盖登记及撤销、启动/锁定/幂等读取/历史/追加/提交/回滚，以及原回执重放；隔离连接替身不代表真实MySQL故障验收。

采购列表与付款历史由服务层编排 `REPEATABLE READ, READ ONLY` 事务，同一公共租借连接读取授权范围内的汇总、COUNT及分页明细。列表原资料投影也在该事务内完成，坏快照不会返回部分结果；付款历史先核对原采购整单门店授权。并发付款或新增采购在下一次请求可见，分页之间不承诺同一快照，不依赖连接默认隔离级别。不加写锁或回传请求键/hash。列表、历史与退供核对/试算共用本业务只读事务入口，仓储不另租连接或提交事务；正常及业务异常回滚结束读取，配置、启动或回滚失败销毁连接，公共helper仍负责释放。正式回归为 `backend/test/accessory-purchase-payments.check.js`、`accessory-purchase-return-context.check.js`、`accessory-purchase-snapshot.check.js`，替身并发/快照测试不代替真实MySQL多连接验收。

采购页已提供“退供核对”，原整批应付与当前本批次余额分别显示；原名称等缺采购快照的资料标记为当前档案，历史缺原入库流水的可退量保持未知。核对的授权、错误码及只读契约见[原采购单退供核对](../backend/accessory-entry.md#原采购单退供核对)。已支持普通批次数量及逐件SN跨页选择、按原采购价只读试算，原批次分配逐行重核实际商品/采购/授权当前店及SN在库状态，并保留内部来源身份供后续事务核对。原采购价值均按真实选择数量和原价计算；未付拟冲减应付，已付每次选择供应商退款或留抵后续货款。试算可返回 `settlement` 分项，付款状态改变或方式冲突拒绝，切换方式废弃旧金额；这些分项只是计划，尚未确认退款或生成留抵。实际退供冲减、退款及留抵使用仍在 T22，尚未提交；后续在原采购单与付款追加历史承接，不按当前模板进价倒算，也不能仅调用分配器后单独扣库。

核对中的SN清单仅含本次采购实际商品在授权店内的在库实物，支持独立分页、字面检索及当前店铺查看；与原采购金额、付款链和库存余额使用同一只读快照。SN字段隐藏或历史来源未知不返回明细，不用当前模板的全部SN代替原批次。

### 迁移与回退

先预览：`npm --prefix backend run migrate:accessory-purchase-payments`。按已授权目标及备份，使用 `-- --apply --backup-file=<新备份文件>`；CLI需从 `backend` 目录运行以加载该目录的当前环境，不读取或打印真实环境内容。只显式迁移脚本执行 DDL，应用请求不自动建表。脚本先备份原七张业务表结构/行数/内容摘要，独占创建备份文件（目录0700、文件0600），新增表后校验字段、索引和原数据摘要；重复执行为 `already_ready`，结构冲突拒绝覆盖。

2026-11-13 当前云端已返回 `migrated_and_verified / originalDataUnchanged:true`，备份为 `backend/backups/.migrations/accessory-purchase-payments-20261113/before.json`，未写真实测试打款。其他环境须先迁移再上线接口。回退应用保留事件表；仅无历史事件时可显式加 `--rollback --apply --backup-file=<新回退备份>` 删除空表，有任何登记/撤销记录拒绝删除。真实SQL和浏览器验收证据统一登记在 T22，不以单元测试代替。
