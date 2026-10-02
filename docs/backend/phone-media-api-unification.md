# 手机媒体接口统一说明

本文说明手机图片/视频接口的唯一业务实现、内部调用路径和兼容入口迁移规则，适用于后端维护者及前端接口调用方。

## 规范

手机媒体的内部 canonical 路由统一使用 `/api/phones/:id`：

| 操作 | canonical 路由 |
| --- | --- |
| 获取图片/视频 | `GET /api/phones/:id/images` |
| 设置主图 | `PUT /api/phones/:id/images/:imageId/primary` |
| 删除单个媒体 | `DELETE /api/phones/:id/images/:imageId` |
| 调整排序 | `PUT /api/phones/:id/images/reorder`，请求字段为 `imageIds` |
| 上传图片 | `POST /api/phones/:id/upload-image`，文件字段为 `image` |
| 上传视频 | `POST /api/phones/:id/upload-video`，文件字段为 `video` |

所有图片/视频读写处理复用 `backend/src/controllers/phone-media.controller.js`；上传归档和 `H5_images` 写入也由该控制器统一执行。路由层保留各业务入口所需的认证和权限校验。图片排序控制器暂时同时接受 `imageIds` 和历史字段 `image_ids`，新调用方只能使用 `imageIds`。

## 兼容入口

历史 `/api/shop/phones/:id/images`、`/api/shop/images/:id`、`/api/shop/images/:id/primary`、`/api/shop/products/:id/images`、`/api/shop/products/:id/images/reorder` 和 `/api/shop/upload-phone-image` 暂作迁移期兼容路由。它们复用 canonical 控制器或媒体持久化函数，响应带有弃用标记及替代路径；仓库内前端不得继续调用这些地址。删除兼容路由前，应通过后端弃用日志确认外部客户端已迁移。

`DELETE /api/shop/products/:id/images` 是已售商品管理的批量删除操作，不等同于单个媒体删除，因此仍保留其商城权限和路由；服务层逐条复用单个媒体删除逻辑。

商城模板的品牌、型号、颜色、内存调用也已迁移到通用基础数据路由，前端由 `reference-options.ts` 统一封装；旧 `/api/shop/base-data/*` 地址改为弃用兼容别名，查询仍复用 `reference-options.service`。其他 `/api/phones/*`、`/api/query/models` 与资源列表接口因数据同步行为、门店上下文或响应契约不同，不作为可直接删除的重复路由。

## 权限与调用

- 所有 canonical 媒体路由使用统一认证中间件，并按业务权限列表授权；不要在控制器内绕过权限中间件。
- 前端统一使用 `unifiedApi`，媒体类型由图片/视频上传路由分别校验。
- 批量清理、单个媒体删除、排序和主图更新不得直接从前端调用数据库或上传文件存储工具。

## 验证

在 `backend/` 目录运行：

```sh
npm test
```

手机媒体接口的路由复用、弃用标记和前端 canonical 调用由 `backend/test/phone-media-api-contract.check.js` 覆盖。数据库文件删除和远端数据库写入需在具备相应测试环境时单独验证。

## 相关资料

- [后端文档索引](INDEX.md)
- [上传文件存储与迁移规范](upload-storage-standard.md)
- [API 调用规范](../guides/api-standards.md)
