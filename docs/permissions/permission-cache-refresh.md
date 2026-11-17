# 权限缓存刷新说明

适用于前端权限界面及后端认证身份缓存。权限的三层边界见[页面权限能力规范](../frontend/permission-capability-standards.md#页面数据范围与动作三层边界)。

## 服务端失效

`backend/src/middleware/unified-auth.js` 的 `invalidateAuthProfiles(userIds)` 按用户 ID 清理身份缓存，不传参数则清空。角色动作、菜单或字段权限变更、角色状态/类型变更、用户角色分配、旧 `/users` 账户变更以及员工账户变更成功后调用。下一次同令牌请求重新读取身份和权限，停用账户不能复用旧身份，停用角色不参与权限加载。

用户门店绑定的新增、替换、主店设置、单店移除和清空均在事务内锁定用户；替换时删除旧绑定与写入新绑定同事务提交，失败保留旧绑定。所有绑定修改均失效该用户身份缓存（部分写入失败也失效）。权限读取异常必须向上返回失败，不可把异常转为空权限后判定目标为非管理员。已核验的空权限数组为明确拒绝结果，不再次回退查询。统一认证从当前 `user_stores` 与有效门店关联读取门店范围及主店，不使用 JWT 签发时的门店快照；未绑定时返回空范围。

权限缓存清理不撤销 JWT 本身；每个业务动作仍通过统一鉴权及对象、门店、字段范围检查。多进程部署的本地缓存按各进程失效和 3 秒 TTL 收敛，不承诺跨进程广播；发布及紧急撤权应重启全部后端实例。回归 `backend/test/auth-profile-invalidation.check.js` 使用模拟持久层，不连接业务库。

## 业务响应缓存

`backend/src/middleware/cache.js` 对已登录请求、携带 Authorization 或 Cookie 的请求以及显式禁用缓存的入口统一设置 `no-store`，直接执行控制器，不读取或写入整包响应缓存。门店解绑、角色或字段变更后，每次业务请求重新经过当前身份、门店及字段检查；不能以 10 秒查询缓存替代授权。前端 `unifiedApi` 同样禁止携带认证头的请求使用本地响应缓存，并遵守服务端 `Cache-Control: no-store/private`，不能用旧缓存替换刚返回的脱敏响应。匿名且无凭据的公开 GET 仍可使用原 TTL 缓存。回归见 `backend/test/query-cache-route.check.js`。

## 前端刷新

业务门店下拉统一使用 `getStores({ strictScope: true })`；门店范围与当前账号相关，公共入口始终通过 `unifiedApi` 发起 `useCache:false` 请求，不把门店范围放进页面缓存。用户分配门店的管理界面使用 `getStores()` 获取完整门店选项；前端候选列表不能替代后端业务对象检查。

国补照片签名校验后复用 `loadCurrentAuthUser` 装配当前有效身份，不复用旧身份缓存；再检查国补查看/上传权限、当前照片关联门店及字段。已入库照片引用必须属于授权店；未保存的照片仅允许签名所属、仍有上传权限且具备门店范围的用户预览。照片响应为 `private, no-store`；已显示或已下载内容不能因撤权从客户端追溯移除。

权限管理保存后沿用 `PermissionsView.vue` 的公共权限刷新流程；其他用户已打开的页面可能暂留旧按钮，刷新页面或重新登录会重新加载。组件通过 `useAuthStore`、`usePagePermissions` 和 `v-permission` 消费同一结果，不另建权限缓存或请求实例。路由与指令统一调用 `authStore.hasPermission`，不能直接使用原始权限数组补救认证失败。

本地缓存仅恢复登录上下文；有无 session token、缓存角色是否完整都必须重新核验身份与权限。核验中拒绝授权；任一响应无效或服务不可用时清空授权结果、保持未就绪，可重试获取；401 或令牌撤销/过期清除登录，不恢复旧缓存。登录和刷新响应中的状态 0 保持停用；明确的空权限列表不得回退到旧摘要，服务端空角色列表不得恢复缓存角色。登录及令牌刷新仅在有效成功响应后恢复授权。正式前端回归为 `frontend/tests/auth-permission-state.spec.ts`、`route-permissions.spec.ts`、`permission-directive.spec.ts`。

主动退出先通过统一 API 调用 `/auth/logout`，待在途刷新完成后注销最新会话，再清理本地状态；退出期间的身份或刷新响应不得恢复旧权限。注销失败时仍清除本地身份并提示服务器注销未确认，不能声称 HttpOnly Cookie 已删除。

按钮暂留不能使后端放行。验收应分别检查：授权后页面/按钮可用，撤权后 API 拒绝，刷新后界面同步；不要通过修改浏览器存储测试服务端授权。

## 验证

运行 `cd backend && ENV_FILE=test/missing-unit-env RUN_DB_TESTS=false node --test test/auth-profile-invalidation.check.js test/permission-boundaries.check.js`。真实角色登录及多实例撤权需另行验收，不把隔离通过写成云端已生效。
