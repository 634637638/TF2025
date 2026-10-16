# 后端安全文件访问规范

## 目标

上传文件的物理路径只存在于后端存储层。业务接口返回逻辑访问地址，不能把可猜测的 `/uploads/...` 直链作为私有文件地址。

## 接口要求

- 每个私有文件接口必须校验记录存在、文件类型、启用状态、访问用户权限和业务归属。
- 密码保护的导航文件使用 `guide-file-access.js` 生成 10 分钟 HMAC-SHA256 访问凭证；前端通过请求头发送凭证，不得放入 URL 查询串；签名使用 `timingSafeEqual` 校验。公开导航文件不要求签名，但仍必须验证数据库关联、启用状态和物理路径。
- 文件真实路径必须通过 `upload-paths.js` 解析，并限制在对应业务目录内，禁止路径穿越。
- 图片使用 `Content-Disposition: inline`，其他文件使用 `attachment`。
- 响应设置 `X-Content-Type-Options: nosniff` 和 `Cache-Control: private, no-store`。
- 访问日志必须脱敏 `signature`、`expires`、`download_token`、`file_token` 等参数。

## 静态目录边界

通用 `/uploads` 静态服务只允许公开展示资源。`guide`、`subsidy`、`shared`、`rentals`、`repairs`、`import` 和 `temp` 等私有目录必须返回 404，改由各自受控路由响应。

## 生命周期

业务记录删除、文件替换和分类级联删除必须同步删除关联数据库记录和物理文件。清理失败应写入后端告警，但不能把文件改为公开静态资源。

