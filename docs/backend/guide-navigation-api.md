# 导航站后端接口

## 数据表

启动时由 `backend/src/utils/guide-schema.js` 检查并创建 `guide_announcements`、`guide_categories`、`guide_links` 和 `guide_access_tokens`。四张表独立于商城模板、经验分享和 H5 数据。公告表的 `is_pinned` 表示置顶状态，同一时间最多保留一条置顶公告。

`guide_categories.parent_id` 用于两级分类：为空表示一级分类，填写一级分类 ID 表示二级分类。二级分类不能再创建下级分类。`guide_links.category_id` 表示连接所属分类，可绑定任意一级或二级分类；服务端验证目标分类存在。启动迁移会清理旧版 `guide_links.parent_id` 连接父级字段，保留连接记录和所属分类，不再把连接当作分类标题。

## 公开接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/public/guide` | 获取有效公告、启用分类和公开分类导航 |
| POST | `/api/public/guide/categories/:id/unlock` | 校验分类密码并返回当前分类内容与访问令牌 |
| GET | `/api/public/guide/categories/:id` | 使用 `X-Guide-Token` 读取分类导航；公开分类可直接读取 |

公开接口不使用业务缓存，保证后台修改后前台重新打开即可获取最新内容。公告按置顶、排序值和创建时间倒序返回，前台将置顶公告固定展示，其他公告按返回顺序每 4 秒整条切换一次。

## 管理接口

管理接口统一使用 `/api/guide` 前缀，并在身份认证后检查 `guide:*` 权限。公开路由独立位于 `guide-public.js`，后台管理路由位于 `guide.js`，保持逐路由安全审计边界清楚。文件上传只返回受控存储信息，文件名由服务端生成，所有网址、标题、分类名称、访问策略、扩展名和 MIME 均在服务端再次校验。

文件类型导航通过 `GET /api/public/guide/files/:id` 访问。公开分类不要求签名，图片可由浏览器直接展示；后端仍重新读取数据库记录，校验连接和分类启用状态、文件关联和真实路径。密码分类文件需要 10 分钟有效的 HMAC 签名，前端通过 `X-Guide-File-Expires` 和 `X-Guide-File-Signature` 请求头提交，避免把访问凭证放入 URL 和访问日志。图片以内联方式返回，其他文件（包括 Apple `.mobileconfig`、APK/IPA、音频和视频）以附件方式返回，服务端不执行或解析这些文件。`/uploads/guide/` 已从通用静态服务中禁止直接访问，不能把数据库中的物理存储地址暴露给前端。
