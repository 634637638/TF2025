# TF2025 公共组件采用与例外规范

## 统一原则

后台通用页面按语义使用公共组件：

| 场景 | 公共入口 |
| --- | --- |
| 列表搜索与筛选 | `UnifiedSearchPanel` |
| 分页 | `Pagination` |
| 弹窗 | `MobileDialog`，或复用全局样式的 `el-dialog` |
| 空数据、错误和无搜索结果 | `DataEmptyState` |
| 表格 | `el-table.data-table` 或 `PaginatedTable` |
| 页面、区块和表格加载 | `GlobalLoading`、`SectionLoading`、`TableLoadingRow`、`InlineLoading` |

页面只提供字段、数据和业务事件，不得复制公共组件的外壳、颜色、间距、按钮尺寸或空状态结构。

## 原生 button 禁止规则

所有前端页面和公共组件禁止使用原生 `<button>`，不设业务、H5、登录、公开报价、分页、关闭、菜单、标签页、锁屏、媒体预览、扫描器或权限开关例外。所有可点击按钮统一使用 Element Plus `<el-button>`，普通 HTML 表单语义通过 `native-type="submit"` 或 `native-type="button"` 保留。

按钮的颜色、尺寸、圆角、Loading、焦点和响应式行为必须接入 `button-standards.md` 及 `_buttons.scss`。专用控件可以增加语义 class，但不得恢复原生标签或在页面中复制第二套按钮样式。选择项、拖动区域等非按钮交互应使用对应的 Element Plus 组件或现有公共组件。

`frontend/scripts/check-component-adoption.mjs` 对所有 Vue 页面和公共组件执行零容忍扫描：发现任意 `<button>` 立即失败，不接受注释、文件登记或数量基线绕过。迁移后的按钮必须继续通过 `check:buttons`、`check:dialog-actions` 和类型检查。

2026-10-06 已按页面与功能单元台账迁移原生按钮，并将组件采用审计改为零容忍。当前 Vue 源码统计为 `el-button=969`、原生 `<button>=0`（具体数量以审计脚本输出为准）。

## 搜索和分页边界

后台具有列表数据、关键词或筛选条件的页面必须接入 `UnifiedSearchPanel`，查询和重置时将页码恢复为第一页。详情弹窗、统计图表、权限矩阵和仅展示型表格可以不接入搜索或分页，但应由页面结构决定，不得因为复制旧模板而保留无效搜索栏。

公共 `Pagination` 负责页码、每页数量、总数、移动端布局和参数变化。页面不得直接使用 `el-pagination`，也不得重复维护一套分页按钮。

## 弹窗边界

新增业务弹窗优先使用 `MobileDialog`。由于 Element Plus 插槽、Teleport 或已有服务逻辑必须使用 `el-dialog` 时，只能复用全局 Dialog 样式；不得新增第二套遮罩、标题栏、圆角、阴影或 footer 按钮布局。

## 审计

```bash
cd frontend
npm run check:component-adoption
```

该审计扫描所有 Vue 页面和公共组件，禁止任何原生 `<button>`，并检查公共组件入口存在。它还会拦截已移除的 `<BaseButton>` 和 `<ConfirmDialog>` 标签及同名组件文件，避免自动组件注册悄然恢复旧入口。

`check:dialogs` 单独登记必须继续使用 Element Plus `el-dialog` 的工作台场景。当前例外包括提醒宿主、H5/查询媒体预览、备份清理、待办、经验分享和国补照片工作台；这些文件必须保留业务 class，并继续复用全局 Dialog 样式。除此之外的新直接 `el-dialog` 会被审计拦截，优先改用 `MobileDialog`。

它与 `check:ui`、`check:buttons`、`check:tables`、`check:empty-states`、`check:loading` 配合使用；采用率审计通过不代表详情弹窗或业务专用控件必须强行改成同一种实现。

最后更新：2026-10-06
