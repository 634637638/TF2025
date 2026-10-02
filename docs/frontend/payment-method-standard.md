# 全站支付方式统一标准

## 目标

支付方式目前只用于记录和选择，不执行真实支付。所有业务页面必须从前端公共配置和组件读取选项，禁止在页面内重复编写 `el-option` 或原生 `option`。

## 公共入口

- 配置：`frontend/src/constants/paymentMethods.ts`
- 主方式选择：`frontend/src/components/payment/PaymentMethodSelect.vue`
- 支付渠道选择：`frontend/src/components/payment/PaymentChannelSelect.vue`
- 文本展示：`frontend/src/components/payment/PaymentMethodText.vue`

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

## 兼容规则

销售类顶层支付方式只有四种：`cash`（现金支付）、`mobile`（移动支付）、`bank_card`（银行卡）、`subsidy_card`（国补刷卡）。银行卡的具体支付渠道统一使用 `PaymentChannelSelect`，包含“刷卡消费”和“银行转账”；“银行转账”不能作为销售类顶层支付方式单独出现。

`transfer`、`bank_transfer`、`wechat`、`alipay`、`card_consumption`、`other` 仅用于历史数据兼容、支付渠道或结算/退款等独立业务域。它们不得加入销售或批量销售的 `PaymentMethodSelect` 顶层选项。

支付方式停用或新增功能暂不在本方案内。需要管理员可配置时，应将 `paymentMethods.ts` 的数据源替换为接口，业务组件的调用方式保持不变。

## 新增规则

新增支付选项时，只允许修改 `paymentMethods.ts`，同时检查后端校验白名单和业务字段说明。提交前应搜索页面源码，确认没有散落的支付方式选项和本地标签映射。
