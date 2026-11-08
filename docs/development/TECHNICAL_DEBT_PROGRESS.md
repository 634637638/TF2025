# 全局技术债务进度

本页包含历史进度和 2026-11-04 当前工作区复核结果。下方“当前待完善清单”是项目剩余技术任务的唯一汇总；其他带日期的审计、同事清单和聊天结论只能作为证据来源，不能建立第二份当前待办。

本文件是全局进度的唯一汇总入口。专项数据和处理细节仍记录在各自文档中；汇总状态必须以可重复执行的检查结果为依据。

## 2026-11-04 当前待完善清单（唯一汇总）

状态使用[代码审查标准](../guides/CODE_REVIEW_STANDARDS.md#完成状态分级)中的“阻断发布 / 本轮必须 / 观察期 / 后续债务 / 明确延期”。仓库数量、文件行数和测试数量会变化，执行任务时必须重新运行证据命令，不得复制旧快照。

| ID | 优先级 / 状态 | 当前证据与边界 | 建议动作 | 完成与回滚标准 |
| --- | --- | --- | --- | --- |
| T0 工作区收敛 | P0 / 本轮必须（发布前） | 2026-11-04 本轮最终核验时 `git status --porcelain` 为 48 个状态项，其中 40 个修改、7 个删除、1 个未跟踪正式测试；该数字不是固定基线 | 当前状态项属于本轮 28 个历史接口退役、契约测试和文档同步，核验后按真实功能批次提交；不得覆盖其他人的修改 | 已执行后端全量测试、前端发布门禁、文档检查和 `git diff --check`；本轮不自动提交，提交后把 commit 写回退役清单 |
| T1 生产密钥与支付密文部署确认 | P0 / 观察期 | [安全修复记录](../security/security-remediation-2026-11-04.md)最后一次预览仍有 1 条支付秘密读取 previous key；价格同步密钥轮换和数据重加密已完成，但云端 `.env.production` 是否已使用新密钥并完成后端重启需重新确认 | 只比对非敏感指纹或运行结果，确认云端 `PRICE_SYNC_ENCRYPTION_KEY` 后执行价格同步回读；支付密钥同步 current/previous 后先预览再执行 `migrate:config-encryption-key -- --apply` | 价格同步读取正常且不输出完整密钥；支付迁移 `requiresMigration=0`、逐条回读成功、迁移备份存在；失败时价格密钥切回上一版本并恢复轮换备份，支付密文使用脚本备份和旧 current/previous 回滚，禁止直接清空 previous |
| T2 前端错误日志独立限流 | P0 / 已完成（待部署验证） | `POST /api/logs/errors` 已在 `unifiedAuth` 后接入 5 分钟 60 次的专用限流，键为用户 ID + IP；正式安全回归测试已登记 | 部署后用测试账号验证正常上报和 429，不修改全局限流；观察真实错误峰值后再决定是否调整额度 | 不同用户互不占用额度，响应不含敏感字段；回滚只移除专用限流器，不改变统一上报入口 |
| T3 数据库迁移版本台账 | P1 / 已完成代码（待生产显式执行） | 已新增 `schema_migrations(id, name, checksum, applied_at, execution_time)` 和 `migrate:schema`；默认只读预览，只有 `--apply` 才执行，checksum 漂移与并发迁移会阻断；历史独立脚本未被自动重跑 | 生产先备份，再运行 `npm run migrate:schema` 预览，确认目标库后执行 `npm run migrate:schema -- --apply`；本轮未连接云库执行 | 重复执行不重跑、失败不登记完成；保留原迁移与回滚脚本。回滚应用前必须按受影响专项脚本或完整备份恢复兼容结构，不能删除迁移台账伪装未执行 |
| T4 生产自动备份与恢复演练 | P1 / 观察期（待生产确认） | 仓库提供手动备份、清理和下载；无法从源码判断云数据库、宝塔或系统 Cron 是否已有自动备份 | 先核对云数据库和服务器任务；缺失时优先使用托管备份或系统级 Cron 调用受控脚本，不在可能多实例运行的 Node 进程内直接加 `node-cron` | 记录调度、保留期、异地副本、失败告警和最近一次恢复演练；上线前保留现有手动备份入口作为回退 |
| T5 严重错误主动告警 | P1 / 后续债务 | 前端错误已持久化到 `frontend_error_logs`，后端也有 request ID 和文件日志；当前没有 Sentry、邮件或 Webhook 主动告警 | 先用可控 Webhook 试点，仅聚合 `critical` 或持续高频错误；再评估 Sentry | 5 分钟聚合、防告警风暴、带 request ID/环境/接口且不含密码、Token、Cookie 或请求体；告警服务失败不能影响业务请求 |
| T6 兼容路由部署观察 | P1 / 已完成代码（待部署验证） | 当前运行时弃用路由 0、兼容路由 0；28 条历史接口和兼容基础设施已删除，本站仓库旧调用 0；恢复标签和四批记录位于[历史兼容接口退役归档](../archive/compatibility-routes/INDEX.md) | 完成本轮提交后登记删除 commit，部署并观察旧路径 404、前端错误、反向代理来源和外部客户端反馈；规范接口继续做权限与页面回归 | 本站无旧调用且规范接口正常；外部调用未知必须如实保留。出现问题时按 `compat-routes-before-removal-20261104` 最小恢复或修正规范调用，不整批恢复 |
| T7 生产健康探针说明 | P1 / 已完成代码与文档（待生产监控确认） | `/live` 只检查进程存活；`/health` 在 1.5 秒超时内执行数据库 `SELECT 1`，依赖不可用返回 503；根路径和 `/api` 路径复用同一处理器 | 生产由云监控、宝塔或独立探针主动请求 `/health`，容器存活检查可用 `/live`；`proxy_next_upstream` 只做被动重试 | 部署后验证 `/live` 200、数据库正常时 `/health` 200、数据库不可用时 503，并确认监控告警；本地测试不能替代生产探针配置 |
| T8 依赖审计接入 CI | P1 / 后续债务 | 已有 `check:dependencies` 和 `check:release`，但仓库内没有 CI workflow | PR 阻断 high/critical，定时任务做完整扫描，发布执行 `check:release`；禁止用 `npm audit fix --force` 自动破坏依赖树 | CI 失败能阻断对应流程并保留报告；临时豁免必须登记依赖、CVE、到期日和替代控制 |
| T9 多实例前共享状态 | P2 / 扩容前置 | 当前生产配置为单实例 fork；通用缓存、登录失败计数、认证资料缓存和基础限流包含进程内状态 | 只有准备 cluster/多实例时迁 Redis；先定义哪些缓存可降级、哪些安全计数禁止降级 | 多实例并发验证共享计数、缓存失效和 Redis 故障路径；未完成前部署文档必须明确只支持单实例 |
| T10 性能指标集中上报 | P2 / 后续债务 | 已采集 FCP/LCP/FID/CLS/TTFB/TTI、资源与长任务并在业务运行时启动；`autoReport=false`，`/api/performance/report` 后端不存在 | 用 INP 替代 FID；选择正式性能端点或独立监控服务，通过统一 API、鉴权、CSRF、采样和限流上报 | 先以 5%–10% 采样试点，验证隐私、体积和失败降级；不得直接启用当前不存在的接口或让上报失败影响页面 |
| T11 浏览器 E2E 试点 | P2 / 后续债务 | 当前没有 Playwright/Cypress 真实浏览器主流程测试 | 在独立测试环境先覆盖登录、权限拒绝、销售测试单、库存状态和订单取消；支付只用沙箱或模拟网关 | 测试数据有唯一标记并可清理，失败保留截图/trace；不得连接真实支付或无授权写入业务库 |
| T12 OpenAPI 试点 | P2 / 后续债务 | 当前字段契约和 Markdown 文档丰富，但没有 OpenAPI 机器可读入口 | 选择一个稳定模块试点 schema、错误码、权限和前端类型生成，不立即覆盖全站 | 生成结果与现有契约测试一致，不建立第二套手写字段定义；试点收益明确后再扩展 |
| T13 大文件定向拆分 | P2 / 后续债务 | 后端仍有 5 个 2500–5000 行文件，前端仍有 13 个超过 2000 行的 View；行数本身不等于缺陷 | 先列独立变更原因、共享状态、事务/权限边界和测试覆盖，再按真实职责拆分；优先处理频繁修改且风险高的价目、分析和商城链路 | 拆分前后路由、权限、事务、字段、缓存和 UI 行为一致；禁止按固定行数切割、复制状态或制造循环依赖 |
| T14 Loading 存量例外收口 | P2 / 后续债务 | 2026-11-04 `check:loading` 通过：公共分层入口均已接入，仍有 1 个 `v-loading` 例外和 2 个全局长操作例外 | 逐项核对操作范围和可见反馈；只有公共局部 Loading 能保持相同行为时才迁移，并同步删除对应例外登记 | `check:loading`、相关交互测试和桌面/手机回归通过；不得造成全局与局部 Loading 叠加，回滚时恢复原行为及精确例外登记 |
| T15 入库范围、单号序列与生产 DDL 边界 | P1 / 代码已完成，待独立测试库验证 | 2026-11-05：入库编辑/删除改为事务锁定并将授权门店范围带入最终写语句；入库单号改为 `invoice_sequences` 按北京时间日期和 `PO` 类型锁定递增；生产 schema 变更只允许显式 `backend/scripts/migrate-*.js` 入口，普通应用进程即使误配迁移环境变量也无权执行 DDL | 在已迁移的独立测试库验证入库创建、跨门店拒绝、编辑/删除事务及多连接并发单号；生产发布前确认 `invoice_sequences` 已存在并保持 `SCHEMA_MIGRATION_MODE` 未配置 | 契约测试、并发分配单元测试及后端全量测试通过；真实数据库测试仅在独立测试库执行并记录清理回读。回滚应用版本不删除已分配序列；如需恢复旧单号生成逻辑，先评估已生成编号格式及重复风险 |
| T16 地址层级与地区数据契约 | P2 / 后续债务，未满足强制业务要求 | 客户编辑已完成省、市、县/区三级联动；现有 customers 契约只有 `province`、`city`、`address`，县/区暂与详细地址组合保存；业务要求必须提供完整省级、地级、县级、乡级（乡镇/街道）、村级（村委会/社区）选择数据，当前尚未满足 | 先确定可验证且获准使用的现行全量数据来源及更新责任，再设计唯一共享 `province/city/district/town/village` 类型、权限、API、独立字段和迁移回滚；数据量评估后选择按需加载或服务端查询，避免把完整村级全集塞入首屏包；在独立测试库验证历史地址回显及跨层级变更，不直接修改云端业务库 | 五级数据必须有明确覆盖口径、可追溯来源、版本/截止日期、许可及更新校验；省市县乡村均通过覆盖完整性测试；新增字段前完成前后端契约、权限审计、历史数据迁移、搜索/导出/隐私评估及浏览器回归；当前三级选择不得标记为完成 |
| T17 后端分层收敛 | P2 / 本轮四维代码治理完成，待环境验收 | 2026-11-08 提交后起点为 SQL 149、仓储直连 9、反向依赖 2、租借计数 73；本轮分批迁移后 AST 四项均为 0，route/事务/孤立 controller 仍为 0。租借分别登记：真实收编 73→13；独立语义修正 13→7（6 处池/已有连接误计）；6 处真实租借接共享 helper 并删除 1 处无调用旧入口后 7→0。全部归零台账键删除，max=0，历史锚点只追加 | 保持 controller→service→repository 与共享 withConnection；新业务继续受目标分支锚点和 AST 增长检查保护。当前本地 HEAD 已启用目标锚点比较，远程 PR 仍须按真实目标引用执行；本轮修改待一起提交 | 执行行为/权限/事务回归、后端全测、安全/分层及下载审计、严格 ESLint、字段/公共选项审计、类型/文档检查和 git diff --check；当前结果见本节末尾收口记录。未连接云端数据库，静态与替身测试不能替代数据库/浏览器验收 |

### T17 后端内联路由分批迁移

- 本批将 `GET /subsidy/phone-detail/:phoneId` 迁入 `SubsidyPhoneDetailController → SubsidyPhoneDetailService → SubsidyPhoneDetailRepository`，保留认证、`subsidy:view`、短缓存、非法 ID 400、未售设备 404、缺少销售记录的成功提示、三项销售/国补查询、补贴比例与上限计算及原响应字段。AST 实测 `subsidy.js` 从 8 降至 7，摘要按 AST 更新，route 内联 handler 总数从 26 降至 25；6 个非零遗留 key 与 6 个内联文件一致，`maxLegacyNonControllerRoutes` 等于基线总和。基础设施与全局 ARCH 门禁已实测通过，controller repository 直连基线为 14 条。未连接云端数据库或生产接口。
- 本批将 `PUT /permissions/toggle-visibility` 接入现有 `RolePermissionVisibilityController → RolePermissionVisibilityService → RolePermissionVisibilityRepository`，保留 `permissions:admin`、输入校验、schema 不支持时 400、可选 `created_at` 列、参数绑定和原响应字段；service 负责事务与连接释放。定向测试 7 项通过，覆盖路由权限、校验、schema 回退、写入分支、参数绑定、异常回滚和连接释放。后端全量测试 1243 通过、14 跳过、0 失败；后端安全与分层审计、字段一致性、严格 ESLint、文档检查及 `git diff --check` 通过。AST 实测 `permission-management.js` 从 10 降至 9，台账原有 count/digest 与源码不符也已按实测收口；总 handler 从 25 降至 24，6 个遗留 key 与 6 个内联文件一致。该路由直接连接租借基线从 6 降至 5，总基线为 175。未连接云端数据库或生产接口。
- 随后将 `POST /permissions/copy` 接入 `PermissionBatchController → PermissionBatchService → PermissionBatchRepository`，保留源/目标角色校验、空源角色成功响应、覆盖目标权限、`created_at` 可选列、原响应和错误消息；service 统一管理事务和连接释放。定向批量权限测试 14 项通过，覆盖路由授权、空源、提交、异常回滚和参数化写入。后端全量测试 1247 通过、14 跳过、0 失败；后端安全与分层审计、字段一致性、严格 ESLint、文档检查及 `git diff --check` 通过。AST 实测 `permission-management.js` 从 9 降至 8，route handler 总数从 24 降至 23；该文件连接租借从 5 降至 4，全局连接租借基线从 175 降至 174。未连接云端数据库或生产接口。
- 本批将 `GET /permissions/export` 迁入 `PermissionExportController → PermissionExportService → PermissionExportRepository`，保留管理员权限、JSON/CSV 输出、附件文件名、角色/模块启用状态兼容过滤、原字段和错误响应。定向测试 4 项通过，覆盖路由授权、两种导出格式、schema 兼容、查询顺序与错误响应。后端全量测试 1251 通过、14 跳过、0 失败；后端安全与分层审计、字段一致性、严格 ESLint、文档检查及 `git diff --check` 通过。AST 实测 `permission-management.js` 从 8 降至 7，全局 route handler 从 23 降至 22；6 个非零 key 与 6 个仍内联文件一致，直接连接租借基线不变为 174。未连接云端数据库或生产接口。
- 本批将 `GET /subsidy/stats/summary` 迁入 `SubsidyStatsController → SubsidyStatsService → SubsidyStatsRepository`，保留 `subsidy:view`、短缓存、字段权限过滤、全部筛选参数、可选门店汇总、并行聚合查询、计时日志及成功/500 响应；SQL 与参数绑定位于 repository，controller 不含 SQL、事务或 repository 依赖。列表和统计接口共用一份纯筛选工具。新增行为测试覆盖路由授权/缓存委托、响应和错误、隐藏字段及门店查询跳过、查询参数绑定；另以 HEAD 中原筛选器对比 24 组筛选输入，结果一致。AST 实测 `subsidy.js` 从 7 降至 6，摘要更新，全局 handler 从 18 降至 17，6 个非零 key 与 6 个内联文件一致，`maxLegacyNonControllerRoutes=17`；连接租借基线不变为 173。验证：后端全测 1267 通过、14 跳过、0 失败；后端安全与分层审计、架构测试 16 项、严格 ESLint、字段一致性、文档检查及 `git diff --check` 通过。未连接云端数据库或生产接口。
- 本批将 `PUT /permissions/users/:id/roles` 迁入 `UserRoleAssignmentController → UserRoleAssignmentService → UserRoleAssignmentRepository`，保留管理员权限、用户/角色 ID 校验、去重、角色全量替换、用户不存在 404、无效角色 400、成功及 500 响应；service 通过共享 `withConnection` 编排原子事务，repository 执行参数化 SQL，提交并释放连接后写用户角色审计日志，日志失败仍不撤销已提交操作。新增 5 项测试覆盖授权委托、参数校验、响应、提交/回滚/释放顺序、提交后审计和参数绑定。AST 实测 `permission-management.js` 从 3 降至 2，摘要同步更新，全局 route handler 从 17 降至 16；6 个遗留 key 对应 6 个内联文件，`maxLegacyNonControllerRoutes=16`。该文件直接连接租借从 3 降至 2，全局基线从 173 降至 172。验证：后端全测 1272 通过、14 跳过、0 失败；后端安全与分层审计、架构测试 16 项、全局严格 ESLint、字段一致性、文档检查及 `git diff --check` 通过。未连接云端数据库或生产接口。

- 状态：后续债务，进行中；风险等级 P2；核实日期：2026-11-07；基线：`main` / `c5e48e8` 加当前工作区。
- 本批将 `DELETE /subsidy/:id` 接入 `SubsidyPhotosController → SubsidyPhotosService → SubsidyPhotosRepository`，保留认证、`subsidy:delete` 权限、404/200/500 响应、先删除记录后清理安全路径照片、照片清理失败不影响主删除及 `/subsidy` 缓存失效。替身测试覆盖路径限制、数据库参数、文件/缓存顺序和错误行为；AST 实测 `subsidy.js` 内联 handler 从 11 降至 10，遗留总数从 39 降至 38，文件 key 数与内联文件数仍为 6，台账摘要同步重算。
- 随后将权限管理删除角色字段权限接口接入 `RoleFieldPermissionDeleteController → RoleFieldPermissionDeleteService → RoleFieldPermissionDeleteRepository`，保留 `permissions:admin`、必填校验、参数化删除、缓存清理及 404/成功/500 响应；定向测试 4 项通过。AST 实测 `permission-management.js` 从 20 降至 19，遗留总数从 38 降至 37，文件 key 数与内联文件数仍为 6，台账摘要同步重算。
- 证据：此前预定列表、详情、统计、选项、创建、更新、匹配查询、匹配、取消、删除、恢复已迁入相应 controller/service/repository；创建、更新、匹配、取消和恢复的状态/事务编排由 service 管理，repository 在事务连接上执行校验查询、设备锁定与更新；删除状态规则由 service 判断，controller 映射 HTTP 响应并处理字段脱敏。2026-11-07 已将员工 CRUD、analytics 员工工资趋势与出勤统计，以及维修选项、客户检索、设备检索、统计、详情、列表、新建客户、更新、临时媒体清理、状态更新、维修单取消、签名媒体读取、签名媒体上传和维修单创建迁入对应分层，保留认证/权限、字段权限、schema 检查、关联项校验、媒体所有权、签名时限、路径边界、上传内容验签及 API 响应。维修单创建和更新的事务由 service 编排，SQL 由 repository 执行；失败时先回滚事务和已移动媒体，再释放连接。2026-11-07 已将 `repairs.js` 内联 handler 从 1 降至 0，删除整个台账键；随后将 `sales.js` 客户搜索、手机号客户查找、销售统计、可售设备统计、列表与导出、库存汇总和库存明细迁入 controller/service/repository，保持 route 权限、分页、筛选、预定校验和响应契约；筛选逻辑集中由 service 提供。库存报告迁移的定向回归 112 项通过；route handler 从 109 降至 107，`sales.js` 台账从 3 收敛至 1，当前遗留 key 7/内联文件 7，`maxLegacyNonControllerRoutes` 精确等于逐文件总和。随后将 `rentals.js` 客户搜索、销售选项、客户创建和客户更新迁入 controller/service/repository，保留权限、字段隐藏、操作员门店范围、未分页审计和响应契约；service 复用客户/操作员公共搜索，SQL 仅位于 repository。租赁定向测试 23 项通过；route handler 当前从 107 降至 103，`rentals.js` 台账从 14 收敛至 10，随后将 `analytics.js` 客户增长和实时数据端点迁入对应 controller/service/repository，保留认证、业务用户权限、7d/90d/默认30天窗口、门店筛选、实时销售/待处理订单与系统负载字段；两批定向测试共 15 项通过，route handler 当前 101 个 / 7 个文件，`analytics.js` 台账从 22 收敛至 20，摘要重新计算并与 AST 实测一致。controller SQL 154/154、事务调用 59/59，controller repository 直连 15/15。基础设施 `src/types/actor.js`、`src/core/base/base.service.js` 和 `src/core/db/connection.js` 均存在并有基础行为测试；BaseService 已用于维修服务，维修和预定仓储共用 `withConnection` 实现并测试成功/异常释放。ARCH 门禁逐文件审计反向依赖：用户门店 controller 的权限日志依赖已改接已有 service，余下 4 条 repository→service 依赖（query repository 3 条、store repository 1 条）已精确登记并只允许减少。当前 97 个 controller 中有 15 个文件、15 条 repository 直连，均已登记并受禁止新增/逐项收敛门禁约束。2026-11-07 全量后端测试 974 通过、14 跳过、0 失败；后端安全与分层审计、字段一致性、严格 ESLint、文档检查及 `git diff --check` 通过。未连接云端数据库，也未做浏览器或生产接口实测。
- 全局 ARCH 复核补充：门禁现在强制存在 actor、BaseService、共享连接 helper 三个基础文件；检查 repository 中自定义 `withConnection` 是否委托公共 helper；controller→repository AST 依赖扫描覆盖 `require`、静态 `import` 与动态 `import()`。本次新增的正反架构测试、后端安全/分层门禁、基础服务与连接 helper 行为测试及文档检查通过；既有各层数据库连接改造继续按业务批次推进，不据此宣称整站分层收敛完成。随后将 analytics 客户详情与客户分群接口迁入 controller/service/repository，保留客户编号校验、门店筛选、响应字段及权限链路；定向测试 6 项通过，route handler 从 101 降至 99，`analytics.js` 从 20 降至 18，摘要已按 AST 实测收口。继续将高价值客户列表迁入对应 controller/service/repository，保留分页、日期/门店校验、搜索筛选、查询参数绑定及分页元数据，定向测试 4 项通过；route handler 从 99 降至 98，`analytics.js` 从 18 降至 17，摘要按 AST 更新。继续将客户活跃度接口迁入 controller/service/repository，按原顺序保留活跃分布、90 天活跃率及近 7 日趋势三条查询和门店过滤，响应分类、星期标签与消息保持不变；定向测试 5 项通过，route handler 从 98 降至 97，`analytics.js` 从 17 降至 16，摘要按 AST 更新。
- 全局复核及本批收口：重新扫描后确认基础设施三件套均存在，`withConnection` 重复实现已改为委托共享 helper；ARCH 门禁已对全体 controller 检查 SQL/事务、require/import 仓储直连及 controller/service/repository 反向依赖，当前分别登记 15 条 controller 仓储依赖和 4 条反向依赖，只允许逐项减少。仓储/服务中仍有其他直接租借数据库连接的实现尚未统一，这是后续迁移债务，现有 `withConnection` 门禁不覆盖全部连接生命周期。本批将 analytics 品牌及型号排行迁入 controller/service/repository；非法供应商筛选现在沿用公共整数解析，测试覆盖权限委托、零售/批发合并、排序分页、百分比及查询参数绑定。AST 实测 `analytics.js` 内联 handler 从 11 降为 9，摘要同步更新，遗留总数从 85 降为 83，遗留文件数保持 7。
- 全局复核及本批收口：重新扫描后确认基础设施三件套均存在，`withConnection` 重复实现已改为委托共享 helper；ARCH 门禁已对全体 controller 检查 SQL/事务、require/import 仓储直连及 controller/service/repository 反向依赖，当前分别登记 15 条 controller 仓储依赖和 4 条反向依赖，只允许逐项减少。仓储/服务中仍有其他直接租借数据库连接的实现尚未统一，这是后续迁移债务，现有 `withConnection` 门禁不覆盖全部连接生命周期。本批将 analytics 品牌及型号排行迁入 controller/service/repository；非法供应商筛选现在沿用公共整数解析，测试覆盖权限委托、零售/批发合并、排序分页、百分比及查询参数绑定。随后将 `/employees/detail` 接入现有员工分析分层：日期验证、北京时间默认月份、门店范围、工资快照、考勤率和销量字段均由 service/repository 保持，定向行为与查询绑定测试通过。再将 `/sales-by-condition` 接入 controller/service/repository，保留零售数据输出、查询参数绑定、字段格式、批发统计失败时继续返回零售结果的降级行为。本批继续将 `/employee-performance` 接入独立 controller/service/repository，保留 `salary:view` 中间件、部分日期回退当月、零售/批发合并及 camelCase 响应字段；定向测试覆盖权限委托、门店参数、金额舍入及查询绑定。当前 AST 实测 `analytics.js` 内联 handler 从 11 降为 6，摘要同步更新，遗留总数从 85 降为 80，遗留文件数保持 7；全量后端测试 1046 通过、14 跳过、0 失败，后端安全与分层审计、字段一致性、文档检查、迁移代码与测试 ESLint 和 `git diff --check` 通过。未连接云端数据库或生产接口。
- 本次全局复核快照（2026-11-08）：以 `node frontend/scripts/check-route-architecture.mjs` 的 AST 实测为准，基础设施 3/3；`legacyNonControllerRoutes` 为 9 个 handler / 5 个文件，台账 key 与仍含内联 handler 的文件数相等；controller SQL 233、事务 59、repository 直连 14、反向依赖 4、直接连接租借 168，均与逐文件基线总和一致。14 条 controller→repository 直连均逐项登记并禁止新增；route/controller/service/repository 层反向依赖共 4 条也逐项登记并禁止新增。全局门禁单测 12 项通过，安全与分层审计通过。actor/基础服务及共享连接 helper 均有行为测试；预定和维修 repository 的 `withConnection` 适配器委托共享 helper。连接租借基线只阻止数量增加，不证明每条遗留路径都正确释放；当前有 168 处分布于 51 个文件，需继续按业务批次收敛和验证。未连接云端数据库或生产接口。
- 本批将 `/analytics/sales` 从内联 route 迁入 controller/service/repository，保留日期校验、认证与业务用户中间件、销售/门店/商品聚合字段和查询参数绑定；定向测试覆盖响应计算、错误路径及 SQL 参数。全局 AST 复核确认 ARCH 基线涉及 79 个内联 handler、7 个 route 文件，controller repository 依赖仍为 15 条、反向依赖为 4 条；`analytics.js` 从 6 降至 5，`maxLegacyNonControllerRoutes` 与总和同步从 80 降至 79。基础设施三件套、共享 `withConnection` 检查及全体 controller 的 SQL/事务、repository 直连、反向依赖检查均已存在于安全与分层门禁。定向测试通过；全量后端测试 1050 通过、14 跳过、0 失败，安全与分层审计、字段一致性、严格 ESLint、文档检查及 `git diff --check` 均通过。未连接云端数据库或生产接口。
- 本批将 `/rentals/devices` 从 route 内联 handler 迁入 `RentalDeviceController → RentalDeviceService → RentalDeviceRepository`，保留 schema 检查、设备字段权限搜索与响应脱敏、默认不分页/显式分页、最大 1000 条及返回元数据；route 权限中间件不变。定向测试 12 项通过，覆盖权限委托、搜索字段过滤、脱敏、参数绑定与 SQL 标识符白名单。AST 实测 `rentals.js` 从 10 降至 9，摘要更新，遗留 handler 总数从 79 降至 78；遗留文件 key 仍为 7。全量后端测试 1055 通过、14 跳过、0 失败；安全与分层审计、字段一致性、严格 ESLint、文档检查及 `git diff --check` 均通过。未连接云端数据库或生产接口。
- 本批将 `/rentals/:id/payment-schedule` 迁入 `RentalScheduleController → RentalScheduleService → RentalScheduleRepository`，保留 `rentals:edit` 权限、缺失合同响应、每日租赁空计划、买断分期金额尾差修正、月底还款日钳制和字段级隐藏；复用公共租赁计算工具，列表和还款路由继续使用同一实现。定向测试及租赁/交易契约回归 135 项通过。AST 实测 `rentals.js` 从 9 降至 8，摘要更新，遗留 handler 总数从 78 降至 77；遗留文件 key 仍为 7。同步修正租赁业务文档中 `page_size` 参数名。全量后端测试 1061 通过、14 跳过、0 失败；安全与分层审计、字段一致性、严格 ESLint、文档检查及 `git diff --check` 均通过。未连接云端数据库或生产接口。
- 本批将 `PUT /subsidy/:id/confirm-arrival` 迁入 `SubsidyArrivalController → SubsidyArrivalService → SubsidyArrivalRepository`，保留认证与 `subsidy:arrival` 权限、数据库时间戳、原始 ID 绑定、无记录 400、成功响应及成功后 `/subsidy` 缓存失效。定向测试 4 项通过。AST 实测 `subsidy.js` 从 18 降至 17，摘要更新，遗留 handler 总数从 77 降至 76；遗留文件 key 仍为 7。全量后端测试 1065 通过、14 跳过、0 失败；安全与分层审计、字段一致性、严格 ESLint、文档检查及 `git diff --check` 均通过。未连接云端数据库或生产接口。
- 本批将 `POST /rentals/:id/finish` 迁入 `RentalFinishController → RentalFinishService → RentalFinishRepository`，保留 `rentals:edit` 权限、事务行锁、活跃/逾期状态校验、买断合同拒绝归还、按数据库日期计算费用、合同归还与设备恢复在库的原子更新；service 通过共享 `withConnection` 释放连接。新增测试覆盖权限委托、成功提交、无效状态回滚、连接释放、行锁和设备状态条件更新。AST 实测 `rentals.js` 从 8 降至 7，摘要更新，遗留 handler 总数从 76 降至 75；7 个非零文件键仍与 7 个内联文件一致。未连接云端数据库或生产接口。
- 本批将 `GET /subsidy/filter-options` 迁入 `SubsidyFilterOptionsController → SubsidyFilterOptionsService → SubsidyFilterOptionsRepository`，保留 `subsidy:view` 权限、长缓存 TTL、五类 DISTINCT 排序结果及逐字段隐藏策略。定向测试 4 项通过，覆盖路由授权/缓存委托、响应和错误映射、字段隐藏及五组查询。AST 实测 `subsidy.js` 从 17 降至 16，摘要更新，遗留 handler 总数从 75 降至 74；7 个非零文件键仍与 7 个内联文件一致。未连接云端数据库或生产接口。
- 本批将 `GET /subsidy/:id/photos` 迁入 `SubsidyPhotosController → SubsidyPhotosService → SubsidyPhotosRepository`，保留 `subsidy:upload` 权限、绑定记录 ID、缺失记录 404、照片 JSON 异常回退空列表，以及仅为国补目录照片生成当前用户绑定的私有签名 URL。定向测试 4 项通过，覆盖权限、响应、签名用户、损坏 JSON 和参数绑定。AST 实测 `subsidy.js` 从 16 降至 15，摘要更新，遗留 handler 总数从 74 降至 73；7 个非零文件键仍与 7 个内联文件一致。未连接云端数据库或生产接口。
- 本批将 `PUT /subsidy/:id/audit` 迁入 `SubsidyAuditController → SubsidyAuditService → SubsidyAuditRepository`，保留 `subsidy:approve` 权限、原始 ID 参数绑定、`apply_time = NOW()`、缺失记录 404、成功后 `/subsidy` 缓存失效和原有错误响应。定向测试 4 项通过，覆盖权限委托、响应、缓存收口及 SQL 参数。AST 实测 `subsidy.js` 从 15 降至 14，摘要更新，遗留 handler 总数从 73 降至 72；7 个非零文件键仍与 7 个内联文件一致。未连接云端数据库或生产接口。
- 本批将 `PUT /subsidy/:id/approve` 迁入 `SubsidyApprovalController → SubsidyApprovalService → SubsidyApprovalRepository`，保留 `subsidy:approve` 权限、boolean 输入校验、通过/拒绝响应、缺失记录 404、失败 500 与成功后 `/subsidy` 缓存失效；SQL 及绑定参数位于 repository。定向测试覆盖路由授权委托、输入校验、两种结果、缓存条件、缺失/异常响应和参数绑定。AST 实测 `subsidy.js` 从 14 降至 13，摘要更新，遗留 handler 总数从 68 降至 67；7 个非零文件 key 与 7 个仍有内联 handler 的文件一致。未连接云端数据库或生产接口。
- 本批将 `GET /analytics/inventory` 迁入既有 `AnalyticsInventoryController → AnalyticsInventoryService → AnalyticsInventoryRepository`，保留 analytics/inventory 权限链、业务用户校验、门店范围、门店/供应商筛选、四类参数化统计查询、500 条预警来源、健康评分、问题与建议文本及响应字段；原有统一错误响应保持不变。定向测试 20 项通过，后端全量测试 1099 通过、14 跳过、0 失败；安全与分层审计、字段一致性、文档检查和 `git diff --check` 通过。AST 实测 `analytics.js` 从 5 降至 4，摘要更新，遗留 handler 总数从 67 降至 66；7 个非零文件 key 与 7 个仍有内联 handler 的文件一致。业务源文件及对应库存测试严格 ESLint 通过。未连接云端数据库或生产接口。
- 本批将 `POST /subsidy/delete-temp-photos` 迁入既有 `SubsidyPhotosController → SubsidyPhotosService → SubsidyPhotosRepository`，保留认证与 `subsidy:upload` 权限、无照片响应、当前用户签名/归属校验、国补目录约束、数据库引用检查、两小时临时文件期限、空目录清理及逐项失败统计。service 管理文件生命周期与失败项，repository 只执行绑定引用查询，controller 保留统一成功/错误响应；失败日志只记录相对路径，不记录带签名的原始 URL。测试覆盖授权委托、空/成功/异常响应、签名用户/过期策略/路径限制/引用与文件期限、SQL 参数绑定，以及异常时签名参数不进入日志。AST 实测 `subsidy.js` 从 13 降至 12，摘要更新，遗留 handler 总数从 66 降至 65；7 个非零文件 key 与 7 个仍有内联 handler 的文件一致。未连接云端数据库或生产接口。
- 本批将租赁合同附件上传、下载与删除端点迁入 `RentalFileController → RentalFileService → RentalFileRepository`，保留路由级认证、`rentals:view`/`rentals:edit` 和下载字段可见性权限、上传类型/大小/签名校验、租赁 ID 与附件 ID 联合绑定、事务回滚及连接释放、失败文件清理、私有上传路径解析、附件文件名、缺失记录/磁盘文件的 404，以及“数据库记录删除成功后，文件清理失败只记 warning”的语义。定向测试 7 项通过，覆盖权限、schema 初始化、绑定参数、路径解析、事务和文件清理。AST 实测 `rentals.js` 从 7 降至 4，遗留 handler 总数从 72 降至 69；7 个遗留文件 key 与 7 个仍内联文件一致。未连接云端数据库或生产接口。
- 本批将 `GET /rentals/` 列表迁入 `RentalListController → RentalListService → RentalListRepository`，保留 `rentals:view` 与路由级全局认证、隐藏字段搜索/筛选拒绝、分页上下限、买断/按月筛选、合同附件和还款期数关联、下一期日期计算、统计摘要字段隐藏及敏感字段脱敏。查询、绑定参数与统计留在 repository，controller 无 SQL/事务。新增测试覆盖授权委托、403/成功/异常响应、字段权限、分页与摘要、下一期、附件签名下载路径和参数化筛选。AST 实测 `rentals.js` 从 4 降至 3，摘要更新，遗留 handler 总数从 65 降至 64；7 个非零文件键与 7 个仍有内联 handler 的文件一致。未连接云端数据库或生产接口。
- 本批将 `POST /rentals/:id/payments` 接入既有 `RentalScheduleController → RentalScheduleService → RentalScheduleRepository`，保留 `rentals:edit`、隐藏备注写入拦截、合同行锁、终态拒绝、分期号验证与重复还款拒绝、分期/付款记录原子写入、买断完成状态更新、日租收款验证、原成功消息和 400/500 错误映射。service 复用共享 `withConnection` 管理事务连接，repository 在事务连接上执行全部 SQL。新增测试覆盖 controller 响应、分期去重/排序及提交、非法金额回滚、连接释放和绑定参数。AST 实测 `rentals.js` 从 3 降至 2，摘要更新，遗留 handler 总数从 64 降至 63；7 个非零文件键与 7 个仍内联文件一致。未连接云端数据库或生产接口。
- 本批将 `POST /git/pull` 的分离 HEAD/主分支检查及拉取编排迁入 `GitController → GitService`，保留路由级 `git-management:edit` 权限、命令顺序、仅允许 main 拉取、409 冲突响应和成功/500 响应结构。测试使用注入的命令执行器，不执行真实 Git 拉取。定向 Git 测试 6 项通过，严格 ESLint 通过；AST 实测 `git.js` 从 15 降至 14，摘要更新，route handler 总数从 63 降至 62，7 个遗留 key 仍对应 7 个内联文件。未连接远端或修改仓库 Git 状态。
- 本批将 `GET /git/status` 迁入既有 `GitController → GitService`，保留 `git-management:view`、五条只读 Git 命令顺序、状态行解析、ahead/behind 数量、分离 HEAD 标识和最近提交字段及原 500 响应。测试注入命令执行器，不读取或改动真实仓库状态。定向状态测试 3 项通过；AST 实测 `git.js` 从 14 降至 13，摘要更新，route handler 总数从 62 降至 61，7 个遗留 key 仍对应 7 个内联文件。未连接远端。
- 本批将 `POST /git/discard` 迁入 `GitController → GitService`，保留全局认证、`git-management:edit`、先 `git reset --hard HEAD` 再 `git clean -fd` 的命令顺序，以及成功/失败响应和错误日志；service 复用路由现有安全命令执行器，测试只注入假执行器，没有触碰工作区。定向测试 3 项通过。AST 实测 `git.js` 从 16 降至 15，遗留 handler 总数从 69 降至 68；7 个非零 key 与 7 个仍有内联 handler 的文件一致。未执行 Git 重置、清理、数据库或生产操作。
- 本批将 `GET /analytics/profit` 迁入 `AnalyticsProfitController → AnalyticsProfitService → AnalyticsProfitRepository`，保留继承的认证/分析权限/业务用户链、默认当月日期、门店筛选、四组本月/上月零售与同行查询、最近六个月零售数据回退和原利润指标/错误响应；新增行为测试覆盖默认日期、计算、连接失败、绑定参数与权限委托。AST 实测 `analytics.js` 从 4 降至 3，摘要同步更新，遗留总数从 61 降至 60；遗留 key 7/内联文件 7。修正字段契约测试，将利润和员工查询字段断言定位到各自 controller。定向测试 4 项通过；全量后端测试 1122 通过、14 跳过、0 失败；后端安全/分层审计、字段一致性、公共选项严格审计、相关 ESLint、文档检查及 `git diff --check` 通过。未连接云端数据库或生产接口。
- 本批将 `GET /analytics/customers` 迁入 `AnalyticsCustomerOverviewController → AnalyticsCustomerOverviewService → AnalyticsCustomerOverviewRepository`，保留继承认证/分析权限/门店范围、业务用户中间件、日期/门店校验、七项聚合查询和原响应字段、增长率及洞察时间；SQL 和参数绑定均位于 repository，service 负责连接状态、增长计算与响应业务数据。新增回归覆盖路由委托、校验和错误响应、增长与分群计算、日期筛选/门店绑定。AST 实测 `analytics.js` 从 3 降至 2，摘要更新为 `14310e3af2ca71dbfe6996fe0288bfe7a6fbfd69206019a352cea3242de69640`，遗留 handler 总数从 60 降至 59；遗留 key 仍为 7。未连接云端数据库或生产接口。
- 本批将 `GET /permissions/all` 迁入 `PermissionListController → PermissionListService → PermissionListRepository`，保留 `permissions:admin`、新旧 schema 对 `modules.is_active` 与 `role_permissions.created_at` 的兼容、排序、成功/错误响应和字段结构；SQL 仅在 repository，service 探测 schema。定向测试覆盖权限委托、成功/异常响应、两种 schema 分支和查询排序。AST 实测 `permission-management.js` 从 28 降至 27，摘要更新，遗留 handler 总数从 59 降至 58；7 个非零文件键仍与 7 个有内联 handler 的文件一致。未连接云端数据库或生产接口。
- 本批将 `GET /permissions/module-mappings` 迁入 `PermissionModuleMappingController → PermissionModuleMappingService → PermissionModuleMappingRepository`，保留管理员权限、新旧 schema 过滤、默认模块回退、21 个固定权限模块补齐、元数据映射、排序和原响应/错误结构；将 route 与 service 共用的模块键归一化/合并规则集中到 `managed-permission-modules` 工具。定向测试覆盖授权委托、schema 分支、默认回退、元数据排序与错误响应。AST 实测 `permission-management.js` 从 27 降至 26，摘要更新，遗留 handler 总数从 58 降至 57；7 个非零 key 与仍内联文件数一致。未连接云端数据库或生产接口。
- 本批将 `GET /permissions/users-with-roles` 迁入 `PermissionUsersListController → PermissionUsersListService → PermissionUsersListRepository`，保留管理员权限、搜索/角色/门店筛选、可选门店关联、旧 schema 字段探测、分页上限及响应字段；route 不再保留业务分页实现。定向权限列表与 transaction contract 共 114 项通过。AST 实测 `permission-management.js` 从 26 降至 25，摘要更新，遗留 handler 总数从 57 降至 56；7 个台账键与 7 个内联文件一致。全局 ARCH 复核通过：基础设施 3/3，4 个自定义仓储连接包装器均委托共享 helper，controller SQL/事务/repository 直连/反向依赖分别为 154/154、59/59、15/15、4/4。未连接云端数据库或生产接口。
- 本批将角色创建、编辑、删除迁入 `PermissionRoleManagementController → PermissionRoleManagementService → PermissionRoleManagementRepository`，保留管理员权限、字段校验、角色编码生成与不可变约束、schema 兼容、删除占用检查、审计日志和响应语义；新增契约覆盖路由授权委托、校验分支及错误映射。AST 实测 `permission-management.js` 从 25 降至 22，摘要更新，遗留 handler 总数从 56 降至 53；7 个台账键与 7 个内联文件一致。未连接云端数据库或生产接口。
- 随后将角色启停接口并入同一分层，保留 schema 不支持时拒绝、系统角色不可停用、停用后 refresh token 清理、缺表时告警继续及状态变化审计。定向测试覆盖状态/审计规则、token 清理参数和旧表缺失兼容。AST 实测 `permission-management.js` 从 22 降至 21，遗留 handler 总数从 53 降至 52；7 个台账键与 7 个内联文件一致。未连接云端数据库或生产接口。
- 2026-11-08 全局复核实测：基础设施三件套齐全；route 内联 handler 61 个 / 7 个文件；controller SQL 154 次、事务 59 次、直连 repository 15 条 / 15 个 controller；反向分层依赖 4 条 / 2 个文件，所有棘轮最大值与逐项台账吻合。共享连接审计确认 4 个仓储自定义 `withConnection` 均委托公共 helper；这不代表仓储和服务中的其他直接连接生命周期已统一。字段一致性审计暴露 rentals 列表分层迁移后审计源未登记新 controller/service/repository，补齐三个权威源文件后通过；字段审计、公共选项严格审计通过。架构审计单测 9 项、后端安全/分层审计单测 13 项通过；后端全量测试 1118 通过、14 跳过、0 失败，项目级 ESLint、文档检查与 `git diff --check` 通过；未运行云端数据库测试。
- 影响范围：`backend/src/routes/` 遗留业务 handler、对应 controller/service/repository、权限中间件与契约测试。已处理图标模块缓存、清理、删除，数据导入上传、清理、分析、启动，屏幕锁设置与查询用户/密码/上传文件处理，配件上传、读写、库存、入库、销售和统计，认证登录、单设备/全设备退出、当前用户资料、刷新令牌轮换及开发管理员初始化，系统数据库连接探测、状态、统计、磁盘/内存运行信息、重连和公告查询/增改删，以及商城配置、轮播图、模板、订单、数据库迁移、商城图片上传/删除、商品图片删除和已售商品查询；手机模块迁移图片/视频上传、H5 上架/验机、库存汇总、已售时间线、IMEI/序列号搜索及手机详情查询；客户模块迁移搜索、列表、详情、消费记录、创建、更新、删除、消费流水限制、积分设置、VIP 等级和统计；预定模块迁移列表、详情、删除、统计、基础选项、匹配列表和候选库存；其余模块按 `config/backend-route-architecture.json` 的非零项逐批推进。
- 建议方案：沿用 `docs/CLAUDE.md` 的 route → controller → service → repository 边界；迁移后用 AST 更新精确非零条目，归零后删除键，并分别更新 SQL/事务最大值；保留审计正反例。
- 禁止动作：controller 不新增 SQL 或事务；不放宽或抬高棘轮基线、不保留零值空壳、不删除断言、不复制权限或 SQL 实现、不将跳过的数据库测试算作通过，也不动云端真实数据。
- 测试要求：每批运行定向行为测试、`npm --prefix backend test`、`npm --prefix frontend run check:backend-security`、相关 ESLint 和 `git diff --check`；有数据库边界时另用独立测试库验证。
- 文档要求：只维护本唯一任务台账和受影响的权威契约正文；纯内部重构且 API 不变时不另建报告。部署步骤：随对应业务批次发布并观察日志和接口行为。
- 回滚方案：按批恢复对应 route/controller/repository 与契约测试，并用审计工具重算基线，不直接抬高 `maxLegacyNonControllerRoutes`。
- 验收标准：剩余遗留数为 0、孤立 controller 为 0、权限与响应契约不变、全部适用门禁通过。需人工确认：独立测试库可用性和生产环境部署验证。
- 遗留说明：最近批次将 analytics 客户留存率接口迁入 controller/service/repository，并将权限管理的用户权限读取接入 controller 与既有 `access-control.service`，用户角色、可见性和统计查询迁入对应分层；本批将权限角色分页列表接入现有 `UserRolesController → UserRolesService → UserRolesRepository`，由 service 探测旧 schema 字段，repository 执行绑定搜索及分页查询，保留管理员权限、默认/最大分页、分页元数据和错误响应。随后将 `/attendance/summary` 接入现有员工分析 controller/service/repository，保留考勤权限、日期校验、30 天默认范围、门店过滤、汇总字段及最近 30/20 条明细响应，并将 analytics 可选日期解析收敛到公共查询工具。继续将 `/employees/performance` 接入同一员工分析分层，service 负责工资与考勤率整形，repository 负责白名单排序、分页和门店/员工 ID 参数化查询；保留 `salary:view` 路由权限、默认与最大分页、薪资计算和响应字段。随后将 `/profit-trend` 接入独立 controller/service/repository，保留月/季/年窗口、非法粒度回退月度、无效结束日期回退当前时间、12/8/6 个周期、门店范围、销售及同行调拨汇总和缺失周期补零；最新销售门店归属和门店过滤片段收敛为 analytics 公共查询工具。本批继续将 `/store-profit` 接入 controller/service/repository，保留认证、业务用户校验、当月默认日期范围、门店/供应商筛选、零售与同行调拨汇总、无销售门店过滤及利润降序响应。测试覆盖默认日期、响应整形、参数绑定、权限委托和数据库错误。当前 AST 实测 route 内联 handler 从 97 降至 85，遗留文件仍为 7；`analytics.js` 为 11 个，台账摘要及总基线按 AST 精确收口。`store-profit` 定向测试 4 项通过；后端全量测试 1031 通过、14 跳过、0 失败；安全与分层审计、字段一致性、文档检查、相关文件严格 ESLint 和 `git diff --check` 均通过。未连接云端数据库或生产接口。controller SQL/事务、repository 直连及反向分层依赖仍按上方基线逐批治理。

### T6 兼容路由部署观察

- 代码状态：28 个历史接口已删除；`deprecatedRoute`、`compatibilityRoute`、对应中间件和旧审计脚本已移除。
- 当前计数：运行时弃用路由 0、运行时兼容路由 0、本轮历史删除记录 28、更早 `/api/data` 删除记录 1。
- 恢复位置：[`docs/archive/compatibility-routes/`](../archive/compatibility-routes/INDEX.md)，删除前标签为 `compat-routes-before-removal-20261104`。
- 未完成项：本轮尚未提交和部署；外部旧客户端无法仅靠源码排除。部署后记录版本、时间、错误页面、旧路径访问来源和回滚结论。
- 防回退：`backend/test/retired-route-removal-contract.check.js` 和文档机器清单检查禁止旧路径、中间件及历史 ID 回归。

### 已关闭，不得重新列为待办

以下事项已经有实现、文档和自动验证。除非出现新的失败证据，不得因旧报告或原始 `grep` 数字重新开启：

- 样式债务当前有效口径为 `npm --prefix frontend run check:style-debt`：1897 处有效 `!important` 全部登记，未批准为 0；原始文本搜索会把注释和非样式内容计入。
- 前端类型债务当前有效口径为 `npm --prefix frontend run check:typescript-debt`：全前端显式 `any=0`、视图 `any=0`、重复导出名称 0 组；旧分析报告中的 1,044/809 和 26 组只代表当时状态。
- N1–N6 安全修复、Token 最终清理、价格密钥轮换和回滚边界已记录在[安全修复记录](../security/security-remediation-2026-11-04.md)。
- 密钥配置、用途隔离、迁移与轮换步骤以[环境配置与密钥管理](../security/ENVIRONMENT_SECRETS.md)为唯一操作说明，不再新建重复 runbook。
- 备份压缩文件计数已修复并有专项测试；CORS 无 Origin 策略已经文档化。
- `config/field-contracts.json` 同时受前端审计和后端契约测试约束；权限矩阵已经存在于权限管理页面。
- `docs/standards/` 只保留旧路径导航，正文权威入口为 `docs/frontend/`；`npm run check:docs` 持续检查导航和已登记冲突。
- Analytics、综合查询、入库和退库已统一使用公共门店范围校验；多门店分析子请求和缓存键携带所选 `store_id`，分析页门店下拉只显示授权范围。
- 国补与维修媒体已改为短时 HMAC URL，数据库只保存稳定上传路径，不再把登录 Token 或过期签名查询串写入业务字段；通用临时清理只处理本人导航草稿。
- Iconify 外部请求已增加认证、权限、用户/IP 限流、真实取消超时、短缓存和并发合并；Git 压缩备份已改为异步参数化执行并阻止并发创建。
- 数据导入 `replace_all` 已改为清空与全量导入同一事务，任意行失败整体回滚，事务内不再执行重置自增值的 DDL。
- 国补照片更新只删除当前记录原有且本次移除的文件；维修创建和编辑已增加数据库事务与临时媒体移动补偿。
- `data_check_backups` 已从业务请求运行时 DDL 收敛到显式 `migrate:schema`，生产缺表时返回明确迁移提示。

### 任务登记与关闭规则

### T15 入库范围、单号序列与生产 DDL 边界

- 状态：代码已完成，待独立测试库验证
- 风险等级：P1
- 核实日期：2026-11-05
- 基线分支与 commit：`main` / `c608011`
- 证据：`backend/src/routes/stock-in.js` 的编辑/删除事务和门店条件；`backend/src/utils/invoice-number.js` 的 `PO` 类型序列分配；`backend/src/utils/schema-change-policy.js` 的迁移入口白名单；`backend/test/invoice-number.check.js`、`backend/test/store-scope-contract.check.js`、`backend/test/site-hardening-20261104.check.js`
- 影响范围：入库记录跨门店授权、并发编辑/删除及采购入库单号生成；生产运行时 schema 变更授权
- 建议方案：部署前确认已应用的 schema baseline 含 `invoice_sequences`；按[后端数据库回归测试](../backend/database-testing.md)在独立测试库验证多连接并发与跨门店拒绝
- 禁止动作：不得在本地或线上对业务库执行未授权迁移；不得在 API 进程设置迁移模式；不得删除或重置已有序列
- 测试要求：`npm --prefix backend test`；数据库启用后执行对应的 `npm --prefix backend run test:db` 并确认合成数据清理
- 文档要求：库存单号/门店边界见[入库操作与安全边界](../business/inventory/stock-in-operations.md)，迁移授权见[数据库索引](../database/INDEX.md)
- 部署步骤：先确认生产 `invoice_sequences` 表存在；生产应用配置不设置 `SCHEMA_MIGRATION_MODE`；数据库变更仅从受控维护终端运行显式迁移脚本
- 回滚方案：应用回滚不删除序列表；回退旧版前先确认旧版查询和新格式 `POyyyyMMdd序号` 均可读取，否则暂停回滚并安排兼容版本
- 验收标准：门店外记录写入被拒绝；并发更新/删除只有一个成功；并发生成的入库单号无重复；生产 API 入口的 DDL 授权测试为 false
- 需人工确认：独立测试库是否具备并发回归条件；云端 `invoice_sequences` 是否存在；生产环境是否未设置迁移开关
- 遗留说明：本轮不连接云端数据库；代码契约与模拟并发测试不等同于真实 MySQL 并发和生产配置验收

### T16 地址层级与地区数据契约

- 状态：后续债务
- 风险等级：P2
- 核实日期：2026-11-05
- 基线分支与 commit：`main` / 工作区当前版本
- 证据：`frontend/src/services/region-options.ts` 使用 `@vant/area-data@2.2.0` 提供省、市、县/区；`backend/src/routes/customers.js` 与 `docs/database/customers-table-schema.md` 当前客户地址契约仅包含 `province`、`city`、`address`；该地区包不提供乡镇/村级数据。候选 `china-division@2.7.0` 仓库自述五级数据截止 2023-06-30、发布于 2023-09-11；其 2025-12-27 后续提交仅更新“数据尚未更新”提示，不能据此证明 2026 年现行完整。其 `villages.json` 约 85 MB，需评估按需加载/服务端查询；许可元数据与仓库徽章/说明不一致，采用前必须核实许可
- 影响范围：客户编辑、列表展示、地址搜索/导出、字段权限、历史数据回显和未来行政区划更新
- 建议方案：将五级选择列为强制验收，不以手填乡镇/村名替代。优先寻找并核实可持续更新、明确许可且覆盖省市县乡村的权威/授权数据源；若国家公开统计编码或第三方数据未提供可证明的现行全量数据，先将来源限制透明展示并保持债务开放，不拼接或推断缺失村级数据。确定来源后建立数据版本/更新时间和差异校验；定义唯一共享类型和 API 字段，再通过显式迁移增加县区、乡镇、村级字段并保留旧地址回滚映射
- 禁止动作：不得把过期或不完整数据源标记为全国现行完整数据；不得在生产库直接添加字段或把县区拆分写入未经授权的列；不得丢弃无法识别的历史地址文本
- 测试要求：数据源版本校验、34 个省级单位覆盖、直辖市/港澳台层级回显、历史地址不丢失、权限拒绝、搜索导出及浏览器窄屏回归
- 文档要求：数据源许可与更新日期、字段契约、迁移/回滚和隐私边界写入数据库与前端权威文档；当前唯一待办为本节，不另建地址分析报告
- 部署步骤：本轮仅部署前端三级选择组件和地址兼容逻辑；乡镇/村级能力须完成独立测试库验证及人工确认后再发布
- 回滚方案：回滚前端组件不修改既有 `province/city/address` 数据；若后续迁移失败，按迁移脚本回滚新增列，保留原地址字符串
- 验收标准：省市县选择可联动、编辑回显不改写历史数据、县区与详细地址保存后可重新拆分；未完成乡镇/村级前不得宣称五级完成
- 需人工确认：业务方认可数据来源、许可和更新时效；独立测试库可用后再安排迁移验证。五级完整选择是既定要求，不再作为“下拉或手填”的待选项
- 遗留说明：当前数据包为 2023 年统计口径，不能证明 2026 年行政区划或村级覆盖完整；已找到的五级候选包同样自述截止 2023-06-30，且数据体积大、许可说明需复核。本轮未连接或写入云端数据库；五级行政区划数据及客户字段/API 迁移仍未完成

新增或更新任务时至少记录：状态、优先级、核实日期、基线分支/commit、可重复证据、影响范围、建议方案、禁止动作、测试、文档、部署、回滚、验收标准、需人工确认和遗留说明。工作量只使用“小 / 中 / 大”或给出前提明确的区间，不把聊天估算写成承诺。

同一任务只保留一个当前状态。代码已完成但尚未部署或仍在兼容窗口时使用“观察期”，不能写成“未实现”；需要云端、第三方、真机或业务确认的事项必须明确标记，不能从静态代码推断完成或失败。

新任务使用以下模板；表格中的现有任务是汇总视图，进入实施时应补全对应专项记录，不在本文件复制大段实施过程：

```markdown
### [编号] 任务名称

- 状态：阻断发布 / 本轮必须 / 观察期 / 后续债务 / 明确延期
- 风险等级：P0 / P1 / P2 / P3
- 核实日期：
- 基线分支与 commit：
- 证据：文件、行号、命令输出
- 影响范围：
- 建议方案：
- 禁止动作：
- 测试要求：
- 文档要求：
- 部署步骤：
- 回滚方案：
- 验收标准：
- 需人工确认：
- 遗留说明：
```

## 当前状态

| 项目 | 状态 | 当前结果 | 下一步 |
| --- | --- | --- | --- |
| ESLint warning | 已完成 | 2026-10-01：`lint:summary` 与 `lint:strict` 均为 0 errors、0 warnings | 新增代码继续执行 `lint:strict`，避免 warning 回归；见 [ESLint 进度](ESLINT_WARNING_PROGRESS.md) |
| 大型页面拆分 | 进行中 | 2026-11-04 当前较大的页面包括 `ProfitAnalytics.vue` 4273 行、`CustomersView.vue` 4212 行、`PriceListView.vue` 3788 行、`SalaryView.vue` 3017 行、`PermissionsView.vue` 2691 行和 `SalesView.vue` 2066 行；`InventoryView.vue` 2026-11-06 因清理位于 `</style>` 之后、不被 SFC 产出的孤儿私色/私有卡片样式块，从 2494 行降为 1800 行（其余页面仍为 2026-11-04 口径）；已有多个页面完成子视图、弹窗、样式或 composable 拆分 | 只按 T13 的变更原因和风险推进，不把“超过 2000 行”直接判为缺陷 |
| 样式治理与强制覆盖 | 已完成当前登记范围治理 | 2026-11-04 当前未处理样式债务为 0；另有 1897 个已分类运行时契约覆盖，未批准 0 个，非令牌颜色使用点 0 个，超长 Vue 样式块 0 个 | 继续执行零增长门禁；公共按钮、表格、弹窗、Teleport、截图和无障碍契约只有在具备级联与视觉证据时再下调，见 [样式治理与强制覆盖契约记录](STYLE_DEBT_PROGRESS.md) |
| 后端契约测试 | 本地通过（非实时数据库） | 2026-11-04 `npm --prefix backend test`：375 通过、14 跳过、0 失败；跳过项是默认未启用的独立数据库测试 | 需要真实数据库结论时按规范单独运行 `npm --prefix backend run test:db`，跳过项不能计作通过 |
| 前端包体积 | 首屏门槛通过，重型功能保持懒加载 | 2026-11-04 构建报告首屏本地资源 873.00 KiB，低于 878.91 KiB 门槛；HEIC、PDF worker、CSV 导出等是懒加载/功能资源，不属于首屏包 | 当前余量较小；新增首屏依赖前必须执行 `check:bundle-size`，并结合真实功能加载数据优化懒加载块 |
| 字段统一和兼容层 | 已完成（兼容层已清零） | 已知历史物理列迁移完成；当前登记 0 个运行时兼容字段、329 个已退役字段、0 个兼容边界；工资、考勤、销售和模板字段均已收敛 | 持续执行登录态业务回归；不得重新引入旧字段，历史退役字段仅保留在审计记录和迁移说明中 |
| 全局空状态 | 公共入口与样式审计已闭环，继续按状态语义接入 | 2026-10-01 清理未引用的 `.empty-state`、`.empty-content`、`.empty-row`、`.empty-text`、`.empty-icon` 等遗留规则；移除公共组件外的空状态包装样式，并将设备无匹配、导入历史空态接入 `DataEmptyState`。`check:empty-states` 已扩展扫描 Vue 模板、内嵌样式及独立 CSS/SCSS，当前通过 | 新增空状态继续执行 `npm run check:empty-states`；`.no-data` 字段占位及权限分配未选择对象引导按规范边界保留 |
| 表单控件统一 | 普通文本和多行文本已统一，持续审计 | 2026-10-04：全量扫描业务 Vue/SCSS/CSS，所有业务 textarea 均使用 `el-input type="textarea"`、固定 `rows` 和 `tf-textarea` 语义 class；公司地址、锁屏提示等短系统文案保持单行 input，备注、库存/销售/综合查询编辑、预警模板备注等短文本统一 `rows=2`，长地址/原因/描述/营销话术按语义保留 `rows>=3`。公共样式仅对 `rows=2` 使用 PC/手机高度令牌，所有文本域只允许垂直手动拉伸；审计已拦截原生 textarea、缺少 `rows`/class、自动高度及页面私有高度/圆角。`check:form-controls` 通过，原生文本框仍限定在专用例外文件，select/date 均为 0 | 继续按语义处理剩余 H5/格式化输入，不机械替换浏览器专用字段；新增备注、说明等字段必须遵守固定高度和垂直手动拉伸规则 |
| 后台表格排序控件 | 本轮已统一 | 公共拖拽行及品牌、门店、型号、供应商、颜色、经验分享列表的排序输入统一为 `el-input-number`，共 7 处；共享尺寸位于 `_table.scss`，`check:form-controls` 防止回退原生排序输入 | 数值输入按范围、精度和编辑行为分别使用 Element Plus 标准控件 |
| 权限管理文本控件 | 本轮已迁移一批 | 角色表单和权限模块管理中的角色名称/编码、模块名称/标识及模块搜索共 7 个普通文本字段改用 `el-input`；只读、必填、搜索回调和字段错误状态保留 | 持续维护表单控件规范与逐字段审计 |
| Loading 入口与例外审计 | 公共分层已接入，剩余例外进入 T14 | 2026-11-04 `check:loading` 通过：`GlobalLoading=1`、`v-tf-loading=48`、`TableLoadingRow=56`、`SectionLoading=32`、`InlineLoading=46`、`v-loading` 例外 1 个、全局长操作例外 2 个 | 只按 T14 逐项核对并收口；新增页面继续遵守[全局 Loading 规范](../frontend/global-loading-standard.md)，不得建立第二份例外清单 |

## 当前需决策的工程能力

- i18n：仓库未接入 `vue-i18n` 或词条目录。当前界面为中文；只有确认多语言产品需求、语言清单和翻译维护责任后再引入，避免新增无人维护的抽象。
- 提交钩子与格式化：当前有 ESLint 检查，但没有 Prettier、Stylelint、Husky 或 lint-staged。是否增加提交钩子需团队确认安装与提交耗时要求；不能把格式化器视为运行时安全缺口。
- 埋点：前端 `telemetry.ts` 只调用宿主适配器，当前没有仓库内采集端；生产采集须先确定告知/同意、服务端端点、权限和留存策略。默认不发送是当前的隐私保护行为。
- 上传/导出：项目已有统一 API 上传、临时文件清理器及 `useImportExport` 下载入口，但不能据此推断所有页面都已经采用。新改造需核对临时文件失败回收、大文件内存占用、取消和权限错误，并按功能场景回归。

## 2026-08-28 记录的验证（未在本轮复跑）

- 前端类型检查通过。
- 工资目录 ESLint 严格扫描为 0 error、0 warning；全站零错误基线当前被并行迁移的 12 个 `eqeqeq` 错误暂时打破。
- 字段一致性审计通过：0 个兼容字段、329 个已退役字段、0 个兼容边界；工资考勤与销售计算只读取规范字段，工资记录持久化响应与销售统计响应已分别登记。旧字段名称仍可能出现在退役清单、测试和迁移文档中，不属于运行时兼容层。
- 安全、运行时、权限、UI、TAB、按钮、表格、加载和数据新鲜度审计通过。
- 后端真实数据库测试 106 项全部通过，无失败、无跳过。
- 最近一次完整生产构建基线通过；当前构建在 prebuild 阶段被销售、H5、公开商城与入库并行迁移中的 12 个 lint 错误阻塞，工资模块类型、严格 lint、字段、权限和 UI 审计均单独通过。
- `SalesView.vue` 首轮拆分已登记：[SALES_VIEW_SPLIT_PROGRESS.md](./SALES_VIEW_SPLIT_PROGRESS.md)。页面专属模板位于 `src/views/sales/page/`，纯逻辑与样式按职责分目录保存。
- `SalaryView.vue` 拆分与工资字段收敛已登记：[SALARY_VIEW_SPLIT_PROGRESS.md](./SALARY_VIEW_SPLIT_PROGRESS.md)。页头、统计和模板表格状态已拆出，运行时旧字段兼容为 0。
- 前端首屏体积检查通过：首屏 JS 约 565 KiB、CSS 约 230 KiB、合计约 795 KiB；HEIC、PDF、ZXing、html2canvas 均未进入首屏。
- 分析卡片共享样式已移除 183 个强制声明，改由明确的应用根级联边界保持统一覆盖关系。
- 样式债务审计已清零未批准强制声明和非令牌颜色使用点；共享主题色板、逐文件强制覆盖白名单及零增长构建门禁均已启用。
- 全局空状态统一已登记：[EMPTY_STATE_UNIFICATION_PROGRESS.md](./EMPTY_STATE_UNIFICATION_PROGRESS.md)。所有 Element Plus 空状态使用 `DataEmptyState`，并由 `check:empty-states` 防止回退。

## 2026-11-08 全局架构复核与 analytics 批次

- 全局门禁补查发现 controller SQL AST 计数原先只包含 `.execute()` / `.query()`，遗漏了五个存量 controller 通过 repository `executePrepared()` 发出的 SQL；这些调用虽然受 repository 依赖路径门禁约束，但数量可在既有依赖内增长。已将 `executePrepared()`、`executeQuery()`、`executeQueryWithTimeout()` 纳入 SQL 调用计数，并加回归验证新增长会失败；全量 AST 实测 SQL 执行调用由 154 修正为 233，新增计数均来自既有 `brand/color/memory/model/store.controller.js`。逐文件台账和最大值已按实测收口到 233，未改变其余分层基线。该检查统计数据库执行入口调用，不代表所有 controller 业务规则都已迁入 service。
- 本批将权限冲突清理接口接入既有 `PermissionConflictsController → PermissionConflictsService → PermissionConflictsRepository`，保留管理员权限、重复授权保留最小 ID、孤立/停用模块权限清理、旧 schema 兼容、事务提交/回滚及成功/500 响应；service 使用共享 `withConnection`，controller 无 SQL、事务或 repository 依赖。8 项定向测试覆盖路由授权、响应、schema 分支、绑定删除、事务和异常释放。AST 实测 `permission-management.js` 从 15 降至 14，摘要及总基线收口，遗留 handler 从 32 降至 31；route 直接连接租借从 10 降至 9，总基线从 180 降至 179。
- 当前门禁实测 route 内联 handler 31 个 / 6 个文件，controller SQL 执行入口 233/233、事务调用 59/59、controller repository 直连 15/15、反向分层依赖 4/4、直接连接租借 179/179；基础设施三件套存在，4 个 repository 自定义 `withConnection` 均委托共享 helper，`repairs.js` 无内联 handler且无零值键。上述非零数据仍是逐批偿还的存量，不代表 ARCH-001 或连接生命周期债务已清零。
- 本轮最终验证：权限冲突定向测试 8 项、权限事务契约 102 项通过；后端全量测试 1,218 通过、14 跳过、0 失败；`npm --prefix frontend run check:backend-security`、`npm --prefix frontend run check:fields`、根目录 `npm run lint:strict`、`npm run check:docs` 与 `git diff --check` 均通过。字段审计源同步登记 `role-permissions.service.js`；未连接云端数据库。

- 全局复核确认基础设施三件套均存在；共享连接包装、controller SQL/事务、controller 直连 repository 及跨层反向依赖均由架构门禁检查。ARCH-001 当前仍有 15 个 controller→repository 存量依赖，逐文件登记在 `config/backend-route-architecture.json`，最大值与基线总和精确相等，只允许逐项减少；它们是存量豁免，后续触及时应优先迁入 service。共享 `withConnection` 覆盖仓储 wrapper，但不表示所有服务和仓储已统一连接生命周期。
- analytics `/transfers-and-allocations` 已迁入 `AnalyticsTransfersController → AnalyticsTransfersService → AnalyticsTransfersRepository`，保留认证、业务用户及全局 analytics 门店权限链路、日期校验、默认月份、响应字段和七组参数化查询；AST 实测该 route 从 2 降至 1。
- analytics `/sales-forecast` 已迁入 `AnalyticsSalesForecastController → AnalyticsSalesForecastService → AnalyticsSalesForecastRepository`，将预测算法及日期处理放入 service，SQL 留在 repository，保留认证、业务用户、加权排行、参数绑定和响应结构。`formatDateString` 现由 analytics-query 公共导出复用。新增 mock 测试覆盖空结果、预测字段、离线响应及两条查询参数；analytics 内联数从 1 降至 0，删除整个 `analytics.js` 台账键，遗留总数从 51 降至 50，遗留键数与仍有内联文件数均为 6。
- 验证结果：`npm --prefix backend test` 通过（1155 通过、14 跳过、0 失败）；`npm --prefix frontend run check:backend-security` 通过（安全审计 504 个源文件，ARCH 分层门禁通过）；`npm --prefix frontend run check:fields` 通过；本批运行代码、测试和共享日期工具的 ESLint `--max-warnings 0` 通过；`npm run check:docs` 与 `git diff --check` 通过。未连接云端数据库。
- Git `GET /log`、`GET /branches` 和 `POST /delete-commit` 已复用 `GitController → GitService`，保留对应权限；日志接口保留 limit 默认值及 1–100 上限、revert/手动隐藏/本地备份记录过滤，分支接口保留当前分支标记与远端 HEAD 过滤，隐藏提交保留哈希校验、幂等提示和“不影响工作区”响应。Git log、config 写入均通过既有安全参数执行器传递。正式测试覆盖限量、过滤、分支归类、哈希验证和响应错误。AST 实测 `git.js` 从 13 降为 10，摘要已更新；遗留 handler 总数从 50 降为 47，key 数与非零内联文件数仍为 6。
- 本批最终验证：后端全量测试、后端安全及架构门禁、字段审计、严格 ESLint、文档检查和 `git diff --check` 均通过；未执行真实数据库测试，也未对 Git 仓库执行写操作。
- 全局 ARCH 补查发现既有门禁只验证 repository 的 `withConnection` wrapper 是否委托共享 helper，没有覆盖 routes/controllers/services/repositories 中直接调用 `.getConnection()` 的存量。文本扫描得到 182 个匹配，其中 repository 基类 1 个匹配位于注释；TypeScript AST 实测为 181 处 / 51 个文件（route 17、controller 28、service 82、repository 54），逐文件登记于 `config/backend-route-architecture.json`；禁止新增，只允许逐项减少，归零后必须删除台账键。该计数不代表连接释放、事务行为或云端数据库运行状态已验证，相关业务连接迁移仍须按模块覆盖成功/异常释放和事务语义。
- 本批随后将国补详情 `GET /:id` 接入 `SubsidyDetailController → SubsidyDetailService → SubsidyDetailRepository`，原认证、`subsidy:view` 权限和短缓存顺序不变；日期格式、数值转换、照片签名 URL、代办字段及字段掩码保持原响应语义。详情字段处理与国补照片读取共用 `subsidy-protected-photo-url` 工具，删除了重复签名/路径归一化实现；新增测试覆盖成功、缺失、数据库异常、畸形照片 JSON、用户签名映射、字段掩码及参数绑定。route 内联 handler 从 47 降至 46，`subsidy.js` 从 12 降至 11；详情查询通过 pool `execute()`，直接 `.getConnection()` AST 存量为 181，未因本接口迁移减少。
- 全局架构复核（当前工作树）：规范 v3 的基础设施三件套均存在；仓储中 4 个自定义 `withConnection` 均委托 `core/db/connection.js`；ARCH 门禁实际执行基础文件、连接 wrapper、routes/controllers/services/repositories 的直接连接租借、controller SQL/事务、controller→repository 依赖、反向分层依赖、内联 route handler 和孤立 controller 检查。门禁实测通过：遗留 route handler 37 个 / 6 个文件，controller SQL/事务 154/59，controller→repository 15 条，反向依赖 4 条，直接连接租借 181 次；各基线精确相等，仍属待迁移存量。`repairs.js` 已无内联 handler且不在零值台账中。架构审计测试 15 项通过；补齐动态 `import()` 形式的共享连接 helper 检测及回归后，架构审计测试 15 项通过，安全与分层审计均通过。字段审计发现 `permissions` 的 `orphaned_modules`、`has_conflicts` 由 `permission-conflicts.service.js` 输出但未登记该审计源；已补登记，字段审计通过。后端全量测试 1190 通过、14 跳过、0 失败；全局严格 ESLint、文档检查和 `git diff --check` 通过。未连接云端数据库。
- 本批将 `POST /permissions/revoke-batch` 迁入 `PermissionBatchController → PermissionBatchService → PermissionBatchRepository`，保留管理员权限、原空值校验、按传入顺序逐项删除、单事务提交/回滚和成功/错误响应；事务由 service 编排，绑定 SQL 由 repository 执行，controller 不含 SQL、事务或 repository 依赖。6 项替身测试覆盖权限委托、校验与响应、成功提交、写入/事务启动失败回滚、连接释放和 SQL 参数绑定。AST 实测 `permission-management.js` 从 19 降至 18，摘要同步更新，遗留总数从 37 降至 36；`maxLegacyNonControllerRoutes` 精确等于总和，遗留 key 数仍为 6。该 route 原有直接连接租借迁入共享 helper 后，直接租借基线从 181 降至 180。未连接云端数据库。
- 本批将受保护文件 `GET /subsidy/files/*` 迁入 `SubsidyFileController → SubsidyFileService`，签名验证继续由原 route 中间件执行；service 验证国补目录路径、上传根目录边界及文件存在性，controller 保留 400/403/404/500 响应、私有缓存及安全响应头和 `sendFile`。4 项替身测试覆盖签名中间件顺序、无效/缺失路径、文件发送响应头及异常日志。AST 实测 `subsidy.js` 从 10 降至 9，摘要同步更新，遗留 handler 总数从 35 降至 34；遗留 key 数和内联文件数均为 6，最大值精确为 34。全局基建三件套、共享连接 helper、controller SQL/事务与 repository 依赖、反向分层依赖及连接租借门禁继续由 `check-route-architecture.mjs` 覆盖。未连接云端数据库。
- 本批将 `GET /permissions/menu/:role_id` 迁入 `PermissionMenuController → PermissionMenuService → PermissionMenuRepository`，保留管理员权限、数据库旧 schema 的 `modules.is_active` 分支、模块排序、角色可见性回退逻辑、字段整形及原成功/错误响应；service 复用 `getRoleMenuVisibility`，不复制 schema/可见性查询。新增 4 项测试覆盖权限委托、响应/错误映射、schema 能力传递、共享可见性计算和 SQL 排序。AST 实测 `permission-management.js` 从 18 降至 17，摘要同步更新，遗留总数从 36 降至 35；非零 key 与遗留内联文件数均为 6。未连接云端数据库。
- 本批将 `GET /permissions/field-permissions/:role_id` 迁入 `RoleFieldPermissionsController → RoleFieldPermissionsService → RoleFieldPermissionsRepository`，保留 `permissions:admin`、旧 schema 的角色启用字段兼容、模块筛选、模块排序、空配置默认时间戳、JSON 字段配置归一化及 400/404/500 响应契约；controller 无 SQL、事务或 repository 依赖。新增 5 项测试覆盖权限委托、校验/错误响应、旧 schema、配置归一化与损坏 JSON 回退、参数绑定。AST 实测 `permission-management.js` 从 17 降至 16，摘要按实测更新，route handler 总数从 34 降至 33，遗留 key 数与内联文件数均为 6，最大值精确为 33。未连接云端数据库。
- 同批将 `GET /permissions/roles/:id/permissions` 迁入 `RolePermissionsController → RolePermissionsService → RolePermissionsRepository`，保留管理员权限、角色不存在响应、模块启用 schema 分支、模块扫描和静态兜底、统一模块元数据/动作类型、已分配状态映射及响应 meta。controller 不含 SQL 或仓储依赖。新增 5 项测试覆盖授权委托、成功/缺失/异常响应、权限状态映射、扫描/兜底路径和 SQL 参数绑定。AST 实测 `permission-management.js` 从 16 降至 15，摘要同步更新，route handler 总数从 33 降至 32；6 个非零 key 与 6 个内联文件一致，最大值精确为 32。未连接云端数据库。

### 2026-11-08 全局 ARCH-001 复核与权限批次收口

- 确认 `types/actor.js`、`core/base/base.service.js`、`core/db/connection.js` 三项基础设施存在；4 个仓储自定义 `withConnection` 均委托共享 helper。ARCH 门禁逐层检查 routes/controllers/services/repositories 的直接连接租借，统计 controller SQL/事务调用，冻结 controller→repository 依赖及反向分层依赖，并审计内联 route handler、孤立 controller。
- 当前全局 AST 基线包含 controller→repository 15 条（15 个文件）、反向分层依赖 4 条（2 个文件）、直接连接租借 178 处。以上非零值是跨模块存量债务，不限于 inventory/supplier 等单个模块；均禁止增长，逐批迁移后同步下调台账。
- 将 `POST /permissions/assign-batch` 接入既有 `PermissionBatchController → PermissionBatchService → PermissionBatchRepository`，保留管理员权限、校验、旧 schema 兼容和单事务替换语义；10 项替身测试通过。AST 实测 `permission-management.js` 内联 handler 14→13、直接连接租借 9→8，route 总数 31→30、租借总数 179→178；摘要和上限按实测收口，6 个非零 route key 对应 6 个仍有内联的文件。
- 验证：架构测试 22 项、权限批次测试 10 项通过；`node frontend/scripts/check-route-architecture.mjs` 通过。未连接云端数据库。
- 随后将 `GET /permissions/user-field-permissions` 接入 `UserFieldPermissionsController → UserFieldPermissionsService → UserFieldPermissionsRepository`，保留继承的统一认证、用户 ID 双字段兼容、可选模块筛选、旧 schema 分支、多角色字段并集、角色来源及无角色/坏 JSON/异常响应。新增 5 项行为测试覆盖 controller 响应、字段合并、参数绑定和错误配置；与既有角色字段权限测试合计 10 项通过。AST 实测 `permission-management.js` 从 13 降至 12，摘要重新计算，route 总数从 30 降至 29，遗留文件仍为 6；连接租借数不变。变更文件严格 ESLint 通过；未连接云端数据库。
- 再将 `POST /permissions/field-permissions/:role_id` 与 `/batch` 接入 `RoleFieldPermissionsController → RoleFieldPermissionsService → RoleFieldPermissionsRepository`，保留 `permissions:admin`、原输入校验与错误状态、单/批量写入分支、模块启用校验、事务提交/回滚和成功后清缓存。新增替身测试覆盖授权路由、缓存时机、批量创建/更新、校验失败回滚及连接释放。AST 实测 `permission-management.js` 从 12 降至 10，摘要重算；route handler 总数 29→27，直接连接租借 178→176，6 个非零 route key 仍对应 6 个内联文件。未连接云端数据库。
- 全局 controller→repository 棘轮继续按 AST 收敛：`database-status.controller.js` 改为调用 `DatabaseStatusService`，由 service 调用现有 repository；保留原 HTTP 响应与 `system:view` 路由授权，新增 service 委托断言。逐文件依赖键已删除，最大值由 15 精确降至 14；此项为全局 ARCH-001 清偿，不局限于单一业务域。
- 全局复核结果：预定 service 调用的是 repository 暴露的连接包装方法，实际 `withConnection` 实现位于两个预定 repository 且均委托共享 helper；仓储共 4 个自定义包装方法，均由门禁验证。当前直接 `.getConnection()` AST 命中仍为 176，routes/controllers/services/repositories 分别 12/28/83/57；这是待逐批迁移的全局连接租借存量，数量门禁不代表每条成功/异常释放路径都已证明。验证：后端测试 1,236 通过、14 跳过、0 失败；安全审计检查 536 个源文件及全部路由；分层审计 route handler 26/26（6 键对应 6 个内联文件）、controller SQL/事务 233/59、controller→repository 14/14、反向依赖 4/4、直接连接租借 176/176；字段一致性、变更文件严格 ESLint、文档检查与 `git diff --check` 通过。未连接云端数据库。
- 本批将 `GET /subsidy/search-phones/:identifier` 接入 `SubsidyPhoneSearchController → SubsidyPhoneSearchService → SubsidyPhoneSearchRepository`，保留 `subsidy:view`、短缓存、空关键词 400、无匹配 404、成功/500 响应、最新客户映射、国补状态和申请资格判断；计时日志随 controller 保留，三组查询由 repository 参数化执行。新增测试覆盖路由中间件、响应分支、字段/资格整形及查询参数绑定，并将三个新分层源登记到补贴字段契约审计。AST 实测 `subsidy.js` 从 9 降到 8，摘要重算，总 route handler 基线从 27 降到 26；6 个非零 key 仍与 6 个内联文件一致。

### 本批权限清空接口迁移

- `PUT /permissions/roles/:id/permissions/clear-all` 已接入 `RolePermissionsController → RolePermissionsService → RolePermissionsRepository`，角色权限变更审计计算抽入共享 audit service/repository，供权限管理中仍内联的操作复用。保留 `permissions:admin`、角色不存在 404、只删除非 `menu_view` 权限、仅在实际有删除时写审计、逐用户权限缓存失效和原响应字段；controller 无 SQL、事务或 repository 依赖。9 项定向测试覆盖路由授权、响应映射、权限保留、审计条件、缓存失效、模块名映射和参数绑定。AST 实测 `permission-management.js` 从 7 降至 6，全局 route handler 从 22 降至 21；摘要及上限已按 AST 收口，6 个非零 key 与 6 个内联文件一致。后端全量测试 1255 通过、14 跳过、0 失败；后端安全与分层审计、字段一致性、严格 ESLint、文档检查及 `git diff --check` 通过。未连接云端数据库或生产接口。
- 本批将 `PUT /permissions/roles/:id/permissions` 接入同一 controller/service/repository 分层，保留 `permissions:admin`、不存在角色 404、保留 `menu_view`、权限归一化、变更审计、逐用户缓存失效及原响应；新增 service 行为测试覆盖写入顺序、审计条件和缓存清理。AST 实测 `permission-management.js` 从 6 降至 5，摘要按 AST 重算，全局 route handler 从 21 降至 20，6 个非零 key 与 6 个内联文件一致，`maxLegacyNonControllerRoutes=20`。全局 ARCH 现测基础设施 3/3、4 个自定义仓储连接 wrapper 均委托共享 helper、controller→repository 存量 14 条/14 个文件、反向依赖 4 条/2 个文件、直接连接租借 174 处/51 个文件；均由 AST 门禁冻结并只允许下降。定向角色权限测试 12 项、架构门禁测试 12 项通过，分层门禁通过。未连接云端数据库或生产接口。
- 随后将 `PUT /permissions/roles/:id/permissions/select-all` 接入 `RolePermissionsController → RolePermissionsService → RolePermissionsRepository`，复用权限变更审计、共享模块扫描器和用户权限缓存失效；保留管理员授权、角色不存在 404、数据库模块启用筛选、已确保模块补齐、扫描失败 500 文案、保留菜单权限及原成功响应。该接口原本不使用事务，迁移后仍不引入事务。新增测试覆盖数据库模块写入、扫描回退/失败、审计、缓存与响应映射，并把原 route 实现断言改为分层契约断言。AST 实测 `permission-management.js` 从 5 降至 4，全局 route handler 从 20 降至 19，6 个遗留 key 与 6 个内联文件一致，`maxLegacyNonControllerRoutes=19`。定向权限及契约测试 117 项通过，变更文件严格 ESLint 与分层门禁通过。未连接云端数据库或生产接口。
- 本批将 `PUT /permissions/field-permissions/:role_id` 接入 `RoleFieldPermissionsController → RoleFieldPermissionsService → RoleFieldPermissionsRepository`，复用既有事务写入，保留 `permissions:admin`、输入规范化、角色/模块状态兼容、单事务提交/回滚、成功后清缓存、仅在字段变化时写审计以及原 400/404/500 和成功响应；POST 保存接口保持原行为。新增测试覆盖响应、字段差异审计、缓存与事务顺序。AST 实测 `permission-management.js` 从 4 降至 3，全局 route handler 从 19 降至 18，6 个遗留 key 与 6 个内联文件一致，`maxLegacyNonControllerRoutes=18`。定向字段权限与契约测试 114 项通过，变更文件严格 ESLint 通过。未连接云端数据库或生产接口。
- 全局 ARCH-001 复核发现上述权限迁移同时将 `routes/permission-management.js` 的直接 `.getConnection()` 调用从 4 处降至 3 处；此前台账仍记 4，故安全/分层门禁失败。已按 AST 实测将该文件连接租借基线从 4 降为 3，`maxDirectDatabaseConnectionLeases` 从 174 精确降为 173。修正后门禁实测：基础设施 3/3；route 内联 18/18、6 个非零 key 对应 6 个内联文件；controller SQL/事务 233/59；controller→repository 14 条/14 个文件；反向分层依赖 4 条/2 个文件；直接连接租借 173/173；孤立 controller 0。controller→repository 存量是全局逐文件棘轮，不局限于单一业务模块；以上非零项仍待逐批迁移，不表示债务已清零。架构测试 16 项、后端全测 1,263 通过/14 跳过/0 失败、字段一致性审计通过；未连接云端数据库。
- 本批将 `GET /subsidy/export/excel` 迁入 `SubsidyExportController → SubsidyExportService → SubsidyExportRepository`，Excel 文件构造抽入 utility；保留原筛选、排序白名单、字段权限、导出列和响应头。新增 5 项行为测试覆盖 route 中间件、响应、筛选规范化、参数绑定及工作簿内容。AST 实测 `subsidy.js` 内联 handler 从 6 降至 5，总数从 16 降至 15，摘要同步更新；架构门禁实测基础设施 3/3、6 个遗留 key 对应 6 个内联文件、controller SQL/事务 233/59、controller→repository 14 条、反向依赖 4 条、直接连接租借 172 处，孤立 controller 0。进一步将 repository 共享连接检查改为校验实际导入绑定被调用，并增加伪委托回归用例，避免仅导入 helper 却调用同名本地函数绕过。未连接云端数据库或生产接口。
- 本批将 `PUT /subsidy/:id/photos` 接入 `SubsidyPhotosController → SubsidyPhotosService → SubsidyPhotosRepository`，上传权限保持原样；照片 URL 归一化及签名/引用校验抽入共享 utility，供创建申请接口继续复用。service 负责行锁事务、删除清单校验、提交后旧文件清理及缓存失效，repository 使用共享连接租借 helper。新增回归覆盖路由权限与委托、400/404/成功/签名错误响应、锁定和提交顺序、旧照片清理、非法删除回滚及连接释放。AST 实测 `subsidy.js` 从 5 降至 4，总内联 handler 从 15 降至 14，摘要同步更新；该路由直接连接租借从 2 降至 1，全局 max 从 172 收敛至 171。未连接云端数据库或生产接口。
- 本批将 `POST /permissions/import` 迁入 `PermissionImportController → PermissionImportService → PermissionImportRepository`，保留管理员权限、格式错误 400、覆盖/跳过已有权限语义、角色/模块 schema 兼容、跳过不存在项告警、导入数量与原错误响应；事务与连接释放由 service/repository 负责。新增测试覆盖响应、schema 分支、已有权限处理、回滚释放和 SQL 绑定。AST 实测 `permission-management.js` 从 2 降至 1，总 route handler 从 14 降至 13，摘要更新；该路由直接连接租借从 2 降至 1，全局 max 从 171 收敛至 170。未连接云端数据库或生产接口。
- 本批将 `PUT /permissions/menu/:role_id` 迁入 `PermissionMenuUpdateController → PermissionMenuUpdateService → PermissionMenuUpdateRepository`，保留管理员权限、数组校验、模块及旧 schema 兼容、菜单可见性双表同步、权限变更审计、事务提交后日志记录及原响应；清除 route 中原有的菜单权限调试日志。新增 5 项测试覆盖路由授权、响应映射、schema 分支、审计/日志顺序、事务回滚与 SQL 参数绑定。AST 实测 `permission-management.js` 从 1 降至 0，删除该文件的整个遗留台账键；总 handler 从 13 降至 12，非零遗留 key 与内联文件数同步从 6 降至 5。直接连接租借从 170 降至 169。未连接云端数据库或生产接口。
- 本批将 `POST /subsidy/upload/photo` 的处理接入 `SubsidyPhotosController → SubsidyPhotoUploadService`；route 保留认证、上传权限、Multer `file` 中间件及原上传错误映射。service 负责照片命名、HEIC/HEIF 转换、文件移动、私有签名 URL 和失败清理，保留上传响应字段与状态码。新增 4 项测试覆盖 route 授权/中间件委托、无文件响应、普通图片重命名、HEIC 转换和失败清理。AST 实测 `subsidy.js` 从 4 降至 3，摘要更新；总 handler 从 12 降至 11，5 个遗留 key 仍对应 5 个内联文件。未连接云端数据库或生产接口。
- 随后进行全局架构复核，确认基础设施三件套已存在，ARCH 门禁已检查 route handler、controller SQL/事务、controller→repository 依赖、反向分层依赖、直接连接租借及孤立 controller；8 个 repository `withConnection` wrapper 分布于 7 个文件，均委托共享 helper。当前基线为 route handler 11/5 个文件、controller SQL 233、事务 59、controller→repository 14/14 个文件、反向依赖 4、直接连接租借 169/51 个文件；各项均与逐文件台账精确一致且不得增长，非零项仍是全局待迁移债务。历史段落所记 4 个 wrapper 是此前时点，不作为当前数量。验证：架构门禁通过、架构审计测试 16 项通过、后端全测 1,296 通过/14 跳过/0 失败、`git diff --check` 通过；未连接云端数据库。
- 本批将 `GET /subsidy` 列表迁入 `SubsidyListController → SubsidyListService → SubsidyListRepository`，route 保留认证、`subsidy:view`、短缓存；service 保留筛选、分页上限、排序白名单、数值/照片/办理人映射与字段脱敏，repository 执行参数化分页和总数查询，controller 保留响应、错误映射和计时日志。新增 4 项测试覆盖 route 中间件、成功/异常响应、分页/排序/签名照片/字段脱敏及 SQL 参数绑定；补贴字段审计登记新分层源。AST 实测 `subsidy.js` 从 3 降为 2，摘要重算，全局内联 handler 从 11 降为 10，5 个遗留 key 仍与 5 个内联文件一致；controller SQL、事务和 repository 依赖基线未增加。定向测试及契约测试 106 项、字段一致性审计通过；未连接云端数据库。
- 本批将 `PUT /rentals/:id` 接入 `RentalUpdateController → RentalUpdateService → RentalUpdateRepository`，保留编辑权限、字段隐藏校验、不可修改字段、管理员编辑已结束合同、买断期数/金额校验及租赁合同、销售记录、设备和积分同步；service 编排行锁事务，repository 执行 SQL 并通过共享 `withConnection` 管理租借释放。新增 5 项测试覆盖 route 权限委托、响应映射、买断关联写入、未找到/已结束/非法值/已还期数拒绝、事务回滚与连接释放；金额规则并入现有 `rental-calculations.js`，避免重复定义。AST 实测 `rentals.js` 从 2 降至 1，摘要重算，全局 handler 从 10 降至 9，5 个非零遗留键仍与 5 个内联文件一致；其他架构基线未增加。未连接云端数据库。

### T17 分批实施记录（2026-11-08）

以下按批次保留当时数字；当前状态以顶部 T17 汇总及本节末尾最终复核为准。

- 最新 ARCH AST 实测：内联 route handler 2 个 / 2 个文件；controller SQL 233、事务调用 59、repository 直连 14、反向依赖 4、直接连接租借 166；遗留 handler key 数与内联文件数一致，各项均与基线相符。基础设施三件套、仓储共享 `withConnection` 委托检查和以上分层维度均由全局门禁执行；非零基线是全局存量债务，只允许逐批下降。
- 当前 AST 确认剩余路由为 `backend/src/routes/phones.js` 的 `PUT /:id` 和 `backend/src/routes/sales.js` 的 `POST /phone`；台账分别为 1，`maxLegacyNonControllerRoutes=2`。手机编辑需保留目标交易类型二次权限、发票号类型/日期同步、销售记录与积分原子更新、设备状态锁及预定同步；销售出库需保留多设备锁定、预定客户/设备校验、付款记录、备注规则和积分事务。下一批按 route → controller → service → repository 迁移，禁止只把 handler 移到 controller；每批将 route 台账归零键删除并按 AST 精确下降。
- 本轮后端全测 `1,344` 通过、14 跳过、0 失败；Git 恢复主线定向行为测试 6 项通过；全局分层与安全审计、字段一致性、严格 ESLint、文档检查和 `git diff --check` 通过。安全审计检查 582 个源文件。未连接云端数据库或生产 Git 工作区。
- 本批将 `POST /rentals` 接入 `RentalCreateController → RentalCreateService → RentalCreateRepository`，route 保留 `rentals:create` 与隐藏字段校验；service 承担字段验证和事务编排，repository 参数化读取并锁定客户/设备、写入租赁/销售/付款数据，买断销售继续在同一事务内同步积分、设备状态与首付支付记录。成功响应仍返回脱敏后的合同 ID/编号，失败保持原 400/500 映射。新增 7 项测试覆盖路由授权委托、响应与脱敏、按天租赁、买断销售/积分/付款、无效输入、失败回滚/释放及锁查询参数。AST 实测 `rentals.js` 内联 handler 从 1 降至 0，删除整个 route 台账键；全局 handler 从 9 降至 8，5 个遗留键收敛为 4 个并与内联文件数一致。该 route 直接连接租借从 1 降至 0，全局基线从 168 降至 167。定向租赁与交易契约测试 109 项通过；未连接云端数据库或生产接口。
- 本批将 `POST /git/commit` 接入 Git controller 与独立 `GitCommitService`，route 保留 `git-management:edit`；service 继续执行主分支/分离 HEAD 校验、空工作区短路、暂存与临时提交消息文件清理、无远程仓库处理、推送大文件拦截和推送结果核验，保持既有 HTTP 状态和响应字段。6 项新测试覆盖路由授权委托、分离/非主分支冲突、空工作区、提交消息文件、推送成功/无远程/大文件/未验证及 controller 错误映射；Git 命令全部以替身执行，未运行真实提交或推送。AST 实测 `git.js` 内联 handler 从 4 降至 3，摘要同步更新，全局 handler 从 8 降至 7；遗留 key 数仍为 4，仍内联文件数为 4，route 台账总和精确等于 7。controller SQL、事务、repository 依赖与连接租借基线未增加。
- 随后将 `POST /git/push` 接入 `GitController → GitPushService`，保留 `git-management:edit`、主分支/分离 HEAD 冲突、大文件阻断、上游分支判断、推送后远端核验及既有响应结构；Git 命令由替身执行。测试覆盖授权委托、分支错误、大文件阻止、首次推送命令、已同步容错、远端未同步及 controller 错误映射。AST 实测 `git.js` 只剩 `/backup/archive` 和 `/restore-main` 两个内联 handler，count=2、digest=`b760e738f6073997d5a3358116b45657017c13559cc9750ccf0ef931f3fbcc3e`；全局 handler 从 7 降至 6，4 个非零遗留 key 对应 4 个内联文件，max 与逐文件 count 总和均为 6。清除 route 中迁移后无引用的分支错误 helper。controller SQL/事务、repository 依赖与连接租借基线未增加。
- 本批将 `POST /subsidy/apply` 接入 `SubsidyApplyController → SubsidyApplyService → SubsidyApplyRepository`，route 保留统一认证、`subsidy:create` 和有照片时的 `subsidy:upload` 校验。service 复用国补照片规范化/签名/重复引用校验，编排身份证补全与申请创建事务；repository 参数化查询、更新和插入。保留 IMEI2 必填、重复申请 400 与已有记录数据、日期按原格式截取、补贴金额/比例默认值、代办字段和成功响应；失败回滚并在连接释放后才返回，成功提交后清理 `/subsidy` 缓存。新增 5 项行为测试覆盖路由授权委托、事务/释放/缓存顺序、缺字段、重复申请、无效照片回滚、错误响应和 SQL 参数绑定；同步更新字段审计源。AST 实测 `subsidy.js` 从 2 降至 1，digest=`2c272e9e91391a23877bf6cb78a4c0be3fe0e1a484e93865734d11d2133fbc49`；全局 handler 从 6 降至 5，4 个非零遗留 key 对应 4 个内联文件，`maxLegacyNonControllerRoutes` 与逐文件总和均为 5。该 route 原有直接连接租借从 1 降至 0，全局直接租借从 167 降至 166，并删除归零台账键；controller SQL/事务和 repository 直连基线未增加。
- 本批将 `POST /git/backup/archive` 接入 Git controller 与专用 archive service，保留 `git:create`、并发创建 409、北京时间命名、名称净化、核心路径白名单、敏感/生成文件排除、异步 tar 120 秒主方案及 60 秒简化重试、文件大小与 Git 提交元数据、成功和失败响应。新增 5 项行为测试覆盖授权委托、安全归档清单与排除项、完整/降级 tar、空 Git 元数据、并发拒绝及错误释放后恢复。AST 实测 `git.js` 只剩 `/restore-main`，count=1、digest=`f3e0e743c9f064428f88316e77101bd004d9e2d7d8a9db597df28abb72ee3277`；全局 handler 从 5 降至 4，4 个遗留 key 对应 4 个内联文件，`maxLegacyNonControllerRoutes` 与逐文件总和均为 4。controller 数据库基线与连接租借基线未增加。
- 本批将 `PUT /subsidy/:id` 接入 `SubsidyUpdateController → SubsidyUpdateService → SubsidyUpdateRepository`。保留编辑、动态审批/到账和隐藏字段权限中间件顺序，以及原有缺记录/价格/门店响应、客户字段同步、日期规则、代办人清理、照片目录移动与失败回滚、设备销售日期同步及 `/subsidy` 缓存失效；不新增事务或 `updated_at` 写入。新增 4 项行为测试覆盖 route 权限委托、404/价格拒绝、规范字段和日期写入、缓存与 controller 异常响应；字段审计源登记新三层文件。AST 实测 `subsidy.js` 内联 handler 从 1 降至 0，删除整个 route 台账键，route 总数从 4 降至 3，3 个非零 key 与 3 个内联文件一致，`maxLegacyNonControllerRoutes=3`。全局 ARCH 其余基线实测为 controller SQL/事务 233/59、controller→repository 14、反向依赖 4、直接连接租借 166；基础设施 3/3，8 个 repository `withConnection` wrapper 均委托共享实现。后端全测 1,338 通过/14 跳过/0 失败；分层测试 16 项、全局安全审计（581 个源文件）、字段一致性、变更文件严格 ESLint、文档检查及 `git diff --check` 通过。未连接云端数据库或生产接口。
- 随后将 `POST /git/restore-main` 接入 `GitController → GitRestoreMainService`，route 保留全局认证及 `git-management:edit`。service 接管当前分支/脏工作区判断、自动备份快照、未跟踪文件 stash、生成声明文件冲突重试、切回 main、合并快照及 stash 恢复；保留当前已在 main、合并冲突、stash 冲突、checkout 阻断及通用错误的响应结构。新增行为测试覆盖干净/脏 main、快照和 stash 合并、两种冲突、生成文件阻断重试及 controller 响应；所有 Git 和文件操作均用替身，未运行真实 checkout/stash/merge。AST 实测 `git.js` 内联 handler 从 1 降至 0，删除整个 route 台账键；全局 handler 从 3 降至 2，2 个非零 key 与 2 个内联文件一致，`maxLegacyNonControllerRoutes=2`。controller SQL/事务、repository 直连、反向依赖及连接租借基线未增加；门禁和架构审计测试、定向测试、严格 ESLint 与 `git diff --check` 通过。
- 2026-11-08 全局手机编辑迁移：`PUT /phones/:id` 接入 `PhoneUpdateController → PhoneUpdateService → PhoneUpdateRepository`，保留四组 route 编辑权限、目标交易类型二次权限、字段/IMEI/价格校验、设备状态行锁、发票号规则、客户和销售同步、积分、预定匹配及缓存失效。service 不再直接执行 SQL 或生成 HTTP 响应；媒体目录 SQL 进入 repository，并在后续事务失败时补偿回搬文件。迁移后 `phones.js` 内联 handler 和直接连接租借均为 0，删除对应整个台账键，`maxLegacyNonControllerRoutes=0`、`maxDirectDatabaseConnectionLeases=164`。ARCH-001 controller→repository 棘轮覆盖全体 controller，存量为 14 条/14 个文件，只允许逐文件下降；本批未增加。后端全测 1,365 项：1,351 通过、14 跳过、0 失败；分层门禁和安全审计通过，分别检查 0 个内联 handler、controller→repository 14/14、连接租借 164/164，以及 589 个源文件和全部路由。字段审计、文档检查、相关严格 ESLint、手机交易/媒体/响应映射定向测试和 `git diff --check` 均通过。未连接云端数据库。
- 2026-11-08 route 收尾复核：全局查出 `menus.js`、`data-check.js` 共 29 个只转发到 controller 的箭头函数。全部改为直接传入绑定后的 controller 方法，保留菜单/data-check 权限与文件上传中间件。架构分析器现在把所有箭头/函数表达式 handler 视为内联，即便函数体只调用 controller；新增回归测试验证 wrapper 会被门禁拒绝。收口后全路由 AST 门禁实测内联 handler `0/0`、遗留 key `0`；没有非零 route 基线需要下调。新增 route 权限/委托测试、架构分析测试通过；后端全测 1,367 项：1,353 通过、14 跳过、0 失败。未改变业务响应或数据库行为。
- 2026-11-08 ARCH 口径与锚点修正：租借 AST 按调用对象及返回值排除返回池对象的 `this.getConnection()` 访问，并继续计入真正的 `.getConnection()` 独立连接申请。全局旧台账 164 经语义规则重测为 125；其中 `base.repository.js` 由 9 降为 1，`query.repository.js` 由 11 降为 2，其他 pool accessor/应用连接访问也按 AST 实测清除。随后将 query repository 两处事务获取改用共享 `withConnection`，租借数降至 123；新增测试验证异常回滚、提交及单次释放。六个 `max*` 建立带日期/事由的 `baselineHistory`，门禁要求历史追加、最新锚点等于 max，并相对目标分支检查历史不可改写。当前配置尚未存在于 HEAD，运行日志明确报告首次登记 bootstrap；合入后才可实测目标分支锚点比较。门禁测试 15 项通过，分层审计显示 route 0、SQL/事务 233/59、controller repository 14、反向依赖 4、连接租借 123。未连接云端数据库。
- 2026-11-08 ARCH-004 与 inventory 样板迁移：`InventoryController` 的 list/detail/remove/update/quick-sale/overview/stats 全部改为调用 `InventoryService → InventoryRepository`；SQL 与筛选构造位于 repository，service 编排事务、状态规则与格式化，快速出库通过 BaseService/Actor helper解析登录操作者。原有权限 route 未变；非法输入、预订/已交易删除限制、关联记录拒绝、旧 `Inventorytime` 字段兼容、快速销售单号/收款/积分和统计字段由 11 项定向测试覆盖。controller SQL/事务 34/18 归零，删除逐文件基线项并把 max 下调至 199/41；controller 连接租借 5 归零，lease max 123→118。整体架构门禁和测试通过；未连接云端数据库。门禁另增加目标分支逐文件/依赖基线比较，防止 max 不变时把债务挪到其他文件；本台账在当前 HEAD 尚无历史版本，目标分支锚点比较需待配置首次合入后生效。
- 2026-11-08 前端错误日志分层收口：`FrontendErrorLogController` 保留认证用户 ID 校验和 HTTP 响应，报告校验、敏感值处理与持久化委托给 `FrontendErrorLogService → FrontendErrorLogRepository`。controller repository 直连从 14 降至 13，台账删除对应依赖并追加 max=13 锚点；定向测试 8 项覆盖认证拒绝、批次校验、响应、仓储参数化批量写入及错误 Token 脱敏。未连接云端数据库。
- 2026-11-08 权限诊断分层收口：`DebugPermissionsController` 改为调用 `DebugPermissionsService → DebugPermissionsRepository`，用户权限汇总、权限筛选及角色权限摘要移入 service；保留 `permissions:admin`、响应字段、404 与 500 映射。controller repository 直连从 13 降至 12，删除整个依赖键并追加 max=12 锚点。未连接云端数据库。
- 2026-11-08 公告模块分层收口：`SiteAnnouncementController` 改为调用 `SiteAnnouncementService → SiteAnnouncementRepository`，公告输入校验、输出字段整形及 CRUD 编排归入 service；controller 保留 ID 校验、统一响应与错误映射。controller repository 直连从 12 降至 11，删除依赖键并追加 max=11 锚点；原路由权限未变，未连接云端数据库。
- 2026-11-08 品牌管理分层收口：`BrandController` 改为调用 `BrandManagementService → BrandRepository`，分页/统计/建议与业务结果整理归入 service，SQL 移入 repository，排序事务通过共享 `withConnection` 完成并确保异常回滚、释放。controller SQL/事务从 199/41 降至 187/38，controller repository 直连从 11 降至 10；对应逐文件台账键删除并追加单调递减锚点。定向品牌与事务契约测试通过；未连接云端数据库。

### T17 最终复核与任务拆分（2026-11-08）

- 指标修正独立验收：旧口径 164→125 是当时按池 accessor 语义重测的结果，不是清偿 39 处真实租借。本轮进一步区分 `database-sync.service` 从 Map 取已持有连接与新申请连接：对同一最终业务源码，以关闭/开启该项识别作对照，全局分别为 79/73，该文件分别为 6/0；无文件白名单，真实嵌套 `.getConnection()` 仍计数。指标校正与业务重构分开记录，不把差额计作业务迁移。
- ARCH-004 业务重构独立验收：query.repository 原 11 次中有 9 次池访问、2 次真实事务租借；两处真实租借接共享 `withConnection`，query 当前为 0，提交、失败回滚和单次释放均有正式测试。inventory 之后的本批业务收编另减少 39 次真实租借；结合上述 6 次指标校正，最终全局 118→73。认证初始化、菜单/模块、商城、员工角色、预定读取、手机查询、公告等调用链复用共享 helper，外部传入的事务执行器不由读取仓储释放。
- controller 分层继续收敛：入库全部业务、用户创建/更新、系统管理、屏幕锁及供应商排序分别进入 service/repository；颜色、内存、型号和门店排序统一接 `ReferenceOrderingService → ReferenceOrderingRepository`。保留行锁、门店范围、字段/响应、回滚释放及提交后缓存失效契约。SQL 187→153→149，事务 38→12→0，仓储直连 10→9；反向依赖仍为 2，不宣称全部 B 套完成。
- 所有 `max*` 动态要求有效历史锚点；已有历史只能追加，日期不倒退，最新值必须与 max 相等。相对 PR 目标/指定引用（默认 HEAD）比较逐文件 AST 和历史前缀，防止保持总量却把债务迁到新文件；无事由上调、改历史和缺少新增 max 的锚点均有拒绝测试。当前目标缺台账，历史前缀只能在合入后核验；源码比较已执行，初始登记不代表债务相对目标完全未增长，事由记录也不能代替人工评审。
- 最终执行：`npm --prefix backend test` 共 1,373 项，1,359 通过、14 跳过、0 失败；`npm --prefix frontend run check:backend-security` 的 23 项回归通过、安全审计覆盖 605 个源文件，分层门禁通过；架构专项测试 19/19 通过。全局 route 内联 0/0，遗留 key 0/内联文件 0，controller SQL 149/149、事务 0/0、仓储直连 9/9、反向依赖 2/2、直接租借 73/73、孤立 controller 0。前端 `type-check`、全局 `lint:strict`、门禁/触及测试定向 ESLint、`check:fields`、严格公共选项审计（22 处有效登记）、`check:docs`（205 份文档、6 个编译示例）与 `git diff --check` 均通过。额外清理事务契约测试的分号格式及门店范围测试的失效变量，修改后相关契约 137/137 通过，未删业务断言。未连接云端数据库；14 项跳过不能算数据库通过，未执行浏览器或生产验收。

### T17 提交后存量治理任务（2026-11-08）

- 任务起点：提交 `fc7c57f` 后工作区干净；重新执行分层门禁通过，未再显示首次登记。当前本地 HEAD 已有台账，已启用历史前缀与逐文件基线比较；这不表示远程 PR 目标引用已包含台账，PR 仍须按实际目标运行。
- 任务目标：controller SQL 149→0、controller→repository 9→0、反向依赖 2→0、租借计数 73→0。8 个 controller 占 SQL 128/149；7 个 controller 同时有 SQL 和仓储直连，按业务域整批清偿；租借分布 22 个文件，商城 13、数据检查 12、同步 controller 7 为前三。租借指标语义修正和真实业务收编各自记录，禁止混算。
- B1 连接生命周期：19 个服务/仓储文件的 60 处手取连接改由公共 helper 托管，实测 73→13；包含商城全部 13 处、数据检查 12 处、备份/工资/导入/提醒/菜单/设置/共享分类/同步/供应商打款/调拨及用户仓储等。成功提交、业务异常、提前返回、开启事务失败均释放一次；提醒详情与受保护导航详情在事务释放后读取，商城物理文件删除仍在提交与释放后执行。保留原 SQL 与事务/补偿行为，未豁免文件、未改计数语义；其他三项仍为 149/9/2。
- B1 正式新增 `backend/test/service-connection-lifecycle.check.js` 六项行为回归，覆盖设置成功/开始失败/写入失败、空备份提前返回、商城媒体清理顺序、提醒详情读取失败不回滚已提交事务。B1 与 B2 最终全量后端均为 1,365 通过、14 跳过、0 失败；跳过用例不计为数据库验证通过。未连接云端数据库。

- B2a/B2b 基础资料：颜色/内存共用 `ReferenceManagementService → ReferenceManagementRepository`（固定表/字段白名单），型号/门店分别接管理 service 与仓储；controller 只保留 HTTP 与缓存失效。业务校验、格式化、分页/排序、严格门店范围、导出进入 service，SQL 在仓储；公共选项纯函数提取为唯一工具实现，既有 service 保持重导出兼容。SQL 149→114→81、仓储直连 9→7→5，归零台账键删除，追加下降锚点；事务/route 仍为 0，反向依赖 2，租借计数 13。四域与字段/范围/公共选项/交易契约 141 项通过；后端全测 1,365 通过、14 跳过，安全回归 23 项及 610 个源文件审计通过，字段审计通过。未连接云端数据库。

- B4 反向依赖清零：综合查询的公共选项组合回到 `QueryService`；退库/删除校验、积分冲回和事务编排进入 `QueryMutationService`，SQL 留在 `QueryRepository`，公共积分服务保持唯一实现。两条 repository→service 依赖均删除，追加 max=0 锚点；5 项事务行为测试覆盖成功/权限拒绝/状态冲突/积分失败的回滚释放，相关 38 项回归通过。积分正文已同步调用入口。
- B3/B3b：仪表盘、供应商 SQL 下沉并移除仪表盘两次纯调试查询；用户/用户门店/图标业务及最后五个 controller 的仓储直连迁入对应 service，客户校验、积分配置与消费整形和员工角色校验同步下沉。SQL 81→50→39，仓储直连 5→0，反向依赖保持 0；租借计数仍 13。各域已有行为回归通过，字段审计源与契约测试随调用链更新，相关综合回归已收口，最终命令结果见本节末尾。未连接云端数据库。

- 独立指标修正：租借接收对象按静态导入类、继承、构造参数默认值、词法作用域及成员绑定解析；考勤 3 处池访问、两个同步 service 的 2 处已有连接读取、同步 controller 的 1 处已有连接读取为误计，实测 13→7。本批没有豁免文件或改名隐藏调用；对象不明、构造参数未知、字段被改写、获取连接的覆盖方法和嵌套池租借仍计数。架构正式回归新增正反例，21/21 通过。
- B3c/B5：价目导入/导出、来源同步及维护进入 `PriceListManagementService`，SQL 进入维护仓储；认证/会话/数据库诊断和导入历史分别接对应 service/repository；数据库同步表结构、映射/任务和预检进入 `DatabaseSyncManagementService`，SQL 进入专用仓储。SQL 39→13→0；同步 6 处真实租借使用共享 helper，删除无调用的 `BaseRepository.acquireConnection`，租借 7→0。四维台账全部空集合，max 均为 0，历史未改写。用户、同步等身份入口复用 BaseService/Actor；SQL 与事务没有回迁 controller。
- 同链路修复：本地到云端两个入口复用同一个外部连接注册表，删除错误构造和重复执行实现；智能同步补齐外部连接用户归属；表名校验复用唯一 `database-identifier` 工具。用户创建/更新在事务提交释放后再查公开详情，避免小连接池互等和详情失败时错误回滚已提交事务。新增同步 6 项、价目业务 5 项、用户写入生命周期 1 项正式回归，全部通过；本轮未请求或执行真实业务数据写入。

- 最终收口：`npm --prefix backend test` 共 1,394 项，1,380 通过、14 跳过、0 失败；安全/分层回归 25/25、安全扫描 633 个源文件、下载安全回归 7/7 均通过。分层门禁显示目标分支 HEAD 历史锚点及目标源码 AST 已比较；route/事务/SQL/仓储直连/反向依赖/直接租借/孤立 controller 均为 0，遗留 key 数与内联文件数均为 0。公共选项严格审计 22 处有效登记、字段一致性、`npm --prefix frontend run type-check` 及文档检查通过；全部 `backend/src`、`frontend/src`、3 个改动的架构脚本及 19 个本轮测试文件严格 ESLint（`--max-warnings 0`）通过。用户写入生命周期测试最后一次格式调整后，21 项定向回归再次通过，不重复累加至全测数量。未连接云端数据库，14 项跳过不能算真实数据库通过；未执行浏览器、远程 PR 或生产验收，本轮代码/config/脚本/正式测试/文档仍为同一待提交变更集。
- 扩展检查的既有失败：将 ESLint 范围扩大到整个 `backend/test` 后有 80 条格式警告，全部来自本轮未改动的 `customer-token-security.check.js`（1）、`mock-routes.check.js`（21）、`preorder-mutation-controller.check.js`（1）、`response-safety.check.js`（26）、`sales-available-phones-service.check.js`（3）、`upload-file-validation.check.js`（28）。逐一以 `git show HEAD:<路径>` 的内容通过 `eslint --stdin --stdin-filename <路径> --format json --max-warnings 0` 复核，警告数量完全一致、均无 error；属于已提交测试格式债务，本轮没有关闭规则或扩大忽略范围，也不将这个扩展检查报告为通过。

## 完成标准

1. “已完成”必须有对应命令、自动测试或真实数据库核验记录。
2. 兼容字段只代表迁移边界，不算统一完成；删除前必须确认仓内和外部调用方均不再使用。
3. 大页面拆分必须保持路由、权限、表单和缓存行为不变，并通过类型检查与生产构建。
4. 样式治理不能机械删除 `!important` 或合并不同语义颜色；未登记或无法证明必要性的覆盖才计入待处理债务，必要第三方结构覆盖必须保留分类和理由。
5. 包体积优化以首屏加载和路由分包结果为依据，不以删除业务依赖作为完成手段。

## 专项记录

- ESLint：[ESLINT_WARNING_PROGRESS.md](./ESLINT_WARNING_PROGRESS.md)
- 样式治理与强制覆盖：[STYLE_DEBT_PROGRESS.md](./STYLE_DEBT_PROGRESS.md)
- 字段统一：[../database/field-consistency-progress.md](../database/field-consistency-progress.md)
- 前端响应与大包：[../performance/frontend-response-optimization-2026-06-01.md](../performance/frontend-response-optimization-2026-06-01.md)
