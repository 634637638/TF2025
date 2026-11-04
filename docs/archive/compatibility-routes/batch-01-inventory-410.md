# 第一批：库存 410 接口退役记录

> 文档类型：接口退役归档记录
> 批次状态：待观察后删除
> 接口数量：7
> 当前任务入口：[全局技术债务进度 T6](../../development/TECHNICAL_DEBT_PROGRESS.md)

本批入口已经返回 `410 Gone`，仓库前端未发现调用，是优先删除候选。删除后旧路径会从明确的 410 变为 404，因此仍需完整发布周期观察和日志证据。

| 方法与路径 | migration ID | 替代入口 | 权限 |
| --- | --- | --- | --- |
| `GET /api/inventory/:id/movements` | `inventory-movements-unimplemented` | 无；真实库存流水尚未实现 | `inventory:view` |
| `POST /api/inventory/:id/stock-in` | `inventory-item-stock-in-to-stock-in` | `POST /api/stock-in` | `inventory:create` |
| `POST /api/inventory/:id/stock-out` | `inventory-item-stock-out-unimplemented` | 无 | `inventory:edit` |
| `POST /api/inventory/:id/reserve` | `inventory-item-reserve-unimplemented` | 无 | `inventory:edit` |
| `POST /api/inventory/:id/unreserve` | `inventory-item-unreserve-unimplemented` | 无 | `inventory:edit` |
| `PUT /api/inventory/:id/adjust` | `inventory-item-adjust-unimplemented` | 无 | `inventory:edit` |
| `POST /api/inventory/stock-in` | `inventory-stock-in-to-stock-in` | `POST /api/stock-in` | `inventory:create` |

## 删除记录

- 删除前标签：待填写
- 删除 commit：待填写
- 部署版本与时间：待填写
- 完整观察周期：待填写
- 旧路径访问次数：待填写
- 受影响页面或客户端：待填写
- 回滚结果：待填写
