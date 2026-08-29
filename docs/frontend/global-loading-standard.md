# 全局加载动画统一规范

> 最后更新：2026-06-02

## 背景

当前前端同时存在多套 loading 实现：

- `GlobalLoading.vue`：公共全屏 loading 组件，只允许在 `App.vue` 全局挂载一次。
- `InlineLoading.vue`：公共局部 loading 组件，用于表格空行、弹窗内容、按钮内部等局部场景。
- `useLoadingStore`：全局 loading store，路由守卫已调用。
- `useLoadingState()`：大量页面自建 loading 状态。
- Element Plus `v-loading` / `ElLoading.service`：表格、弹窗、API 层零散使用。
- 页面手写 `加载中...`、`正在加载数据...`、自定义 spinner。

这会导致不同页面打开时 loading 样式不一致，也会出现部分页面有动画、部分页面没有动画的问题。

## 统一目标

- 页面切换使用同一套全局 loading。
- 表格、弹窗、上传、提交等局部操作保留局部 loading。
- 不再新增页面级手写 spinner 或 `正在加载数据...` 行。
- 不在业务页面重复挂载 `GlobalLoading`，全局只挂一次。

## 首屏加载与右上角刷新

页面级数据加载统一按下面规则处理：

- 首次进入页面时，可以展示页面、表格或区块的 loading。
- 搜索、筛选、分页、切换 tab 等主动查询，可以继续使用各自区域的局部 loading。
- 页面右上角“刷新”按钮一律走静默刷新：
  - 按钮本身需要显示 `刷新中...` 或按钮级 loading。
  - 页面主体、表格、卡片、图表不要因为这次刷新被清空、闪烁或重新进入首屏 loading。
  - 刷新完成后给出顶部成功提示，失败时给出顶部错误提示。
  - 成功/失败提示不要缺失，也不要只在控制台或局部区域反馈。

推荐实现方式：

- 维护独立的 `refreshing` 状态，不复用页面 `loading`。
- 列表或报表主加载函数增加 `showLoadingState = true` 一类的可选参数。
- 右上角刷新调用静默路径，例如 `loadList(false)`、`refreshCurrentPage({ silent: true })` 或 `refreshSilently()`。
- 如果页面由父组件统一触发刷新，子组件需要暴露静默刷新入口，避免父级刷新重新触发表格 loading。

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

### 1. 页面切换 loading

统一使用：

- `frontend/src/stores/loading.ts`
- `frontend/src/components/GlobalLoading.vue`
- `frontend/src/router/guards.ts`

`GlobalLoading` 应在 `App.vue` 挂载一次。路由守卫负责 `startLoading` / `stopLoading`。

### 2. 局部区域 loading

统一优先使用以下公共组件，不再让页面自己决定 loading 的行高、居中和背景：

- `TableLoadingRow.vue`：列表/表格加载组件，统一行高、居中位置、背景和文案。
- `SectionLoading.vue`：弹窗内容、详情面板、卡片区域等非列表/非表格区域加载块。
- `InlineLoading.vue`：按钮内部、短文本旁、搜索下拉等小范围加载提示。

适用场景：

- 数据表格刷新
- 列表、网格、树形列表刷新
- 弹窗内容加载
- 图片/库存详情加载
- 复杂报表模块局部刷新

局部 loading 不应该覆盖整个应用。

### 3. 按钮 loading

Element Plus 的 `el-button` 统一使用自身的 `:loading` 作为唯一加载动画，并保留业务禁用状态防止重复点击。需要加载文案时，在按钮内部只切换纯文本，不再同时渲染 `InlineLoading`。

原生按钮或不提供内置 loading 动画的自定义按钮，统一使用 `InlineLoading`。

适用场景：

- 新增/编辑提交
- 删除确认后执行
- 导入、导出、同步、备份等长操作

按钮 loading 主要用于防重复点击，按钮内容不要再手写 `fa-spinner fa-spin`。禁止在同一个 `el-button` 中同时使用 `:loading` 和 `InlineLoading`，否则会出现两个加载动画。

## 禁止新增

后续页面不建议新增以下模式：

```vue
<tr v-if="loading">
  <td>正在加载数据...</td>
</tr>
```

原生表格加载行请改用：

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

列表、网格、树形列表加载请优先改用：

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

如确实需要全屏 loading，应通过 `useLoadingStore`；如确实需要局部 loading，应优先使用 `TableLoadingRow`、`SectionLoading` 或 `InlineLoading`。

判断标准：

- `TableLoadingRow`：所有列表/表格加载尽量使用它，包括原生 `<table>`、Element Plus `el-table`、卡片列表、网格列表、菜单树列表。
- `SectionLoading`：只用于非列表/非表格的块级区域，如详情弹窗、权限配置面板、移动端详情页、整块 dashboard 内容。
- `InlineLoading`：只用于按钮、短文本、小范围提示。
- `GlobalLoading`：只用于路由切换或全局长操作，不在业务页面重复挂载。

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
- `frontend/src/components/GlobalLoading.vue` 统一读取 `loadingStore.isLoading`。
- `frontend/src/router/guards.ts` 在页面路径变化时统一启动页面切换 loading。
- 已删除未使用的 `LoadingOverlay.vue`，避免再出现第二套全屏覆盖 loading。
- `BaseButton`、`Image`、`v-tf-loading` 指令已统一到 `InlineLoading`/同款蓝青色 spinner 视觉。
- 已新增 `TableLoadingRow.vue` 和 `SectionLoading.vue`，表格加载中位置和块级加载中位置由公共组件统一控制。

后续如果需要调整页面切换 loading 的视觉效果，优先修改 `GlobalLoading.vue`，不要在业务页面新增全屏 loading。
