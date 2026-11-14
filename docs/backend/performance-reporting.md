# 性能指标集中上报

本文是 T10 接收、聚合和运维边界说明。前端行为以[埋点规范](../frontend/telemetry-standards.md)为准；错误上报及严重故障邮件仍使用原有独立入口，性能指标不会触发主动邮件。

## 接口与数据

`POST /api/performance/report` 使用统一 JWT 认证、全站 CSRF/XSRF 和独立限流：同用户及IP每5分钟最多10次。它不授予业务读写权限。非法指标400、未登录401、超额429，正常返回统一成功响应及 `{accepted:true}`。

唯一数值契约为 `backend/src/contracts/performance-report.schema.json`，前端类型由其键名派生。只允许15个固定数值：FCP、LCP、INP、CLS、TTFB、DOM就绪、完整加载、历史近似TTI、资源数量/字节、API数量/总延迟/最大延迟、长任务数量、页面计数。单位为毫秒、字节或次数，CLS无单位；近似TTI等于DOM就绪时间，不能据此声称实现标准TTI。

完整白名单、非负、有限数、整数计数及上限均在服务端校验；未知字段一律拒绝。原始URL、路由参数、UA、IP、身份、客户资料、资源名称、请求体和令牌都不进入性能聚合。

## 采集与失败降级

- `PerformanceMonitor` 通过 `web-vitals` 采集，使用 INP 替代已淘汰的 FID；API 延迟直接接公共 `unifiedApi`，排除上报请求自身。
- 每个监控实例固定10%采样，最多每分钟一次，最多一个在途请求；开发环境和未登录不发送。每次上报是数值累计快照，不能把各快照中的累计次数相加冒充独立业务总量。
- `PerformanceReporter` 通过公共请求发送，保留认证与CSRF，不显示Loading/页面错误、不进入错误上报重试环；失败不阻塞业务、不建立离线持久队列，最多等待5秒。
- 生产默认启用，前端构建变量 `VITE_PERFORMANCE_REPORT_ENABLED=false` 可关闭传输，须重建并手动上传。未关闭时仍受采样、认证和限频控制。
- 本地报告历史最多20份，仅在内存；停止监控时清理自建观察者与定时器。`web-vitals` 每实例只注册一次，停止后回调不再更新指标。

## 接收、保留与部署

服务端只在进程内保存固定15项 count/sum/max，每分钟收到下一份报告时或达到10000份时通过统一 `log.info` 输出一次聚合。0表示未观测到的时延不计平均；最后不足一个窗口的未输出聚合可能随进程退出丢失，不保证审计级持久性。

无数据库表、无需迁移、不保存逐用户或逐请求记录。聚合进入既有 `combined` 轮转日志（14天、单文件20 MB）；PM2/宝塔若另收集 stdout，运维须同步检查其保留与访问控制，不把应用日志保留期当作外部平台的保留期。

用户手动上传前后端并重启后，再验证生产有采样聚合且失败不影响页面；本地替身测试不等于生产观测通过。当前只支持单实例，见[生产单实例边界](../deployment/CLOUD_DEPLOYMENT_GUIDE.md#单实例边界与扩容前置)。

```bash
ENV_FILE=test/missing-unit-env RUN_DB_TESTS=false node --test backend/test/performance-report.check.js
npm --prefix frontend run test:unit -- tests/performance-reporting.spec.ts tests/performance-monitor.spec.ts
```
