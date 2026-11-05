# 第四批：商城媒体旧接口退役记录

> 文档类型：接口退役归档记录
> 批次状态：代码已删除，待提交和部署观察
> 接口数量：6
> 当前任务入口：[全局技术债务进度 T6](../../development/TECHNICAL_DEBT_PROGRESS.md)

本批包含历史图片列表、主图、单图删除、上传和排序接口。仓库调用扫描为 0 后已删除旧路径；部署后若出现外部客户端错误，应根据实际载荷修正规范调用或最小恢复，不能猜测单 ID 到双 ID 的映射。

| 方法与路径 | migration ID | 目标入口 | 当前风险 |
| --- | --- | --- | --- |
| `GET /api/shop/phones/:id/images` | `shop-phone-images-to-phones` | `GET /api/phones/:id/images` | 核实商城权限和响应 |
| `PUT /api/shop/images/:id/primary` | `shop-phone-image-primary-to-phones` | `PUT /api/phones/:phoneId/images/:imageId/primary` | 单 ID 到双 ID 映射不明确 |
| `DELETE /api/shop/images/:id` | `shop-phone-image-delete-to-phones` | `DELETE /api/phones/:phoneId/images/:imageId` | 单 ID、删除权限和归属待核实 |
| `POST /api/shop/upload-phone-image` | `shop-phone-media-upload-to-phones` | `POST /api/phones/:id/upload-image` | 设备 ID 来源及上传载荷待核实 |
| `GET /api/shop/products/:id/images` | `shop-product-images-to-phones` | `GET /api/phones/:id/images` | 商城查看权限兼容待核实 |
| `PUT /api/shop/products/:id/images/reorder` | `shop-product-images-reorder-to-phones` | `PUT /api/phones/:id/images/reorder` | 模板编辑权限及载荷待核实 |

## 删除记录

- 删除前标签：`compat-routes-before-removal-20261104`
- 删除 commit：待填写
- 代码删除日期：2026-11-04
- ID/权限/载荷映射结论：本站无旧调用；外部旧客户端未知，出现真实请求后按实际载荷处理
- 调用方与页面：旧路径本站调用 0；正式 `DELETE /api/shop/products/:id/images` 仍由综合查询和 H5 已售商品页面使用并保留
- 部署版本与观察周期：待提交部署后填写
- 回滚结果：待填写
