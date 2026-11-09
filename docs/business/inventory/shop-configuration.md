# 库存商城商品配置

本文说明 `/inventory` 的商城入口、新旧机配置范围及上下架行为。

## 入口与权限

- 电脑表格在“状态”后展示“商城”列，点击“商城”直接打开“商城”弹窗。
- 手机和平板沿用双击库存行打开设备详情，从详情底部“商城”进入同一个弹窗。
- 商品配置属于库存编辑动作，复用 `inventory:edit`、`v-permission` 和后端统一认证授权；商城列属于 `system_info.operations` 操作字段，不维护第二套商城权限。
- 库存编辑弹窗只维护库存资料，不再放置商城开关或商品配置入口。

库存编辑中的入库价格输入框填满所在表单列，随电脑、平板和手机布局自适应；不再为已移出的商城控制预留固定宽度。

商城弹窗底部使用公共 `.tf-dialog-actions` 和全局 footer 间距，不设页面级上下留白覆盖；电脑端靠右，手机和平板同一行等宽排列。

## 新旧机范围

全新机展示同品牌、型号、颜色的首个启用模板名称、介绍及媒体只读预览，匹配顺序与商城定价入口一致。“商城状态”行提供当前设备的上下架开关，不表示模板自身的上架状态。不在单台设备中重复维护模板图片、验机资料或独立售价。没有匹配模板时明确提示到 H5 商城模板管理维护，并保留当前设备上下架开关。

二手机维护独立售价、验机资料、图片和视频。素材上传、已有素材删除、主图和排序沿用手机媒体接口；它们是单独操作，取消配置不撤销已有素材的删除或排序。取消时会清理本次新增且尚未随保存确认的上传素材。

## 上下架与保存

新机、二手机的“商城上架”开关均在商品配置中维护。二手机开关位于“上传图片”旁，使用公共正文工具栏同排展示；全新机开关位于表格“商城状态”行，显示“已上架/已下架”，移除顶部重复开关和统一模板说明提示。切换只改变本地表单，点击“保存”才提交；取消不改变已保存的上下架状态。读取失败时禁止保存，需重试成功后操作；提交期间禁止重复保存及关闭弹窗。

- 全新机保存仅写当前设备的 `H5_product.is_published`，不修改模板状态或其他设备。模板本身是否启用、是否上架仍单独影响商城展示；同模板其他设备仍可能使该模板继续展示。
- 二手机验机资料和上下架状态通过同一个请求、同一条数据库写入保存。启用时仍要求至少一份商品素材，下架允许没有素材。
- 保存通过统一 API 失效手机、库存、商城管理及公开商品读取缓存，避免同一浏览器沿用旧商品状态。
- 成功提示为“商城配置已保存”，不把保存资料误报为已上架。
- 没有 H5 配置记录的现存设备默认上架；设备不存在则返回 404。旧验机调用未提供上下架字段时，保留现有状态，不自动把下架商品重新上架。

## 接口与实现

| 操作 | 接口 | 权限 |
| --- | --- | --- |
| 读取配置及新机模板预览 | `GET /api/phones/:id/h5-product` | `inventory:view` |
| 新机保存当前设备上下架 | `PUT /api/phones/:id/h5-product` | `inventory:edit` |
| 二手机保存验机及上下架 | `POST /api/phones/:id/inspection` | `inventory:edit` |

读取响应保留已有 H5 配置字段，补充 `is_new`、有效默认值 `is_published` 和 `template`（二手机或未匹配模板为 `null`）。预览仅返回模板 ID、名称、介绍、上架状态和媒体，不返回关联设备列表。验机写入新增可选数值 `is_published: 0 | 1`；非法状态返回 400。

前端使用 `PublishToH5Modal.vue`、`unifiedApi`、`usePagePermissions`、`SectionLoading` 和公共通知。后端由 `PhoneProductController → ShopService → PhoneProductRepository` 读取配置和模板；现有上下架、验机持久化仍由 `ShopService` 执行。字段契约登记在 `config/field-contracts.json` 的 `phone-h5-product`。本次不修改数据库结构。

## 验证

```sh
npm --prefix frontend run test:unit -- tests/inventory-shop-config.spec.ts tests/inventory-shop-entry.spec.ts tests/inventory-shop-cache.spec.ts
node --test backend/test/phone-product-controller.check.js backend/test/phone-product-configuration.check.js
npm --prefix frontend run type-check
npm --prefix backend test
```

上述前端用例使用模拟接口，后端用例使用模拟服务/数据库；不能代替云端写入或手机真机验收。模板和库存数据属于业务数据，手工测试上下架、上传或删除前须确认测试对象及授权。

相关文档：[库存索引](INDEX.md)、[手机媒体接口](../../backend/phone-media-api-unification.md)、[权限能力规范](../../frontend/permission-capability-standards.md)。
