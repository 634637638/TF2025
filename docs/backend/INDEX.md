# 后端文档索引

## 📚 核心文档

- [手机与商品单据编号规则](../guides/sales-transfer-transaction-standards.md#商品与共同单号) - 手机采购按北京时间分钟和四位序号生成 `PO`；商品销售/赠送、商品入库批次及共同订单分别使用日序号 `PS`、`RK`、`SO`；手机销售、批发和供应商划拨沿用原规则

- [首页快捷方式配置](dashboard-shortcuts.md) - 站点信息管理、全站页面目录/功能分组、既有settings JSON、权限过滤及非交易跳转

- [商品库存原入库更正](accessory-entry.md#商品库存原入库更正) - 同一入库弹窗更正原批数量/成本/供应商等，原单冲回与替代采购同事务、SN及付款保护；2026-11-14已授权结构迁移回读，历史缺来源单及真实业务未验收

- [商品库存盘点](accessory-entry.md#商品库存盘点) - 普通数量采购批次按当前门店实物结存盘点，独立审计与 `stock_correct` 流水、幂等重试、SN/历史来源保护；2026-11-15已授权云端结构迁移并回读，真实盘点待验收

- [配件发布前结构核对](accessory-entry.md#发布前结构核对) - 复用15项迁移预览、缺项/依赖报告、无参数只读命令及退出码；2026-11-15回读14项ready，唯一pending为贴膜撤销，检查不执行迁移或替代业务验收
- [贴膜撤销内部事务与迁移](accessory-entry.md#贴膜撤销内部事务与迁移) - 整次服务按是否实际使用返库、资金/积分及原提成凭据、唯一撤销关联及受控迁移；未接HTTP/页面、未执行云端迁移
- [T22 本批结构迁移顺序](accessory-entry.md#t22-本批结构迁移顺序) - 采购防重/原资料、积分、返库、售后、工资及贴膜的9项受控执行顺序；完整备份与摘要区分、失败停止和已用凭据保护
- [采购入库防重与异常恢复](accessory-entry.md#采购入库防重与异常恢复) - 原采购追加请求唯一键、普通/SN同事务防重、原回执和标签页会话恢复；已于2026-11-14授权迁移回读，真实业务未验收
- [采购入库原资料留存](accessory-entry.md#采购入库原资料留存) - 原事务锁定真实商品/供应商/原门店资料，原名检索、旧单来源标记及统一脱敏；JSON字段已于2026-11-14授权迁移回读，真实业务未验收

- [原采购单退供核对及原价试算](accessory-entry.md#原采购单退供核对) - 同一只读快照及唯一分配器，逐行核对原采购/实际商品/授权当前店/SN，历史未知不补造；尚未执行退供或退款

- [Claude 指令](CLAUDE.md) - AI 开发指令
- [贴膜服务后端与模板匹配](accessory-entry.md#贴膜服务后端与模板匹配) - 综合查询查看/贴膜独立授权，专用候选与结算接口不开放商品管理页面；多型号共用免费模板、当前手机及服务门店、自动匹配/收费选品与最小历史；新增5列已于2026-11-15授权迁移回读，后端已重启，模板待显式配置，撤销未接入、真实业务未验收
- [后端分层约束](../CLAUDE.md#统一实现与清理范围) - route/controller/service/repository 边界、Actor/BaseService/共享连接入口和 ARCH 棘轮
- [表单输入与服务端校验](../guides/api-standards.md#上传下载与表单) - 按字段语义验证类型、格式、范围和精度；包含设备编码、手机入库及Excel输入边界；公共实现与验收见表单规范、智能导入说明与 T23
- [生产故障邮件告警](error-alerting.md) - 严重事件、高频聚合、独立 SMTP、默认关闭、手动生产配置与收件验收；进度见 T5
- [性能数值集中上报](performance-reporting.md) - INP、统一请求、固定采样、限流和无数据库聚合；进度见 T10
- [版本化五级地区与客户地址](region-address.md) - 2023年固定资源、独立字段、权限、查询导出及受控迁移；进度见 T16
- [地区 OpenAPI 试点](openapi-pilot.md) - 唯一机器契约、前端类型生成、漂移门禁及本机 HTTP 契约；进度见 T12
- [分层任务 T17](../development/TECHNICAL_DEBT_PROGRESS.md) - 唯一当前进度与实测债务
- [迁移计划](MIGRATION_PLAN.md) - 系统迁移方案
- [迁移报告](MIGRATION_REPORT.md) - 迁移执行记录
- [菜单 API 规范](menu-api-specification.md) - 菜单接口说明
- [菜单图标管理](../frontend/menu-icon-management-standard.md) - 站内批量 JSON 预览、官方 SVG 转换、在线选择保存有效 SVG、失败拒绝写入及菜单本地显示
- [设备状态统一规范](phone-status-standard.md) - 状态归一化、未取消销售的唯一当前归属、历史共同单保护、预订和租赁边界
- [系统退库联合手机售后查询](../business/inventory/transaction-reversal.md#系统退库列表的联合售后记录) - 旧日志/新凭据合并只读快照、双门店、整单退款/补款、来源ID与旧编辑删除保护；公共处理意向登记，不执行线下返厂或报废
- [退库与交易撤销](../business/inventory/transaction-reversal.md) - 积分冲回、退库明细、退款记录及数据库升级
- [全局支付方式与渠道](../frontend/payment-method-standard.md) - 前后端唯一配置 `backend/src/config/payment-methods.json`，退库复用方式、渠道及组合校验
- [手机逐台销售与收款](../guides/sales-transfer-transaction-standards.md#批量销售落账与收款) - 批量公共备注、零售类型、真实销售ID关联、同事务回滚及收款方式字段迁移
- [手机与商品共同结算](../guides/sales-transfer-transaction-standards.md#手机与商品共同结算) - 复用订单头及逐行快照、搭售关联手机销售ID、同事务SN/库存/收款/积分、持久幂等、单卖/手机搭售/快速出库配件页面、只读会员摘要、SN精确候选、一键商品积分试算及旧售后保护；商品积分抵扣、商品/共同手机退货及商品换货办理已接入，商品工资代码及结构已接入，真实业务待验收
- [积分来源与消费分配账](../guides/customer-points-standard.md#积分来源与消费分配账) - 复用手机/商品公共积分入口、追加来源/分配账、历史余额隔离、已消费保护及迁移；共同结算商品明细消费、先扣后发及历史余额隔离
- [积分售后记账](../guides/customer-points-standard.md#积分售后追加账) - 原奖励冲回、已用优惠追回、原来源返分及已追回金额补退；商品/共同手机退货及商品换货已接同事务，售后结构已迁移回读，真实业务未验收
- [商品原单退货](../guides/sales-transfer-transaction-standards.md#商品原单退货) - 分次/SN退回、原积分及退款/补款确认、持久幂等和双门店范围；新增售后头/明细受控结构已迁移回读，真实业务未验收
- [商品换货及办理入口](../guides/sales-transfer-transaction-standards.md#商品换货内部事务) - 同连接旧件返库/新件出库、连续替换链、v3净差价及逐源积分截止；换货HTTP、综合查询入口及真实关系核验的历史已接入，独立exchange权限，售后结构已迁移回读，真实业务未验收
- [手机与关联商品退货](../guides/sales-transfer-transaction-standards.md#手机与关联商品退货) - 原单/实物/赠品扣款分离、积分追回补退、一次净资金确认、v2逐行凭据及受控升级；2026-11-14已迁移回读，真实业务未验收
- [手机退货原单核对](../guides/sales-transfer-transaction-standards.md#手机退货原单核对) - 当前手机定位、关联配件已退/剩余、原SN及可退SN、原快照单位及字段权限；核对表区分无SN，办理标题随退回数量联动，保留旧删除式退库保护；2026-11-14已迁移回读，真实业务未验收
- [商品售后历史查询](../guides/sales-transfer-transaction-standards.md#商品售后历史查询) - 原商品明细的只读分页历史、逐行资金归属与同单互抵、双门店范围、资金/积分脱敏及详情展示
- [上传文件存储与迁移规范](upload-storage-standard.md) - 国补、手机媒体、H5 商城目录及部署要求
- [手机媒体接口统一说明](phone-media-api-unification.md) - canonical 路由、兼容迁移和权限边界
- [维修设备关联规范](repairs-device-link.md) - IMEI/序列号检索、手动录入和维修设备字段迁移
- [配件公共资料与采购入库](accessory-entry.md) - 配件分类、共享主档、品牌/供应商范围、商品模板/采购入库、批次用途与成本流水及字段迁移边界
- [当前批次库存查询](accessory-entry.md#当前批次库存查询) - 配件详情按当前门店/实际品牌核对原批次余额，复用只读快照与字段权限，输出编号归一及准确错误提示；2026-11-14完成云端只读回读，未新增表或执行真实写入验收
- [一个模板管理多种颜色](accessory-entry.md#一个模板管理多种颜色) - 新旧模板及商品档案多色维护、对应条码、逐色数量/SN共价及共用入库时间、库存查询；整组事务与防重恢复复用现有结构，旧模板扩色保留原交易身份，2026-11-15已授权关系表迁移回读，真实业务待验收
- [商品库存与模板组合筛选](accessory-entry.md#商品库存与模板组合筛选) - 公共检索与颜色后的独立状态、类型/品牌/适配型号/颜色组合、模板关联品牌的门店范围、字段权限及分页
- [库存读取、预警与类型统计](accessory-entry.md#库存读取预警与类型统计) - 授权店实际余量、模板共享资料与多品牌、RR读取、零库存/零阈值及派生字段权限；隔离回归不代替MySQL验收
- [商品原批次返库](accessory-entry.md#商品原批次返库事务基础) - 原销售批次/SN/用途返还、幂等及流水扩展迁移；商品及共同手机退货同事务调用，商品工资接入见工资契约
- [工资快照与商品提成凭据](../business/salary-record-standard.md) - 已发不可覆盖、首次发放幂等、考勤和批量跳过、同连接锁；商品成交/售后凭据、工资模板、正式金额保存/发放及页面已接入代码，含受控迁移/回滚；云端结构已迁移回读，真实工资未验收
- [商品提成工资来源核对](../business/salary-record-standard.md#商品提成工资来源核对) - 内部只读一致性快照、全部历史游标、原成交及分次售后核验、稳定来源键和摘要；已供正式工资金额及核销编排复用，保留历史不补算
- [商品提成核销规划与内部追加账](../business/salary-record-standard.md#商品提成核销规划与内部追加账) - 逐源唯一核销、已发快照双向核验、草稿变化拒绝、当月净结及跨月原工资关联；正式工资保存/发放与字段权限页面已接入，云端结构已于2026-11-14迁移回读，真实数据库业务验收未执行
- [综合查询商品模式](accessory-entry.md#综合查询商品模式) - 商品销售/赠送分页、原单快照、关联手机及采购批次追溯；单次列表/详情/凭证/售后链共用只读一致性快照，双模块查看权限与字段脱敏
- [客户商品购买及赠送历史](accessory-entry.md#客户商品购买及赠送历史) - 客户ID定向分页、原销售门店范围、三模块查看权限和商品字段脱敏，复用整单入口，原手机统计保持原口径
- [商品采购货款结算](../payments/SUPPLIER_PAYMENT_BATCH_STANDARD.md#商品采购整单货款2026-11-13) - 整单应付、登记/撤销完整付款链核验、历史只读一致性快照、统一权限、门店范围及流水表迁移
- [供应商详情采购统计](../payments/SUPPLIER_PAYMENT_BATCH_STANDARD.md#供应商详情采购统计) - 原采购数量/总额、跨来源权限与门店范围、未知金额及历史删除保护
- [手机库存预警配置](phone-stock-warning.md) - 品牌、型号、颜色、内存和库存类型的唯一配置规则
- [导航站接口](guide-navigation-api.md) - `/DH` 公开导航、`/guide` 管理接口、密码策略和二维码存储
- [安全文件访问](secure-file-access-standard.md) - 私有文件受控访问、短时签名、静态目录边界和生命周期
- [商城地图与支付服务配置](shop-provider-config-standard.md) - provider 配置、密钥加密、公开字段白名单与支付接入边界
- [站内公告](site-announcements.md) - 管理/员工 API、权限及数据库迁移
- [备份管理](backup-management.md) - 数据库/完整备份、定时生成与本地保留数量、多账户阿里云盘自动上传、文件管理与下载恢复边界

## 架构审计入口

基础实现位于 `backend/src/types/actor.js`、`backend/src/core/base/base.service.js`、`backend/src/core/db/connection.js`。分层配置与锚点在 `backend/scripts/config/backend-route-architecture.json`；运行 `node frontend/scripts/check-route-architecture.mjs` 单独核验，或运行 `npm --prefix frontend run check:backend-security` 联合安全审计。规则以开发指南正文为准，迁移后同步 T17、逐文件台账和历史锚点。

公共实现复用：颜色/内存管理共享 `backend/src/services/reference-management.service.js` 与固定业务域白名单仓储；分页、排序纯函数的唯一实现位于 `backend/src/utils/reference-options.js`，既有 `reference-options.service.js` 保留重导出；仓储不得反向依赖 service。同步动态表名统一复用 `backend/src/utils/database-identifier.js`。综合查询的选项组合由 `QueryService` 编排，退库/删除的事务与积分冲回由 `QueryMutationService` 编排，SQL 留在 `QueryRepository`。各批实测与验收结果只登记在 T17。

价目采集的纯匹配复用 `price-product-matcher.service.js`，外部搜索词、结果识别及检索地址复用 `price-source-parser.service.js`；主服务保留原公共委托及数据库、请求和会话编排。职责与正式回归入口见[报价采集归一化规范](../sync/price-list-normalization-standard.md#匹配逻辑职责与回归)，分批进度登记T13。

提醒/分享字段权限共同使用 `backend/src/services/field-access.service.js`（权限读取、递归脱敏、隐藏写入判定）及 `backend/src/middleware/field-access.js`（HTTP 拒绝和异常转交），业务域保留字段映射与特殊别名规则；边界和回归入口见[字段权限指南](../frontend/field-permission-guide.md)。公共逻辑去重证据登记在 T19。

OCR 公共入口为 `backend/src/utils/ocr-image.js`：图片 Buffer 由 sharp 预处理，Tesseract 7 的 Node worker/WASM 使用英文 traineddata，后端不依赖 Node canvas。语言缓存相对进程工作目录解析，不能把语言资源当作无引用 JS 包随意删除；依赖四维核查、真实合成图片回读和包清理证据见唯一任务台账 T18。

## 契约测试

运行 `npm test`（工作目录 `backend`）执行后端契约测试。测试集中在 `backend/test/*.check.js`，其中契约检查覆盖 API 字段、分页、安全校验、权限和事务行为。修改业务实现时应更新对应断言，描述当前要求而非已淘汰的实现细节；涉及销售/预定状态和权限时，需断言事务锁、服务端状态校验及操作权限。

真实数据库用例通过 `npm run test:db` 单独运行，默认要求独立测试库。14 项用例、样本、事务清理，以及已备份且明确授权时的显式业务库模式见 [后端数据库回归测试](database-testing.md)；普通测试的跳过不能计作真实数据库通过。

`MIGRATION_PLAN.md` 与 `MIGRATION_REPORT.md` 是迁移历史资料；执行数据库操作前，以当前迁移脚本、数据库资料和备份流程为准。

综合查询商品模式独立权限及共享出库鉴权见[商品模式](accessory-entry.md#综合查询商品模式)，贴膜不要求商品管理页面权限。
