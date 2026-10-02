# TF2025 响应式断点统一规范

## 唯一来源

断点的唯一配置入口是 `frontend/src/config/breakpoints.ts`。样式令牌镜像位于
`frontend/src/styles/_variables.scss` 和 `frontend/src/styles/responsive.scss`；三处的数值必须保持一致。

| 名称 | 数值 | 用途 |
| --- | ---: | --- |
| `MIN` | `375px` | 项目最低适配宽度 |
| `SMALL_MOBILE_MAX` | `479px` | 小屏手机上限 |
| `MOBILE_MAX` | `767px` | 手机布局上限 |
| `TABLET_MIN` | `768px` | 平板布局起点 |
| `TABLET_MAX` | `1024px` | 平板布局上限 |
| `DESKTOP_MIN` | `1025px` | 后台桌面导航和桌面壳起点 |
| `WIDE_MIN` | `1200px` | 宽屏增强起点 |
| `ULTRA_WIDE_MIN` | `1440px` | 超宽屏增强起点 |

`1024px` 属于平板范围，`1025px` 才进入后台桌面壳。工具函数和 CSS 条件必须覆盖这些边界，不能出现 479/480、767/768 或 1024/1025 之间的空档和重复归类。

## 使用规则

- TypeScript 判断使用 `BREAKPOINTS`、`deviceType`、`isDesktopNavigationViewport` 或 `useMediaQuery`，禁止在业务逻辑中重复写数字。
- 新增 CSS 优先使用手机 `max-width: 767px`、小屏 `max-width: 479px`、平板 `min-width: 768px` 到 `max-width: 1024px`、桌面 `min-width: 1025px`。
- `1200px` 和 `1440px` 只用于宽屏增强；不能用来决定后台菜单的移动/桌面切换。
- 组件确有内容尺寸需要的局部阈值时，必须保留明确原因，并在审计基线中登记；不得继续增加新的机型专用断点。
- 横屏、高度、悬停能力和打印查询属于不同维度，不计入宽度断点统一规则，但仍需说明适用场景。

现有 `360px`、`380px`、`390px`、`400px`、`420px`、`480px`、`1023px` 等历史查询曾登记 111 处；2026-10-01 最近审计实测降至 79 处。基线仍以 111 作为防回涨上限，存量只能逐步减少，不能新增；详情和门禁由 `frontend/scripts/check-responsive-breakpoints.mjs` 与 `responsive-breakpoint-baseline.json` 维护。

## 审计

```bash
cd frontend
npm run check:responsive
```

该命令检查公共配置边界、样式变量使用的断点集合，以及历史局部断点数量。它已接入 `npm run check:standards`、开发启动和生产构建。

## 相关入口

- [移动端开发规范](../guides/mobile-development-standards.md)
- [移动端响应式设计指南](../guides/MOBILE_RESPONSIVE_GUIDE.md)
- `frontend/src/config/breakpoints.ts`
- `frontend/src/styles/_variables.scss`
- `frontend/src/styles/responsive.scss`

最后更新：2026-10-01
