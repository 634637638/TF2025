# 后端文档索引

## 📚 核心文档

- [Claude 指令](CLAUDE.md) - AI 开发指令
- [后端分层约束](../CLAUDE.md#统一实现与清理范围) - route/controller/service/repository 边界、Actor/BaseService/共享连接入口和 ARCH 棘轮
- [分层任务 T17](../development/TECHNICAL_DEBT_PROGRESS.md) - 唯一当前进度与实测债务
- [迁移计划](MIGRATION_PLAN.md) - 系统迁移方案
- [迁移报告](MIGRATION_REPORT.md) - 迁移执行记录
- [菜单 API 规范](menu-api-specification.md) - 菜单接口说明
- [设备状态统一规范](phone-status-standard.md) - 状态归一化、预订、销售和租赁边界
- [退库与交易撤销](../business/inventory/transaction-reversal.md) - 积分冲回、退库明细、退款记录及数据库升级
- [全局支付方式与渠道](../frontend/payment-method-standard.md) - 前后端唯一配置 `backend/src/config/payment-methods.json`，退库复用方式、渠道及组合校验
- [上传文件存储与迁移规范](upload-storage-standard.md) - 国补、手机媒体、H5 商城目录及部署要求
- [手机媒体接口统一说明](phone-media-api-unification.md) - canonical 路由、兼容迁移和权限边界
- [维修设备关联规范](repairs-device-link.md) - IMEI/序列号检索、手动录入和维修设备字段迁移
- [手机库存预警配置](phone-stock-warning.md) - 品牌、型号、颜色、内存和库存类型的唯一配置规则
- [导航站接口](guide-navigation-api.md) - `/DH` 公开导航、`/guide` 管理接口、密码策略和二维码存储
- [安全文件访问](secure-file-access-standard.md) - 私有文件受控访问、短时签名、静态目录边界和生命周期
- [商城地图与支付服务配置](shop-provider-config-standard.md) - provider 配置、密钥加密、公开字段白名单与支付接入边界
- [站内公告](site-announcements.md) - 管理/员工 API、权限及数据库迁移
- [备份管理](backup-management.md) - 数据库单独备份、完整备份、下载与恢复边界

## 架构审计入口

基础实现位于 `backend/src/types/actor.js`、`backend/src/core/base/base.service.js`、`backend/src/core/db/connection.js`。分层配置与锚点在 `config/backend-route-architecture.json`；运行 `node frontend/scripts/check-route-architecture.mjs` 单独核验，或运行 `npm --prefix frontend run check:backend-security` 联合安全审计。规则以开发指南正文为准，迁移后同步 T17、逐文件台账和历史锚点。

公共实现复用：颜色/内存管理共享 `backend/src/services/reference-management.service.js` 与固定业务域白名单仓储；分页、排序纯函数的唯一实现位于 `backend/src/utils/reference-options.js`，既有 `reference-options.service.js` 保留重导出；仓储不得反向依赖 service。同步动态表名统一复用 `backend/src/utils/database-identifier.js`。综合查询的选项组合由 `QueryService` 编排，退库/删除的事务与积分冲回由 `QueryMutationService` 编排，SQL 留在 `QueryRepository`。各批实测与验收结果只登记在 T17。

提醒/分享字段权限共同使用 `backend/src/services/field-access.service.js`（权限读取、递归脱敏、隐藏写入判定）及 `backend/src/middleware/field-access.js`（HTTP 拒绝和异常转交），业务域保留字段映射与特殊别名规则；边界和回归入口见[字段权限指南](../frontend/field-permission-guide.md)。公共逻辑去重证据登记在 T19。

OCR 公共入口为 `backend/src/utils/ocr-image.js`：图片 Buffer 由 sharp 预处理，Tesseract 7 的 Node worker/WASM 使用英文 traineddata，后端不依赖 Node canvas。语言缓存相对进程工作目录解析，不能把语言资源当作无引用 JS 包随意删除；依赖四维核查、真实合成图片回读和包清理证据见唯一任务台账 T18。

## 契约测试

运行 `npm test`（工作目录 `backend`）执行后端契约测试。测试集中在 `backend/test/*.check.js`，其中契约检查覆盖 API 字段、分页、安全校验、权限和事务行为。修改业务实现时应更新对应断言，描述当前要求而非已淘汰的实现细节；涉及销售/预定状态和权限时，需断言事务锁、服务端状态校验及操作权限。

真实数据库用例通过 `npm run test:db` 单独运行，默认要求独立测试库。14 项用例、样本、事务清理，以及已备份且明确授权时的显式业务库模式见 [后端数据库回归测试](database-testing.md)；普通测试的跳过不能计作真实数据库通过。

`MIGRATION_PLAN.md` 与 `MIGRATION_REPORT.md` 是迁移历史资料；执行数据库操作前，以当前迁移脚本、数据库资料和备份流程为准。
