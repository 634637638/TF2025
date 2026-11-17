# TF2025 项目开发指南

本指南记录跨模块开发约定。AI 执行顺序以根目录 [AGENTS.md](../AGENTS.md) 为准，文档总入口为 [00-INDEX.md](00-INDEX.md)。领域规则只在对应专项正文维护，本指南不复制页面模板或第二套工具实现。

## 开发前查阅

| 改动主题 | 权威入口 |
| --- | --- |
| 页面、按钮、表格、弹窗、Loading、主题及响应式 | [前端索引](frontend/INDEX.md) 和 [规范清单](frontend/standards-manifest.json) |
| API、上传、下载、认证和外部请求 | [API 规范](guides/api-standards.md)、[下载安全](frontend/download-security-standard.md) |
| 共享类型与局部类型 | [TypeScript 规范](guides/typescript-standards.md) |
| 权限和字段访问 | [权限索引](permissions/INDEX.md)、[页面权限能力](frontend/permission-capability-standards.md) |
| 后端与数据库 | [后端索引](backend/INDEX.md)、[数据库索引](database/INDEX.md) |
| 日志、异常和校验 | [日志规范](guides/LOG_SYSTEM_STANDARDS.md)、[错误处理指南](guides/error-handling-standards.md) |
| 日期、日期范围和机器计时 | [时间规范](frontend/time-standards.md) |
| 测试、临时脚本和测试数据清理 | [全局测试与清理规范](guides/TESTING_STANDARDS.md)、[数据库回归测试](backend/database-testing.md) |
| 文档、检查和交付 | [文档维护](guides/DOCUMENTATION_STANDARDS.md)、[代码审查](guides/CODE_REVIEW_STANDARDS.md) |

读到规则冲突时，先核对专项正文、公共源码和测试，再修正过时指南或登记差异；不要把“代码现在这样写”自动视为合规，也不要为通过检查降低约束。

## 项目与目录边界

- 后端文件归入 `backend/`，前端文件归入 `frontend/`，项目根目录不再设置 `config/`。后端运行配置位于 `backend/src/config/`；字段契约、后端安全审计和架构台账位于 `backend/scripts/config/`；前端运行时审计与公共选项审计配置位于 `frontend/scripts/`。跨端共享策略保留一份权威文件，由另一端引用，禁止复制两份配置。
- 根目录保留仓库与跨端工程入口：`package.json`、锁文件、`eslint.config.js`、`scripts/`、Git 文件和 AI 指令入口。前后端 Nginx 模板分别位于 `frontend/deploy/nginx.conf` 和 `backend/deploy/nginx.conf`；前端构建统一执行 `npm --prefix frontend run build`，不另建根级构建脚本。ESLint 仅维护 `eslint.config.js`，不得恢复 `.eslintrc.js`。
- 前端标准打包仅更新 `frontend/dist/`，由用户自行压缩上传，不自动创建部署 ZIP/TAR；构建脚本、产物与检查规则统一见[生产构建与产物](frontend/security-runtime-standards.md#生产构建与产物)。
- **根级压缩备份特例**：用户明确要求项目开发源码压缩备份保留在根目录 `本地备份/`，Git 管理页继续生成到此处，不迁入前端或后端。该目录忽略提交且不得包含在源码快照内；它与 `/backup` 管理的 `backend/backups/` 是不同用途，规则见[备份管理](backend/backup-management.md#git-管理页项目压缩包)。本地补丁、旧日志和其他工具的私有配置放在项目外保存；`.vscode/`、`.claude/` 属于可保留的本地工具配置，不作为生产运行依赖或第二套项目规范。
- 前端采用 Vue Composition API 和 TypeScript，跨页面状态复用 Pinia，路由权限和导航沿用全局守卫。
- 后端采用 Node.js、Express、`mysql2` 及现有路由/服务/仓储。既有后端 JS 文件沿用项目技术边界，不因“必须使用 TypeScript”的口号擅自迁移技术栈。
- 数据库通过运行环境配置连接云端；连接地址、口令和密钥不写入源码、文档或调试输出。
- 后端环境文件按运行环境固定：本地开发只使用 `backend/.env`，云端生产只使用服务器本机的 `backend/.env.production`。两份文件不得整份互相复制；生产启动通过 `ENV_FILE=.env.production`，测试或专项脚本只有在明确指定 `ENV_FILE` / `--env-file` 时才可使用其他环境文件。
- `frontend/src/api/` 放置站内 HTTP 契约封装；`services/` 可以调用 API 或既有统一请求并组织业务、缓存和选项，不为了目录形式再包一层重复接口。
- 权限按用户、角色和明确动作授权，不根据“管理员/销售员”等名称临时推断能力。前端动作、后端鉴权、字段掩码、导出和缓存隔离必须配套核对。
- 销售、预定交付、库存、采购、租赁和付款等流程，以业务专题和数据库字段契约为准；修改状态流转时同时核对事务、关联记录、权限和缓存失效。

## 统一实现与清理范围

后端 SQL 中的业务值使用参数绑定；动态列名、排序字段和表名通过服务端固定映射或白名单选择，不能把请求输入直接拼进 SQL。模板字符串可能只是拼接可信 SQL 片段，审查时追踪变量来源与绑定参数，不把关键词数量当作注入证据。事务内查询和写入使用同一连接，配套检查回滚、并发、幂等、关联状态及权限；路由/服务/仓储沿用现有边界渐进整理。

后端接口统一走 `route → controller → service → repository`：route 只声明路径、认证授权、参数校验和中间件；controller 负责 HTTP 输入输出和调用 service，禁止在 controller 写裸 SQL、管理事务或直接依赖 repository；业务规则、事务编排放入 service，SQL 放入 repository。服务层 actor 身份统一使用 `src/types/actor.js` 与 `src/core/base/base.service.js`，数据库连接租借通过共享 `src/core/db/connection.js` 执行，连接必须在成功和异常路径释放。三个基础文件由 ARCH 门禁检查必须存在；repository 自定义 `withConnection` 只能委托给共享连接 helper。新增路由必须引用 controller 方法，不得在 route 内定义业务 handler；每个 controller 都必须被运行时 route 引用，禁止只被测试或扫描脚本引用的孤立 controller。ARCH 门禁禁止新增 controller→route、service→route/controller、repository→route/controller/service 反向依赖；历史反向依赖由 `forbiddenLayerDependencies` 按文件和路径登记，只允许逐批删除，最大值必须精确等于台账总数；controller→repository 存量由独立台账收敛，静态 `require`、静态 `import` 与动态 `import()` 均纳入检查。现存内联 route handler 按非零文件登记在 `backend/scripts/config/backend-route-architecture.json`，其 key 数必须等于仍有内联 handler 的文件数，`maxLegacyNonControllerRoutes` 必须精确等于计数总和；route handler 数量和实现摘要只允许减少。controller 中既有 SQL/事务调用由同配置的 `controllerDatabaseCalls` 逐文件登记，SQL 与事务最大值必须分别精确等于各文件基线之和，且逐文件计数必须与 AST 实测一致；迁移后立即删除归零项并下调对应最大值。controller 既有 repository 直连依赖由 `controllerRepositoryDependencies` 按文件登记，`maxControllerRepositoryDependencies` 必须精确等于依赖总数，且每个文件的依赖路径必须与 AST 实测集合一致；迁入 service 后立即移除相应路径，文件归零时删除整个键并下调最大值。routes/controllers/services/repositories 中真实的连接池租借由 `directDatabaseConnectionLeases` 按层和文件登记；仅返回连接池的 accessor（例如继承 `BaseRepository.getConnection()`）以及从 Map 读取已持有连接的 accessor 不计为新租借，必须按类、返回值和调用对象的 AST 语义区分，并解析静态导入、构造默认值与成员绑定；未知对象或被改写的成员不能直接排除。目标源码快照必须使用同一语义口径；嵌套的池 `.getConnection()` 仍计为真实租借，不得按方法名一律排除，也不得用文件豁免隐藏真实租借。`maxDirectDatabaseConnectionLeases` 必须精确等于总数，新增真实租借禁止，迁入共享 helper 后只允许逐项减少并删除归零键。门禁动态枚举所有 `max*`，每项都必须在该配置的 `baselineHistory` 中按日期、数值、事由追加登记；历史只能追加、不能删除或改写，登记日期不得倒退，当前 max 必须等于最新锚点。ARCH 门禁还必须相对目标分支检查历史前缀和逐文件基线增长；max 上调只有在追加有日期和事由的登记后才可通过。目标引用优先使用 `ARCHITECTURE_BASELINE_REF`，其次为 PR 目标分支，默认 `HEAD`。门禁导出目标源码并按同一 AST 口径比较逐文件债务，导出失败直接拒绝通过。若目标分支尚无架构台账，仍执行源码比较，但报告首次登记，历史前缀核验须待台账合入；首次登记可解释已有债务，却不能证明各项均相对目标源码未增长。记录事由属于可审查的变更说明，不等同于独立审批；上调须由评审明确接受。以上要求由 `npm --prefix frontend run check:backend-security` 中的 AST 审计和回归测试执行。

优先复用全局 API、JWT/CSRF、Loading、通知、错误边界、时间工具、性能监控、组件和 Composable。共享业务实体、请求/响应和分页类型不得重复；页面私有状态和 Props 的边界按 TypeScript 专项处理。

业务层日志通过前端 `logger`、后端 `log` 记录，不直接调用 `console.error`。底层日志适配器和命令行工具的输出例外见日志规范。错误记录和用户提示分别承担诊断与交互职责，避免同一次错误被拦截器、业务层重复弹出。

样式使用公共 class 和视觉令牌；绑定业务数据所必需的动态样式、图表、媒体下载和第三方库的 DOM 适配不能被笼统当作“内联样式/直接 DOM 一律禁止”。允许边界由对应公共组件和专项规范确定，禁止复制通用 UI 几何值。

同类问题须排查，本次直接相关的修复一起完成，并验证调用链；无关的大范围改造记录后续事项。性能优化应针对测量到的瓶颈，不要求每次小改动都引入虚拟滚动或新缓存。

## 文件复用与合并

本节是跨模块文件新增与合并流程的唯一正文；业务、UI、类型和测试边界仍以对应专项规范为准。目标是职责清晰、同一能力只有一个权威实现，不以文件数量最少为目标，也不把已有写法直接视为合规。

### 新增前判断

- 先搜索同类功能、公共入口、所属业务模块及测试，核对真实调用关系。现有文件职责适合承载时直接完善；页面专用的简单逻辑、私有类型和局部条件优先留在所属实现中。
- 简单按钮、样式、字段或条件修复，不因本次修改另建工具、组件、配置或报告；不得仅因“以后可能复用”、文件行数或套用目录模板而拆分。相似外观或名称不能证明业务语义一致。
- 新增须有明确的独立职责、实际复用需求或专项规范依据，例如隔离复杂组件生命周期、遵守后端分层、提供正式回归测试或数据库迁移。首次写入前说明拟新增路径、用途、已有位置不适合承载的原因，以及调用、注册或执行入口和检查方式；在已有任务授权内按规范实施，无需为每个文件另行申请许可。
- 复用现有 API、服务、工具和类型，不增加仅转发同一调用的平行封装。后端分层、第三方请求隔离、权限与数据范围等必要边界必须保留，不能为减少文件绕过它们。

### 发现重复后的合并步骤

1. **核对职责和范围**：比较输入输出、字段语义、权限、数据范围、状态、副作用和生命周期。确认是同一能力的重复实现或无必要拆分，再选择符合专项规范的现有入口；语义不同的实现保留各自边界，不强行合并到一个大文件。
2. **迁移全部调用**：本次业务域、调用链和相同公共入口范围内相关且可验证的合并一并完成。迁移源码、模板、类型、导出、动态注册、路由、脚本命令和测试引用；复用已全局注册的组件与指令，避免重复挂载。合并公共机制时保留各调用方独立的业务与权限判断。
3. **同步关联资产**：修正受影响的权威文档、索引、manifest、页面台账和必要审计配置。测试按[测试规范](guides/TESTING_STANDARDS.md)保留等价行为覆盖；迁移与回滚脚本不能仅因运行过而删除。确需保留外部兼容入口时，仅委托唯一实现，并按[兼容接口退役台账](guides/compatibility-route-retirement-ledger.md)记录适用的退役安排，不保留两套业务逻辑。
4. **验证并删除旧实现**：核对下节所列删除边界及对应专项要求，按[任务检查矩阵](guides/CODE_REVIEW_STANDARDS.md#任务检查矩阵)运行适用检查，确认调用迁移和替代覆盖后删除旧文件、重复定义及无用引用，并复核删除后的检查结果；不能只迁移一处就宣称合并完成。
5. **说明结果和保留项**：交付列出新增文件及必要性、合并或删除文件的替代入口、检查结果，以及已发现但未处理的重复项、风险和原因。无需为此新建报告；跨出本次范围的事项按现有台账记录，不另建待办清单。

保留用户及其他会话的未提交改动；不能把 Git 未跟踪文件直接当作垃圾，也不擅自合并其他会话正在修改的文件。只读排查任务仅提出建议；证据不足或存在未核实的外部依赖时保留文件并说明边界。

## 删除与测试边界

删除导入、类型、组件、样式或接口前，核对静态引用、动态注册、路由扫描、声明扩展、外部客户端及副作用，并运行相关检查。不能仅凭搜索无命中宣称“100% 安全”；证据不足时说明风险，不删除可能仍有业务依赖的实现。

测试创建、保留、清理和结果报告统一遵循[全局测试与清理规范](guides/TESTING_STANDARDS.md)。正式测试、安全回归、审计门禁以及迁移、修复和回滚脚本属于项目资产；清理的是一次性临时脚本、临时数据、调试入口和无用生成产物。测试账号和连接凭证由当前授权环境提供，不复制到规范正文。数据库回归默认使用独立测试库；业务库测试仅在本次任务已明确授权、已确认备份且准确指定目标时，按[数据库回归测试](backend/database-testing.md)的显式业务模式执行，不能自动回退业务库或扩大写入范围。结束必须核验事务清理与残留，不清空业务数据、不重置自增值。

测试以行为、输入输出、权限拒绝、状态流转和事务边界为主要断言。必要的源码审计可检查公共入口，但不能要求保留 `any` 或只因重命名局部变量、调整泛型而失败。更新断言时应核对业务契约，不能单纯删除失败断言。

## 文档与 Git

业务和技术正文放在 `docs/` 对应目录；根目录 `AGENTS.md` 和 `CLAUDE.md` 是允许的工具指令入口，只保存执行流程和导航。规范正文不得在多个目录复制维护。

新增文档更新所属索引及必要的入站链接，不要求每次都在总索引新增同一专题的独立入口。带日期的进展报告是快照，不代表当前实现、线上状态或测试结果。

保留用户已有的未提交变更；未经明确授权不执行恢复、重置、清理或覆盖工作区的 Git 操作。代码修复和格式整理尽量分开审查，不自动提交或推送。

## 完成证据

按 [检查矩阵](guides/CODE_REVIEW_STANDARDS.md#任务检查矩阵) 执行检查，记录命令、实际范围、通过/失败/跳过及未执行原因。检查失败先定位本次新增问题，既有问题给出证据。静态审计、类型检查、构建、行为测试和浏览器/真机验收各有边界，不互相冒充。
