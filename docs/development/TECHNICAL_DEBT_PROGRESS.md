# 全局技术债务进度

本页包含历史进度与分批工作区复核结果。下方“当前待完善清单”是项目剩余技术任务的唯一汇总；其他带日期的审计、同事清单和聊天结论只能作为证据来源，不能建立第二份当前待办。

本文件是全局进度的唯一汇总入口。专项数据和处理细节仍记录在各自文档中；汇总状态必须以可重复执行的检查结果为依据。

## 当前待完善清单（唯一汇总）

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
| T17 后端分层收敛 | P2 / 四维代码治理已入库，待环境验收 | 2026-11-08 提交后起点为 SQL 149、仓储直连 9、反向依赖 2、租借计数 73；本轮分批迁移后 AST 四项均为 0，route/事务/孤立 controller 仍为 0。租借分别登记：真实收编 73→13；独立语义修正 13→7（6 处池/已有连接误计）；6 处真实租借接共享 helper 并删除 1 处无调用旧入口后 7→0。全部归零台账键删除，max=0，历史锚点只追加 | 保持 controller→service→repository 与共享 withConnection；新业务继续受目标分支锚点和 AST 增长检查保护。当前本地 HEAD 已启用目标锚点比较，远程 PR 仍须按真实目标引用执行；既有实现已在当前提交历史，本轮持续守门 | 执行行为/权限/事务回归、后端全测、安全/分层及下载审计、严格 ESLint、字段/公共选项审计、类型/文档检查和 git diff --check；当前结果见本节末尾收口记录。未连接云端数据库，静态与替身测试不能替代数据库/浏览器验收 |
| T18 闲置 API、组件与依赖治理 | P1 / 已提交 `ee05c43`；组件保留边界见 T19 | forecast 真实调用、analytics 63 方法、16 个组件候选和依赖四维矩阵见 T18 专节；保留 dts 证据不一致的公共组件 | 按删/修/留依据执行，删除双零局部组件与确认无用途依赖，保留 OCR、权限与有效契约 | 预测路径回归、重生成 dts diff、动态引用检索、依赖用途矩阵及代码/config/锁文件/脚本/文档一起验收；不替代数据库或浏览器验收 |
| T19 闲置导出与重复实现续项 | P1 / 本批已闭环，未提交；后续候选见 T19.4 | 起点 `ee05c43`，工作区干净；API、Composable、字段权限、图片保存与薪资表格交互复用见下文 | 清理确证闲置导出，统一权限与图片/表格公共行为；补齐剩余 14 项决定表及销售客户链路复核 | 类型、严格 lint、前端规范、后端全测、文档与 diff 检查；不降低基线，不把静态/模拟测试等同浏览器或云库验收 |
| T20 首屏 CSS 构建体积 | P1 / 本批已完成，未提交 | 删除公共 styles.scss 中 21 条无消费者的旧装饰/过渡规则；生产首屏 CSS 281157→279580 bytes，减少 1577 bytes，低于原 280000 bytes 上限 420 bytes | 保留在用 fade、组件动效和原体积阈值；动效登记仅收紧 styles.scss 至实测 9 | 原 build 与体积门禁 rc=0，97 项前端测试通过；生产 CSS 保留规则 AST 一致；18 组浏览器样式/布局一致，截图差异和验收边界见下文 |
| T21 全局模态框双端统一 | P1 / 整改与验证中（逐页及真机未完成） | 2026-11-11：62 个叶子路由、204 个 Vue 文件；MobileDialog 140 处、公共媒体查看 8 处；业务直接 Dialog/图片查看、原生输入与私有外壳覆盖均为 0。剩余 57 项为 3 文件的业务内容候选；改前嵌套扫描复核为 352 项。详见本节与页面台账 | 按 T21.2–T21.6 分批核对并整改；PC、平板、手机共用公共入口，保留必要业务变体；不因原有审计通过宣称全站已统一 | 每批更新实例/覆盖证据，执行相关行为测试、审计及浏览器检查；全量逐页和真机分别验收。不得扩大例外或重建基线隐藏风险；回滚按该批组件/样式与对应测试一起恢复 |

### T21 全局模态框双端统一（2026-11-11）

用户要求根据页面台账全局排查并持续完善，同类问题一并处理。本任务已从盘点推进到**全局公共入口迁移、外壳覆盖清理、嵌套行为修复及验证**；没有改动云端业务数据。权威要求见[对话框规范](../frontend/dialog-standards.md)，逐路由矩阵和统计口径见[页面台账](../frontend/page-audit-inventory.md#全量模态框接入复核2026-11-11)。本节是这一批问题的唯一任务入口。

#### 任务与验收

| 子任务 | 当前状态 | 执行范围与要求 | 完成证据 |
| --- | --- | --- | --- |
| T21.1 全量盘点与防漏算 | 已关闭 | 按真实路由 AST 区分 65 个懒加载入口、3 个布局和 62 个叶子 URL；扫描 130 个页面/内部单元、73 个公共组件和 App；为每个模板实例保留位置，按 Vue 依赖关联路由；单列服务弹框、原生输入、专用覆盖层和局部样式候选 | `audit:dialogs` 可重复生成统计/JSON/Markdown；9 项正式正反例接入 `check:dialogs`；台账数量漂移会失败。此项关闭仅表示盘点工具和任务建立完成 |
| T21.2 公共外壳与间距覆盖治理 | 代码及公共浏览器检查完成，整页验收见 T21.5 | 核对下方 7 批首轮候选，并用新版嵌套扫描器复核改前 352 项和当前 57 项业务内容。先确认文件实际引入及选择器命中，再删除重复宽度/圆角/标题/关闭按钮/正文/footer 覆盖；宽度改用属性/档位，贴边工作台使用公共变体，业务内容网格保留 | 每项候选有“删除冗余 / 迁公共入口 / 允许的业务变体 / 未生效待核实”的证据。不得仅依据源码命中机械删除；相关页面在 375/430/768/1024/1440px 明暗主题下核对最终计算样式、滚动和边界 |
| T21.3 原生 Dialog 例外复核 | 12 处已迁移，业务验收待完成 | 下表 6 个文件、12 处业务 el-dialog 逐实例证明是否仍需保留原生能力。普通表单优先迁 MobileDialog；保留例外必须证明其 PC/手机读取公共视觉、关闭行为、footer 和安全区，不扩大例外数量 | 逐实例保留/迁移理由与行为测试；迁移后同步删除例外登记。表单校验、打开/关闭事件、编辑草稿、嵌套确认和媒体层级不得回退；双端浏览器实测 |
| T21.4 原生姓名输入与媒体入口统一 | 代码整改完成，iOS 真机待验收 | QueryEditModal 1、QuickSaleModal 2、useSalesCustomers 1，共 4 处 window.prompt；确认原有 iOS 双击解锁/键盘问题后复用公共 prompt，防止多重打开、重复保存和取消误提交。经验分享 1 处 el-image-viewer 核对迁往 MediaPreviewViewer；保留当前图片索引、关闭与字段权限 | 输入确认、取消、空值、失败后保留状态及并发测试；iOS Safari 实际键盘/双击验收单列。媒体长列表切换、关闭、嵌套确认层级测试；未经测试不移除现有兼容行为 |
| T21.5 全部页面与共享宿主双端验收 | P1 / 明确延期（按用户逐页要求继续） | 按页面台账的 62 个 URL 分别记录；3 个布局和全局 ReminderHost 单列。无模板弹窗的页面继续检查公共确认服务；共享实例避免重复计数，模板组件数不能作为页面完成率。覆盖打开、关闭、取消、校验、长内容、滚动、Loading、错误及权限拒绝 | 每页填写 PC、手机模拟、Android Chrome、iOS Safari 的实际结果及未验证项；375/430/768/1024/1440px、明暗主题及移动安全区。公共组件测试不替代业务整页，模拟浏览器不替代真机 |
| T21.6 动态引用、专用覆盖层及防回退收口 | 引用及门禁已复核，专用设备验收待完成 | 核对 IconSelector、MemorySelector、StockInDetailModal 的动态/全局注册与构建声明，保留证据不一致的组件；ProfessionalScanner、ScreenLock、菜单及媒体遮罩按各自语义检查。核实候选后为明确禁止的覆盖扩充既有审计正反例，不另建重复标准 | 动态调用/声明证据齐全后才可删除；保留专用交互、摄像头权限与键盘行为。新门禁必须在真实反例下失败，不降低现有门禁、不增加未经证实的白名单 |
| T21.7 主屏幕书签保存图片安全区 | 代码、浏览器仿真及构建完成，iOS 主屏幕真机待验收 | 修复普通浏览器正常、主屏幕书签 footer 下方偏大的问题；销售与批发保存图片复用公共外层安全区，清理重复 footer 间距并保持按钮语义一致 | 真实两页模板在修复前复现 44px≠10px；修复后 40 组安全区仿真、完整浏览器回归、规范门禁及生产构建均通过，具体命令和边界见下方补充记录 |
| T21.8 双击库存明细关闭后残留 | 本地修复与专项回归完成，线上待复测 | 用户反馈电脑浏览器关闭后再次出现且无法关闭。公共遮罩强制 flex 覆盖 sheet 的隐藏状态；修复公共入口，覆盖电脑窄窗口、平板和手机，保留 PC 有/无遮罩行为 | 改前 Chromium 1024px 复现：状态 false，但可见外壳、遮罩各 1；改后 375/768/1024/1440px × 有/无遮罩的标题关闭、主动重开、业务关闭均无可见残留。完整检查的结果与限制见下方补充 |
| T21.9 报价页头按钮紧凑与显式声明 | 本地修复、浏览器专项与构建完成，线上待复测 | 复用公共页头参数，显式声明优先于公共默认；销售/批发保留图标和完整文字，图文靠近、按钮及整组居中，清理失效私有页头样式 | 180 组真实模板浏览器回归、完整规范门禁及构建通过；807 文件前端包 CRC 校验通过，真机/线上待复测 |
| T21.10 手机媒体全屏与关闭可达性 | 代码及公共回归完成，真机/线上待验收 | 用户 2026-11-12 优先要求：手机预览满屏、移除左右及缩放工具、保留手势，修复关闭遮挡。复用公共查看器处理全部现有调用；逐页适配按用户后续要求推进 | 交互、公共组件浏览器回归及规范检查结果见下方补充；不得将公共入口修复写成所有页面均已验收 |
| T21.11 销售调货与划拨供应商及批发报价 | 代码、专项测试及浏览器仿真完成，真机/线上待验收 | 按用户逐页要求，只处理 `/sales` 调货/划拨：统一“客户信息”、首台供应商与逐台供应商，调货自动读取 `/price-query` 展示批发价 | 完成证据与未验证边界见下方补充；不重做综合查询、库存管理，不视为销售整页验收 |
| T21.12 批量销售手机布局与 PC 价格列 | 代码及组件浏览器检查完成，真机/线上待验收 | 按用户要求适配 `/sales` 批量销售：电话在姓名前、手机双列表单与逐台卡片、底部备注、公共应用按钮；PC 紧凑价格列及型号/标识同行 | 规则见[批量销售表单](../guides/sales-transfer-transaction-standards.md#批量销售表单)，验证边界见下方补充 |

执行顺序：T21.2 的库存/销售/综合查询批次 → 权限及其余业务 → T21.3 原生例外 → T21.4 输入/媒体 → T21.5 逐页与真机 → T21.6 剩余引用及门禁收口。页面任务按业务域分批，每批独立回滚；无需重做 T21.1 才能开始修复，但每批结束须重跑统计，更新本节证据。

2026-11-12 用户调整顺序：先处理 T21.10 公共手机预览；T21.5 逐页适配暂缓，由用户后续逐页提供要求后继续，不并行修改登录、供应商等页面，不另建重复任务台账。

#### T21.2 样式候选分批定位

下列保留首轮只读扫描定位，共 34 个文件 / 293 项声明（旧扫描器口径）；**不是 293 个已证实的视觉缺陷**。完整选择器、声明和值由 `npm --prefix frontend run audit:dialogs -- --json` 输出，不能把日期数字固定成允许上限。SCSS 嵌套、内联/条件样式、已失效选择器及允许的贴边变体需另外核对。

| 批次 | 文件与候选数（均位于 frontend/src） | 合计 |
| --- | --- | ---: |
| 综合查询、库存公共弹窗及出库 | `components/InventoryDetailModal.vue` 16；`components/PublishToH5Modal.vue` 8；`components/StockInModal.vue` 1；`components/WholesaleModal.vue` 19；`components/query/QueryDetailDialog.vue` 3；`components/query/ReturnStockModal.vue` 20；`components/query/SalesReceipt.vue` 9；`components/query/styles/query-edit-modal/base.scss` 13；同目录 `responsive.scss` 7；`views/query/styles/query-view/image-preview.css` 2 | 98 |
| 库存与销售页面 | `views/inventory/InventoryView.vue` 39；`views/sales/styles/sales-view-dialogs.scss` 33 | 72 |
| 权限管理 | `views/permissions/styles/permissions-view.css` 51；`views/permissions/page/ModuleManagementView.vue` 2 | 53 |
| 结算、预定与库存预警 | `views/payments/SupplierPhonePaymentsView.vue` 16；`views/preorders/page/PreorderFormModal.vue` 8；`views/system/phone-warning-config/PhoneWarningConfigView.vue` 6 | 30 |
| H5 管理与手机端 | `views/H5-admin/page/styles/` 下 `banners/responsive.scss`、`config/responsive.scss`、`home-sections/responsive.scss`、`orders/responsive.scss`、`templates/mobile.css` 各 1，`templates/tablet.css` 6；`views/H5-mobile/page/MyCenter.vue` 2；`views/H5-mobile/page/styles/order-detail/order-summary.scss` 6 | 19 |
| 公开报价 | `views/price-list/page/SalesPriceDisplay.vue` 2；`views/price-list/page/public-price-query/_ios-save-dialog.scss` 3；同目录 `_notice-dialog.scss` 4 | 9 |
| 公共层、提醒及分享 | `components/ReminderHost.vue` 4；`styles/global.css` 3；`styles/permission-toast.scss` 1；`styles/responsive.scss` 1；`views/reminders/ReminderView.vue` 1；`views/shared/SharedView.vue` 2 | 12 |

已确认需要进入整改核对的例子：库存编辑弹窗重设 28px 正文与 footer 间距、手机端关闭按钮右偏移；销售独立 SCSS 重设弹窗圆角/宽度/正文间距；公开查询通知弹窗重设手机端 95% 宽度。这些覆盖现已清理，公共组件与业务 class 的最终计算样式由浏览器回归检查；业务整页和真机仍按 T21.5 验收。

#### T21.3 直接 el-dialog 实例

| 文件（frontend/src） | 数量 | 业务入口 |
| --- | ---: | --- |
| `components/ReminderHost.vue` | 1 | 全局待办提醒，锁定关闭与处理生命周期 |
| `views/H5-admin/page/SoldProductsView.vue` | 1 | 图片管理 |
| `views/backup/BackupView.vue` | 2 | 创建备份、清理旧备份 |
| `views/reminders/ReminderView.vue` | 4 | 新建/编辑待办、执行记录、事项类型管理、新建/编辑类型 |
| `views/shared/SharedView.vue` | 3 | 新建/编辑分享、分类管理、详情 |
| `views/subsidy/components/SubsidyPhotoManageDialog.vue` | 1 | 国补照片管理 |

上表记录迁移前的 12 处实例。现已全部接入 `MobileDialog`，删除 6 个例外；原有自定义 footer、禁止关闭选项及业务事件保留。迁移后共享公共组件行为测试，业务整页仍须按 T21.5 验收，不能因源码计数归零标记全部完成。

#### T21 当前整改记录

- 库存、销售、综合查询及共享出入库弹窗移除正文/footer、手机边界、关闭按钮偏移、圆角/主题重复覆盖；库存商品详情恢复公共 1024px sheet 分支。销售出库、批量销售、调货/划拨、销售单据使用公共贴边变体。删除全部为外壳覆盖的 `sales-view-dialogs.scss` 及其引用。
- 权限、付款、预定、库存预警、H5 管理/手机端及公开报价同类覆盖一起清理；权限三种多栏弹窗使用公共 `tf-dialog-workspace`，标题/footer 与独立内容滚动保留。删除公开报价 `_notice-dialog.scss` 和导入，保留通知正文自身的内容布局。
- 提醒宿主 1、备份 2、待办 4、分享 3、H5 已售商品图片管理 1、国补照片管理 1，共 12 处直接 Dialog 迁移；分享图片入口改用 `MediaPreviewViewer` 并保留图片列表、初始索引和关闭绑定。
- 姓名输入复用 `useCustomerNamePrompt`，沿用 iOS 双击与原生输入解锁；无调用旧函数删除。公共输入/保存防重、取消和空值不提交、客户切换校验，以及保存失败保留草稿一并处理。真实 iOS 键盘仍未验证。
- `useOverlayStack` 统一 Dialog/媒体查看的顺序和滚动锁，修复关闭/卸载非最后一层提前解锁及多层 Escape 同时关闭；手机 FocusTrap 复用 Element Plus，`closed` 去重，初始打开也维护生命周期；`opened` 等待进入动画完成。手机标题、遮罩和 Escape 补齐 `beforeClose(done)`，保留模板管理清理/阻止关闭契约。行为测试及浏览器结果以本节后续记录为准。
- 扫描器改为按括号栈解析嵌套 SCSS，补获公开报价父级令牌和被嵌套吞掉的声明。使用同一新版扫描器复核改前源码为 **352 项**，当前 **57 项 / 3 文件**：`inventory-result-dialog/compact.scss` 17、`mobile.scss` 38 均为内部商品卡片、列表及明细内容；`query-view/image-preview.css` 2 为备注正文最大高度和段落 margin。全部属于业务内容，私有外壳命中为 0。首轮 293 仅作历史定位，不能与新版 57 直接计算整改率，也不建立允许上限。
- `check:dialogs` 现拦截直接业务 Dialog、直接图片查看器、浏览器原生弹框以及外壳/令牌覆盖；新增真实拒绝用例，保留内容网格及备注滚动正例。服务调用点扫描扩展到 Composable，避免公共姓名输入被漏算。
- 公共 sheet 删除被全局覆盖的关闭按钮、正文/footer 以及重复断点样式；公共外壳删除无消费者的旧视觉别名和 Element UI wrapper 规则。`!important` 从 1897 减至 1681，既有逐文件登记只收紧 22 处、删除 9 个归零项，未新增或扩大白名单，也未重建基线。
- 重新生成 `components.d.ts` 并通过原 Vite 配置构建：IconSelector、MemorySelector、StockInDetailModal 均仍有自动发现声明，构建模块图均为 0；静态/动态引用检索也未发现调用。声明与调用证据不一致，三者全部保留，不按路由未关联机械删除。
- 独立 Vite 构建及原 `check:bundle-size` 已通过：首屏 CSS 278900 bytes、JS+CSS 899731 bytes；原上限 280000/900000 bytes 保持不变。初次新增公共规则触发体积门禁后通过去重解决，没有扩大阈值或把公共样式移到懒加载文件。
- 收尾核对修正交互规范中已过时的原生按钮例外说明；与按钮规范、公共组件采用规范及零原生按钮门禁保持一致，专用交互继续使用 `el-button` 和公共语义。

#### T21 本轮验证记录

2026-11-11 整改后验证，以下只记录实际执行的范围；失败修复后按最终重跑结果更新，不降低门禁或增加例外：

| 命令 / 范围 | 结果 |
| --- | --- |
| `npm --prefix frontend run audit:dialogs` | 全量扫描 62 个叶子路由、204 个 Vue 文件；140 个 MobileDialog、8 个公共媒体查看引用；直接业务 Dialog/图片查看器、原生弹框、私有外壳覆盖均为 0；57 项为业务内容候选 |
| `npm --prefix frontend run check:dialogs` | 19 项审计正反例通过（含 9 项盘点测试，不重复累加）；业务直接入口及私有外壳零违规 |
| 弹窗相关正式行为测试（包含在全量前端测试内） | MobileDialog 19、备份双端 13、媒体查看 4、销售姓名 12、姓名输入 5、覆盖层栈 3，共 6 文件 / 56 项通过；覆盖关闭保护、生命周期、取消/失败/并发、客户切换、嵌套键盘和锁，不与全量结果重复累加 |
| `npm --prefix frontend run test:dialog-widths` | 已通过 1250 组业务 class 外壳、272 组按钮和 245 项宽度检查；加载全部 204 个 Vue 文件编译后的样式，覆盖 375/430/768/1024/1440px 与明暗主题的外壳、间距、边界及长内容滚动。最终外壳样式与关闭保护接入后的完整回归通过，并包含 375/768/1440px 嵌套焦点与滚动检查；这仍是公共组件与业务 class 验证，不是业务整页或真机验收 |
| `npm --prefix frontend run check:standards` | 最终工作区完整复跑退出码 0：41 文件 / 330 项行为测试全部通过，TypeScript、全局严格 ESLint、规范覆盖及全部串行专项门禁通过；新增 beforeClose 默认值已按严格 lint 补齐，未降低规则或扩大例外 |
| 独立 Vite 构建与动态引用复核 | 使用原 Vite 配置、`envFile:false`，重新生成声明并核对三个候选的模块图，构建和原体积门禁均通过；候选保留理由见上文 |
| `npm --prefix frontend run test:dialog-widths -- --interactions-only` | 375/768/1440px Chromium 键盘检查通过：Tab/Shift+Tab、媒体和 MessageBox Escape 不穿透、焦点恢复、最后一层关闭后解锁。测试等待实际动画完成，避免把过渡中的 DOM 记作关闭失败；曾出现 CDP 读取状态超时，独立重跑退出码 0，未将超时记录为通过 |
| `npm run check:docs`、`git diff --check` | 文档链接/导航、8 个标记示例编译及规范冲突检查通过；最终差异无格式错误。同步对话框、组件采用、交互与媒体专项、规范清单、页面台账及所属索引 |

没有连接云端数据库，也没有执行 62 页完整账号流程或 Android/iOS 真机验收；备份页双端组件挂载测试使用 API 替身，不能记作整页浏览器验收。未改后端业务，未执行后端全量行为/数据库测试。公共组件浏览器检查与逐页业务验收分别记录，不把未执行项标记为已完成。正式新增审计、行为测试和浏览器脚本保留在规范目录，本任务未提交或部署。

交互审计输出已明确仅覆盖原生 alert/confirm；原生 prompt 由 `check:dialogs` 的 AST 拒绝检查守护。原 4 处姓名 prompt 已归零，专项正文和页面台账同步；真机输入能力仍按 T21.4 记录。

#### T21.7 主屏幕书签修复补充（2026-11-11）

- 使用销售、批发两个页面的真实保存弹窗模板和公共样式复现：底部安全区为 0 时 footer 上下各 10px；模拟 34px 底部安全区时，修复前下间距为 44px，正式回归按预期失败。修复将四边安全区统一放在公共遮罩，外壳最大高度受遮罩可用高度限制；悬浮 footer 保留公共间距，页面贴屏幕底边的固定操作继续按移动端规范预留安全区。
- 销售保存弹窗的三个按钮语义与批发统一；删除销售空媒体查询、公共重复 footer padding 和 sheet 重复定位/布局声明。`!important` 实测 1681→1677，仅收紧公共样式和组件对应的两项登记；没有增加白名单或修改体积阈值。
- `npm --prefix frontend run test:dialog-widths -- --safe-area-only` 在最终样式下退出码 0：40 组销售/批发保存弹窗检查，覆盖 375×812、430×932、667×375、812×375、768×1024，明暗主题、零安全区与主屏幕上下/左右安全区；同时检查长图滚动、三个按钮的高度与留白一致性及工作台安全边界。
- `npm --prefix frontend run test:dialog-widths` 完整退出码 0：1250 组业务 class 外壳、272 组按钮、40 组报价保存安全区及 245 项宽度检查，并通过嵌套焦点、Escape 和滚动锁回归。安全区专项已包含在完整浏览器回归中，不重复累加。
- `npm --prefix frontend run build` 退出码 0，包含完整 `check:standards`、41 文件 / 330 项前端单测、类型与全局严格 ESLint、生产 Vite 构建及原体积门禁；脚本和销售页面的定向 ESLint、视觉令牌、响应式、样式债务及 `git diff --check` 通过。同步对话框规范、移动端指南、视觉回归清单和页面台账；沿用 `frontend/dist` 与 `frontend/dist.zip` 作为本地交付产物，不新建重复部署入口。

以上为 Chromium 安全区仿真及本地构建证据，未执行 iOS Safari 主屏幕真机或远程部署验收，也未连接或修改云端数据库。T21.5 的业务整页及真机边界保持单独登记。

#### T21.8 关闭残留修复补充（2026-11-11）

- `_dialog.scss` 公共遮罩的 `display: flex !important` 覆盖 Vue `v-show` 写入的内联 `display: none`。关闭动画结束后状态虽为 false，sheet 仍可见；再次关闭不会产生状态变化。电脑窄窗口也使用 sheet，因此不只影响手机。改为普通 flex 声明，保留组件隐藏状态优先；对应文件的 important 上限 141→140，只收紧、不扩大例外。
- `test:dialog-widths -- --interactions-only` 曾完整退出码 0：8 组视口/遮罩组合关闭回归，以及 375/768/1440px 嵌套 Tab、Escape、焦点恢复、滚动锁通过。库存明细组件的父子关闭状态和再次打开时的查询次数由新增正式测试覆盖，3 项通过；单元测试不模拟 CSS 可见性。
- `npm --prefix frontend run build` 退出码 0，包含完整 `check:standards`、类型检查、严格 lint 和 42 文件/333 项单元测试，无失败或跳过；生产体积门禁通过，首屏 CSS 272.28 KiB、总计 878.79 KiB，保留原阈值。定向 ESLint 与 `git diff --check` 通过；前端压缩包已更新并完成 CRC 校验。
- 后续完整 `test:dialog-widths` 的 1250 组外壳、272 组按钮、40 组销售/批发安全区和关闭残留检查通过，但末段嵌套交互出现 `CDP 超时：Runtime.evaluate window.stackMetrics()`，本次完整命令退出码 1。单独重跑也间歇出现同类超时，不能把此前一次专项成功写成全量稳定通过；保留全部断言，原因未定，后续排查归 T21.5。样式修复前的嵌套检查也曾出现 CDP 超时，现有证据不能将其归因于本次 flex 声明调整。
- 未验证用户当前电脑浏览器的完整密码/双击整页流程、线上版本和真实手机；本地回归使用隔离组件与模拟响应，未连接或修改云端数据库。Android/iOS 真机及全站逐页验收继续按 T21.5 单列。

#### T21.9 报价页头按钮补充（2026-11-11）

- `PublicPriceHeader` 通过可选 `actionWidth` / `actionSize` 提供公共声明入口；默认按内容自适应，撤销参数后回到公共默认，不影响搜索区。批发报价手机 80px、其他视口 112px，销售报价 112px，均声明公共小号。颜色继续使用现有语义，不开放页面私有 CSS 覆盖。
- 公共操作区改为可换行并居中，清除 Element Plus 相邻按钮及图文附加边距；保留普通图标和完整文字，窄屏四按钮使用两列。二手机加载时只显示公共加载图标，避免静态图标叠加造成溢出。两页父级 scoped 旧页头块无对应模板消费者，已移除；营销无操作插槽的调用不生成操作区。规范、manifest、标杆预览及审计正负例同步。
- `npm --prefix frontend run test:dialog-widths -- --price-header-only` 退出码 0：320/360/375/390/430/667/768/1024/1440px × 明暗主题 × 销售/批发验证前后、筛选/加载状态共 180 组通过，使用真实页头模板及样式，检查图标/加载图标、全文、图文间距、按钮内容及每排居中、无横向溢出。初次运行抓到二手机加载时双图标溢出，修复后通过。
- `npm --prefix frontend run test:unit -- tests/public-price-header.spec.ts`：2 项通过，覆盖显式参数、撤销回退、空值及无操作插槽；未请求业务 API，未写入云端数据库。真实 Safari、桌面书签、Android/iOS 及线上完整流程未验证，继续按 T21.5 验收。
- `npm --prefix frontend run build` 退出码 0：完整 `check:standards`、类型、严格 lint、43 文件/335 项单元测试及生产体积门禁通过，未放宽阈值；首屏 CSS 272.28 KiB、总计 878.79 KiB。定向 ESLint 及 `git diff --check` 通过。已更新 `frontend/dist.zip`：807 文件、约 9.34 MiB、根目录含 `index.html`、CRC 检查通过。构建与静态检查不代表线上或真机验收；后端未修改，未执行后端行为/数据库测试和依赖发布审计，本轮为本地前端构建。

#### T21.10 手机媒体全屏与关闭可达性（2026-11-12）

- 公共 `MediaPreviewViewer` 的手机舞台占满可视区域，横竖图按比例完整展示；取消左右预留列、上下固定行，移除手机箭头、放大/缩小及百分比重置工具。横屏触摸设备沿用同一布局；PC 保留箭头、缩放及键盘操作。商城订单凭证由内置预览迁入，9 处业务调用统一继承，未改路由、权限、文件 API 或数据库。
- 工具栏与关闭按钮始终位于缩放内容上方，内部层级读取唯一 `--tf-z-viewer-tools`；顶部、左右避让安全区，长文件名省略而保留计数和关闭。下载/删除继续由业务属性和原权限控制，手机普通只读预览只显示关闭按钮。视频控件避开底部和左右安全区。
- 商城订单凭证复用公共媒体缩略图按钮，关闭详情、权限变化或凭证更换时关闭预览。盘点和拒绝审计补含 `el-image preview-src-list`，保留普通缩略图正例及隐式查看器反例，防止漏接公共入口。
- 补齐视频横滑切换及原生控件区域防误翻页；图片缩放时只平移，连续拖动累计位置；取消手势、关闭或切换素材清理旧触摸状态。保留公共覆盖层、焦点和滚动锁。
- `npm --prefix frontend run test:dialog-widths -- --media-only` 最终退出码 0：56 组双向图片布局，覆盖 320/375/430/667/844/768/1440px、明暗主题、零安全区和刘海/横屏安全区，检查无箭头/缩放按钮、满屏且保持比例、长文件名、双指缩放及放大后通过实际坐标点击关闭。另验证 7 种视口普通只读预览、5 种手机视口的图片/视频真实触摸滑动和原生视频控件不误翻页；视频由浏览器本地生成、解码和播放，不读取业务文件。初次合成素材缺少有效帧导致专项失败，改为显式生成视频帧后完整重跑通过，未移除断言或降级检查。
- 相关单元测试 4 文件 / 32 项通过：媒体 8、MobileDialog 19、覆盖层栈 3、商城订单凭证 2（实际详情入口、关闭与查看/编辑权限变化）；定向 ESLint、弹窗/按钮/UI/组件采用/视觉令牌/响应式/样式债务审计及文档检查通过。最终 `npm --prefix frontend run check:standards` 退出码 0，包含 TypeScript、全局严格 ESLint、54 文件 / 429 项前端测试（0 失败、0 跳过）、21 项弹窗审计正反例及全部串行规范门禁。同步正文后再运行 `npm run check:docs` 和 `git diff --check`；未降低门禁、扩大白名单或重建基线。

以上为公共组件及 Chromium 仿真，未执行 62 页业务整页、Android/iOS 真机或线上验收；未修改后端，未运行后端业务/数据库测试，未连接云端数据库，未打包或部署。同步前端索引、对话框、视觉令牌、视觉回归清单及页面台账；原逐页任务按用户要求暂缓，待用户逐页提供要求后继续。

#### T21.11 销售调货与划拨供应商及批发报价（2026-11-12）

- 仅按本轮要求调整 `/sales` 调货/划拨表单：统一一个“客户信息”标题；顶部只读供应商与门店同行，调货单台/多台均取首台来源供应商，底部各条保留对应供应商。顶部与明细沿用销售供应商字段查看权限；修复划拨输入绑定，并在切换模式、设备时同步当前供应商。保留调货多供应商、划拨同供应商及既有提交约束，不改综合查询和库存管理。
- 调货复用批发报价 `/price-query` 的 `getAllPrices` 实时请求，精确匹配品牌/型号/颜色/内存，优先使用 `display_wholesale_price` 并与报价页同样取整；删除模糊借价、零售价和入库成本兜底。等待使用公共 `LoadingOverlay`，禁止确认；失败保留明细并提示手动填价。公共 `useLatestRequest` 防止旧报价覆盖当前选择，关闭、切换及卸载取消请求；未改变报价规则和后端价格计算。
- `npm --prefix frontend run test:unit -- tests/wholesale-supplier-price.spec.ts tests/sales-customer-name.spec.ts tests/price-batch-settings.spec.ts tests/price-list-row.spec.ts`：4 文件 / 40 项通过，0 失败、0 跳过。新增正式组件/行为回归 11 项，覆盖首台和逐台供应商、单一标题、字段权限、模式切换、真实输入值、报价优先级、规格隔离、失败保留、取消和旧响应、提交不改来源供应商。
- 隔离 Vite + Chromium 加载真实 `WholesaleModal`、`MobileDialog`、Element Plus 和公共样式，拦截业务请求且不加载真实环境文件：320/375/430/768/1024/1440px × 明暗主题 × 调货/划拨 × 单台/多台，共 48 组通过。验证字段实际值、只读、逐台供应商、批发价、控件/弹窗视口边界、字段溢出及关闭入口。初次夹具虚拟模块解析失败后修正夹具；模式切换发现供应商未同步，修复并新增正式回归。临时脚本、截图、浏览器目录和预构建缓存清理。
- 前端 `type-check`、定向 ESLint（零警告）、表单/弹窗（21 项门禁正反例）/Loading/响应式/字段一致性/视觉令牌/样式债务/公共检索采用审计及文档检查通过；未修改审计规则、扩大白名单或重建基线。同步现行[交易规范](../guides/sales-transfer-transaction-standards.md#销售管理调货与划拨表单)、页面台账及本任务记录。

- 2026-11-12 同页补充：按用户要求移除划拨说明提示；两种模式备注取消左侧标签和标签占位，保留可访问名称、输入及字数限制；与设备卡片左右对齐，和上方汇总保持 `--tf-space-6` 间距。设备列表及汇总使用公共 Element Plus 主题色提供外边框和底色，删除利润项虚线及多余顶部留白。真实模板片段、公共弹窗、明细组件和样式隔离浏览器验证 24 组（6 种视口 × 明暗主题 × 两种模式）通过，检查边界对齐、24px 间距、实际备注输入、无左侧标签、无利润虚线及卡片边框/背景；不是完整登录销售页面验收。类型、定向零警告 ESLint、表单、弹窗、视觉令牌、样式债务及差异检查通过；未新增测试文件或修改审计基线，临时浏览器脚本及生成资源已清理。

- 2026-11-12 设备明细布局补充：按用户最终要求保留供应商、门店、入库时间的字段名和内容，沿用简洁两行信息，不新增业务分组或卡片。桌面设备与金额按可用宽度分配，手机金额两列、利润另行；名称和来源允许完整换行，删除列表 `250px` 高度限制及独立滚动，全部明细随弹窗正文可达。清理无业务逻辑的入库价 change 回调，沿用响应式金额汇总；划拨只读金额和供应商权限不变。汇总“销售总价”按实际模式改为“划拨总价”，负利润与逐台金额统一使用危险色。
- 本轮现有 `wholesale-supplier-price.spec.ts` 11 项通过（0 失败、0 跳过），补核实际门店/日期和字段权限。隔离 Vite/Chromium 加载真实弹窗与明细组件、公共样式：320/375/430/768/1024/1440px × 明暗主题 × 调货/划拨 × 单台/6 台，共 48 组布局检查通过，含超长型号/来源文本、金额/利润、边界、无横向溢出、末台滚动可达及撤销供应商查看权限；并查看 PC/手机截图。补核各金额输入的文本测量宽度均可完整容纳数值，实际编辑批发价和入库价后逐台利润、汇总均正确联动。临时脚本、截图、浏览器目录和缓存已清理。类型、定向零警告 ESLint、表单/令牌/样式债务/响应式/文字审计通过；同步交易正文和页面台账，不变更全局规范或审计基线。本轮为组件浏览器仿真，完整登录业务页、真机及线上仍未验收。

浏览器为隔离业务请求的组件仿真，未执行真实登录整页交易、Android/iOS 真机或线上验收，未连接或写入云端业务库。后端未修改，未运行后端数据库测试；未打包或部署。该项不代表 `/sales` 整页或全站移动端适配完成。

#### T21.12 批量销售手机布局与 PC 价格列（2026-11-12）

- 范围为 `/sales` 的 `SalesBatchForm` 及其调用链，不重做其他销售业务。手机客户电话与姓名同行、电话优先，Apple ID 独占下一行；销售信息和支付信息每行两个字段。设备明细改为逐台卡片，成本与售价双列、利润另行；PC/平板沿用表格，价格列各 120px、利润列 110px，剩余宽度给设备，型号与 IMEI 优先同行并留有间距，长文本可换行。标识取非空 IMEI、再取 SN，清理首尾空格，标签始终为 IMEI。
- 统一售价“应用”接入公共 `tf-dialog-toolbar`，不复制按钮外观；底部备注使用公共两行 `tf-textarea`，沿用原请求的 `remarks`。两端共用逐台金额、汇总和字段权限，提交期间禁用清空/统一价/逐台价格/备注。移除批量表单旧原生控件、客户下拉、固定 footer 等无引用样式和父页面重复根样式，改用公共间距、文字及主题令牌。相同销售域的调货序号补充独立布局 class，仅维护防收缩，徽章外观仍由公共入口控制，未放宽徽章审计。
- 隔离 Vite/Chromium 加载真实表单、`MobileDialog`、Element Plus 与公共样式，不读取真实环境文件、不发起业务请求：320/375/430/767/768/1024/1440px × 明暗主题 × 单台/6 台共 28 组通过，检查双列、边界、卡片数量、金额文本实际宽度、固定价格列、footer 同行及备注滚动可达。额外验证逐台修改、统一应用、备注写入、切换视口保留草稿、撤销金额权限及等待禁用；按用户示例核对 PC 型号/IMEI 同行和间距，并查看 PC/手机截图。
- `npm --prefix frontend run test:unit -- tests/sales-batch-form.spec.ts tests/sales-customer-name.spec.ts tests/wholesale-supplier-price.spec.ts`：3 文件 / 28 项通过，0 失败、0 跳过。批量表单正式回归 5 项，覆盖响应式切换、价格联动、字段权限、SN 回退值标签、统一价、备注及提交禁用。`type-check`、定向零警告 ESLint、`check:design-tokens`、`check:style-debt`、`check:form-controls`、`check:responsive`、`check:typography`、`check:buttons`、`check:tables`、`check:badges`、`check:component-adoption`、`check:dialog-actions`、`check:fields`、弹窗采用审计、`npm run check:docs` 及 `git diff --check` 通过；不以静态审计替代真实设备验收。
- 未执行登录销售整页的真实交易、云端数据库写入、Android/iOS 真机、打包或部署；临时验证脚本、截图、浏览器 profile 与 Vite 缓存验证后清理。本项不代表销售整页或全站适配完成。

- 用户随后要求将批量销售显式宽度从 880px 改为 800px；仅调整该弹窗声明，沿用公共宽度边界。上述 28 组业务布局浏览器检查发生在 880px 声明时，800px 实际效果由用户刷新复核，不将之前的浏览器结果视为最终宽度的重新验收。
- PC 表格的 IMEI 标识值随后改为公共成功色、正文字号；按最新要求，两端“IMEI：”标签单独使用公共危险色，号码原色保留，取消原辅助文字的小字号；手机卡片继续沿用原字号。此颜色/字号补充与 800px 最终视觉效果待用户查看，不追加未经执行的浏览器结论。

#### T21.13 公共金额输入与 IMEI 标签颜色（2026-11-12）

- 按全局金额要求新增 `components/AmountInput.vue`，薄封装 Element Plus 数字输入，复用公共表单样式和 `utils/format.ts`；由现有自动组件发现注册。输入草稿保留小数点和尾零，完成编辑后整数不补 `.00`，真实小数最多两位并去掉无意义尾零；清空、边界、禁用、只读、插槽和事件沿用原字段语义，不在挂载时改写业务数据。
- 销售单台/批量/编辑、综合查询编辑/快速出库、采购入库、库存编辑、调货/划拨、退款、客户余额、国补、预定、维修、租赁、工资、H5 上架及采集价编辑、报价加减价及 H5 固定加价等金额控件已迁移。调用方保留数值/字符串模型契约、清空语义与业务校验；移除会吞小数点或编辑中尾零的旧过滤器。百分比、数量、排序、天数不迁移；公共格式化辅助函数委托 `formatAmount` / `formatCurrency`，清理重复实现与无用导入。销售/库存成本回填、公开报价和调货报价不再取整；金额列表、统计、图表金额提示、工资、员工工资信息、配件、H5 及国补备注保留真实小数并统一去掉展示尾零。业务数值计算和图表轴坐标缩写按原契约处理。
- 修复 `formatAmount(1500, 0)` 错误删掉整数尾零变成 `15` 的缺陷，并统一负零为 `0`。批量销售 PC/手机仅“IMEI：”标签使用公共危险色，号码原颜色保持（PC 成功色、手机辅助色）；不新增 SN 标签。
- 表单审计由全局计数改为 Vue AST 逐控件校验 `controls=false`，识别金额数字字段并要求公共入口，禁止调用方覆盖金额精度/步进属性。5 项正式正反例覆盖标准接入、固定精度、步进按钮、Pascal/kebab 标签、非金额字段和百分比边界；未重建基线或扩大白名单。`/standards` 表单预览新增真实可编辑金额。
- `npm --prefix frontend run check:standards` 最终全流程通过，包含 `type-check`、严格 ESLint、全部规范审计及 59 文件 / 471 项前端测试（0 失败、0 跳过）。定向金额、批量销售及调货回归 3 文件 / 38 项，综合查询金额 2 项、采购入库双端金额 2 项通过；公共金额审计含 5 项正式正反例。采购测试补齐与 `main.ts` 相同的公共表格列宽注册后重跑通过，不改业务实现或放宽断言。`npm run test:docs` 12 项、金额相关组件/测试/脚本的定向零警告 ESLint、`npm run check:docs` 和 `git diff --check` 通过。
- 隔离 Vite/Chromium 加载真实公共金额组件、`SalesBatchForm`、`MobileDialog`、Element Plus 和公共样式：320/360/375/390/430/767/768/1024/1440px × 明暗主题共 18 组通过。验证 `225`/`225.02`/`225.2` 初始展示、逐字小数输入及完成编辑去尾零、字段禁用、手机卡片/PC 表格、弹窗边界、无横向溢出、PC 最终 800px 声明，以及 IMEI 红色标签/号码原色；另查看 375px/1440px 截图。本项补足 T21.12 最终宽度和标签颜色的组件浏览器复验。
- 同步权威表单规范、manifest、前端索引、页面台账、响应式回归清单及销售交易指南。公共组件数量 73→74，全部 Vue 文件 204→205；无新页面/路由/API/共享业务类型。正式测试保留，临时浏览器脚本、截图、profile 和缓存已清理。
- 浏览器覆盖公共金额组件与批量销售表单；综合查询与采购入库另有真实组件行为回归，其他迁移页未逐页执行浏览器验收。验证范围为组件仿真及静态/行为门禁；未登录整页执行业务交易，未执行 Android/iOS 真机、公开 H5 真机验收、云端业务数据读写、打包或部署。后端未改动，未运行后端完整/数据库测试；规范检查中的后端安全审计不能替代后端业务验收。

### T20 首屏 CSS 闲置样式清理（2026-11-08）

本批承接 T19 已实证的体积问题：首屏 CSS 为 281157 bytes，比既有 280000 bytes 上限多 1157 bytes。只修改 `frontend/src/styles.scss` 的无消费者规则，保留现有全局导入、构建分块、压缩算法及原体积阈值，未把首屏样式挪入懒加载文件。

清理前先查模板、动态 class、完整动画字符串、Vue transition 的静态/动态 name，以及前后端源码、审计登记和文档。21 条规则由 17 个选择器块与 4 个 keyframes 组成：

| 删除范围 | 证据与边界 |
| --- | --- |
| page/scale/slide enter/leave 过渡（8 个选择器块） | App 路由壳未使用这些 transition；全站实际 transition name 为 fade、fab-scale、slide-down、sub-menu 及各组件专属名称，无动态映射到本批名称 |
| 四方向 fadeInUp/Down/Left/Right keyframes 和 animate-fade-in-*（4+4） | 原名与 class 的非定义调用为 0；现有 AOS 使用自己的 data-aos 效果，组件专属动画不受影响 |
| hover-card 两个规则 | 非定义调用为 0；现行后台卡片读取 admin-layout 公共视觉，不使用旧的浮起 8px 装饰 |
| btn-click-effect 三个规则 | 非定义调用为 0；保留现行公共按钮控件与反馈入口 |

复验命令：`rg -n 'animate-fade-in|hover-card|btn-click-effect|fadeInUp|fadeInDown|fadeInLeft|fadeInRight' frontend/src backend/src`，以及 `rg -n '<transition|<Transition|transitionName|enter-active-class|leave-active-class' frontend/src --glob '*.{ts,vue}'`；手工核对 page/scale/slide 与有不同前后缀的现行名称。删后对全部移除 class/keyframes 做精确边界扫描，前后端源码均 0 命中。正式审计和历史说明中的名称属于规则登记，不当作运行时消费者。

公共 SCSS 使用现有 Sass + esbuild 依赖编译，删前 184684、删后 183107 bytes，减少 1577 bytes。PostCSS AST 对照确认只删除上述 21 条顶层规则，其余规则内容与顺序完全一致；保留 fade 与 pulse/bounce、各组件状态和动画。没有删除任何共享视觉令牌，也没有改控件尺寸、主题或响应式断点。

`motion-adoption-baseline.json` 只降低 `src/styles.scss` 一项：登记上限 20→9；本批开始时实测已有 18 处，删除闲置规则后实测 9 处。未全量重建动效基线，其他文件与构建体积基线不变。动效权威规范同步说明退役的闲置样式入口。

#### T20 验证与打包

原 `npm --prefix frontend run build` 已完成，rc=0：包含全部 `check:standards`、类型检查、严格 ESLint、19 个测试文件 / 97 项前端测试、Terser 生产压缩及原 `check:bundle-size`。首屏 CSS 从 `index-C3vj9eln.css`（281157 bytes）降至 `index-B-ei0PZB.css`（279580 bytes），减少 1577 bytes；原上限 280000 bytes 不变，剩余 420 bytes。首屏 JS 为 604.14 KiB，总量 877.16 KiB，均低于原阈值。对真实生产首屏 CSS 再做 PostCSS AST 对照，除本批删除的 21 条规则外，其余内容与顺序完全一致。

`frontend/dist` 和 `frontend/dist.zip` 已更新。ZIP 内直接包含 `index.html`，共 798 个文件，入口 5 个静态资源均存在，CRC 校验通过；未打入环境文件、源码映射或 `.DS_Store`。压缩包 9666262 bytes，SHA-256：`a617b31707ef83e90c9175be0ac12db954fe053dd71d1fe9f063061430feaccd`。产物不入库，本轮未提交、未部署。

浏览器对照采用本机 Chrome 150、3 个真实公开路由（`/login`、`/price-query`、`/sales-price-display`）、375/768/1440 CSS px 和浅/深主题，共 18 组。接口由临时探针提供固定演示数据，冻结时间、使用北京时间与减少动态效果设置，不访问云端，不执行登录/写入。18 组 DOM 标准计算样式、布局矩形和文字均严格一致，均无页面脚本异常或横向溢出。生产 CSS 对照保留的 1070 个顶层 AST 节点逐项相同。

截图采样边界：最初的全页截屏存在取帧不稳定，最终统一使用关闭 GPU 的 Chrome、页面前置及 900px 高视口截屏，重新采集全部前后对照。最终 17/18 组逐像素相同；销售报价 375px 浅色组有 11 个像素差异，位于 `(141,158)` 至 `(234,159)`，单通道最大差值为 1/255，计算样式和布局相同。未将此结果登记为全部截图零差异；不等同真实账号、真实数据、后台受保护页面、全部交互或 iOS/Android 真机回归。

收口执行 `npm run check:docs` 和 `git diff --check`；一次性浏览器探针、依赖、截图与旧产物对照均清理，正式生产目录及压缩包保留。本轮只清理前端闲置 CSS，未修改后端业务，未重复执行后端全量测试。

### T19 闲置导出、公共行为去重与未完事项（2026-11-08）

起点为用户已提交的 `ee05c43`。本节承接 T18 后未处理的事项；T18 的 analytics、依赖/OCR 与已删除 3 个局部组件不重复实施。当前改动不自动提交。

#### T19.1 未使用导出

证据命令：对下表方法逐个运行 `rg -n '\b(方法名)\b' frontend/src --glob '*.{ts,vue}'`，核查所有命中、default 对象、barrel 重导出、别名与调用点；再查 `docs config scripts frontend/tests frontend/scripts backend/test` 的登记。删除前下列候选除定义文件与自身导出对象外，运行时调用均为 0。API 包装的删除不等于后端端点退役，后端有效能力保留。

| 文件（frontend/src/） | 本批处置 | 非自身用途与依据 |
| --- | --- | --- |
| `api/base-data.ts` | 删 `getBrands/getColors` | 0；保留各 scope 的真实公共入口与在用 getModels/getMemories |
| `api/price-list.ts` | 删 `getSyncConfig/updateSyncConfig/getPricesByBrand` | 0；在用 ById/多配置与公开搜索接口保留 |
| `api/shop.ts` | 删 `getConfigsByCategory/getPhoneImages/getOrders/getOrderDetail/getTemplateDetail` | 0；同步清唯一支撑 OrderListParams，保留在用写操作与公共订单 API |
| `api/shop-public.ts` | 删 `getProductImages/updateCartItem/clearCart` | 0；购物车现有 get/add 调用保留 |
| `api/preorder.ts` | 删 `getMatchablePreorders/getPreorderDetail/PREORDER_STATUS_LABELS` | 0；同步清 preorderApi 的自身登记；PREORDER_FEATURE_SUMMARY 中旧方法示例改为在用分页筛选，连带修正示例字段并纳入编译 |
| `api/home-sections.ts` | 删 `addProductsToSection` | 0；保留在用逐项添加与排序 |
| `api/phone-stock-warnings.ts` | 删 `getWarningThreshold` | 0；同步清 default 对象 |
| `composables/ui/useConfirm.ts` | 删 `confirmSuccess/confirmError/confirmInfo/confirmWarning` | 0；保留 confirm/confirmDelete，统一 notification-simple 不变 |
| `composables/mobile.ts` | 删 `isMobileBrowser/isWeChatBrowser/getMobileDeviceInfo/getMobileOptimizeConfig/useMobileGesturesCompat` | 0；清理失效 default 对象项及类型 import，保留公共设备检测与响应式能力 |
| `composables/useNotification.ts` | 删 `useNotificationService/useNotificationWithDebounce` | 0；防抖继续由唯一 useNotification 的选项提供 |
| `composables/usePageCache.ts` | 删 `hasPendingRequest/preloadCache` | 业务 0；旧 API_CACHE_GUIDE 两段示例同步替换，不保留失效文档入口 |
| `composables/core/useEventBus.ts` | 删 `waitForEvent/waitForEvents` 与多余 globalEventBus export | 外部 0；**实例内部在用必须保留**，一并清空的卸载回调 |
| `composables/core/useAsync.ts` | 删 `createAsyncState` | 0；在用 useAsync 保留 |
| `composables/useTheme.ts` | 删 `useThemeTransition` | 0；主题公共入口保留 |
| `composables/useMobileMenu.ts` | 删 `useSimpleMobileMenu` | 0；真实 useMobileMenu 保留 |
| `composables/useBrandModels.ts` | 删 `brandModelsStore` | 0；去掉未使用的模块加载时实例化，保留 useBrandModels |
| `composables/usePagePermissions.ts` | 删 `useBatchPermissions` 及独有 PermissionConfig | 0；权限公共入口 usePagePermissions 不变 |
| `composables/ui/useMediaQuery.ts` | 删 `useCustomMediaQuery` | 仅 barrel 重导出，无消费者；同步清 composables/index.ts |

隔离 HEAD 构建复核另外发现 4 个直接使用却未直接登记的前端依赖。`qrcode` 原先实际解析到仓库外的 `/Users/imac/node_modules`；其他 3 个依赖偶然通过间接依赖存在。前端 package.json/lock 已按原实际版本登记，未改变任何保留包的锁定版本；async-validator 仅用于类型，登记为 devDependency。以下是本轮新增声明的用途矩阵，不与 T18 已完成的删包矩阵混算：

| 依赖 / 版本 | 运行时 | 构建 / 类型 | 脚本 | 测试 | 处置 |
| --- | --- | --- | --- | --- | --- |
| qrcode 1.5.4 | SubsidyListSection.vue 的实际动态 import，用浏览器 Canvas 生成补贴二维码 | Vite 按需打包；现有 external-modules.d.ts 供调用方类型检查 | 无直接调用 | 无二维码专项行为测试，构建验证真实 import 可解析 | 补运行依赖，移除父目录偶然提供的前提；未引入 Node canvas |
| dayjs 1.11.19 | 唯一 TimeUtil 的时间解析、时区与插件 | 编译/打包统一时间工具 | 无直接调用 | 无本轮新增时间专项测试，沿用全套门禁 | 将在用间接依赖登记为直接运行依赖，不换版本 |
| @vueuse/core 10.11.1 | useLocalStorage.ts 调用 tryOnScopeDispose | 编译/打包公共存储 composable | 无直接调用 | 无本轮新增专项断言 | 补直接运行依赖，不换版本 |
| async-validator 4.2.5 | 此直接引用无运行时代码，Element Plus 自身另有间接运行依赖 | PreorderFormModal.vue 从 RuleItem 获取 validator 类型 | 无直接调用 | 无本轮新增专项断言 | 补直接开发依赖，保留唯一现有类型来源 |

复验：从 frontend 路径执行 require.resolve 后四者均解析到 frontend/node_modules；对比 HEAD 与当前 lock 的所有原有 packages 条目，保留版本变化为 0；新增 26 条 qrcode 所需包记录。`npm --prefix frontend audit --audit-level=high --json` 实测 info/low/moderate/high/critical 均为 0。缺失声明修正后重新运行整套前端规范和原配置构建；后端依赖未改，不重复 T18 的 OCR 删包实验。

#### T19.2 剩余 14 项三态决定表

三态为“删 / 留（明确理由） / 待验证（方法）”。2026-11-08 本轮再次检索原名、kebab-case、模板、import 与完整动态组件字符串；动态机制检索 `rg -n 'defineAsyncComponent|resolveComponent|import\.meta\.glob|<component\b' frontend/src --glob '*.{ts,js,vue}'` 为 63 行，逐一检查来源，未发现这 13 个组件的运行时引用。`mobile-form`、`mobile-table`、`user-info` 等 CSS class，以及同名 UserInfo 业务类型均不能算作组件调用。

重生成证据承接 T18.2 在原 Vite 配置下的完整构建：13 个公共组件在重生成 dts 中均仍有声明，构建图均为 0；自动发现插件扫描组件目录并生成声明，不能把这个声明当成有效使用，也不能手改扫描范围制造删除条件。本轮重新构建结果在收口处登记。

| 剩余项（frontend/src/） | 运行时引用 / dts | 三态决定 | 理由与后续验证方法 |
| --- | --- | --- | --- |
| `components/MobileForm.vue` | 0 / 有 | 留 | 不满足此前“双零”约束；mobile-form 为 CSS，不是调用；按 T18.2 重生成+动态链复验 |
| `components/MobileTable.vue` | 0 / 有 | 留 | 不满足“双零”；SyncLogView 的 mobile-table-* 为 CSS；同上 |
| `components/PaginatedTable.vue` | 0 / 有 | 留 | 不满足“双零”；同上 |
| `components/ResponsiveLayout.vue` | 0 / 有 | 留 | 不满足“双零”；同上 |
| `components/DraggableList.vue` | 0 / 有 | 留 | 自动发现声明仍存在，非手写旧登记；不单独删 dts；同上 |
| `components/DraggableRow.vue` | 0 / 有 | 留 | 不满足“双零”；同上 |
| `components/IconSelector.vue` | 0 / 有 | 留 | 不满足“双零”；同上 |
| `components/InventoryWarnings.vue` | 0 / 有 | 留 | 不满足“双零”；同上 |
| `components/MemorySelector.vue` | 0 / 有 | 留 | 不满足“双零”；同上 |
| `components/ProfessionalScanner.vue` | 0 / 有 | 留 | 不满足“双零”；同上 |
| `components/SiteHeader.vue` | 0 / 有 | 留 | 不满足“双零”；同上 |
| `components/StockInDetailModal.vue` | 0 / 有 | 留 | 不满足“双零”；同上 |
| `components/UserInfo.vue` | 0 / 有 | 留 | 不满足“双零”；UserInfo 业务类型与 user-info CSS 排除后仍零调用；同上 |
| `constants/saleTypes.ts` | 0 / 不适用 | 删 | 属常量文件，无模板/组件 dts；全库查文件名和四个运行时导出均仅自身引用；复用现有 phoneStatuses，不删除有效状态定义 |

因此原 17 项累计删除 4 项（上批 3 个局部组件+本批 1 个常量文件），13 个有明确保留依据；不声称“17 个孤儿全部清零”。若未来要改变删除验收规则，应明确改用何种证据，而非用删除后 dts 消失来循环证明删除前无用途。

#### T19.3 SalesView ↔ useSalesCustomers 复核

结论：**未发现“保留了第二套 132 行客户业务逻辑”**，不建立虚假迁移任务。`SalesView.vue` 只 import 并调用一次 useSalesCustomers，把返回的 handleCustomerSearch/createNewCustomer 等接到模板事件，卸载时调用 disposeSalesCustomers；客户搜索、创建 payload、选择和重置实现均在 useSalesCustomers.ts，页面没有第二份定义。

可复验：`rg -n 'useSalesCustomers|handleCustomerSearch|createNewCustomer|disposeSalesCustomers|searchCustomerOptions|buildCustomerPayload' frontend/src/views/sales/{SalesView.vue,useSalesCustomers.ts}`。前者的命中为导入、解构、事件绑定与清理，后者才包含函数定义与 API 调用。

对两文件完整文本运行 Python difflib.SequenceMatcher(autojunk=False)，相同行实测 92 行，其中空行 42 行、仅闭合标点 29 行，最长连续相同块 4 行。原“132 行整块残留”不符合当前提交；相同名称和解构列表不等于重复业务实现。

#### T19.4 本批公共行为去重与后续边界

- 提醒/分享：FieldAccessService 收口权限读取、递归脱敏及单字段拒写判定，field-access 中间件统一 HTTP 拒绝与异常转交；保留业务模块键、响应键映射、提醒类型 name 特例与分享作者脱敏。租赁多字段组合/动作权限例外不能直接套用这一规则，保留原逻辑。
- 两个报价页：useImageGallery 收口 PNG 下载、iOS 预览切换、JPEG 系统分享、防重复分享与 URL 清理；补齐重新生成/关闭/卸载后的异步结果失效处理。查询、截图列宽、水印和联系人样式保留各自边界。
- 两个薪资弹窗：删除页面私有 pointer/滚轮状态机，宽表外层通过 data-table-drag-scroll 接入现有 admin-table-drag-scroll；同一公共入口处理鼠标、Shift 滚轮、交互控件与触摸边界。
- routes/index.js 删除未接线 v1 路由整段注释和过时“旧版路由”标签，不修改活路由。

其余原报告 clone 候选按后续批次处理：基础数据 CRUD 模板、库存/销售筛选器、H5 订单/登录注册布局、薪资明细剩余模板和样式，以及报价截图克隆/水印布局。相同行需先区分业务与空白/框架壳，不为减少行数把权限键、筛选事件或请求身份强行合并。database-sync 后端及 data-backup.service 维持原有功能决策边界，本批不退役。

#### T19.5 验证结果

- `npm --prefix backend test`：1404 项，1390 通过、14 项真实数据库测试跳过、0 失败。新增 7 项字段权限回归已接入正式全测；最终 controller 清理后再跑 `node --test backend/test/field-access.check.js backend/test/reminder-controller.check.js backend/test/shared-controller.check.js`：16/16 通过。
- `npm --prefix frontend run check:standards`：rc=0，包含 type-check、严格 lint、所有规范/安全/分层/下载/字段/公共选项审计与 19 个文件的 97 项前端测试。新增图片保存/分享 9 项、全局表格交互 4 项；不使用 any，不新增豁免。
- 分层门禁：HEAD 锚点历史与逐文件 AST 比较均通过，route/SQL/事务/仓储直连/反向依赖/连接租借/孤立 controller 均为 0；本批没有修改架构台账或上限。
- 原 Vite 生产配置（Terser、gzip、Brotli）构建 rc=0，产物写入临时目录；重新删除并生成 components.d.ts：123→121，仅去 RouterLink/RouterView 两条第三方生成声明，13 个候选声明无变化，构建模块图逐项均为 0。未改变插件扫描范围；生成文件受 gitignore 管理，不手写删除条目。
- `npm run check:docs`：205 份 Markdown、8 个已标记 TS/Vue 示例、规范冲突检查通过；预定示例新增 2 段编译保护。`node frontend/scripts/check-standards-coverage.mjs`：新增公共入口登记后通过。
- 构建体积门禁使用原脚本、原阈值和本次临时构建：首屏 JS 604.14 KiB 通过、CSS 274.57 KiB（281157 bytes）超过 280000 bytes 上限，首屏总量 878.70 KiB 通过。已用独立 HEAD 源码树、同一已安装依赖和 Vite 配置复核，HEAD CSS 同为 281157 bytes，文件名均为 index-C3vj9eln.css，字节完全相同，SHA-256 均为 c6f1cd29bf104ebb1f7cf66898bdebb28ad9b83c72f5fe651fdb5720fedc5eb3；两次原体积门禁均只因 CSS 失败。此对照复用安装目录，不等同全新 npm ci。当时的失败登记 T20，后续关闭结果见 T20；T19 当次未调整阈值，不把当时检查记为全绿。
- `git diff --check` 通过。未访问云端数据库、未做浏览器/iOS 真机视觉、真实分享或补贴二维码扫码验收；事件与平台能力的模拟测试不能替代这些验收。临时构建、对照源树、探针和日志在完成后清理，正式测试保留。

已同步权威入口：后端 INDEX、字段权限指南、后台表格规范、报价公共实现规范与 manifest、缓存指南、预定 API 用法；当前决定和后续候选只保存在本任务台账。

### T18 前端闲置契约、组件与依赖治理（2026-11-08）

- 状态：已提交 `ee05c43`；起点提交 `c9aa410`，开始时工作区干净。本任务与 T17 已完成的四维分层治理分开登记，不调整架构基线。
- 顺序：先核对 `getSalesForecast` 调用与真实路由，再对 analytics 全部方法逐项登记删/修/留；组件必须经全新 dts 构建和动态引用双证据核对，证据不一致时保留；依赖逐项检查运行时/构建/脚本/测试用途，优先核查 canvas 与 OCR/traineddata。
- 验收：保留前端正常分析功能和真实后端接口；新增必要的路径契约回归。删除组件同步审计脚本、基线、字段契约、页面台账和当前文档。每项依赖删除同步 package.json/锁文件并以全量后端 0 fail 兜底。完成后记录实测类型、严格 ESLint、规范、构建、测试和文档结果；未执行的数据库/浏览器验收单独说明。

#### T18.1 forecast 调用面与逐方法分类

核查基准：`c9aa410`。旧 `getSalesForecast` 属于**零调用方法**：视图 0、composable 0；但在用的 `SalesAnalytics.vue:1272` 直接请求 `GET /analytics/sales-forecast`，后端 `routes/index.js:137` 挂载 `/analytics`，`routes/analytics.js:281` 声明 `GET /sales-forecast`。旧方法为 `/analytics/sales/forecast`，响应误标为数组，缺少 page_size 且多出后端未实现的 year 周期。本批修正公共方法的路径、周期、分页与唯一 `SalesForecastResponse` 类型，并把该在用页面接入公共方法，保持门店范围参数。

以下覆盖原文件全部 **63 个 HTTP 方法**（40 删、1 修、22 留）；另列 getInstance。此前“42 个不存在方法”的数量不准确，实测为 41，其中 forecast 修复，剩余 40 个满足删除双条件。有效的 realtime、inventory/value 即使当前页面零调用也保留，避免把“没用”与“后端不存在”混为一谈。

逐行证据口径与命令：

- E1：`git grep -n -E '(analyticsService|analyticsApi)\.getSalesForecast\b' c9aa410 -- frontend/src` 无输出（rc=1）；`git grep -n -F '/analytics/sales-forecast' c9aa410 -- frontend/src backend/src/routes` 找到在用页面与真实路由。下面方法表的“前端原路径”来自该提交 analytics.ts 的 AST，后端按 HTTP 方法+挂载路径匹配；动态客户 ID 按路由参数匹配。
- E2：`git show c9aa410:frontend/src/api/analytics.ts` 核对每个方法；`rg -n '^router\.(get|post|put|patch|delete)' backend/src/routes/analytics.js` 输出 31 条真实路由；对每行执行 `git grep -n -E '(analyticsService|analyticsApi)\.<方法名>\b' c9aa410 -- frontend/src`，调用点或无输出结果逐项记在表中。别名 analyticsService 与 analyticsApi 同时核对；静态/动态 import、重导出和字符串检索未发现另一条方法消费链。
- E3：`npm --prefix frontend run test:unit -- tests/analytics-api-contract.spec.ts` 对保留/修复后的 23 个方法实际调用 mock unifiedApi，并与后端 AST 路由比较；另验证预测周期、门店、分页及返回值。原删除方法不再提供调用入口。

| 方法 | 前端原路径（GET，除非另标） | 后端真实路径 / 不存在 | 原视图调用点（frontend/src/） | 处置与命令输出依据 |
| --- | --- | --- | --- | --- |
| `getSalesAnalytics` | `/analytics/sales` | `/analytics/sales` | `views/analytics/page/SalesAnalytics.vue:777` | **留**；E2：匹配路由=1，调用=1；保留在用契约 |
| `getSalesTrends` | `/analytics/sales/trends` | `/analytics/sales/trends` | `views/analytics/page/EmployeeAnalytics.vue:1062` | **留**；E2：匹配路由=1，调用=1；保留在用契约 |
| `getTopProducts` | `/analytics/sales/top-products` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getSalesForecast` | `/analytics/sales/forecast` | 旧路径不存在 → `/analytics/sales-forecast` | 视图 0 / composable 0 | **修**；E1：旧方法调用=0，直接页面调用=1；修复并接线 |
| `getInventoryAnalytics` | `/analytics/inventory` | `/analytics/inventory` | `views/analytics/page/InventoryAnalytics.vue:925` | **留**；E2：匹配路由=1，调用=1；保留在用契约 |
| `getLowStockItems` | `/analytics/inventory/low-stock` | `/analytics/inventory/low-stock` | `views/analytics/page/InventoryAnalytics.vue:926` | **留**；E2：匹配路由=1，调用=1；保留在用契约 |
| `getInventoryTurnover` | `/analytics/inventory/turnover` | `/analytics/inventory/turnover` | `views/analytics/page/InventoryAnalytics.vue:927` | **留**；E2：匹配路由=1，调用=1；保留在用契约 |
| `getInventoryValue` | `/analytics/inventory/value` | `/analytics/inventory/value` | 视图 0 / composable 0 | **留**；E2：匹配路由=1，调用=0；保留真实后端契约 |
| `getInventorySupplierStats` | `/analytics/inventory/supplier-stats` | `/analytics/inventory/supplier-stats` | `views/analytics/page/InventoryAnalytics.vue:971` | **留**；E2：匹配路由=1，调用=1；保留在用契约 |
| `getRecentSoldInventory` | `/analytics/inventory/recent-sold` | `/analytics/inventory/recent-sold` | `views/analytics/page/InventoryAnalytics.vue:989` | **留**；E2：匹配路由=1，调用=1；保留在用契约 |
| `getCustomerAnalytics` | `/analytics/customers` | `/analytics/customers` | `views/analytics/page/CustomerAnalytics.vue:687` | **留**；E2：匹配路由=1，调用=1；保留在用契约 |
| `getCustomerSegments` | `/analytics/customers/segments` | `/analytics/customers/segments` | `views/analytics/page/CustomerAnalytics.vue:892` | **留**；E2：匹配路由=1，调用=1；保留在用契约 |
| `getCustomerRetention` | `/analytics/customers/retention` | `/analytics/customers/retention` | `views/analytics/page/CustomerAnalytics.vue:954` | **留**；E2：匹配路由=1，调用=1；保留在用契约 |
| `getCustomerLifetimeValue` | `/analytics/customers/lifetime-value` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getCustomerGrowth` | `/analytics/customers/growth` | `/analytics/customers/growth` | `views/analytics/page/CustomerAnalytics.vue:817` | **留**；E2：匹配路由=1，调用=1；保留在用契约 |
| `getHighValueCustomers` | `/analytics/customers/high-value` | `/analytics/customers/high-value` | `views/analytics/page/CustomerAnalytics.vue:782` | **留**；E2：匹配路由=1，调用=1；保留在用契约 |
| `getCustomerDetail` | `/analytics/customers/:param/detail` | `/analytics/customers/:id/detail` | `views/analytics/page/CustomerAnalytics.vue:1192` | **留**；E2：匹配路由=1，调用=1；保留在用契约 |
| `getCustomerActivity` | `/analytics/customers/activity` | `/analytics/customers/activity` | `views/analytics/page/CustomerAnalytics.vue:1057` | **留**；E2：匹配路由=1，调用=1；保留在用契约 |
| `getFinancialAnalytics` | `/analytics/financial` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getRevenueByPeriod` | `/analytics/financial/revenue` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getProfitAnalysis` | `/analytics/financial/profit` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getExpenseAnalysis` | `/analytics/financial/expenses` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getFinancialHealth` | `/analytics/financial/health` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getPerformanceMetrics` | `/analytics/performance` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getPerformanceAnalytics` | `/analytics/performance` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getPagePerformance` | `/analytics/performance/pages` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getApiPerformance` | `/analytics/performance/api` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getSystemHealth` | `/analytics/performance/health` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getRealTimePerformance` | `/analytics/performance/realtime` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getApiMetrics` | `/analytics/performance/api-metrics` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getDatabaseMetrics` | `/analytics/performance/database-metrics` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getPerformanceRecommendations` | `/analytics/performance/recommendations` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getRealTimeData` | `/analytics/realtime` | `/analytics/realtime` | 视图 0 / composable 0 | **留**；E2：匹配路由=1，调用=0；保留真实后端契约 |
| `getActiveUsers` | `/analytics/realtime/users` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getCurrentSales` | `/analytics/realtime/sales` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getSystemLoad` | `/analytics/realtime/system` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getDashboardConfigs` | `/analytics/dashboards` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getDashboardConfig` | `/analytics/dashboards/:param` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `createDashboardConfig` | `POST /analytics/dashboards` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `updateDashboardConfig` | `PUT /analytics/dashboards/:param` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `deleteDashboardConfig` | `DELETE /analytics/dashboards/:param` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getReports` | `/analytics/reports` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getReport` | `/analytics/reports/:param` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `generateReport` | `POST /analytics/reports/generate` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `deleteReport` | `DELETE /analytics/reports/:param` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `exportData` | `POST /analytics/export` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getExportHistory` | `/analytics/export/history` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `downloadExport` | `/analytics/export/:param/download` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getAnalyticsSettings` | `/analytics/settings` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `updateAnalyticsSettings` | `PUT /analytics/settings` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getMetricsConfig` | `/analytics/settings/metrics` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `updateMetricsConfig` | `PUT /analytics/settings/metrics` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getAlerts` | `/analytics/alerts` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `acknowledgeAlert` | `POST /analytics/alerts/:param/acknowledge` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `createAlertRule` | `POST /analytics/alerts/rules` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `updateAlertRule` | `PUT /analytics/alerts/rules/:param` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `deleteAlertRule` | `DELETE /analytics/alerts/rules/:param` | 不存在 | 视图 0 / composable 0 | **删**；E2：匹配路由=0，调用=0；删除 |
| `getEmployeeAnalytics` | `/analytics/employees/detail` | `/analytics/employees/detail` | `views/analytics/page/EmployeeAnalytics.vue:834` | **留**；E2：匹配路由=1，调用=1；保留在用契约 |
| `getEmployeePerformance` | `/analytics/employees/performance` | `/analytics/employees/performance` | `views/analytics/page/EmployeeAnalytics.vue:931` | **留**；E2：匹配路由=1，调用=1；保留在用契约 |
| `getEmployeeRoles` | `/analytics/employees/roles` | `/analytics/employees/roles` | `views/analytics/page/EmployeeAnalytics.vue:999` | **留**；E2：匹配路由=1，调用=1；保留在用契约 |
| `getEmployeeSalaryTrend` | `/analytics/employees/salary-trend` | `/analytics/employees/salary-trend` | `views/analytics/page/EmployeeAnalytics.vue:1129` | **留**；E2：匹配路由=1，调用=1；保留在用契约 |
| `getEmployeeAttendance` | `/analytics/employees/attendance` | `/analytics/employees/attendance` | `views/analytics/page/EmployeeAnalytics.vue:1186` | **留**；E2：匹配路由=1，调用=1；保留在用契约 |
| `getAttendanceSummary` | `/analytics/attendance/summary` | `/analytics/attendance/summary` | `views/analytics/page/EmployeeAnalytics.vue:835` | **留**；E2：匹配路由=1，调用=1；保留在用契约 |
| `getInstance` | 非 HTTP 方法 | 不适用 | 文件内单例与两个导出别名 | **留**；同一实例，无重复 API 实现 |

#### T18.2 孤儿组件双证据复验

先删除生成的 components.d.ts 并通过现有 Vite 配置重新完整构建，再与起点生成文件比较；没有改插件扫描范围、关闭自动发现或手工删除声明来制造零引用。构建模块图同时检查这些组件是否实际进入打包链。Vite 构建从独立 .mjs 执行，临时输出位于 /tmp，完成后清理。

重生成 diff 的真实结果为 123→121 个 GlobalComponents：仅移除 RouterLink、RouterView 两条旧生成声明，未移除任何本批候选组件声明。这两个路由组件由 vue-router 自己的类型扩展与运行时注册提供，仍有模板调用，不能据 dts diff 认定为孤儿。本批不删除路由组件。

```diff
-    RouterLink: typeof import('vue-router')['RouterLink']
-    RouterView: typeof import('vue-router')['RouterView']
```

动态复验命令为 `rg -n 'defineAsyncComponent|resolveComponent|import\.meta\.glob|<component\b' frontend/src --glob '*.{ts,js,vue}'`（63 行机制候选），以及对下表每个 PascalCase/kebab-case 名检索 import 路径、模板标签、完整字符串名。逐一核对组件注册器、异步组件与动态 :is 的数据来源：自动管理器的 initializeAutoDiscovery 目前直接 return；数据优化 tabs 只包含 DataCheckTab/DataImportTab；预定异步组件仅 PreorderFormModal/MatchPreorderModal。

| 候选组件（frontend/src/） | 重生成 dts | 构建模块图 | 模板/import/动态引用 | 处置与原因 |
| --- | --- | --- | --- | --- |
| `components/MobileForm.vue` | 仍有声明 | 0 | 0；1 个 mobile-form CSS class，非动态组件 | **留**：dts 与无调用结果不一致，自动扫描声明不代表采用；本批不越过双零条件 |
| `components/MobileTable.vue` | 仍有声明 | 0 | 0 | **留**：dts 与无调用结果不一致，自动扫描声明不代表采用；本批不越过双零条件 |
| `components/PaginatedTable.vue` | 仍有声明 | 0 | 0 | **留**：dts 与无调用结果不一致，自动扫描声明不代表采用；本批不越过双零条件 |
| `components/ResponsiveLayout.vue` | 仍有声明 | 0 | 0 | **留**：dts 与无调用结果不一致，自动扫描声明不代表采用；本批不越过双零条件 |
| `components/DraggableList.vue` | 仍有声明 | 0 | 0 | **留**：dts 与无调用结果不一致，自动扫描声明不代表采用；本批不越过双零条件 |
| `components/DraggableRow.vue` | 仍有声明 | 0 | 0 | **留**：dts 与无调用结果不一致，自动扫描声明不代表采用；本批不越过双零条件 |
| `components/IconSelector.vue` | 仍有声明 | 0 | 0 | **留**：dts 与无调用结果不一致，自动扫描声明不代表采用；本批不越过双零条件 |
| `components/InventoryWarnings.vue` | 仍有声明 | 0 | 0 | **留**：dts 与无调用结果不一致，自动扫描声明不代表采用；本批不越过双零条件 |
| `components/MemorySelector.vue` | 仍有声明 | 0 | 0 | **留**：dts 与无调用结果不一致，自动扫描声明不代表采用；本批不越过双零条件 |
| `components/ProfessionalScanner.vue` | 仍有声明 | 0 | 0 | **留**：dts 与无调用结果不一致，自动扫描声明不代表采用；本批不越过双零条件 |
| `components/SiteHeader.vue` | 仍有声明 | 0 | 0 | **留**：dts 与无调用结果不一致，自动扫描声明不代表采用；本批不越过双零条件 |
| `components/StockInDetailModal.vue` | 仍有声明 | 0 | 0 | **留**：dts 与无调用结果不一致，自动扫描声明不代表采用；本批不越过双零条件 |
| `components/UserInfo.vue` | 仍有声明 | 0 | 0；4 个 user-info CSS class，非动态组件 | **留**：dts 与无调用结果不一致，自动扫描声明不代表采用；本批不越过双零条件 |
| `views/data-optimization/page/DatabaseSyncTab.vue` | 前后均无声明 | 0 | 0 | **删**：dts 与动态引用双零，构建模块图亦为零 |
| `views/preorders/page/DeliverConfirmModal.vue` | 前后均无声明 | 0 | 0 | **删**：dts 与动态引用双零，构建模块图亦为零 |
| `views/preorders/page/QuickAddCustomerModal.vue` | 前后均无声明 | 0 | 0 | **删**：dts 与动态引用双零，构建模块图亦为零 |

本批删除三个局部组件，同时删除字段契约 preorders 的失效源码路径、动效基线 1 项、设计令牌基线 2 项以及页面台账登记，更新预定与同步当前文档；没有提高任何审计上限，也没有删除正式测试断言。其余 13 个公共组件的登记全部保留。Database-sync 后端路由依然受认证与 data-check:edit 控制，本批没有退役后端接口，也不再把当前不存在的“远程同步”页签写成可用入口。

#### T18.3 依赖四维用途矩阵与 OCR 证据

D1：通过 `rg --files --hidden` 枚举源码、配置、构建、脚本、正式测试、CI/部署文件（排除 .git、node_modules、日志、备份与锁文件），核对 import/require/dynamic import、完整包名字符串、包名拼接、运行脚本与 CLI；不能把 DOM 的 document.createElement('canvas') 计作 Node canvas 包依赖。D2：核查各包 package.json、两个锁文件的 dependencies/optionalDependencies/peerDependencies，以及 `npm --prefix backend ls canvas pg json5 pdf-lib pdfjs-dist tesseract.js sharp --all`。D3：删除后真实 OCR 和后端全测。下表“0”指应用直接用途检索为零，不能泛指 npm 生态中从无该依赖。

| 依赖（目录） | 运行时 | 构建 | 脚本 / 运维 | 测试 | 处置与依据 |
| --- | --- | --- | --- | --- | --- |
| canvas（backend，3.2.1） | 0；Tesseract Node 输入直接读 Buffer/Uint8Array，sharp 负责预处理，WASM 负责识别 | 后端无 canvas 构建入口；浏览器 canvas 与此包无关 | 0；无 CLI/启动加载 | 原测试 0；本轮真实 OCR 在阻止该包加载时仍为 1234 | **删**；D1/D2/D3；package.json 与 lock 同步删除 |
| pg（backend，8.16.3） | 0；数据库使用 mysql2 | 0 | 0 | 0 直接引用 | **删**；pg-pool 的 peer 仅在该无用依赖树内，不是应用消费方 |
| json5（backend，2.2.3） | 0 | 后端无构建用途 | 0；没有 JSON5 CLI 或配置解析入口 | 0 | **删**；前端工具链的同名传递依赖不动 |
| pdf-lib（backend，1.17.1） | 0 | 0 | 0 | 0 | **删**；没有 PDF 文档生成入口 |
| pdfjs-dist（backend，5.5.207） | 0 | 0 | 0 | 0 | **删**；与正在使用的前端包分开核查 |
| v3-infinite-loading（frontend，1.3.2） | 0；无 import、标签、字符串组件注册 | 0 | 0 | 0 | **删**；前端构建/类型/行为测试验证 |
| pdfjs-dist（frontend，5.5.207） | upload-media.ts 动态转 PDF 图片 | public/pdf/pdf.worker.min.js 资源继续保留 | 上传资源部署用途存在 | 由上传契约覆盖；未用删除后端包冒充端到端 PDF 验证 | **留**；真实前端功能依赖 |
| tesseract.js / tesseract.js-core（backend，7.0.0 / 7.0.0） | ocr-image、http-login、captcha-recognizer、puppeteer-login 正在使用 | Node worker + WASM；包依赖没有 canvas，Node 图片 adapter 也未 require canvas | 价格采集登录 OCR；traineddata 缓存由 worker 按语言读取 | 本轮真实识别与 3 项正式预处理/释放回归 | **留**；不能因删除 canvas 而删除 OCR 引擎或语言资源 |
| sharp（backend，0.35.5） | OCR 放大/灰度/归一化及图片处理在用 | 原生图片依赖保留 | 媒体转换链在用 | 正式预处理测试实际使用 sharp | **留**；与 canvas 无替代包关系 |

traineddata 归属：ocr-image 使用 createWorker('eng', 1)，puppeteer-login 使用 recognize(..., 'eng')；Tesseract 7 Node worker 默认从工作目录读取 eng.traineddata（未显式设置 cachePath 时为 '.'），随后加载到 WASM 文件系统。backend/eng.traineddata 是当前英文 OCR 使用的缓存。backend/chi_sim.traineddata 没有发现当前调用，但属语言资源，可能承担外部/历史用途，本批保留，不以 Node 包清理为由删除。OCR 检查仅使用合成图片与本地英文缓存，不访问第三方登录，不写业务数据库。

删除前后各实际识别一次合成 1234 图片；删除后给主线程与 worker 注入 require 守卫，任何 canvas/pg/json5/pdf-lib/pdfjs-dist 加载尝试都会记录并拒绝。结果均为 1234，未发生被删包加载尝试，eng.traineddata 校验和未改变。隐性依赖检查没有留下 canvas 疑因，因此可以删除。同步发现 OCR helper 默认 logger 未提供时会造成 worker TypeError，已补可调用默认值，并保留正式成功/异常释放回归。

package.json 的实际 diff 为 backend 删除 canvas/json5/pdf-lib/pdfjs-dist/pg 五行，frontend 删除 v3-infinite-loading 一行；两个锁文件由 npm uninstall --ignore-scripts --no-audit --no-fund 更新。锁文件对比：backend 删除 60 个包记录、frontend 删除 1 个，无新增包、无保留包版本或 integrity 变化。最终全测和构建结果见本节收口记录。

#### T18.4 最终收口（2026-11-08）

- `npm --prefix backend test`：1,397 项，1,383 通过、14 跳过、0 失败。14 项真实数据库用例默认跳过，不能算云端数据库验证通过；本批未连接或写入业务库。
- `npm --prefix frontend run check:standards`：rc=0，完整规范链通过，包含类型检查、17 个测试文件 / 84 项前端行为测试、严格 ESLint、安全/分层、下载安全、字段、公共选项、动效/令牌/样式、页面台账、权限、Loading/空状态等。预测专项为 25 项，已包含在 84 项中，不重复累加。新增/修改的正式测试另经零警告 ESLint 核验。
- 现有 Vite 生产配置完整构建 rc=0（Terser 与 gzip/Brotli 保持启用），清理前 dts 重生成与删除后最终构建均通过；存在原有体积提示，不等于浏览器或发布性能验收。本次临时构建使用 /tmp 输出，未覆盖仓库现有 dist。
- 原交易契约测试要求出现 category_id，但该字段只属于已删除且无后端实现的财务占位 API。本批将该断言替换为 category_id 退役检查，并增加正确预测路径与旧路径/无效财务接口不得回归的断言；其余规范字段检查保留。没有通过恢复死方法、删除正式测试或跳过失败来让全测通过。
- 三个组件删除后，config/规范脚本/正式测试/当前页面与同步文档中均无失效路径；字段与样式基线仅删除对应项。13 个声明与采用结果不一致的公共组件保留，不宣称全部孤儿清零。
- `npm run check:docs` 与 `git diff --check` 通过。逐方法表覆盖原 63 个 HTTP 方法加 getInstance；逐方法历史 git grep 结果与表格逐行一致，代码实际为 40 删 / 1 修 / 22 留。依赖 manifest 与锁文件一致；OCR 真实回读与 worker 释放测试通过；临时脚本、生成包与日志完成后清理，正式回归保留。
- 已同步权威入口：API 规范、组件采用/复验规范、前端页面台账、后端索引、预定文件说明和同步指南/索引。未执行浏览器/真机、第三方真实登录、远程 PR 或生产环境验收；本轮不自动提交或部署。

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
- 影响范围：`backend/src/routes/` 遗留业务 handler、对应 controller/service/repository、权限中间件与契约测试。已处理图标模块缓存、清理、删除，数据导入上传、清理、分析、启动，屏幕锁设置与查询用户/密码/上传文件处理，配件上传、读写、库存、入库、销售和统计，认证登录、单设备/全设备退出、当前用户资料、刷新令牌轮换及开发管理员初始化，系统数据库连接探测、状态、统计、磁盘/内存运行信息、重连和公告查询/增改删，以及商城配置、轮播图、模板、订单、数据库迁移、商城图片上传/删除、商品图片删除和已售商品查询；手机模块迁移图片/视频上传、H5 上架/验机、库存汇总、已售时间线、IMEI/序列号搜索及手机详情查询；客户模块迁移搜索、列表、详情、消费记录、创建、更新、删除、消费流水限制、积分设置、VIP 等级和统计；预定模块迁移列表、详情、删除、统计、基础选项、匹配列表和候选库存；其余模块按 `backend/scripts/config/backend-route-architecture.json` 的非零项逐批推进。
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
- `backend/scripts/config/field-contracts.json` 同时受前端审计和后端契约测试约束；权限矩阵已经存在于权限管理页面。
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

- 全局复核确认基础设施三件套均存在；共享连接包装、controller SQL/事务、controller 直连 repository 及跨层反向依赖均由架构门禁检查。ARCH-001 当前仍有 15 个 controller→repository 存量依赖，逐文件登记在 `backend/scripts/config/backend-route-architecture.json`，最大值与基线总和精确相等，只允许逐项减少；它们是存量豁免，后续触及时应优先迁入 service。共享 `withConnection` 覆盖仓储 wrapper，但不表示所有服务和仓储已统一连接生命周期。
- analytics `/transfers-and-allocations` 已迁入 `AnalyticsTransfersController → AnalyticsTransfersService → AnalyticsTransfersRepository`，保留认证、业务用户及全局 analytics 门店权限链路、日期校验、默认月份、响应字段和七组参数化查询；AST 实测该 route 从 2 降至 1。
- analytics `/sales-forecast` 已迁入 `AnalyticsSalesForecastController → AnalyticsSalesForecastService → AnalyticsSalesForecastRepository`，将预测算法及日期处理放入 service，SQL 留在 repository，保留认证、业务用户、加权排行、参数绑定和响应结构。`formatDateString` 现由 analytics-query 公共导出复用。新增 mock 测试覆盖空结果、预测字段、离线响应及两条查询参数；analytics 内联数从 1 降至 0，删除整个 `analytics.js` 台账键，遗留总数从 51 降至 50，遗留键数与仍有内联文件数均为 6。
- 验证结果：`npm --prefix backend test` 通过（1155 通过、14 跳过、0 失败）；`npm --prefix frontend run check:backend-security` 通过（安全审计 504 个源文件，ARCH 分层门禁通过）；`npm --prefix frontend run check:fields` 通过；本批运行代码、测试和共享日期工具的 ESLint `--max-warnings 0` 通过；`npm run check:docs` 与 `git diff --check` 通过。未连接云端数据库。
- Git `GET /log`、`GET /branches` 和 `POST /delete-commit` 已复用 `GitController → GitService`，保留对应权限；日志接口保留 limit 默认值及 1–100 上限、revert/手动隐藏/本地备份记录过滤，分支接口保留当前分支标记与远端 HEAD 过滤，隐藏提交保留哈希校验、幂等提示和“不影响工作区”响应。Git log、config 写入均通过既有安全参数执行器传递。正式测试覆盖限量、过滤、分支归类、哈希验证和响应错误。AST 实测 `git.js` 从 13 降为 10，摘要已更新；遗留 handler 总数从 50 降为 47，key 数与非零内联文件数仍为 6。
- 本批最终验证：后端全量测试、后端安全及架构门禁、字段审计、严格 ESLint、文档检查和 `git diff --check` 均通过；未执行真实数据库测试，也未对 Git 仓库执行写操作。
- 全局 ARCH 补查发现既有门禁只验证 repository 的 `withConnection` wrapper 是否委托共享 helper，没有覆盖 routes/controllers/services/repositories 中直接调用 `.getConnection()` 的存量。文本扫描得到 182 个匹配，其中 repository 基类 1 个匹配位于注释；TypeScript AST 实测为 181 处 / 51 个文件（route 17、controller 28、service 82、repository 54），逐文件登记于 `backend/scripts/config/backend-route-architecture.json`；禁止新增，只允许逐项减少，归零后必须删除台账键。该计数不代表连接释放、事务行为或云端数据库运行状态已验证，相关业务连接迁移仍须按模块覆盖成功/异常释放和事务语义。
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
