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

旧版本索引如果没有 `is_new`，同一规格无法同时保存全新和二手两条预警配置，会触发数据库重复键错误。后端公共结构检查会自动将旧索引升级为 `unique_brand_model_color_memory_condition`。

## 接口行为

- 新增或编辑遇到完全相同的五维组合时返回 `400`，提示配置已存在。
- 数据库连接、字段缺失等真正的基础设施错误才返回 `500`。
- 前端可以通过 `condition_values` 批量生成全部、全新、二手的规格组合。

相关实现：

- `backend/src/utils/phone-stock-warning-schema.js`
- `backend/src/services/phone-stock-warning.service.js`
- `backend/src/repositories/phone-stock-warning.repository.js`
