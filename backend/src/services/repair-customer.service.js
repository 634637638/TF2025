'use strict'

const DUPLICATE_PHONE_MESSAGE = '该手机号已存在，请检索并选择已有客户'

const requestError = (message, statusCode, code) => Object.assign(new Error(message), { statusCode, code })

class RepairCustomerService {
  constructor({ repository, getHiddenFields, createMemberNumber } = {}) {
    if (!repository) throw new TypeError('RepairCustomerService requires repository')
    if (typeof getHiddenFields !== 'function') throw new TypeError('RepairCustomerService requires getHiddenFields')
    if (createMemberNumber !== undefined && typeof createMemberNumber !== 'function') {
      throw new TypeError('RepairCustomerService requires createMemberNumber')
    }
    this.repository = repository
    this.getHiddenFields = getHiddenFields
    this.createMemberNumber = createMemberNumber || (() => this.repository.generateMemberNumber())
  }

  async createCustomer(req) {
    const name = String(req.body?.name || '').trim()
    const phone = String(req.body?.phone || '').trim()
    if (!name) throw requestError('请输入客户姓名', 400, 'BAD_REQUEST')
    if (!/^1[3-9]\d{9}$/.test(phone)) throw requestError('请输入有效的11位手机号码', 400, 'BAD_REQUEST')

    const hiddenFields = await this.getHiddenFields(req)
    if (hiddenFields.has('customer_info.customer_name') || hiddenFields.has('customer_info.customer_phone')) {
      throw requestError('客户姓名或手机号字段不可用', 403, 'FIELD_PERMISSION_DENIED')
    }

    await this.repository.ensureReady()
    if (await this.repository.findByPhone(phone)) {
      throw requestError(DUPLICATE_PHONE_MESSAGE, 400, 'BAD_REQUEST')
    }

    try {
      const memberNumber = await this.createMemberNumber()
      const id = await this.repository.createCustomer({ name, phone, memberNumber })
      return { id, name, phone }
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') throw requestError(DUPLICATE_PHONE_MESSAGE, 400, 'BAD_REQUEST')
      throw error
    }
  }
}

module.exports = RepairCustomerService
