# TF2025 API 调用规范

本文规定站内请求契约和第三方请求边界。公共实现为 `frontend/src/utils/unified-api.ts`，请求配置以其导出的 `RequestConfig` 为准，响应类型从 `@/types` 引用；不存在 `@/types/api` 入口。

## 公共入口与职责

- `src/api/` 定义可复用的站内 HTTP 契约，使用 `unifiedApi`，不维护第二套认证或错误拦截器。
- `src/services/` 组织业务、选项和缓存，可以组合 API 或现有公共请求；不要为迁移目录再增加同名重复封装。
- 品牌、型号、门店等基础选项优先复用 `services/reference-options.ts`；客户检索复用 `services/customer-options.ts`。
- 页面使用现有领域 API 或服务。新增复用契约先查全局入口和共享类型，再决定放置位置。

## 类型与响应

共享响应定义为 `frontend/src/types/index.ts` 的 `ApiResponse<T, TSummary>`。分页参数和字段遵循 [字段契约](../frontend/field-consistency-standards.md)，采用 `page`、`page_size`、`total`、`total_pages`。不要在页面或文档再定义另一份响应接口。

Axios 拦截器已经返回响应体，正常情况下读取 `response.data`，而非按原始 Axios 响应假定为 `response.data.data`。旧包装响应由 `utils/api-response.ts` 的提取函数处理；泛型只提供编译约束，未知外部数据仍需运行时校验。

以下完整示例参加编译检查。这里使用真实资源契约；检查只编译，不向服务器发请求。

```ts check
import { unifiedApi } from '@/utils/unified-api'
import type { RequestConfig } from '@/utils/unified-api'
import type { ApiResponse, Store } from '@/types'

export async function loadStores(page = 1): Promise<ApiResponse<Store[]>> {
  const config: RequestConfig = {
    params: { page, page_size: 20 },
    useCache: true,
    cacheTTL: 30_000
  }
  return unifiedApi.get<Store[]>('/stores', config)
}
```

## 方法与配置

现有方法包括 `get`、`post`、`put`、`patch`、`delete`、`upload`、`download`、`clearCache` 和 `getInstance`。参数以源码签名为准。

| 配置 | 用途 |
| --- | --- |
| `params` / 请求体 | GET 查询和写入载荷，字段必须与后端契约一致 |
| `timeout` / `signal` | 超时和取消；长任务按业务设置，卸载或新请求替代时取消旧请求 |
| `showLoading` | 交由公共 Loading 仲裁；后台静默请求可显式关闭 |
| `showError` | 决定拦截器是否提示，业务自行提示时避免重复 |
| `useCache` / `cacheTTL` | 已有请求缓存开关及有效期，不使用不存在的 `cache: { ttl, key }` 配置 |
| `cacheInvalidationScope` | 写入后的缓存失效范围，结合现有领域服务使用 |

`clearCache` 的字符串参数按包含关系匹配，不是 glob；精确复杂匹配可使用现有正则范围。优先让领域服务维护缓存失效，不在每个页面复制逻辑。

```ts check
import { unifiedApi } from '@/utils/unified-api'

export function invalidateStoreReads(): void {
  unifiedApi.clearCache('/stores')
}
```

认证刷新由统一实现管理。业务层不调用不存在的刷新注册、配置方法，不直接在页面叠加拦截器；确需调整统一行为时，修改公共实现并回归相关请求。特殊需求可在公共基础设施中使用 `getInstance()`，不能据此创建业务页面私有认证链。

## 错误、取消与反馈

- 捕获值使用 `unknown`，通过 `getRequestErrorMessage` 等公共辅助函数提取信息。
- 用户主动操作失败应有统一反馈；后台静默加载失败记录 logger。取消或被新请求替代不当作用户错误。
- 一个失败只由一层负责弹出提示；业务设置 `showError: false` 后必须承担相应提示责任。
- 401、403、503 分别核对认证、权限、服务可用性，不能把所有失败一律显示为密码错误。
- 搜索、筛选和分页采用 [最新请求规范](../frontend/latest-request-standard.md)，防止旧响应覆盖新数据。

## 安全边界

站内受控请求沿用现有 JWT、CSRF/XSRF、统一权限及设备上下文，不把令牌拼接进普通下载 URL。后端必须使用对应认证和动作权限，并验证字段、资源所属和数据范围。

第三方域名请求不使用携带站内凭证的请求链。先检索现有外部服务适配器；没有公共入口时建立单一适配器，限定来源与字段，设置超时、取消、状态校验和运行时响应校验。使用 fetch 时显式 `credentials: 'omit'`；第三方客户端只配置第三方所需认证，不能复制站内 Authorization、CSRF、设备信息或敏感 URL 参数。

不修改统一 API 的认证规则来迁就某个外部服务。优先通过已有后端 provider/service 管理需要保密的第三方密钥。

## 上传、下载与表单

- 上传复用 `unifiedApi.upload` 或现有领域上传方法，不手工维护重复 token 或边界头；后端验证文件类型、大小及资源权限。
- 下载复用 `unifiedApi.download`；大备份等已登记的短时下载链接沿用受控接口。非成功错误响应不能被保存成图片或压缩包。
- 预览、私有文件与公开目录边界见 [下载安全](../frontend/download-security-standard.md)。
- 表单优先复用 `useForm`、现有校验规则与 Element Plus 表单；服务端校验不可省略。不复制 form composable 的接口定义。
- Loading 与通知只引用 [全局 Loading](../frontend/global-loading-standard.md)、[通知](../frontend/notification-standards.md) 和 [交互反馈](../frontend/interaction-standards.md)，不在本文维护第二套规范。

## 验证

运行 `npm run check:docs` 编译本页标记 `check` 的示例，再执行相关类型、下载安全、权限和接口行为测试。编译不证明接口在线、云端数据正确或权限测试已通过；这些需要分别提供运行证据。
