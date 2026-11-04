# 第三批：兼容适配接口退役记录

> 文档类型：接口退役归档记录
> 批次状态：观察中，暂不删除
> 接口数量：10
> 当前任务入口：[全局技术债务进度 T6](../../development/TECHNICAL_DEBT_PROGRESS.md)

本批接口同时使用 `compatibilityRoute` 和 `deprecatedRoute`，承担旧权限、参数或响应形状转换。生产兼容访问日志必须覆盖完整发布周期后，才能逐项评估删除。

| 方法与路径 | compatibility ID | migration ID | 标准入口 |
| --- | --- | --- | --- |
| `GET /api/query/models` | `query-models` | `query-models-to-models` | `GET /api/models?all=true&active_only=true` |
| `GET /api/brands/:brandId/models` | `brands-models-by-brand` | `brand-models-to-models` | `GET /api/models?all=true&brand_id=:brandId` |
| `GET /api/phones/brands` | `phones-reference-brands` | `phones-brands-to-brands` | `GET /api/brands?all=true` |
| `GET /api/phones/models` | `phones-reference-models` | `phones-models-to-models` | `GET /api/models?all=true` |
| `GET /api/phones/colors` | `phones-reference-colors` | `phones-colors-to-colors` | `GET /api/colors?all=true` |
| `GET /api/phones/memories` | `phones-reference-memories` | `phones-memories-to-memories` | `GET /api/memories?all=true` |
| `GET /api/shop/base-data/brands` | `shop-base-data-brands` | `shop-base-data-brands-to-brands` | `GET /api/brands?all=true` |
| `GET /api/shop/base-data/models` | `shop-base-data-models` | `shop-base-data-models-to-models` | `GET /api/models?all=true` |
| `GET /api/shop/base-data/colors` | `shop-base-data-colors` | `shop-base-data-colors-to-colors` | `GET /api/colors?all=true` |
| `GET /api/shop/base-data/memories` | `shop-base-data-memories` | `shop-base-data-memories-to-memories` | `GET /api/memories?all=true` |

## 删除记录

- 删除前标签：待填写
- 删除 commit：待填写
- 兼容日志观察开始版本：待填写
- 完整观察周期：待填写
- 各 compatibility ID 访问次数：待填写
- 权限/响应契约测试：待填写
- 受影响页面或外部客户端：待填写
- 回滚结果：待填写
