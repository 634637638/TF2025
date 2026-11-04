# 第二批：明确标准替代接口退役记录

> 文档类型：接口退役归档记录
> 批次状态：待权限与响应契约验证
> 接口数量：5
> 当前任务入口：[全局技术债务进度 T6](../../development/TECHNICAL_DEBT_PROGRESS.md)

本批接口已有明确标准入口，但旧路由仍保留本人范围、业务用户或旧响应语义。删除前必须验证标准入口不会缩小原合法权限或扩大数据范围。

| 方法与路径 | migration ID | 标准入口 | 原权限/边界 |
| --- | --- | --- | --- |
| `GET /api/operators` | `operators-to-users-operators` | `GET /api/users/operators` | `sales:view` 或 `inventory:view`，旧精简响应 |
| `GET /api/analytics/sales-trends` | `sales-trends-to-sales-trends-canonical` | `GET /api/analytics/sales/trends` | 业务用户及门店范围 |
| `GET /api/csrf/csrf-token` | `csrf-token-to-token` | `GET /api/csrf/token` | CSRF 获取语义一致 |
| `GET /api/attendance/my` | `attendance-my-to-list` | `GET /api/attendance` | `attendance:view:own` 本人范围 |
| `GET /api/salary-records/my` | `salary-records-my-to-list` | `GET /api/salary-records` | `salary-records:view:own` 本人及字段范围 |

## 删除记录

- 删除前标签：待填写
- 删除 commit：待填写
- 权限/响应契约测试：待填写
- 部署版本与时间：待填写
- 旧路径访问次数：待填写
- 受影响页面或客户端：待填写
- 回滚结果：待填写
