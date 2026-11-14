# 配件公共资料与采购入库

> 2026-11-14结构状态更新：用户确认可恢复备份、停写并授权后，T22本批9项迁移已在当前配置云库执行并逐项核验；发布结构检查10项均ready。未回填历史积分/采购/工资，未创建真实交易；配置启用及真实业务验收仍未完成。执行证据与剩余事项见[T22](../development/TECHNICAL_DEBT_PROGRESS.md#t22-配件商品业务闭环2026-11-12)。

适用于 `/accessories` 的商品模板、详情和采购入库，以及综合查询的商品销售记录。最后核实日期：2026-11-14。本文描述代码契约，**已获用户授权并完成当前配置所连云端数据库的厂家型号、商品类型/单位/多机型关联迁移及数据核验；本批贴膜等9项结构迁移亦已执行回读，未执行真实入库/贴膜写入、登录后整页验收或真机验收**。隔离浏览器模拟覆盖入库表单的尺寸和资料选择，不请求云端 API。整体需求及延期事项见[需求档案](../development/accessory-business-plan.md)与唯一[任务 T22](../development/TECHNICAL_DEBT_PROGRESS.md#t22-配件商品业务闭环2026-11-12)。

## 采购入库防重与异常恢复

`POST /accessories/stock-in` 必须提交32位小写十六进制 `request_key`，模板新增/编辑不携带该字段。`AccessoryController`只在采购入口转发此事务元数据，实际入库员仍取认证身份。数量、进价和分配数量在转换前复用公共整数/金额校验；门店、供应商及商品关联编号拒绝数组和布尔值。SN仍按实际有效录入件数计量。

原 `accessory_stock_in` 表追加可空 `request_key CHAR(32)`、`request_hash CHAR(64)`，使用 `ascii_bin` 与 `uq_accessory_stock_in_request(request_key)` 唯一索引；历史采购保持NULL，不补造请求。摘要绑定实际操作者、商品及模板输入、供应商、实际品牌、店铺分配、分币成本、实际数量、用途、SN和备注，省略与显式NULL保持区别。原采购、库存批次、SN和事件沿用同连接事务。重复请求返回原采购；并发唯一冲突先回滚竞争事务，再读取已提交采购核对，不能再次生成库存或整批应付。同键更改内容或更换操作者返回409 `STOCK_IN_REQUEST_CONFLICT`，不透出原请求内容；重新核验全部原分配店的当前授权。缺字段、错误字段结构、缺完整唯一索引或非InnoDB返回409 `STOCK_IN_NOT_READY`，运行时不执行DDL或降级。

成功回执统一为 `stock_in_id/batch_no/accessory_id/quantity/total_amount/inventory_time/replayed`，重放除 `replayed=true` 外保留原事实，不重新读取后来变化的模板或库存快照。服务端核对原数量、单价乘数量、供应商及分配凭据后返回；不返回请求键或摘要。原采购ID随批次号字段权限遮蔽，数量、总额和时间沿用原字段权限，NULL不当成0。

前端 `stores/accessory-stock-in.ts` 通过统一存储服务，在当前浏览器标签页会话中按认证入库员保留一笔未确认采购。首次发请求前必须完成持久化并回读；失败不发送。网络/超时/服务端故障、结构未就绪或缺完整回执时，关闭弹窗、组件重建或刷新页面仍保留原载荷与标识，显示“重试原入库”，确认前暂不另建采购。恢复时验证唯一DTO及当前字段权限，隐藏字段不重新发送；请求期间禁止连点和关闭，模板编辑保持独立。仅服务端明确400业务拒绝且确认未提交的错误释放凭据供修正；成功必须收到完整原回执并成功清理凭据，再通知父页刷新。会话存储不能承诺清理浏览器数据、关闭标签页后的恢复；此时须先通过原采购记录核对结果，不能凭未知结果重复创建。

`npm --prefix backend run migrate:accessory-stock-in-requests` 默认只读预览。应用需暂停入库、保留完整数据库备份并传 `-- --apply --backup-file=<受控备份路径>`；脚本以0600、拒绝覆盖的文件保存原表结构及完整行，迁移前后核对全部原字段摘要，已有冲突结构拒绝覆盖。`--rollback` 仅在新增字段均无值时可用，已有任一请求键或摘要即拒绝删除凭据。部署前完成迁移核验并更新前后端；2026-11-14已获授权执行此结构迁移并回读，真实采购未验收。

正式回归为 `backend/test/accessory-stock-in-requests.check.js`、原入库/SN/批次事务测试，以及 `frontend/tests/accessory-stock-in-state.spec.ts`、`accessory-entry.spec.ts`。替身事务覆盖并发唯一竞争、提交后断连、提交前失败、SN重放、身份/字段边界及迁移保护；不替代真实MySQL并发或真实采购验收。

## 采购入库原资料留存

新采购在原入库事务、根模板锁内，对最终实际商品及本次供应商、原入库店执行当前共享锁定读，避免等待模板锁之前建立的可重复读旧快照。服务端只保存版本1白名单：商品/供应商/门店ID，以及名称、商品类型、实际品牌、配件型号、颜色、单位、供应商名称及原店名称，写入原 `accessory_stock_in.product_snapshot JSON NULL`；不新增业务表，不接受客户端快照。原数量、单价、整批金额、时间和认证入库员仍来自原采购列。任一步骤失败同事务回滚；幂等重试只返回原回执，不用后来资料覆盖原快照。

采购货款列表、退供核对及原价试算、入库历史先投影原资料，再由原公共字段服务脱敏；不向客户端返回内部JSON。新单返回 `has_snapshot=true`，原字段为NULL也保持原值；历史NULL快照返回false，保留当前关联资料并在采购页明确标记“当前档案（旧单无快照）”，不回填或声称历史原名。非空快照损坏、版本未知、缺字段或商品/供应商/门店身份不符返回409 `PURCHASE_SNAPSHOT_CONFLICT`，不静默降级。商品名、供应商名及原入库店名检索使用同一快照优先规则与绑定参数。

当前批次库存、SN详情/流水和商品销售来源的采购供应商名称共用快照优先投影；当前库存门店仍表示实物现位置，不改成原入库门店。`GET /accessories/stock-in/records` 使用认证用户的原入库店及全部历史分配店授权，数量与行查询共用整单范围，后来划拨不授予原采购查看权；越店及非法分页在仓储查询前拒绝。

受控命令 `npm --prefix backend run migrate:accessory-purchase-snapshots` 默认只读预览。实际执行先暂停采购写入并保留完整备份，再传 `-- --apply --backup-file=<受控新备份路径>`；脚本独占创建0600原结构/完整行备份，仅添加可空JSON列，并核对全部原字段摘要不变。非InnoDB或冲突字段拒绝迁移；不回填旧单。`--rollback --apply --backup-file=<新回退备份路径>` 仅允许所有快照为NULL，有任何原资料即拒绝删列。部署依赖本字段的版本前必须先完成此迁移及前述防重迁移；运行时缺任一结构拒绝新入库，不自动DDL。**2026-11-14已授权迁移并回读；结构就绪不代表真实采购已验收。**

正式回归：`backend/test/accessory-purchase-product-snapshot.check.js`、`accessory-stock-in-requests.check.js`、`accessory-purchase-return-context.check.js`，以及采购付款/核对前端专项。覆盖原资料、同连接锁边界、客户端伪造无效、坏快照拒绝、字段脱敏、整单门店范围及迁移/回退保护；事务替身不替代MySQL多连接或真实采购验收。

## 原采购单退供核对

商品采购页的“退供核对”调用 `GET /supplier-payments/accessory-purchases/:id/return-context?page=1&page_size=20`，可选 `store_id` 限定当前库存门店。此入口只读，不提交退供、冲减应付、登记退款或生成退供凭据；采购退货资金规则及实施进度统一登记T22。

原采购的在库SN通过同一响应 `serials: { data, pagination }` 返回，与原采购、付款及批次余额共用同一只读快照。`serial_page` 独立控制SN页码（默认1，上限1000000），每页大小共用 `page_size`（1–100）；`serial_search` 可选，最多100字符，拒绝对象、数组、控制字符等非法原值，按去首尾空格后的字面子串匹配，`%/_` 不作通配符。搜索仅影响SN列表及其总数，不改变整批剩余数量。查询精确限定原采购的实际商品ID、`stock_in_id`、`status=in_stock` 和当前授权店铺，不混入同模板其他品牌/批次、已售或已赠出的SN；明细仅含 `id/serial_number/store_id/store_name`，保留前导零并按逐件ID稳定分页。页面提供SN检索、独立分页及手机双击详情，末页因出库消失时回有效页重读。

SN明细额外受配件模块 `basic_info.serial_number` 控制。字段隐藏时不查询逐件资料，`serials=null`；此时传入 `serial_page/serial_search` 返回403，避免用搜索推断SN。历史原入库缺完整流水时同样 `serials=null`，不把未知来源当作零件。前端关闭、换单、撤权清空SN明细/检索并取消在途请求；返回缺字段、重复SN或不完整分页均显示核对失败，不当成空记录。

原采购整单沿用货款页原入库店及全部历史分配店的授权条件；当前批次另按账号授权门店过滤，不能因可看原整单而看到已划至其他未授权店的库存。服务层使用与付款历史共用的本业务只读事务入口，单连接 `REPEATABLE READ, READ ONLY` 快照同时读取原采购、完整付款追加链、原入库流水及当前批次；结束回滚只读事务，配置/启动/回滚失败销毁连接并由公共helper释放，不锁库存，不追加期初或运行迁移。页大小1–100，未知参数、数组/布尔ID或越权店铺在取得连接前拒绝。

响应 `purchase` 保留原供应商、采购数量、采购单价、原整批金额、原店及入库时间/入库员；名称、品牌、型号及来源标记按[采购原资料契约](#采购入库原资料留存)投影，新单为入库时资料，旧单明确当前档案。`paid_amount/unpaid_amount/payment_status/latest_event_id` 来自按游标逐段核验的完整付款链，不能只信最新一行；打款/撤销须交替、原采购/供应商/整额一致，撤销准确引用上一有效打款。零采购可核对，无有效打款；原数量乘单价不符、重复打款、孤立撤销或错原引用返回409。

`ledger_status=verified` 表示原入库流水数量/成本以及授权当前门店的库存/SN账核对通过；`current_quantity` 仅为授权范围内该采购批次剩余量，`data` 按当前门店、原成本、用途及普通/SN方式分组分页，`pagination.total` 是组数。只查原实际商品与指定入库ID，其他品牌、批次或无来源库存不混入。SN另按原入库/门店/成本双向核对，防止总SN数相同却串批。原采购整额不随这些余额变化。

历史缺完整原入库流水时返回 `ledger_status=untracked`、`current_quantity=null` 及空列表，页面显示无法确认可退数量；这不等于零库存。库存账或原入库不一致返回409 `INVENTORY_LEDGER_CONFLICT`，付款账错误返回 `PURCHASE_PAYMENT_CONFLICT`，结构缺失返回 `PURCHASE_RETURN_NOT_READY`，不使用当前主档供应商或成本填补。

接口同时要求 `supplier-payments:view` 和 `accessories:view`，复用两个模块严格 `FieldAccessService`。原采购数量、供应商、店铺、成本/总额、付款状态及当前库存门店/数量为核对必需，任一隐藏均403且不读业务数据；其余采购资料、库存成本/用途/SN方式分别遮蔽，权限故障拒绝读取。原采购内部批次ID及幂等摘要不放入库存行。PC操作列与手机双击详情底部使用相同入口；弹窗复用公共描述、表格、分页、Loading、手机记录详情及最新请求，关闭、切单和撤权清理已读数据并取消旧请求。

### 原采购价退供试算

`POST /supplier-payments/accessory-purchases/:id/return/quote` 仅接受请求体 `{ batches: [{ row_key, quantity }], serial_ids: [id] }`，不接受查询参数、客户端金额/成本/供应商或当前门店。普通批次最多100行，SN最多1000件，至少选一件；批次键须为 `event:正整数`，数量和SN ID为有效正整数，重复批次或重复SN返回400。普通数量与SN可混合选择，同一个SN不能用普通数量代替。

服务端复用上述原采购、完整付款链、原入库与当前余额的单连接只读RR快照，另重读所选实物及原采购正余额。普通批次必须为指定原采购/实际商品/授权当前店的普通库存且余量足够；SN必须仍在库并属于相同原采购、实际商品和授权当前店，其成本与原采购一致。SN表没有逐件用途：同一原采购/店内存在多个SN用途组时拒绝试算，不能猜实物用途。金额按原采购单价乘实际选中数量计算，零采购成本允许试算为0；不参考当前模板价格。并发移走、数量不足、来源/成本不符或用途歧义返回409 `PURCHASE_RETURN_SELECTION_CONFLICT`，缺历史原入库来源返回 `PURCHASE_RETURN_UNTRACKED`，其余账差沿用核对错误码。

选择解析和原批次分配的唯一实现为 `backend/src/utils/accessory-purchase-return.js`，当前由试算直接调用。仓储候选携带原实际商品/采购ID及SN在库状态，分配器逐行重新核验这些身份、当前授权店、原成本、批次用途、数量及候选去重；不只依赖SQL筛选。混入其他品牌商品、其他采购、越权店、已出库SN或未请求批次均拒绝。内部结果保留原批次事件ID及每件SN ID，按店铺/原事件排序、SN按逐件ID排序，输入顺序不改变归属或金额，也不修改输入快照；这些内部身份不扩大公开响应。分配器不持锁、不扣库存或登记资金，未来提交必须在原事务持锁后重读并分配，不能将本次只读结果直接用于写入。

响应为 `purchase_id/quantity/purchase_cost/total_amount/payment_status/latest_event_id/preview_only=true` 及 `data`；各行含 `row_key/store_id/store_name/quantity/usage_type/serial_tracking/serial_numbers`。这是原采购价格试算，不是退款额或冲应付额，不签发提交凭据、不占库存、不追加资金/库存流水、不清除写请求缓存；提交业务将来仍须重查。实际退供及已付采购退款规则仍按T22待确认边界执行。

仍要求两模块view及核对必要字段；另要求库存成本、用途和SN管理可见。请求包含SN时额外检查SN字段，隐藏SN仍可普通试算。页面普通数量和SN选择跨页保留，翻页/搜索/重读会废弃旧试算，重新核对清空选择；关闭、换单、撤权取消在途试算并清理草稿。失败不丢选择，允许重新试算；只读接口采用POST承载有界选择体，统一API显式禁用自动写请求缓存失效。

正式回归：`backend/test/accessory-purchase-return-context.check.js`、`frontend/tests/accessory-purchase-return-context.spec.ts` 及原采购付款测试。隔离替身测试不等于云端MySQL、真实采购退供或真机验收。

## 贴膜服务后端与类型标记

2026-11-14 代码已提供贴膜服务后端、唯一类型标记、设置页开关及手机详情办理/历史入口；服务撤销尚未接入，不能视为贴膜整项已完成。本批结构已于2026-11-14授权在云端迁移并回读，未执行真实贴膜业务。

### 办理事务与资格

贴膜沿用 `POST /sales/checkout/quote` 和 `POST /sales/checkout`，额外提交 `film_service: { customer_id }`。客户必须已存在且与该次客户手机号实际解析的ID一致，不能由客户端传入资格、原购买单或耗膜汇总；该次只办理贴膜，不同时新售手机。后端在同一客户锁事务中重查有效零售购买记录，按公共有效销售状态且购买时间不晚于服务时间判断，不限制原购买门店，也不依赖手机当前在库/已售状态。原手机销售已全额退货取消的不作为资格，仍有其他有效手机购买记录则继续享受；业务时间不能晚于当前北京时间。试算只读并释放事务，不能保证提交时资格或库存仍未变化。

免费行使用赠送出库，须有有效购买资格；收费行使用普通商品销售，客户无免费资格也可购买收费膜。所有用膜商品的真实模板类型均须启用且 `accessory_categories.film_enabled=1`，不按类型名称猜测。收费/赠送库存用途、门店范围、SN/普通数量、实际批次成本、已有积分抵扣及提成沿用现有共同结算；免费不累计积分、不产生提成，收费按商品规则计算。同一连接完成订单、出库、积分、收款及一条服务事实，任一步骤失败整体回滚，原幂等键重试不重复扣库或记录服务；非贴膜旧请求不添加空扩展字段，保留原摘要。

### 权限与最小历史

查看上下文或办理均要求统一 `query:view`、专用 `query:film` 和 `accessories:view`；实际免费/收费行仍分别要求 `accessories:gift/create`。新动作通过共享能力清单登记，权限页面显示“贴膜服务”，不自动授予普通角色。本次服务门店仍受员工原门店范围约束；跨店权益不扩大其他查询或库存操作范围。

`GET /query/customers/:customerId/film-services?page=1&page_size=20` 是专用动作授权的指定客户跨店最小服务历史，可返回其他店办理的服务日期、门店、办理人、原订单号、用膜名称/用途/数量及原成交净额；不返回原手机购买单、原购买门店、手机资料、采购供应商、成本或内部创建人。客户ID须有效存在，页大小为1–100；资格、服务总次数、耗膜总量及分页明细在同一连接的只读REPEATABLE READ快照读取。事务配置或启动失败销毁连接，回滚失败同样销毁，再由公共连接入口释放，避免未消费的事务设置或未结束事务复用。明细读取原订单资料快照和成交金额，不用当前名称/售价覆盖历史。一次成功办理计一次服务，耗膜量另按商品数量合计；当前无撤销接口，不伪造历史服务或把商品普通退货当成服务撤销，撤销后的有效次数口径随后接入。

读写均复用严格 `FieldAccessService`。办理前名称、类型、用途、门店、数量、单价、总价、客户、时间及办理人任一必要字段隐藏均403；提交SN仍校验原SN字段。按客户定向查询前，客户姓名或电话任一隐藏即403 `FIELD_PERMISSION_DENIED`，不进入资格/次数读取，避免通过客户ID反推隐藏关联。历史对名称、门店、办理人、时间、订单编号及嵌套数量/金额递归遮蔽，数量、用途、单价或总价任一隐藏同时遮蔽收费金额，避免半份资金信息反推。服务次数是专用动作授权的次数，不随耗材数量字段隐藏，耗膜总量须遮蔽。权限读取故障失败关闭；接口不传出仓储新增的内部列。

### 类型设置与受控迁移

设置页商品类型可新增/编辑“用于贴膜”布尔开关；单位无此字段。目录返回 `film_ready`，旧环境缺列时读取 `film_enabled=NULL` 并隐藏设置，不把缺列当作接口故障；旧客户端省略字段保留已有标记，显式写入要求结构就绪，缺列409 `FILM_SERVICE_NOT_READY`。保存及校验期间禁用重复提交、编辑和关闭，失败保留草稿。

`npm --prefix backend run migrate:film-services` 默认只读预览：在类型表增加 `film_enabled TINYINT(1) NOT NULL DEFAULT 0`，新增服务事实表 `customer_film_services`，订单ID唯一关联原 `sales_orders`，另保存客户、资格销售ID（可空）、服务门店、办理人/实际创建人、耗膜量及业务/录入时间。订单/客户/手机销售/店铺/员工外键的整数类型从真实父列元数据核对，RESTRICT限制删除和更新；不建第二套库存、积分或客户表。标记全部默认0，管理员须显式启用目标商品类型，不按名称回填、不补造旧服务。

前置为既有类型、客户、手机销售、共同结算及商品库存结构。确认目标、停写及完整备份后才可用 `-- --apply --backup-file=/绝对路径/独占备份.json`；脚本先独占创建0600结构/原类型记录备份，再执行DDL，回读核对结构、原类型摘要及空服务表。DDL中断保留备份和部分结构，新备份可幂等补齐；字段、索引、前缀或外键规则冲突不覆盖。空结构回退使用 `-- --rollback --apply --backup-file=/绝对路径/回退备份.json`，任一启用标记或服务历史禁止回退及重建缺失结构。迁移后重启后端释放公共结构缓存，再显式配置角色权限和商品类型。2026-11-14已执行授权结构迁移并回读；隔离替身测试仍不能替代真实MySQL业务验收。

### 手机详情办理与记录

综合查询手机/平板双击设备详情后，`QueryDetailContent → QueryDetailDialog → FilmServiceDialog` 提供“贴膜”。按钮使用 `query:view/film` 和 `accessories:view` 公共权限指令，处理函数重新核验；客户ID及姓名/电话必须来自当前关联，隐藏必要客户字段时明确提示，不按姓名或手机号猜关联。历史实时分页，分别显示累计服务次数与用膜量、每次时间、门店、办理人、商品及收费/免费原成交净额，不显示原手机购买店或采购成本；字段隐藏同时约束派生金额。关闭、切换客户身份或任一配件字段权限变化均取消旧请求，清理历史、资格及子结算，并按最新权限重读第一页；失败清空旧次数和历史，可重试，不能沿用旧资格办理。

客户详情的 `CustomerFilmHistory` 提供“查看贴膜记录”，点击后懒加载并复用同一 `FilmServiceDialog`，不复制服务历史或新增业务表。入口同时要求 `customers:view`、`query:view/film`、`accessories:view`，客户与配件模块姓名/电话均可见，且客户ID及姓名/电话有效；父详情关闭、切客或失去必要权限立即卸载。读取历史不自动办理；原收费/赠送权限继续独立控制办理。

贴膜查看不保留底部纯“关闭”；没有收费创建或赠送动作权限时不渲染footer，有权限时仅保留“办理贴膜”，资格未就绪或不满足时保持原禁用条件。顶部关闭和查看遮罩由公共 `MobileDialog` 处理，子结算进行中的关闭约束不变。

“办理贴膜”复用 `SalesGoodsCheckoutDialog` 和 `SalesGoodsLine`，固定当前客户姓名/电话，服务门店可在员工授权范围选择，不沿用原购买门店锁定。商品候选沿用 `GET /accessories/sale-options`，新增严格布尔 `film_only=true`，只查所选店的启用库存及启用贴膜类型，计数与分页同条件，按模板继承类型；缺字段明确409，普通候选不要求此结构。隐藏商品类型时拒绝贴膜筛选，防止命中结果反推隐藏资料。该筛选不扩大接口权限，不替代正式事务重新核验类型及资格。原有按数量/SN、销售/赠送、积分试算和净额收款继续复用；无有效购买资格时不提供免费选项，有资格但无赠送权限仍不可赠送。成功返回历史并重读第一页，未成功不伪造服务次数。

正式回归入口为 `backend/test/film-services.check.js`、`backend/test/film-service-migration.check.js`、`backend/test/accessory-sale-options.check.js` 及 `frontend/tests/accessory-settings.spec.ts`、`frontend/tests/film-service.spec.ts`、`frontend/tests/customer-film-history.spec.ts`、`frontend/tests/sales-goods-checkout.spec.ts`；实际执行结果统一登记T22。

## 商品销售与搭售

销售管理新增顶部“销售商品”入口，单台/批量手机销售可转到共同结算弹窗办理搭售或赠送。候选使用 `GET /accessories/sale-options`，严格按销售门店返回实际品牌商品及普通/SN数量，搜索与滚动可读取全部分页，字段隐藏不参与关键词或响应。SN按实物录入自动计数；实际出库、批次成本、客户、积分累计及收款统一调用既有 `/sales/checkout`。赠送需独立权限，混合单逐条关联手机，只有一个公共备注；不改入库资料。接口参数、请求幂等和页面限制统一见[商品销售页面与候选检索](../guides/sales-transfer-transaction-standards.md#商品销售页面与候选检索)。商品明细积分抵扣、商品/共同手机退货、商品换货及正式商品工资保存/发放代码已接通；手机/整单积分抵扣尚未开放。相关来源账、售后及工资结构的云端迁移与真实业务验收边界统一见T22。

## 客户商品购买及赠送历史

客户详情新增只读 `GET /query/customers/:customerId/goods`，沿用 `QueryGoodsController → QueryGoodsService → QueryGoodsRepository`。认证后同时要求 `customers:view`、`query:view`、`accessories:view`，服务层再次核验；只接受 `page/page_size`，分页分别上限100万页/100条。使用真实 `accessory_sales.customer_id` 参数绑定和原销售门店范围，不能用姓名/手机号推断归属；无绑定门店的普通用户保持空范围。COUNT和分页行共用既有只读一致性快照，不因客户在其他门店有消费而扩大可见范围。

响应复用商品销售原事实及快照，包含购买/赠送、名称/类型/实际品牌/配件型号、单位/数量、已退/未退数量、原单价/成交净额/积分抵扣、销售门店/人员/时间/备注、原关联手机单号及是否有共同单。关联手机在未授权门店时单号返回NULL，不透传内部门店ID，整单入口仍独立拒绝越店原单。已全退仍保留；旧无快照记录明确资料可能为当前档案，旧单没有共同单时不补造入口。白名单不返回客户身份、采购成本/利润或内部订单/明细ID。沿用配件严格字段权限，客户姓名或电话隐藏时返回403，禁止通过客户ID定向反查隐藏关联；数量/用途/金额隐藏同步遮蔽派生资金和积分，读取权限故障拒绝完整响应。

`CustomersView` 的原手机购买记录明确标注“手机购买记录”，新增内部单元 `CustomerGoodsHistory` 展示商品记录，并复用“整单明细”原销售入口；整单仍独立执行原权限、全部明细门店范围及字段核验。关闭、切客户、卸载、模块撤权或商品字段变化时废弃旧请求/数据/子弹窗；失败可重试，分页使用服务端结果，金额NULL不当零。此次不修改原客户 `purchase_count/total_spent` 的手机统计口径、不新增表/权限动作或写入真实数据。

手机及平板记录不放行内按钮，使用公共双击指令和 `useMobileTableDetail` 打开 `RecordDetailDialog`，短字段两列、单号/名称/时间/备注整行。“整单明细”仅在记录有共同单时出现在查看底部，先关闭记录详情再进入原整单；无共同单只读且无空footer。关闭或切页卸载记录详情，桌面保留原记录下的整单入口。

页面隔离浏览器命令为 `node frontend/scripts/test-checkout-order.mjs --customer-pages-only`，覆盖客户商品记录及贴膜查看；商品查询详情使用 `--goods-page-only`。默认完整命令包含客户贴膜查看。可用 `CHECKOUT_SCREENSHOT_DIR` 指定临时截图目录，生成390px暗色/1440px明色样本，查看后清理；脚本自动清理自己的Vite、浏览器及缓存。全部数据和服务为内存样本，业务及外站网络阻断，不能代替真实业务验收。

正式测试：`backend/test/customer-goods-history.check.js`、`frontend/tests/customer-goods-history.spec.ts`；隔离浏览器共用 `frontend/scripts/test-checkout-order.mjs`。本节为代码契约，云端结构前置及真实登录验收边界仍在T22维护。

## 综合查询商品模式

商品列表、详情、手机随单配件及售后历史由 `QueryGoodsService` 在公共连接租借入口内编排 `REPEATABLE READ, READ ONLY` 事务，仓储沿用传入的同一连接。单次请求内的COUNT/分页、原销售/已退量、SN/采购来源及售后头行/真实换货链读取同一快照；并发新销售或售后提交在下一次请求可见，不将不同时点的事实拼为一张单据。不使用行锁、提交写入或请求内DDL。正常/业务异常均回滚结束读取；配置或启动失败、回滚失败销毁连接，公共helper仍负责释放。分页之间、多个手机销售的独立请求之间不承诺共享同一快照，实际售后提交仍须在写事务重新核验原单。

`/query` 默认手机模式，具备 `accessories:view` 才显示商品模式；进入商品模式仍须拥有 `query:view`。`QueryGoodsPanel` 复用原页面及商品字段权限，不创建独立权限模块。手机、平板支持公共表格双击详情，桌面双击及“详情”按钮均可打开同一原单。共同商品明细有未退数量且具备 `query:return-to-stock` 时显示“退货”，进入 `GoodsReturnDialog`，提交成功后实时重读；契约见[商品原单退货](../guides/sales-transfer-transaction-standards.md#商品原单退货)。商品模式不展示手机快捷入库/销售/导出动作；换货与贴膜仍按T22推进，商品开单使用销售管理入口。

| 接口 | 参数及响应 |
| --- | --- |
| `GET /api/query/goods` | `page/page_size`（默认1/20，单页最多100）、可选 `keyword`（最多100字符）、`store_id`、`sale_type=sale/gift`、`start_date/end_date`（北京时间日期，包含首尾整日）；返回 `data` 记录及 `pagination`，未提供的筛选不限制 |
| `GET /api/query/goods/:id` | 按商品销售ID读取原单、`serial_numbers` 和 `batches`；不存在或超出门店范围统一404 |
| `GET /api/query/goods/:id/aftersales` | 按同一销售ID和公共分页读取售后数量/SN、退款/补款及积分变化；仅包含原店与办理店均获权的历史，缺表/字段明确返回409，不伪装为空记录 |

请求链路为 `query.js → QueryGoodsController → QueryGoodsService → QueryGoodsRepository`，复用统一认证/授权、门店范围和共享数据库连接。三个接口及服务均校验上述两项查看权限。未绑定门店不能查到记录；显式越权门店不会扩为全店。列表计数和分页使用相同筛选，SN通过存在性子查询匹配，避免逐件记录扩大销售数量。查询禁用缓存，筛选/翻页/详情使用 `useLatestRequest`；读取失败保留旧列表并提示，关闭或权限撤销取消旧请求。

销售记录来自 `accessory_sales`；共同单通过 `sales_order_items` 返回成交时商品资料快照、`sales_orders.order_no`、`order_id/order_item_id` 和关联手机 `sales.invoice_number`。`has_snapshot=0` 的旧出库明确标注“当前档案（原单无资料快照）”，不能把当前名称当成历史快照。金额、客户、原数量、销售员及日期读取原销售事实；新增 `returned_quantity/remaining_quantity` 从原销售关联 `sale_return/gift_return` 事件核对，不改原销售数量。金额称“原单实收”，不作为扣退货后的净收入。`purchase_cost` 为原单保存的总成本，界面称“原单总成本”；旧出库可能没有真实批次成本，未知值保持NULL。

详情的来源批次读取原销售负数 `accessory_inventory_events`，按 `stock_in_id` 关联原采购批次及供应商，返回实际数量、采购单价、用途、入库员和日期。SN读取原销售/赠送事件，不按实物当前店铺重建历史；没有批次事实时显示空记录，不按当前主档供应商或进价补造。

共同原单详情内的 `GoodsAftersaleHistory` 独立分页读取已有追加售后表，展示每次退款/补款、原优惠追回/补退、积分处理量和账户变化、办理店、人、原因备注及两个时间，不把部分可见历史合计为全单净额。复用公共表格/编号/分页/支付/Loading/空态，失败可重试、关闭即取消读取；无共同明细的旧单不展示该区块。完整字段及未迁移边界见[商品售后历史查询](../guides/sales-transfer-transaction-standards.md#商品售后历史查询)。

字段脱敏沿用 `accessories_accessoriesview`：单号复用 `basic_info.sequence`，出库类型复用 `basic_info.usage_type`，销售时间复用 `time_info.created_at`，客户、成本、利润、数量、SN、店铺、备注等按原字段递归遮蔽，包含嵌套批次。数量隐藏时同时遮蔽已退量、剩余量；数量、单价或总额隐藏时同时隐藏可推导的金额和累计积分。隐藏字段不参加关键词搜索，隐藏门店、类型或日期时拒绝显式提交该筛选，避免通过命中结果反推数据。

正式回归：`node --test backend/test/query-goods.check.js backend/test/query-goods-aftersales.check.js backend/test/query-goods-snapshot.check.js backend/test/query-connection-lease.check.js`、`npm --prefix frontend run test:unit -- tests/query-goods.spec.ts tests/goods-aftersale-history.spec.ts`。只读查询不新增表、不回填销售或积分；此前云端核对无商品销售样本，本批历史查询未连接云端，SQL替身不等于真实原单或售后验收。

商品查询面板的隔离浏览器入口为 `node frontend/scripts/test-checkout-order.mjs --goods-page-only`。真实挂载 `QueryGoodsPanel`、原单详情、售后历史和整单明细，服务使用内存样本并阻断业务及外站网络；覆盖360/390/430/768/1440px明暗主题、关键词/分页/类型和门店筛选、空态、原批次与SN、字段隐藏、失败重试、撤权和迟到响应。手机/平板使用实际触摸双击，桌面使用详情按钮；仿真屏幕尺寸与视口同步，避免headless默认屏幕影响公共设备判断。此入口不代表综合查询外层手机/商品模式切换、真实交易、云端MySQL或物理设备已验收；结果仅登记T22。

## 资料边界

配件沿用项目公共数据库连接，专用表为十二张：`accessories` 保存商品模板及所属实际品牌商品，`accessory_stock` 保存门店汇总库存，`accessory_stock_in` 保存采购入库事实，`accessory_sales` 保存销售记录；`accessory_categories`、`accessory_units` 分别管理商品类型和单位，`accessory_compatible_models` 保存商品与已有手机型号的多对多关系。另有 `accessory_serials` 保存逐件 SN、状态及店铺位置，`accessory_serial_events` 保存入库、销售、赠送追踪，`accessory_transfers` 保存店间划拨，`accessory_purchase_payments` 追加保存采购付款登记与撤销历史。`accessory_inventory_events` 保存批次接续、入库、划拨和销售/赠送的数量与成本事实。不另建数据库或品牌、型号、颜色、供应商、门店、员工副本。

| 字段 | 契约 |
| --- | --- |
| `category_id` / `category` | 分类引用 `accessory_categories`，如手机壳、钢化膜、数据线、充电头；主表名称优先，原文本作为历史兜底。不引用手机型号充当分类；类型由设置页面维护 |
| `unit_id` / `unit` | 单位引用 `accessory_units`，如张、个、套、条；名称由设置页面维护，原文本作为历史兜底 |
| `brand_id` | 商品本身的实际品牌，引用公共 `brands` 的配件/两者范围；入库显示“品牌”，独立于适配品牌，可在选模板前后选择。模板新增/编辑不展示或提交，保留旧关联；未选品牌作为未指定品牌库存，不代表设备适配范围 |
| `template_id` | `accessories` 的内部所属模板关联；模板为空，按模板采购的新品牌商品关联根模板，使用独立商品 ID 记库存。HTTP 写载荷不接受客户端指定该字段 |
| `product_model` | 配件厂家型号，可空，最多 100 字符；仅保存于 `accessories`，不写入 `models`。模板新增/编辑可直接输入或修改，例如 `MWVW3CH`；选择模板入库时自动带出，首次创建品牌商品时可按到货填写，补货不覆盖已有商品型号 |
| `model_ids` / `model_id` | 多选适配机型只引用公共 `models`，关系保存在 `accessory_compatible_models`；`model_id` 保留首个适配型号供原接口回显。选择器按手机品牌加载完整型号，不受商品自身品牌限制 |
| `model_brand_id/name` | 通过已有型号关联品牌派生的响应字段，辅助回显，不作为额外写入字段 |
| `color_id` / `supplier_id` | 引用已有公共颜色/供应商。供应商引用按 `suppliers.business_scope` 校验；配件可选 `accessory` 或 `both`，旧配件保留原供应商关联 |
| `store_id` | 本次入库门店，未分配的剩余数量存入该门店；选项和后端写入均限制在认证用户可访问门店 |
| `operator_id/name` | 服务端取认证用户；页面只读显示入库员，不接受客户端冒充身份 |

商品类型、单位状态和排序由 `/accessories/catalog` 配件设置模块控制。当前云端已执行商品资料迁移，历史分类、单位按原文本精确初始化，不自动合并保护壳/手机壳、贴膜/钢化膜等名称。整批应付与付款历史已接入商品采购；批次用途、数量流水和出库成本见下文“批次库存流水与入库用途”，配件详情提供当前批次库存查询。门店汇总表不作为采购来源。

## API 与权限

库存/模板、候选及入库等受字段保护的入口使用严格字段读取；商品查询、随单凭证、共同结算、采购付款和售后沿用同一公共机制。权限查询或配置解析故障返回统一错误，不能按空隐藏字段放行。配件路由将已验证的配置仅保存在当前请求，后续拒写和响应脱敏共用，提交后不再重复查询字段权限。规则和正式故障回归见[字段权限后端边界](../frontend/field-permission-guide.md#后端边界)；此更改不新增字段、动作或数据库迁移。

`GET /api/accessories/options` 使用 `accessories:view`。返回最小参考字段的 `categories`、`units`、`brands`、`model_brands`、`models`、`colors`、`suppliers`、`stores`，不返回供应商银行/联系方式或员工敏感资料。供应商仅列出业务范围为配件或两者的启用记录；当前商品已有的旧供应商作为单项保留回显，后端不允许把手机专属供应商新关联到配件。

配件业务服务的 `DATABASE_ERROR` 返回 HTTP 500，并通过公共 `ApiResponse` 隐藏内部错误，不再误报为参数错误 400 或商品不存在 404。真正的商品不存在继续返回 404；业务校验失败保留原 400/403 语义。

设置页面使用独立模块 `accessories_accessorycatalogview`：`GET /api/accessories/catalog` 要求 `accessories-catalog:view`，新增分类/单位要求 `accessories-catalog:create`，编辑分类/单位要求 `accessories-catalog:edit`。页面按钮、路由守卫和后端接口使用同一动作；拥有配件库存模块权限不自动获得分类/单位维护权限。

入口位于配件管理页顶部的“设置”，内含商品类型、计量单位和仓库设置。路径和权限标识保持兼容。界面中的商品类型仍沿用 `category_id` / `category` 与 `accessory_categories`，仅统一显示名称。发布时还需将该模块注册到当前环境的 `modules`；只登记源码能力清单不会立即使既有登录会话显示入口。模块元数据固定使用实际路由 `/accessories/catalog`，避免扫描器按文件名生成错误地址。2026-11-12 已通过公共 `ModuleManagementService.registerModule` 定向完成云端注册并回读验证；按[页面权限能力规范](../frontend/permission-capability-standards.md#修改或移除功能)补齐管理员角色的 `menu_view/view/create/edit`，普通角色授权未变。重复注册未增加权限。普通角色需要在权限管理中明确授予商品资料的相应动作；既有会话刷新权限或重新登录后生效，不得用父模块权限兜底。

- `brand_id`：适配手机品牌；未传时不查询全库型号，`models` 为空。
- `accessory_id`：编辑/扫码补货回显用。服务端根据原档案带回当前停用引用；其他停用项不进入新增候选。
- 商品品牌、适配机型、颜色、分类、供应商及门店的隐藏权限分别清空对应整个选项组；适配手机品牌从属于适配型号字段。
- 参考选项统一经前端 `services/reference-options.ts` 的 `getAccessoryEntryOptions` 读取。打开表单实时加载；型号按品牌查询，并丢弃旧请求；加载失败禁止提交。

`POST /api/accessories/stock-in` 沿用 `accessories:create`，`PUT /api/accessories/:id` 沿用 `accessories:edit`。`product_model` 沿用历史权限标识 `basic_info.specifications`，权限管理中名称改为“配件型号”（该标识不是数据库列），确保原角色的隐藏设置继续生效；读响应脱敏、写入拒绝及前端提交白名单保持一致。

入库创建商品时保存配件型号；扫码/ID 补货仅引用原商品，不能顺便覆盖原商品档案或公共资料。新选公共资料必须存在且启用，编辑可保留原停用引用，也可清空可选关联。在具体适配品牌之间切换仅刷新候选型号，保留已选的跨品牌适配关联；选择或清空适配品牌为“通用”时清空具体型号关联，表示全部品牌、全部机型均可使用。商品自身品牌与适配品牌独立，不根据适配品牌回填商品品牌。

商品模板在配件管理单独创建；后端仍兼容首次入库同时建商品，当前表单从已有模板入库。单独创建调用现有 `POST /api/accessories` 和 `accessories:create` 权限，保存商品资料及适配关系，不创建采购记录或门店库存。模板入口不展示供应商、进价、数量、入库门店和入库员字段；实际到货从入库入口选中模板，填写实际品牌、当次供应商、进价、数量和门店。

顶部“配件入库”在“商品名称”下拉检索模板，按类型分组但选项仅展示名称，使用服务端检索及滚动加载（每次20条），不展示底部记录数或分页按钮。选中后按ID读取详情并自动填充只读商品类型、配件型号、颜色及销售价，保留本次供应商、实际品牌、进价。模板/库存行内入库固定当前模板，不提供切换；顶部入库可按名称搜索。公共最新请求工具丢弃旧搜索/详情响应，候选文案和回填遵守字段权限，停用模板不可入库。

入库基本信息按“供应商、品牌、商品名称、店铺、商品类型、配件型号、颜色、进价、销售价、入库总数、入库员、入库用途、SN管理”排列；SN模式隐藏入库总数。电脑每行四字段、平板/手机两列，隐藏字段不留空列。适配品牌、适配型号、单位、状态、预警值由模板控制，不在入库显示。新商品先创建模板再入库，后端首次入库建商品能力保留。模板新增/编辑仍保留完整资料及四列布局，不引入采购信息。

## 商品模板管理与默认零售价

`/accessories` 内分为“库存查询 / 商品模板”两个展示页签，共用同一商品主档及 `accessories:view/create/edit/delete` 权限，不建立第二套模板表或权限模块。“商品模板”默认查询全部状态，包含未入库与已停用的模板；顶部新增商品模板，行内编辑、入库和删除。启用模板可直接按商品 ID 补货，不要求先有条码。编辑可调整资料、适配机型、默认零售价及启停状态，采购供应商和成本不随模板编辑提交。删除沿用现有软删除：仅停用模板，保留库存、采购和销售记录；确认框明确告知含义，停用后可编辑恢复启用，不执行物理删除。

条码在模板编辑中可修改或清空，空值存为 NULL；服务端去掉前后空格、限制为文本且最多 100 字符，重复检查包含停用模板。商品内部 ID 保持不变，库存和交易继续关联该 ID，历史采购记录的扫码文本不被改写。条码输入及提交继续受 `basic_info.barcode` 字段权限控制。编辑回填的商品类型、颜色、单位、品牌、供应商及型号引用统一转为数字 ID，与公共选项值匹配，避免云端字符串编号在下拉框中显示为数字。

新增和编辑弹窗复用公共标签置顶表单与 Element 网格，基本信息按“商品名称、商品类型、适配品牌、适配型号、配件型号、颜色、单位、零售价、预警值、状态”排列。适配字段并入基本信息，不再单列适配卡片。电脑端四列，平板两列，手机常规短字段两列、名称整行；状态和SN管理使用公共开关，隐藏附加的开启/关闭文字，保留字段及无障碍名称；新建状态默认开启，编辑保留原值。模板条形码与商品照片并排放在基本信息之后，入库模式不展示这两个字段。控件尺寸、标签、间距及弹窗外壳继续由公共实现控制。

条形码支持手动输入或扫码，以字符串保存并保留前导零。模板新增/编辑只保留条码输入，不展示检索按钮或额外保存说明；录入及回车不自动查询，点击底部创建/保存时随模板提交，由后端执行条码唯一性校验。入库模式通过可搜索的商品名称选择具体模板并回填资料，不再展示条码检索区。未填写条码时不发起查询，也不生成虚构条码；后续扫码使用保存的条码识别商品。

模板新增/编辑不展示或提交实际“配件品牌”，保留旧 `brand_id`；新增/编辑保留“配件型号”（`product_model`），与适配型号分开。已移除“配件规格”输入和 `specifications` 数据库字段。“适配手机品牌”改为“适配品牌”，未选择显示“通用”；该选择目前仅筛选适配型号，选择苹果等品牌后加载对应机型，单选品牌而不选型号不会单独保存品牌关联。入库“品牌”为实际商品品牌，可独立选择，不读取适配品牌，也不被模板旧品牌回填或锁定；配件型号由模板提供默认值，首次品牌建档可按实际到货填写；从库存行编辑模板时先读取根模板，避免把实际品牌商品型号误存到模板。库存采用下述模板与实际品牌标识，不能通过补货覆盖历史品牌。

“适配品牌”提供显式“通用”选项；选中或清空为通用会清空已有具体型号，型号框禁用并显示“通用”，表示全部品牌、全部机型。此时无需关联全部手机型号。“适配型号”支持多选；未选择型号时，表单、列表和详情显示“通用”。保存仍提交空型号关联（`model_ids: []`、`model_id: null`），不创建虚构型号或关联全部手机型号。

模板 `sale_price` 是商品默认零售价，模板表单、列表和详情显示“零售价”，采购入库显示“销售价”，与采购供应商无关。新建模板或首次入库同时建商品时可填写；金额必须非负、小于 1 亿元且最多两位小数。补货检索到已有商品后只读展示当前模板售价，请求不携带 `sale_price`，本次只保存供应商、采购进价和数量等入库事实；服务端按已有 ID 或条码识别商品，不以补货载荷覆盖模板价格；新建实际品牌商品同样读取已锁定模板的售价，不使用客户端提交的售价。旧调用携带售价也不改变已有模板或产生批次售价。调价使用模板编辑接口，仍受编辑动作与售价字段权限控制。

列表通过服务端分页/检索加载，不能只在首次取得的 50 条记录中本地搜索。`GET /api/accessories` 的 `page/page_size` 对应实际分页，单页最多 100 条；`status=all` 查询全部，`0/1` 查询停用/启用，省略时仍默认启用。状态字段隐藏时禁止显式状态筛选，界面也不提供该筛选。搜索覆盖可见的名称、条码、分类、配件品牌、适配型号及配件型号，隐藏字段不参与搜索；关联 ID 和适配型号名称随所属字段一起脱敏。联合检索显式统一为 `utf8mb4_unicode_ci` 比较，兼容云端新旧资料表排序规则差异，不修改表结构。切换页签、筛选和翻页复用公共最新请求工具，写入成功后禁用缓存重新加载当前列表。

销售实际成交价由销售单的 `unit_price` 独立保存，修改模板不改历史采购或销售价格。独立商品销售及混合销售已接入共同结算；销售改价/作废和工资等完整流程仍归T22后续阶段，不能改模板后重写成交事实。

## 模板与实际品牌库存

`accessories.template_id` 区分根模板与实际品牌商品，不新增品牌或模板副本表。顶部商品名称候选和模板管理使用 `GET /api/accessories?mode=templates`，仅列根模板；库存页使用 `mode=inventory`，仅列授权门店已有库存记录的实际商品（包括已售完为零的记录），不能因其他店有记录而出现在当前库存列表。省略模式列共享根模板和授权门店库存商品，非法模式返回 400。模板页不展示实际品牌列。

本次云端已执行 `migrate:accessory-brand-variants -- --apply --backup-confirmed`：增加可空 `template_id` 和 `uq_accessories_template_brand (template_id, brand_id)` 唯一索引，不回填或重编号历史商品，不改库存、采购或销售记录。旧商品作为根模板保留，入库实际品牌与旧品牌一致时继续使用原 ID；其他品牌建立子商品。同模板同品牌更换供应商仍复用同一个实际商品 ID，每次供应商、成本、数量及操作员单独记入 `accessory_stock_in`。未指定品牌通过根模板锁和 NULL 安全比较复用，不把“无品牌”解释为适配通用。

入库事务先锁定根模板，核对启用状态与实际品牌范围，再查询/新建品牌商品，和采购单、门店库存一起提交或回滚。同模板并发请求由根模板行锁串行化，实际品牌唯一索引防止重复。客户端的名称、售价、适配等资料不能覆盖已存在模板，也不用于构造新品牌商品的共享资料。停用模板会令所有所属品牌商品读取为停用，不能继续采购/销售。

品牌商品的名称、条码、类型、颜色、单位、图片、适配机型和售价在读取时关联根模板，调价或更改通用适配无需逐品牌复制更新；实际品牌、厂家型号、采购来源和库存保持独立。条码只在根模板保存唯一值，子商品不复制占用条码。入库扫码识别模板后再选实际品牌；后续销售扫码也需选择库存商品，不能仅用模板条码推断品牌。品牌库存行的编辑/删除操作关联原模板，确认文案仍明确停用模板并保留历史。

### 库存读取、预警与类型统计

主列表、库存分页、详情及条码读取使用认证用户的公共门店范围；指定门店须获权，无门店授权时不返回其他店库存。根模板仍可共享选用，但库存汇总只计算授权范围，COUNT、分页和详情库存在同一只读RR事务读取。事务配置/启动/回滚失败销毁连接，正常或业务失败回滚后由公共入口释放；读取不写入库存或补造历史。

`total_stock` 和列表 `remaining_stock` 均表示当前范围实物余量，包含划拨及返库影响。`total_in/total_out` 保留采购/销售累计口径，划拨不增加这两个数，不能用两者相减倒算现存量。模板列表不跨品牌汇总子商品库存。

`GET /accessories/stats/category` 的 `count` 是授权门店商品件数，不是模板或SKU数量；`total_value` 按当前根模板零售价乘实际件数统计，属于零售参考价值，不是批次成本估值或销售收入。排除停用商品及未产生库存记录的模板，保留已有记录的零库存类型。`GET /accessories/stock/warnings` 按实际品牌分别汇总授权范围余量，默认继承模板预警值；显式 `threshold=0` 有效。门店库存分页可核对停用商品的库存，`low_stock_only=true` 按每店余量与模板阈值筛选。页面库存徽章也按模板阈值判断，不使用固定20件。

类型字段隐藏时禁止分类统计；数量隐藏同时遮蔽件数及派生参考价值，售价隐藏则遮蔽参考价值。预警必要字段隐藏时拒绝预警查询及筛选，防止通过结果成员或任意阈值反推；隐藏进价或零售价同时隐藏派生利润，隐藏当前库存同时隐藏派生剩余，前端同步清除对应列及不可见预警颜色。严格权限读取故障沿用统一失败边界。

正式回归为 `backend/test/accessory-inventory-read.check.js`、`backend/test/accessory-controller.check.js` 及 `frontend/tests/accessory-management.spec.ts`。库存专项使用SQLite内存执行JOIN、聚合与分页，仅适配MySQL字符排序和聚合分隔符语法；事务异常使用连接替身。它们不替代真实MySQL隔离/并发、登录整页或真机验收；结果及未验证范围统一登记T22。

预览及执行（其他环境须先迁移再更新应用）：

```bash
npm --prefix backend run migrate:accessory-brand-variants
npm --prefix backend run migrate:accessory-brand-variants -- --apply --backup-confirmed
```

脚本支持重复执行及 `--rollback` 预览/执行；存在任何 `template_id` 非空商品时拒绝删除结构，应保留字段并回退应用代码。空关联时才可在备份确认后回退索引/字段。实际业务入库未执行；云端只读查询可运行。另以六张连接级临时表及 SQL 适配验证品牌独立库存、同品牌复用、模板扫码、共享售价、停用和事务回滚；临时表已删除且正式四表行数一致。临时父表/库存副本用于避开 MySQL 临时表重复引用限制，不代表真实并发交易验收。

当前门店汇总与批次流水共同核对库存，独立采购整单应付已实现；共同结算已接商品累计/抵扣、商品/共同手机退货、商品换货及正式商品工资保存/发放代码，相关云端迁移与真实业务验收仍见T22。供应商详情按原采购整单统计，契约见[供应商详情采购统计](../payments/SUPPLIER_PAYMENT_BATCH_STANDARD.md#供应商详情采购统计)。品牌统计及首页计数的后续口径核对只登记在 T22，不将当前主档成本统计宣称为采购应付。

## 移除重复规格字段

2026-11-12 用户明确要求只保留“配件型号”。`accessories.specifications` 已从云端删除，页面、类型、提交载荷、SQL 和搜索均只使用 `product_model`，不把旧规格文本自动覆盖成型号。删除前自动落盘备份至忽略提交的 `backend/backups/.migrations/accessory-specifications-20261112/before.json`，权限为仅当前用户可读写；迁移返回 `migrated_and_verified`，3 条商品的其余字段逐值摘要一致，库存及单据未写入。

其他环境先预览（项目根目录）：

```bash
npm --prefix backend run migrate:remove-accessory-specifications
npm --prefix backend run migrate:remove-accessory-specifications -- --apply --backup-file=backend/backups/.migrations/accessory-specifications/before.json
```

备份路径相对于命令工作目录。已有备份文件拒绝覆盖；缺少可恢复备份时不删字段。需要恢复时，先回退应用版本，并在确认目标及数据影响后使用同一命令加 `--rollback --apply --backup-file=原备份路径`；恢复只添加规格列、还原仍存在商品的旧规格，不修改配件型号和更新时间，不重建已删除商品。不要用旧全表备份覆盖新交易。

## 供应商业务范围迁移

共享 `suppliers` 主档新增 `business_scope`：`phone`、`accessory`、`both`。迁移默认 `both`，保证迁移前的全部供应商继续适用于现有手机和配件关联；供应商管理表单允许显式设为手机、配件或两者。配件选项列表只向新建/入库表单提供配件或两者范围，服务端同时拒绝新建配件引用 `phone` 范围供应商。手机调用方继续使用共享供应商选项，不按配件范围误过滤。

预览 `npm --prefix backend run migrate:supplier-business-scope`；执行需目标与备份确认：

```bash
npm --prefix backend run migrate:supplier-business-scope -- --apply --backup-confirmed
```

业务范围只存放在已有供应商表，不复制手机或配件供应商记录。修改某供应商范围不会级联删除历史手机/配件档案或采购事实；历史关联保留，后续新建配件引用遵循新范围。

## 品牌业务范围

公共 `brands` 新增同样的 `business_scope`（`phone` 手机、`accessory` 配件、`both` 两者）。品牌管理 `/brands` 列表显示范围，可筛选、创建和编辑；默认展示全部业务。旧品牌默认 `both`，不凭品牌名称自动归类。品牌和供应商继续共用 `types/shared.ts` 的 `BusinessScope`，展示文案复用公共常量。

`GET /api/brands` 默认只返回 `phone/both`，管理页显式传 `business_scope=all`；`all=true` 只表示全量取数，不绕过业务范围。可传 `phone/accessory/both/all`，列表、计数及搜索建议使用相同的范围条件；`both` 筛选仅返回两者品牌。创建省略范围时默认 `both`；编辑省略时保留原范围，非法范围返回 400。写权限沿用 `brands:create/edit`，字段登记为 `brands_brandsview / brand.business_scope`；隐藏时界面不提供编辑，后端通过公共字段访问服务拒绝显式写入并脱敏返回值。

配件自身品牌只列出 `accessory/both`；“适配手机品牌”只列出 `phone/both`，相应适配型号仍来自公共手机型号。服务端拒绝配件新选手机专属品牌及配件专属品牌的适配型号。编辑已有商品时只保留当前旧关联回显，不自动换品牌；改范围不改商品 ID、历史订单或库存。手机公共品牌选项、综合查询/预定/预警选项、维修手机品牌、销售品牌建议及公开手机品牌入口同样筛选 `phone/both`；手机采购和快速销售的新增品牌引用也校验手机范围。历史手机交易和商品列表的品牌 JOIN 保留，不能通过新范围静默隐藏历史业务记录。

品牌写入成功后，公共 Axios 缓存依赖与后端缓存同步失效品牌、配件选项、手机选项、综合查询、预定、维修及公开品牌入口，避免刚改范围仍看到旧候选项；已打开表单重新加载选项后生效。

发布其他环境时先预览，再按已授权的目标与备份执行：

```bash
npm --prefix backend run migrate:brand-business-scope
npm --prefix backend run migrate:brand-business-scope -- --apply --backup-confirmed
```

2026-11-12 当前云端已返回 `migrated_and_verified`，16 个旧品牌均为 `both`，原字段内容核对一致，重复预览为 `already_ready`。迁移前结构/原数据和回读结果保存在忽略提交的 `backend/backups/.migrations/brand-business-scope-20261112/`，不包含连接凭据。没有创建测试品牌或改动真实商品。回退时优先回退代码并保留新增列及已有范围值，不自动删列或重置已维护范围。

## 入库一致性

划拨弹窗的 SN 候选继续使用 `GET /accessories/:id/serials`，显式传入来源 `store_id`、`stock_only=true`、搜索词及分页参数；每页20条，滚动读取后续页，不能把首屏当作完整库存。搜索与翻页保留已选SN的回显，切换来源门店、切换普通/SN模式或关闭时取消旧请求并重置候选；后续页读取失败保留已读页和选择，重新打开下拉重试失败页。`AccessorySerialPanel` 的明细列表继续沿用公共分页，不改接口或门店/字段权限。正式回归入口为 `npm --prefix frontend run test:unit -- tests/accessory-transfer.spec.ts`。

采购应付以这里保存的真实 `accessory_stock_in` 整单数量、单价、总额为准。货款结算已接入独立商品采购页签及整单登记/撤销，具体接口、门店/字段权限、追加审计及新增表迁移见[商品采购整单货款](../payments/SUPPLIER_PAYMENT_BATCH_STANDARD.md#商品采购整单货款2026-11-13)。销售/划拨不减原采购应付；采购退货尚未接入，不按模板现价倒算退款。

后端重算总额，价格最多两位小数。数量必须为正整数；分配允许零但不能为负、小数或超过总数。重复门店合并计数，剩余数量分配给所选入库门店，所有实际分配门店均核验范围和启用状态。

商品创建、采购入库记录及各门店库存加数在同一连接和事务内完成。任一步骤失败回滚，事务开启失败也释放连接；预警值 0 合法，不被默认值 5 覆盖。金额与数量上限同时受当前数据库字段范围约束。业务时间及单号日期使用后端北京时间工具。

普通数量与SN采购均已接入持久请求防重和异常恢复，契约见[采购入库防重](#采购入库防重与异常恢复)。相关采购、库存、销售、积分及售后的代码进度、云端迁移证据和未完成验收统一见T22，不能仅凭前端防连点或单元测试视为真实交易验收通过。

## 字段迁移与发布顺序

厂家型号迁移的 DDL：

```sql
ALTER TABLE accessories ADD COLUMN product_model VARCHAR(100) NULL AFTER category;
```

不改公共主档、原分类、历史型号关联、库存数量或交易记录。当前代码读取该字段，**必须先迁移再启用本批应用代码**；不得在字段缺失时部署并误报可用。脚本不由普通 API 进程执行。

从项目根目录预览：

```bash
npm --prefix backend run migrate:accessory-product-model
```

确认环境、可恢复备份且获得真实数据库写入授权后，才执行：

```bash
npm --prefix backend run migrate:accessory-product-model -- --apply --backup-confirmed
```

默认读取本地开发 `backend/.env`；生产须显式使用服务器自己的环境配置，不复制环境文件。可传 `--env-file=绝对路径`。默认预览仅查 `information_schema`；执行后核验类型/可空性；重复执行不重复新增字段，遇到同名但异构字段拒绝覆盖。

回退优先恢复本批应用代码并保留新增可空字段及真实业务记录。若确认字段没有真实数据且已回退读取该字段的代码，可先用 `--rollback` 预览，再以 `--rollback --apply --backup-confirmed` 执行；已有非空型号时脚本拒绝删除，不以回退为由丢弃数据。

商品资料迁移另由 `backend/scripts/migrate-accessory-product-catalog.js` 执行：新增分类、单位、适配关联三表及 `accessories.category_id/unit_id` 两个可空字段，按原文本和原 `model_id` 回填关联。迁移回填须保留原 `updated_at`，不将结构迁移显示为业务编辑。先预览，再在确认目标、备份和授权后执行：

```bash
npm --prefix backend run migrate:accessory-product-catalog
npm --prefix backend run migrate:accessory-product-catalog -- --apply --backup-confirmed
```

列表、详情及资料选项依赖这些新增结构；发布其他环境时须先运行该迁移，不能仅部署代码。重复运行返回 `already_ready`。回退应用时保留新增结构与已发生的业务记录，不自动删表或清空分类。

## 本次云端执行记录

2026-11-12 用户明确允许执行迁移并确认已有备份。本地另保留迁移前配件四表的结构与数据备份，以及五张公共资料表的行数/内容摘要；路径为 `backend/backups/.migrations/accessory-product-model-20261112_155704/`，不纳入 Git，不公开备份内业务数据。`accessories-before.sql`、`manifest.json` 与 `verification.json` 分别用于受控恢复、迁移前核对和执行后证据；恢复 SQL 会覆盖配件四表，只在另行确认恢复目标和数据影响后使用。

执行 `npm run migrate:accessory-product-model -- --apply --backup-confirmed`（工作目录 `backend`），返回 `migrated_and_verified`。15:59:07（北京时间）回读确认字段为 `VARCHAR(100) NULL DEFAULT NULL`，历史配件的该字段均为空；按旧字段逐行内容摘要核对，配件四表及品牌、手机型号、颜色、供应商、门店五表均保持一致。

当前仓储真实只读查询覆盖列表、详情、入库选项与入库记录；重复迁移预览返回 `already_ready`。此次证据只适用于本地开发配置连接的云端目标，不代表其他环境已迁移，也不代替登录后的 HTTP、实际入库事务、浏览器或真机验收。没有为验证创建测试商品、库存或销售记录。

19:27 商品资料迁移返回 `migrated_and_verified`，三表及两个关联字段均已创建。迁移前快照和回读证据保存在忽略提交的 `backend/backups/.migrations/accessory-product-catalog-20261112/`：`before.json` 保存配件原四表结构与数据，`verification.json` 保存核对结果。初次回填触发商品 `updated_at` 自动更新，已在校验其他原字段未变后按快照恢复该时间，并修正迁移脚本保留原时间。最终原四表行数仍为 1/1/2/0，原字段逐值一致。列表、商品资料和入库选项的真实只读查询成功；不代表实际入库写入或整页验收通过。

## 发布前结构核对

运行 `npm --prefix backend run check:accessory-release-schema`，只读核对本批T22的10项结构：采购请求防重、采购资料快照、共同结算、积分来源及消费分配账、积分售后账、原批次返库扩展、共同售后、商品工资模板配置、工资核销及贴膜。它复用各项既有迁移的预览校验，不新建第二套字段/索引定义，不代替更早基础主档、权限配置、期初核对或真实业务验收。

命令不接受参数，在加载配置及建立连接前拒绝`--apply`、`--rollback`等；连接复用当前环境配置，禁止多语句，使用只读事务并在结束时回滚关闭。迁移预览只获得SELECT和SHOW CREATE TABLE入口，DDL会隐式提交，不能仅依赖只读事务阻止误执行。报告只包含既有迁移命令、状态、待执行语句数和缺失依赖，不输出配置、原始SQL错误、业务记录或备份内容。字符串DDL计为一条；有依赖缺项时标记blocked，不跳过后伪报就绪。

退出码0表示这10项结构校验均为`schema_ready`；2表示仍有pending、blocked或error，不能按可发布处理；1表示参数/配置/连接/回滚等检查本身失败。部分DDL已应用或索引冲突时单项预览仍会拒绝，须先核对，不自动覆盖。各项单独命令默认预览；真实执行仍沿用各正文的目标确认、停写、完整可恢复备份及授权要求，本命令不会批量迁移、回填或授予权限。

迁移依赖为积分来源账先于积分售后账，共同结算先于共同售后/贴膜；库存返库扩展、积分售后账及共同售后齐备后才能启用商品/手机售后。工资两项仅校验其字段/核销结构，不因就绪就自动启用商品提成或重算历史。完成授权迁移后重新运行本检查并重启后端释放结构缓存，再按T22执行业务验收。检查期间避免并发DDL；只读RR不能保证多个元数据查询构成跨DDL原子快照。

正式回归：`ENV_FILE=test/missing-unit-env RUN_DB_TESTS=false node --test backend/test/accessory-release-schema.check.js`，覆盖真实预览契约形状、单条/数组DDL、依赖拒绝、错误脱敏、禁止写入口及回滚失败。云端只读结果是某一时刻的结构证据，不是迁移执行记录，实测统一记录T22。

### T22 本批结构迁移顺序

本节是既有专项脚本的执行方案，不是新增批量迁移入口或执行授权；各字段定义、SQL及回退校验仍以原脚本和对应正文为准。当前目标只取后端实际环境配置的云库，不把凭据复制到命令或文档；执行前重新预览，若实际目标或结构与已确认范围不同则停止核对。云端实际就绪情况和执行结果只登记T22。

| 顺序 | 既有命令（默认只读预览） | 应用范围及依赖 |
| --- | --- | --- |
| 1 | `npm --prefix backend run migrate:accessory-stock-in-requests` | 原采购表加可空`request_key/request_hash`及请求唯一索引；旧单不补造请求 |
| 2 | `npm --prefix backend run migrate:accessory-purchase-snapshots` | 原采购表加可空`product_snapshot JSON`；旧单不回填当前名称 |
| 前置核对 | `npm --prefix backend run migrate:sales-checkout` | 共同订单/明细及收款关联必须就绪；已经匹配则不重复应用 |
| 3 | `npm --prefix backend run migrate:customer-points-ledger` | 新建`customer_points_entries/customer_points_allocations`；不改旧积分余额或补造来源 |
| 4 | `npm --prefix backend run migrate:customer-points-aftersales` | 第3项完成后先重新预览，核对新建`customer_points_aftersales`；前置缺失仍为blocked，不能跳过校验执行 |
| 5 | `npm --prefix backend run migrate:accessory-inventory-returns` | 原库存流水加返库事件及`source_event_id/return_key/return_hash`与索引；保留原库存数量及事件 |
| 6 | `npm --prefix backend run migrate:sales-aftersales` | 前置共同结算就绪后，新建`sales_aftersales/sales_aftersale_items/sales_goods_exchanges`；原销售及收款不改写。已安装旧版时只允许脚本已定义的原地扩展，超出已确认范围须先核对 |
| 7 | `npm --prefix backend run migrate:salary-goods-commission` | 原工资模板加可空`goods_commission_rule JSON`，不生成配置或重算历史 |
| 8 | `npm --prefix backend run migrate:salary-goods-settlement` | 原工资记录加可空`goods_commission_snapshot JSON`并新建`salary_goods_settlements`；父键类型读取元数据，保留原工资金额及发放事实 |
| 9 | `npm --prefix backend run migrate:film-services` | 新建`customer_film_services`并在商品类型加`film_enabled`，默认0；不按名称自动启用贴膜或补造服务 |

实际应用在该项原命令后追加`-- --apply --backup-file=<本批独占备份文件>`，逐项顺序执行、逐项回读，不并行运行依赖迁移。每一项使用新的文件名；不复用或覆盖之前的备份。脚本的0600 JSON备份有的只含原表摘要和结构，**不能代替完整可恢复数据库备份**。先确认相关采购、销售、售后、贴膜和工资写入已暂停，保留完整备份，再应用已获明确授权的范围；不存在可恢复备份时不执行DDL。

MySQL DDL会隐式提交，不能把这9项包成可整体回滚的业务事务。任一项失败即停止后续应用，保留原备份和已完成结构，重新只读检查实际落点后按原脚本补缺；不自动反向删表、恢复覆盖或重复创建。单项`--rollback`只在既有脚本允许的未使用结构上执行，且须另行明确回退授权和备份；一旦有积分、售后、核销或贴膜历史就保留追加凭据，不能为回退应用抹除历史。

完成后重新运行`check:accessory-release-schema`，要求10项均ready且退出0，再按已确认维护窗口重启后端清除结构缓存。该结果只表示本批结构就绪；积分期初及兑换数值、贴膜类型启用、提成规则、动作/字段权限和实际交易验收仍需分别核对，不自动授予权限或执行测试交易。待确认的采购退供资金、贴膜撤销和商品编辑/作废规则不由本批迁移替用户决定。

## 检查入口

- 后端行为及迁移保护：`node --test backend/test/accessory-entry.check.js backend/test/accessory-controller.check.js`。
- 前端模板管理、输入、回显与旧请求保护：`npm --prefix frontend run test:unit -- tests/accessory-entry.spec.ts tests/accessory-management.spec.ts`。
- 类型、字段权限、公共参考入口、后端分层及文档检查按[任务检查矩阵](../guides/CODE_REVIEW_STANDARDS.md#任务检查矩阵)执行，实际结果只登记 T22。
- 本文的脚本/模拟测试不等同于云端 DDL、真实数据库事务、浏览器布局或真机验收。

## SN 入库、库存追踪与总仓设置（2026-11-13）

模板新增/编辑的 `serial_tracking` 开关仅设置入库默认模式，每批入库可独立开启或关闭；同一模板、同一实际品牌允许SN和普通数量库存并存。改变模板默认值不会转换或删除已有实物记录。条形码用于识别商品模板，SN 用于识别每件实物，两者不能互相代替。SN 是字符串，保留前导零和厂商前缀，去首尾空格并统一大写；限100位字母、数字、点、横线、下划线、斜线，首位为字母或数字，全配件范围唯一。

入库第一行顺序为供应商、品牌、商品名称、店铺；商品名称远程检索已有模板，下拉选项仅展示名称，按类型分组并滚动加载，不展示条形码、型号或底部分页栏。选中后第二行的商品类型自动填充、只读；适配品牌、适配型号、单位、状态和预警值不在入库弹窗展示，统一由模板管理。销售价后排列普通入库总数、入库员、SN管理。入库员只读并由服务端从认证身份确定；SN开关保留无文字按钮及无障碍名称。入库隐藏条形码和商品图片（仅模板保留），移除“入库分配”区域和补货售价提示，所有商品本次入库统一进入上方店铺；后台原数量分配契约保留，店间划拨使用独立接口。销售价只读读取模板，不随补货改价。

普通模式手动填写入库总数；SN模式隐藏入库总数，启用即显示录入框，按非空序列号自动计件。支持逐条输入、扫码枪回车续行、现有摄像头扫码、新增一条和每行一个的批量添加。录入SN后仍可直接更换店铺，保留已录入SN；不展示入库店铺/录入数量提示条。提交时全部SN统一归属最终所选店铺，后端同样拒绝同次跨店载荷。后端以校验后的SN条数计算采购数量、金额和加库存，客户端传入的总数不能覆盖SN计数；空列表、重复、非法或超量不能提交，每次最多1000件。普通模式携带SN时拒绝。切换模板前确认清空已录入SN，拒绝则保留草稿。摄像头组件新增配件解析档位，不采用手机SN去前缀/拒绝纯数字的规则，手机默认规则保持原契约。

采购单、门店库存、逐件SN、成本快照和入库事件使用同一事务；任一重复SN或写入失败整单回滚。SN销售/赠送校验实物所属门店和在库状态，锁定库存及SN，原子扣库并记录客户、操作员、原采购来源及逐件成本。正式销售/赠送仅经共同结算，旧`POST /accessories/sell`与`/accessories/gift`已移除（返回404）；内部`issueSale`沿用外层事务且不独立提交。赠送单独要求 `accessories:gift`，不因有入库权限而获得赠送能力。零售单卖、手机搭售、积分及商品退货已接入共同结算/售后入口；手机售后、换货和工资界面已接入代码，本批结构已迁移回读，真实业务验收仍按T22推进。

| 接口 | 权限和行为 |
| --- | --- |
| `GET /api/accessories/settings` | `accessories-catalog:view`；门店字段必须可见，返回 `warehouse_store_id` 和授权范围内启用 `stores` |
| `PUT /api/accessories/settings` | `accessories-catalog:edit`；仅接受 `warehouse_store_id`，允许任意授权启用门店或 `null` 清空；隐藏门店字段拒绝写入 |
| `GET /api/accessories/options` | 额外返回 `default_store_id`，总仓不在可选门店时返回 `null`；隐藏门店字段清空默认值 |
| `GET /api/accessories/:id/stock` | `accessories:view`；按实际认证门店范围汇总，返回店铺、剩余量、`serial_quantity`和`plain_quantity`，遵守数量/SN/门店字段遮蔽 |
| `GET /api/accessories/:id/serials` | `accessories:view` 且SN字段可见；分页检索实物、店铺、采购来源、销售/赠送及客户明细 |
| `GET /api/accessories/serials/:serialNumber` | `accessories:view` 且SN字段可见；仅查询授权门店实物的追踪事件 |
| `POST /api/sales/checkout` | 独立/随手机销售和赠送均使用共同结算；逐行校验`accessories:create/gift`，同事务保存库存/SN、共同单、收款、积分和提成凭据 |

总仓配置复用公共 `settings` 表，唯一键 `accessory_warehouse_store_id`，不新增设置表。新入库优先使用可选总仓，其次当前用户店铺、最后首个可用店铺；提交前可人工另选店铺。修改总仓不搬移现有库存。库存列表“剩余”可点击，详情展示授权店铺余量及SN明细，普通数量商品也可查看位置。

### SN 迁移与验证边界

`npm --prefix backend run migrate:accessory-serials` 默认只预览；显式 `-- --apply --backup-file=<受控备份路径>` 执行前备份并检查原表字段逐值不变。新增 `accessories.serial_tracking`、`accessory_sales.sale_type` 和两张SN表；回退有SN记录、已启用模板或赠送记录时拒绝，不能删除追踪历史。正式脚本及回归测试必须保留。

2026-11-12 已在当前配置所连云端执行并返回 `migrated_and_verified`。备份位于 `backend/backups/.migrations/accessory-serials-20261112/before.json`，目录0700/文件0600，不提交、不展示内容。2026-11-13 使用同连接会话临时表验证真实入库、重复SN回滚、销售/赠送、逐件成本及扣库，结束删除临时表并回读六张正式表行数不变；未创建真实业务交易。该验证不替代独立测试库的并发/外键集成验收或实物扫码、登录整页验收。


## 店间划拨与混合库存（2026-11-13）

库存查询操作区新增“划拨”，普通模板页不提供该动作。一次确认即完成来源店减库、接收店加库；支持整批或部分移动，两个店铺都必须在操作者授权范围内且启用。原采购单、供应商、入库人及采购日期不改写，不形成销售或重复采购，门店 `total_in/total_out` 不增加。

- `POST /api/accessories/transfer` 使用独立 `accessories:transfer`，前端 `v-permission` 和 `usePagePermissions` 与后端统一守卫一致。入库/编辑权限不能替代。
- 请求包括 `accessory_id`、`from_store_id`、`to_store_id`、`quantity`、32位小写十六进制 `request_key`，可选 `serial_numbers`、`remarks`。操作者取认证身份。普通模式只移动无SN库存；SN模式选中具体在库实物，前端按选择数计量，后端要求SN数等于划拨数。
- `GET /api/accessories/:id/transfers` 使用 `accessories:view`，门店字段必须可见，分页展示双店均在授权范围内的划拨单。详情记录单号、双店、数量、SN、操作员、北京时间和备注；字段权限逐项遮蔽。SN追踪额外返回 `transfers`，不改原事件字段。
- 同一事务按现有采购/销售入口锁根模板、库存与SN。普通可用量为门店剩余减在库SN数，使用当前锁定读核对，避免无SN销售、赠送或划拨扣走SN实物。SN出库始终校验实际商品、门店及在库状态，与模板默认开关无关。混合单据按模式分别办理，不允许用不完整SN列表代表整批出库。
- 划拨表单查询库存时传 `include_variants=false`，只取当前实际商品，避免根模板商品混入其他品牌的数量；详情默认仍汇总所属品牌库存。划拨只更新SN位置与更新时间，保留采购单及逐件成本。日志、SN或库存写入失败整体回滚。相同请求标识与相同内容重试返回原单；变更内容返回409，不重复扣库。

### 划拨表迁移

新增一张 `accessory_transfers` 表，配件专用表总数由九张变为十张。`request_key` 唯一索引用于持久幂等，保存请求摘要、商品、双店、数量、SN列表、认证操作员和时间。混合库存复用原SN表关联，不额外新增商品或库存表。

```bash
# 在backend目录执行；默认仅预览
npm run migrate:accessory-transfers
npm run migrate:accessory-transfers -- --apply --backup-file=backups/.migrations/accessory-transfers-20261113/before.json
```

迁移先落盘原六张业务表结构和内容摘要，目录0700、文件0600；新增后核对原数据不变。存在划拨记录时拒绝回退；空表回退同样要求新备份路径和显式 `--rollback --apply`。2026-11-13已在当前环境云端执行，返回 `migrated_and_verified`、`originalDataUnchanged:true`，未创建真实采购、销售或划拨记录。通过公共模块注册服务定向同步划拨能力，普通角色既有授权保持不变。


### 模板预警值

`accessories.min_stock` 为模板预警的唯一设置，整数0至9999，默认5，允许0。模板新增/编辑提交并保存，实际品牌商品读取根模板值；修改后库存查询和预警接口即时读取模板，原采购、销售及门店累计不变。采购入库不展示或提交预警值，服务端补货忽略客户端阈值，读取锁定模板；首次同时建商品时按建档校验。旧门店 `accessory_stock.min_stock` 仅保留兼容和初始化值，不由补货覆盖。未指定预警查询阈值时使用模板值；显式查询阈值仅作用于本次筛选。

新增字段使用 `npm --prefix backend run migrate:accessory-template-warning` 默认预览，追加 `-- --apply --backup-file=<受控备份路径>` 才执行。2026-11-13已在云端执行，备份为 `backend/backups/.migrations/accessory-template-warning-20261113/before.json`，保存原商品完整资料/结构，目录0700、文件0600；返回 `migrated_and_verified` 并核对旧字段逐值不变。字段无损新增默认5，旧门店原阈值不删除；旧门店设置尚未回填到模板，需在模板中按业务核对。应用回退保留该字段和已保存配置，不通过删除字段丢弃用户设置。


## 批次库存流水与入库用途（2026-11-13）

采购入库新增 `usage_type`，`sale` 为收费、`gift` 为赠送，旧客户端省略时默认收费。它属于本次采购批次，切换模板不覆盖；模板新增/编辑不展示或提交。入库表单使用原公共四列布局和字段权限 `basic_info.usage_type`，隐藏用途时禁止入库，后端写入同样拒绝越权字段。备注仅接受文本，最多1000字。该字段保存于批次入库事件，不另复制到模板或供应商。

新增追加表 `accessory_inventory_events`：保存实际商品、当前门店、原 `stock_in_id`、单位采购成本、用途、SN/数量模式、事件、数量增减及认证操作员/北京时间；出库关联 `sale_id`，划拨关联 `transfer_id`。事件为 `stock_in / legacy_opening / transfer_out / transfer_in / sale / gift`。新入库采购单、门店加库、SN和数量流水同事务提交；划拨追加双店负/正事件，保留原采购、成本及用途，不重复形成应付。

普通数量库存按原采购时间/批次先进先出；指定SN按其真实采购来源及逐件成本分配，不能占用普通库存或其他SN批次。销售成本为各分配数量乘实际进价合计，销售记录 `purchase_cost` 为本次总成本，利润为成交总额减总成本；不读取商品主档最新进价倒算。收费出售不能消耗赠送用途库存；收费或历史未分类库存转赠送必须有原因，且仍经过原独立赠送权限。原有出库接口尚未接入结算前积分、共同订单或工资提成，不能视作完整零售闭环。

事务先锁根模板、门店库存和SN，流水余额使用当前锁定读，避免默认可重复读隔离级别下，等待根模板锁之前建立的旧快照漏掉其他请求已提交事件。保留零余额批次，用于区分从未接续与已经清空；已有流水与汇总不一致时返回 `409 INVENTORY_LEDGER_CONFLICT` 并整单回滚，不自动补差。

### 历史库存接续

只读核对发现旧采购合计与现存量不能直接对应，不能按旧入库单反推剩余批次。迁移不回填真实期初、不改数量。首次涉及该商品门店的入库/划拨/出库时，在同一事务按锁定现存量追加 `legacy_opening`：普通量来源和成本为NULL、用途 `unclassified`；SN只保留已有可核对采购关联及逐件成本。汇总少于在库SN数时拒绝操作，包含汇总为零的异常情况。

历史普通商品仍可流转，未知成本在后续划拨/出库保持NULL；若同一次出库混有未知成本，本次总成本及利润均为NULL，不按0成本计算，也不猜测最新进价。调用方展示和提成必须识别“待核对成本”。历史来源核对和调整仍属于 T22.10，不补造供应商应付。库存详情另提供下述只读批次余额，不把原采购数量当成剩余库存。

### 当前批次库存查询

`GET /api/accessories/:id/batches` 沿用 `accessories:view`，只读返回该库存商品，或模板及其实际品牌商品，在授权门店中的正余额。接受 `page/page_size`（默认1/20，最大页大小100）及可选 `store_id`，拒绝其他参数、越权门店和非整数输入。前置库存流水/SN结构缺失返回409，不在请求内迁移。

`AccessoryService → AccessoryInventoryRepository` 在同连接只读 REPEATABLE READ 事务内核对商品、门店汇总、批次余额及在库SN总数，再读取总数与分页；读取结束回滚释放快照，不加库存写锁、不调用 `ensureBalance`，也不追加 `legacy_opening`。批次身份继续为“实际商品＋当前门店＋原入库单＋原成本＋用途＋SN方式”。保留零余额参加核对，列表只展示正余额；负批次、余额/门店或SN总数不符、采购来源关联丢失及无门店汇总的孤立流水拒绝返回，须人工核对差异。

响应 `data/pagination`，行含稳定 `row_key`、实际商品ID、当前门店、实际品牌/厂家型号、原批次号、原供应商、原采购单价、用途、管理方式、剩余数量、原入库时间及入库员。来源标记 `source_status=purchase/legacy/untracked` 分别表示已关联采购、已接续但来源待核对、尚无流水的历史现存量。历史未知成本保持NULL；未接续行不猜测SN/普通构成、用途、供应商或采购日期，不使用商品主档最新成本/供应商倒填。原采购内部ID不透传。供应商名称按采购快照优先、旧单才取原关联当前名称，品牌名称仍沿用商品原关联；采购金额与日期来自原入库事实，后续采购退货须另核原单及可退数量，不能直接以本列表作为退供授权。

控制器复用严格公共 `FieldAccessService`。门店或数量隐藏时整个查询拒绝，防止分页/正余额行反推；其他字段沿用配件字段映射递归脱敏，原进价、供应商、批次号、用途、SN方式、品牌、型号、时间及人员各自受控。来源核对标记只表达流水完整性，不授予成本或供应商资料权限。

前端 `AccessoryBatchStock.vue` 嵌入原配件详情，使用公共表格、编号、分页、Loading、错误重试及手机双击 `RecordDetailDialog`。切商品、字段授权变化、撤权或卸载取消旧请求并清除原明细；末页因库存变化消失时重读有效页。请求无缓存，不新增路由/权限模块/数据库表，不自动调整库存或采购应付。

正式专项：`ENV_FILE=test/missing-unit-env RUN_DB_TESTS=false node --test backend/test/accessory-batch-stock.check.js`；`npm --prefix frontend run test:unit -- tests/accessory-batch-stock.spec.ts`。SQL契约及同连接替身不能替代真实MySQL快照、云端历史数据或真机验收，执行证据与未完成项统一在T22。

### 库存流水表迁移

在 `backend` 目录执行：

```bash
npm run migrate:accessory-inventory-events
npm run migrate:accessory-inventory-events -- --apply --backup-file=backups/.migrations/accessory-inventory-events-20261113/before.json
```

默认预览不写入；显式执行先保存原八张业务表结构、行数和内容摘要，再创建流水表并检查原数据不变。备份目录0700、文件0600，不输出内容或提交。2026-11-13已在当前配置所连云端执行，返回 `migrated_and_verified / originalDataUnchanged:true`；重复预览返回 `already_ready`。没有写入真实业务事件或修改原库存。

发布必须先执行迁移，再启用依赖该表的后端版本；运行时请求不自动建表。回退脚本使用新的备份路径并显式 `--rollback --apply`，仅空流水表可删除；已有任何事件立即拒绝。已有事件时保留表和追溯事实，应用回退须停止旧版本库存写入，避免绕过流水形成账实差异。

正式回归入口为 `backend/test/accessory-inventory-events.check.js` 与 `backend/test/accessory-inventory-migration.check.js`，覆盖FIFO、逐件成本、用途隔离、旧量接续、零余额、失败回滚、备份及回退保护。完整实测证据统一登记 T22，不把临时表SQL或默认跳过的数据库用例称为独立库并发验收。

商品共同结算抵扣时，成交单价保留原价，销售总额/毛利为抵扣后净额；商品查询增加 `points_used/deduction_amount`，旧无共同快照记录为NULL，有快照但无抵扣字段为0。数量、单价及总价隐藏时同时遮蔽这两个衍生字段。积分试算/消费与原单分组详见[积分规范](../guides/customer-points-standard.md)。

## 商品原批次返库事务基础

`AccessoryService.returnSaleStock` 是供售后调用的内部事务能力，不独立开放HTTP接口。[商品原单退货](../guides/sales-transfer-transaction-standards.md#商品原单退货)已在同一事务接入原单/权限校验、退款/补款确认、积分与返库凭据；本方法不提交事务，不删除或改写原商品销售。手机返库、换货与工资冲回仍待接入，共同手机单旧退库保护继续保留。仓库 `total_out` 显示“累计出库”，包括赠送，返库不抹掉累计出库，也不增加采购 `total_in`。

普通商品按原销售出库事件的分配顺序逐批返还，保留 `stock_in_id`、采购成本、收费/赠送用途及数量/SN方式。原收费库存转赠送后退回仍是原收费用途；历史未知成本仍为NULL。原数量/成本与批次不守恒、缺流水、重复/超额退回或接收店汇总漂移返回409，不按当前模板进价或旧采购单猜测返库。停用模板仍允许核对原单返还，不因此重新开放销售。

SN必须仍属于原销售且为 `sold/gifted`；按其真实采购来源返还，恢复 `in_stock` 并清除当前 `sale_id`、保存接收店，追加 `return` SN事件关联原销售。原事件保留；已退回或再次销售的SN不能再次退旧单。内部能力允许选择授权且启用的接收门店，原销售门店也必须在服务端授权范围内；不改变跨店贴膜等业务规则。

库存汇总只增加可用 `quantity`，不增加采购 `total_in`、不抹除累计 `total_out`，不形成新采购应付。退回数量可从返库事件核对；重新销售或划拨继续复用原库存流水及FIFO。原商品、根模板、销售、门店汇总和SN按统一连接锁定，重复请求返回原回执，不因后续别笔退货改变原回执的剩余量；任何后段资金/积分/日志错误均须外层回滚，不能只提交返库。

在原 `accessory_inventory_events` 扩展 `sale_return/gift_return`，新增三个可空字段：`source_event_id` 指向原负数出库事件，`return_key`/`return_hash` 保存本次售后分项的请求标识及参数摘要。按原事件与请求键建立唯一索引并按原事件建查询索引；键使用区分大小写的ASCII规则。返库写正数数量，同一原出库累计不得超过原数量；保留所有旧事件，不另建一套库存。完整售后单据后续通过分项请求标识关联，不允许客户端脱离售后单单独改库存。

```bash
npm --prefix backend run migrate:accessory-inventory-returns
npm --prefix backend run migrate:accessory-inventory-returns -- --apply --backup-file=backups/.migrations/accessory-inventory-returns/before.json
npm --prefix backend run migrate:accessory-inventory-returns -- --rollback
```

前置为原批次流水已迁移。默认预览零写入，实际执行先暂停库存写入、取得目标授权和完整备份；脚本独占保存0600结构/原七表摘要文件，以一次ALTER扩展原表并回读核验，摘要不替代完整备份。有返库事件或任一新增字段已保存凭据时禁止回退；空扩展回退仍须 `--apply --backup-file=...`。原批次迁移检查兼容已升级枚举，不按旧版覆盖。迁移后重启后端清理公共结构缓存；2026-11-14已授权apply并回读，实际执行与待验边界统一登记T22。

正式测试为 `node --test backend/test/accessory-returns.check.js backend/test/accessory-return-migration.check.js`。覆盖实际出库后分次返还、跨授权门店、原成本/用途、SN再次销售保护、请求幂等、库存与退款/积分同连接失败回滚、超额/损坏拒绝及迁移/回退。事务SQL替身与串行竞争模拟不替代真实数据库多连接、整页或真机验收。

### 整单原成交明细

商品销售详情新增“整单明细”，与手机销售详情共用只读组件。对应接口 `GET /query/goods/:id/order`、`GET /query/sales/:saleId/order`，复用本域QueryGoods链、同连接只读快照及双模块查看权限。完整读取原共同单；原手机/商品客户、门店、销售员工和金额不一致时拒绝，原交易全退后仍可查看原记录。商品SN/用途/积分及现金入账分别展示，不并入后续换货或退款。字段按手机/商品分别严格脱敏、共享头取交集、隐藏资金合计保护及正式回归见[整单明细](../business/sales-receipt-standard.md#整单明细)。无需新增表或迁移，已有共同结算结构未升级的云端不因本查询接入自动可用。
