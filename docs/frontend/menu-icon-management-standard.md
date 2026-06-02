# 菜单图标管理规范

> 最后更新：2026-06-01

## 背景

菜单图标现在同时支持本地图标库和 Iconify 在线检索。为了保证菜单打开速度、图标预览一致性，以及避免 Vue 渲染节点被第三方脚本修改，菜单图标统一走数据库缓存和公共渲染组件。

## 统一目标

- 菜单图标选择默认使用本地图标库。
- 在线检索到的图标，选择后自动缓存到本地 `icons` 表。
- 页面再次打开时优先读取本地数据库中的图标，不依赖在线实时加载。
- 图标预览、菜单列表、侧边栏统一使用 `IconRenderer` 渲染。
- 禁止在 Vue 管理的 DOM 中使用 Iconify 全局扫描写法。

## 核心组件

### `IconPicker`

路径：`frontend/src/components/IconPicker.vue`

用于菜单编辑弹窗中的图标选择，负责：

- 加载本地图标：`GET /api/icons?limit=1000`
- 在线检索图标：`GET /api/icons/search/online`
- 选择在线图标后缓存：`POST /api/icons/cache`
- 删除未使用的本地图标：`DELETE /api/icons/:id`
- 按中文业务分类筛选图标

默认模式必须是 `本地`，在线检索由用户手动切换。

### `IconRenderer`

路径：`frontend/src/components/IconRenderer.vue`

用于所有菜单图标展示，负责：

- 优先渲染数据库保存的安全 SVG。
- 对 Iconify 图标使用 CSS mask URL 渲染。
- 对 Font Awesome class 走普通 `<i>` class 渲染。

后续菜单、侧边栏、图标预览等位置需要展示图标时，优先使用 `IconRenderer`。

## 后端接口

路径：`backend/src/routes/icons.js`

### 本地图标

- `GET /api/icons?limit=1000`：读取本地图标库。
- `GET /api/icons/categories`：读取有效图标分类。
- `DELETE /api/icons/:id`：删除未被菜单使用的图标。

删除图标前后端会检查 `menus.icon` 是否正在使用该图标。正在使用的图标不能删除，必须先更换菜单图标。

### 在线图标

- `GET /api/icons/search/online?query=关键词`：从 Iconify 在线检索。
- `POST /api/icons/cache`：把在线图标保存到本地 `icons` 表。

在线检索支持中文关键词，后端会将中文映射为多个英文候选词，再合并 Iconify 返回结果。

## 本地缓存流程

1. 打开菜单编辑弹窗。
2. `IconPicker` 默认进入本地模式。
3. 优先读取浏览器缓存，避免弹窗一直转圈。
4. 后台刷新 `/api/icons?limit=1000`。
5. 如果用户切换在线并选择图标，前端立即选中并调用 `/api/icons/cache`。
6. 后端拉取并清洗 SVG，写入 `icons` 表。
7. 下次打开弹窗时，该图标会出现在本地图标库中。

## 分类规则

在线图标保存时会自动归类为中文业务分类，例如：

- `导航`
- `用户客户`
- `系统管理`
- `权限安全`
- `销售收款`
- `库存仓储`
- `商品订单`
- `数据报表`
- `文件媒体`
- `通知消息`
- `工具操作`
- `时间日历`
- `地图位置`

分类字段可以使用中文。前端筛选器会优先原样显示中文分类；英文分类会映射为中文展示名。

## 禁止写法

不要在 Vue 组件中新增下面这些 Iconify 全局扫描写法：

```vue
<span class="iconify" data-icon="mdi:home"></span>
```

```ts
refreshIconifyIcons()
waitForIconify()
```

也不要依赖下面这种选择器触发第三方 DOM 扫描：

```css
.iconify[data-icon]
```

原因是 Iconify 全局扫描可能会直接修改 Vue 管理的 DOM，导致偶发错误：

- `Cannot read properties of null (reading 'insertBefore')`
- `Cannot set properties of null (setting 'nodeValue')`

正确方式是传入图标 class 或 SVG，由 `IconRenderer` 统一渲染。

## 新增页面接入规则

需要展示菜单图标时：

```vue
<IconRenderer
  :icon="menu.icon"
  :svg="menu.iconSvg"
  fallback="fas fa-circle"
/>
```

需要选择菜单图标时：

```vue
<IconPicker v-model="form.icon" />
```

不要在业务页面内单独实现图标检索、图标缓存、Iconify DOM 扫描逻辑。

## 数据一致性

- 菜单保存的是 `menus.icon`。
- 图标库保存的是 `icons.class`、`icons.svg`、`icons.iconify_name`、`icons.source`、`icons.category`。
- 在线图标被选中后会先写入 `menus.icon`，再异步缓存到 `icons` 表。
- 删除本地图标时，如果该图标仍被菜单引用，后端会拒绝删除。

如果发现预览空白，优先检查：

- `icons.svg` 是否为空。
- `icons.is_valid` 是否为 `0`。
- `menus.icon` 是否能在 `icons.class` 中找到。
- 展示位置是否使用了 `IconRenderer`。

## 当前已处理

- 菜单编辑弹窗图标选择已统一使用 `IconPicker`。
- 菜单图标展示已统一走 `IconRenderer`。
- 侧边栏和移动端菜单已移除旧 Iconify 全局刷新逻辑。
- 在线图标选择后会自动缓存到本地图标库。
- 本地图标支持删除，正在被菜单使用的图标会被后端阻止删除。
