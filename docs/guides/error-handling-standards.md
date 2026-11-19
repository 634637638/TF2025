# 全局错误处理规范

本文规定 TF2025 前端错误边界、请求错误、业务日志、用户提示和后端异常响应的唯一处理边界。页面和服务不得复制第二套错误处理器。

## 权威实现

| 入口 | 职责 |
| --- | --- |
| `frontend/src/utils/unified-api.ts` | 站内 HTTP 请求、认证、CSRF/XSRF、响应解析和通用请求错误 |
| `frontend/src/utils/error-boundary.ts` | 前端全局错误分类、捕获和 Error Boundary 插件 |
| `frontend/src/utils/error-logger.ts` | 唯一服务端错误上报器，负责去重、批量上报和统计 |
| `frontend/src/components/ErrorBoundary.vue` | 页面级错误展示、重试和错误详情交互 |
| `frontend/src/composables/useErrorHandler.ts` | 组件和业务流程需要显式处理的系统错误 |
| `frontend/src/utils/logger.ts` | 前端诊断日志唯一入口 |
| `frontend/src/composables/useNotification.ts` | 用户可操作的成功、警告、错误和确认反馈 |
| `backend/src/middleware/error-handler.js` | 后端统一错误响应、状态码和生产脱敏 |
| `backend/src/utils/log.js` | 后端业务日志唯一入口 |
| `backend/src/services/error-alert.service.js` | 生产故障告警唯一筛选、聚合及队列入口；默认关闭，独立 SMTP 发送 |
| `backend/src/middleware/error-alerts.js` | 响应结束后观测 5xx，覆盖控制器自行响应，不阻塞业务 |

日志细节以[日志系统标准](LOG_SYSTEM_STANDARDS.md)为准，用户通知以[前端通知规范](../frontend/notification-standards.md)为准。

## 端到端接口故障闭环

站内接口故障必须能够从浏览器提示追到服务端日志，并能区分“正在加载、成功、合法空结果、可恢复失败和结果未知”。本节是前端、后端和发布验收共同遵守的契约；页面不得为同一接口另建请求 ID、错误上报或重试体系。

前端实现必须复用 `unifiedApi`、`getRequestErrorMessage`、`useErrorHandler` 和 `useNotification`；区块状态使用 `useLoadingState` / `SectionLoading`、`DataEmptyState` 及 `useLatestRequest` 等现有入口。权限相关反馈沿用 `v-permission`、`PermissionGate`、`usePagePermissions` 和后端鉴权。公共实现清单以[前端规范索引](../frontend/INDEX.md)和 `standards-manifest.json` 为准，不在本规范另建组件或第二套状态封装。

### 请求追踪

- `unifiedApi` 为每个实际发出的请求生成安全的请求编号，并通过 `X-Request-ID` 发送；编号只能包含 ASCII 字母、数字、点、下划线、冒号或短横线，长度按后端 `request-context` 契约限制。缓存命中不得伪造新的服务端请求日志。
- 后端 `request-context` 校验外部请求编号；合法时沿用，非法或缺失时重新生成，并在响应头 `X-Request-ID` 和错误体 `request_id` 返回最终编号。前端错误日志应优先记录服务端返回的编号，同时保留本地请求上下文用于诊断。
- 控制器、统一错误中间件、5xx 响应观测和告警事件使用同一个最终编号。日志只记录方法、规范化路由、状态码、耗时和脱敏后的错误信息，不记录 Authorization、Cookie、CSRF、完整请求体或客户资料。
- 代理层必须透传 `X-Request-ID` 请求头和响应头；跨域场景必须通过 `Access-Control-Expose-Headers` 暴露该响应头。部署验收要用一次失败请求核对浏览器编号、响应编号和服务端日志编号一致。

当前实现边界：后端 `request-context`、响应头暴露和 5xx 观测已存在；前端目前只在 `unifiedApi` 元数据中生成本地 `req_...` 编号，尚未把它作为 `X-Request-ID` 发送，也未统一读取服务端返回编号。因此请求追踪闭环仍属于待完成项，后续实现必须先补公共请求入口和契约测试，再按本节执行浏览器与生产验收。

### 页面状态与恢复动作

每个接口驱动的页面区块至少定义以下状态：

| 状态 | 页面行为 | 禁止行为 |
| --- | --- | --- |
| loading | 使用公共 Loading/区域 Loading，保留必要的旧数据 | 重复创建遮罩、把加载中的区块显示成空数据 |
| success | 展示已校验的数据 | 用上一次请求的数据冒充本次成功 |
| valid empty | 使用公共空状态，说明确实没有记录 | 把请求失败、权限拒绝或未迁移结构显示成“暂无数据” |
| recoverable error | 显示受控错误文案和“重试”入口；重试沿用原查询条件 | 只写日志、静默清空列表或让用户刷新整页 |
| unknown result | 对写入、支付、库存等结果未知的事务冻结原载荷，先核对结果，再允许同键重试 | 自动重复提交、修改原载荷后冒充重试成功 |

- GET/HEAD 等幂等读取可以由公共请求层进行有上限的短暂重试；写请求不得套用通用自动重试。业务页面仍要保留最终失败状态和人工重试入口。
- 非核心区块（例如首页最近活动、公告和品牌设置）可以降级，不得阻塞主页面；降级必须保留可见的区块级失败/重试状态或明确默认值来源，不能把故障伪装成正常空结果。
- 一个失败只由一层负责通知：请求层负责通用状态码和认证恢复，页面负责业务上下文与重试动作；请求设置 `showError: false` 后必须由调用方承担提示、错误状态和恢复入口。

### 错误响应与指标边界

- 服务端错误响应统一包含 `success: false`、稳定 `code`、用户可读 `message`、ISO 8601 机器时间 `timestamp` 和 `request_id`；时间戳用于传输/关联，前端展示时按北京时间公共时间工具格式化，不把机器值格式强制写成无时区的北京时间字符串。5xx 的 `message` 不得暴露 SQL、堆栈、文件路径、远端凭据或请求内容。
- 前端 `getRequestErrorMessage`、`useErrorHandler` 和 `useNotification` 只提取统一响应，不从 Axios 内部结构复制第二套错误类型。401、403、409、422、429、5xx 和网络失败必须保持可区分，不能全部提示为“密码错误”或“暂无数据”。
- 前端性能上报只采集固定数值和采样后的 API 延迟；不建立按完整 URL、客户、用户或请求体分组的浏览器指标。接口成功率和 5xx 比率以服务端响应观测为准，按规范化路由、HTTP 方法、状态码和统一时间窗口汇总。
- 性能上报、错误上报和业务请求必须互相隔离：上报失败不能递归上报、阻塞页面或改变原业务结果；生产是否启用邮件告警和指标上报必须通过部署后的人工验收确认，不能用本地测试代替。

### 新接口验收清单

新增或修改接口/页面时，至少验证：

1. 成功、合法空结果、401/403、业务 4xx、5xx、超时和断网分别有正确状态与提示。
2. 读取失败不会变成空列表；可重试区块保留查询条件、分页和已选择项。
3. 写操作失败和结果未知不会重复扣库存、扣款或创建客户；重试使用同一业务请求键或原载荷。
4. 浏览器 `X-Request-ID`、响应 `X-Request-ID`、错误体 `request_id` 和服务端日志可以关联。
5. 运行相关前端单测、后端行为测试、`check:error-management`、`check:telemetry`、`check:docs` 和 `git diff --check`；浏览器/真机和生产指标分别登记，不能用静态审计替代。

## 前端处理边界

- 站内请求统一使用 `unifiedApi` 或现有 API/业务服务，不在页面创建私有 Axios 拦截器。
- 请求层已经展示通用错误时，业务层不得重复弹出相同提示；业务层只补充当前操作所需的上下文或恢复动作。`showError: false` 同时约束状态码处理和通用提示，仍保留认证清理；已由状态码处理展示的错误不再弹第二条通用消息。错误上报请求另用 `reportError: false` 阻止上报故障递归进入上报队列，普通业务请求继续记录错误。
- 页面、组件、store 和 service 的诊断信息使用 `logger.error/warn/debug`，不得直接调用 `console.*`。
- `logger.ts` 不负责网络上报；未捕获错误和 API 错误分别由 Error Boundary、`unifiedApi` 转交 `globalErrorLogger`，业务层不得自行调用日志接口。
- 捕获值使用 `unknown`，通过现有请求错误辅助函数、类型守卫或 `useErrorHandler` 提取信息，不使用 `any` 或宽泛断言绕过类型检查。
- Error Boundary 负责未捕获渲染错误和无法在局部恢复的异常；表单校验、权限拒绝、空数据和可预期业务失败由当前组件正常处理，不应全部升级为全局错误页。
- 用户提示必须说明可执行的下一步，例如重试、重新登录、检查输入或联系管理员；日志可以包含诊断上下文，但必须经过敏感信息脱敏。

推荐模式：

```typescript
import { logger } from '@/utils/logger'
import { useNotification } from '@/composables/useNotification'
import { getRequestErrorMessage } from '@/utils/request-error'

const { error: notifyError } = useNotification()

export async function saveExample(): Promise<void> {
  try {
    await exampleApi.save()
  } catch (caught: unknown) {
    logger.error('保存示例失败', caught)
    notifyError(getRequestErrorMessage(caught, '保存失败，请重试'))
  }
}
```

实际业务中若 `unifiedApi` 已经显示同一错误，不再重复调用 `notifyError`。是否静默由请求配置和对应专项规范决定。

## 后端处理边界

- 路由、控制器和服务将异常交给统一错误中间件；除非需要补充事务回滚或业务上下文，不在每层重复记录同一个错误。
- 可预期校验、权限、冲突和未找到错误使用项目现有错误类型或明确状态码；未知异常返回统一 500，生产环境不返回 stack、SQL、请求体或内部路径。
- 事务失败先回滚，再保留原错误；回滚失败同时记录，但不能用回滚错误覆盖原始业务错误。
- 日志使用 `backend/src/utils/log.js`，敏感字段、授权头、Cookie、Token、密码、密钥和数据库参数必须脱敏。
- CLI、迁移和审计脚本可以输出必要执行结果，但不得输出完整秘密或把命令行输出方式复制到业务路由和服务。
- 主动邮件只处理生产严重事件或持续高频技术失败；普通业务/权限/输入和 4xx 不发。服务端固定严重事件与 HTTP 响应由公共告警入口收集，前端报告成功落库后才提交聚合，客户端 critical 和累计 count 不直接决定立即发送。SMTP 超时、拒收或重试耗尽不改变原业务响应，不递归告警；规则、容量及人工生产验收见[生产故障邮件告警](../backend/error-alerting.md)。

## 禁止事项

- 在业务源码或规范示例中直接使用 `console.log/error/warn`。
- 同一次失败由拦截器、页面和全局边界重复弹出多条通知。
- `catch` 后静默吞掉错误，或只记录日志却把操作报告为成功。
- 为了消除报错而返回伪造成功数据、扩大默认值或跳过权限检查。
- 把完整响应、请求体、用户隐私、Token、Cookie、密码或密钥写入日志。
- 新建与 `unifiedApi`、`ErrorBoundary`、`useErrorHandler`、`logger` 或 `useNotification` 重复的全局实现。
- 在 `logger.ts` 或业务模块中维护私有错误上报地址、`fetch`、Axios 实例或重试队列。

## 验证

涉及错误处理变化时至少执行：

```bash
npm --prefix frontend run check:error-management
npm --prefix frontend run type-check
npm run lint:strict
git diff --check
```

后端错误响应变化另运行相关契约/行为测试和 `npm --prefix backend test`。浏览器或真机异常恢复没有实际执行时，必须标为未验证。

## 相关文档

- [API 调用标准](api-standards.md)
- [日志系统标准](LOG_SYSTEM_STANDARDS.md)
- [前端通知规范](../frontend/notification-standards.md)
- [全局测试与清理规范](TESTING_STANDARDS.md)
