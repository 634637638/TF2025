# 在库查询密码保护

本文说明报价查询页使用的在库查询密码校验。该密码只签发短时在库查询令牌，不等同于员工账户登录。

## 请求行为

- 接口：`POST /api/screen-lock/verify-inventory-query`。
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
