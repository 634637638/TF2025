# 全局加载动画统一规范

> 最后更新：2026-10-07

## 背景

当前前端同时存在多套 loading 实现：

- `GlobalLoading.vue`：公共全屏 loading 组件，只允许在 `App.vue` 全局挂载一次。
- `InlineLoading.vue`：公共局部 loading 组件，用于表格空行、弹窗内容、按钮内部等局部场景。
- `v-tf-loading`：公共区域遮罩指令，用于表格/列表加载时锁定整个区域并显示统一加载提示。
- `useLoadingStore`：全局 loading store，路由守卫已调用。
- `useLoadingStore.hasLocalLoading` / `isGlobalVisible`：公共互斥仲裁状态；表格或列表使用 `v-tf-loading` 时，全局 Loading 立即失去可见状态，避免同一请求同时出现“加载中”和“加载数据中”。
- `useLoadingState()`：大量页面自建 loading 状态。
- Element Plus `v-loading`：少量有明确刷新覆盖需求的表格/配置区域保留登记例外；禁止新增未登记使用。
- `ElLoading.service`：禁止在业务页面新增，全屏使用 `useLoadingStore`，局部使用公共组件。
- 页面手写 `加载中...`、`正在加载数据...`、自定义 spinner。

这会导致不同页面打开时 loading 样式不一致，也会出现部分页面有动画、部分页面没有动画的问题。

## 统一目标

- 页面切换使用同一套全局 loading。
- 统一 Axios 实例默认将请求纳入全局 Loading；只有明确传 `showLoading: false` 的健康检查、静默预取或后台探测可以关闭反馈。
- 首次进入页面或 F5 刷新只显示全局 `GlobalLoading`；首次表格请求不得再启动 `v-tf-loading`。
- 首次数据请求完成后，点击刷新、搜索、筛选或分页才允许启动 `v-tf-loading`；同一次操作只能绑定一种 Loading。
- 表格、弹窗、上传、提交等局部操作保留局部 loading；表格加载必须锁定整个表格区域。
- 不再新增页面级手写 spinner 或 `正在加载数据...` 行。
- 不在业务页面重复挂载 `GlobalLoading`，全局只挂一次。

## 首屏加载与右上角刷新

页面级数据加载统一按下面规则处理：

- 首次进入页面时，可以展示页面、表格或区块的 loading。
- 搜索、筛选、分页、切换 tab 等主动查询，可以继续使用各自区域的局部 loading。
- 页面右上角“刷新”按钮使用局部数据刷新：
  - 按钮本身需要显示 `刷新中...` 或按钮级 loading。
  - 表格或列表只显示边界内的“加载数据中...”，不得显示全屏“加载中”。
  - 页面主体、表格、卡片、图表不要因为这次刷新被清空或闪烁；已有数据刷新时由 `v-tf-loading` 保留数据并锁定交互。
  - 刷新完成后给出顶部成功提示，失败时给出顶部错误提示。
  - 成功/失败提示不要缺失，也不要只在控制台或局部区域反馈。

推荐实现方式：

- 维护独立的 `refreshing` 状态，不复用页面 `loading`。
- 列表或报表主加载函数增加 `showLoadingState = true` 一类的可选参数。
- 右上角刷新通过公共 `useRefreshData` 登记局部 Loading，并调用表格的 `showLoadingState = true` 路径。
- `useRefreshData` 在刷新期间抑制 `GlobalLoading`，因此刷新不会出现全屏“加载中”。
- 如果页面由父组件统一触发刷新，子组件需要暴露局部刷新入口，避免父级刷新改变全屏 Loading 层级。

推荐提示文案：

- 刷新成功：`数据刷新成功`
- 刷新失败：`刷新失败，请重试`

不建议继续混用以下文案：

- `刷新成功`
- `数据已刷新`
- `刷新失败`
- `刷新失败：请稍后重试`

除非页面有非常明确的业务语义差异，否则顶部刷新统一使用同一套提示文案。

## 推荐分层

### 规范与审计标杆页预览

登录 `/standards` 后打开“全局 Loading”规范，点击“演示 Loading”必须触发与生产页面相同的 `useLoadingStore` 全局状态，并由 `App.vue` 中唯一的 `GlobalLoading` 显示全屏遮罩；演示约两秒后自动结束。页面内的 `InlineLoading` 只用于反馈当前演示状态，不得在规范页另行挂载 `GlobalLoading` 或创建第二套全屏实现。

### 1. 页面切换 loading

统一使用：

- `frontend/src/stores/loading.ts`
- `frontend/src/components/GlobalLoading.vue`
- `frontend/src/router/guards.ts`

`GlobalLoading` 应在 `App.vue` 挂载一次。路由守卫负责 `startLoading` / `stopLoading`。

### 2. 局部区域 loading

统一优先使用以下公共组件，不再让页面自己决定 loading 的行高、居中和背景：

- `TableLoadingRow.vue`：列表/表格加载组件，统一行高、居中位置、背景和文案。
- `v-tf-loading`：列表/表格已有数据刷新时的统一遮罩，保留当前数据并阻止表格交互。
- `SectionLoading.vue`：弹窗内容、详情面板、卡片区域等非列表/非表格区域加载块。
- `InlineLoading.vue`：按钮内部、短文本旁、搜索下拉等小范围加载提示。

适用场景：

- 数据表格刷新
- 列表、网格、树形列表刷新
- 弹窗内容加载
- 图片/库存详情加载
- 复杂报表模块局部刷新

表格加载的统一行为：

- `v-tf-loading` 首次绑定为 `true` 时只登记首次加载状态，不显示局部遮罩；首次请求完成后再次从 `false` 进入 `true` 才显示表格刷新遮罩。
- 首次页面加载由路由/统一 API 请求的 `GlobalLoading` 负责反馈；即使页面的表格状态先变为 `true`，也不得抢占或叠加全局层。
- 手动刷新、搜索、筛选和分页进入 `true` 时，表格指令显示“加载数据中...”并锁定表格；全局 Loading 不得同时显示。
- 请求开始后保留当前表格数据，不再用 `loading ? [] : data` 清空表格制造单独的加载块。
- 在表格根节点或仅包住表格的公共容器使用 `v-tf-loading="loading"`，遮罩只覆盖表头和数据区，锁定点击、选择和排序；不得把指令挂在页面根节点、搜索区或统计区。
- 首次加载没有数据时，仍由遮罩显示“加载数据中...”；请求结束后再显示统一空状态。
- `TableLoadingRow` 只作为原生表格或 Element Plus 空容器的兜底结构，不再作为已有数据刷新时的主视觉。表格已有数据刷新时必须保留数据，由 `v-tf-loading` 在表格边界内显示统一提示，不得显示覆盖页面的大块加载占位。
- 同一个表格不得同时显示 `v-tf-loading` 和 `TableLoadingRow mode="block"` 两套提示；`v-tf-loading` 生效时仅保留遮罩提示，`TableLoadingRow` 仅作为无数据时的兜底。表格兜底组件会将历史“加载中...”统一归一为“加载数据中...”。
- `v-tf-loading` 挂载期间会登记局部 Loading；`GlobalLoading` 必须尊重该状态，不得在局部表格遮罩存在时再次显示全屏“加载中”。
- 局部 Loading 开始时必须立即取消全屏 Loading 的状态、等待和离场过渡；同一次刷新不可在任何时刻同时显示“加载中”和“加载数据中”两层提示。局部 Loading 结束后不自动恢复被抑制的全屏层。

局部 loading 不应该覆盖整个应用。

### 3. 按钮 loading

Element Plus 的 `el-button` 统一使用自身的 `:loading` 作为唯一加载动画，并保留业务禁用状态防止重复点击。需要加载文案时，在按钮内部只切换纯文本，不再同时渲染 `InlineLoading`。

原生按钮或不提供内置 loading 动画的自定义按钮，统一使用 `InlineLoading`。

适用场景：

- 新增/编辑提交
- 删除确认后执行
- 导入、导出、同步、备份等长操作

按钮 loading 主要用于防重复点击，按钮内容不要再手写 `fa-spinner fa-spin`。禁止在同一个 `el-button` 中同时使用 `:loading` 和 `InlineLoading`，否则会出现两个加载动画。

存量迁移按 `frontend/scripts/check-loading-patterns.mjs` 中逐文件例外清单跟踪。例外数量只能下降，不能因重建基线增加；迁移后必须删除对应登记。Dashboard 及 18 个业务页的刷新按钮已改用 `el-button :loading`。页面按钮不得再在 Element Plus 按钮内部嵌套 `InlineLoading`。

## 禁止新增

后续页面不建议新增以下模式：

```vue
<tr v-if="loading">
  <td>正在加载数据...</td>
</tr>
```

原生表格空容器加载行请改用：

```vue
<TableLoadingRow v-if="loading" :colspan="visibleColumnCount" />
```

Element Plus `el-table` 空状态请改用：

```vue
<template #empty>
  <TableLoadingRow v-if="loading" mode="block" text="加载中..." />
  <DataEmptyState v-else description="暂无数据" />
</template>
```

列表、网格、树形列表首次无数据加载请优先改用：

```vue
<TableLoadingRow v-if="loading" mode="block" text="加载中..." />
```

```vue
<div class="loading-spinner">加载中...</div>
```

非列表、非表格区域请改用：

```vue
<SectionLoading v-if="loading" />
```

```ts
ElLoading.service({ text: '加载中...' })
```

如确实需要全屏 loading（页面切换或明确的全局操作），应通过 `useLoadingStore`；普通列表、筛选、分页刷新禁止调用它，应优先使用 `v-tf-loading` 锁定表格边界。非表格局部 loading 才使用 `TableLoadingRow`、`SectionLoading` 或 `InlineLoading`。

表格区域刷新使用公共遮罩：

```vue
<el-table
  v-tf-loading="loading"
  :data="rows"
>
  <template #empty>
    <DataEmptyState
      v-if="!loading"
      description="暂无数据"
    />
  </template>
</el-table>
```

判断标准：

- `TableLoadingRow`：所有列表/表格加载尽量使用它，包括原生 `<table>`、Element Plus `el-table`、卡片列表、网格列表、菜单树列表。
- `SectionLoading`：只用于非列表/非表格的块级区域，如详情弹窗、权限配置面板、移动端详情页、整块 dashboard 内容。
- `InlineLoading`：只用于按钮、短文本、小范围提示。
- `GlobalLoading`：只用于路由切换或全局长操作，不在业务页面重复挂载。

规范与审计标杆页必须提供“演示 Loading”按钮，通过统一 Loading Store 触发真实全局遮罩；不能只用静态标签表示“加载中”。

原生按钮或自定义按钮内 loading 建议使用：

```vue
<InlineLoading text="保存中..." size="small" variant="inherit" />
```

Element Plus 按钮统一使用：

```vue
<el-button :loading="saving" :disabled="saving" @click="handleSave">
  {{ saving ? '保存中...' : '保存' }}
</el-button>
```

## 迁移计划

### 第一阶段：统一全局入口（已实施）

- 在 `App.vue` 全局挂载 `GlobalLoading`。
- 优化 `GlobalLoading` 样式，作为全站页面切换 loading。
- 调整路由守卫，让页面切换统一触发。

### 第二阶段：清理重复页面级 loading（已实施一部分）

已移除业务页面中重复挂载的 `GlobalLoading`，页面切换 loading 统一交给 `App.vue`。

后续继续逐步移除页面中手写的：

- `正在加载数据...`
- `加载中...`
- 自定义 spinner
- 页面内重复挂载的 `GlobalLoading`（禁止新增）

### 第三阶段：规范局部 loading

- 列表/表格加载统一使用 `TableLoadingRow`，不要在各页面手写 `<tr class="loading-row">` 或大块 `加载中...`。
- 原生表格使用 `TableLoadingRow` 默认 `mode="row"`；`el-table #empty`、列表、网格、树形列表使用 `mode="block"`。
- 弹窗详情、权限配置、移动端详情、dashboard 等非列表/非表格块级加载统一使用 `SectionLoading`。
- 搜索下拉、移动端加载更多、按钮内部等小范围加载统一使用 `InlineLoading`。
- 按钮提交可保留 `:loading`，按钮内部加载视觉统一用 `InlineLoading variant="inherit"`。

### 第四阶段：列表/表格加载统一（已实施）

已完成以下结构统一：

- 新增 `TableLoadingRow mode="block"`，兼容 Element Plus `el-table #empty`、列表、网格、菜单树等非 `<tr>` 容器。
- 桌面表格空状态不再使用 `SectionLoading`，统一改为 `TableLoadingRow mode="block"`。
- 公共表格入口 `PaginatedTable`、`MobileTable` 桌面表格、错误日志表格已统一使用 `TableLoadingRow`。
- 公共表格入口和业务页面表格均使用 `v-tf-loading` 整表遮罩；刷新时保留当前数据，遮罩覆盖表头与数据区并阻止交互。
- 国补列表、销售网格/库存汇总、H5 模板列表、H5 已售商品列表、菜单树、员工角色列表等列表型加载已统一使用 `TableLoadingRow mode="block"`。
- `SectionLoading` 仅保留在详情弹窗、权限配置面板、移动端详情页、dashboard 整块内容、移动端卡片式列表等非桌面表格场景。

## 当前已处理页面

基础资料页面已去除页面打开时的本地 loading 行：

- 品牌
- 型号
- 颜色
- 内存

这些页面后续页面切换 loading 交给全局入口处理。

以下页面已从业务内 `GlobalLoading` 替换为局部 `InlineLoading`：

- 综合查询
- 配件管理
- 销售管理
- 门店绑定
- 角色权限

以下场景已继续统一到 `InlineLoading` 或全局 loading store：

- 供应商、门店、员工、菜单管理、权限日志、角色、用户角色、模块管理等后台页面的局部加载。
- 国补列表、图片预览、货款结算、综合查询、销售客户搜索等弹窗/下拉加载。
- H5 商品列表、商品详情、智能商品详情、H5 已售商品等移动端加载。
- 价格查询公开页、销售价格展示页的查询和生成图片加载。
- 数据优化页原 `ElLoading.service` 长操作已改为 `useLoadingStore`，统一走 `GlobalLoading`。
- 按钮内手写 `fa-spinner fa-spin` 已统一替换为 `InlineLoading`，按钮颜色通过 `variant="inherit"` 自动继承。

## 当前全局入口

已完成：

- `frontend/src/App.vue` 全局挂载 `GlobalLoading`。
- `frontend/src/components/GlobalLoading.vue` 统一读取 `loadingStore.isGlobalVisible`，并在局部 Loading 出现时取消等待和离场过渡。
- `frontend/src/router/guards.ts` 在页面路径变化时统一启动页面切换 loading。
- 已删除未使用的 `LoadingOverlay.vue`，避免再出现第二套全屏覆盖 loading。
- `BaseButton` 已移除；`Image` 组件和 `v-tf-loading` 指令继续使用统一的蓝青色 spinner 视觉。
- 已新增 `TableLoadingRow.vue` 和 `SectionLoading.vue`，表格加载中位置和块级加载中位置由公共组件统一控制。

后续如果需要调整页面切换 loading 的视觉效果，优先修改 `GlobalLoading.vue`，不要在业务页面新增全屏 loading。

## Loading 审计（2026-10-07）

执行 `cd frontend && npm run check:loading`。审计使用 `@vue/compiler-sfc` 读取完整 Vue 模板，避免 `<template #empty>` 等嵌套模板导致扫描提前结束；Vue SFC 解析失败时检查失败。

最近一次扫描计数（组件模板中的使用点；`v-tf-loading` 单独按使用文件数统计）：

| 项目 | 当前计数 | 审计策略 |
| --- | ---: | --- |
| `GlobalLoading` | 1 | 必须且只能由 `App.vue` 挂载 |
| `TableLoadingRow` | 56 | 统计使用点；`PaginatedTable`、`MobileTable` 必须接入 |
| `v-tf-loading` | 48 个文件 | 表格/列表整区加载遮罩；只锁定表格边界并显示“加载数据中...” |
| `SectionLoading` | 32 | 统计使用点 |
| `InlineLoading` | 46 | 统计使用点 |
| `v-loading` | 1 | 仅允许脚本内逐文件登记且写明原因的非表格区块例外，不得增加 |
| `el-button` 内联 spinner | 26，分布于 18 个文件 | 仅允许登记文件内存量；不得新增或超过文件上限。迁移时使用 `el-button :loading` 并下调上限 |
| `ElLoading.service` | 0 | 禁止使用 |
| 模板手写 spinner / `.loading-spinner` 样式 | 0 | 禁止新增 |

逐文件审计范围：128 个页面/功能单元、71 个公共组件和 1 个应用入口。审计命令会解析每个 Vue SFC 的模板和脚本，检查全局挂载、异步请求、表格遮罩、空状态兜底、区块/按钮 Loading、`v-loading` 例外以及全局 Loading 触发点；当前全部通过。异步请求默认由统一 API 的全局 Loading 入口覆盖，页面不需要重复创建私有全屏实现。

逐页核对结论（2026-10-07）：

- `views/**/*.vue` 共 128 个、公共组件共 71 个，均纳入 `check:loading`；其中 61 个文件包含异步请求，全部使用统一 API 默认 Loading、公共局部 Loading 或已登记的父子组件承载关系。
- `H5-mobile/H5-mobileView.vue`、`H5-mobile/page/OrderSuccess.vue`、`system/page/SimpleAdminView.vue` 的首屏配置、订单或菜单请求由统一 API 的 `GlobalLoading` 承载，不再在布局内重复挂载 Loading。
- `components/ComprehensiveWarnings.vue`、`components/PendingApprovals.vue` 的仪表盘数据请求绑定到根区域 `v-tf-loading`；首次请求仍由全局层反馈，后续刷新只锁定组件区域。
- `analytics/page/ProfitAnalytics.vue` 的 Loading 状态由 `AnalyticsView.vue` 统一传入和回收；`permissions/page/ModulesPage.vue` 的数据请求由 `ModuleManagementView.vue` 承载；`data-optimization/DataOptimizationView.vue` 的子 Tab 各自承载局部 Loading。
- `subsidy/components/SubsidyDetailDialog.vue` 的详情请求使用弹窗内 `SectionLoading`，并显式关闭全局层，避免打开详情时同时出现全屏和弹窗两套提示。
- 营销页天气、地理位置和媒体读取属于按钮、地图或预览范围，继续使用对应按钮状态或浏览器读取反馈，不作为页面首屏数据 Loading。

以上页面不是“没有 Loading”，而是按首次进入、区域刷新、父子组件委托和局部操作分别使用统一入口；后续新增页面如果既没有统一 API 默认 Loading，也没有 `v-tf-loading`、`TableLoadingRow`、`SectionLoading`、`InlineLoading` 或父级承载登记，`check:loading` 必须失败。后台轮询类请求必须显式 `showLoading: false`，不得在用户无操作时触发全屏 Loading。

全屏 Loading 触发例外只有两类：规范页真实演示，以及数据优化页清理、批量合并和删除等明确长操作。数据优化页虽然同时包含表格局部 Loading 和全局长操作入口，但它们属于互斥的不同用户操作，已在 `frontend/scripts/check-loading-patterns.mjs` 中登记原因和数量；普通查询、刷新、筛选和分页不得触发全屏 Loading。

例外登记位于 `frontend/scripts/check-loading-patterns.mjs`。审计会校验例外文件存在、当前仍有实际用量、原因已登记以及用量不超过上限；清理最后一处用量后必须删除例外登记。一个文件的按钮例外上限是可减少的债务上限，不是允许新增的额度。

该静态审计可验证公共入口、已知重复 spinner 和登记例外，但不能仅凭组件名判断每个业务页面是否选对了加载粒度，也不替代交互回归。新页面仍需按“页面切换、表格/列表、区块/弹窗、提交按钮”分别检查；一个操作只能呈现一个清晰的加载反馈。
