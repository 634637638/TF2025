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
| `loadingText` | 当前业务操作的等待文案；不传时由公共规则选择，优先级及区域反馈见全局 Loading 规范 |
| `showError` | 决定状态码处理及通用错误是否提示，业务自行提示时避免重复；不跳过认证清理 |
| `reportError` | 仅错误上报基础设施设为 false，防止上报失败递归进入队列；业务请求保持默认 |
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

## 分析 API 契约

`src/api/analytics.ts` 只提供已有后端路由支持的契约。销售预测统一调用 `analyticsService.getSalesForecast`，真实路径为 `GET /analytics/sales-forecast`，周期为 `week/month/quarter`，可传 `store_id` 与 `page_size`，响应复用 `SalesForecastResponse`；销售分析页面不得另留一份请求路径。`analyticsService` 与 `analyticsApi` 指向同一实例，不是两套实现。

清理 API 方法前同时核对 HTTP 方法、路由挂载前缀、动态参数和所有导出别名的调用点。只有“后端无对应接口且前端零调用”才能按闲置占位方法删除；已有真实后端契约不能只因视图暂时没用就自动删除。`frontend/tests/analytics-api-contract.spec.ts` 实际调用保留方法并与后端路由 AST 比较，避免路径再次漂移。2026-11-08 的逐方法删/修/留证据登记于唯一技术债务台账 T18。

## 上传、下载与表单

- 上传复用 `unifiedApi.upload` 或现有领域上传方法，不手工维护重复 token 或边界头；后端验证文件类型、大小及资源权限。
- 下载复用 `unifiedApi.download`；大备份等已登记的短时下载链接沿用受控接口。非成功错误响应不能被保存成图片或压缩包。
- 预览、私有文件与公开目录边界见 [下载安全](../frontend/download-security-standard.md)。
- 表单优先复用 `useForm`、现有校验规则与 Element Plus 表单；服务端校验不可省略。不复制 form composable 的接口定义。
- 输入内容的唯一规则见[表单控件规范：输入内容与脏数据防护](../frontend/form-control-standards.md#输入内容与脏数据防护)。接口必须独立校验允许类型、空值、完整格式、有限性、范围、精度和长度，不能把前端控件或 TypeScript 类型视为安全边界；禁止部分解析非法字符串后保存。
- 手机入库金额复用完整两位金额规则，创建写事务前拒绝类型强转和非法金额；设备编码复用 `utils/imei.js` 与共享规则源。Excel 分析/导入在查询和业务写入前校验，完全替换在清空前整份预检；合并空金额保持旧值、显式零必须保留。分析的受控输入错误返回400、行号及字段原因，技术错误保持通用提示，详见[导入输入契约](../数据优化/智能导入功能说明.md#输入校验与空值)。
- 预订单定金/总价/匹配价使用公共完整两位金额规则；国补申请和编辑在写入客户、国补或文件之前校验本次提交的姓名、手机号、证件文本和金额，编辑还先确认门店有效。失败返回原业务错误响应，不产生该次输入校验的写入/缓存副作用。正文及验收边界见上述表单规范，设备编码和其他导入不因此自动算作全站已验收。
- 服务层直接调用使用 `validation.js` 的 `parseInput`，与路由校验共用规则。基础资料、账户、维修、租赁及价目分别使用表单规范登记的唯一业务解析入口；非法输入应在仓储、结构检查、密码哈希及媒体操作前拒绝。状态/排序/ID必须验证原值，不能先强转。系统配置按声明类型验证，批量配置/菜单导入/排序在首条写入之前完成整份预检；价目Excel保留原逐行成功/失败汇总。详见[业务解析入口](../frontend/form-control-standards.md#服务端业务解析入口)。
- 创建、编辑、批量、扫码和导入应复用相同业务字段契约；服务端校验失败走统一错误响应，不产生业务写入及关联副作用。普通文本展示、富文本净化和参数化 SQL 各守其边界，敏感词审核只在明确业务策略下启用。
- H5购物车新增/修改/删除的商品或条目ID及数量通过 `utils/shop-cart.js` 的 `parseCartItemInput` 在控制器与服务复用；设备数量仅允许1，非法原值在业务库访问之前返回400。购物车标识仅接受符合既有格式的文本，不隐式转换对象或数组。
- Loading 与通知只引用 [全局 Loading](../frontend/global-loading-standard.md)、[通知](../frontend/notification-standards.md) 和 [交互反馈](../frontend/interaction-standards.md)，不在本文维护第二套规范。

## 验证

运行 `npm run check:docs` 编译本页标记 `check` 的示例，再执行相关类型、下载安全、权限和接口行为测试。编译不证明接口在线、云端数据正确或权限测试已通过；这些需要分别提供运行证据。

## 机器契约试点

地区只读接口以 `backend/src/contracts/regions.openapi.json` 为唯一机器契约，前端地区类型从生成文件引用；执行 `npm --prefix frontend run generate:openapi`，发布门禁通过 `check:openapi` 检查漂移。具体维护及HTTP验收边界见[OpenAPI试点](../backend/openapi-pilot.md)。其他业务API不因本试点自动转为已生成或已验收。
