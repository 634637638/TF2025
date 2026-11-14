'use strict'

const FieldAccessService = require('./field-access.service')
const { LEVELS } = require('../config/customer-address')
const fieldMap = Object.fromEntries([...LEVELS, 'address'].map(field => [field, `customer.${field}`]))
const responseKeys = Object.fromEntries(Object.entries(fieldMap).map(([key, field]) => [field, [key]]))
responseKeys['customer.address'].push('district', 'town', 'village', 'legacy_address')
for (const field of LEVELS) responseKeys[`customer.${field}`].push('address', 'legacy_address')

const service = new FieldAccessService({ moduleKey: 'customers_customersview', responseKeys, strict: true })
module.exports = { service, fieldMap }
