# 全局技术债务进度

本页主体是 2026-08-28 的进度快照。2026-09-30 只重新核验了样式债务、ESLint 与后端契约测试；其余历史统计须重跑对应审计后才能作为当前状态。

本文件是全局进度的唯一汇总入口。专项数据和处理细节仍记录在各自文档中；汇总状态必须以可重复执行的检查结果为依据。

## 当前状态

| 项目 | 状态 | 当前结果 | 下一步 |
| --- | --- | --- | --- |
| ESLint warning | 已完成 | 2026-10-01：`lint:summary` 与 `lint:strict` 均为 0 errors、0 warnings | 新增代码继续执行 `lint:strict`，避免 warning 回归；见 [ESLint 进度](ESLINT_WARNING_PROGRESS.md) |
| 大型页面拆分 | 进行中 | `SalesView.vue` 已完成，`SalaryView.vue` 已由 8,445 行降至 4,068 行且 TAB、业务弹窗已拆出；`PermissionsView.vue` 已拆出角色、字段、门店绑定和页面权限矩阵，主文件降至 2,642 行；`InventoryView.vue` 已完成统计、全局检索适配层、表格、编辑弹窗、基础资料加载和库存查询数据流拆分，主文件降至 4,313 行；库存和销售内存筛选已修复规范字段解析 | 进入下一个大型业务页面或按专项计划治理库存样式文件 |
| 样式债务 | 样式模块化完成一批，强制声明存量仍待清理 | 2026-10-01 当前审计：1933 个已登记 `!important`，未批准 0 个，非令牌颜色使用点 0 个，超长样式块 60 个；视觉字面量和断点仍有历史存量 | 按级联证据删除冗余强制覆盖，并让令牌/动效/断点存量逐批下降；见 [样式债务进度](STYLE_DEBT_PROGRESS.md) |
| 后端契约测试 | 本地通过（非实时数据库） | 2026-09-30 `backend/npm test`：155 passed、14 skipped、0 failed；跳过项包含需要显式启用的真实数据库测试 | 在目标数据库环境单独运行 `npm run test:db` 并确认测试范围 |
| 前端包体积 | 首屏门槛通过，重型功能保持懒加载 | 2026-10-01 构建报告首屏本地资源约 757 KiB，低于 878.91 KiB 门槛；HEIC、PDF worker、CSV 导出等是懒加载/功能资源，不属于首屏包 | 结合真实功能加载数据再优化懒加载块，不能仅因单个功能块较大就重复拆包 |
| 字段统一和兼容层 | 已完成（兼容层已清零） | 已知历史物理列迁移完成；当前登记 0 个运行时兼容字段、329 个已退役字段、0 个兼容边界；工资、考勤、销售和模板字段均已收敛 | 持续执行登录态业务回归；不得重新引入旧字段，历史退役字段仅保留在审计记录和迁移说明中 |
| 全局空状态 | 公共入口与样式审计已闭环，继续按状态语义接入 | 2026-10-01 清理未引用的 `.empty-state`、`.empty-content`、`.empty-row`、`.empty-text`、`.empty-icon` 等遗留规则；移除公共组件外的空状态包装样式，并将设备无匹配、导入历史空态接入 `DataEmptyState`。`check:empty-states` 已扩展扫描 Vue 模板、内嵌样式及独立 CSS/SCSS，当前通过 | 新增空状态继续执行 `npm run check:empty-states`；`.no-data` 字段占位及权限分配未选择对象引导按规范边界保留 |
| 表单控件统一 | 普通文本和多行文本已统一，持续审计 | 2026-10-04：全量扫描业务 Vue/SCSS/CSS，所有业务 textarea 均使用 `el-input type="textarea"`、固定 `rows` 和 `tf-textarea` 语义 class；公司地址、锁屏提示等短系统文案保持单行 input，备注、库存/销售/综合查询编辑、预警模板备注等短文本统一 `rows=2`，长地址/原因/描述/营销话术按语义保留 `rows>=3`。公共样式仅对 `rows=2` 使用 PC/手机高度令牌，所有文本域只允许垂直手动拉伸；审计已拦截原生 textarea、缺少 `rows`/class、自动高度及页面私有高度/圆角。`check:form-controls` 通过，原生文本框仍限定在专用例外文件，select/date 均为 0 | 继续按语义处理剩余 H5/格式化输入，不机械替换浏览器专用字段；新增备注、说明等字段必须遵守固定高度和垂直手动拉伸规则 |
| 后台表格排序控件 | 本轮已统一 | 公共拖拽行及品牌、门店、型号、供应商、颜色、经验分享列表的排序输入统一为 `el-input-number`，共 7 处；共享尺寸位于 `_table.scss`，`check:form-controls` 防止回退原生排序输入 | 数值输入按范围、精度和编辑行为分别使用 Element Plus 标准控件 |
| 权限管理文本控件 | 本轮已迁移一批 | 角色表单和权限模块管理中的角色名称/编码、模块名称/标识及模块搜索共 7 个普通文本字段改用 `el-input`；只读、必填、搜索回调和字段错误状态保留 | 持续维护表单控件规范与逐字段审计 |
| Loading 入口与例外审计 | 审计已加强，存量例外待逐步迁移 | 2026-10-01 `check:loading` 改用 Vue SFC parser 扫描完整模板；当前计数 `GlobalLoading=1`、`TableLoadingRow=55`、`SectionLoading=32`、`InlineLoading=48`、`v-loading=3`、按钮内联 spinner=26（18 个文件）；Dashboard 和 18 个业务页的刷新按钮及 SalesView 两个提交按钮已迁移到 `el-button :loading`；禁止 `ElLoading.service` 和手写 spinner，并校验例外文件、原因、使用量及过期登记 | 逐步把 3 处 `v-loading` 迁至公共局部组件，把剩余按钮例外改为 `el-button :loading`；每次迁移下调基线，见 [全局 Loading 规范](../frontend/global-loading-standard.md) |

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

## 完成标准

1. “已完成”必须有对应命令、自动测试或真实数据库核验记录。
2. 兼容字段只代表迁移边界，不算统一完成；删除前必须确认仓内和外部调用方均不再使用。
3. 大页面拆分必须保持路由、权限、表单和缓存行为不变，并通过类型检查与生产构建。
4. 样式债务不能机械删除 `!important` 或合并不同语义颜色；第三方结构覆盖必须保留理由。
5. 包体积优化以首屏加载和路由分包结果为依据，不以删除业务依赖作为完成手段。

## 专项记录

- ESLint：[ESLINT_WARNING_PROGRESS.md](./ESLINT_WARNING_PROGRESS.md)
- 样式债务：[STYLE_DEBT_PROGRESS.md](./STYLE_DEBT_PROGRESS.md)
- 字段统一：[../database/field-consistency-progress.md](../database/field-consistency-progress.md)
- 前端响应与大包：[../performance/frontend-response-optimization-2026-06-01.md](../performance/frontend-response-optimization-2026-06-01.md)
