# 前端响应速度优化记录（2026-06-01）

## 已完成优化

### 1. 列表请求竞态收口

品牌、型号、颜色、内存、门店、供应商列表已接入 `useLatestRequest`：

- 新请求触发时取消旧请求。
- 旧响应慢返回时不再覆盖新数据。
- 取消请求不清空表格、不弹错误提示。
- 分页每页条数变化时修复为回到第一页。

参考规范：`docs/frontend/latest-request-standard.md`

### 2. 首屏入口包瘦身

`frontend/src/main.ts` 做了延后加载：

- `@/composables` 总入口改为挂载后动态加载，只用于 `ComposableToolkit.init()` 调试能力。
- `@/components/index` 全局组件管理器改为挂载后动态加载。
- `@/utils/performanceMonitor` 改为挂载后动态加载，并保留 `window.__TF2025__.performance`。
- `@/utils/scrollAnimation` 改为挂载后动态加载，AOS 动画与样式不再进入入口包。
- 移除入口中未使用的 `dynamicPermissionService` 静态导入。

构建对比：

- 优化前入口 `dist/js/index-*.js`：约 `197.82 kB`，gzip 约 `62.48 kB`。
- 优化后入口 `dist/js/index-*.js`：约 `159.27 kB`，gzip 约 `50.05 kB`。
- 首屏入口减少约 `38.55 kB`，gzip 减少约 `12.43 kB`。

说明：`siteSettings` 已被 `App.vue`、路由守卫等静态依赖，动态导入不会实际分包，因此保持静态导入，避免 Vite 警告。

### 3. Vendor 分包试验结论

尝试将 `Element Plus`、`@element-plus/icons-vue` 从 `vue-vendor` 中拆出时，Vite 构建出现循环 chunk：

- `element-icons -> vue-vendor -> element-icons`
- `vue-vendor -> element-plus -> vue-vendor`
- `element-icons -> vue-vendor -> element-plus -> element-icons`

该方案虽然能让 `vue-vendor` 从约 `1,152 kB` 降到约 `230 kB`，但会引入运行顺序隐患，因此已回退。当前保留 Vue 生态与 Element Plus 同组，优先保证构建和运行稳定。

### 4. 公共反馈能力懒加载

新增 `frontend/src/utils/element-feedback.ts`，统一封装 Element Plus 的消息、通知、确认框和 Loading 服务：

- `main.ts` 移除 Element Plus 中文包静态导入，根组件不再为了全局配置提前加载 Element Plus。
- `unified-api.ts`、`router/guards.ts`、`utils/loading.ts`、`token-expiry-check.ts`、`permissionToastSimple.ts`、`tencent-map.ts` 改为通过懒加载反馈封装调用。
- `notification-simple.ts`、`message-box.ts` 不再静态导入 Element Plus，只有实际弹出消息、确认框、Loading 时才加载。
- `useBrandModels.ts`、`usePagePermissions.ts`、`useMobileMenu.ts` 去掉公共组合函数中的静态 Element Plus 消息依赖。
- `auth.ts` 使用统一反馈封装提示断网，不再直接动态导入 Element Plus。

构建结果：

- `frontend/src/main.ts`、`router`、`stores`、`utils`、`composables`、`plugins` 公共链路中，Element Plus 静态导入已收口到 `element-feedback.ts` 内部的 `import('element-plus')`。
- 入口 `dist/js/index-*.js` 保持约 `159.27 kB`，gzip 约 `50.05 kB`。
- 该优化重点是减少首屏静态耦合，业务页面仍可在路由懒加载后使用 Element Plus 组件。

### 5. 分包循环提醒处理

移除 `swiper`、`aos`、`vuedraggable`、`v3-infinite-loading` 的强制 `ui-extensions` 手动分包，让 Rollup 自动根据实际页面依赖拆分。

原因：手动合并这些 H5 交互库时，构建出现 `ui-extensions -> vue-vendor -> ui-extensions` 循环 chunk 提醒。该类库与 Vue 运行时/组件生态存在交叉依赖，自动拆分更稳。

补充：`main.ts` 曾静态导入 `scrollAnimation.ts`，导致 AOS 提前进入入口链路。改成动态导入后：

- `scrollAnimation` 独立为约 `13.71 kB` 的 JS chunk 和约 `28.77 kB` 的 CSS chunk。
- 入口回落到约 `159.27 kB`，gzip 约 `50.05 kB`。
- 构建不再出现 `ui-extensions` 循环 chunk 提醒。

## 剩余大包

当前构建仍提示以下 chunk 超过 500KB：

- `image-convert`：约 `1,352 kB`
- `vue-vendor`：约 `1,152 kB`（Vue 生态 + Element Plus，因循环依赖暂不强拆）
- `echarts-core`：约 `666 kB`
- `pdf`：约 `437 kB`
- `zxing`：约 `390 kB`

这些多数已经是按功能动态加载或单独分包，首屏不一定会立即加载。下一步优化重点不是简单消除警告，而是确认是否被路由预加载、公共组件、或页面静态依赖提前拉取。

## 下一步建议

1. 检查路由预加载行为，避免后台功能 chunk 在首屏被提前加载。
2. 若要继续拆 `vue-vendor`，不要直接按包名强拆 Element Plus；应先做依赖图分析，或从业务侧减少全局 Element Plus 组件静态引用。
3. 排查 `echarts` 页面是否可以在进入分析页后再加载图表组件。
4. 对 `image-convert`、`pdf`、`zxing` 保持用户触发式加载，不在页面打开时预热。
5. 拆分重页面：`SalesView.vue`、`SalaryView.vue`、`PermissionsView.vue`、`InventoryView.vue`。
