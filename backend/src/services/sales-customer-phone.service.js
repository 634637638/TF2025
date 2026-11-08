'use strict'

const SalesCustomerPhoneRepository = require('../repositories/sales-customer-phone.repository')

const PHONE_PATTERN = /^1[3-9]\d{9}$/

class SalesCustomerPhoneService {
  constructor({ repository = new SalesCustomerPhoneRepository() } = {}) {
    if (!repository || typeof repository.findLatestByPhone !== 'function') {
      throw new TypeError('SalesCustomerPhoneService requires a customer phone repository')
    }
    this.repository = repository
  }

  async find(phone) {
    if (!PHONE_PATTERN.test(phone)) return { valid: false, customer: null }
    return { valid: true, customer: await this.repository.findLatestByPhone(phone) }
  }
}

module.exports = SalesCustomerPhoneService
