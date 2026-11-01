# 在库查询密码保护

本文说明报价查询页使用的在库查询密码校验。该密码只签发短时在库查询令牌，不等同于员工账户登录。

## 请求行为

- 接口：`POST /api/screen-lock/verify-inventory-query`。
- 验证成功后签发的 10 分钟令牌也用于 `GET /api/phones/used-models` 和 `GET /api/phones/longest-inventory`，请求头为 `X-Inventory-Query-Token`。
- `GET /api/phones/used-models` 仅返回在库、非预订的二手机规格汇总：品牌、型号、颜色、内存、在库台数、原始入库价及配置后的显示价，不返回 IMEI、序列号、门店、供应商或备注；关键词匹配品牌、型号、颜色和内存。
- `/price-query` 的“二手机”视图展示品牌、型号、颜色、内存和价格；同一规格按当前在库设备的 `purchase_cost` 分行，不同价格分别展示，显示价另加全局二手机加价。双击价格行时，明细接口按成色和原始入库价筛选。
- 此接口不使用应用层密码重试限流，输错密码不会导致后续正确密码被暂时封锁。
- 前端只在请求进行中阻止并发重复提交；请求结束后可立即再次尝试，不限制总尝试次数。
- 密码错误由接口以 HTTP 401 返回；前端将该端点的 401 视为预期校验失败，不触发员工登录令牌刷新，也不记录为系统 API 故障，页面继续提示未检索到数据。
- 反向代理、WAF 或云平台仍可能有独立于应用的流量限制，须在部署环境单独检查。

取消此端点应用限流会增加密码被反复猜测的风险。应使用足够强且不与其他系统共用的密码，并保护好配置该密码的管理入口。

## 相关实现

- `backend/src/middleware/rate-limit.js`
- `backend/src/routes/screen-lock.js`
- `frontend/src/utils/unified-api.ts`
- `frontend/src/views/price-list/page/PublicPriceQuery.vue`
- `backend/test/inventory-query-password-contract.check.js`
