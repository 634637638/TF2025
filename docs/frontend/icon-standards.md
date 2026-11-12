# 全局图标规范

本规范是全局图标的唯一强制正文；菜单的在线检索与入库流程见[菜单图标管理规范](menu-icon-management-standard.md)。两者已登记在 `standards-manifest.json`，由 `check:icons` 接入启动与构建门禁。

## 唯一公共入口

| 场景 | 公共入口 | 规则 |
| --- | --- | --- |
| 菜单、页签、权限模块、分类、提醒及页面配置中的动态图标类 | `IconRenderer.vue` | 数据字段不得直接绑定原生 `i` 的 class，也不在页面复制 SVG、Iconify URL 或净化逻辑 |
| 选择本地或在线图标 | `IconPicker.vue` | 在线图标必须保存成功后才确认选择；旧 `IconSelector.vue` 只保留对公共选择器的弹窗包装 |
| 图标 API | `services/icons.ts` 的 `iconService` | 目录、分类、搜索、精确读取、缓存和删除全部复用 `unifiedApi`，沿用 JWT、CSRF/XSRF 与统一错误处理 |
| 图标业务实体与写入契约 | `types/icon.ts` | `IconRecord`、`CacheIconPayload` 是唯一业务类型，不在页面复制定义 |
| SVG 净化 | `utils/icon-svg.ts` 的 `sanitizeIconSvg` | 使用 DOMPurify，移除脚本、事件、嵌入内容、样式与外部资源引用；页面禁止自行 `v-html` 图标字符串 |
| Iconify 名称解析、静态图标字体 | `utils/iconify.ts` | 只保留名称解析和现有 Font Awesome 样式入口，不注入 Iconify 全局脚本、不扫描 Vue DOM |

`IconRenderer`、`IconPicker` 由现有 Vite `unplugin-vue-components` 自动解析，页面可直接使用，无需另建一套全局注册或重复封装。公共组件内部或未使用该插件的测试环境按既有方式显式导入或提供组件 stub。

代码固定的操作、状态图标及固定状态切换可以继续使用 Font Awesome class 或现有组件库图标；这些不是用户图标数据，不要求写入数据库。静态 Font Awesome 字体仍由原公共样式入口加载，当前来源为 CDN；本规范不把整个站点描述成完全离线。新增需要支持配置、数据库图标或任意图标名称的调用方必须使用 `IconRenderer`。

## 本地展示与在线预览边界

普通 `IconRenderer` 按以下顺序显示：

1. 优先使用调用方随菜单或业务数据传入的 `svg`，经公共净化后渲染。
2. 只有 Iconify 名称且未提供 SVG 时，按 class 精确读取站内 `/icons/by-class`；同一图标的并发请求合并，不在启动时加载完整目录，也不持久缓存旧 SVG。
3. 数据库没有有效 SVG 或站内读取失败时，显示随前端打包的本地占位 SVG，绝不自动回退外站或在读取时写数据库。静态 Font Awesome class 继续按原样显示。

只有 `IconPicker` 的在线搜索候选可显式设置 `online-preview`，用于跳过逐个查本地库。候选预览统一调用站内 `/icons/preview`，后端按集合批量获取 Iconify JSON，并用官方 `@iconify/utils` 解析尺寸、别名及旋转/翻转为 SVG；前端净化后直接渲染。浏览器禁止直接请求外站 SVG 或使用外站 mask。普通页面、菜单、页签和已选图标不得启用此属性。预览不写数据库，选中后的持久化仍须等待入库成功。

在线搜索最多返回 100 项，每页 24 项；翻页只切在线结果并请求当前页预览，不加载本地目录。本地分类不用于筛选在线结果。预览失败显示原因、候选失败状态和重试入口，不能只留空白卡片，也不能把搜索失败伪装成本地搜索成功。搜索与预览复用 `useLatestRequest`，切换关键词、模式、页面或卸载时旧响应不能覆盖新状态。

精确读取的可选查询使用 `optional=1`：未入库返回成功空数据并显示占位，不制造正常缺失的 404 错误；未开启该参数的接口仍保留 404，数据库或路由异常不被吞掉。

```vue
<IconRenderer :icon="menu.icon" :svg="menu.icon_svg" aria-hidden="true" />
```

历史图标若只保存名称、没有有效 SVG，需要在菜单管理中重新选择并成功保存；普通页面不会偷偷补下载。数据库有效 SVG 已存在时，重复选择可复用本地内容，无需重新访问外站。

## 尺寸、颜色和安全

- 默认使用 `1em`，跟随相邻文字；公共根节点保留 `i`，兼容既有静态图标的父级排版和响应式样式。
- SVG 和在线预览继承 `currentColor`，保留 SVG 显式的 `fill="none"`，避免描边图标被错误填实。尺寸与间距复用父级公共令牌，不在页面复制公共渲染样式。
- 纯图标按钮必须有 `title`、tooltip 或 `aria-label`；装饰图标可设 `aria-hidden="true"`。
- 外部搜索只由后端固定 Iconify 地址执行；站内凭证不得发送给第三方。前端在线候选只请求站内批量接口，不向第三方发送站内凭证。后端 JSON 按 URL 合并在途请求并缓存 5 分钟、最多 100 项；失败不缓存，单次最多 24 个名称、最多 4 个集合并发，沿用登录、`menus:view` 与在线图标限流。

## 审计与回归

```bash
npm --prefix frontend run check:icons
npm --prefix frontend run test:unit -- tests/icon-picker.spec.ts tests/icon-renderer.spec.ts tests/icon-service.spec.ts
```

审计遍历全部 Vue 模板，阻止数据图标类直接绑定原生 `i`、页面私自打开在线预览及重复在线资源入口，并检查公共消费者、SVG 净化和旧选择器的委托关系。正式正反例位于 `frontend/scripts/check-icon-standards.test.mjs`；行为测试覆盖保存前不改值、失败重试、重复点击、卸载清理、本地读取、过期响应、并发合并及 SVG 安全。

最后更新：2026-11-12
