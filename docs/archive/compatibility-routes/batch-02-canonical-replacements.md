# 第二批：明确标准替代接口退役记录

> 文档类型：接口退役归档记录
> 批次状态：代码已删除，待提交和部署观察
> 接口数量：5
> 当前任务入口：[全局技术债务进度 T6](../../development/TECHNICAL_DEBT_PROGRESS.md)

本批接口已有明确标准入口，本站调用已经迁移，旧路由已删除。规范入口仍必须维持本人范围、业务用户、CSRF 和权限边界；部署后重点回归这些契约。

| 方法与路径 | migration ID | 标准入口 | 原权限/边界 |
| --- | --- | --- | --- |
| `GET /api/operators` | `operators-to-users-operators` | `GET /api/users/operators` | `sales:view` 或 `inventory:view`，旧精简响应 |
| `GET /api/analytics/sales-trends` | `sales-trends-to-sales-trends-canonical` | `GET /api/analytics/sales/trends` | 业务用户及门店范围 |
| `GET /api/csrf/csrf-token` | `csrf-token-to-token` | `GET /api/csrf/token` | CSRF 获取语义一致 |
| `GET /api/attendance/my` | `attendance-my-to-list` | `GET /api/attendance` | `attendance:view:own` 本人范围 |
| `GET /api/salary-records/my` | `salary-records-my-to-list` | `GET /api/salary-records` | `salary-records:view:own` 本人及字段范围 |

## 删除记录

- 删除前标签：`compat-routes-before-removal-20261104`
- 删除 commit：待填写
- 代码删除日期：2026-11-04
- 权限/响应契约测试：静态与定向契约测试通过；部署后继续回归
- 本站调用：0
- 部署版本与时间：待提交部署后填写
- 旧路径访问次数：待部署观察
- 受影响页面或客户端：本站未发现；外部客户端未知
- 回滚结果：待填写
