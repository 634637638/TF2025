# TF2025 公共组件采用与例外规范

## 统一原则

后台通用页面按语义使用公共组件：

| 场景 | 公共入口 |
| --- | --- |
| 列表搜索与筛选 | `UnifiedSearchPanel` |
| 分页 | `Pagination` |
| 弹窗 | `MobileDialog`（业务唯一入口） |
| 图片/视频查看 | `MediaPreviewViewer`；下载和删除通过事件调用业务权限及文件服务 |
| 空数据、错误和无搜索结果 | `DataEmptyState` |
| 表格 | `el-table.data-table` 或 `PaginatedTable` |
| 字段描述列表 | `RecordDescriptions`，内部复用 Element Plus，手机两列、标签置顶，桌面保留原列数 |
| 页面、区块和表格加载 | `GlobalLoading`、`SectionLoading`、`TableLoadingRow`、`InlineLoading` |

页面只提供字段、数据和业务事件，不得复制公共组件的外壳、颜色、间距、按钮尺寸或空状态结构。

## H5 认证布局

H5 登录与注册复用 `frontend/src/views/H5-mobile/components/H5AuthLayout.vue`，统一背景、卡片、标题、底部导航及协议文本换行；宽度读取 `--tf-h5-auth-card-max-width`，颜色、间距、字体和圆角读取公共令牌。表单字段和提交留在各自视图，使用 `useForm` 及 `el-form-item :error`，首次提交也必须主动校验。订单查询的登录身份/匿名验证和订单列表不同，保留自己的业务布局，不强行套认证卡片。行为与浏览器入口见[表单控件规范](form-control-standards.md#公共入口与验收)。

## 原生 button 禁止规则

所有前端页面和公共组件禁止使用原生 `<button>`，不设业务、H5、登录、公开报价、分页、关闭、菜单、标签页、锁屏、媒体预览、扫描器或权限开关例外。所有可点击按钮统一使用 Element Plus `<el-button>`，普通 HTML 表单语义通过 `native-type="submit"` 或 `native-type="button"` 保留。

按钮的颜色、尺寸、圆角、Loading、焦点和响应式行为必须接入 `button-standards.md` 及 `_buttons.scss`。专用控件可以增加语义 class，但不得恢复原生标签或在页面中复制第二套按钮样式。选择项、拖动区域等非按钮交互应使用对应的 Element Plus 组件或现有公共组件。

`frontend/scripts/check-component-adoption.mjs` 对所有 Vue 页面和公共组件执行零容忍扫描：发现任意 `<button>` 立即失败，不接受注释、文件登记或数量基线绕过。迁移后的按钮必须继续通过 `check:buttons`、`check:dialog-actions` 和类型检查。

2026-10-06 已按页面与功能单元台账迁移原生按钮，并将组件采用审计改为零容忍。2026-11-08 Vue 源码实测为 `el-button=1005`、原生 `<button>=0`（具体数量以审计脚本输出为准）。

## 搜索和分页边界

后台具有列表数据、关键词或筛选条件的页面必须接入 `UnifiedSearchPanel`，查询和重置时将页码恢复为第一页。详情弹窗、统计图表、权限矩阵和仅展示型表格可以不接入搜索或分页，但应由页面结构决定，不得因为复制旧模板而保留无效搜索栏。

公共 `Pagination` 负责页码、每页数量、总数、移动端布局和参数变化。页面不得直接使用 `el-pagination`，也不得重复维护一套分页按钮。

## 弹窗边界

业务弹窗使用 `MobileDialog`，原生 `el-dialog` 只用于公共组件内部。插槽、Teleport、关闭及生命周期复用公共能力，不新增业务例外或私有外壳覆盖。确认、提示和输入使用公共通知服务。

## 扫码器上下文

手机扫码复用 `OptimizedScanner.vue` 并传入 `:phone` 品牌上下文；配件SN显式使用 `serial-profile="accessory"` 与 `scan-type="serial"`。解析及控件边界见[基础控件规范](basic-component-standards.md#扫码器解析上下文)。采用审计检查实际调用及正反例，不能通过虚构手机品牌绕过上下文。

## 审计

### 删除未采用组件的复验

不能只凭旧的 `components.d.ts`、文件名检索或打包未包含就删除组件。先用项目 Vite 配置重新构建生成声明并保存前后 diff，再核对模板标签、静态/动态 import、`defineAsyncComponent`、`resolveComponent`、字符串组件名、动态 `:is` 数据来源、全局注册与 glob 扫描。

当前自动组件插件会把目录内可发现的组件也写入声明，所以 dts 中存在声明不等于页面采用；dts 缺少声明也不代表局部显式 import 没有使用。证据不一致的候选单独登记并保留，不能通过缩小扫描目录、手工删声明或改构建配置制造“零引用”。按双零协议删除时，只有重新生成 dts 无声明且所有运行时引用也为零的组件进入删除批次。

删除时同步清理字段契约、源码审计中的直接读取路径、各类逐文件基线、页面台账及仍作为当前说明的文档。保留其他文件的检查规则和上限，不能用忽略 ENOENT 或重建全量基线替代收口。删除批次至少执行 `type-check`、根目录 `lint:strict` 和相关规范审计；涉及契约的正式测试应检查保留的公共实现。

```bash
cd frontend
npm run check:component-adoption
```

该审计扫描所有 Vue 页面和公共组件，禁止任何原生 `<button>`，并检查公共组件入口存在。它还会拦截已移除的 `<BaseButton>` 和 `<ConfirmDialog>` 标签及同名组件文件，避免自动组件注册悄然恢复旧入口。

`check:dialogs` 已移除全部 6 个历史例外；原 12 处提醒、备份、分享及媒体工作台均迁入 `MobileDialog`。审计拦截业务直接 `el-dialog`、`el-image-viewer`、原生弹框与私有外壳视觉/间距令牌。SCSS 检查包含嵌套父级声明，内容网格、正文提示换行和滚动继续由业务维护。

`MediaPreviewViewer` 的素材类型统一引用 `utils/media.ts` 的 `MediaPreviewItem`；页面不得再声明同名类型。`deletable` 必须来自业务权限，删除回调使用查看器传入的实际素材/索引；有下载需求时启用 `downloadable` 并处理 `download` 事件，继续遵守[下载安全规范](download-security-standard.md)。自动组件发现已注册该入口，不重复手动注册。

它与 `check:ui`、`check:buttons`、`check:tables`、`check:empty-states`、`check:loading` 配合使用；采用率审计通过不代表详情弹窗或业务专用控件必须强行改成同一种实现。

最后核实日期：2026-11-11

## 手机记录详情

记录主表使用全局 `v-table-double-tap` 与 `useMobileTableDetail`；无专用详情时使用自动发现的 `RecordDetailDialog`，已有详情通过 `onOpen` 复用。字段类型统一为 `types/component.ts` 的 `RecordDetailField`，不在页面重复声明。描述列表使用 `RecordDescriptions`，保留字段显隐、插槽和属性，不再直接使用 `el-descriptions`。底部业务动作沿用原权限和处理函数，无动作无footer。输入/选择和关联明细用途见[表格规范](admin-table-standards.md#手机记录详情与底部操作)及 `check:mobile-details`，禁止恢复行内按钮展开。
