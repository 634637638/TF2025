# 全局图标规范

## 图标来源

| 场景 | 入口 | 规则 |
| --- | --- | --- |
| 页面内静态操作/状态图标 | Font Awesome class，例如 `fas fa-search` | 用于代码固定的界面语义，不保存为用户数据 |
| 菜单、权限模块等数据库动态图标 | `IconRenderer` | 统一支持本地图标 class、Iconify 名称和已保存 SVG |
| 用户选择图标 | `IconPicker` / `IconSelector` | 选择器只负责选择，最终展示仍走 `IconRenderer` |
| Iconify 图标 | `IconRenderer` / `IconPicker` | `iconify <prefix>:<name>` 由前端直接渲染，不请求 `/icons/by-class`；本地 Font Awesome 等 class 才按需查询图标表 |
| SVG 内容 | `IconRenderer` | 必须经 DOMPurify 的 SVG profile 清洗；业务页面禁止自行 `v-html` 图标字符串 |

动态菜单图标由数据库按当前菜单/权限数据返回，不应为了渲染一个图标而在应用启动时加载整套图标目录。Iconify 图标以名称解析并按需请求图标资源；不得把数据库字段拼成任意 HTML 或未经编码的 URL。

## 尺寸与颜色

- 图标默认按 `1em` 尺寸，跟随相邻文字字号；需要强调时由语义 class 或父级排版控制尺寸。
- SVG `fill`、Iconify mask 使用 `currentColor`，颜色继承按钮、菜单或文本的语义颜色。
- 纯图标按钮必须提供 `title`、tooltip 或 `aria-label`；装饰性图标使用 `aria-hidden="true"`。
- 不在页面中复制 icon font、SVG 容器或 Iconify mask 的基础实现。

## 审计

```bash
cd frontend
npm run check:icons
```

审计验证动态 SVG 清洗、Iconify 解析、尺寸/颜色继承及菜单图标消费者是否使用公共 renderer。静态业务图标可以保留 Font Awesome class。

最后更新：2026-10-06
