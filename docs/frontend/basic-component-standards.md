# 基础控件规范

## 标准入口

后台页面和管理表单使用 Element Plus 控件及项目全局主题，不为相同交互复制原生控件皮肤。

| 语义 | 标准组件 |
| --- | --- |
| 单选/复选 | `el-radio`、`el-radio-group`、`el-checkbox`、`el-checkbox-group` |
| 开关/范围 | `el-switch`、`el-slider` |
| 标签/徽标 | `el-tag`、`el-badge`，颜色使用 Element Plus 语义类型或项目状态令牌 |
| 步骤/进度 | `el-steps`、`el-progress` |
| 骨架占位 | `el-skeleton`，只用于结构已知的初始加载；后台刷新使用全局 Loading 规范 |
| 抽屉 | `el-drawer` + 全局 `tf-drawer` 样式；导航侧栏继续使用 `MobileSlideMenu` |

Checkbox/Radio 要有可点击文本标签并使用稳定值；需要“全选/半选”时使用组组件或原生状态映射，不手工模拟可访问性状态。Switch 文案必须明确开/关语义。Slider 必须提供范围、当前值和键盘操作。Tag/Badge 只表达状态或计数，不代替按钮。Steps/Progress 需把当前进度同时提供给辅助技术可读文本。

基础表单字段、校验和禁用状态以[表单控件规范](form-control-standards.md)为准；按钮、空状态和 Loading 分别以各自专项规范为准。

## Drawer

Drawer 内容区可滚动，宽度不得超过视口；方向和尺寸由业务明确设置。手机筛选抽屉避免占满后无法关闭，始终保留 Element Plus 关闭按钮/遮罩关闭行为。普通页面不得自建第二种 Drawer 外壳。

公共尺寸和标题/内容/footer 边界由 `frontend/src/styles/components/_drawer.scss` 控制。导航菜单不是业务 Drawer，不得把 `el-drawer` 复制为新的导航壳。

## 原生控件迁移

浏览器原生 radio/checkbox/range 存量由 `frontend/scripts/basic-control-adoption-baseline.json` 逐文件跟踪；新增普通业务用法必须使用标准组件。扫码、文件、画布编辑等浏览器能力例外需说明原因，并减少而非扩大基线。

```bash
cd frontend
npm run check:basic-components
npm run check:drawers
```

最后更新：2026-10-01
