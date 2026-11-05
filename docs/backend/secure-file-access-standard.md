# 后端安全文件访问规范

## 目标

上传文件的物理路径只存在于后端存储层。业务接口返回逻辑访问地址，不能把可猜测的 `/uploads/...` 直链作为私有文件地址。

## 接口要求

- 每个私有文件接口必须校验记录存在、文件类型、启用状态、访问用户权限和业务归属。
- 密码保护的导航文件使用 `guide-file-access.js` 生成 10 分钟 HMAC-SHA256 访问凭证；分享、国补和维修附件使用公共 `private-file-access.js` 生成不超过 10 分钟的受控 URL。签名必须绑定命名空间、规范化路径、用户 ID 和过期时间，不得放入登录 Token；统一使用 `FILE_ACCESS_SIGNING_KEY`，轮换期间验证 current 与 `FILE_ACCESS_PREVIOUS_SIGNING_KEY`。公开导航文件不要求签名，但仍必须验证数据库关联、启用状态和物理路径。
- 私有文件路径按 Unicode NFC 规范化；合法路径段可包含 Unicode 字母、数字、组合标记、点、下划线和连字符，以兼容国补中文姓名目录。空路径段、`.`、`..`、目录分隔符及其他字符必须拒绝，不能通过退回无签名 `/uploads` 地址绕过校验。
- 私有业务表只保存 `/uploads/<业务目录>/...` 稳定路径，不保存带 `user`、`expires`、`signature` 的响应 URL。短时访问 URL 只能在响应阶段生成，历史签名 URL 必须通过对应迁移脚本规范化。
- 文件真实路径必须通过 `upload-paths.js` 解析，并限制在对应业务目录内，禁止路径穿越。
- 图片使用 `Content-Disposition: inline`，其他文件使用 `attachment`。
- 响应设置 `X-Content-Type-Options: nosniff`。私有文件默认使用 `Cache-Control: private, no-store`；经专项审计的同源图片预览可以使用不超过签名剩余有效期的浏览器私有缓存，禁止共享代理或 CDN 缓存。国补照片使用 5 分钟 `private, max-age=300, must-revalidate`，签名地址列表同步复用 5 分钟，签名最长 10 分钟失效。列表只允许按用户对照片入口的指向或聚焦意图预取当前记录的签名列表和第一张图片，不得批量预取整页客户照片。
- 访问日志必须脱敏 `signature`、`expires`、`download_token`、`file_token` 等参数。

## 静态目录边界

通用 `/uploads` 静态服务只允许公开展示资源。`guide`、`subsidy`、`shared`、`rentals`、`repairs`、`import` 和 `temp` 等私有目录必须返回 404，改由各自受控路由响应。

## 生命周期

业务记录删除、文件替换和分类级联删除必须同步删除关联数据库记录和物理文件。删除接口必须从锁定后的原业务记录计算允许删除的文件集合，禁止信任请求提供的任意路径。数据库提交后的物理清理失败应写入后端告警并进入孤立文件治理，不能回滚成错误响应或把文件改为公开静态资源。

