# 数据库文档索引

本目录提供字段契约、结构专题和迁移状态入口。版本化 DDL 基线由 `backend/scripts/migrate-schema.js` 统一编排，独立专项脚本仍保留自己的预览与执行边界；本目录不等同于生产数据库快照。

- 生产应用进程不执行 DDL。`SCHEMA_MIGRATION_MODE=true` 仅与 `backend/scripts/migrate-*.js` 显式维护入口配合使用；普通 API 进程即使误配该变量也不获得 schema 变更授权。
- schema baseline 和独立数据库验收分别见[后端索引](../backend/INDEX.md)及[后端数据库回归测试](../backend/database-testing.md)。

- [数据库结构与模块资料入口](DATABASE_MODULE_MAPPING.md)
- [T22 本批结构迁移顺序](../backend/accessory-entry.md#t22-本批结构迁移顺序) - 复用既有脚本的9项执行方案、共同结算前置、完整可恢复备份及失败/回退边界；方案不代表执行授权或迁移完成
- [采购入库原资料字段](../backend/accessory-entry.md#采购入库原资料留存) - 原采购表追加可空 `product_snapshot JSON`，旧单不回填、有原资料禁止删列回退；已于2026-11-14授权迁移回读，真实业务未验收
- [贴膜基础迁移](../backend/accessory-entry.md#原贴膜基础迁移与兼容) - 类型兼容列与服务事实表已迁移回读；当前模板开关、免费匹配及本次手机关联的[模板匹配扩展](../backend/accessory-entry.md#模板匹配扩展迁移)5列也已于2026-11-15授权迁移回读，真实业务未验收
- 站内公告数据库结构和迁移边界见[站内公告接口说明](../backend/site-announcements.md)。
- [字段统一迁移进度](field-consistency-progress.md)
- [字段一致性迁移记录](field-consistency-migration.md) - 按日期记录的历史核验
- [字段兼容清单](field-compatibility-inventory.md) - 契约迁移与退役字段记录
- [配件档案及入库字段](../backend/accessory-entry.md) - `product_model`、模板品牌库存 `template_id`、品牌/供应商 `business_scope` 迁移、冗余规格字段移除与受控恢复、SN追踪、混合库存/划拨、模板预警 `min_stock`、总仓设置及采购数据边界；新增[采购付款追加历史](../payments/SUPPLIER_PAYMENT_BATCH_STANDARD.md#商品采购整单货款2026-11-13)及[批次库存流水](../backend/accessory-entry.md#批次库存流水与入库用途2026-11-13)后共十二张专用表
- [客户表结构文档](customers-table-schema.md)
- [客户销售积分统一规范](../guides/customer-points-standard.md) - `customers.points` 与 `sales` 逐单积分凭据；来源/分配账与共同结算抵扣，新增售后追加凭据表的原来源返分、优惠追回/补退、受控迁移及商品退货事务边界
- [收款方式字段迁移](../guides/sales-transfer-transaction-standards.md#收款方式字段迁移) - `payment_records.payment_method`旧枚举改为20字符文本，保留原数据，逐台手机收款关联真实`sales.id`，不重建订单头
- [共同结算结构迁移](../guides/sales-transfer-transaction-standards.md#共同结算结构迁移) - 复用 `sales_orders`、新增 `sales_order_items`，收款新增 `sales_order_id` 且保留旧手机销售关联；受控迁移及有历史拒绝回退
- [商品原批次返库字段](../backend/accessory-entry.md#商品原批次返库事务基础) - 原库存流水扩展返库事件与三个可空追溯/幂等字段，不新增平行库存；2026-11-14已迁移回读，真实业务未验收，有历史禁止回退
- [商品售后凭据迁移](../guides/sales-transfer-transaction-standards.md#商品售后凭据迁移) - 追加 `sales_aftersales/sales_aftersale_items/sales_goods_exchanges/sales_goods_exchange_additions`，支持原表原地增加 phone_return/goods_exchange、gift_charge_cents/replacement_cents/additional_cents 及换货根关系，v2-v4逐行JSON保留旧版本；原销售/收款事实保留，默认零写预览、有历史禁止回退；本次新增结构仍需按迁移脚本预览并在授权后执行
- [商品提成核销结构](../business/salary-record-standard.md#核销结构迁移与回滚) - `salary_records.goods_commission_snapshot`及`salary_goods_settlements`，全局唯一来源、原工资RESTRICT关联、元数据确定整数类型及受控备份/回退；正式工资金额/保存/发放及页面已接入代码，已迁移回读，真实工资未验收

客户销售积分字段迁移使用 `npm --prefix backend run migrate:customer-sale-points` 预览，确认目标和备份后才可追加 `-- --apply`；应用请求进程不执行该 DDL。

相关入口：

- 字段/API 契约：`backend/scripts/config/field-contracts.json`
- 后端数据库连接：`backend/src/config/database.js`
- [后端数据库回归测试](../backend/database-testing.md) - 独立测试库、明确授权的业务库模式、14 项用例及回滚/只读复核方法
- 部署环境变量与密钥：[环境配置与密钥管理](../security/ENVIRONMENT_SECRETS.md)
- [权限数据模型](../permissions/INDEX.md)
- [部署文档](../deployment/INDEX.md)
