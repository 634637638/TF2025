# 后端文档索引

## 📚 核心文档

- [Claude 指令](CLAUDE.md) - AI 开发指令
- [迁移计划](MIGRATION_PLAN.md) - 系统迁移方案
- [迁移报告](MIGRATION_REPORT.md) - 迁移执行记录
- [菜单 API 规范](menu-api-specification.md) - 菜单接口说明
- [上传文件存储与迁移规范](upload-storage-standard.md) - 国补、手机媒体、H5 商城目录及部署要求
- [维修设备关联规范](repairs-device-link.md) - IMEI/序列号检索、手动录入和维修设备字段迁移

## 契约测试

运行 `npm test`（工作目录 `backend`）执行后端契约测试。测试集中在 `backend/test/*.check.js`，其中 `transaction-contract.check.js` 覆盖 API 字段、分页、安全校验、权限和事务行为。修改业务或性能实现时应更新对应契约断言：断言应描述当前要求的行为，不应保留已淘汰的实现细节；涉及销售/预定状态和权限时，需断言事务锁、服务端状态校验及操作权限，不能为通过测试而放宽业务保护。
