# 菜单图标管理规范

本文规定图标检索、持久化和菜单表单的操作边界。全局显示、公共 API、类型与净化入口以[全局图标规范](icon-standards.md)为准，不维护第二套图标实现。

## 数据读取

- 图标目录以数据库 `icons` 表为准，前端不得内置完整目录。
- `IconPicker` 默认使用本地库，仅请求当前页，每页 96 项；分类与关键词通过 `iconService.list` 交给后端筛选。
- 本地分类通过 `iconService.categories` 获取。已有图标不在当前页时，只按 class 精确读取；Iconify 名称缺少 SVG 时由 `IconRenderer` 的本地读取入口负责，不重复查询完整目录。
- 接口不可用时可以用选择器内少量静态图标临时兜底，不能将其视为完整数据库目录。

## 在线选择与保存

1. 用户主动切到在线模式并输入关键词后，才调用 `/icons/search/online`，单次最多 100 项。搜索候选只用于预览，不自动把全部结果写入数据库。在线结果每页 24 项，使用独立的在线分页；本地分类在在线模式隐藏。当前页通过 `/icons/preview?names=集合:名称,...` 批量读取预览，失败显示原因并提供重试，搜索失败不混入本地目录。
2. 选中候选后调用受认证和 `menus:view` 权限保护的 `POST /icons/cache`。后端优先复用已有有效 SVG；缺少时从固定 Iconify JSON 地址取得数据，通过官方工具转换为 SVG、清理并保存名称、分类、标签和 SVG。
3. 下载失败或未得到有效 SVG 时返回失败，不写入无效图标，也不覆盖原有记录。前端必须同时检查成功响应、匹配的 class、有效状态和 SVG，不能将空资源视为成功。
4. 保存期间保留原选中值，显示“正在保存图标...”，忽略重复点击，并通过 `saving-change` 通知父表单。菜单保存按钮禁用，提交入口也检查该状态。
5. 只有保存成功后才触发 `update:modelValue` 和 `select`，`select` 同时传回已入库记录及 SVG，父表单直接更新预览。失败通过统一通知反馈、保留原值并允许重试，不伪造本地缓存成功。
6. 关闭或卸载选择器后，迟到的保存响应不能继续修改父表单；搜索防抖定时器应清理，搜索和预览通过 `useLatestRequest` 取消旧请求并拒绝迟到响应。

## 展示与删除

菜单接口关联 `icons` 表返回 `icon_svg`，桌面侧栏、手机菜单、菜单管理、页面标题和页签全部使用 `IconRenderer`。SVG 已随菜单返回时直接显示，不额外请求图标网站；只有名称时按需查站内库，缺失时使用本地占位。旧记录没有 SVG 时由管理员重新选择保存，普通页面不会自动下载或写入。

本地图标只有未被菜单引用时才允许删除，后端必须检查引用关系。删除、缓存等写入操作均由后端鉴权，不能依赖前端隐藏按钮。

旧 `IconSelector` 保留原字符串 modelValue 接口，但目录、检索和保存统一委托 `IconPicker`，不得重新维护独立目录、分页、分类或渲染实现。

## 接口概览

| 接口 | 用途 |
| --- | --- |
| `GET /api/icons?limit=96&page=1` | 分页本地目录，支持 `category`、`search` |
| `GET /api/icons/by-class?class=...` | 精确读取已入库图标，包含 SVG；支持 Iconify class；`optional=1` 时未入库返回成功空数据，默认仍为 404 |
| `GET /api/icons/categories` | 本地分类 |
| `GET /api/icons/search/online?query=...&limit=100` | 用户主动在线检索 |
| `GET /api/icons/preview?names=lucide:phone,mdi:phone` | 当前页预览，最多 24 个有效名称；受认证、`menus:view` 与限流保护；不读写数据库，部分失败对应 SVG 为 null |
| `POST /api/icons/cache` | 保存在线图标；有效 SVG 缺失且下载失败时返回 502 |
| `DELETE /api/icons/:id` | 删除未被菜单引用的图标 |

## 验证

图标审计和前端行为命令见[全局图标规范](icon-standards.md#审计与回归)。后端定向回归为：

```bash
node --test backend/test/icon-controller.check.js backend/test/user-menu-controller.check.js
```

上述测试使用替身验证权限声明、写入和拒绝行为，不向真实数据库写入，也不替代线上 Iconify 服务、浏览器和真机验收。

后端部署需同时上传 `package.json`、`package-lock.json` 并安装生产依赖，官方图标转换库为运行时依赖；只上传业务 JS 会导致预览转换失败。
