# 前端代码规范核实版审查报告

## 日期
2026-04-15

## 结论摘要

本报告基于对 `frontend/src` 的实际代码检索与交叉引用结果整理，目标是替代“原始扫描报告”中存在误判的部分，形成可直接执行的整改清单。

核心结论：
- `dev-token` 开发绕过逻辑真实存在，已收紧为“默认禁用，需显式环境开关才允许本地启用”。
- `StockInModal.vue`、`WholesaleModal.vue` 属于超大业务组件，现已完成第一轮拆分收口。
- `menu.js`、`dynamicRouter.js`、`moduleFields.js` 属于真实在用的 JS 文件，可转 TS，但不能误删。
- `auth-protection-simple.js` 当前未发现外部引用，应先确认是否删除，而不是直接转 TS。
- “17 个未使用组件可直接删除”的结论不成立，其中多项已有真实业务引用。
- `useMobile.ts vs mobile.ts 重复` 当前不成立，仓库内只存在 `mobile.ts`。

## 已核实高优先级问题

### 1. 开发环境 `dev-token` 绕过
- 文件：`frontend/src/router/guards.ts`
- 状态：真实，已修复
- 风险：即使原逻辑限制在 `DEV + localhost`，仍属于高风险旁路能力，不应默认存在。
- 当前策略：
  - 默认禁用
  - 仅在 `import.meta.env.DEV === true`
  - 且本地开发主机
  - 且显式设置 `VITE_ENABLE_DEV_TOKEN_BYPASS=true`
  - 才允许启用

### 2. 超大组件
- `frontend/src/components/StockInModal.vue`
  - 实测约 `75 KB`
- `frontend/src/components/WholesaleModal.vue`
  - 实测约 `59 KB`
- 状态：
  - 已完成第一轮模板区块拆分
  - 父组件保留表单状态、校验、接口请求、提交流程
  - 子组件承接基础信息区、手机列表区、客户/供应商信息区、价格汇总区
- 已新增子组件：
  - `frontend/src/components/stock-in/StockInBasicInfoSection.vue`
  - `frontend/src/components/stock-in/StockInPhoneListSection.vue`
  - `frontend/src/components/wholesale/WholesalePartySection.vue`
  - `frontend/src/components/wholesale/WholesalePhoneSummarySection.vue`
- 后续建议：
  - 再拆“扫码/库存查询/提交流程”
  - 继续把局部样式和业务类型抽到更稳定的公共层

### 3. 超大配置文件
- `frontend/src/config/moduleFields.js`
  - 实测约 `117 KB`
- 风险：
  - 权限字段配置过大，修改成本高
  - 不利于按模块维护
- 建议：
  - 按业务模块拆成多个配置文件
  - 后续再迁移为 `ts`

## 已核实中优先级问题

### 1. JS/TS 混用

以下 JS 文件均已确认存在：
- `frontend/src/api/menu.js`
- `frontend/src/config/moduleFields.js`
- `frontend/src/utils/dynamicRouter.js`
- `frontend/src/utils/auth-protection-simple.js`

其中分类如下：

#### 在用，适合迁移到 TS
- `frontend/src/api/menu.js`
- `frontend/src/config/moduleFields.js`
- `frontend/src/utils/dynamicRouter.js`

#### 先确认是否删除
- `frontend/src/utils/auth-protection-simple.js`
  - 当前未发现外部引用
  - 更像候选死代码

### 2. 根目录组件平铺过多
- `frontend/src/components` 根目录当前约 `48` 个 `.vue` 文件
- 结论：
  - 问题真实
  - 但属于结构优化，不是立即 bug
- 建议：
  - 先按 `query/`、`scanner/`、`dashboard/`、`form/`、`inventory/` 分类

### 3. 类型收口不完全
- `DeviceInfo` 存在重复定义
  - 全局定义：`frontend/src/types/index.ts`
  - 局部定义：`frontend/src/utils/scanOptimizer.ts`
- `PaginationState`
  - 当前仅确认主定义位于 `frontend/src/types/index.ts`
  - “多处重复定义”证据不足

## 已核实误判项

### 1. “17 个未使用组件可直接删除”不成立

以下组件已确认存在真实业务引用，不能直接删除：
- `CustomSearch.vue`
- `DraggableRow.vue`
- `IconPicker.vue`
- `ComprehensiveWarnings.vue`
- `PendingApprovals.vue`
- `OptimizedScanner.vue`
- `InventoryResultDialog.vue`
- `PriceMarkupConfig.vue`

以下组件目前仅见 `components.d.ts` 自动注册引用，是否保留需继续逐个确认：
- `GlobalSearch.vue`
- `DraggableList.vue`
- `IconSelector.vue`
- `InventoryWarnings.vue`
- `MemorySelector.vue`
- `ProfessionalScanner.vue`
- `FieldPermissionTable.vue`

### 2. `useMobile.ts vs mobile.ts` 重复不成立
- 当前仓库仅存在：
  - `frontend/src/composables/mobile.ts`
- 未发现：
  - `frontend/src/composables/useMobile.ts`

### 3. “样式重复 `.el-dialog`、`.el-table` 出现在 30+ 文件”未核实
- 当前快速检索未得到足够证据支持该数字
- 需要单独做样式维度审查，不能直接当作已确认结论

## 推荐整改顺序

### 第一阶段
- 收紧或彻底移除 `dev-token` 开发旁路
- 评估并处理 `auth-protection-simple.js` 是否为死代码
- 拆分 `moduleFields.js`

### 第二阶段
- 将 `menu.js`、`dynamicRouter.js` 迁移为 `ts`
- 拆分 `StockInModal.vue`
- 拆分 `WholesaleModal.vue`

### 第三阶段
- 逐个核对“疑似未使用组件”
- 按业务目录重组 `components`
- 收口 `DeviceInfo` 等局部重复类型

## 本次已落地修复

- `frontend/src/router/guards.ts`
  - `dev-token` 默认禁用
  - 只有显式环境变量开关才允许本地开发启用
- `frontend/src/views/auth/LoginViewSimple.vue`
  - 同步清理 `dev-token` 残留逻辑，避免和路由守卫策略不一致
- `frontend/src/api/menu.ts`
  - 已由 `menu.js` 迁移为 TypeScript
  - 补充了 `unifiedApi` 显式导入和基础请求类型
- `frontend/src/utils/dynamicRouter.ts`
  - 已由 `dynamicRouter.js` 迁移为 TypeScript
  - 收口了菜单、动态路由、面包屑等核心类型
- `frontend/src/utils/auth-protection-simple.js`
  - 已删除
  - 原因：当前未发现任何外部入口引用，判定为死代码
- `frontend/src/components/StockInModal.vue`
  - 已完成第一轮拆分
  - 入库信息区、商品列表区已抽离为子组件
  - 父组件显著瘦身，保留核心提交流程
  - 已完成第二轮收口
  - 编辑态接口响应到表单模型的映射已下沉到 `stock-in/helpers.ts`
  - 打开弹窗时的创建态/编辑态初始化已统一走 helper，父组件不再直接拼装编辑表单
  - 已继续下沉扫码与无 IMEI 模式切换逻辑
  - 手动扫码弹窗配置、扫码结果写回、无 IMEI 模式状态切换已转为 helper 纯函数
  - 打开弹窗时的初始化与下拉数据加载已并行执行，减少首屏等待
  - 已继续下沉品牌 ID 解析、品牌查找、型号过滤和价格显示格式化逻辑
  - 父组件中的 `handleBrandChange`、`getFilteredModelsForPhone`、`formatPriceValue` 已进一步收薄
- `frontend/src/components/WholesaleModal.vue`
  - 已完成第一轮拆分
  - 客户/供应商信息区、手机汇总区已抽离为子组件
  - 父组件显著瘦身，保留客户搜索、价格计算、提交逻辑
  - 已完成第二轮收口
  - 可编辑手机列表和采集价初始化已统一走 `wholesale/helpers.ts`
  - 打开弹窗时的供应商/销售员默认值编排已收口
  - 客户搜索已增加请求序号保护，避免旧请求回写新输入结果
  - 已继续下沉日期/价格格式化、错误消息解析和弹窗基础数据加载逻辑
  - 父组件不再分别维护供应商/门店/用户三段加载函数
  - 模式切换时已优先基于原始 `props.phones` 重算，避免二次加工数据叠加
  - 已继续下沉客户搜索重置状态和新客户创建后的表单补丁构建
  - 父组件中的 `selectCustomer`、`autoCreateCustomer`、`resetForm` 已减少重复客户状态赋值
- `frontend/src/components/PublishToH5Modal.vue`
  - 已修复切换商品和关闭弹窗时的上传状态清理不一致问题
  - 已统一通过 `unifiedApi.upload` 处理图片/视频上传，移除裸 `fetch`
  - 已补充待上传 `blob:` 预览地址回收，减少预览 URL 残留
  - 已修复加载全新机或无验机数据商品时旧表单残留风险
  - 已完成第二轮局部拆分
  - 默认验机表单、上传端点/字段名、HEIC 判断、视频素材解析、上传状态回收已下沉到 `publish-to-h5/helpers.ts`
  - 局部上传/素材类型已收口到 `publish-to-h5/types.ts`
  - 已继续下沉文件校验与待上传文件过滤逻辑，减少父组件内重复校验分支
  - 已继续下沉待上传文件增量识别、已移除文件回收、HEIC 转换结果回填、预览列表构建与保存前素材存在性判断
  - 父组件当前主要保留接口调用、上传消息提示和弹窗状态切换，文件编排分支进一步收窄
- `frontend/src/components/query/QuickSaleModal.vue`
  - 已补充客户搜索请求序号保护，避免旧请求覆盖新输入
  - 已统一清理客户搜索定时器与结果状态，减少弹窗关闭后的残留
  - 已移除成功提交后的重复 `resetForm` 调用
  - 已完成第二轮局部拆分
  - 默认表单、客户创建 payload、快速出库 payload、无 IMEI 模式切换、IMEI/序列号格式化已下沉到 `query/quick-sale/helpers.ts`
  - 局部表单/客户/型号类型已收口到 `query/quick-sale/types.ts`
  - 已继续下沉国补备注计算、初始数据映射和型号列表归一化逻辑
  - 已继续下沉客户搜索重置状态、客户选中回填、客户清空补丁和品牌型号列表归一化编排
  - 父组件中的 `handleCustomerPhoneInput`、`selectCustomer`、`createNewCustomer`、`resetForm` 重复状态赋值已明显减少
- `frontend/src/views/attendance/AttendanceView.vue`
  - 已补充关键行操作函数的 `AttendanceTableRow` 类型标注
  - 继续收口事件处理函数的参数类型，减少隐式 `any` 风险
  - 已补充统一的表单默认值、弹窗关闭重置和当前 Tab 刷新入口
  - 团队/个人列表加载后已改为等待待结算统计完成，避免刷新状态与统计状态错位
  - 表单引用和表格展开引用已补充显式类型
  - 已补充休假拆分申请的确认文案、记录创建和成功提示辅助函数，减少超长提交流程分支
  - 已统一对话框取消态判断，避免把 `close/cancel` 误判成提交失败
- `frontend/src/components/stock-in/types.ts`
  - 新增入库弹窗局部类型，收口 `StockInPhoneItem`、`StockInFormModel`
- `frontend/src/components/stock-in/helpers.ts`
  - 新增入库弹窗局部辅助方法
  - 收口默认商品项、创建模式默认表单、编辑模式手机项构造
  - 继续收口 IMEI/序列号/价格处理和入库提交载荷组装
  - 继续收口下拉数据加载、品牌型号加载和本地下拉筛选逻辑
  - 继续收口批量默认商品项创建和商品校验逻辑
  - 已补充直接校验 IMEI/序列号，避免未触发 blur 时带着非法值提交
  - 已补充扫码结果规范化和弹窗关闭状态清理，避免残留搜索关键词与扫码状态
  - 已补充编辑态响应映射与统一初始化入口，减少父组件直接处理接口字段
  - 已补充扫码弹窗配置生成、扫码结果写回和无 IMEI 状态切换函数
  - 已补充品牌 ID 解析、品牌查找、型号列表构建和价格格式化函数
- `frontend/src/components/wholesale/types.ts`
  - 新增批发/划拨弹窗局部类型，收口客户、手机、提交载荷类型
- `frontend/src/components/wholesale/helpers.ts`
  - 新增批发/划拨弹窗局部辅助方法
  - 收口默认表单和提交载荷组装逻辑
  - 继续收口客户搜索结果归一化、采集价匹配、价格初始化、自动创建客户载荷和划拨供应商解析
  - 继续收口客户搜索远程加载、供应商/门店/用户加载逻辑
  - 继续收口客户搜索输入状态、客户选中映射和提交前业务校验逻辑
  - 已补充弹窗重置边界，避免旧手机列表、旧采集价、旧定时器残留
  - 已补充客户自动创建后的搜索缓存刷新，避免刚创建后仍命中旧空缓存
  - 已补充打开弹窗默认表单补丁和手机列表初始化编排，减少父组件 watch 中的重复逻辑
  - 已补充客户搜索请求序号保护，避免旧请求结果覆盖当前输入
  - 已补充统一的价格/日期格式化、错误消息解析与弹窗基础数据加载逻辑
  - 已补充客户搜索状态重置和客户创建成功后的统一回填补丁

## 本轮补充核实与修复

- `StockInModal.vue`
  - 本轮已把品牌解析、品牌查找、型号列表过滤和价格显示格式化继续抽到 helper
  - 父组件不再手动拼装品牌查找和型号列表回退逻辑
- `WholesaleModal.vue`
  - 本轮已把客户搜索重置状态和新客户创建成功后的统一回填补丁继续抽到 helper
  - 父组件中的客户选择、自动创建和重置路径进一步统一
- `PublishToH5Modal.vue`
  - 关闭弹窗和切换 `phoneId` 时，原先只清空待上传数组，未统一回收 `blob:` 预览 URL；现已统一收口到重置函数
  - 上传接口原先直接使用 `fetch`，已改为统一走 `unifiedApi.upload`
  - `previewUrl` 原先可能重复创建对象 URL，现已缓存到文件对象并在删除/重置时释放
  - 父组件中的默认表单、上传端点与素材辅助逻辑已继续下沉，减少组件内重复类型与纯函数堆积
  - 文件合法性校验与待上传列表过滤已继续抽离，后续可再拆 HEIC 转换编排
  - 本轮已把“新文件识别 / 删除文件回收 / HEIC 结果替换 / 预览索引计算 / 是否允许保存”进一步抽到 helper
- `QuickSaleModal.vue`
  - 客户搜索原先只有防抖，没有旧请求回写保护；现已增加请求序号校验
  - 提交成功时原先存在 `resetForm -> handleCancel -> resetForm` 的重复重置，现已去重
  - 弹窗销毁时已补充搜索定时器清理
  - 父组件中的表单默认值、提交载荷和无 IMEI 逻辑已继续下沉，便于后续再拆客户检索与品牌型号加载
  - 国补金额逻辑、初始化 patch 和型号归一化已继续下沉，父组件业务分支进一步收窄
  - 本轮已把客户搜索重置、客户选中表单补丁、客户清空补丁和品牌型号列表构建继续下沉
- `AttendanceView.vue`
  - 审批、删除、撤销、查看等行级操作已显式绑定 `AttendanceTableRow` 类型
  - 新增/提交后的弹窗关闭与数据刷新已统一走公共方法，减少散落的重复状态处理
  - 月休拆分为请假/休假的提交流程已进一步收口，便于下一轮继续拆分到 helper

## 本轮校验结果

- 已执行：
  - `npx tsc -p frontend/tsconfig.json --noEmit --pretty false`
- 结果：
  - 通过
