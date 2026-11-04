# 第四批：商城媒体旧接口退役记录

> 文档类型：接口退役归档记录
> 批次状态：映射待核实，禁止删除
> 接口数量：6
> 当前任务入口：[全局技术债务进度 T6](../../development/TECHNICAL_DEBT_PROGRESS.md)

本批包含图片列表、主图、删除、上传和排序接口。部分旧路径只有一个 `id`，标准入口需要 `phoneId` 和 `imageId`，不能仅根据替代链接直接删除。

| 方法与路径 | migration ID | 目标入口 | 当前风险 |
| --- | --- | --- | --- |
| `GET /api/shop/phones/:id/images` | `shop-phone-images-to-phones` | `GET /api/phones/:id/images` | 核实商城权限和响应 |
| `PUT /api/shop/images/:id/primary` | `shop-phone-image-primary-to-phones` | `PUT /api/phones/:phoneId/images/:imageId/primary` | 单 ID 到双 ID 映射不明确 |
| `DELETE /api/shop/images/:id` | `shop-phone-image-delete-to-phones` | `DELETE /api/phones/:phoneId/images/:imageId` | 单 ID、删除权限和归属待核实 |
| `POST /api/shop/upload-phone-image` | `shop-phone-media-upload-to-phones` | `POST /api/phones/:id/upload-image` | 设备 ID 来源及上传载荷待核实 |
| `GET /api/shop/products/:id/images` | `shop-product-images-to-phones` | `GET /api/phones/:id/images` | 商城查看权限兼容待核实 |
| `PUT /api/shop/products/:id/images/reorder` | `shop-product-images-reorder-to-phones` | `PUT /api/phones/:id/images/reorder` | 模板编辑权限及载荷待核实 |

## 删除记录

- 删除前标签：待填写
- 删除 commit：待填写
- ID/权限/载荷映射结论：待填写
- 调用方与页面：待填写
- 部署版本与观察周期：待填写
- 回滚结果：待填写
