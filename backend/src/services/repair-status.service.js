'use strict'

const BaseService = require('../core/base/base.service')

class RepairStatusService extends BaseService {
  constructor({ repository, validStatuses, parseId } = {}) {
    super()
    if (!repository) throw new TypeError('RepairStatusService requires repository')
    if (!(validStatuses instanceof Set)) throw new TypeError('RepairStatusService requires validStatuses')
    if (typeof parseId !== 'function') throw new TypeError('RepairStatusService requires parseId')
    this.repository = repository
    this.validStatuses = validStatuses
    this.parseId = parseId
  }

  async update(idValue, statusValue) {
    const id = this.parseId(idValue)
    const status = String(statusValue || '')
    if (!id || !this.validStatuses.has(status)) {
      throw this.createError('维修状态无效', 400, 'BAD_REQUEST')
    }
    return this.repository.updateStatus(id, status)
  }

  async cancel(idValue) {
    const id = this.parseId(idValue)
    if (!id) throw this.createError('维修单编号无效', 400, 'BAD_REQUEST')
    return this.repository.cancel(id)
  }
}

module.exports = RepairStatusService
