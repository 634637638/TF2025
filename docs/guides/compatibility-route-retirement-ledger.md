# 兼容接口与弃用路由台账

本文记录已核对的历史接口、标准入口、权限/响应差异和删除条件。用于逐条推进“先统一调用，再观察流量，最后删除”；此台账不授权批量删除。

## 处理规则

1. 先核实前端、脚本及已知外部客户端的调用，再迁移内部调用；旧接口在迁移期保留。
2. 旧入口应作为薄适配层，复用标准查询/业务服务，但必须保留原权限边界和必要的旧响应转换。
3. `deprecated-route` 标记进入弃用观察期；`compatibility-route` 表示仍需保留或其外部依赖尚未排除。部分路由同时使用两种标记。
4. 删除必须逐条满足：仓库调用搜索无命中、标准入口契约测试通过、外部客户端风险已核实、完整发布观察周期无访问、权限与响应差异已处理、台账更新并发布弃用通知。
5. 没有日志、日志不连续、日志已过保留期或采集配置未覆盖，都不等于零访问。库存 501 占位接口不得以伪造成功响应替代。

## 路由清单

路径以 `/api` 为根；调用方列为代码搜索核对结果。外部客户端是否存在无法从仓库确认，标为“未知”，必须结合线上日志和发布记录判断。

| 旧接口 | 标准接口/处理方向 | 当前调用方与状态 | 权限或响应差异 | 外部风险/删除条件 |
| --- | --- | --- | --- | --- |
| `GET /operators` | `GET /users/operators` | 前端已无调用；弃用标记 | 旧入口接受 `sales:view` 或 `inventory:view`，返回旧精简字段；不可只换 URL 而丢失调用方权限 | 未知；观察完整发布周期，并验证标准入口权限兼容后逐条删除 |
| `GET /analytics/sales-trends` | `GET /analytics/sales/trends` | 仓库未发现旧路径调用；弃用标记 | 两路由都要求业务用户；确认查询参数和响应契约一致 | 未知；完整观察周期无访问且契约测试通过 |
| `GET /csrf/csrf-token` | `GET /csrf/token` | 前端已迁移；弃用标记 | 旧路由转发到新处理器；CSRF token 获取语义须保持一致 | 未知；兼容客户端确认、完整观察周期无访问 |
| `GET /attendance/my` | `GET /attendance`（本人范围） | 前端已迁移；弃用标记 | 旧入口表达“本人”；标准列表必须继续执行本人/角色/权限范围，不可替换为任意员工查询 | 未知；验证标准查询本人范围与响应后观察 |
| `GET /salary-records/my` | `GET /salary-records`（本人范围） | 前端已迁移；弃用标记 | 保留 `salary-records:view:own` 本人权限语义及必要的字段隔离 | 未知；验证标准查询本人范围与响应后观察 |
| `GET /query/models` | `GET /models?all=true&active_only=true` | 前端已迁移；兼容及弃用标记 | 必须保留 `query:view` 权限；查询服务共用但授权边界不能改为仅 `models:view` | 未知；确认外部调用及契约后观察 |
| `GET /brands/:brandId/models` | `GET /models?all=true&brand_id=:brandId` | 页面已迁移；兼容及弃用标记 | 旧路由接受品牌 ID 或名称并要求 `brands:view`；标准入口字段、品牌解析和权限映射须核对 | 未知；兼容 ID/名称及权限验证后观察 |
| `GET /phones/brands` | `GET /brands?all=true` | 仓库前端已迁移；兼容及弃用标记 | 旧响应把对象映射为名称字符串；旧权限 `brands:view` | 未知；外部依赖确认、调用归零后删除 |
| `GET /phones/models` | `GET /models?all=true[&brand_id=...]` | 仓库前端已迁移；兼容及弃用标记 | 旧响应字段包含 `id/name/brand_id/sort_order`，可按品牌筛选；权限 `models:view` | 未知；确认旧参数、返回字段和调用归零 |
| `GET /phones/colors` | `GET /colors?all=true` | 仓库前端已迁移；兼容及弃用标记 | 旧响应映射为颜色名称字符串；旧权限 `colors:view` | 未知；外部依赖确认、调用归零后删除 |
| `GET /phones/memories` | `GET /memories?all=true` | 仓库前端已迁移；兼容及弃用标记 | 旧响应映射为 `size` 字符串；旧权限 `memories:view` | 未知；外部依赖确认、调用归零后删除 |
| `GET /shop/base-data/brands` | `GET /brands?all=true` | 仓库调用已迁移；兼容及弃用标记 | 旧入口权限为 `inventory:view`、`h5-templates:view`、`h5-admin:view` 任一；标准入口必须覆盖有效业务权限，响应形状需契约比对 | 未知；先核实三类调用方权限映射，再观察 |
| `GET /shop/base-data/models` | `GET /models?all=true[&brand_id=...]` | 仓库调用已迁移；兼容及弃用标记 | 同上；核实品牌筛选参数、排序和响应字段 | 未知；权限/契约一致并完成观察后处理 |
| `GET /shop/base-data/colors` | `GET /colors?all=true` | 仓库调用已迁移；兼容及弃用标记 | 旧入口包含商城模板/后台权限；不得只按资源管理权限拒绝原合法用户 | 未知；权限/契约一致并完成观察后处理 |
| `GET /shop/base-data/memories` | `GET /memories?all=true` | 仓库调用已迁移；兼容及弃用标记 | 同上；旧响应和字段映射需契约比对 | 未知；权限/契约一致并完成观察后处理 |
| `GET /inventory/:id/movements` | 无已实现标准接口 | 仓库无前端调用；弃用标记；当前返回 501 | 真实库存流水业务未实现；保留 501，不伪造数据或成功 | 未知；确认无访问后改为 410 或删除；若仍有业务需求，另行设计真实流水事务 |
| `POST /inventory/:id/stock-out` | 无已实现标准接口 | 仓库无前端调用；弃用标记；当前返回 501 | 真实出库事务未实现 | 未知；确认无访问后改为 410 或删除；不创建假替代 |
| `POST /inventory/:id/reserve` | 无已实现标准接口 | 仓库无前端调用；弃用标记；当前返回 501 | 真实预留事务未实现 | 未知；确认无访问后改为 410 或删除 |
| `POST /inventory/:id/unreserve` | 无已实现标准接口 | 仓库无前端调用；弃用标记；当前返回 501 | 真实取消预留事务未实现 | 未知；确认无访问后改为 410 或删除 |
| `PUT /inventory/:id/adjust` | 无已实现标准接口 | 仓库无前端调用；弃用标记；当前返回 501 | 真实库存调整事务未实现 | 未知；确认无访问后改为 410 或删除 |
| `POST /inventory/:id/stock-in` | `POST /stock-in` | 仓库无前端调用；弃用标记；当前返回 501 | 旧接口不可绕过真实入库事务；确认规范接口请求契约 | 未知；确认无访问后改为 410 或删除 |
| `POST /inventory/stock-in` | `POST /stock-in` | 仓库无前端调用；弃用标记；当前返回 501 | 同上 | 未知；确认无访问后改为 410 或删除 |
| `GET /shop/phones/:id/images` | `GET /phones/:id/images` | 仓库调用待复核；弃用标记 | 权限为 `inventory:view`；确认商城媒体响应契约 | 未知；搜索调用并观察完整周期 |
| `PUT /shop/images/:id/primary` | 目标意图为 `PUT /phones/:phoneId/images/:imageId/primary` | 仓库调用待复核；弃用标记 | 旧路由只有一个 `id`，标记中的替代路径需要 phoneId/imageId；当前映射关系不明确，不能视为已完成迁移 | 未知；先核实旧 ID 语义及客户端，再修正适配/迁移，不得直接删除 |
| `DELETE /shop/images/:id` | 目标意图为 `DELETE /phones/:phoneId/images/:imageId` | 仓库调用待复核；弃用标记 | 单个旧 ID 与新双 ID 路径映射待核实；权限为商城售出商品删除权限集合 | 未知；先确认 ID/权限映射和调用方 |
| `POST /shop/upload-phone-image` | `POST /phones/:id/upload-image` | 仓库调用待复核；弃用标记 | 旧入口本身无路径 `id`，而替代入口需要 `:id`；替代链接目前不能单靠路由参数自动补齐 | 未知；核实旧请求中设备 ID 来源、上传契约及调用方 |
| `GET /shop/products/:id/images` | `GET /phones/:id/images` | 仓库调用待复核；弃用标记 | 旧权限是商城商品查看权限集合；标准入口权限需覆盖合法商城用户 | 未知；先确认权限/响应兼容，再观察 |
| `PUT /shop/products/:id/images/reorder` | `PUT /phones/:id/images/reorder` | 仓库调用待复核；弃用标记 | 旧权限是商城模板编辑权限集合；标准入口须保留该授权语义 | 未知；先核实标准路由权限及载荷契约 |

共登记 **28 个弃用路由**；其中 **10 个还带有兼容标记**（`query-models`、4 个 `phones-reference-*`、4 个 `shop-base-data-*`、`brands-models-by-brand`）。其余 18 个仅标为弃用。路由数量以 `deprecatedRoute` 注册为准，不等于 28 种不同业务行为。

## 观察与审计

- 云端日志扫描结果（用户提供）：范围显示为 2026-05-15 至 2026-10-02，共 17 个 combined 文件、扫描 16,952 行，弃用访问 0 次。文件数量少于自然日跨度，且 combined 默认保留 14 天；不能视为覆盖完整观察期。
- 兼容路由之前调用 `log.debug`，生产环境不会写入 combined 日志，因此旧日志无法证明这 10 个兼容入口没有访问。
- 本次将兼容访问改为 `info` 级别写入 combined 日志；只记录路由路径（剥离 query）、方法、兼容 ID、用户 ID 和 User-Agent，不记录关键词或查询参数。必须先部署包含该改动的后端，再从部署时间开始累计观察周期。
- `cd backend && npm run audit:deprecated-routes` 分别汇总 `migration_id` 弃用访问和 `compatibility_id` 兼容访问。该命令只扫描当前 `backend/logs/combined-YYYY-MM-DD.log` 文件；要覆盖较长周期，应按部署日志规范归档并合并完整日志后扫描，不能仅凭起止日期判断日志连续。
- 同一个请求若同时经过两个标记，会同时计入弃用和兼容两类统计；两项是不同维度，不能相加作为总请求数。
- 日志中的 user-agent 只能帮助识别客户端类型，无法单独证明不存在外部调用方。结合发布记录、反向代理访问来源及已知集成方核实。

## 当前进度

| 阶段 | 状态 | 说明/下一步 |
| --- | --- | --- |
| 建立兼容清单 | 已完成（首轮核对） | 28 个弃用入口和 10 个兼容标记已登记；商城媒体的三个目标映射存在 ID 契约疑点，需专项核对 |
| 内部调用迁移 | 部分完成 | 多数参考选项、人员、考勤工资前端已迁移；商城媒体入口需再检索调用，不能仅按注释判定无人使用 |
| 兼容访问可观测 | 代码已补齐，待部署 | 生产此前的兼容 `debug` 日志不持久化；观察期从本次日志修正部署之后开始 |
| 一个完整发布周期观察 | 未开始/未完成 | 需确定发布周期并保存完整 combined 日志；已知云端扫描不能作为完整零访问证据 |
| 旧路由逐项删除 | 未开始 | 不批量删除；逐项满足删除条件后评估，并优先保留权限适配语义 |

最后核实日期：2026-10-02

## 相关资料

- [公共选项与检索统一实施方案](reference-options-search-unification.md)
- [日志系统标准](LOG_SYSTEM_STANDARDS.md)
- [文档编写与维护规范](DOCUMENTATION_STANDARDS.md)
