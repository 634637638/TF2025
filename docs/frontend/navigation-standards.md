# 后台导航与面包屑视觉规范

后台顶部栏、标签页、面包屑、桌面侧边栏、手机侧滑菜单及二级菜单属于同一个导航壳，但分为两种视觉层级：顶部栏默认白色，侧边栏和侧滑菜单使用紫色导航背景。PC 端使用固定侧栏，不显示面包屑或手机菜单入口；手机端和 iPad/平板端才显示面包屑及菜单入口。导航区域不得由 Element Plus 默认样式或页面私有颜色单独控制。

## 公共实现

导航令牌定义在 `frontend/src/styles/_variables.scss`：

- `--tf-nav-topbar-bg`：顶部栏、标签页和面包屑背景，默认白色；顶部栏中的菜单入口按钮不覆盖容器颜色，按钮自身使用紫色品牌背景。
- `--tf-nav-topbar-text`、`--tf-nav-topbar-border`：顶部栏文字与边框。
- `--tf-nav-header-bg`：侧边栏和侧滑菜单主背景。
- `--tf-nav-surface-color`：不支持渐变的菜单容器背景。
- `--tf-nav-submenu-surface-color`：遗留 `el-menu` 二级菜单背景。
- `--tf-nav-submenu-bg`：二级菜单透明层级。
- `--tf-nav-item-hover-bg`、`--tf-nav-item-active-bg`：悬停和当前项状态。
- `--tf-nav-border`、`--tf-nav-header-text`：边框与对比文字。

实际入口统一为 `SimpleAdminView → SimpleSidebar`（桌面）或 `SimpleAdminView → ResponsiveMenu → MobileSlideMenu`（手机/平板）。`ResponsiveLayout` 仅保留为通用内容布局组件，不承载后台菜单；旧的 `DynamicSidebar` 已退役。

## 导航与权限链路

- 菜单数据统一由 Pinia `menuStore` 从 `/permissions/user-menu` 加载。
- `SimpleSidebar`、`MobileSlideMenu` 只负责展示、展开和派发 `menu-click`，不得直接调用 `router.push`，也不得在组件内复制权限判断。
- `SimpleAdminView` 是后台菜单点击的统一入口：外部链接通过新窗口打开，内部链接先调用 `canAccessRoutePath`，再交给 Vue Router；路由守卫负责最终认证、角色和权限校验。
- PC 与手机端可以使用不同展示组件，但必须派发同一种 `menu-click` 事件，不能形成两套导航行为。
- 后台手机端的完整菜单由 `MobileSlideMenu` 承载；后台不维护未渲染的底部导航状态，菜单不得被分流或自动隐藏。
- `ResponsiveLayout` 不得重新承担后台菜单职责；后台不得重新引入已退役的 `DynamicSidebar` 或其他历史菜单容器。

## 强制要求

1. 顶部栏和标签页必须使用 `--tf-nav-topbar-bg`，该令牌默认白色；面包屑仅在手机端和 iPad/平板端渲染，也必须使用该白色令牌；PC 端不得额外渲染面包屑或菜单入口按钮，不得直接硬编码颜色。
2. 一级菜单、二级菜单、激活态和悬停态只能通过导航令牌表达；二级菜单不得复制一套颜色。
3. 菜单图标和文字沿用 `IconRenderer` 及导航对比色；手机端菜单入口使用本地 `frontend/src/assets/icons/menu-bars.svg` 三条横杠（不依赖外部图标服务）、`--tf-color-indigo-brand` 品牌靛蓝背景和白色图标，悬停/聚焦使用 `--tf-color-purple-brand`；PC 端不显示手机菜单入口，其他操作按钮继续遵循各自语义色。入口的 `40px` 宽高、`12px` 圆角和 `20px` 图标由公共按钮令牌控制。顶部栏和面包屑容器仍保持 `--tf-nav-topbar-bg` 白色。手机端展开菜单后入口按钮降到遮罩层后方隐藏，点击遮罩关闭，不在菜单内部复制关闭按钮；二级展开按钮使用 `tf-button--menu-action` 无背景图标按钮，视觉上与 PC 端 chevron 一致，不得出现圆形背景遮挡一级菜单名称。
4. 手机菜单头部不展示头像，姓名和角色标签必须在同一行排列；姓名允许省略，角色标签不得被压缩。一级菜单名称必须单行显示，超出后台配置宽度时省略，不得被右侧箭头覆盖或换行。PC 与手机一级菜单统一使用 `--tf-nav-menu-text-size`，一级菜单行高统一使用 `--tf-nav-menu-item-height`（当前 `50px`），二级菜单保持 `48px` 最小高度，箭头统一使用 `--tf-nav-menu-arrow-size`。
5. PC 和手机端菜单宽度必须统一读取 `useMenuWidth` 的后台配置值，组件不得自行设置固定最小宽度、最大宽度或覆盖配置。
6. PC 与手机端可以使用不同展示组件，但必须共享菜单数据、权限判断和导航令牌；新页面不得新增第三套导航壳。
7. 新增、删除或迁移导航入口时，必须同步更新页面台账、规范清单和本文件。
8. 菜单子组件不得自行跳转或自行提示权限错误；权限提示和跳转失败处理只能由主布局统一维护。

## 审计

执行 `npm run check:navigation` 检查公共令牌接入、白色背景残留和遗留菜单硬编码。该检查已纳入 `npm run check:standards`，未通过时不得提交导航视觉变更。

同时执行 `npm run check:buttons` 验证默认按钮基线采用 `:where()`，防止高优先级白色背景盖住公共菜单、关闭或箭头按钮。浏览器验收需检查手机、平板下的实际颜色与尺寸、PC 入口隐藏及展开后点击遮罩关闭，不能仅凭源码中存在颜色声明判断通过。

## 维护记录

| 日期 | 变更 | 结果 |
| --- | --- | --- |
| 2026-10-06 | 收口顶部栏、标签页、面包屑、桌面/移动菜单及二级菜单背景令牌；顶部栏明确保持白色，菜单保持紫色；顶部菜单入口按钮使用紫色背景和白色图标 | 已接入 `check:navigation`，后续新增导航必须按本规范登记 |
| 2026-10-06 | 统一 PC/手机 `menu-click` 事件和主布局权限预检，修复手机菜单错误分流导致的菜单缺失 | 子组件不再直接跳转，完整后台菜单由侧滑菜单承载 |
| 2026-10-06 | 退役无运行时引用的 `DynamicSidebar`，移除 `ResponsiveMenu` 的桌面兼容分支；保留 `ResponsiveLayout` 作为通用内容布局 | 后台只保留一套 PC/手机导航入口 |
| 2026-10-06 | 修复默认按钮基线优先级覆盖公共语义，替换误用的四格 `Menu` 图标为本地三横杠 SVG | Chrome 实际组件验证：390px、820px 入口背景为 `#667eea`、图标白色、按钮 40px；桌面隐藏；遮罩关闭正常。安卓与苹果真机待复核 |
| 2026-10-06 | 一级菜单行高从 `56px` 调整为 `50px`，二级菜单仍保持 `48px` 最小高度 | 由 `--tf-nav-menu-item-height` 统一控制，需在真实手机/平板上复核整体密度 |
