# 前端性能优化迁移导航

> 文档类型：迁移导航
> 唯一权威：[前端埋点规范](telemetry-standards.md)、[数据实时刷新规范](data-freshness-standard.md)及当前构建门禁

旧的性能统计、硬编码指标和直接 `console` 监控示例已经移除，避免与当前 Telemetry、统一 logger、缓存和构建体积门禁冲突。性能工作按以下入口执行：

- 页面与 API 延迟：`frontend/src/services/telemetry.ts` 和[前端埋点规范](telemetry-standards.md)
- 请求去重、最新请求和缓存：[最新请求处理](latest-request-standard.md)、[数据实时刷新](data-freshness-standard.md)
- 首屏与构建体积：`npm --prefix frontend run check:bundle-size` 和 `npm --prefix frontend run build`
- 页面公共结构及组件复用：[公共组件采用规范](component-adoption-standard.md)
- 日志：[日志系统标准](../guides/LOG_SYSTEM_STANDARDS.md)

性能优化必须基于可复现测量，记录测试环境、日期和范围；不得通过删除业务能力、提高体积基线、扩大缓存过期时间或关闭审计来制造“优化”结果。
