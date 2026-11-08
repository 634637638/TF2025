'use strict'

const RentalCustomerRepository = require('../repositories/rental-customer.repository')
const dataMaskingService = require('./data-masking.service')
const { searchCustomers } = require('./customer-search.service')
const { searchOperators } = require('./operator-search.service')
const { isValidIdCard } = require('../utils/security-enhanced')

const MODULE_KEY = 'rentals_rentalsview'
const CUSTOMER_NAME = 'customer_info.customer_name'
const CUSTOMER_PHONE = 'customer_info.customer_phone'
const CUSTOMER_ID_CARD = 'customer_info.customer_id_card'
const SALES_OPERATOR = 'sales_info.sale_operator_name'
const SALES_STORE = 'sales_info.sale_store_name'

const validPhone = value => /^1[3-9]\d{9}$/.test(String(value || '').trim())

class RentalCustomerService {
  constructor({
    repository = new RentalCustomerRepository(),
    masking = dataMaskingService,
    customerSearch = searchCustomers,
    operatorSearch = searchOperators,
    validateIdCard = isValidIdCard
  } = {}) {
    if (!repository || typeof repository.getActiveStores !== 'function'
      || typeof repository.findByPhone !== 'function'
      || typeof repository.updateExistingIdentity !== 'function'
      || typeof repository.create !== 'function'
      || typeof repository.findPhoneOwner !== 'function'
      || typeof repository.updateActiveCustomer !== 'function'
      || !masking || typeof masking.getUserFieldPermissions !== 'function'
      || typeof customerSearch !== 'function' || typeof operatorSearch !== 'function'
      || typeof validateIdCard !== 'function') {
      throw new TypeError('RentalCustomerService requires customer, permission, and search dependencies')
    }
    this.repository = repository
    this.masking = masking
    this.customerSearch = customerSearch
    this.operatorSearch = operatorSearch
    this.validateIdCard = validateIdCard
  }

  async getHiddenFields(userId) {
    const permissions = await this.masking.getUserFieldPermissions(userId, MODULE_KEY)
    return new Set(permissions.hiddenFields || [])
  }

  async search(query, userId) {
    const keyword = String(query.keyword || '').trim()
    if (keyword.length < 2) return { rows: [] }

    const hiddenFields = await this.getHiddenFields(userId)
    const searchFields = [
      [CUSTOMER_NAME, 'name'],
      [CUSTOMER_PHONE, 'phone']
    ].filter(([fieldId]) => !hiddenFields.has(fieldId))
    if (!searchFields.length) return { forbidden: true }

    const result = await this.customerSearch({
      keyword,
      page: query.page,
      page_size: query.page_size,
      fields: ['id', 'name', 'phone', 'id_card'],
      search_fields: searchFields.map(([, column]) => column)
    })

    return {
      hiddenFields,
      rows: result.records.map(row => ({
        id: row.id,
        name: hiddenFields.has(CUSTOMER_NAME) ? null : row.name,
        phone: hiddenFields.has(CUSTOMER_PHONE) ? null : row.phone,
        id_card: hiddenFields.has(CUSTOMER_ID_CARD) ? null : row.id_card
      }))
    }
  }

  async getSalesOptions({ user, query }) {
    const hiddenFields = await this.getHiddenFields(user.id)
    const operatorResult = hiddenFields.has(SALES_OPERATOR)
      ? { records: [], pagination: null }
      : await this.operatorSearch({
        user,
        keyword: query.keyword,
        page: query.page,
        page_size: query.page_size,
        status: '1'
      })
    const operators = operatorResult.records.map(operator => ({
      id: Number(operator.id),
      username: operator.username,
      name: operator.name || operator.username
    }))
    const stores = hiddenFields.has(SALES_STORE) ? [] : await this.repository.getActiveStores()
    return { operators, stores, pagination: operatorResult.pagination }
  }

  normalizeCustomerInput(body = {}) {
    const name = String(body.name || '').trim()
    const phone = String(body.phone || '').trim()
    const idCard = String(body.id_card || '').trim().toUpperCase()
    if (!name || !validPhone(phone) || !this.validateIdCard(idCard)) {
      throw Object.assign(new Error('请输入客户姓名、正确的手机号码和身份证号'), { statusCode: 400 })
    }
    return { name, phone, idCard }
  }

  async create(body) {
    const customer = this.normalizeCustomerInput(body)
    const existing = await this.repository.findByPhone(customer.phone)
    if (existing) {
      await this.repository.updateExistingIdentity({ id: existing.id, ...customer })
      return { existing: true, customer: { ...existing, name: customer.name, id_card: customer.idCard } }
    }
    const id = await this.repository.create(customer)
    return { existing: false, customer: { id, name: customer.name, phone: customer.phone, id_card: customer.idCard } }
  }

  async update(idValue, body) {
    const id = Number(idValue)
    const customer = this.normalizeCustomerInput(body)
    if (!id) throw Object.assign(new Error('请输入客户姓名、正确的手机号码和身份证号'), { statusCode: 400 })

    if (await this.repository.findPhoneOwner(customer.phone, id)) {
      throw Object.assign(new Error('该手机号已属于其他客户'), { statusCode: 400 })
    }
    const updated = await this.repository.updateActiveCustomer({ id, ...customer })
    return updated ? { id, name: customer.name, phone: customer.phone, id_card: customer.idCard } : null
  }
}

module.exports = RentalCustomerService
