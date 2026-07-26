# 后台卡片与表格统一规范

> 状态：强制执行  
> 视觉基准：综合查询 `/query`  
> 适用范围：后台管理页面的页面留白、统计卡片、搜索卡片、列表卡片和数据表格

## 1. 目标

后台页面的卡片间距、圆角、背景、表格字体、行高、表头颜色和操作按钮必须由公共样式统一控制。业务页面只负责字段、权限、数据格式、徽章颜色和业务操作，不得复制一套通用表格 CSS。

PC 端公共表头使用 `38px` 高度和 `6px` 上下内边距，由 `admin-layout.css` 的 `--admin-data-table-header-height`、`--admin-data-table-header-padding-y` 统一控制。页面不得用私有样式重新放大表头。表头和内容默认居中对齐；公共 `.cell` 同时使用 `text-align: center` 和 Flex 的 `justify-content: center`，带图标、徽章或自定义容器的内容也必须居中。业务语义明确要求左对齐或右对齐时，必须在同一 `el-table-column` 上同时设置 `align` 与 `header-align`，避免表头和内容错位。

表格行状态统一使用三级识别：鼠标悬停为柔和的薰衣草紫 `--admin-data-table-row-hover-bg`，并使用 `--admin-interactive-hover-border` 与 `--admin-interactive-hover-shadow` 在整行显示和经验分享卡片一致的灰蓝外包围；Element 表格必须同时支持 `:hover` 与 `.hover-row`，确保鼠标位于任意字段、操作按钮或固定列时外包围持续显示，且不得通过移动整行制造悬停闪烁。勾选行为蓝色 `--admin-data-table-row-selected-bg` 并在首列显示 `--admin-data-table-row-selected-accent` 左侧强调线；勾选行再次悬停使用更深的 `--admin-data-table-row-selected-hover-bg`。悬停与勾选使用不同层次，业务页面只添加 `row-selected`，不得自行覆盖这套状态颜色或逐个单元格添加悬停阴影。

新增页面和升级现有页面时，先按本文接入公共结构；需要调整全站视觉时，只修改公共变量，不逐页修改。

## 2. 唯一公共入口

| 文件 | 职责 | 是否允许页面复制 |
| --- | --- | --- |
| `frontend/src/styles.scss` | 基础主题、字体和全局基础变量 | 否 |
| `frontend/src/styles/admin-layout.css` | 后台页面、卡片、标题、表格和操作按钮的视觉变量与公共 class | 否 |
| `frontend/src/styles/components/_table.scss` | Element Plus 表格内部结构，所有视觉值读取 `--admin-data-table-*` | 否 |
| `frontend/src/styles/responsive.scss` | 手机端布局与滚动行为，继续读取公共变量 | 否 |
| `frontend/src/utils/table-layout.ts` | 普通文本、标识字段和操作列的内容驱动宽度计算 | 否 |
| `frontend/src/utils/admin-table-drag-scroll.ts` | 统一表格 PC 鼠标拖动横向浏览，手机端保留原生触摸滑动 | 否 |
| `frontend/src/utils/format.ts` | 统一金额与货币格式 | 否 |
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
    :class-name="getColumnClass(column)"
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

当字段总宽度超过容器时，只使用 Element Plus 内部滚动容器。手机端直接触摸横移；PC 端除触控板和 `Shift + 滚轮` 外，还统一支持在非按钮区域按住鼠标左键拖动。拖动能力由全局入口自动安装，并在每次原生滚动和鼠标拖动时同步 Element Plus 分离的表头、表体和汇总行；业务页面不得再次实现 `mousedown`、`pointermove`、表头位移或外层滚动条。

调货/同行批发记录统一由 `row-class-name` 返回 `admin-row--peer-transfer`，整行使用公共紫蓝识别色；需要强调的文本使用 `admin-wholesale-text`。页面不得为 IMEI 单独制作背景卡片，也不得自行选择另一套批发颜色。

金额统一调用 `formatAmount` / `formatCurrency`：不使用千分位逗号，整数不显示小数，小数固定保留两位。例如 `¥89578`、`¥89578.50`。

必须完整显示的普通文本列使用 `complete-text-column`，序列号、IMEI 和业务单号使用 `identifier-column`。这两类列都必须配合 `getTextColumnMinWidth` / `getIdentifierColumnMinWidth` 计算当前页表头与数据的内容宽度，禁止依赖单元格省略号。备注、说明等可能很长的连续文本默认使用 `complete-text-column wrapped-text-column` 在列内完整换行；PC 紧凑主列表确需节省宽度时，备注等可独立查看的长文本允许使用 `ellipsis-text-column` 设置内容驱动的最小宽度和有限 `maxWidth`，但必须提供双击查看完整原文的入口，且不得用于 Apple ID、序列号、IMEI、名称、价格、状态等普通业务字段。

列宽的字段语义下限由页面声明，实际宽度必须通过公共工具按当前页内容计算。固定值只能作为 `minWidth`，不能直接作为最终列宽：

```ts
import {
  getActionColumnMinWidth,
  getIdentifierColumnMinWidth,
  getTextColumnMinWidth
} from '@/utils/table-layout'

const modelWidth = getTextColumnMinWidth(
  ['型号', ...rows.value.map(row => row.model)],
  { minWidth: 74, horizontalPadding: 16, asciiCharacterWidth: 7 }
)

const serialWidth = getIdentifierColumnMinWidth(
  ['序列号', ...rows.value.map(row => row.serial_number)],
  { minWidth: 120, horizontalPadding: 24 }
)

const actionWidth = getActionColumnMinWidth(visibleActionCount.value, {
  minWidth: 260
})
```

所有长度不固定的普通字段使用 `getTextColumnMinWidth`；序列号、IMEI、业务单号等标识字段统一使用 `getIdentifierColumnMinWidth` 和 `identifier-column`。工具会按当前页表头及最长内容计算最小宽度；字段少时由 Element Plus 的 `fit` 自动分配剩余宽度铺满表格，空间不足时由表格内部横向滑动。这里的“自动缩放”是列宽随当前页内容调整，不是让单个单元格自行缩小字号；PC 与手机字体只读取全局断点变量。

管理员可能显示全部字段的多列表格，应使用紧凑但安全的字段最小值，并将实际单元格内边距计入 `horizontalPadding`；优先收紧各普通列累计留白，为操作列保留完整按钮空间，不得通过缩小操作按钮、裁切文字或减小全局字体强行塞入一屏。

同类短徽章字段应共用相同的最小宽度和 `horizontalPadding`。例如综合查询的“机况”和“状态”在两字内容下保持同宽；只有实际状态文字更长时才由内容测量结果扩展。

操作列可以在 `getActionColumnMinWidth` 中传入页面语义最小宽度，为按钮边缘保留少量安全空间；该值只能增加列空间，不得替代按实际可见按钮数量计算。

操作列统一由 `.actions-column` 让单元格占满列宽并使用 Flex 居中，按钮组左右留白必须相等。页面不得使用 `margin-left`、绝对定位或固定偏移修正按钮位置；需要增加安全空间时只调整操作列语义最小宽度。

存在内容切换的字段（例如购买人/办理人）必须把所有可切换值都纳入列宽计算，不能只测量当前显示值。自定义徽标、图标或操作按钮还要通过 `horizontalPadding` 计入其图标、间距、内边距和单元格内边距；操作列按当前权限下实际可见按钮数量计算。这样既保证完整展示，也不会用偏大的固定列宽制造空白。

型号等以英文和数字为主的字段可通过 `asciiCharacterWidth` 使用更接近实际字体的测量值，但 `horizontalPadding` 不得小于单元格真实左右内边距总和。禁止直接压缩固定宽度导致型号文字被遮挡。

```vue
<el-table-column
  label="序列号"
  :min-width="serialWidth"
  class-name="identifier-column"
/>
```

禁止使用 `th:nth-child()` 或 `td:nth-child()` 控制列宽。字段权限或响应式列变化后，序号选择器会对应到错误字段。

除上文明确接入完整查看入口的 `ellipsis-text-column` 长文本例外外，统一表格在任何断点都不得通过公共或页面 CSS 强制 `overflow: hidden`、`text-overflow: ellipsis`。字段多时，表头与内容必须留在 Element Plus 的同一个内部横向滚动层同步移动；PC 支持鼠标拖动，手机支持原生触摸滑动。页面外层不得再制造第二个可见横向滚动条。

公共 `.data-table` / `.admin-data-table` 对尚未迁移的普通单元格提供完整换行兜底，因此统一表格不会再静默截断数据。正式迁移的业务列表仍必须为每列计算内容驱动宽度，并使用 `complete-text-column` 保持常规字段单行；不能把兜底换行当成固定窄列的替代方案。

### 综合查询 PC 全字段最终基准

综合查询 `/query` 是管理员全字段场景的紧凑基准。下列数值是字段语义下限或测量参数，最终宽度仍按当前页实际内容扩展：

| 字段 | 最终规则 |
| --- | --- |
| 普通字段 | `getTextColumnMinWidth`，读取当前页表头和内容，`horizontalPadding: 20` |
| 序列号、IMEI | 完整单行展示，`getIdentifierColumnMinWidth`，`horizontalPadding: 24` |
| 备注 | `88px` 至 `144px`，超出显示省略号；PC 双击该单元格查看完整原文 |
| Apple ID | 完整单行展示，最小 `180px`，至少容纳 `15279028053@139.com`，不设置双击查看 |
| 型号 | 最小 `74px`，`horizontalPadding: 16`，`asciiCharacterWidth: 7` |
| 机况、状态 | 最小 `50px`，`horizontalPadding: 44`；同长度短徽章保持同宽 |
| 操作 | 最小 `260px`，并按当前用户实际可见按钮数量动态计算；按钮组居中且左右留白相等 |

管理员、普通用户和不同角色看到的字段及操作数量可能不同。表格必须以当前登录用户实际可见的列、当前页数据和实际可用操作重新计算宽度；不得缓存管理员列宽给普通用户，也不得为隐藏按钮预留空白。管理员全字段需要完整且紧凑，普通用户字段较少时由 `fit` 自动铺满可用宽度，两种账号均不得遮挡、错位或产生页面级横向溢出。

### 操作列文字规则

- PC 端主列表的查看、编辑、删除、审核等常规操作必须使用“图标 + 中文文字”，不得只显示图标让用户猜测功能。
- 主列表操作按钮统一使用 `.action-buttons` 和 `el-button size="small"`，事件必须使用 `@click.stop`；按钮文字必须完整显示。
- 审批、到账等位于普通业务字段列中的单个按钮使用 `.table-inline-action`。宽度固定为 `auto`，最小宽度为 `0`，使用全局紧凑变量 `--admin-data-table-inline-action-padding-x`、`--admin-data-table-inline-action-icon-size` 和 `--admin-data-table-inline-action-icon-gap`，不得设置 `width: 100%` 或业务固定宽度。
- 操作列宽度根据当前权限下实际显示的按钮数量调用 `getActionColumnMinWidth` 计算。按钮增减后列宽需要同步变化，禁止依赖固定窄列遮挡文字。
- 只有模态框中的紧凑工具列、单元格空间明确受限且含义熟悉的操作，才允许使用纯图标按钮；纯图标必须提供 `title` 或 tooltip。
- 手机端优先按页面规则隐藏常驻操作列，通过连续两次点击行展开操作；展开后的命令按钮仍应显示文字。

### 操作按钮尺寸与语义颜色

表格、列表卡片和手机展开区共用同一套操作按钮。尺寸与颜色变量全部定义在 `frontend/src/styles/admin-layout.css`，结构和状态规则定义在 `frontend/src/styles/components/_table.scss`。PC 端当前高度为 `28px`、水平内边距为 `10px`、字体为 `13px`、圆角为 `4px`；手机端高度为 `32px`、水平内边距为 `12px`，字体读取公共手机表格字号。普通业务字段中的 `.table-inline-action` 使用更紧凑的 PC `7px`、手机 `8px` 水平内边距。页面不得写死这些值。

| 操作语义 | 推荐 class | 颜色含义 |
| --- | --- | --- |
| 查看、详情、预览 | `.table-action--view` | 青色 |
| 编辑、修改 | `.table-action--edit` | 蓝色 |
| 删除、移除 | `.table-action--delete` | 红色 |
| 置顶 | `.table-action--pin` | 橙色 |
| 完成、启用、通过 | `.table-action--success` | 绿色 |
| 恢复、解绑等中性工具 | `.table-action--neutral` | 灰色 |
| 审批、配置、管理 | `.table-action--manage` | 靛蓝色 |
| 到账、付款、结算 | `.table-action--finance` | 青绿色 |

新代码必须在 `.action-buttons`、`.mobile-row-actions`、`.mobile-inline-actions`、`.table-actions` 或 `.tf-table-actions` 容器内使用基础 class `.table-action` 和显式语义 class。Element Plus 的 `type="primary|danger|warning|success|info"` 只作为历史页面兼容层，不作为新代码的语义来源。

```vue
<div class="action-buttons">
  <el-button class="table-action table-action--view" size="small" @click.stop="view(row)">查看</el-button>
  <el-button class="table-action table-action--edit" size="small" @click.stop="edit(row)">编辑</el-button>
  <el-button class="table-action table-action--delete" size="small" @click.stop="remove(row)">删除</el-button>
</div>
```

业务页面只允许控制操作区的布局和权限显隐，不得在 `<style scoped>` 中重复定义按钮的 `height`、`padding`、`font-size`、`border-radius`、背景、边框、文字色、悬停色或禁用色。若新增一种整站通用语义，必须先在 `admin-layout.css` 增加 `--admin-action-*` 变量，再在 `_table.scss` 增加语义 class，禁止逐页选择颜色。经验分享 `/shared` 的编辑、删除、置顶按钮是标准参考实现。

### 表格选择与点击规则

需要单选、全选或批量操作的列表统一遵循以下状态语义：

- `selectedIds` 是选择状态的唯一数据源；复选框使用受控值和显式 `change` 事件更新。Element Plus 表格优先使用 `el-checkbox`；保留原生复选框时使用 `:checked + @change`，禁止用数组 `v-model` 同时驱动表头和行选择。
- 表头“全选”和“半选”只根据当前展示且允许选择的记录 ID 计算，必须逐个核对 ID。禁止使用 `selectedIds.length === rows.length`，因为翻页、筛选、固定记录或禁用行都会导致数量相同但记录不同。
- 点击表头全选时，将当前展示且允许选择的 ID 合并进 `selectedIds`；取消表头全选时，只移除当前展示范围的 ID。批量操作页面默认保留其他页面已经选择的记录。
- “清空选择/取消选择”按钮表示清除全部已选记录；存在跨页对象缓存时，必须在同一次操作中同时重置 ID 数组和 `Map` 缓存。
- 已完成、无权限等不可选记录必须从 `currentSelectableIds` 排除，并禁用对应行复选框。表头全选状态不得把禁用行计算在内。
- 行复选框、表头复选框、操作按钮、链接和表单控件都必须使用 `@click.stop`，不得触发行点击、双击详情或手机端连续点击展开。
- PC 端行双击和手机端连续两次点击属于详情/操作交互，不得隐式改变选择状态。只有明确设计为“点击整行选择”的页面才允许行点击切换选择，并必须避免与详情打开冲突。
- 已选数量显示全部 `selectedIds.length`；筛选或翻页后不得因当前页没有选中项而丢失跨页选择。业务明确不支持跨页选择时，必须在翻页或筛选入口主动清空并向用户保持一致行为。

标准实现：

```ts
const selectedIds = ref<number[]>([])

const currentSelectableIds = computed(() => rows.value
  .filter(row => canSelectRow(row))
  .map(row => row.id))

const selectedIdSet = computed(() => new Set(selectedIds.value))

const isAllSelected = computed(() => {
  return currentSelectableIds.value.length > 0
    && currentSelectableIds.value.every(id => selectedIdSet.value.has(id))
})

const isIndeterminate = computed(() => {
  const count = currentSelectableIds.value
    .filter(id => selectedIdSet.value.has(id)).length
  return count > 0 && count < currentSelectableIds.value.length
})

const handleSelectAll = (checked: boolean) => {
  const currentIds = new Set(currentSelectableIds.value)
  selectedIds.value = checked
    ? [...new Set([...selectedIds.value, ...currentSelectableIds.value])]
    : selectedIds.value.filter(id => !currentIds.has(id))
}

const handleSelectRow = (id: number, checked: boolean) => {
  selectedIds.value = checked
    ? [...new Set([...selectedIds.value, id])]
    : selectedIds.value.filter(selectedId => selectedId !== id)
}

const clearSelection = () => {
  selectedIds.value = []
}
```

页面如果另外维护了跨页完整对象缓存，`clearSelection` 中还必须执行 `selectedRowMap.value = new Map()`，不要只调用旧 `Map` 的 `clear()` 后等待其他监听器同步。

```vue
<el-checkbox
  :model-value="isAllSelected"
  :indeterminate="isIndeterminate"
  :disabled="currentSelectableIds.length === 0"
  @click.stop
  @change="value => handleSelectAll(Boolean(value))"
/>

<el-checkbox
  :model-value="selectedIdSet.has(row.id)"
  :disabled="!canSelectRow(row)"
  @click.stop
  @change="value => handleSelectRow(row.id, Boolean(value))"
/>
```

选择功能至少验证：单项勾选与取消、全选后取消一项、半选后再次全选、取消当前页全选、清空全部选择、翻页后返回、筛选后恢复、禁用行不参与全选，以及 PC/手机点击复选框不会打开详情。

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
| 操作按钮语义色与禁用色 | `--admin-action-view-*`、`--admin-action-edit-*`、`--admin-action-delete-*`、`--admin-action-pin-*`、`--admin-action-success-*`、`--admin-action-neutral-*`、`--admin-action-manage-*`、`--admin-action-finance-*`、`--admin-action-transfer-*`、`--admin-action-export-*`、`--admin-action-warning-*`、`--admin-action-disabled-*` |
| 表格状态徽章内边距与圆角 | `--admin-data-table-badge-*` |

桌面端变量定义在默认 `:root`，手机端统一覆盖放在 `@media (max-width: 768px)` 内。不要为 `320px`、`360px`、`375px`、`390px` 或 `430px` 分别创建表格字号。

## 6. 手机端规则

1. 统计卡片固定为每行两张，使用 `repeat(2, minmax(0, 1fr))`；包括基础资料页在内，不得被桌面端 `auto-fit` 或最小列宽覆盖。卡片间距、内边距和字号继续读取 `--admin-stats-*`、`--admin-stat-*` 公共变量。
2. 表头和内容必须由同一个 Element Plus 表格滚动容器驱动，横向移动时保持同步。
3. 可滑动时隐藏可见滚动条，不增加独立的“左右拉动条”。
   该规则同时适用于 PC 和手机；桌面端支持鼠标左键拖动、触控板和 `Shift + 滚轮`，手机端支持原生触摸横移。
4. 普通页面按业务优先级减少手机端列数，表格宽度保持在页面卡片内。
5. 手机端正文统一读取 `--mobile-text-table`，表头读取 `--mobile-text-table-header`。当前普通手机均为 `13px`，`375px` 及以下均为 `11px`。表格内的 `span` 必须继承单元格字号，不能被通用正文样式放大；禁止 `clamp(...vw...)`、小于公共字号的像素值或按机型连续缩放字体。
6. 手机端双击打开详情时，使用两次 `row-click` 模拟；必须忽略按钮、链接和表单控件，防止误触。
7. 操作按钮统一使用 `.action-buttons` 和 `el-button size="small"`，按钮点击必须添加 `.stop`。

### 弹窗表格自适应规则

弹窗内的 Element Plus 表格不得沿用主列表的固定最小宽度（例如 `1200px` 或业务自定义的固定大宽度）。各列根据当前表头和数据计算紧凑 `min-width`，字段较少时由 `fit` 铺满弹窗剩余空间，字段总宽度超过弹窗时只允许表格内部横向滑动。表头和内容必须使用同一个滚动容器，完整字段使用 `complete-text-column`，禁止用省略号制造“看似紧凑”的布局。

### 打款页特殊规则

`/payments` 需要保留多个业务字段，因此手机端允许横向滑动查看更多列。它仍必须满足：

- 表头与内容同步移动；
- 仅有一个实际横向滚动区域；
- 可见滚动条隐藏；
- 操作按钮背景完整，按钮文字不得被裁切；
- 供应商、店铺、品牌、型号、颜色、内存、序列号和 IMEI 均按当前页内容计算最小宽度并完整显示，不使用省略号或 `show-overflow-tooltip` 代替内容；
- 特殊规则只挂在打款页专属 class 上，不修改其他页面的全局行为。

批量打款、单台打款和打款详情三个弹窗统一使用内容自适应列宽：先根据弹窗当前数据计算各列紧凑最小宽度，再由 Element Plus 分配剩余空间填满整行。弹窗表格的每个数据单元格都使用 `complete-text-column`，不得出现省略号；弹窗表格不得继承主列表的 `1200px` 最小宽度；字段过多时保留同步横向滑动并隐藏可见滚动条。主列表仍按多字段查看规则保留横向滑动。

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

### 权限管理页规则

权限管理 `/permissions` 的角色管理、角色分配、门店绑定和权限日志四个列表统一使用 `el-table.data-table.devices-table`，并放入 `.table-responsive`。角色描述、日志描述等长文本使用明确的最小列宽并在表格内部处理，不能恢复原生 `<table>` 或页面私有表头、行高和滚动样式。操作按钮继续使用图标加中文文字，列宽按实际操作数量留足空间。

模块管理 Tab 的网格卡片读取 `--admin-panel-gap`、`--admin-panel-padding` 和 `--admin-panel-radius`。卡片头部固定为两行：第一行按“模块名称、分类、启用状态”排序，第二行展示模块 KEY 和说明；两行均保持单行，超出时在当前字段内省略并通过 `title` 查看完整内容。手机端权限数量、名称状态、创建日期和模块类型固定为两列紧凑信息网格，每个信息项的标签和值在同一行展示，不得退化为四张纵向嵌套卡片。卡片操作使用 `.card-actions.tf-actions--fit-row` 保持单行自适应；分页只使用公共 `Pagination` 和全局 `.pagination-wrapper`，页面不得覆盖分页间距、边框或手机布局。

### 考勤管理页规则

考勤管理 `/attendance` 的“所有考勤”和“我的考勤”统一使用 `el-table.data-table.devices-table`。页面不得覆盖公共表头、行高、字号、斑马纹、悬停背景、单元格内边距或横向滚动；考勤类型和审批状态可以保留业务语义标签。操作列不得固定在独立右侧层，必须和普通字段处于同一滚动表格内，确保全局整行悬停外包围连续覆盖操作区域。桌面和手机展开区的查看、编辑、审批、删除、撤销按钮均使用公共语义 class，操作列宽使用 `getActionColumnMinWidth`。

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
- 普通字段、序列号、IMEI、名称、金额、状态和 Apple ID 均完整展示；只有具备完整查看入口的备注等长文本可以省略。
- 超宽表格只保留 Element Plus 内部一个滚动区域，PC 鼠标拖动和手机触摸横移均可用。
- PC 鼠标拖动后表头、表体和汇总行保持同一 `scrollLeft`，不存在表头与内容错位。
- PC 主列表操作按钮显示“图标 + 文字”，列宽随可见按钮数量自适应；模态框纯图标按钮具备 `title` 或 tooltip。
- 操作按钮组在列内居中，左右安全留白一致；备注双击能查看完整内容，Apple ID 示例长度无需双击即可完整显示。
- 分别使用管理员全字段账号和普通权限账号验收；隐藏列、隐藏操作后宽度会重新计算，剩余字段自动铺满且不保留无效空白。
- 表头全选/半选按当前可选 ID 计算；单项取消、全选后取消一项、跨页保留和清空全部均已验证。
- 复选框和操作按钮使用 `@click.stop`，不会误触发行详情或手机端连续点击操作。
- 调货/同行批发行使用 `admin-row--peer-transfer`，金额使用公共格式函数且无千分位逗号。
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
- 补贴管理选择与批量操作：`frontend/src/views/subsidy/SubsidyView.vue`、`frontend/src/views/subsidy/components/SubsidyListSection.vue`
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
