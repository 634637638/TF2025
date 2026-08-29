# 字段一致性迁移记录

> 本文记录历史迁移；当前模块进度和 API/数据库字段映射请以 [字段统一迁移进度](field-consistency-progress.md) 为准。项目采用“先统一 API，再按模块核验并迁移数据库物理列”的分阶段策略。

## 2026-08-27 全库物理字段审计

已对云端 `TF2025` 数据库逐表执行只读字段审计：已知历史候选物理列和大写/驼峰列均未发现。当前没有剩余可安全执行的物理改名项。`price_history.cost_price` 属于独立价格历史契约，保留原名；审计脚本为 `backend/scripts/check-physical-field-contract.js`。

## 工资模板表 `salary_templates`

该表不执行物理字段改名。本次真实核验发现历史 API 契约曾声明 `leave_daily_deduction`、`absent_daily_deduction`、`salary_cycle_days`、`social_insurance_rate`、`tax_rate`、`created_by`，但云端表不存在这些列。后端仓储已改为显式查询真实列，前端 API 类型和字段契约同步移除这些字段；默认模板操作使用事务，激活模板按 `is_active` 筛选。字段核验未新增默认值，未删除任何工资模板数据。

## 用户与角色字段核验（2026-08-27）

- 云端 `users` 表不存在 `role` 和 `group_name` 物理列；角色关系以 `user_roles.role_id -> roles.id` 为准。本模块不执行物理字段改名，也未写入任何数据。
- 用户路由和仓储已停止读取或写入 `users.role/users.group_name`；角色创建、更新使用 `role_id/role_ids` 并在事务中维护关联表，响应的 `role` 由角色关联聚合得到。
- 只读数据库回归覆盖 `page_size` 分页、角色筛选、状态筛选和公开字段清单；样本筛选返回 3 条，结果包含 `role/store_id` 且不含 `password`。
- `limit`、`totalPages`、`hasNextPage`、`hasPrevPage` 和错误归属的 `group_name` 已登记为用户模块退役字段；运行时兼容边界为 0。

## 门店字段核验（2026-08-27）

- 门店 API 使用 `address`，真实表继续使用 `stores.location`；本轮只做后端数据库边界映射，不执行物理列改名或数据写入。
- 页面和接口分页统一为 `page_size`、`total_pages`、`has_next`、`has_prev`，负责人请求统一为 `manager_id`，统计响应统一为 `with_manager`。
- 只读数据库回归已验证门店显式列查询、状态筛选和规范分页；`limit`、`pages`、`hasNext`、`hasPrev` 已退役，运行时兼容边界为 0。

## 提醒字段核验（2026-08-27）

- 模块页面为 `frontend/src/views/reminders/ReminderView.vue` 和全局提醒入口 `frontend/src/components/ReminderHost.vue`；覆盖列表、详情、待处理提醒、类型管理及写入接口。
- API 规范字段使用 `page_size`、`total_pages`、`has_next`、`has_prev`、`type_id`、`repeat_type`、`interval_value`、`weekdays_json`、`occurrence_limit` 等 snake_case 名称；`limit`、`totalPages` 已退役且不再存在运行时兼容边界。
- 数据库继续使用 `reminders.repeat_rule` JSON 保存重复规则，`backend/src/services/reminder.service.js` 在数据库边界显式转换内部 `type/interval/weekdays/count`，这些内部键不再透传到 API。
- 真实数据库只读回归已验证 `reminders` 的 14 个显式物理列、事项类型和创建人关联、非归档状态过滤及规范分页；未调用建表初始化逻辑，写操作为 0。
- 登录态创建、编辑、删除、权限及接收人可见范围尚待服务启动后回归；该项不影响物理字段与只读查询验证结论。

## 员工字段核验（2026-08-27）

- 模块页面为 `frontend/src/views/employees/EmployeesView.vue`；覆盖员工列表、详情、创建、更新、删除和角色分配接口。
- 请求、响应、表单和分页统一使用 `role_ids`、`role_names`、`confirm_password`、`page_size`、`total_pages`、`has_next`、`has_prev`；`limit`、`current`、`pageSize`、`pages`、`role_id`、`confirmPassword` 已退役，运行时兼容边界为 0。
- 真实 `users` 表不存在 `role` 物理列，角色关系以 `user_roles.role_id -> roles.id` 为唯一来源；本轮不执行物理列改名或业务数据写入。
- 只读数据库回归已验证用户显式公开列、状态筛选、规范分页、角色名称/ID 聚合及角色引用完整性；未发现 `user_roles` 孤儿引用，响应查询不包含密码，写操作为 0。
- `employee.role` 继续作为现有字段权限配置 ID 使用，不参与 API 请求、响应或业务计算；登录态增删改、导出以及超过 100 条员工时的服务端分页仍待应用启动后回归。

## 品牌字段核验（2026-08-27）

- `brands` 表已使用 `id/name/status/sort_order/created_at/updated_at` 规范物理列，本轮不执行数据库改名或数据写入。
- 品牌列表、建议搜索和品牌型号查询均改为显式列；品牌页面及入库、查询编辑、价目表等仓内调用方统一发送 `page_size`，响应分页统一为 `total_pages/has_next/has_prev`。
- 只读真实库回归验证了字段存在性、状态和名称筛选、建议搜索与分页计算；`limit/pages` 已从运行时删除并登记为退役字段。
- 登录态增删改、批量排序和权限流程尚待服务启动后回归，不能登记为已完成。

## 型号字段核验（2026-08-27）

- `models` 表真实列为 `id/brand_id/name/status/sort_order/created_at/updated_at`，共 196 条记录；不存在历史 API 曾声明的 `series/is_active`，本轮不执行数据库改名或写入。
- 页面、库存远程搜索、入库、查询编辑和价目表调用方统一使用 `name/page_size/sort_by/sort_order`；列表、详情、写入回读、状态切换和统计查询均使用显式列。
- 统计静态路由已移到动态 `/:id` 之前，响应统一为 `related_brands/by_brand/newest_model` 等 snake_case 字段；编辑接口现在会实际写入规范 `sort_order`。
- 只读真实库回归验证了品牌关联完整性、状态和名称筛选、规范排序及分页，未发现无效 `brand_id`，写操作为 0；6 个历史字段已退役且无运行时兼容边界。
- 登录态创建、编辑、删除、状态切换、批量排序和权限尚待服务启动后回归，不能登记为已完成。

## 颜色字段核验（2026-08-27）

- `colors` 表真实列为 `id/name/status/sort_order/created_at/updated_at`，共 13 条记录；不存在历史接口曾声明的 `brand_id/category/is_premium/is_active/hex_code`，本轮不执行数据库改名或写入。
- 颜色页面、入库、查询编辑和价目表调用方统一使用 `name/status/page_size/sort_by/sort_order`；列表、详情、写入回读、状态切换和统计查询均使用显式列。
- 无调用方的固定 `/colors/categories/list` 已删除，避免返回数据库并不存在的分类数据；页面色值预览仅根据颜色名称本地计算，不再作为 API 字段参与业务。
- 只读真实库回归验证了状态和名称筛选、规范排序、统计及分页，写操作为 0；11 个历史或错误字段已退役且无运行时兼容边界。
- 登录态创建、编辑、删除、状态切换、批量排序和权限尚待服务启动后回归，不能登记为已完成。

## 内存字段核验（2026-08-27）

- `memories` 表真实列为 `id/size/status/sort_order/created_at/updated_at`，共 17 条记录；不存在 `is_active/storage_unit` 物理列，本轮不执行数据库改名或写入。
- 页面、入库、查询编辑和价目表调用方统一使用 `size/status/page_size/sort_by/sort_order`；列表、详情、写入回读、状态切换和统计查询均使用显式列。
- `storage_size/storage_unit/is_combo` 仅由持久化 `size` 确定性解析；未落库的价格倍数、camelCase 统计、固定单位接口、固定初始化接口及选项加载失败时的固定回退数据已删除。
- 只读真实库回归验证了 17 条规格均可解析，并完成状态/规格筛选、规范排序及分页，写操作为 0；14 个历史或伪造字段已退役且无运行时兼容边界。
- 登录态创建、编辑、删除、状态切换、批量排序和权限尚待服务启动后回归，不能登记为已完成。

## 预定表 `preorders`

已统一为：

- 商品：`brand_id`、`model_id`、`color_id`、`memory_id`
- 金额：`total_price`、`deposit_amount`、`deposit_paid`、`actual_price`
- 业务：`customer_id`、`store_id`、`is_new`、`expected_arrival`、`remarks`

迁移脚本 `backend/src/utils/preorder-schema.js` 会在首次访问预定接口时幂等执行：

1. 将 `expected_price`、`advance_payment`、`deposit` 的历史值合并到规范金额字段。
2. 将可匹配的 `phone_model`、`color`、`storage` 文本映射到基础数据 ID，并把客户快照统一为 `customer_id` 关联。
3. 只有历史文本全部为空或已经映射时，才删除旧列；无法映射的数据不会被静默删除。

本次迁移已在配置的 TF2025 数据库执行并核验：旧金额、商品文本和客户快照列均已删除，预定记录的规范金额字段无空值。

后续新增字段必须先登记 `config/field-contracts.json`，再同时更新迁移、后端 CRUD、前端 API 类型、进度文档和回归测试。数据库物理列尚未迁移的模块，旧列名只能保留在后端边界映射中，不能用于新的前端请求和业务逻辑。

## 2026-08-26 真实数据库核对

- 已使用云端备份对应的 `TF2025` 数据库完成只读元数据、记录数和字段引用核对。
- 权限模块真实数据基线为：角色 4、用户 10、模块 50（启用 45）、角色权限 373、字段权限 86、操作日志 876；角色、用户和字段权限引用没有孤儿记录。
- 当时 `role_field_permissions` 中发现 26 类历史 `module_key`、共 72 条记录不存在于当前 `modules.key`；该批记录已于 2026-08-27 完成事务迁移，结果见下节。
- 后端真实回归 `RUN_DB_TESTS=true npm test` 共 95 项通过；其中测试产生的临时序列数据已清理。此次未执行任何数据库物理字段改名。
- 当时业务表仍保留 `phones.Inventorytime`、`phones.salestime`、`sales.sale_date`、`sales.price`、`sales.cost`；该状态已作为迁移前基线留档，后续已完成全量调用方迁移和物理列改名。

## 权限字段模块键迁移（2026-08-27）

- 迁移脚本：`backend/scripts/migrate-role-field-module-keys.js`；默认只读预览，仅 `--execute` 在事务中写入，异常时回滚。
- 迁移前发现 26 类历史键、72 条历史记录；迁移更新 5 条规范目标配置、补建 1 条规范目标配置并清理 72 条历史记录。
- 迁移后 `unmatched_after = 0`，未再发现字段权限孤儿模块键。
- ID 3010 的 `inventory_stockinpage` 记录内容是 `view/create/edit/delete` 动作配置，不属于字段权限，未合并为字段配置；动作权限继续由 `role_permissions` 维护。
- 随后使用 `backend/scripts/migrate-role-field-config-json.js --execute` 迁移字段配置 JSON：15 条记录中更新 2 条，行数保持 15，旧 JSON 键/字段 ID 记录从 2 条降为 0；脚本只执行事务更新，不删除或新增权限记录。

## 配件物理列迁移（2026-08-26）

迁移脚本：`backend/scripts/migrate-accessory-columns.js`。脚本默认只读预检，只有显式传入 `--execute` 才执行改名；重复运行已完成的库会返回 `already_migrated`，不会再次写入。

已完成改名：

- `accessories.purchase_price` -> `accessories.purchase_cost`
- `accessories.selling_price` -> `accessories.sale_price`
- `accessory_stock_in.purchase_price` -> `accessory_stock_in.purchase_cost`
- `accessory_stock_in.stock_in_date` -> `accessory_stock_in.inventory_time`

迁移前后 `accessories` 记录数均为 1、入库记录数均为 2；配件成本合计均为 `30.00`、售价合计均为 `50.00`，入库成本合计均为 `60.00`，入库时间非空记录数均为 2。索引由 MySQL 随列改名保留，未删除或填充业务数据。

## 手机与销售物理列迁移（2026-08-27）

迁移脚本：`backend/scripts/migrate-phone-sales-columns.js`。脚本默认只读预检，只有显式传入 `--execute` 才执行改名；脚本会在改名前后核对表行数、时间字段空值数和金额合计，不执行 `DELETE`、`DROP`、`TRUNCATE` 或数据填充。

计划改名：

- `phones.Inventorytime` -> `phones.inventory_time`
- `phones.salestime` -> `phones.sale_time`
- `sales.price` -> `sales.sale_price`
- `sales.cost` -> `sales.purchase_cost`
- `sales.sale_date` -> `sales.sale_time`

当前状态：应用层 SQL、迁移登记和真实数据库物理列改名均已完成；迁移前后行数、空值数量、金额合计及业务接口回归结果已补录。旧 API 请求字段仍只在登记的后端入口兼容层保留。

执行结果（2026-08-27）：真实数据库改名和数据核验已完成。`phones` 行数为 `16232`，`sales` 行数为 `15471`；手机 `inventory_time`/`sale_time` 空值数为 `8`/`86`，销售 `sale_price`/`purchase_cost` 空值数为 `88`/`79`，`sale_time` 空值数为 `0`；销售售价合计 `72968094.00`、采购成本合计 `71972076.00`，均与改名前一致。旧列未删除数据，而是通过 `RENAME COLUMN` 保留原值并完成物理字段改名。
