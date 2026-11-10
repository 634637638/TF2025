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

日志细节以[日志系统标准](LOG_SYSTEM_STANDARDS.md)为准，用户通知以[前端通知规范](../frontend/notification-standards.md)为准。

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
