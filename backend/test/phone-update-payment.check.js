'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const PhoneUpdateService = require('../src/services/phone-update.service')
const paymentOptions = require('../src/config/payment-methods.json')

// 只运行到支付校验后的读取边界，不连接数据库或写入交易。
const validatePayment = async (body, status = 'sold') => {
  const afterValidation = new Error('payment-validation-passed')
  const repository = {
    withConnection: operation => operation({}),
    getPhoneForUpdate: async () => ({
      id: 11, status, brand_id: 1, model_id: 2, color_id: 3, memory_id: 4,
      store_id: 5, imei: 'TESTSERIAL', serial_number: 'TESTSERIAL', is_new: 1
    }),
    findDuplicateImei: async () => { throw afterValidation }
  }
  try {
    await new PhoneUpdateService({ repository, access: { async authorize() {} } }).update({ params: { id: '11' }, body })
    assert.fail('必须在读取边界结束')
  } catch (error) {
    return error === afterValidation ? null : error.message
  }
}

for (const status of ['sold', 'peer_transfer']) {
  test(`${status} 支付方式与渠道从全局配置校验`, async () => {
    for (const method of paymentOptions.sale) {
      const channels = paymentOptions.channels[method.value] || []
      for (const channel of channels.length ? channels.map(item => item.value) : [null]) {
        assert.equal(await validatePayment({ payment_method: method.value, payment_channel: channel }, status), null)
      }
    }
    for (const [method, channel, message] of [
      ['cash', '-', '请选择有效的支付渠道'],
      ['mobile', '-', '请选择有效的支付渠道'],
      ['mobile', null, '请选择有效的支付渠道'],
      ['bank_card', 'wechat', '请选择有效的支付渠道'],
      ['-', null, '请选择有效的支付方式']
    ]) {
      assert.equal(await validatePayment({ payment_method: method, payment_channel: channel }, status), message)
    }
  })
}

test('全局新增支付渠道后手机编辑自动接受，无需第二份白名单', async t => {
  const channels = paymentOptions.channels.mobile
  const original = [...channels]
  t.after(() => channels.splice(0, channels.length, ...original))
  channels.push({ label: '测试渠道', value: 'test_channel' })
  assert.equal(await validatePayment({ payment_method: 'mobile', payment_channel: 'test_channel' }), null)
})
