# 菜单图标管理规范

本规范说明菜单图标如何分页读取、在线检索、持久化和展示。实现入口为 `frontend/src/components/IconPicker.vue`、`frontend/src/components/IconRenderer.vue` 及 `backend/src/routes/icons.js`。

## 数据读取

- 图标目录以数据库 `icons` 表为准；前端不得内置完整图标目录。
- 图标选择器默认使用本地库，每次只请求当前页，默认每页 96 项。分类和关键词通过 `/icons` 查询参数交给后端筛选。
- 编辑已有菜单时，如果当前图标不在已加载页内，仅对本地图标 class 按需调用 `/icons/by-class` 精确获取；`iconify <prefix>:<name>` 由 `IconRenderer` 直接渲染，不请求本地图标接口。
- 本地分类通过 `/icons/categories` 获取。
- 接口不可用时，界面只使用 `IconPicker.vue` 中少量内置图标作为临时兜底，不将兜底项视为数据库完整目录。

## 在线图标

- 用户主动切换到在线模式并输入关键词后，选择器才请求 `/icons/search/online`；单次请求最多返回 100 项。
- 在线结果只是搜索候选。用户选中后，前端调用受认证和 `menus:view` 权限保护的 `POST /icons/cache`，由后端校验、清理 SVG 并写入图标库。
- 缓存写入失败时，当前界面仍可暂时显示所选图标；这不代表该图标已持久化到数据库。
- 不得在 Vue 管理的 DOM 中使用 Iconify 全局扫描、`refreshIconifyIcons()` 或类似方式直接改写节点。

## 展示与删除

- 菜单图标、侧边栏图标和选择器预览统一使用 `IconRenderer`。
- 本地数据库图标只有在没有菜单引用时才允许删除；服务端必须执行引用检查。
- 在线 Iconify 图标按图标 class 渲染；如果选择后需长期稳定展示，应先成功缓存到数据库。

## 接口概览

| 接口 | 用途 |
| --- | --- |
| `GET /api/icons?limit=96&page=1` | 分页读取本地图标，可按 `category`、`search` 筛选 |
| `GET /api/icons/by-class?class=...` | 仅精确加载当前菜单正在使用的本地图标 class；Iconify 图标不调用此接口 |
| `GET /api/icons/categories` | 读取分类 |
| `GET /api/icons/search/online?query=...&limit=100` | 按需在线检索 |
| `POST /api/icons/cache` | 经授权后将在线图标写入本地库 |
| `DELETE /api/icons/:id` | 删除未被菜单引用的本地图标 |

本地列表和在线搜索结果属于展示数据；写入与删除操作必须由后端授权和校验，不能依赖前端隐藏按钮。
