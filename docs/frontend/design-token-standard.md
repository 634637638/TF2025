# TF2025 视觉令牌统一规范

## 公共入口

基础令牌只在 `frontend/src/styles/_variables.scss` 定义；移动端语义字号令牌统一在 `frontend/src/styles.scss` 的 `:root` 和 `max-width: 375px` 断点定义。业务页面和公共组件按语义读取 CSS 变量，不直接复制相同的圆角、阴影、间距、字号或层级数字。

| 类型 | 现行令牌 | 用途 |
| --- | --- | --- |
| 间距 | `--tf-space-1` 至 `--tf-space-8` | 4、8、12、16、20、24、32、48px |
| 圆角 | `--tf-radius-control`、`--tf-radius-card`、`--tf-radius-panel`、`--tf-radius-dialog`、`--tf-radius-full` | 控件、卡片、面板、弹窗、圆形元素 |
| 阴影 | `--tf-shadow-card`、`--tf-shadow-popover`、`--tf-shadow-dialog`、`--tf-shadow-floating` | 卡片、下拉层、弹窗和悬浮层 |
| 字号 | `--tf-font-caption`、`--tf-font-body`、`--tf-font-body-lg`、`--tf-font-section`、`--tf-font-title` | 辅助、正文、强调正文、区块标题、页面标题 |
| 层级 | `--tf-z-sidebar`、`--tf-z-dropdown`、`--tf-z-drawer-overlay`、`--tf-z-drawer`、`--tf-z-dialog-sheet`、`--tf-z-dialog`、`--tf-z-loading`、`--tf-z-toast`、`--tf-z-message`、`--tf-z-lock`、`--tf-z-viewer`、`--tf-z-message-box`、`--tf-z-popper`、`--tf-z-permission-tooltip` | 导航、下拉、抽屉遮罩/菜单、弹窗、Loading、消息、锁屏、预览器和浮层 |

按钮、弹窗、弹窗操作区、标签页、分页、抽屉、Loading、消息、媒体预览和全屏锁定层读取这套基础令牌；新增公共组件也必须从这些语义入口取值。公共操作区与标签页中的 4/8/12/16px 间距使用对应 `--tf-space-*` 令牌，6px、10px 等不在全局阶梯内的控件专用值保留为组件令牌。Element Plus 必须覆盖时，只在组件公共样式中建立语义别名，不在业务页面复制一组数字。

表单控件是强制唯一入口：普通输入、选择、日期、数字和文本域的圆角、高度、聚焦外圈、边框连续性和数字按钮行为统一由 `frontend/src/styles/components/_form-controls.scss` 维护。业务页面不得直接设置这些控件的 `border-radius`、`height`、`min-height`、聚焦 `box-shadow` 或聚焦边框颜色；检索面板和表格排序的紧凑高度只能由对应公共组件维护。

## 使用边界

- 业务页面可以因内容尺寸使用局部值，但通用控件和页面壳不得重新定义同一类视觉值。
- 图表颜色、业务状态颜色和品牌色继续遵循[颜色令牌规范](color-token-standard.md)，不混入间距或层级令牌。
- Teleport 浮层必须使用公共层级；页面不得通过继续提高 `z-index` 解决层叠问题。
- 历史页面中的字面量会逐步迁移，审计先保证公共入口和令牌定义不回退，再按页面批次减少存量。

## 审计

```bash
cd frontend
npm run check:design-tokens
```

审计检查基础令牌完整性，以及按钮、弹窗、弹窗操作区、标签页、分页、抽屉、Loading、消息、媒体预览和锁屏层是否实际读取公共令牌。颜色、`!important` 和响应式断点仍由各自专项审计负责。

全局字面量门禁覆盖 Vue 样式块、Vue 内联 `style`、CSS 和 SCSS 中的圆角、阴影、字号、间距与层级。历史字面量保存在 `frontend/scripts/design-token-adoption-baseline.json`：新增值、在新文件中使用历史硬编码值，或扩大现有文件的字面量数量都会失败；迁移为令牌后不得把基线数值加回。仅可在已知存量完全迁移且经过回归验证后重建基线。

此基线是渐进式迁移门禁，不代表存量已经全部令牌化。每次整理页面时应优先替换该页面基线中的间距、字号、圆角、阴影和层级字面量；不得通过更新基线来消除审计错误。

最后更新：2026-10-01
