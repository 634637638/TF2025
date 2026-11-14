'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { validateImei } = require('../src/utils/imei')

test('设备编码保留标准 IMEI、合法 SN 及无 IMEI 设备', () => {
  assert.equal(validateImei('012345678901234', '').valid, true)
  for (const serial of ['0001', 'abc1/def-02', 'A'.repeat(50)]) {
    const result = validateImei(serial, serial)
    assert.equal(result.valid, true)
    assert.equal(result.normalizedImei, serial.toUpperCase())
    assert.equal(result.normalizedSerialNumber, serial.toUpperCase())
  }
})

test('编码拒绝汉字、对象、控制字符、截断和不完整分隔符', () => {
  for (const invalid of ['中文编码', 'ABCD中文', 'ABCD\n', 'ABCD--123', 'ABCD/', 'A'.repeat(51), 'ABCD_1', {}, [], true, 123456789012345]) {
    assert.equal(validateImei(invalid, invalid).valid, false, String(invalid))
    assert.equal(validateImei('012345678901234', invalid).valid, false, String(invalid))
  }
})
