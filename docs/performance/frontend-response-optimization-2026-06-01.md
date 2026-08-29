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

### 3. Vendor 分包优化

早期尝试按包名强制拆分 `Element Plus`、`@element-plus/icons-vue` 时，Vite 构建出现循环 chunk：

- `element-icons -> vue-vendor -> element-icons`
- `vue-vendor -> element-plus -> vue-vendor`
- `element-icons -> vue-vendor -> element-plus -> element-icons`

最终只固定 Vue、Pinia、Vue Router 和 `@vue/*` 为 `vue-core`，Element Plus 及其他功能依赖交由 Rollup 根据路由和动态导入关系拆分。新的 `vue-core` 约 `303 kB`，旧的约 `1,152 kB` `vue-vendor` 首屏预加载已消失，且构建无循环 chunk 提醒。

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

### 6. 重型功能延迟加载与体积基线

- ECharts 仅注册项目实际使用的 Bar、Line、Pie、Radar、Gauge 图表和必要组件，图表共享 chunk 由约 `706 kB` 降至约 `582 kB`，减少约 17.6%。
- 入库扫码组件改为异步组件，只有打开扫码界面时才加载解码器。
- HEIC 转换、PDF.js、ZXing、html2canvas 保持操作触发式加载，均未被 `dist/index.html` 直接引用。
- 新增 `npm run check:bundle-size`，每次生产构建后校验首屏 JS、CSS、总量及单个懒加载包上限，并阻止重型功能回到首屏。

本轮构建对比（本地未压缩资源）：

- 优化前首屏直接加载/预加载约 `1.84 MB`。
- 优化后首屏直接加载/预加载约 `802 KB`。
- 首屏原始资源减少约 56%。

## 当前按需加载大包

当前构建仍提示以下 chunk 超过 500KB：

- `heic2any`：约 `1,352 kB`，仅图片转换时加载
- ZXing WASM：约 `802 kB`，仅扫码时加载
- ECharts/zrender：约 `582 kB`，仅分析页面加载
- PDF.js：主包约 `438 kB`，worker 约 `1,210 kB`，仅 PDF 功能加载
- ZXing 后备解码器：约 `415 kB`，仅扫码需要时加载
- `html2canvas`：约 `195 kB`，仅导出图片时加载

这些包由业务功能本身决定，继续保留可保证图片兼容、PDF 和扫码准确性。它们已与首屏隔离，构建审计会阻止后续回退。

## 下一步建议

1. 新增重型功能时继续使用动态导入，并根据真实业务入口调整体积基线。
2. 继续拆分重页面：`SalesView.vue`、`SalaryView.vue`、`PermissionsView.vue`、`InventoryView.vue`。
3. 通过真实手机弱网测试补充 FCP、交互就绪时间和按需功能首次打开耗时。
