# 全局打印样式规范

## 公共入口

全局打印规则由 `frontend/src/styles/components/_print.scss` 提供，并通过 `frontend/src/styles.scss` 加载。

| 用途 | class |
| --- | --- |
| 打印时隐藏 | `.no-print` 或 `data-print-hidden="true"` |
| 仅打印显示 | `.print-only` |
| 从新页开始/结束 | `.print-break-before`、`.print-break-after` |
| 内容块避免分页拆开 | `.print-avoid-break` |

## 规则

- 普通页面使用公共 class 控制打印显隐和分页，不在业务组件重复定义基础打印重置。
- 打印时不要依赖屏幕端固定高度、滚动容器或定位；长内容应可完整展开。
- 新窗口生成的合同、收据等独立打印文档可以内嵌专属 CSS，但必须明确其独立文档边界，并登记审计例外。
- 字段权限不得因打印模式绕过；打印只改变呈现，不得补回用户无权读取的数据。

当前允许的专用例外为品牌目录纸张布局、独立入库单/详情打印视图和独立租赁合同 HTML。新增例外必须说明用途并更新审计，不能把普通页面样式登记为豁免。

```bash
cd frontend
npm run check:print
```

最后更新：2026-10-01
