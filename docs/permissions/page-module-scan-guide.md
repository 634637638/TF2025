# 页面扫描与模块注册规范

> **文档说明**：说明 TF2025 在 `src/views` 目录下新增页面后，模块扫描器如何识别“独立页面”和“子组件”，以及推荐的命名和目录规范。
>
> **最后更新**：2026-03-21
> **版本**：v1.0.0
> **维护者**：TF2025 开发团队

## 适用范围

本规范适用于以下场景：

- 新增一个需要进入权限系统的独立页面
- 将原页面迁移到 `page/` 目录
- 新增弹窗、Tab、明细块、局部组件
- 执行模块扫描、模块同步、菜单模块自动绑定

## 核心原则

- 扫描器只识别“真正的页面模块”，不应把弹窗和局部组件误扫成模块。
- 页面是否能被扫描，不只看目录，还看它是不是一个真实路由页面。
- `modules.key` 必须稳定，不能因为目录整理而频繁变化。
- `page/` 是页面子目录，不等于里面所有文件都是模块页面。

## 当前扫描规则

### 会被扫描成模块的文件

以下文件会进入模块扫描结果：

- `src/views/<module>/<PageName>.vue`
- `src/views/<module>/page/<PageName>.vue`，但必须同时满足：
  - 该文件在 [frontend/src/router/index.ts](/Users/imac/Desktop/webtset/TF2025/frontend/src/router/index.ts) 中被直接作为路由页面引用
  - 文件名符合独立页面命名规则，例如 `*View.vue` 或 `*Page.vue`
  - 或已列入兼容特例，例如 `GitManagement.vue`

### 不会被扫描成模块的文件

以下文件默认不会被扫描成模块：

- `*Modal.vue`
- `*Dialog.vue`
- `*Tab.vue`
- `*Panel.vue`
- `*Card.vue`
- `*Selector.vue`
- `*Form.vue`
- 仅被某个页面内部 `import` 的局部组件
- `H5-mobile/page/` 下的移动端内部页面文件
- `404.vue`

## 推荐目录规范

### 独立页面

用于菜单、路由、权限模块的页面，推荐放在：

```text
src/views/<module>/<PageName>View.vue
src/views/<module>/page/<PageName>View.vue
src/views/<module>/page/<PageName>Page.vue
```

示例：

- `src/views/analytics/AnalyticsView.vue`
- `src/views/system/page/GitManagement.vue`
- `src/views/permissions/page/ModuleManagementView.vue`
- `src/views/price-list/page/SyncLogView.vue`

### 子组件

仅供页面内部复用的文件，推荐放在：

```text
src/views/<module>/page/<ComponentName>Modal.vue
src/views/<module>/page/<ComponentName>Tab.vue
src/views/<module>/page/<ComponentName>Panel.vue
src/views/<module>/page/<ComponentName>Card.vue
```

示例：

- `CreatePreorderModal.vue`
- `EditPreorderModal.vue`
- `DataCheckTab.vue`
- `SalesAnalytics.vue`

说明：

- 这类文件可以放在 `page/` 下
- 但不应作为模块扫描目标
- 它们的权限应由所属主页面统一控制

## 推荐命名规范

### 独立页面命名

推荐使用：

- `XXXView.vue`
- `XXXPage.vue`

示例：

- `AnalyticsView.vue`
- `ModuleManagementView.vue`
- `StockInPage.vue`

### 非独立页面命名

推荐使用：

- `XXXModal.vue`
- `XXXDialog.vue`
- `XXXTab.vue`
- `XXXPanel.vue`
- `XXXCard.vue`
- `XXXSelector.vue`

这样做的目的：

- 便于人工识别职责
- 便于扫描器排除
- 降低后续目录迁移时误判的概率

## 新增页面的标准流程

### 新增一个需要权限控制的独立页面

1. 在 `src/views/<module>/` 或 `src/views/<module>/page/` 新建页面文件。
2. 文件名使用 `*View.vue` 或 `*Page.vue`。
3. 在 [frontend/src/router/index.ts](/Users/imac/Desktop/webtset/TF2025/frontend/src/router/index.ts) 中注册路由。
4. 页面内部接入 `usePagePermissions(...)`。
5. 执行模块扫描或模块同步。
6. 在权限管理中为角色分配：
   - 菜单显示
   - `view`
   - 其他动作权限
7. 验证菜单显示、页面访问、按钮权限是否一致。

### 新增一个局部弹窗或子块

1. 在 `page/` 下新建组件文件。
2. 文件名使用 `*Modal.vue`、`*Tab.vue`、`*Panel.vue` 等后缀。
3. 不要为它单独创建路由。
4. 不要为它单独设计一套新的页面模块权限。
5. 由所属主页面统一决定它的展示和操作权限。

## 目录迁移时的注意事项

如果将页面从顶层迁移到 `page/`，必须同时检查：

1. 路由是否已改为新路径。
2. 页面是否仍是独立路由页面。
3. 模块扫描器是否仍能识别该页面。
4. 菜单自动绑定是否还能命中正确的 `module_key`。
5. `modules` 表中的旧模块是否被错误停用。

典型风险：

- 独立页面迁移到 `page/` 后，扫描器漏扫
- 菜单仍显示，但点击后页面内部 `PermissionDenied`
- 模块同步后，数据库中的旧模块被停用，导致角色权限不完整

## 当前项目中的典型例子

### 会作为模块页面处理

- `analytics/AnalyticsView.vue`
- `system/page/GitManagement.vue`
- `permissions/page/ModuleManagementView.vue`
- `price-list/page/SyncLogView.vue`

### 不作为模块页面处理

- `preorders/page/CreatePreorderModal.vue`
- `preorders/page/EditPreorderModal.vue`
- `data-optimization/page/DataCheckTab.vue`
- `analytics/page/SalesAnalytics.vue`

## 禁止做法

- 把所有 `page/` 下的 `.vue` 文件一律当成模块扫描
- 只因为文件存在，就默认它是独立权限页面
- 独立页面命名成 `Temp.vue`、`Test.vue`、`Index2.vue` 这类无语义名称
- 弹窗组件注册成单独路由页面
- 目录迁移后不验证模块扫描、菜单绑定和页面权限

## 落地建议

- 新增独立页面时，优先使用 `View` / `Page` 后缀
- 新增局部组件时，优先使用 `Modal` / `Tab` / `Panel` / `Card` 后缀
- 执行模块同步前，先确认目标文件是否真的应该进入权限系统
- 页面迁移到 `page/` 后，必须同步检查：
  - 路由
  - 模块扫描
  - 菜单绑定
  - 页面权限判断

## 相关文档

- [权限系统完整指南](./permission-system-guide.md)
- [前端页面结构标准](../frontend/page-structure-standards.md)
- [前端统一页面结构](../frontend/unified-page-structure.md)
