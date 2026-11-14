import { test } from 'node:test'
import assert from 'node:assert/strict'
import { auditPhoneInputs } from './lib/phone-input-contract.mjs'

test('可编辑手机号、tel及语义标签禁止原生硬截断，不依赖局部变量名', () => {
  for (const markup of ['<el-input v-model="customer.phone" maxlength="11"/>',
    '<ElInput :model-value="value" placeholder="请输入手机号码" :maxlength="11"/>',
    '<input type="tel" v-model="contact" maxlength="11"/>',
    '<el-input v-model="form.customer_phone" :readonly="selected !== null" maxlength="11"/>']) {
    assert.equal(auditPhoneInputs(`<template>${markup}</template>`).length, 1)
  }
})

test('无截断手机号、普通文本和静态只读联系方式保留合法行为，注释不误判', () => {
  assert.deepEqual(auditPhoneInputs('<template><el-input v-model="customer.phone"/><input type="tel"/><el-input v-model="name" maxlength="50"/><el-input v-model="phone" maxlength="11" disabled/><!-- <el-input v-model="phone" maxlength="11"/> --></template>'), [])
  assert.deepEqual(auditPhoneInputs('<template><el-input v-model="phone.serial_number" maxlength="50"/><el-input v-model="supplier.phone" maxlength="30"/></template>'), [])
})
