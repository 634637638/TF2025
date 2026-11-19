# 前端埋点规范

## 唯一入口

路由访问和业务事件统一调用 `frontend/src/services/telemetry.ts` 的 `trackPageVisit` / `trackEvent`。数据只交给宿主注入的 `window.__TF2025__.analytics` 适配器；未配置适配器时不会联网发送，也不会在客户端持久化事件。

## 数据边界

- 事件名使用小写字母开头及字母、数字、点、下划线、连字符，最长 64 字符。
- 属性只传低敏业务分类或计数；用户输入、客户资料、凭据、手机号、IMEI、序列号、地址和身份信息不得埋点。
- string 属性最长 80 字符；采集适配器负责身份授权、同意状态、传输、保留周期和服务端脱敏。
- 路由访问统计不记录 query/hash 中可能包含的业务数据。
- 新增曝光/点击采集前先确认业务目的、用户告知和服务端接收契约；不得通过全局 DOM 监听隐式采集表单内容。

```bash
cd frontend
npm run check:telemetry
```

## 当前边界

项目当前提供统一客户端接口和路由访问回调，但仓库内没有配置业务事件采集适配器；`trackEvent` 默认不发送。接入真实采集前需要明确服务端端点、权限、隐私告知及保留策略。

## 性能数值监控

性能采集统一使用 `utils/performanceMonitor.ts`，传输统一使用 `utils/performance-reporting.ts`，不与业务事件适配器混用。`unifiedApi` 直接记录数值延迟到公共监控实例，不维护第二个 Window 桥接对象或逐URL字典。

使用 `web-vitals` 的 FCP/LCP/INP/CLS/TTFB；INP 替代 FID。DOM就绪、加载、资源计数/大小及长任务仅记录数值；历史 `tti` 只是DOM就绪近似值，不可作为标准TTI宣传。数值字段唯一来源为 `backend/src/contracts/performance-report.schema.json`，共享类型见 `types/performance.ts`，不得保留第二套手写性能报告类型。

生产默认10%固定采样，最多每分钟一次、一个在途请求；开发、未登录或构建开关 `VITE_PERFORMANCE_REPORT_ENABLED=false` 不发送。通过 `unifiedApi` 保留认证和CSRF，关闭Loading/错误提示及错误递归上报，失败不阻塞操作。不得在此入口附加路由、URL、UA、账号、客户资料、原始资源名称或用户输入；报告历史仅内存最多20份。

API 指标只记录请求次数、累计延迟和最大延迟等固定数值，不在浏览器按完整 URL、客户、用户或请求体建立指标字典。成功率和 5xx 比率由后端响应观测按规范化路由、HTTP 方法、状态码和时间窗口汇总；前端请求编号追踪、失败状态和重试契约以[错误处理规范](../guides/error-handling-standards.md#端到端接口故障闭环)为准。

接收端、限流、快照解释、保留策略与部署核验见[性能指标集中上报](../backend/performance-reporting.md)。相关行为检查：

```bash
npm --prefix frontend run test:unit -- tests/performance-reporting.spec.ts tests/performance-monitor.spec.ts
ENV_FILE=test/missing-unit-env RUN_DB_TESTS=false node --test backend/test/performance-report.check.js
```

最后核实：2026-11-13（代码和本地隔离检查，生产部署另验）
