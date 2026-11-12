import { test } from 'node:test'
import assert from 'node:assert/strict'
import { auditAmountInputs } from './lib/amount-input-contract.mjs'

test('金额控件复用公共入口，不限制局部变量名或数据绑定方式', () => {
  assert.deepEqual(auditAmountInputs('<template><AmountInput v-model="value" :min="0"/><amount-input :model-value="row.cost" @change="save"/></template>'), [])
})

test('金额不能强制整数、补两位尾零，或绕过公共入口', () => {
  for (const tag of ['el-input-number', 'ElInputNumber']) {
    for (const precision of ['', ':precision="0"', ':precision="2"']) {
      assert.equal(auditAmountInputs(`<template><${tag} v-model="row.purchase_cost" ${precision} :controls="false"/></template>`).length, 1)
    }
  }
  assert.equal(auditAmountInputs('<template><el-input-number :model-value="value" placeholder="退款金额" :controls="false"/></template>').length, 1)
})

test('普通数字控件逐个禁止步进按钮，不能通过其他控件凑数量', () => {
  assert.equal(auditAmountInputs('<template><el-input-number v-model="quantity"/><el-input-number v-model="days" :controls="false"/></template>').length, 1)
  assert.equal(auditAmountInputs('<template><el-input-number controls="false"/></template>').length, 1)
})

test('公共金额调用方不能覆盖精度或步进按钮', () => {
  for (const attr of [':precision="0"', ':precision="2"', ':controls="true"', 'controls-position="right"']) {
    assert.equal(auditAmountInputs(`<template><AmountInput ${attr}/></template>`).length, 1)
  }
})

test('比例、数量、时长及动态通用数字组件不误当金额', () => {
  assert.deepEqual(auditAmountInputs('<template><el-input-number v-model="form.lowPercent" :precision="1" :controls="false"/><el-input-number v-model="count" :precision="0" :controls="false"/><el-input-number v-model="currentChild.sort_order" :controls="false"/><el-input-number :model-value="currentChild.price_markup" @update:model-value="handlePercentageMarkupChange(currentChild, $event)" :precision="2" :controls="false"/><el-input-number v-model="days" :controls="false"/><el-input-number :model-value="getNumberValue(field)" :precision="field.precision" :controls="false"/></template>'), [])
})
