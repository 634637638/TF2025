# 第一批：库存 410 接口退役记录

> 文档类型：接口退役归档记录
> 批次状态：代码已删除，待提交和部署观察
> 接口数量：7
> 当前任务入口：[全局技术债务进度 T6](../../development/TECHNICAL_DEBT_PROGRESS.md)

本批入口删除前返回 `410 Gone`，仓库前端未发现调用。当前旧路径已变为 404；部署后需观察错误上报和外部访问来源。

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

- 删除前标签：`compat-routes-before-removal-20261104`
- 删除 commit：待填写
- 代码删除日期：2026-11-04
- 本站调用：0
- 部署版本与时间：待提交部署后填写
- 旧路径访问次数：待部署观察
- 受影响页面或客户端：本站未发现；外部客户端未知
- 回滚结果：待填写
