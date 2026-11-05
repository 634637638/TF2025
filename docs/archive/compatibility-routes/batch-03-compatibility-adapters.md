# 第三批：兼容适配接口退役记录

> 文档类型：接口退役归档记录
> 批次状态：代码已删除，待提交和部署观察
> 接口数量：10
> 当前任务入口：[全局技术债务进度 T6](../../development/TECHNICAL_DEBT_PROGRESS.md)

本批接口删除前同时使用 `compatibilityRoute` 和 `deprecatedRoute`，承担旧权限、参数或响应形状转换。本站调用已迁移，旧入口及两类中间件均已删除；部署后需回归规范资源路由的授权和响应。

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

- 删除前标签：`compat-routes-before-removal-20261104`
- 删除 commit：待填写
- 代码删除日期：2026-11-04
- 本站调用：0
- 各历史 compatibility ID 访问次数：待部署后从反向代理和错误日志观察
- 权限/响应契约测试：定向契约测试通过；部署后继续回归
- 受影响页面或外部客户端：本站未发现；外部客户端未知
- 回滚结果：待填写
