# 全站支付方式统一标准

## 目标

支付方式目前只用于记录和选择，不执行真实支付。所有业务页面必须从前端公共配置和组件读取选项，禁止在页面内重复编写 `el-option` 或原生 `option`。

## 公共入口

- 方式与渠道唯一配置：`backend/src/config/payment-methods.json`（前后端共用）
- 前端公共入口：`frontend/src/constants/paymentMethods.ts`
- 主方式选择：`frontend/src/components/payment/PaymentMethodSelect.vue`
- 支付渠道选择：`frontend/src/components/payment/PaymentChannelSelect.vue`
- 文本展示：`frontend/src/components/payment/PaymentMethodText.vue`

退库退款使用 `PaymentMethodSelect` 的 `refund` 场景，退款方式由全局销售方式排除国补刷卡后派生，再保留原路退回。当前为现金支付（`cash`）、移动支付（`mobile`）、银行卡（`bank_card`）、原路退回（值保留为 `原路退回`）。使用 `PaymentChannelSelect` 读取同一全局配置：移动支付可选微信/支付宝，银行卡可选刷卡付款/银行转账。渠道存在时必选，切换方式清空旧渠道；现金及原路退回不显示渠道，保存为 `null`。查看记录使用 `PaymentMethodText` 的可选 `channel` 属性显示“移动支付 / 支付宝”等完整名称。后端使用同一份配置校验方式与渠道组合，禁止单独维护退款白名单。业务闭环见[退库与交易撤销](../business/inventory/transaction-reversal.md)。

## 使用方式

销售、快速销售、批发和租赁使用销售场景：

```vue
<PaymentMethodSelect
  v-model="form.payment_method"
  variant="sale"
  placeholder="请选择支付方式"
  clearable
  @change="handlePaymentMethodChange"
/>
<PaymentChannelSelect
  v-model="form.payment_channel"
  :payment-method="form.payment_method"
  placeholder="请选择支付渠道"
  clearable
/>
```

工资和供应商付款使用结算场景：

```vue
<PaymentMethodSelect
  v-model="form.payment_method"
  variant="settlement"
  placeholder="请选择支付方式"
/>
```

表格、详情和导出前的页面展示使用：

```vue
<PaymentMethodText :value="row.payment_method" />
```

## 记录闭环

销售、批量销售、快速销售和批发/调货分别将 `payment_method` 与 `payment_channel` 保存到对应的 `sales` 销售记录。综合查询编辑也必须提交并更新这两个字段；`mobile` 顶层方式下，微信或支付宝保存为 `wechat` 或 `alipay` 渠道。支付渠道不应替代顶层支付方式。

退库分别保存 `refund_method` 和 `refund_channel`；退款记录的渠道随方式统一受 `record.refund_method` 字段权限控制。编辑提交渠道时必须同时提交方式，后端拒绝错配和漏选，不读取或修改原销售的支付渠道。新增渠道的数据库迁移与授权状态见退库业务规范及字段台账。

## 兼容规则

销售类顶层支付方式只有四种：`cash`（现金支付）、`mobile`（移动支付）、`bank_card`（银行卡）、`subsidy_card`（国补刷卡）。银行卡的具体支付渠道统一使用 `PaymentChannelSelect`，包含“刷卡付款”和“银行转账”；“银行转账”不能作为销售类顶层支付方式单独出现。

`transfer`、`bank_transfer`、`wechat`、`alipay`、`card_consumption`、`other` 仅用于历史数据兼容、支付渠道或结算等独立业务域。它们不得加入销售、批量销售或本次退库退款的 `PaymentMethodSelect` 顶层选项。

目前配置随代码发布，不是在线管理接口。全局配置新增渠道后，销售、综合查询编辑、退库及后端退款校验同步读取，无需逐页修改；需要重新构建前端并部署后端配置。

## 新增规则

新增方式或渠道只维护 `backend/src/config/payment-methods.json`，各场景通过公共入口派生。新增销售顶层方式需要同步调整已登记的业务规范及对应审计断言；新增既有方式的渠道无需改退库代码、退款白名单或名称映射。提交前运行 `npm --prefix frontend run check:payment-methods` 和 `node --test frontend/scripts/check-payment-methods.test.mjs`，验证真实公共导出与配置一致，以及新增渠道能自动读取和展示；不得通过只查源码关键词绕过运行时配置核验。
