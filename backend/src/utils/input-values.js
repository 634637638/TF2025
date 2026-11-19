'use strict'

const patterns = require('../config/input-validation.json')
const decimal = new RegExp(patterns.decimal)
const money = new RegExp(patterns.money)
const integer = new RegExp(patterns.integer)
const mobile = new RegExp(patterns.mobile)
const separators = new RegExp(patterns.phoneSeparators, 'g')
const singleLineControls = new RegExp(patterns.singleLineControls)
const isSingleLineText = (value, maxLength = 1000) => typeof value === 'string' && value.length <= maxLength && !singleLineControls.test(value)
const isPersonName = (value, maxLength = 50) => isSingleLineText(value, maxLength) && Boolean(value.trim()) && /\p{L}/u.test(value)
const isCustomerName = (value, maxLength = 50) => isPersonName(value, maxLength) && value.trim().length >= 2
const countryPrefix = new RegExp(patterns.mobileCountryPrefix)

const isEmptyInput = value => value === undefined || value === null || value === ''
const isDecimalInput = value => (
  (typeof value === 'number' || (typeof value === 'string' && decimal.test(value))) && Number.isFinite(Number(value))
)
const isIntegerInput = value => (
  (typeof value === 'number' || (typeof value === 'string' && integer.test(value))) && Number.isSafeInteger(Number(value))
)
const isMoneyInput = value => isDecimalInput(value) && money.test(String(value))
// 只移除明示允许的格式；非法字符和超长内容保留，供字段校验拒绝。
const normalizePhone = value => typeof value === 'string'
  ? value.replace(/^ +| +$/g, '').replace(separators, '').replace(countryPrefix, '')
  : ''
const isMobilePhone = value => typeof value === 'string' && mobile.test(normalizePhone(value))

module.exports = { isMoneyInput, isSingleLineText, isPersonName, isCustomerName, isEmptyInput, isDecimalInput, isIntegerInput, normalizePhone, isMobilePhone }
