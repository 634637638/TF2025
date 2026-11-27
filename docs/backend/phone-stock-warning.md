# 手机库存预警配置

手机库存预警配置按以下五个维度唯一识别：

`品牌 + 型号 + 颜色 + 内存 + 库存类型`

其中库存类型由 `is_new` 表示：

- `1`：全新
- `0`：二手
- `NULL`：全部库存

## 数据库约束

`phone_stock_warnings` 的唯一索引必须包含 `is_new`：

```text
brand_id, model_id, color_id, memory_id, is_new
```

旧版本索引如果没有 `is_new`，同一规格无法同时保存全新和二手两条预警配置，会触发数据库重复键错误。公共结构工具提供升级为 `unique_brand_model_color_memory_condition` 的实现，执行受 schema 变更策略限制；普通生产请求不得自行执行DDL，真实结构变更须显式授权。

## 接口行为

- 新增或编辑遇到完全相同的五维组合时返回 `400`，提示配置已存在。
- 数据库连接、字段缺失等真正的基础设施错误才返回 `500`。
- 前端可以通过 `condition_values` 批量生成全部、全新、二手的规格组合。

- 创建、编辑在仓储访问前复用公共 `parseInput`：品牌/型号与可选颜色/内存ID为完整正整数，阈值为0–100整数，状态为0/1，启停接受明确布尔/0/1。名称最多100字单行，备注最多500字可多行；非法类型、混输数字及数组条目返回400，不产生仓储副作用。
- `backend/test/admin-input.check.js` 保留拒绝矩阵；静态审计及替身测试不替代数据库唯一约束验收。

经营分析读取 `GET /api/analytics/inventory/low-stock` 时，响应以 `brand`、`model`、`color`、`memory` 和 `condition_label` 分别返回品牌、型号、颜色、内存和成色。内存缺失返回 `null`，成色按预警范围返回「全新」「二手」或「全部」。查询使用 `analytics:view`、`inventory:view` 和现有门店范围。

相关实现：

- `backend/src/utils/phone-stock-warning-schema.js`
- `backend/src/services/phone-stock-warning.service.js`
- `backend/src/repositories/phone-stock-warning.repository.js`
