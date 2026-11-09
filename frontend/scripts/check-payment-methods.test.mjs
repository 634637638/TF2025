import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { auditPaymentMethods, loadPaymentMethods } from './check-payment-methods.mjs'

const readConfig = () => JSON.parse(readFileSync(new URL('../../backend/src/config/payment-methods.json', import.meta.url), 'utf8'))

test('支付审计验证实际导出的方式与渠道，公共配置新增渠道后自动可选和显示名称', () => {
  const shared = readConfig()
  shared.channels.mobile.push({ label: '新增移动渠道', value: 'new_mobile_channel' })
  const config = loadPaymentMethods(shared)
  assert.deepEqual(auditPaymentMethods(config, shared), [])
  assert.equal(config.getPaymentChannelOptions('mobile').at(-1).value, 'new_mobile_channel')
  assert.equal(config.getPaymentMethodLabel('new_mobile_channel'), '新增移动渠道')
})

test('缺失销售方式、私有退款选项和缺失公共渠道都不能通过门禁', () => {
  const shared = readConfig()
  const config = loadPaymentMethods(shared)
  for (const broken of [
    { ...config, SALE_PAYMENT_METHODS: config.SALE_PAYMENT_METHODS.slice(1) },
    { ...config, REFUND_PAYMENT_METHODS: [{ label: '现金退款', value: '现金退款' }] },
    { ...config, getPaymentChannelOptions: () => [] },
    { ...config, getPaymentMethodLabel: value => value }
  ]) assert.ok(auditPaymentMethods(broken, shared).length > 0)
})
