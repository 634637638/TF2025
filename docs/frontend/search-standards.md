# 后台列表检索统一规范

## 统一入口

- 后台列表页统一使用 `frontend/src/components/search/UnifiedSearchPanel.vue`。
- 日期范围统一使用 `frontend/src/components/DateRangePicker.vue`，开始和结束日期分别弹出单个面板，并从对应输入框下方展开。
- 单日期、单月份等单值筛选可直接使用 Element Plus `el-date-picker`。
- 页面只负责字段、权限、选项和查询参数，不得自行维护检索面板背景、按钮、展开布局或响应式样式。

## 基础下拉选项排序

品牌、型号、颜色、内存，以及供应商、门店等基础下拉选项统一使用
`frontend/src/utils/option-sort.ts` 的 `sortOptionsByOrder`。公共规则为：

1. 优先使用后台配置的 `sort_order`（兼容 `sortOrder`、`order`）。
2. 排序值相同时按名称自然排序，数字型号按数字顺序比较，例如 `iPhone 11` 位于 `iPhone 12` 之前。
3. 名称仍相同时按 `id` 稳定排序。

内存选项使用 `labelKeys: ['size', 'capacity', 'name']`，保证不同接口字段返回的容量仍按同一规则展示。
页面不得复制 `.sort((a, b) => ...sort_order...)` 或自行实现缺失排序值、名称和 ID 的比较器。品牌联动型号、编辑弹窗、库存/销售/入库/预定、综合查询和 H5 商城均必须复用该入口。

## 基本结构

```vue
<UnifiedSearchPanel
  v-model:expanded="searchExpanded"
  :loading="loading"
  @search="handleSearch"
  @reset="resetFilters"
>
  <template #primary>
    <el-input
      v-model="filters.keyword"
      clearable
      placeholder="请输入关键词"
      @keyup.enter="handleSearch"
    />
  </template>

  <div class="form-group filter-item" data-field="status">
    <el-select v-model="filters.status" clearable placeholder="状态">
      <!-- options -->
    </el-select>
  </div>

  <div class="form-group filter-item filter-item--date-range" data-field="created_at">
    <DateRangePicker
      v-model="createdAtRange"
      value-format="YYYY-MM-DD"
      @change="handleSearch"
    />
  </div>
</UnifiedSearchPanel>
```

日期范围父项必须声明 `filter-item--date-range`。该类由公共检索组件统一控制完整可读宽度：PC 保持单行自适应，iPad 和手机展开后自动换行，手机日期范围占整行。

## 行为要求

- 输入框回车、点击搜索按钮、选择或清除筛选条件，都必须重置到第 1 页后查询。
- 搜索按钮的加载状态统一由 `UnifiedSearchPanel` 的 `loading` 属性控制。
- 自动检索后再次点击搜索按钮仍应重新发起查询。
- 重置必须清空页面维护的所有筛选值、日期范围和级联选项，并回到第 1 页。
- 请求较慢时使用页面现有的最新请求保护，避免旧请求覆盖新筛选结果。

## 边界

以下场景不强制使用后台列表检索面板：

- H5 商城面向顾客的商品筛选和页面内搜索。
- 弹窗内的客户、设备、商品等业务对象搜索。
- 新增、编辑、审批等业务表单中的日期字段。
- 仅用于局部组件内部交互、不会触发列表查询的输入框。

后台商城订单、商品管理等管理页面仍属于后台列表，必须接入公共检索方案。

## 禁止事项

- 禁止新增或恢复 `GlobalSearch.vue`、`CustomSearch.vue`。
- 禁止在页面内复制 `.unified-search-panel*` 样式。
- 禁止在 `UnifiedSearchPanel` 内直接使用 `daterange`、`datetimerange`、`monthrange` 或 `dates` 类型的 `el-date-picker`。
- 禁止仅靠页面私有宽度修复日期显示，应由 `filter-item--date-range` 和公共组件处理。

## 审计

运行：

```bash
cd frontend
npm run check:ui
```

审计会检查旧组件引用、日期范围组件接入、日期筛选宽度标记，以及页面是否覆盖公共结构。

最后更新：2026-09-17
