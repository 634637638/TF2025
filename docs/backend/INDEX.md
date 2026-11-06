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
- [导航站接口](guide-navigation-api.md) - `/DH` 公开导航、`/guide` 管理接口、密码策略和二维码存储
- [安全文件访问](secure-file-access-standard.md) - 私有文件受控访问、短时签名、静态目录边界和生命周期
- [商城地图与支付服务配置](shop-provider-config-standard.md) - provider 配置、密钥加密、公开字段白名单与支付接入边界
- [站内公告](site-announcements.md) - 管理/员工 API、权限及数据库迁移
- [备份管理](backup-management.md) - 数据库单独备份、完整备份、下载与恢复边界

## 契约测试

运行 `npm test`（工作目录 `backend`）执行后端契约测试。测试集中在 `backend/test/*.check.js`，其中契约检查覆盖 API 字段、分页、安全校验、权限和事务行为。修改业务实现时应更新对应断言，描述当前要求而非已淘汰的实现细节；涉及销售/预定状态和权限时，需断言事务锁、服务端状态校验及操作权限。

真实数据库用例通过 `npm run test:db` 单独运行，默认要求独立测试库。14 项用例、样本、事务清理，以及已备份且明确授权时的显式业务库模式见 [后端数据库回归测试](database-testing.md)；普通测试的跳过不能计作真实数据库通过。

`MIGRATION_PLAN.md` 与 `MIGRATION_REPORT.md` 是迁移历史资料；执行数据库操作前，以当前迁移脚本、数据库资料和备份流程为准。
