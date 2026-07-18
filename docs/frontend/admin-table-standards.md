# 后台卡片与表格统一规范

> 状态：强制执行  
> 视觉基准：综合查询 `/query`  
> 适用范围：后台管理页面的页面留白、统计卡片、搜索卡片、列表卡片和数据表格

## 1. 目标

后台页面的卡片间距、圆角、背景、表格字体、行高、表头颜色和操作按钮必须由公共样式统一控制。业务页面只负责字段、权限、数据格式、徽章颜色和业务操作，不得复制一套通用表格 CSS。

新增页面和升级现有页面时，先按本文接入公共结构；需要调整全站视觉时，只修改公共变量，不逐页修改。

## 2. 唯一公共入口

| 文件 | 职责 | 是否允许页面复制 |
| --- | --- | --- |
| `frontend/src/styles.scss` | 基础主题、字体和全局基础变量 | 否 |
| `frontend/src/styles/admin-layout.css` | 后台页面、卡片、标题、表格和操作按钮的视觉变量与公共 class | 否 |
| `frontend/src/styles/components/_table.scss` | Element Plus 表格内部结构，所有视觉值读取 `--admin-data-table-*` | 否 |
| `frontend/src/styles/responsive.scss` | 手机端布局与滚动行为，继续读取公共变量 | 否 |
| 业务页面 `<style scoped>` | 业务字段、状态徽章、金额、IMEI、特殊交互 | 是，但不得覆盖通用视觉 |

`admin-layout.css` 已由 `frontend/src/main.ts` 全局加载，页面不需要再次导入。

## 3. 标准页面结构

页面根节点、内容区、统计卡片和表格卡片使用以下 class：

```vue
<div class="module-view admin-page">
  <PageHeader icon="fas fa-list" title="页面标题" />

  <div class="content admin-page-content">
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-icon"><i class="fas fa-box" /></div>
        <div class="stat-content">
          <div class="stat-value">100</div>
          <div class="stat-label">统计名称</div>
        </div>
      </div>
    </div>

    <UnifiedSearchPanel />

    <div class="table-section admin-panel admin-table-panel">
      <div class="section-title">
        <i class="fas fa-list" />
        列表名称
        <span class="record-count">共 {{ total }} 条记录</span>
      </div>

      <div class="table-responsive">
        <!-- 标准表格 -->
      </div>
    </div>
  </div>
</div>
```

不得使用页面私有的 `section-header + table-info` 重新实现标题行。记录数统一放在 `.section-title` 内的 `.record-count`。

## 4. 标准表格结构

后台数据列表优先使用 Element Plus `el-table`。综合查询和库存管理是当前参考实现。

```vue
<el-table
  :data="loading ? [] : rows"
  border
  stripe
  class="data-table devices-table"
  table-layout="fixed"
  :fit="true"
  row-key="id"
>
  <el-table-column
    v-for="column in columns"
    :key="column.key"
    :label="column.label"
    :min-width="getColumnMinWidth(column)"
    align="center"
  >
    <template #default="{ row }">
      {{ getCellValue(row, column) }}
    </template>
  </el-table-column>

  <template #empty>
    <TableLoadingRow v-if="loading" mode="block" text="加载中..." />
    <div v-else class="empty-state">暂无数据</div>
  </template>
</el-table>
```

列宽由页面脚本中的字段映射控制，因为列宽属于字段语义，不属于视觉主题：

```ts
const columnWidths: Record<string, number> = {
  model: 104,
  serial_number: 132,
  actions: 238
}

const getColumnMinWidth = (column: { key: string }) => {
  return columnWidths[column.key] || 96
}
```

普通字段需要按内容减少空白时使用 `getTextColumnMinWidth`；序列号、IMEI、业务单号等必须完整显示的标识字段统一使用 `getIdentifierColumnMinWidth` 和 `identifier-column`。工具会按当前页最长内容计算最小宽度；字段少时由 Element Plus 的 `fit` 自动分配剩余宽度铺满表格，空间不足时由表格内部横向滑动。不得让不同单元格按内容使用不同字号：

```ts
import { getIdentifierColumnMinWidth } from '@/utils/table-layout'

const serialWidth = getIdentifierColumnMinWidth(
  ['序列号', ...rows.value.map(row => row.serial_number)],
  { minWidth: 156, horizontalPadding: 40 }
)
```

```vue
<el-table-column
  label="序列号"
  :min-width="serialWidth"
  class-name="identifier-column"
/>
```

禁止使用 `th:nth-child()` 或 `td:nth-child()` 控制列宽。字段权限或响应式列变化后，序号选择器会对应到错误字段。

## 5. 全局变量

所有统一调整在 `frontend/src/styles/admin-layout.css` 的 `:root` 中完成。

| 调整内容 | 变量 |
| --- | --- |
| 页面左右和上下留白 | `--admin-page-gap-*`、`--admin-page-padding-*` |
| 页面卡片之间的距离 | `--admin-panel-gap` |
| 普通卡片内边距与圆角 | `--admin-panel-padding`、`--admin-panel-radius` |
| 搜索卡片内边距 | `--admin-search-panel-padding-*` |
| 表格卡片内边距、背景、边框、阴影 | `--admin-table-panel-*` |
| 统计卡片间距、内边距、背景、边框、阴影 | `--admin-stats-grid-gap`、`--admin-stat-card-*` |
| 统计图标、数值、标签 | `--admin-stat-icon-*`、`--admin-stat-value-*`、`--admin-stat-label-*` |
| 列表标题和记录数 | `--admin-section-title-*`、`--admin-record-count-*` |
| 表格圆角和容器边框 | `--admin-data-table-radius`、`--admin-data-table-container-*` |
| 表头颜色、字体、内边距 | `--admin-data-table-header-*` |
| 单元格字体、颜色、内边距、行高 | `--admin-data-table-cell-*`、`--admin-data-table-line-height` |
| 表头高度、数据行高度 | `--admin-data-table-header-height`、`--admin-data-table-row-height` |
| 斑马纹、悬停、选中颜色 | `--admin-data-table-row-*` |
| 操作按钮尺寸、字体、间距、圆角 | `--admin-data-table-action-*` |
| 表格状态徽章内边距与圆角 | `--admin-data-table-badge-*` |

桌面端变量定义在默认 `:root`，手机端统一覆盖放在 `@media (max-width: 768px)` 内。不要为 `320px`、`360px`、`375px`、`390px` 或 `430px` 分别创建表格字号。

## 6. 手机端规则

1. 统计卡片固定为每行两张，使用 `repeat(2, minmax(0, 1fr))`；包括基础资料页在内，不得被桌面端 `auto-fit` 或最小列宽覆盖。卡片间距、内边距和字号继续读取 `--admin-stats-*`、`--admin-stat-*` 公共变量。
2. 表头和内容必须由同一个 Element Plus 表格滚动容器驱动，横向移动时保持同步。
3. 可滑动时隐藏可见滚动条，不增加独立的“左右拉动条”。
   该规则同时适用于PC和手机；桌面端继续支持触控板、Shift + 滚轮等横向浏览方式。
4. 普通页面按业务优先级减少手机端列数，表格宽度保持在页面卡片内。
5. 手机端正文统一读取 `--mobile-text-table`，表头读取 `--mobile-text-table-header`。当前普通手机均为 `13px`，`375px` 及以下均为 `11px`。表格内的 `span` 必须继承单元格字号，不能被通用正文样式放大；禁止 `clamp(...vw...)`、小于公共字号的像素值或按机型连续缩放字体。
6. 手机端双击打开详情时，使用两次 `row-click` 模拟；必须忽略按钮、链接和表单控件，防止误触。
7. 操作按钮统一使用 `.action-buttons` 和 `el-button size="small"`，按钮点击必须添加 `.stop`。

### 打款页特殊规则

`/payments` 需要保留多个业务字段，因此手机端允许横向滑动查看更多列。它仍必须满足：

- 表头与内容同步移动；
- 仅有一个实际横向滚动区域；
- 可见滚动条隐藏；
- 操作按钮背景完整，按钮文字不得被裁切；
- 特殊规则只挂在打款页专属 class 上，不修改其他页面的全局行为。

批量打款、单台打款和打款详情三个弹窗统一使用内容自适应列宽：先根据弹窗当前数据计算各列紧凑最小宽度，再由 Element Plus 分配剩余空间填满整行。弹窗表格不得继承主列表的 `1200px` 最小宽度；字段过多时保留同步横向滑动并隐藏可见滚动条。主列表仍按多字段查看规则保留横向滑动。

手机端“打款批次详情”的摘要使用无外层卡片的信息网格：普通手机每行两张卡片，较宽手机和平板每行四张卡片。长内容在卡片内自然换行，不得通过横跨整行制造单卡空白。每个字段使用语义 class 和图标，不得依赖 `nth-child` 着色，避免字段权限变化后样式错位。

### 销售对库汇总表特殊规则

`/sales` 的主列表、“对库”汇总和库存详情列表全部使用 `el-table.data-table.devices-table`，不得保留原生数据表格。“对库”保存图片时截取 Element Plus 表格外层容器，并同步处理其独立的表头、内容 `table`；截图兼容逻辑不得改变页面显示时的公共字体、行高或滚动规则。

“对库”库存详情弹窗不继承后台主列表的 `1200px` 最小宽度。各列先根据当前内容计算紧凑的最小宽度，再由 Element Plus 分配剩余空间填满整行，避免尾部空白或过度拉伸。字段总宽度超过弹窗时仍允许表头和内容同步横向滑动，但隐藏可见滚动条。

### 基础资料页规则

品牌 `/brands`、型号 `/models`、颜色 `/colors`、内存 `/memories`、门店 `/stores`、供应商 `/suppliers`、员工 `/employees`、客户 `/customers`、配件 `/accessories` 的根节点必须同时使用 `.admin-page.admin-unified-base-data-page`，主列表统一使用 `el-table.data-table.devices-table.base-data-table`。

- PC 端排序统一使用 `useElementTableSortable` 和 `.drag-handle`，页面只实现排序后的业务保存；不得再实现原生 `dragstart/drop` 排序。
- 手机端不显示排序、创建时间和常驻操作列；连续两次点击同一行后展开编辑、删除操作，展开列箭头及其占位由公共样式隐藏。
- 品牌名称、型号、颜色预览、内存规格和存储大小均保持单行。可见字段总宽度超过卡片时，使用 Element Plus 内部滚动容器同步移动表头和内容，并隐藏可见滚动条。
- 字段较少时保留 `fit`，由 Element Plus 分配剩余宽度填满表格；不得通过页面私有字号缩放填空。
- 基础资料页手机列宽采用与综合查询相同的紧凑基准；内容长度不固定的字段使用 `getTextColumnMinWidth` 计算，确保完整显示后再决定是否产生横向滑动。
- 统计卡片、页面背景、卡片间距和状态徽章尺寸全部读取 `admin-layout.css` 公共变量。页面只保留启用、禁用、预览色等业务语义颜色。
- 禁止使用页面私有 `nth-child` 列宽。权限导致列增减时，每个字段仍必须使用自身的 `width/min-width`。

门店页负责人字段使用 `/stores/managers` 提供的在职员工选项，不依赖 `employee:view`。选择负责人后，联系电话取员工资料中的联系方式；前端负责即时联动展示，后端保存时必须再次校验员工状态并以员工联系方式为准。未选择负责人时才允许单独填写门店联系电话。

客户页手机主列表优先显示会员号、姓名和手机号，列宽按当前页内容通过 `getIdentifierColumnMinWidth` / `getTextColumnMinWidth` 计算；常规内容尽量一屏铺满，遇到长会员号时允许表格内部同步横向滑动，禁止用省略号或私有小字号替代完整内容。编辑、详情、删除操作通过连续两次点击同一行展开。客户详情的购买记录也必须使用 Element Plus 表格，IMEI 和序列号按当前记录计算紧凑最小宽度。

配件页手机主列表优先显示配件名称、分类、剩余库存和状态，不再维护独立卡片视图。名称和分类按当前页内容计算最小宽度，连续两次点击同一行展开详情、编辑、删除操作；PC 端保留价格、毛利和完整库存字段。

维修页 `/repairs` 的统计卡片、搜索区、主列表和分页全部接入公共结构。手机主列表保留完整维修单号、客户、手机型号和维修状态，连续两次点击同一行展开现有操作；新增维修单弹窗使用 Element Plus 表单控件，不得重新引入原生输入框和私有表格样式。

薪资页 `/salary` 的工资模板、员工工资、工资计算和工资发放四个 Tab 使用同一套 Element Plus 公共表格结构。手机端保留完整业务字段并通过表格内部横向滚动查看，操作通过连续两次点击同一行展开，不得维护独立手机表格或固定右侧操作列。四个 Tab 均使用标准列表标题、记录数和统一分页。

薪资销售明细弹窗使用内容驱动的紧凑列宽：型号、IMEI 和客户按当前两张明细表的数据计算宽度，颜色、金额、利润和时间使用固定语义宽度；弹窗宽度随列宽总和自适应。IMEI 仅使用等宽文本，不得添加背景、边框、圆角或悬停缩放。

### 预订管理页规则

预订管理 `/preorders` 的新增预订、已预订、已交付三个 Tab 均使用 `el-table.data-table.devices-table.base-data-table`，并放入各自的 `.table-responsive`。预订业务字段较多，手机端保留横向滑动，不得隐藏业务列或缩小公共字号；表头和内容必须同步移动。

预定单号和 IMEI 使用 `getIdentifierColumnMinWidth` 按三个 Tab 当前数据共同计算，保证完整显示。手机端连续两次点击同一行展开当前状态可执行的操作，不显示展开箭头；页面不得保留第二个横向滚动区域或页面私有表格字号。

## 7. 允许与禁止

业务页面允许定义：状态/机况徽章颜色、金额强调、IMEI 与序列号的等宽字体、字段专属基础宽度、业务按钮显隐、移动端展示哪些字段。关键标识的实际宽度必须通过公共 `getIdentifierColumnMinWidth` 计算。

业务页面禁止定义：

- `.table-responsive` 的通用边框、圆角、阴影和滚动方式；
- `.data-table`、`th`、`td` 的通用字体、内边距、行高、背景和边框；
- `.stats-cards`、`.stat-card` 的通用布局、间距、内边距和圆角；
- `.section-title`、`.record-count` 的通用字体和间距；
- `.action-buttons .el-button` 的通用尺寸；
- 按设备宽度复制多套表格 CSS；
- 使用 `nth-child` 绑定业务字段。

## 8. 新增或升级检查清单

- 页面根节点有 `.admin-page`，内容区有 `.admin-page-content`。
- 手机端统计卡片始终每行两张，`320px` 至 `768px` 不允许退化成单列。
- 搜索使用 `UnifiedSearchPanel`，列表卡片使用 `.admin-panel.admin-table-panel`。
- 列表标题使用 `.section-title` 和 `.record-count`。
- 数据列表优先使用 `el-table.data-table.devices-table`。
- 加载状态使用 `TableLoadingRow mode="block"`，无数据使用 `empty-state`。
- 本地样式只剩业务字段样式，没有通用表格或卡片覆盖。
- 手机端表头与内容同步，页面没有额外横向拉动条。
- 检查 `360px`、`390px`、`430px`、`768px` 和桌面宽度。
- 运行前端生产构建，确认 Vue、TypeScript 模板和 SCSS 均可编译。

## 9. 当前参考页面

- 综合查询：`frontend/src/views/query/QueryView.vue`
- 库存管理：`frontend/src/views/inventory/InventoryView.vue`
- 销售管理主列表、对库汇总和库存详情：`frontend/src/views/sales/SalesView.vue`
- 打款特殊表格：`frontend/src/views/payments/SupplierPhonePaymentsView.vue`
- 报价管理：`frontend/src/views/price-list/PriceListView.vue`
- 品牌管理：`frontend/src/views/brands/BrandsView.vue`
- 型号管理：`frontend/src/views/models/ModelsView.vue`
- 颜色管理：`frontend/src/views/colors/ColorsView.vue`
- 内存管理：`frontend/src/views/memories/MemoriesView.vue`
- 门店管理：`frontend/src/views/stores/StoresView.vue`
- 供应商管理：`frontend/src/views/suppliers/SuppliersView.vue`
- 预订管理：`frontend/src/views/preorders/PreordersView.vue`
- 员工管理：`frontend/src/views/employees/EmployeesView.vue`
- 客户管理：`frontend/src/views/customers/CustomersView.vue`
- 配件管理：`frontend/src/views/accessories/AccessoriesView.vue`
- 维修管理：`frontend/src/views/repairs/RepairsView.vue`
- 薪资管理：`frontend/src/views/salary/SalaryView.vue`

发生冲突时，以本文、`admin-layout.css` 公共变量和综合查询页面结构为准。
