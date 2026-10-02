# TF2025 全局颜色令牌与语义色规范

本文规定前端颜色的定义位置、语义分层和页面使用边界。业务页面只能使用已登记的令牌或语义 class，不得为同一类状态重新定义颜色。

## 颜色入口

颜色不是由单一文件承担，而是按职责分层维护：

| 层级 | 唯一维护入口 | 职责 |
| --- | --- | --- |
| 基础颜色令牌 | `frontend/src/styles/_variables.scss` | 基础色板、文本、边框、背景、兼容别名和跨组件通用令牌 |
| 普通按钮语义色 | `frontend/src/styles/components/_buttons.scss` | 主操作、成功、警示、危险、查看、管理、财务、调货、导出及工具按钮 |
| 弹窗语义色 | `frontend/src/styles/components/_dialog.scss`、`_dialog-actions.scss` | 弹窗遮罩、表面、标题、正文、footer 和确认框语义 |
| 后台页面与表格色 | `frontend/src/styles/admin-layout.css` | 页面背景、统计卡片、表头、行状态、表格操作兼容别名 |
| 业务状态色 | 对应公共组件或已登记的语义 class | 状态徽章、设备成色、金额和图表等业务含义；不得复制全局按钮或表格色板 |

以上文件由 `frontend/src/main.ts` 或 `frontend/src/styles.scss` 全局加载。修改全局颜色时，必须在对应入口修改，不得在业务页面建立第二套色板。

## 使用规则

- 普通命令按钮使用[全局按钮统一规范](button-standards.md)的语义 class 或 Element Plus 语义类型。
- 统计卡片使用[后台统计卡片颜色规范](admin-stat-card-color-standard.md)的 `stat-card--*` 和 `--admin-stat-color-*`。
- 表格、列表卡片和操作区使用[后台卡片与表格统一规范](admin-table-standards.md)的 `--admin-data-table-*`、`--admin-action-*` 和按钮语义令牌。
- 弹窗使用[对话框统一规范](dialog-standards.md)的 `--tf-dialog-*`；弹窗 footer 按钮使用 `--tf-button-*`。
- 通知、加载、标签页、空状态和分页使用各自规范登记的公共入口，不直接复制颜色。
- 业务状态颜色可以表达业务含义，但必须使用语义名称，例如 `success`、`warning`、`danger`、`new`、`used`、`income`；不得按页面位置或随机色值配色。

## 禁止事项

- 不在 Vue 组件、页面 scoped style、业务 SCSS 或行内 `style` 中新增十六进制、`rgb()`、`rgba()`、`hsl()`、`white` 或 `black` 颜色。
- 不在 `_table.scss`、`_dialog-actions.scss`、`_tabs.scss` 或 `admin-layout.css` 中新增第二套按钮颜色。
- 不使用 `.text-danger`、`.bg-orange`、`.btn-danger` 等旧工具类作为新增代码的全局颜色方案；迁移到当前语义令牌和公共 class。
- 不以 `nth-child`、页面顺序或组件名称决定统计卡片和状态颜色。
- 不把颜色令牌写入业务数据、权限配置或后端接口作为前端样式替代。

## 兼容与迁移

`--color-*`、旧 `--dialog-*`、`--admin-action-*` 以及旧 `.btn-*` 只作为兼容边界保留。新增代码不得扩展这些旧入口；需要修改语义时，应先更新当前公共入口，再由兼容别名指向现行令牌。

## 验证

在 `frontend` 目录执行：

```bash
npm run check:style-debt
npm run check:buttons
npm run check:ui
npm run build
```

其中样式债务审计负责检查非令牌颜色使用点，按钮审计负责按钮语义和颜色来源，统一 UI 审计负责弹窗等公共结构。审计通过不代表视觉设计已经覆盖线上浏览器；发布前仍需检查桌面和移动端页面。
