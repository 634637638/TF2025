# 在库查询测试指南

本文对应公开报价查询页的“在库查询”能力。页面无需登录，但查看库存明细前必须通过服务端在库查询密码验证；验证失败、接口不可用或数据查询失败时，不得回退到默认密码或模拟库存数据。

## 当前实现

- 页面路由：`/price-query`。
- 查询密码由有权限的管理员在系统设置中管理，数据库保存于 `query_users`，密码以 bcrypt 哈希存储。
- `POST /screen-lock/verify-inventory-query` 校验启用的查询密码；成功后签发有效期 10 分钟的专用查询令牌。
- `GET /phones/longest-inventory` 必须携带 `X-Inventory-Query-Token`，并要求品牌、型号、颜色和内存 ID；可选门店 ID。
- 查询结果仅包括 `status = in_stock` 且 `is_new = 1` 的设备，按入库时间升序排列。
- 查询密码不存入浏览器本地存储。`ScreenLockSettings.vue` 的本地缓存仅用于屏幕锁定外观设置，不用于在库查询密码验证。

## 手工验证

1. 在非生产环境使用有系统设置和密码字段权限的管理员账号，创建一个临时在库查询密码。
2. 确认测试数据包含匹配的全新在库设备，以及已售、二手机等不应显示的设备。
3. 打开 `/price-query`，使用正确密码验证后查询该型号，确认只返回符合条件的设备且按入库时间排序。
4. 使用错误密码验证，确认不会显示库存明细；不能以任意固定默认密码通过。
5. 在 Network 中确认验证请求返回查询令牌，后续库存请求通过 `X-Inventory-Query-Token` 发送该令牌。
6. 未验证时直接请求 `/phones/longest-inventory`，确认服务端返回 `401`；缺少规格参数时确认请求被拒绝。
7. 等待令牌过期或在测试环境使用失效令牌重试，确认页面要求重新验证且没有缓存明细继续展示。
8. 停止或断开后端后重试，确认页面显示错误状态，不展示模拟数据。
9. 测试完成后删除临时查询密码，并确认密码值没有进入本地存储、截图、日志或文档。

## 页面回归

报价表正常显示和保存图片应使用一致的列比例与边界。修改导出逻辑后检查：

- 多条记录时表格边框闭合，最后一列后没有空白槽。
- 保存图片后表头和表体列对齐，型号、颜色、内存和价格未被裁切。
- 在桌面 Chromium 与 Safari/iOS Safari 各验证一次。
- 执行 `cd frontend && npm run build`，确认前端检查和生产构建通过。

## 实现入口

- 页面：`frontend/src/views/price-list/page/PublicPriceQuery.vue`
- 明细弹窗：`frontend/src/components/InventoryResultDialog.vue`
- 查询密码管理：`frontend/src/views/system/SystemView.vue`
- 服务端验证：`backend/src/routes/screen-lock.js`
- 明细查询：`backend/src/routes/phones.js`
- 令牌创建与验证：`backend/src/utils/inventory-query-token.js`
