# 后端文档索引

## 📚 核心文档

- [Claude 指令](CLAUDE.md) - AI 开发指令
- [迁移计划](MIGRATION_PLAN.md) - 系统迁移方案
- [迁移报告](MIGRATION_REPORT.md) - 迁移执行记录
- [菜单 API 规范](menu-api-specification.md) - 菜单接口说明
- [设备状态统一规范](phone-status-standard.md) - 状态归一化、预订、销售和租赁边界
- [上传文件存储与迁移规范](upload-storage-standard.md) - 国补、手机媒体、H5 商城目录及部署要求
- [手机媒体接口统一说明](phone-media-api-unification.md) - canonical 路由、兼容迁移和权限边界
- [维修设备关联规范](repairs-device-link.md) - IMEI/序列号检索、手动录入和维修设备字段迁移
- [手机库存预警配置](phone-stock-warning.md) - 品牌、型号、颜色、内存和库存类型的唯一配置规则

## 契约测试

运行 `npm test`（工作目录 `backend`）执行后端契约测试。测试集中在 `backend/test/*.check.js`，其中契约检查覆盖 API 字段、分页、安全校验、权限和事务行为。修改业务实现时应更新对应断言，描述当前要求而非已淘汰的实现细节；涉及销售/预定状态和权限时，需断言事务锁、服务端状态校验及操作权限。

`MIGRATION_PLAN.md` 与 `MIGRATION_REPORT.md` 是迁移历史资料；执行数据库操作前，以当前迁移脚本、数据库资料和备份流程为准。
