# 字段统一迁移进度

更新时间：2026-08-28

### 2026-08-28 供应商打款备注与时间展示

- 付款备注统一为 `payment_remarks`，前端表单、后端请求校验、控制器、服务和 `phones.payment_remarks` 物理字段保持一致，不再使用通用 `remarks` 入口。
- 单个打款、批量打款和编辑打款均支持备注；取消打款会清空备注；批次详情和导出包含付款备注。
- 打款日期控件和批次详情默认显示 `YYYY-MM-DD`；悬停/点击日期可通过统一 tooltip 查看完整 `YYYY-MM-DD HH:mm:ss`。
- 已通过付款页面 ESLint、全量类型检查、字段一致性审计和生产构建；真实数据库写入回归仍需在可用数据库环境执行。

### 2026-08-28 模拟数据与伪回退清理

- 移除营销天气缺失时的“天气正常/天气不错”回退；没有真实天气结果时保持空值，页面仅显示不可用状态。
- 移除库存页用当前分页结果冒充全量统计的回退；复杂筛选或统计接口失败时不再展示伪造的库存总数和金额。
- 移除 H5 首页推荐的随机商品补齐配置、文案和接口字段；首页只展示后台明确选择且仍有效的商品。
- 移除系统设置中的公司名称、域名、备案号、电话、地址和邮箱样例占位符，避免误提交示例业务资料。
- 删除 analytics 路由对旧 `limit` 和驼峰查询参数的读取；规范参数契约测试已通过，真实数据库业务回归仍待服务可用后执行。

## 迁移策略

当前采用分阶段迁移：

1. 前端请求和 API 入参先统一为规范字段。
2. 后端在边界层把规范字段映射到现有数据库物理列。
3. 每个模块完成后增加字段契约和回归测试。
4. 每组物理列完成全站 SQL 收敛和真实数据库核验后，再执行数据库物理列重命名。

因此，规范字段与数据库字段目前不一定同名。数据库重命名必须在全站 SQL、报表、导入导出和历史数据验证完成后执行。

## 当前决策：已完成已知历史物理字段迁移

截至 2026-08-27，已登记的历史物理字段已经完成改名并通过云端数据库核验。后续未知字段仍必须先完成只读盘点，禁止凭接口旧字段名称直接改数据库列。当前允许：

- 新增和修改 API 使用规范字段。
- 前端请求使用规范字段。
- 后端边界层保留已登记的短期兼容映射。
- 通过 `backend/scripts/check-physical-field-contract.js` 做只读物理字段审计。
- 新增字段契约、审计规则和回归测试。

每次新增物理迁移仍必须满足下面全部条件：

- 所有 CRUD 模块都已登记字段契约。
- 查询、统计、报表、导入导出和同步服务已完成规范字段收敛。
- 全站 SQL 扫描不再发现业务代码直接依赖待迁移旧列，边界映射除外。
- 真实数据库回归测试、备份恢复演练和回滚脚本均已通过。
- 单独确认迁移窗口，并记录迁移前后的数据量和校验结果。

迁移只执行列改名，不删除数据；执行前必须有备份，执行后必须核对行数、空值和金额/关键字段汇总。

## 当前状态

### 2026-08-27 全库物理字段核验

- 已连接备份对应的云端 `TF2025` 数据库执行只读 `SHOW TABLES`/`SHOW COLUMNS` 核验。
- 已知候选旧物理列 `purchase_price`、`selling_price`、`stock_in_date`、`sale_date`、`salestime`、`Inventorytime`、`price`、`cost`、`purchase_date`、`inbound_date` 均为 0 个；全库大写/驼峰物理列为 0 个。
- `phones`、`sales` 和配件表的物理列改名已完成；已有行数、空值和金额汇总核对记录见 `config/field-contracts.json`。
- `price_history.cost_price` 明确保留：它是 `price_list` 的独立价格历史字段，不等同于 `phones.purchase_cost`，不属于待迁移旧列。
- 本次没有发现可安全继续执行的数据库改名项；剩余工作是 API 兼容边界的调用方迁移、真实业务回归和后续按条件移除兼容字段。

| 模块 | API/前端请求 | 数据库物理字段 | 状态 |
| --- | --- | --- | --- |
| 预定 `preorders` | 页面、API 和路由统一使用 `page_size`、`start_date`、`end_date` 及规范状态值；创建、编辑、匹配、交付响应均使用 snake_case | 云端表共 30 个规范列，旧物理列为 0；请求阶段只读校验结构，不再执行运行时迁移 | 已完成真实库只读字段、状态分布、客户/商品关联、日期筛选和规范分页验证，运行时兼容字段为 0；登录态创建、匹配、交付、取消和权限按钮仍待服务回归 |
| 数据检查 `data-check` | 页面、API、控制器和服务统一使用 snake_case；合并请求使用 `primary_id/duplicate_ids/merge_groups`，检查结果使用 `duplicate_groups/duplicate_count/is_duplicate_rows/is_empty`，页面分页使用 `page/page_size` | 不涉及数据库物理字段改名；控制器已移除驼峰入口兼容，数据库错误不再伪装为空数据成功 | 已完成 8 张真实表只读计数和重复分组验证，共 10192 条；客户存在 2 个重复组，其余检查项为 0，写操作为 0；登录态检查及人工确认后的合并、删除、清理仍待回归 |
| 客户 `customers` | 客户列表、筛选、统计和消费记录统一使用 snake_case；分页统一为 `page_size`、`total_pages`、`has_next`、`has_prev`，消费记录以 `sales.purchase_cost/sale_price/sale_time` 为历史事实来源 | 客户表和销售表物理列均为规范 snake_case，旧物理列为 0 | 已完成 9896 个客户、15471 条客户销售的真实库只读验证，关联缺失 0、规范分页重叠 0；79 条历史销售金额为 `NULL`，保持原值不伪造为 0；9 个历史 API 字段已退役，运行时兼容为 0；登录态增删改、导出和权限仍待回归 |
| 维修 `repairs` | 页面、API 和路由统一使用规范表单、筛选、统计及 `page/page_size/total/total_pages/has_next/has_prev` 字段；页面使用服务端分页，不再用旧字段参与业务计算 | 云端表共 17 个 snake_case 列，旧 `brand/model/repair_cost/fault_description/remark` 物理列为 0；请求阶段只读校验结构，不再建表、改表或回填数据 | 已完成真实库只读字段、1 条历史记录、关联完整性、状态/搜索筛选和规范分页验证，运行时兼容字段为 0；历史记录缺少型号和故障描述，保持原值不补造；登录态增删改、状态流转和权限按钮待服务回归 |
| 门店 `stores` | 分页响应统一为 `page_size`、`total_pages`、`has_next`、`has_prev`；表单负责人统一为 `manager_id`；统计使用 `with_manager` | 门店表物理字段保持 `location`，仅在后端映射为 API `address` | 页面、路由、字段契约和只读真实数据库分页/状态筛选已完成；登录态增删改、导出和批量排序待服务启动后回归 |
| 待办 `reminders` | 页面、路由和服务选项统一为 `page_size`、`type_id`、`user_id`、`can_manage`；响应重复规则统一为 `repeat_type`、`interval_value`、`weekdays_json`、`occurrence_limit`，分页补齐 `total_pages`、`has_next`、`has_prev`；统计、筛选、主表、表单、详情、执行记录、类型管理和全局提醒已接入字段权限 | 待办物理字段保持 `repeat_rule` JSON 存储，API 通过显式序列化转换；所有查询已移除 `SELECT *`；后端对隐藏字段响应遮罩并拒绝隐藏筛选和写入 | 已完成真实库只读验证：显式列、状态过滤和规范分页均通过，`limit/totalPages` 已退役，运行时兼容字段为 0；本轮未执行真实写入，登录态创建、编辑、待办处理和人员可见范围仍待回归 |
| 员工 `employees` | 页面、类型和接口分页统一为 `page_size`、`total_pages`、`has_next`、`has_prev`；角色请求/响应统一为 `role_ids` 数组和 `role_names`，确认密码表单字段使用 `confirm_password` | 真实 `users` 表无 `role` 物理列，角色只通过 `user_roles -> roles` 关联；员工查询使用显式公开列 | 已完成真实库只读验证：状态筛选、角色关联完整性、规范分页和密码不泄漏均通过；`limit/current/pageSize/pages/role_id/confirmPassword` 已退役，运行时兼容字段为 0；登录态增删改、导出和大于 100 条的服务端分页仍待回归 |
| 品牌 `brands` | 页面、共享选项调用方及后端链统一使用 `page_size`、`total_pages`、`has_next`、`has_prev`；查询使用显式列 | 品牌表物理字段已是规范 snake_case，不执行改名 | 已完成真实库只读字段、状态/名称筛选、建议搜索和分页验证；`limit/pages` 已退役，登录态增删改和批量排序待回归 |
| 型号 `models` | 页面、库存远程搜索及共享选项调用方统一使用 `page_size`、`name`、`sort_by`、`sort_order`；响应使用显式字段和 `total_pages/has_next/has_prev` | 真实表只有 7 个规范列，不存在 `series/is_active`，不执行改名 | 已完成真实库字段、品牌关联、状态/名称筛选、排序和分页验证；6 个历史字段已退役，登录态写入和批量排序待回归 |
| 颜色 `colors` | 页面、共享选项调用方和路由统一使用 `name/status/page_size/sort_by/sort_order`；响应使用显式字段和 `total_pages/has_next/has_prev` | 真实表只有 `id/name/status/sort_order/created_at/updated_at`，不存在品牌、分类、高端标记、启用别名或色值列 | 已完成真实库字段、状态/名称筛选、排序和分页只读验证；11 个历史或错误字段已退役，登录态写入和批量排序待回归 |
| 内存 `memories` | 页面、共享选项调用方和路由统一使用 `size/status/page_size/sort_by/sort_order`；响应只保留真实列、可确定解析字段和规范分页/统计字段 | 真实表只有 `id/size/status/sort_order/created_at/updated_at`；`storage_size/storage_unit/is_combo` 由 `size` 确定性解析，不是物理列 | 已完成真实库字段、规格格式、状态/规格筛选、排序和分页只读验证；14 个历史或伪造字段已退役，登录态写入和批量排序待回归 |
| 供应商 `suppliers` | 管理页及入库、查询、库存、配件入库、批发和统计调用方统一使用 `page_size`；列表/详情响应使用显式字段及 `total_pages/has_next/has_prev`，详情成本为真实关联汇总 | 真实表 12 个字段已全部为 snake_case；不存在 `supplier_accounts`，不执行物理改名或伪造账户流水 | 已完成 39 条真实数据的只读字段、名称/状态筛选、排序、分页和关联成本汇总验证，写操作为 0；`limit/pages/totalPages/hasNextPage/hasPrevPage/accounts` 已退役，登录态增删改、批量排序、导出和权限待服务启动后回归 |
| 供应商付款 `supplier-payments` | `frontend/src/views/payments/SupplierPhonePaymentsView.vue`；统计、汇总、手机列表、导出、批次详情、打款、取消和编辑接口统一使用 `supplier_id`、`store_id`、`payment_status`、`sale_status`、`start_date`、`end_date`、`page_size`、`inventory_time`、`sale_time`、`total_pages`、`has_next`、`has_prev` | 供应商付款基于 `phones` 真实字段 `supplier_id`、`store_id`、`purchase_cost`、`sale_price`、`inventory_time`、`sale_time`、`payment_status`、`payment_time`、`payment_method`、`payment_operator_id`；不再读取 `purchase_date` | 此前只读核验已确认真实列和数据分布，写操作为 0；本轮完整服务回归因数据库连接 `ETIMEDOUT` 标记为待复验，不能视为本轮已完成；`limit`、`totalPages`、`hasNextPage`、`hasPrevPage`、`purchase_date` 已退役；登录态打款、取消、编辑、导出和权限回归待服务启动后执行 |
| 考勤 `attendance` | 涉及 `AttendanceView.vue`、工资页共享考勤调用、API、路由、控制器、服务和仓储；列表、详情、统计、仪表盘、待审批、休假余额、休假配置及写入接口已统一 snake_case，分页使用 `page_size/total_pages/has_next/has_prev`；主模块“查看”代表全员范围，“我的考勤”代表本人范围，全局管理员可看全员 | 真实 `attendance_records` 共 17 个规范列，类型仅为 `leave/overtime/monthly_leave`；不存在 `absent_days/absent_reason`，不执行物理改名；仪表盘费用只使用真实工资模板，不再用固定金额回退 | 已完成真实库只读列、类型/状态分布、员工+日期+类型+状态筛选和分页验证，写操作为 0；普通用户强制本人、管理员全员及工资本人仅看已发放由契约测试覆盖；登录态页面操作仍待服务启动后回归 |
| 国补 `subsidy` | 国补主页、桌面列表、移动卡片、搜索、统计、批量预览、申请、编辑、详情和照片管理均使用规范字段 ID；身份证、图片、代办人、价格和时间字段可独立隐藏；动作权限独立为 `view/create/edit/delete/approve/arrival/upload/export`；操作列按“字段可见 OR 任一动作获权”展示 | 真实 `national_subsidies` 表 31 个物理列均为 snake_case，无需执行字段改名；列表、详情、统计、筛选选项和导出按字段权限过滤；隐藏图片字段时普通响应不返回照片，拥有 `upload` 的角色通过专用照片接口读取和管理，文件读取仍由 `view/upload` 与字段可见性组合守卫 | 已完成 491 条真实数据只读验证，其中不同办理人记录 165 条，写操作为 0；8 个历史字段已退役，运行时兼容字段为 0；字段/动作权限代码与契约已完成，但本轮未新增真实库写入，仍需用“仅查看、可申请、可审批、可到账、可上传”独立登录角色做端到端回归 |
| H5 订单 `h5-orders` | 后台订单页、`/sales-management/h5-orders` 与 `/shop/orders`、服务层统一使用 `page_size/start_date/end_date/total_pages/has_next/has_prev`；列表和详情只查询真实显式列，状态更新不再写不存在的 `confirmed_by/confirmed_at` | 真实 `H5_orders` 14 列、`H5_order_items` 8 列均为 snake_case，无需执行物理改名；两个入口不再保留 `limit/startDate/endDate` 兼容 | 已完成 16 条订单、16 条明细的真实库只读结构、状态+日期筛选、规范分页和关联完整性验证，孤儿明细 0、写操作 0；3 个历史字段已退役，运行时兼容字段为 0；登录态详情、审核、拒绝、发货、完成、取消、权限和物流信息持久化仍待回归 |
| H5 用户订单 `h5-customer-orders` | `MyOrders.vue`、`OrderQuery.vue`、公开 API、路由和服务统一使用 `customer_phone/customer_name/page_size/total_pages/has_next/has_prev`；响应不再由通用分页助手混入旧键，订单和明细使用显式列 | 复用已验证的 `H5_orders/H5_order_items` 规范物理列，无需执行改名；公开入口不再兼容 `limit` 或泛化查询键 `phone/name` | 已完成 16 条真实订单的身份格式、手机号+姓名精确匹配和规范分页只读验证，样本身份匹配 2 条、写操作 0；3 个历史字段已退役，运行时兼容字段为 0；公开限流、访问令牌、详情跳转及登录态流程仍待端到端回归 |
| 手机编辑 `phones` | 列表、详情、编辑表单和价目表库存详情统一使用 `purchase_cost`、`inventory_time`、`sale_time`、`condition` 等规范字段 | 无运行时兼容字段；历史请求和响应别名已退役 | 页面、接口、物理列迁移和真实数据库核验已完成；旧字段已移除，无后续删除项 |
| 销售编辑 | 使用手机规范 payload | 通过 `phones` 映射层写入 | 已完成入口收敛 |
| 库存编辑 | 使用手机规范 payload | 通过 `phones` 映射层写入 | 已完成入口收敛 |
| 入库 `stock-in` | 创建、编辑、列表、详情、统计、筛选和分页统一使用 `inventory_time/purchase_cost/remarks/payment_status/page_size/total_pages` 等 snake_case 字段；结算状态读取真实付款状态，二手预定匹配使用真实 `is_new` | `stock_in_date/notes/purchase_price` 及旧分页、筛选、统计响应别名已退役，运行时兼容边界为 0；不存在的 `phones.created_at/updated_at` 不再读写 | 2026-08-27 已完成 986 条真实入库记录的物理列、关联、时间排序、IMEI 唯一性和付款状态只读验证，写操作 0；71 条历史记录缺少有效采购成本，保持真实值且不伪造补值；登录态创建、编辑、删除、自动匹配和权限流程待回归 |
| 快速出库 `quick-sale` | 使用规范 ID、成本、时间、销售员、支付方式和支付渠道字段；库存列表响应提供规范成本、时间、机况和分页字段；表单内部状态统一为 `purchase_cost`、`inventory_time`、`sale_time` | `brand/model/color/memory/purchase_price/stock_in_date/sale_date/operator_id/customer_idcard` 仅作为已退役的端点参数，不再进入快速出库处理器；`phones` 物理列已迁移 | 已完成真实库 77 条快速出库记录只读验证：销售关联、基础资料关联、成本售价及操作员均通过，写操作为 0；发现 2 条历史手机销售时间与销售表时间不一致，待人工确认，不自动改历史数据；登录态快速出库提交和权限流程待回归 |
| 综合查询 `query` | 筛选、分页、响应分组、列配置、详情弹窗、单据和退库列表统一使用规范字段；数据库查询失败向上返回错误，不再伪装为空选项 | 手机和销售物理列均已迁移；`limit/purchase_price/Inventorytime/salestime/sale_date` 已退役，运行时兼容为 0 | 2026-08-28 已完成 16232 条手机、15471 条销售及真实门店范围的排序、分页和响应只读验证，孤立销售 0、分页重叠 0、旧响应键 0；历史空金额保持 `NULL`；登录态查询、导出、编辑和权限待回归 |
| 租赁 `rentals` | 合同列表、统计、筛选、客户/设备选项、创建/编辑表单、详情、打印、还款计划和合同附件均接入 `rentals_rentalsview` 字段权限；还款动作归属待付租金列，归还动作归属状态列；请求与分页统一使用 snake_case | 后端按允许字段构造搜索条件，列表/选项/还款响应脱敏，隐藏字段写入返回 `FIELD_PERMISSION_DENIED`；编辑仅动态更新请求中允许的字段；`purchase_cost` 正式纳入租赁字段契约 | 字段权限和静态契约已完成；真实数据库只读物理列此前已验证，本轮未执行登录态创建、编辑、还款、归还或附件写入，标记待验证 |
| 批发/划拨 `wholesale-transfer` | 提交、表单内部计算、记录/统计筛选和分页统一使用 `sale_time/purchase_cost/wholesale_price/supplier_id/page_size/total_pages/has_next/has_prev`；代划拨按业务规则将入库价、销售价和划拨价统一为 0，逐台写入使用行锁和事务保存点；普通批发继续保留进价、售价和利润 | `wholesale_date` 是独立业务时间字段；真实库不存在 `proxy_supplier_id`，供应商关系统一读取 `phones.supplier_id`；5 个历史业务字段已退役；真实权限表仍有 4 条 `sales_salesview` 记录，仅由全局 `permission-mapping.js` 兼容 | 2026-08-27 已通过事务脚本将 231 台代划拨手机的 `purchase_cost/sale_price/wholesale_price` 和 229 条代划拨销售的 `purchase_cost/sale_price` 全部归零并复核；代划拨三项汇总均为 0，关联缺失和金额不一致均为 0；106 条普通批发金额保持 `739178.00/733328.00/5850.00` 不变；权限表迁移和登录态流程仍待回归 |
| 配件 `accessories` | 配件编辑、入库、销售使用显式 payload；金额统一为 `purchase_cost`、`sale_price`；列表和入库记录分页/筛选使用 snake_case | 无运行时兼容字段；历史金额别名和驼峰筛选字段已退役；数据库物理列已改为规范字段 | 物理列改名已完成，迁移前后配件 1 条、入库记录 2 条及金额汇总一致；真实分页、库存金额和历史入库查询回归通过 |
| 工资 `salary-records` / `salary-templates` | 工资记录、模板 CRUD、列表分页、员工模板绑定和销售明细均使用规范字段；分页统一为 `page_size/total_pages/has_next/has_prev`，绑定使用 `template_id`，销售时间使用 `sale_time` | 工资表和关联手机销售时间均使用规范物理列；旧请求、响应别名已退役，运行时兼容边界为 0 | 应用层、契约和物理列迁移已完成；真实工资计算、权限和发放业务回归待完成 |
| 客户 `customers` | 客户购买历史展示和响应统一为 `purchase_cost`、`sale_price`、`sale_time`、`profit`，成交金额和时间读取销售记录，空金额显示 `-` | 销售物理列已迁移；客户模块旧请求和响应字段已全部退役，无兼容边界 | 已完成真实数据库关联、时间、金额空值、分页和排序只读验证；登录态详情、导出和写操作仍待回归 |
| H5 已售商品 `h5-sold-products` | 已售商品列表、共享类型、页面展示和图片排序统一使用 `sale_time/image_ids/page_size/total_pages` 等 snake_case 字段；缺失业务值保持 `null`，排序写入使用事务 | `sale_date/salestime/imageIds` 已退役，运行时兼容边界为 0；手机销售时间物理列已迁移为 `sale_time` | 2026-08-27 已完成 92 个已售有图商品、781 张关联图片、字段完整性和时间排序的真实库只读验证，写操作 0；发现 9 条历史孤儿图片待单独确认清理，登录态查看、重排和删除流程待回归 |
| H5 用户购买记录 `h5-customer-sales` | H5 我的中心购买记录响应、API 类型和页面展示统一使用显式 snake_case 字段及 `sale_time`，缺失值保持 `null` | `sale_date/salestime` 已退役，销售和手机物理列已迁移，不再保留运行时兼容 | 已完成 15471 条客户销售关联、时间完整性和抽样倒序只读验证；当前无有效客户令牌，真实登录态页面回归待执行 |
| 综合预警 `dashboard-warnings` | 综合预警请求统一使用 `phone_threshold`、`threshold`、`page_size`，销售趋势、入库及摘要响应统一使用 `sale_time`、`inventory_time`、`last_inventory_time`、`total_warnings`、`has_warnings` | 11 个旧请求/响应字段已退役，无运行时兼容边界；销售和手机物理列已迁移 | 已完成真实库手机/机型库存预警、销售趋势、今日销售及供应商入库预警只读验证，旧响应键和旧物理列均为 0，写操作为 0；登录态权限和页面刷新待回归 |
| 统计 `analytics` | 销售、销售趋势、库存分析、客户分析、员工分析、考勤摘要及 API 客户端定义统一使用 `start_date`、`end_date`、`page_size`、`store_id`、`supplier_id`、`category_id`、`product_id` | 无运行时兼容字段；旧驼峰和旧分页参数已退役；聚合 SQL 已使用已迁移的规范销售/手机物理列 | 2026-08-28 已移除 analytics 路由旧参数读取，并通过契约测试；真实业务数据库回归待完成 |
| 导入导出 `data-import` | 上传、分析、导入、进度和历史接口统一为 snake_case；分析差异、进度任务和历史记录响应已使用规范字段 | 无运行时 API 兼容字段；旧导入文件列名仅保留在文件解析映射，不进入 API | 应用层字段和契约已收敛；真实登录态导入数据回归待完成 |
| 综合查询 `query` | 筛选参数、响应分组、列表列配置、详情弹窗、单元格显示和单据读取均使用规范字段 | 无运行时兼容字段；`QueryView`、`QueryEditModal` 和 repository 不再读取旧价格/时间键 | 页面、API、服务和仓储字段已收敛并完成真实数据库排序、分页、关联和空值只读验证；登录态业务操作待回归 |
| 销售 `sales` | 拆分后的销售页面、提交、筛选、分页、路由、控制器、服务和仓储统一使用 `purchase_cost/sale_price/inventory_time/sale_time/page_size/start_date/end_date` 等 snake_case 字段 | 10 个历史字段及旧端点参数 `price/date` 已退役，运行时兼容和兼容边界均为 0；物理列已迁移 | 已完成 86 台可售库存及 15471 条销售记录的真实库只读字段、关联、分页和排序验证；登录态销售事务和权限待回归 |

## `phones` 字段映射

| 规范字段 | 当前物理列 | 说明 |
| --- | --- | --- |
| `brand_id` | `brand_id` | 同名 |
| `model_id` | `model_id` | 同名 |
| `color_id` | `color_id` | 同名 |
| `memory_id` | `memory_id` | 同名 |
| `purchase_cost` | `purchase_cost` | 同名 |
| `sale_price` | `sale_price` | 同名 |
| `inventory_time` | `inventory_time` | 已完成物理列改名 |
| `sale_time` | `sale_time` | 已完成物理列改名 |
| `condition` | `is_new` | `new/used` 转换为 `1/0` |
| `purchase_operator_id` | `inventory_operator_id` | API 层映射 |
| `sale_operator_id` | `sale_operator_id` | 同名 |
| `remarks` | `remarks` | 同名 |

## 已登记的字段契约

契约文件：`config/field-contracts.json`（同时登记每个模块的 `auditSources` 审计源文件）

目前已登记：

- `preorders`
- `repairs`
- `phones`
- `stock-in`
- `rentals`
- `quick-sale`
- `wholesale-transfer`
- `accessories`
- `salary-records`
- `analytics`
- `data-import`
- `query`

兼容字段总表见 [字段兼容清单](./field-compatibility-inventory.md)。兼容字段不是永久 API：每个条目都必须保留边界位置和移除前置条件；对应物理字段迁移完成后，按外部调用方迁移情况逐项清零。

审计脚本：`frontend/scripts/check-field-consistency.mjs`

审计现在强制检查：

- 每份契约必须有非空 `canonical` 字段。
- `canonical` 与 `legacy` 不能重复、交叉登记。
- 每份契约必须登记实际参与 CRUD/API 的前后端源文件。
- 登记的源文件必须存在，并且至少引用一个规范字段。
- 旧字段不能重新进入新的前端类型、请求参数或 CRUD 字段白名单。

注意：完成“契约登记”只代表该模块已进入强制审计范围，不代表数据库物理字段或全部响应字段已经迁移完成。状态必须以本表为准。

## 已完成验证

```bash
cd frontend
npm run type-check
npm run check:fields

cd ../backend
npm test
RUN_DB_TESTS=true npm test
```

当前真实数据库回归结果以最近一次 `RUN_DB_TESTS=true npm test` 为准；每轮字段契约变更后必须重新执行并在交付记录中说明结果。

2026-08-27 最近一次结果：106 项通过、0 失败、0 跳过。该结果覆盖当前后端数据库测试集，不代表所有登录态页面人工流程已经验收。

## 本轮页面闭环记录

### 客户分析 `CustomerAnalytics.vue`（2026-08-26）

- 概览请求改用 `start_date`、`end_date`、`store_id`；analytics 后端只接受规范参数。
- 概览、分群、活跃度、高价值客户响应统一使用 snake_case；分页元数据统一为 `page_size`、`total_pages`。
- 修复客户分析带日期/门店筛选时的 SQL 参数顺序和重复绑定风险；高价值客户页码和每页数量增加边界校验。
- 高价值客户列表请求统一构造 `page`、`page_size`、`search`、`start_date`、`end_date`、`store_id`，缓存键同步包含页面筛选条件。
- 员工业绩、库存低库存/最近销售、销售排行和销售预测请求统一使用 `page_size`、`start_date`、`end_date`、`store_id`；旧分页和驼峰参数已退役。
- 后端高价值客户查询的列表与总数查询共用同一组日期、门店和搜索参数；历史 `ER_WRONG_ARGUMENTS` 已改用文本查询并统一参数顺序。
- 增加客户分析响应字段契约和页面审计源；高价值客户接口返回空数据时不再让页面读取未定义分页对象。
- 已验证：`npm run check:fields`、`npm run type-check`、`node --check src/routes/analytics.js`、`node --test test/field-contract.check.js`、`git diff --check` 通过。
- 未验证：真实数据库回归。当前环境连接 `10.2.3.22:3306` 超时，高价值客户实际销售表字段、门店筛选和分页结果仍需现场复测；未以模拟数据替代真实结果。

### 库存分析 `InventoryAnalytics.vue`（2026-08-26）

- 库存概览、预警、周转、供应商统计和最近销售统一使用 `store_id`、`supplier_id` 规范筛选字段；analytics 后端只读取规范参数。
- 修复供应商分析、供应商数量、最近销售和低库存预警未应用供应商/门店筛选的问题；最近销售同步返回 `sale_price`、`sale_date`，预警同步返回 `current_stock`、`reorder_point`、`unit_cost`、`stock_status`。
- 库存预警仓储查询增加可选门店/供应商过滤，使用参数化 SQL；库存页面缓存键包含筛选条件，避免不同筛选复用旧结果。
- 增加 analytics 库存响应字段契约和 `InventoryAnalytics.vue` 审计源，并补充库存筛选/响应字段契约测试。
- 已验证：`npm run check:fields`、`npm run type-check`、`node --check src/routes/analytics.js`、`node --test test/field-contract.check.js`、`git diff --check` 通过。
- 未验证：真实数据库回归。库存分析涉及门店、供应商、预警配置聚合，需在数据库连接恢复后执行真实数据校验。

### 销售分析 `SalesAnalytics.vue`（2026-08-26）

- 销售分析请求统一使用 `start_date`、`end_date`、`store_id`、`supplier_id`；旧驼峰参数已移除，并继续校验日期格式。
- 销售分析响应统一为 `total_sales`、`total_orders`、`average_order_value`、`top_products`、`sales_by_store`、`sales_by_period`、`revenue_forecast`，产品和门店明细不再透传驼峰别名。
- 热销产品查询补齐门店/供应商筛选占位符，避免筛选条件丢失；`/analytics/sales/trends` 与旧 `/analytics/sales-trends` 路径均保留并共用真实查询。
- 同步修复利润分析页读取全新/二手销售统计的联动字段，避免销售接口改为 snake_case 后利润卡片回退为 0。
- 增加销售分析页面审计源、响应字段契约和契约回归测试。
- 已验证：`npm run check:fields`、`npm run type-check`、`node --check src/routes/analytics.js`、`node --test test/field-contract.check.js`、`git diff --check` 通过。
- 未验证：真实数据库回归。当前数据库连接不可用，销售订单/销售记录字段和筛选结果需连接恢复后验证。

### 利润分析 `ProfitAnalytics.vue`（2026-08-26）

- 利润、利润趋势、门店利润、品牌排行和型号排行请求统一使用 `start_date`、`end_date`、`store_id`、`supplier_id`；后端 analytics 边界继续兼容旧驼峰参数。
- 修复利润页多个加载函数仍提交旧参数名的问题，确保日期、门店和供应商筛选一致传递。
- 修复利润页读取全新/二手销售统计的旧响应字段，统一读取 `sales_count`、`sales_amount`、`margin_rate`、`avg_price`。
- 增加利润分析页面审计源、响应字段契约和契约测试。
- 已验证：`npm run check:fields`、`npm run type-check`、`node --check src/routes/analytics.js`、`node --test test/field-contract.check.js`、`git diff --check` 通过。
- 未验证：真实数据库回归。利润数据依赖销售、批发和门店聚合，需数据库连接恢复后验证筛选和金额。

### 员工分析 `EmployeeAnalytics.vue`（2026-08-26）

- 员工详情接口统一读取 `start_date`、`end_date`、`store_id`，并对日期进行格式校验；旧驼峰参数已移除。
- 考勤汇总接口新增日期和门店筛选，摘要、记录和异常列表共用同一组参数化条件，避免页面筛选与统计不一致。
- 移除角色图表失败时的硬编码员工角色数据；无接口数据时展示空状态，不伪装成真实统计。
- 移除员工分析默认趋势、出勤率和变化率的虚假数值，数据缺失时返回 0/稳定状态。
- 增加员工分析页面审计源和字段契约测试。
- 已验证：`npm run check:fields`、`npm run type-check`、`node --check src/routes/analytics.js`、`node --test test/field-contract.check.js`、`git diff --check` 通过。
- 未验证：真实数据库回归。员工工资快照和考勤聚合需连接恢复后验证。

### 划拨/批发分析 `TransferAnalytics.vue`（2026-08-26）

- 当前月份和上月对比请求统一使用 `start_date`、`end_date`、`store_id`；修复上月请求遗漏门店筛选导致环比数据混店的问题。
- `/analytics/transfers-and-allocations` 响应统一为 `transfer_count`、`allocation_count`、`wholesale_amount`、`wholesale_product_ranks`、`store_distribution`、`month_range` 等 snake_case 字段，页面增加规范响应归一化。
- 后端 `/analytics/transfers-and-allocations` 已对日期使用规范格式校验，并在边界兼容旧驼峰参数；页面审计源已登记。
- 已验证：`npm run check:fields`、`npm run type-check`、`node --check src/routes/analytics.js`、`node --test test/field-contract.check.js`、`git diff --check` 通过。
- 未验证：真实数据库回归。批发/划拨依赖历史物理列 `wholesale_date`、`Inventorytime`，需连接恢复后验证金额和门店筛选。

### 分析总页面 `AnalyticsView.vue`（2026-08-26）

- 父页面筛选参数统一通过 `searchParams` 输出 `start_date`、`end_date`、`store_id`、`supplier_id`；传给子页面时仅在 Vue prop 边界映射为 kebab-case，不再保留旧驼峰请求参数函数。
- 门店和供应商列表统一使用 `extractResponseData` 处理数组、分页对象和双层响应，避免把门店分页对象直接交给排序函数；接口失败或返回非数组时清空列表，避免继续使用过期选项。
- 修复筛选摘要中字符串 ID 与数字 ID 严格比较导致门店/供应商名称不显示的问题。
- 页面已加入 analytics 字段契约审计源，并增加父页面筛选/响应归一化契约测试。
- 已验证：`npm run check:fields`、`npm run type-check`、`npm run check:backend-security`、`npm run check:runtime-patterns`、`node --test test/field-contract.check.js` 通过。
- 未验证：真实数据库回归。门店和供应商权限、分页响应及数据库连接恢复后的实际筛选结果仍需在真实环境验证。

### 高价值客户分析分页与搜索（`CustomerAnalytics.vue`，2026-08-26）

- 高价值客户搜索参数统一为 `search_term`，后端仅在请求边界兼容旧 `search`；日期、门店和分页继续使用 snake_case。
- 高价值客户接口分页响应补充 `has_next`、`has_prev`，页面不再依赖缺失的分页状态字段。
- 已更新 analytics 字段契约、兼容清单和专项契约测试；未改变真实销售数据查询逻辑。
- 未验证：真实数据库销售表字段和客户筛选结果，数据库连接恢复后执行。

### 综合查询排序契约（`query`，2026-08-26）

- 查询服务、仓储和选项接口的排序字段统一为 `inventory_time`、`sale_time`、`sale_price`、`purchase_cost`；旧物理列仅保留在仓储 SQL 映射边界。
- 修复默认排序仍使用 `salestime`、选项接口仍返回 `purchase_date`/`sale_date` 的不一致，避免前端选择值被后端静默回退。
- 已验证：`npm run check:fields`、`npm run type-check`、`node --check src/services/query.service.js`、`node --check src/repositories/query.repository.js`、`node --check src/controllers/query.controller.js`、`node --test test/field-contract.check.js`、`git diff --check` 通过。
- 未验证：真实数据库回归。排序字段映射需要在数据库连接恢复后验证各状态下的业务时间排序结果。

### 综合查询详情弹窗（`QueryDetailContent.vue`，2026-08-26）

- 详情弹窗字段权限键已统一为 `basic_info.purchase_cost`、`time_info.inventory_time`、`time_info.sale_time`，展示值本身此前已使用规范响应字段。
- 查询模块字段配置同步改为规范权限键；字段权限服务在迁移期间支持规范键与历史键双向解析，既不新增旧键，也不会让既有角色配置突然失效。
- 已登记详情组件为 `query` 字段契约审计源，并补充专项契约测试。
- 已验证：前端类型检查、字段一致性审计、查询契约测试、`git diff --check` 通过。
- 未验证：真实权限数据回归。数据库连接恢复后需确认已有角色使用历史字段键时仍能正确显示/隐藏详情价格和时间。

### 综合查询分页与错误边界（`query`，2026-08-26）

- 查询页面内部状态和选项请求统一使用 `page_size`，不再向 API 发送 `limit`；旧客户端的 `limit` 仅由后端请求边界归一化。
- 综合查询和退库记录的仓储分页响应补充 `page_size`、`total_pages`、`has_next`、`has_prev`；预定查询已完成规范分页回归并移除旧分页兼容。
- 查询控制器所有异常路径改用 `ApiResponse.serverError`，批量操作失败明细不再回显数据库或内部错误原文。
- 查询选项加载失败时保持空列表，不再注入固定品牌、颜色和内存，避免把示例数据误写入业务单据。
- 已验证：字段审计、查询契约测试、前端类型检查、后端语法检查和 `git diff --check` 通过。
- 未验证：综合查询的权限范围和历史物理列排序回归；预定真实数据库分页已于 2026-08-27 完成。

### 销售页面字段收敛（`SalesView.vue` 及拆分文件，2026-08-27）

- 涉及页面：`SalesView.vue`、`page/*.vue` 及销售 composable/辅助文件；涉及接口：可售库存列表/导出/统计、库存汇总/明细和 `POST /sales/phone`；后端路由、控制器、服务及仓储全部纳入审计。
- 页面编辑、排序、筛选和业务计算只使用 `purchase_cost/inventory_time/sale_time`；提交设备金额统一为 `sale_price`，不再发送 `price`，拆分后的 `normalizeSalesPhone` 在独立辅助文件接受契约测试。
- 后端只接受 `page_size/start_date/end_date/sale_price/sale_time`；`purchase_price/Inventorytime/purchase_date/inbound_date/salestime/sale_date/cost/limit/date_start/date_end` 以及端点参数 `price/date` 已退役，运行时兼容边界为 0。
- 缺少合法客户姓名或手机号时直接返回 400，不再生成 `临时客户`、`TEMP_${Date.now()}` 等随机业务数据；缺失或非法 `sale_time` 也不再静默回填当前时间。
- 仓储层移除真实 `phones` 表不存在的 `created_at/updated_at` 读写，列表排序改用 `inventory_time`，序列号方法名与服务调用保持一致。
- 2026-08-27 真实库只读验证：`phones` 29 列、`sales` 16 列，登记旧物理列 0；可售库存 86 台，成本、入库时间及品牌/型号/颜色/内存/门店关联缺失均为 0，20 条规范分页按入库时间倒序通过。
- 15471 条销售记录的手机、客户、操作员和门店关联完整，销售时间缺失 0、倒序抽样通过；历史空售价 88 条、空成本 79 条保持真实空值，写操作 0。登录态单售/批售、支付、积分、预定交付、导出和权限按钮仍待服务回归。
- 已通过应用数据库连接池直接执行仓储可售列表、可售统计、销售记录搜索和手机统计四条只读路径；分页 `total` 在路由和仓储边界统一转换为 number。

### 销售可售库存列表边界（`/sales/phones/available`，2026-08-26）

- 可售库存列表请求只使用 `page_size`，后端限制页码和每页数量范围；历史 `limit` 已退役。
- 响应分页统一为 `page_size`、`total_pages`、`has_next`、`has_prev`，不再生成或接受旧分页键。
- 失败响应改用 `ApiResponse.serverError`，不再向客户端暴露 SQL 或数据库错误原文；销售页选项和自动打开库存请求同步改用 `page_size`。
- 已完成 86 台可售库存、20 条规范分页、关联完整性和入库时间排序只读验证；真实门店权限和销售交易联动待登录态回归。

### 销售库存明细边界（`/sales/inventory-detail`，2026-08-26）

- 库存明细查询只接受 `page_size`，后端限制为 `1-500`，旧 `limit` 已退役。
- 入库时间 SQL 别名统一为 `inventory_time`，与销售页面明细表和字段权限键一致。
- 异常响应改用统一安全错误，不再返回数据库错误原文；品牌缺失等客户端错误仍返回明确的 4xx 提示。
- 已完成真实库存明细字段和可售库存关联只读验证；门店权限和超过 500 条场景待登录态回归。

### 销售库存统计边界（`/sales/inventory-summary`，2026-08-26）

- 库存统计日期筛选只接受 `start_date`、`end_date`，旧 `date_start/date_end/date` 已退役。
- 门店和供应商 ID 在进入 SQL 前校验为正整数，日期范围校验格式和先后顺序，避免无效筛选静默放大查询。
- 统计接口异常统一使用安全错误响应，不再返回数据库错误原文；销售页面统计请求同步发送规范日期字段。
- 已完成真实可售库存聚合基础数据和日期排序只读验证；门店权限及浏览器筛选交互待登录态回归。

### 工资员工销售明细（`SalaryView.vue`，2026-08-26）

- 员工销售明细表格和页面内部状态已从 `salestime` 统一为 `sale_time`。
- 服务层在 SQL 边界使用已迁移的 `p.sale_time` 并输出 `sale_time`，请假排除逻辑、排序和日期过滤均使用规范物理列。
- 历史 `salestime` 仅作为服务接口/旧数据源兼容名登记，页面直接消费 `sale_time`，避免继续扩散到工资业务计算。
- 已补充工资契约响应字段和专项测试；已验证字段审计、工资契约测试、前端类型检查和 `git diff --check`。
- 未验证：真实数据库销售明细和请假日期排除回归，需数据库连接恢复后执行。

### 客户模块（`CustomersView.vue`、`customers.js`、`customer.repository.js`，2026-08-26）

- 客户列表请求、筛选、表单和权限字段统一使用 `customer_type`、`vip_level`、`register_date_start`、`register_date_end`、`page_size`、`sort_by`、`sort_order` 等规范字段。
- 客户统计接口及页面状态统一使用 `total_customers`、`active_customers`、`new_customers`、`premium_customers`，不再把历史驼峰字段带入页面业务计算。
- 客户购买历史响应统一使用 `purchase_cost`、`sale_price`、`sale_time` 和规范分页字段；后端 SQL 已读取 `p.sale_time`，旧时间键只在接口边界兼容。
- 客户仓储层使用显式字段查询，支持规范日期筛选和白名单排序；不再使用 `SELECT *` 透传客户数据。
- 已登记客户模块路由、仓储、页面字段契约、兼容边界和专项测试；客户专项字段、事务、安全、运行时和语法检查已通过。
- 未验证：真实客户列表筛选、统计、购买历史分页、日期筛选和销售时间排序，数据库连接恢复后执行。

### 价目表库存详情（`PriceListView.vue`，2026-08-26）

- 价目表库存详情表格和在库天数计算统一使用 `inventory_time`。
- `/sales/phones/available` 的历史响应字段只在 `normalizePriceListInventory` 边界兼容读取，页面内部不再使用 `Inventorytime`。
- 已将价目表页面加入 `phones` 字段契约审计源并补充专项测试；已验证字段审计、契约测试、前端类型检查和 `git diff --check`。
- 未验证：真实价目表库存详情和在库天数排序，数据库连接恢复后执行。

### H5 已售商品（`SoldProductsView.vue`，2026-08-26）

- 已售商品卡片和类型字段统一为 `sale_time`；页面分页内部统一使用 `page`、`page_size`、`total_pages`。
- `/shop/sold-products` 在 SQL 边界将 `p.salestime` 映射为 `sale_time`；图片列表改为显式字段查询，不再使用 `SELECT *` 透传。
- 图片排序请求使用规范 `image_ids`；后端仅在该请求入口兼容历史 `imageIds`。
- 已登记 H5 模块字段契约、兼容边界和专项测试；字段审计、事务契约、后端语法和 `git diff --check` 已通过。
- 未验证：真实 H5 已售商品列表和图片管理流程，数据库连接恢复后执行。

### H5 用户购买记录（`MyCenter.vue`，2026-08-27）

- 涉及页面：`frontend/src/views/H5-mobile/page/MyCenter.vue`；涉及接口：`GET /public/auth/sales`；涉及 API：`frontend/src/api/auth.ts`。
- 响应、API 类型和页面消费统一为 `id/invoice_number/sale_time/sale_price/payment_method/store_name/operator_name/imei/serial_number/product_name/brand_name/model_name/color_name/profit/is_new`；页面购买记录不再使用 `any[]`。
- `/public/auth/sales` 使用显式列和显式响应映射；销售时间按 `COALESCE(s.sale_time, p.sale_time)` 返回和倒序。缺失金额、门店、操作员、商品和机况保持 `null`，不再伪造成 `0`、`未知...` 或 `二手`。
- 2026-08-27 已完成真实库只读验证：`sales` 15471 条均关联客户，有效销售时间缺失 0、孤儿客户关联 0；最大客户样本 202 条，接口上限抽样 100 条倒序正确，写操作 0。
- `sale_date/salestime` 已退役，运行时兼容字段和兼容边界均为 0。当前有效 H5 客户令牌为 0，因此真实登录态鉴权和浏览器弹窗流程仍待产生有效登录会话后回归。

### H5 公开商品列表（`ProductList.vue`，2026-08-26）

- `/public/products`、`/public/products/aggregate` 和 `/public/products/search/:keyword` 的路由、服务、API 与页面统一使用 `page_size/total_pages/has_next/has_prev`，不再接受或生成 `limit/totalPages/hasNextPage/hasPrevPage`。
- 普通列表、模板列表、聚合列表、搜索和二手机分页方法均返回规范分页结构；共享前端解包器仅读取 snake_case，页面内部页大小状态使用 `page_size`。
- 修复商品搜索计数查询缺少 `colors/memories` 关联以及主查询漏选 `color_id/memory_id` 导致的 `ER_BAD_FIELD_ERROR/NaN`。
- 2026-08-27 已完成真实库只读验证：在库 86 台、二手机 19 台、已发布模板 62 个；当前发布规则下可见二手机 13 条、聚合结果 75 条，普通列表、聚合列表和搜索分页均通过，搜索 ID 完整，写操作 0。
- 4 个历史分页字段已退役，运行时兼容字段和兼容边界均为 0；商品详情、库存分布、图片加载和公开限流仍待浏览器端到端回归。

### 考勤页面补充（`AttendanceView.vue`，2026-08-26）

- 月度已审批统计请求改为使用 `page_size`，不再在页面内部提交旧 `limit`；`AttendanceFilters` 类型同步移除旧分页字段。
- 旧 `limit` 仍仅存在于考勤后端请求兼容边界，便于历史客户端平滑迁移。
- 已验证：字段一致性审计、前端类型检查、考勤契约测试和 `git diff --check`。
- 未验证：真实数据库考勤统计在最大页大小下的记录完整性，数据库连接恢复后执行。

工资页面复用考勤筛选的两个统计请求也已同步改为 `page_size`，避免类型收敛后出现跨模块旧字段调用。

### 权限管理页面（`PermissionsView.vue`，2026-08-27）

- 角色列表、用户角色列表请求统一使用 `page_size`，响应统一提供 `page_size`、`total_pages`、`has_next`、`has_prev`；权限四个子页分页控件也已统一绑定 `page_size`。
- 权限日志查询、导出和手动记录统一使用 `page_size`、`start_date`、`end_date`、`target_type`、`target_id`、`target_name`；日志路由已停止接受旧 `size`、日期及目标对象驼峰字段。
- 权限页面统计、角色筛选、门店筛选和角色分配统一使用 `total_roles`、`role_id`、`store_id`、`role_ids`、`store_ids`；字段权限和菜单权限请求统一使用 `module_key`、`field_config`、`menu_permissions`。模块统计及权限矩阵元数据响应统一使用 `total_modules`、`total_permissions`、`total_roles`、`active_users`、`from_database` 等 snake_case 字段。
- 门店绑定接口和页面统一使用 `user_id/store_id/store_ids/is_primary/replace_existing`，后端已停止接受 `userId/storeId/storeIds/isPrimary/replaceExisting`。
- 模块管理的注册、编辑、状态、名称和菜单关联请求/响应已统一为 snake_case；模块扫描和菜单关联服务不再向 API 透传驼峰字段。
- 已新增 `permissions` 字段契约、兼容清单和审计源登记。
- 已验证：字段一致性审计、前端类型检查、后端契约测试、事务契约测试、安全审计、运行时审计和 `git diff --check`。
- 已验证：真实数据库角色、用户、模块统计、日志表、字段权限和引用完整性；当前库包含角色 4、用户 10、模块 50（启用 45）、角色权限 373、字段权限 86、操作日志 876，角色/用户/字段权限无孤儿引用。
- 已完成：`role_field_permissions` 的 26 类历史 `module_key` 共 72 条记录已通过事务迁移；更新 5 条目标配置、补建 1 条目标配置、清理 72 条历史记录，迁移后未匹配记录为 0。ID 3010 的动作配置因属于误写数据而未转成字段配置，真实动作权限继续由 `role_permissions` 管理。
- 已完成：15 条现存字段权限配置中有 2 条使用 `hiddenFields`；通过 `migrate-role-field-config-json.js --execute` 事务更新后行数仍为 15，旧 JSON 配置为 0。运行时 `hiddenFields/editableFields` 映射已删除，旧映射仅保留在离线迁移脚本。
- 字段权限运行时契约已统一：聚合字段只使用 `hidden_fields`、`editable_fields`，单字段属性只使用 `can_view`、`can_edit`、`can_search`、`can_export`、`is_hidden`、`permission_level`。旧 camelCase 响应字段和兼容读取已删除。
- 删除无调用方且请求不存在接口的旧 `fieldPermissionService`、`FieldPermissionTable`、`FieldPermissionWrapper` 和旧权限组合式函数；全局指令仅保留实际使用的 `v-permission`、`v-permission-not`。
- `/permissions/field-permissions/:role_id` 用于管理员维护某个角色的字段配置，`/permissions/user-field-permissions` 用于读取当前用户多角色合并后的生效配置；两者职责不同，但请求和响应字段采用同一 snake_case 契约。
- 已验证：旧 `/fields/permissions` 调用及完整旧字段标识符扫描为 0；前端类型检查、字段一致性审计和生产构建通过；开启 `RUN_DB_TESTS=true` 后端 103 项测试全部通过，无跳过。

### 用户列表接口（`users.js`，2026-08-26）

- 模块名称：用户管理；涉及页面：用户选择弹窗及共用 `userApi`；涉及接口：`GET /users`、`GET /users/employees`、`GET /users/profile`、`GET /users/operators`、用户详情及增删改状态接口。
- 规范字段：`page_size`、`total_pages`、`has_next`、`has_prev`、`role_id`、`role_ids`、`store_id`、`salary_template_id`、`is_admin` 及用户公开资料字段；历史字段：`limit`、`totalPages`、`hasNextPage`、`hasPrevPage`，以及错误归属于用户表的 `group_name`。
- 页面、API 类型、路由和仓储分页均已统一为 snake_case；角色读取和筛选来自 `user_roles/roles`，创建和更新角色关联使用事务。用户详情、删除和状态切换查询使用公开列清单，禁止通过 `SELECT *` 暴露密码。
- 兼容边界文件：无。5 个历史或错误字段已登记为 retired，后端不再接受或返回；旧字段移除条件已满足：仓内调用方迁移完成、真实表结构已确认且契约审计覆盖路由、仓储、API 和用户选择弹窗。
- 是否完成真实数据库验证：是。2026-08-27 已只读确认 `users` 真实列、`user_roles/roles` 角色关联，并完成规范分页、角色+状态筛选和公开列回归；样本筛选返回 3 条，响应不含 `password`，写操作为 0。登录态接口权限回归仍待服务启动后执行，不将其标记为已完成。

### 门店管理（`stores.js`，2026-08-27）

- 模块名称：门店管理；涉及页面：`StoresView.vue` 及综合查询门店选项；涉及接口：`GET/POST /stores`、`GET/PUT/DELETE /stores/:id`、`GET /stores/managers`、`GET /stores/stats`、`GET /stores/export`、`PUT /stores/batch/reorder`。
- 规范字段：`page_size`、`total_pages`、`has_next`、`has_prev`、`manager_id`、`sort_order`、`with_manager`；历史字段：`limit`、`pages`、`hasNext`、`hasPrev`。
- 页面分页状态、请求、响应、负责人表单和统计已统一为 snake_case；路由使用明确公开列，不再通过 `SELECT *` 透传物理字段。`stores.location` 暂不重命名，只在后端数据库边界映射为 API `address`。
- 兼容边界文件：无。4 个历史分页字段已登记为 retired；旧字段移除条件已满足：仓内调用方完成迁移，字段审计和契约测试覆盖页面与路由。
- 是否完成真实数据库验证：是。已使用只读查询完成门店显式列、状态筛选和 `page_size` 分页验证，写操作为 0；登录态增删改、负责人校验、导出和批量排序仍待服务启动后回归。

### 工资模板列表（`salary-template`，2026-08-27）

- 控制器和仓储统一从 `options.page_size` 读取分页参数，修复此前分页参数放在 `options` 却从 `filters` 读取导致分页失效的问题。
- 模板列表响应提供 `page_size`、`total_pages`、`has_next`、`has_prev`；旧 `limit` 只在控制器请求入口兼容，仓储内部不再接收旧分页键。
- 员工工资模板绑定请求改用 `template_id`，后端暂时兼容历史 `templateId`。
- 云端 `salary_templates` 实际字段为 `id`、模板基本信息、`commission_fixed`、`commission_new_fixed`、`commission_used_fixed`、`commission_percentage`、`overtime_hourly_rate`、`rest_days`、`auto_raise_rule`、状态和时间字段；仓储及前端 API 类型已与真实列对齐，不再读取或声明不存在的 `leave_daily_deduction`、`absent_daily_deduction`、`salary_cycle_days`、`social_insurance_rate`、`tax_rate`、`created_by`。
- 默认模板更新已改为同一连接上的事务操作，激活模板查询增加 `is_active = 1`，不再出现接口返回成功但数据库未更新或禁用模板混入下拉列表的问题。
- 已新增 `salary-templates` 字段契约、兼容清单和审计源登记。
- 已验证：字段一致性审计、前端类型检查、后端契约测试、`git diff --check` 以及云端模板列表只读查询（记录数 1，分页正常）；列表 500 根因是仓储查询不存在字段，已修复。
- 未验证：员工绑定权限完整流程，需在应用登录态下继续回归。

### 库存分析最近销售（`InventoryAnalytics.vue`，2026-08-26）

- 库存预警和最近销售表格统一使用 `last_sale_time`、`sale_time`，类型和摘要计算同步更新。
- 分析接口响应将历史销售时间映射为规范 snake_case 字段；数据库查询中的 `salestime` 和旧统计字段仍属于 analytics 兼容边界。
- 已补充分析字段契约和专项测试；已验证字段审计、47 项契约测试、前端类型检查和 `git diff --check`。
- 未验证：真实库存分析最近销售数据和日期排序，数据库连接恢复后执行。

### 综合预警（`ComprehensiveWarnings.vue`，2026-08-28）

- 销售趋势日期统一为 `sale_time`，入库预警日期统一为 `inventory_time`，供应商最近入库时间统一为 `last_inventory_time`。
- 仪表板仓储层使用已迁移的 `sale_time`、`inventory_time` 物理列，组件展示和字段契约统一使用规范字段。
- 综合预警及手机/机型库存预警请求统一使用 `phone_threshold` 或 `threshold`、`page_size`；后端路由、服务层和仓储不再接受或传递 `limit`、`phoneThreshold`。
- `InventoryWarnings.vue` 与 `ComprehensiveWarnings.vue` 的预警摘要统一读取 `has_warnings`、`total_warnings`；旧字段已从运行时移除并登记为 retired。
- 已登记综合预警完整字段契约、审计源和专项测试；字段审计、后端契约测试、后端语法、安全审计、运行时审计和 `git diff --check` 已通过。
- 已完成云端真实数据库只读验证：手机库存预警、机型库存预警、销售趋势、今日销售和供应商入库预警查询均成功，写操作为 0；登录态仪表盘权限和页面刷新流程仍待服务启动后回归。

### 数据导入 `DataImportTab.vue`（2026-08-26）

- 分析接口是同步处理，页面不再用定时器伪造 0-90% 的分析百分比，改为真实的 `indeterminate` 处理中状态；完成时才显示 100%，失败时显示实际错误。
- 导入任务进度仍由服务端 `import_id` 轮询提供，页面卸载时继续清理轮询定时器。
- 已验证：`npm run type-check`、`npm run check:fields`、`node --test test/transaction-contract.check.js`、`git diff --check` 通过。
- 未验证：真实大文件导入回归。数据库连接恢复后仍需验证长任务、页面切换和任务过期场景。

补充：导入历史接口的新请求字段统一为 `page_size`，响应补充 `page_size`、`total_pages`、`has_next`、`has_prev`；旧 `limit`/`pageSize` 仅在路由边界兼容，前端 API 类型不再暴露旧字段。

### 工资记录分页（`SalaryView.vue`，2026-08-26）

- 工资记录列表接口在控制器和仓储层双重限制 `page >= 1`、`1 <= page_size <= 100`，并只使用校验后的整数生成 SQL `LIMIT/OFFSET`。
- 防止负数、超大分页值导致 SQL 错误或一次读取过多工资记录；工资响应字段白名单保持不变。
- 已验证：前后端类型/语法检查、`node --test test/transaction-contract.check.js`、`git diff --check` 通过。
- 未验证：真实数据库分页回归。数据库连接恢复后需验证管理员和员工两种权限范围下的分页总数与最后一页。

### 库存页面 `InventoryView.vue`（2026-08-26）

- 页面表格、移动端列配置和编辑表单内部字段统一为 `purchase_cost`、`inventory_time`，提交手机更新时直接使用规范字段。
- 字段权限键暂保留旧名称，仅作为现有权限配置兼容边界；接口响应优先读取规范字段，旧物理列只在归一化处兼容。
- 已验证：前端类型检查、`node --test test/transaction-contract.check.js`、`git diff --check` 通过。
- 未验证：真实数据库编辑回归。数据库连接恢复后需确认库存时间写入和列表刷新结果。

### 库存详情弹窗 `InventoryDetailModal.vue`（2026-08-26）

- 详情展示和字段可见性判断统一使用 `purchase_cost`、`inventory_time`；旧字段仅保留在权限键映射中。
- 采购价格和入库时间不再从旧字段直接读取，避免列表和详情页面字段名称不一致。
- 已验证：前端类型检查、字段一致性审计、库存详情专项契约测试、`git diff --check` 通过。
- 未验证：真实数据库详情回归。数据库恢复后需确认列表进入详情时规范字段完整传递。

### 整站字段控制补充（2026-08-28）

- 模块名称：H5 管理子页面；涉及页面：`SoldProductsView.vue`、`banners.vue`、`config.vue`、`home-sections.vue`、`templates.vue`；涉及接口：已售商品/图片、轮播图、商城配置、首页推荐和商城模板接口。
- 规范字段：页面字段权限使用 `h5_admin_soldproductsview`、`h5_admin_bannersview`、`h5_admin_configview`、`h5_admin_home_sectionsview`、`h5_admin_templatesview` 登记；请求和响应继续使用既有 snake_case 字段。
- 页面内部已按字段可见性控制列表、卡片、图片、表单、筛选和操作区域；保存请求会过滤不可见字段，操作权限仍按页面动作权限判断。
- 模块名称：仪表盘、数据检查、营销管理、系统管理、退库管理、库存预警配置和数据备份；字段配置已补充到 `frontend/src/config/moduleFields.js`，页面入口已接入字段可见性控制；数据检查、导入和同步页签分别按字段控制。
- 历史字段：本轮未新增运行时兼容字段。兼容边界文件：无。旧字段移除条件：既有 API/物理字段迁移结论不变。
- 是否完成真实数据库验证：本轮字段显示和隐藏提交逻辑尚未执行登录态浏览器回归；只读数据库验证沿用各模块既有登记，H5 新增配置写流程标记为待验证。

### 权限管理字段覆盖补充（2026-08-28）

- 模块名称：权限管理；涉及页面：`PermissionsView.vue` 及角色、用户角色、门店绑定、权限日志子页面；涉及接口：角色列表、用户角色列表、门店绑定列表、权限日志和对应的分页/搜索接口。
- 规范字段：权限管理字段登记为 `stats.*`、`roles.*`、`users.*`、`store_bindings.*`、`logs.*` 和 `system_info.operations`；分页统一为 `page/page_size/total`，日志日期筛选使用 `date_range`。
- 字段控制：四个子列表的统计、筛选和表格列均按字段权限隐藏；角色状态切换归属 `roles.status`，字段隐藏但拥有编辑动作权限时保留该列和动作；没有字段权限或动作权限时不显示。
- 兼容边界文件：无。本轮未新增旧字段兼容，权限 API 继续只使用 snake_case。
- 是否完成真实数据库验证：字段显示逻辑、静态覆盖审计和契约测试已完成；角色切换、字段隐藏后的登录态浏览器回归仍待服务启动后执行。

## 下一步顺序

预定编辑只提交 `customer_id`，`customer_name/customer_phone` 由客户关联生成；前端及后端筛选统一为 `start_date/end_date`，旧驼峰日期、旧分页和旧状态别名均已移除。预定列表、详情和恢复响应使用显式字段清单，请求阶段只读校验 30 个规范物理列，不再修改数据库结构。

入库统计和编辑接口已修复：品牌统计改为按 `brands` 关联分组（修复原无效的 `p.as`/`GROUP BY p` SQL），编辑响应改为显式手机字段，不再使用 `SELECT * FROM phones`；采购入库表单、手机列表和提交 payload 已统一使用 `inventory_time`、`purchase_cost`。

租赁结束流程已改为显式锁定所需字段（`id/status/billing_mode/phone_id/unit_price/start_date`），不再使用 `SELECT * FROM rentals`。

快速出库库存列表响应已统一为 `purchase_cost`、`sale_price`、`inventory_time`、`sale_time`、`condition`；快速出库表单内部状态同步统一为 `purchase_cost`、`inventory_time`、`sale_time`，库存页面仅在显示层保留旧列键兼容，API 不再返回 `purchase_price`。

手机列表响应已移除旧物理列 `Inventorytime`/`salestime` 的透传，统一输出 `inventory_time`/`sale_time`；共享 SQL 和云端物理列迁移已完成，旧名称仅允许出现在登记的兼容边界或迁移审计中。

手机详情响应同步完成字段收敛：移除 `purchase_price` 旧别名和旧时间列透传，统一返回 `purchase_cost`、`inventory_time`、`sale_time`、`condition`；详情编辑表单已同步使用规范状态字段，旧详情键仅在归一化边界兼容读取。

分析库存与最近销售接口已完成输入边界收敛：`store_id`/`supplier_id` 使用整数校验和 SQL 占位符，最近销售 `limit` 限制在 1-100，避免拼接查询和异常大分页。

划拨批发分析接口已完成日期和门店筛选收敛：`start_date`/`end_date` 支持规范命名并校验为 `YYYY-MM-DD`，所有批发、划拨、趋势、排行和最近记录查询均使用占位符，不再拼接日期或门店 ID。

1. 批发/划拨页面已完成 `sale_time`、`purchase_cost`、`wholesale_price`、`inventory_time` 的应用层收敛；记录查询的 `page_size`、`total_pages`、`has_next`、`has_prev` 已统一，旧分页字段已移除。
2. 批发/划拨服务仅使用规范 `sale_time` 和真实 `phones.supplier_id`；旧 `sale_date` 已移除，不存在的 `proxy_supplier_id` 查询已修复；代划拨金额按明确业务规则统一为 0，普通批发继续使用真实采购成本、售价和利润。
3. 配件模块已完成物理列迁移，规范金额字段为 `purchase_cost`、`sale_price`；旧金额字段仅保留在 API 兼容边界。
4. 查询响应已使用 `basic_info`、`price_info`、`time_info` 等规范分组；综合查询页面已将列表、列配置、单据和显示逻辑统一为 `purchase_cost`、`inventory_time`、`sale_time`；数据导入页面的分析结果、差异预览、进度任务和导入历史响应已收敛为 snake_case，禁止页面直接依赖数据库旧列名。
5. 为工资、统计、查询和导入导出增加响应契约与真实数据回归测试；客户分析页面已补响应字段契约，工资列表和详情已补显式响应字段测试，data-import 已补分析响应契约测试；后端真实回归已通过，前端类型检查已通过。
6. 配件物理列迁移已完成并通过迁移前后数据核对；共享 `phones`/`sales` 物理列已于 2026-08-27 完成改名，迁移前后行数、空值数和金额合计一致。
7. `phones`/`sales` 的旧 API 请求字段仍保留在登记的后端入口兼容边界；物理列兼容已结束，不得再新增旧 SQL 引用。待外部调用方确认完成后，再删除 API 兼容映射。

### 手机与销售物理字段迁移完成（2026-08-27）

- 已完成 `phones.Inventorytime` -> `inventory_time`、`phones.salestime` -> `sale_time`、`sales.price` -> `sale_price`、`sales.cost` -> `purchase_cost`、`sales.sale_date` -> `sale_time` 的真实数据库改名。
- 迁移脚本为 `backend/scripts/migrate-phone-sales-columns.js`，默认只读，`--execute` 才执行改名；脚本未执行删除、截断、插入或数据填充。
- 迁移前后 `phones`/`sales` 行数分别保持 `16232`/`15471`；销售售价和采购成本合计保持 `72968094.00`/`71972076.00`。
- 已切换库存、销售、客户、补贴、分析、仪表盘、H5、工资、导入、批发/划拨、租赁和查询链路的物理 SQL；后续回归只允许使用规范物理列。

> 配件模块与共享 `phones`/`sales` 模块的物理列迁移均已完成。

## 维护规则

- 新增 CRUD 字段必须先登记 `config/field-contracts.json`。
- 前端表单、分页、筛选和权限状态内部必须使用规范字段，不能只在提交 API 时临时转换。
- 旧字段兼容只能存在于后端迁移边界，不能扩散到新的业务逻辑。
- 每完成一个模块，必须同步更新本文件的状态和验证结果。
- 每次新增兼容字段，必须同时登记兼容清单、边界文件和移除条件；审计输出会统计当前兼容字段总数。
