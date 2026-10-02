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

## 原生 button 边界

后台普通命令按钮优先使用 `el-button`。原生 `<button>` 只允许用于以下专用交互：

- 公共组件内部的关闭、分页、菜单、标签页、锁屏和媒体控制；
- 扫码器、图标选择器、权限开关、拖动/选择控件等需要原生语义或自定义键盘行为的控件；
- H5 客户端、登录页和公开报价页的专用移动交互；

每个例外必须在 `frontend/scripts/check-component-adoption.mjs` 中登记复核状态、原因和当前数量基线。状态为 `retain`（有理由保留）、`candidate`（可迁移普通命令）或 `mixed`（文件中同时有专用控件和可迁移项）。审计校验登记完整性、文件存在性，并阻止例外文件里的按钮数量继续增加；新增通用命令优先迁移为 `el-button`，专用交互确需增加时，先确认语义、键盘操作和可访问性，再显式审核并更新基线。新增原生按钮文件会让审计失败，不能只在页面中添加注释绕过。

待迁移和混合状态不是豁免结论，而是后续治理清单。候选操作完成迁移后应移除原生按钮登记；仍需保留的控件必须按具体交互说明理由，不能只用“专用交互”概括。

2026-10-01 已把 `GitManagement` 的 8 个仓库命令、`ModuleManagementView` 的搜索清除和 `UserRoleAssignmentBody` 的搜索清除迁移到 `el-button`，其权限、动作、禁用及加载反馈均保留。原生例外从 40 个文件/96 个按钮降为 38 个文件/86 个按钮。

2026-10-01 继续把 `MenuItem` 的增删改、顶栏锁定/退出、`DynamicSidebar` 刷新、`IconSelector` 的选择/清除/确认、`IconPicker` 本地图标删除、媒体预览素材删除及配件编辑命令迁移到 `el-button`。图标分类项、分页、菜单导航、媒体翻页/关闭和弹窗关闭仍保留原生语义。当前登记收敛为 35 个文件/72 个按钮，状态均为 `retain`，审计结果为 35 项保留、0 项待迁移、0 项混合。

2026-10-01 移除无业务引用的 `BaseButton.vue` 和自定义 `ConfirmDialog.vue`，清理全局组件类型及文档入口；自动组件声明由 Vite 插件重新生成。审计禁止旧标签和同名文件复活。当前登记为 33 个文件/69 个原生按钮，33 项均有保留理由。

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

该审计登记原生按钮例外的复核状态及数量上限，并检查公共组件入口存在。它还会拦截已移除的 `<BaseButton>` 和 `<ConfirmDialog>` 标签及同名组件文件，避免自动组件注册悄然恢复旧入口。例外数量基线是回归上限，不代表这些原生按钮已达到统一目标；后续迁移时应同步降低基线并更新复核状态。

`check:dialogs` 单独登记必须继续使用 Element Plus `el-dialog` 的工作台场景。当前例外包括提醒宿主、H5/查询媒体预览、备份清理、待办、经验分享和国补照片工作台；这些文件必须保留业务 class，并继续复用全局 Dialog 样式。除此之外的新直接 `el-dialog` 会被审计拦截，优先改用 `MobileDialog`。

它与 `check:ui`、`check:buttons`、`check:tables`、`check:empty-states`、`check:loading` 配合使用；采用率审计通过不代表详情弹窗或业务专用控件必须强行改成同一种实现。

最后更新：2026-10-01
