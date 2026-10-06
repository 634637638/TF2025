# TF2025 全局文字与排版规范

## 目标

所有后台页面、H5 管理页、手机端页面、弹窗、Tab、表格和公共组件统一使用同一套文字令牌。页面只选择文字语义，不直接写 `font-size` 数值；调整全站字号时只修改公共令牌。

## 唯一入口

文字令牌唯一维护在 `frontend/src/styles/_variables.scss`。`frontend/src/styles.scss` 中的 `--mobile-text-*` 仅作为历史兼容别名，不能新增；公共组件和业务页面必须读取 `--tf-font-*` 或 `--tf-type-scale-*`。

基础字体族、字重和行高也由 `_variables.scss` 统一维护。表格专用字号继续由 `admin-layout.css` 的 `--admin-data-table-*` 变量控制，但这些变量最终必须引用全局文字体系。

## 语义令牌

| 语义 | 令牌 | 默认值 | 手机端 | 超窄屏（不超过 375px） |
| --- | --- | ---: | ---: | ---: |
| 页面标题 | `--tf-font-page-title` | 24px | 18px | 17px |
| 区块标题 | `--tf-font-section-title` | 18px | 16px | 15px |
| 弹窗标题 | `--tf-font-dialog-title` | 16px | 16px | 15px |
| 正文 | `--tf-font-body` | 14px | 15px | 14px |
| 强调正文 | `--tf-font-body-lg` | 16px | 16px | 15px |
| 标签 | `--tf-font-label` | 14px | 14px | 13px |
| 按钮 | `--tf-font-button` | 14px | 14px | 13px |
| 辅助说明 | `--tf-font-caption` | 12px | 12px | 11px |
| 表头 | `--tf-font-table-header` | 13px | 13px | 11px |
| 表格内容 | `--tf-font-table-body` | 13px | 13px | 11px |
| 统计数值 | `--tf-font-stat-value` | 22px | 22px | 20px |
| 统计标签 | `--tf-font-stat-label` | 12px | 12px | 11px |

`--tf-type-scale-*` 是历史组件中无法直接归类的精确字号兼容层。新代码优先使用语义令牌；只有图标、特殊媒体标识、导出模板或确实独立的展示层才使用精确比例令牌，并在组件注释中说明用途。

## 使用规则

```scss
.page-title {
  font-size: var(--tf-font-page-title);
}

.field-label {
  font-size: var(--tf-font-label);
}

.table-value {
  font-size: var(--tf-font-table-body);
}
```

禁止在 `.vue`、`.css`、`.scss` 的业务样式中新增以下写法：

```scss
font-size: 14px;
font-size: 13px !important;
font-size: var(--some-token, 14px);
```

响应式字号只使用公共断点令牌。页面不得按 `320px`、`360px`、`390px`、`430px` 单独复制一套字号，也不得使用 `vw` 或 `clamp()` 让同一文字在不同设备连续缩放。

表格、按钮、表单控件、弹窗标题、Tab、分页、通知、空状态、Loading 和媒体预览都属于公共文字使用范围。它们可以使用各自组件令牌，但组件令牌必须在公共样式文件中定义，页面不能重复维护。

## 页面与功能单元审计

文字审计覆盖：

- `frontend/src/views/**/*.vue` 页面、Tab、弹窗和功能单元；
- `frontend/src/components/**/*.vue` 公共组件；
- `frontend/src/styles/**/*.css`、`frontend/src/styles/**/*.scss` 公共样式；
- 行内 `style` 中的字号声明。

页面范围以[前端页面与功能单元台账](page-audit-inventory.md)为准。当前台账统计为 128 个页面源文件和 72 个公共组件；审计脚本会在每次启动、开发和构建前重新扫描实际文件，防止台账新增页面漏接。

执行：

```bash
cd frontend
npm run check:typography
```

该检查会验证公共令牌完整性，并拦截页面私有字号和带数字 fallback 的字号。它与 `check:design-tokens` 同时接入 `check:standards`、`check:build` 前置流程。

## 维护边界

全局字号调整只修改 `_variables.scss`；表格尺寸调整修改 `admin-layout.css`；按钮、弹窗、Tab、分页等组件的字号调整修改对应公共组件样式。页面功能修改完成后必须同步运行文字审计，并在页面台账中记录审计结果。

最后更新：2026-10-06
