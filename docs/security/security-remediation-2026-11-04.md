# TF2025 高优先级安全修复记录（2026-11-04）

本文记录 2026-11-04 的高优先级修复、验证结果与尚未实施事项。最新增量复核以 `main / 0ad75ce` 为代码基线，并保留当日未提交工作区；除文中明确写明已执行的历史数据库迁移外，不代表本轮代码已经部署或生产迁移已经执行。

## 修复基线与备份

- 当前分支：`main`；执行期间保留工作区原有未提交改动，不做重置或覆盖。
- 本轮增量复核未运行真实数据库测试、`migrate:schema -- --apply`、国补照片 `--apply` 或任何生产写入命令。
- 历史工作区快照：Git stash `pre-fix-b7b200e-20261104`，包含当时已跟踪和未跟踪文件。
- 最新完整备份：`backend/backups/backup_20261104_142118.zip`，包含云数据库 79 张表和上传目录，未包含 `.env`。
- 备份生成后数据库连接池已正常关闭；`unzip -t` 完整性检查通过，未检测到压缩数据错误；备份文件未提交到 Git。

## 已完成

### 门店路由未定义连接池变量

`backend/src/routes/stores.js` 在迁移到 `StoreRepository` 的过程中仍把已删除的 `pool` 传给辅助函数，导致创建、更新和详情接口可能抛出 `ReferenceError`。

修复后，门店查询统一通过 `storeRepository.executePrepared()`，事务连接仍通过 `storeRepository.acquireConnection()` 获取。新增 `backend/test/stores-route-regression.check.js`，覆盖创建、更新、详情和删除路由的运行路径。

### 数据检查动态更新字段

`backend/src/services/data-check.service.js` 原先把请求体字段名直接拼接进 `UPDATE ... SET`，参数绑定只能保护值，不能保护列名，同时允许修改非业务授权字段。

修复后：

- 每种数据类型分别声明表名和允许编辑字段。
- 表名、列名和主键统一使用反引号包裹，值继续使用参数绑定。
- 未知字段、空对象、非法 ID，以及 `id`、`password`、`role`、`status` 等非白名单字段返回 400。
- 更新后的查询只返回允许编辑的字段，不使用 `SELECT *`，避免员工记录携带密码字段。
- 前端编辑框只展示同一业务类型允许编辑的字段，不再回传状态、关联显示字段或重复检查标记。

新增 `backend/test/data-check-edit-security.check.js`，覆盖恶意列名、敏感字段和合法白名单 SQL。

### H5 订单状态竞态

公开订单取消、用户确认支付和后台取消现在均在事务中锁定订单行，并使用带当前状态条件的更新语句检查 `affectedRows`。支付确认与公开取消同时到达时，只有第一个取得行锁且仍满足 `pending` 条件的请求可以完成状态转换。

新增 `backend/test/shop-public-transaction.check.js`，以可控事务连接验证同一待支付订单的两个并发取消请求只有一个成功，并检查支付确认、公开取消和后台取消的锁与条件更新契约。

### H5 注册事务与客户手机号唯一约束

H5 注册的客户创建、Token 创建和用户回读已放入同一数据库事务；Token 写入失败会回滚客户记录，重复手机号统一返回 409。

首次云库只读预检发现全体客户存在一组两行的历史重复手机号。人工修正该组数据后再次预检：10,023 条客户记录的 `TRIM(phone)` 全部唯一，没有空值或首尾空格。随后建立全体客户规范化手机号生成列 `normalized_phone` 和唯一索引 `uk_customers_normalized_phone`，防止 H5 注册及其他业务入口再次创建同号客户。

迁移入口为：

```bash
# 默认只预览重复数据和待执行步骤
npm --prefix backend run migrate:customer-phone-uniqueness

# 执行迁移
npm --prefix backend run migrate:customer-phone-uniqueness -- --apply

# 回滚唯一索引和生成列
npm --prefix backend run migrate:customer-phone-uniqueness -- --rollback
```

2026-11-04 已在当前云库执行 `--apply`，脚本返回 `migrated_and_verified`。脚本默认不修改数据，执行前会拒绝存在任意客户重复手机号的环境；回滚会恢复为 H5 专用手机号约束，不会删除客户记录。

### H5 登录历史分页与订单索引

`GET /api/public/auth/orders` 和 `GET /api/public/auth/sales` 现在统一接受 `page`、`page_size`，每页最大 50 条，并返回标准分页元数据。登录订单复用服务层现有的批量订单项查询，移除了路由中重复的订单组装逻辑；移动端订单查询页和购买记录弹窗均支持加载更多。

云库 `EXPLAIN` 显示原订单查询使用 `idx_customer_phone` 后仍有 `Using filesort`。新增迁移脚本和复合索引：

```bash
npm --prefix backend run migrate:h5-order-history-index
npm --prefix backend run migrate:h5-order-history-index -- --apply
npm --prefix backend run migrate:h5-order-history-index -- --rollback
```

当前云库已执行 `--apply`。复核时优化器选择 `idx_h5_orders_phone_created(customer_phone, created_at DESC, id DESC)`，`Extra` 不再包含 `Using filesort`。销售历史仍因兼容旧记录使用 `COALESCE(s.sale_time, p.sale_time)` 而需要临时排序；当前按 `idx_customer_id` 过滤后的估算行数较少，暂不增加无法消除排序的冗余索引。

### 价格同步读路径 N+1

`backend/src/services/price-list.service.js` 的未匹配价格保存原先会为每个外部型号执行一次精确查询，精确失败时再执行一次模糊查询；自动补全内存规格时还会为每条在库组合单独查询 `price_list`。

修复后：

- 同步开始前一次读取 `models.name`，在内存中保持“精确优先、去设备前缀后的包含匹配其次”的原有顺序。
- 自动补全开始前一次读取价目表已有的品牌、型号、颜色、内存组合，并使用可区分 `NULL` 与空字符串的稳定键判断是否存在。
- 写入仍逐条调用原有 `upsertPriceItem()`，没有改变采集开关、价格候选顺序或写入规则。
- 删除了一条使用普通引号、实际不会插值的调试日志。

新增 `backend/test/price-list-n-plus-one.check.js`，验证查询次数不随外部型号或库存组合数量增长，并覆盖组合键边界。

2026-11-04 在当前云库执行了只读对比基准，使用 22 个真实在库全新机组合、13 个唯一型号，连续运行 3 次：

| 路径 | 旧逐条查询平均耗时 | 新批量查询平均耗时 | 改善倍数 |
| --- | ---: | ---: | ---: |
| 型号存在性读取 | 1217.27 ms | 85.54 ms | 约 14.2 倍 |
| 价目组合存在性读取 | 2100.28 ms | 85.82 ms | 约 24.5 倍 |

基准过程只执行 `SELECT` 并在结束后关闭连接池，没有触发价格同步、写入或迁移。该结果反映当前云库网络和数据规模下的串行查询差异，不等同于并发压力测试；正式发布后的 API 延迟仍需通过性能监控持续观察。

商城和考勤服务的后续复核结论：当前公开商品列表已经批量加载模板图片、二手机图片和价格；考勤循环只处理已查询结果，没有循环查库。商城服务中仍有三个无调用方的旧聚合方法包含循环查询，保留为 P3 死代码清理项；重新启用前必须先批量化。

### 缓存、限流与日志可靠性

- `backend/src/middleware/cache.js` 的缓存清理定时器改为模块级单例，并调用 `unref()`，避免重复创建定时器阻止进程退出。
- `backend/src/middleware/rate-limit.js` 的统计清理定时器调用 `unref()`；高负载严格限流器在模块加载时创建一次，不再按请求创建实例。
- 新增全局请求上下文中间件，为请求生成或透传 `X-Request-ID`，慢请求、错误日志和错误响应均带同一标识。
- 新增公共敏感数据脱敏工具，覆盖密码、令牌、授权头、Cookie、身份证、私钥、支付密钥、API Key 和 URL 敏感查询参数；基础仓储不再记录完整 SQL 参数。
- 开发环境错误响应同样不再返回堆栈、请求体、路由参数和查询参数。

新增 `backend/test/logging-security.check.js`，并更新前端错误上报契约测试，避免服务端和前端各自维护不同的脱敏逻辑。

前端错误上报进一步收敛为单一实现：删除 `frontend/src/utils/logger.ts` 中失效的 `/api/logs` 私有上报逻辑，普通 `logger` 只保留环境化诊断输出；全局未捕获错误由 Error Boundary 的 `onError`、API 错误由统一请求层转交 `globalErrorLogger`，最终只通过 `/api/logs/errors` 上报。契约测试同时禁止普通日志工具重新引入私有 `fetch`、上报地址或 `sendToServer()`。

当前环境没有配置 Redis 连接信息，因此本轮没有伪造“多实例缓存一致性已完成”的结论。需要多实例共享的一致性敏感缓存以及登录失败计数迁移 Redis 仍为明确遗留。

### CORS、上传与临时接口复核

- 生产环境若 `ALLOWED_ORIGINS` 包含 `*`，启动时直接拒绝；示例环境文件已补充显式前端域名配置。
- `X-Request-ID` 已加入 CORS 允许头和暴露响应头。
- 无 `Origin` 请求继续允许，因为 CORS 不是服务端鉴权边界，强制拒绝会破坏健康检查和服务间调用。
- 菜单、价目表和数据导入的表格文件最终均经过统一 ZIP/OLE 文件签名、大小限制和安全解析校验；失败路径会清理临时文件。
- `/temp/*` 只有在 `NODE_ENV=development` 且 `ENABLE_DEV_TEMP_ROUTES=true` 时才挂载，生产环境不会注册这些路由。
- 显式启用开发临时接口时会写入启动告警；每次访问记录动作、方法、路径、用户 ID 和 request ID，且内部异常不再通过响应回显。

新增 `backend/test/cors-security.check.js` 和 `backend/test/temp-routes-security.check.js`，验证生产通配来源拒绝、请求标识头、双重环境门控、管理员权限与访问审计契约。

### 备份压缩统计

`backend/src/services/backup.service.js` 原先把压缩文件数声明为不可变的 `0`，导致完成日志与真实 ZIP 内容不一致。修复后通过归档器 `entry` 事件统计实际文件数，压缩方法返回文件数、字节数和耗时，完整备份结果也包含 `file_count`。专项测试使用单文件临时目录验证日志来源和返回统计均为 1。

### P3 质量清理

- 清单中价目表渠道测试的旧页面字符串匹配已经替换为正式归一化入口契约，交易契约测试也已使用完整源文件读取，不再依赖脆弱行号范围。
- 删除 `BrandsView.vue` 中未使用的 `useRouter` 导入和路由实例。
- 购买记录“加载更多”布局改为复用全局 `flex`、`justify-center`、`pt-2` 工具类，没有新增页面私有样式或提高样式债务基线。
- 全仓严格 ESLint、前端类型检查和完整前端标准门禁均已通过。

### 站点增量加固闭环

- Analytics、综合查询、入库和退库统一使用公共门店范围解析；Analytics 的客户、员工、销售子请求及缓存键携带当前 `store_id`，门店下拉只展示授权范围。
- 国补、维修、分享等私有文件不再使用登录 JWT 查询参数。数据库只保存 `/uploads/...` 稳定路径，响应阶段才生成绑定文件路径、用户和过期时间的短时 HMAC URL。
- 国补照片更新会在事务中 `FOR UPDATE` 锁定原记录，只允许清理该记录原本持有且本次已移除的文件；请求不能借 `deleted_photos` 删除其他国补文件。
- 维修单创建和编辑把数据库写入与临时媒体归档放在事务边界内；提交前失败会回滚数据库并把已移动文件恢复到临时目录，提交后旧媒体清理失败只记录告警。
- `replace_all` 数据导入不再先清空提交后逐行导入；清空和全量导入使用同一事务，任意一行失败会恢复导入前数据。事务中不再使用 `ALTER TABLE ... AUTO_INCREMENT` 触发隐式提交。
- 生产业务请求不再负责创建 `data_check_backups` 等结构。`migrate:schema` 默认只读预览，`--apply` 使用 `schema_migrations`、checksum 和 MySQL 命名锁执行显式结构迁移。
- `/live` 只表示 Node 进程存活；`/health` 在超时内执行数据库就绪检查，数据库不可用时返回 503。Nginx 被动重试不能替代云监控、宝塔或独立探针主动请求 `/health`。
- 本轮只完成代码、静态测试和文档闭环；云端 `.env.production`、迁移台账、生产探针和真实上传目录必须按部署步骤人工核验。

## 密钥与 Token 方案实施记录

方案已于 2026-11-04 获得批准并实施：

1. 新增 `backend/src/utils/price-sync-crypto.js`，价格同步密码统一使用独立 `PRICE_SYNC_ENCRYPTION_KEY`、AES-256-GCM、12 字节随机 IV、认证标签和 `enc:v2:` 前缀。生产环境缺失或密钥少于 32 个字符时拒绝启动；开发环境保存或解密时同样不使用源码兜底密钥。
2. 新增 `backend/scripts/migrate-price-sync-encryption.js`。脚本默认只读预览，`--apply` 使用临时注入的旧口令和盐迁移，逐条回读；旧密文经新密钥再次加密后写入 `price_sync_encryption_backup`，`--rollback` 只在迁移后密码未改变且没有无备份新配置时恢复，避免覆盖后续业务修改。
3. 云库 2 条非空旧 CBC 密文已迁移为 `enc:v2:`，2/2 条回读验证成功，迁移备份已建立；源码和迁移脚本均不再包含旧口令或盐常量。
4. 默认配置和按 ID 配置接口只返回 `login_password: '••••••••'` 与 `has_password`，不再接受 `hidePassword=false`，编辑页密码框始终为空并明确提示留空保留。只有同步服务内部入口能够解密密码。
5. 新增 `backend/src/utils/customer-token.js`，注册和登录只向客户端返回一次 32 字节随机 Token，数据库只按 SHA-256 摘要读写；登录在同一事务中删除该客户旧 Token 和过期 Token 后写入新摘要，登出按摘要撤销。
6. 新增 `backend/scripts/migrate-customer-token-hashes.js`。默认预览，`--apply` 增加 `token_hash CHAR(64)`、回填并建立唯一索引，同时保留明文兼容窗口；`--finalize` 在完整匹配校验后清空明文并删除旧索引；最终清理后不能从摘要恢复原 Token，回滚必须恢复完整数据库备份并回退旧应用。
7. 新增 `backend/src/utils/shared-file-access.js`。分享附件改用 5 分钟 HMAC-SHA256 签名 URL，签名绑定文件名、用户 ID 和到期时间；下载仍检查分享可见性或上传者归属，并返回 `private, no-store`、`nosniff` 和同源资源策略。前后端不再把登录 Token 放入 URL，数据库和富文本仍只持久化 `/uploads/shared/...` 原始路径。

云库 Token 迁移已完成最终清理：15/15 条记录均有 64 位 SHA-256 摘要，明文 `token` 为 0 条，缺失摘要为 0 条；`token_hash` 唯一索引和 `token` 可空结构校验通过。

### 价格同步密钥轮换

原 `PRICE_SYNC_ENCRYPTION_KEY` 因被粘贴到非密钥管理渠道，于 2026-11-04 按泄露事件处理并完成轮换：

- 新增 `backend/scripts/rotate-price-sync-encryption-key.js`，支持默认只读预览、`--apply` 轮换和 `--rollback` 紧急恢复；新旧密钥只通过临时环境变量和本机忽略提交的 `.env` 传入，脚本及日志不输出密钥。
- 云库 2 条 `enc:v2:` 业务密文已使用新密钥重新加密并逐条回读；2 条原 CBC 迁移备份也已重新包裹，原格式回滚能力未失效。
- `price_sync_key_rotation_backup` 保留 2 条由新密钥包裹的轮换前密文，并记录条件更新哈希；若轮换后密码被修改，脚本拒绝覆盖回滚。
- 本机 `backend/.env` 已更新为新密钥，后端已重新加载。旧密钥不得再部署或用于新加密操作；云端应用配置必须同步新密钥后重启。

### 全局密钥用途隔离

后续补充完成了单一 `JWT_SECRET` 的职责拆分：

- 新增 `backend/src/utils/security-keyring.js`，访问令牌、刷新令牌、文件访问、订单访问和库存查询分别使用独立 current/previous 密钥。新凭证只用 current 签发，验证可在限定过渡期接受 previous；各用途密钥不能交叉验证。
- `auth.service.js` 与 `jwt-blacklist.js` 统一通过密钥环签发和验证，刷新令牌不再与访问令牌共用密钥；固定 `HS256`、issuer、audience 和令牌类型检查保持不变。
- 导航文件、分享附件、订单访问和库存查询不再读取 `JWT_SECRET`。原签名载荷格式保持兼容，首次升级时把旧 JWT 值保存到各用途 previous，可避免现有短时链接和访客订单凭证立即失效。
- 新增 `backend/src/utils/config-secret-crypto.js`，商城支付秘密不再在开发环境回退到 JWT 或源码默认值。`CONFIG_ENCRYPTION_KEY` 负责新写入，`CONFIG_ENCRYPTION_PREVIOUS_KEY` 只用于轮换期间读取旧密文。
- 新增 `setup:security-keys`、`rotate:signing-key` 和 `migrate:config-encryption-key`。初始化及签名轮换脚本不输出密钥；支付密文迁移默认只读，`--apply` 逐条回读并建立一步回滚备份，条件更新防止覆盖并发修改。
- 本机忽略提交的 `backend/.env` 已补齐独立密钥并保持权限 `600`。云库只读预览确认 1 条支付秘密仍使用上一密钥，显示 `requiresMigration: 1`；为避免云端环境变量尚未同步时影响现网，本次未对该条云库密文执行写迁移。

实施前完整备份为 `backend/backups/backup_20261104_142118.zip`。价格密文可优先使用迁移表回滚；客户 Token 在 `--finalize` 前可直接 `--rollback`，最终清理后必须使用该完整备份恢复明文 Token。回滚应用代码前必须先恢复与旧版本兼容的数据库结构和数据。

## 后续遗留

- P2：一致性敏感缓存和登录失败计数迁移 Redis；销售历史兼容排序待结合数据回填方案优化；发布后补并发压力测试。
- P3：删除或批量化商城服务中无调用方的旧聚合方法；拆分价格服务大文件；执行最终质量门禁。
- 业务确认：公开价目接口是否允许展示批发价和库存必须由业务负责人决定，不能在安全修复中擅自隐藏。
- 环境确认：真机触摸、摄像头扫码、软键盘、安全区、真实上传和支付只可在授权测试环境验证；支付自动化只能使用沙箱或模拟网关。

## 验证

- `git diff --check`：通过。
- 门店与数据检查专项测试：通过。
- H5 事务、分页与迁移专项测试：6 项通过。
- 价目表 N+1 与价格行为相关专项测试：26 项通过。
- 后端全量测试：389 项，375 通过、0 失败、14 项真实数据库回归按默认隔离策略跳过；跳过项不计为云库回归通过。
- 前端类型检查曾在本轮密钥改动完成后通过；最终文档示例复检时，工作区中与本次无关的 `MobileForm.vue`、`PriceMarkupConfig.vue` 和 `StockInPhoneListSection.vue` 出现隐式 `any`，当前完整类型门禁需待这些并行前端改动完成后重跑。
- 全仓严格 ESLint（`--max-warnings 0`）：通过。
- 前端 Vitest：10 个测试文件、38 项测试全部通过。完整标准门禁在设计令牌审计阶段被现有库存、菜单、价目表、查询和系统样式文件的 57 处增量阻断；这些文件不在本次密钥改动范围，未扩大基线或顺带修改。
- 根目录、后端和前端 `npm audit --audit-level=high`：均为 0 个漏洞。
- 文档链接与导航检查：193 份 Markdown 通过。6 个标记示例曾通过，最终复检被上述前端隐式 `any` 阻断；密钥文档本身未产生链接错误。

## 相关资料

- [安全文档索引](INDEX.md)
- [环境配置与密钥管理](ENVIRONMENT_SECRETS.md)
- [文档编写与维护规范](../guides/DOCUMENTATION_STANDARDS.md)
