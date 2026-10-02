# 后台列表检索统一规范

## 统一入口

- 后台列表页统一使用 `frontend/src/components/search/UnifiedSearchPanel.vue`。
- 公开报价页统一使用 `frontend/src/components/search/PublicSearchBox.vue`。该组件只负责关键词输入、回车/搜索、清除和响应式外壳；报价查询、密码验证和数据加载仍由页面业务处理。
- 日期范围统一使用 `frontend/src/components/DateRangePicker.vue`，开始和结束日期分别弹出单个面板，并从对应输入框下方展开。
- 单日期、单月份等单值筛选可直接使用 Element Plus `el-date-picker`。
- 页面只负责字段、权限、选项和查询参数，不得自行维护检索面板背景、按钮、展开布局或响应式样式。

## 迁移状态

后台普通列表使用 `UnifiedSearchPanel`；统计分析、详情弹窗、权限矩阵和仅展示型表格按其交互形态保留专用布局，公开报价页使用 `PublicSearchBox`。新建或实质改造后台列表时必须采用公共面板，检索和重置后页码归到第一页。公共入口与例外边界见[公共组件采用与例外规范](component-adoption-standard.md)，自动审计由 `check:ui` 执行。

## 关键词覆盖

同一业务对象的搜索接口必须覆盖页面展示的识别字段，至少包括品牌、型号、颜色、内存，以及页面允许查询的串码、客户姓名、手机号和 Apple ID。型号比较必须复用标准化规则，忽略大小写、空格（含全角空格）和连字符差异，避免 `iPhone17`、`iPhone 17` 与 `iPhone-17` 在不同页面返回不同结果。页面不得在前端二次过滤掉后端已返回的有效匹配结果。

综合查询的 `search_term` 已按上述规则匹配手机识别字段和客户字段；后端统一由 `backend/src/utils/search.js` 生成型号标准化 SQL。新增页面或接口必须复用该入口，补充相同的字段覆盖和回归用例。

## 全局排序规则

所有存在业务排序配置的列表、菜单、基础资料和下拉选项，都必须优先使用数据库或接口返回的 `sort_order`。该规则同时约束后端 SQL 排序和前端内存排序，不能只在某个页面单独实现。

- 后端默认排序：`sort_order ASC`，再按展示名称（或业务主标签）自然排序，最后按 `id ASC` 稳定排序。
- 前端默认排序：统一调用 `frontend/src/utils/option-sort.ts` 的 `sortOptionsByOrder`，优先读取 `sort_order`，兼容历史字段 `sortOrder`、`order`。
- 排序字段必须随接口响应返回；页面或公共转换层不得丢弃 `sort_order` 后再按名称排序。
- `sort_order` 相同时才按名称自然排序；名称仍相同时按 `id` 稳定排序。
- 没有业务排序字段的临时数据，才允许使用名称、时间或 ID 等业务专用排序，并必须在接口或页面代码中说明原因。
- 禁止各页面复制自定义 `sort` 比较器，禁止用请求返回顺序代替明确排序契约。

新增或修改排序接口时，必须检查数据库查询、API 响应字段、公共转换层和页面渲染四层是否保留并优先使用 `sort_order`。

## 基础下拉选项排序

品牌、型号、颜色、内存，以及供应商、门店等基础下拉选项统一使用
`frontend/src/utils/option-sort.ts` 的 `sortOptionsByOrder`。公共规则为：

1. 优先使用后台配置的 `sort_order`（兼容 `sortOrder`、`order`）。
2. 排序值相同时按名称自然排序，数字型号按数字顺序比较，例如 `iPhone 11` 位于 `iPhone 12` 之前。
3. 名称仍相同时按 `id` 稳定排序。

内存选项使用 `labelKeys: ['size', 'capacity', 'name']`，保证不同接口字段返回的容量仍按同一规则展示。
页面不得复制 `.sort((a, b) => ...sort_order...)` 或自行实现缺失排序值、名称和 ID 的比较器。品牌联动型号、编辑弹窗、库存/销售/入库/预定、综合查询和 H5 商城均必须复用该入口。

## 参考选项与结果数量

品牌、型号、颜色、内存、供应商和门店属于检索参考选项。参考选项请求不得使用固定的 `page_size=50`、`100`、`500` 等数量截断，也不得在前端加载后再用 `slice` 隐藏合法选项。公共请求应使用对应接口的 `all=true` 全量模式；品牌联动型号只加载当前品牌，但必须返回该品牌下全部有效型号。

这条规则解决的是“某品牌有 200 个型号时，第 51 个以后无法搜索或选择”的数据缺失问题。后端参考选项接口必须在 `all=true` 下省略 `LIMIT/OFFSET`，并保持稳定排序；关键词过滤只能缩小匹配集合，不能再附加固定条数上限。当前公共实现包括 `frontend/src/services/reference-options.ts` 和各基础选项 composable，后端对应品牌、型号、颜色、内存、供应商路由。

参考选项的全量返回不等于业务列表禁止分页。库存、销售、综合查询、入库、预订等业务结果仍可按页返回以控制单次响应大小，但必须同时返回准确的 `pagination.total`，用户可以通过页码访问全部命中记录。业务搜索接口不得用 `LIMIT 100`、`LIMIT 500` 作为最终结果截断；公开报价搜索同样必须返回全部匹配报价，或提供可继续翻页的统一分页协议。

禁止事项：

- 禁止在公共参考选项请求中新增固定数量上限。
- 禁止将“每页条数”误当成“搜索结果总数”，导致页面只展示首屏并丢失后续结果。
- 禁止用前端本地截断替代后端完整查询；本地过滤只能作用于已完整加载的当前参考集合。
- 管理列表的分页限制必须只影响该页，不得影响筛选条件的 `COUNT`、翻页或导出范围。

新增或修改检索接口时，至少验证：参考选项数量超过 100 条、某品牌型号超过 200 条、关键词匹配超过 100/500 条时，目标记录仍可被搜索并返回；同时验证分页总数、下一页和导出结果与筛选条件一致。

型号联动选项按“先品牌、后型号”加载。综合查询、库存和销售等页面在选定品牌后必须获取该品牌完整的有效型号集合，不能用固定 `LIMIT` 或分页上限截断后再交给前端本地搜索；型号数量较大时可改用远程关键词搜索，但后端必须返回全部匹配项。不得为此预加载所有品牌的型号。详见[型号检索统一规范](model-search-standard.md)。

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

最后更新：2026-10-02
