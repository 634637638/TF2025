# 支付管理文档索引

本目录维护货款结算页面的供应商付款登记规则。后台入口为 `/payments`，供应商沿用统一档案。

- [供应商打款指南](SUPPLIER_PAYMENT_GUIDE.md) - 手机货款原有使用说明。
- [供应商打款菜单设置](SUPPLIER_PAYMENT_MENU_SETUP.md) - 菜单配置；实际路由与权限以现行能力清单为准。
- [供应商打款批次规范](SUPPLIER_PAYMENT_BATCH_STANDARD.md) - 手机批次及整批编辑、北京时间、核对图片；商品采购整单金额、登记/撤销审计、门店范围及迁移契约。

页面分为“手机货款 / 商品货款”。手机继续按原设备打款流程，手机批量打款模态框可按所选手机供应商附带选择未打款商品采购单；商品页仍支持没有手机款项时单独登记。商品按已完成采购入库单整批核算，与后续销售、赠送或划拨数量无关。本站登记已完成的实际打款，不自动发起银行转账；当前没有付款审批步骤。

动作权限统一为 `supplier-payments:view/create/edit/export`，分别控制查看、登记、编辑/撤销和手机导出；页面及 API 均独立校验，商品采购另校验原单全部门店范围与字段权限。不使用旧 `supplier-payment:read/approve` 别名推断能力。

相关入口：[权限系统](../permissions/INDEX.md)、[配件公共资料及入库](../backend/accessory-entry.md)、[唯一进度 T22](../development/TECHNICAL_DEBT_PROGRESS.md#t22-配件商品业务闭环2026-11-12)。
