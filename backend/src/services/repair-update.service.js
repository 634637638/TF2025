'use strict'

const BaseService = require('../core/base/base.service')

const REPAIR_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/

class RepairUpdateService extends BaseService {
  constructor({ repository, parseId, parseMoney, validateMedia, moveMedia, rollbackMedia, removeMedia, parseStoredMedia, normalizeMedia, logger } = {}) {
    super()
    if (!repository) throw new TypeError('RepairUpdateService requires repository')
    for (const [name, value] of Object.entries({ parseId, parseMoney, validateMedia, moveMedia, rollbackMedia, removeMedia, parseStoredMedia, normalizeMedia })) {
      if (typeof value !== 'function') throw new TypeError(`RepairUpdateService requires ${name}`)
    }
    this.repository = repository
    this.parseId = parseId
    this.parseMoney = parseMoney
    this.validateMedia = validateMedia
    this.moveMedia = moveMedia
    this.rollbackMedia = rollbackMedia
    this.removeMedia = removeMedia
    this.parseStoredMedia = parseStoredMedia
    this.normalizeMedia = normalizeMedia
    this.logger = logger
  }

  async validateReference(table, value, label, activeOnly = false) {
    const id = value ? this.parseId(value) : null
    if (value && !id) throw this.createError(`${label}编号无效`, 400, 'BAD_REQUEST')
    if (id && !await this.repository.hasReference(table, id, activeOnly)) {
      throw this.createError(`${label}不存在${activeOnly ? '或已停用' : ''}`, 400, 'BAD_REQUEST')
    }
    return id
  }

  async buildUpdate(body = {}) {
    const fields = []
    const values = []
    const add = (field, value) => {
      fields.push(`${field} = ?`)
      values.push(value)
    }
    const has = field => Object.prototype.hasOwnProperty.call(body, field)

    if (has('customer_id')) {
      const customerId = this.parseId(body.customer_id)
      if (!customerId) throw this.createError('客户编号无效', 400, 'BAD_REQUEST')
      if (!await this.repository.hasReference('customers', customerId, true)) {
        throw this.createError('客户不存在或已停用', 400, 'BAD_REQUEST')
      }
      add('customer_id', customerId)
    }
    if (has('brand_id')) add('brand_id', await this.validateReference('brands', body.brand_id, '品牌'))
    if (has('phone_id')) add('phone_id', await this.validateReference('phones', body.phone_id, '关联设备'))

    for (const [field, table, label] of [['color_id', 'colors', '颜色'], ['memory_id', 'memories', '内存']]) {
      if (has(field)) add(field, await this.validateReference(table, body[field], label))
    }

    const normalizedFields = {
      phone_model: value => String(value || '').trim(),
      imei: value => String(value || '').trim() || null,
      serial_number: value => String(value || '').trim() || null,
      problem_description: value => String(value || '').trim(),
      remarks: value => String(value || '').trim() || null,
      technician_id: value => value ? this.parseId(value) : null
    }
    for (const [field, normalize] of Object.entries(normalizedFields)) {
      if (!has(field)) continue
      const value = normalize(body[field])
      if (field === 'technician_id' && body[field] && !value) throw this.createError('维修员编号无效', 400, 'BAD_REQUEST')
      if (field === 'technician_id' && value && !await this.repository.hasReference('users', value, true)) {
        throw this.createError('维修员不存在或已停用', 400, 'BAD_REQUEST')
      }
      if ((field === 'phone_model' || field === 'problem_description') && !value) {
        throw this.createError(field === 'phone_model' ? '手机型号不能为空' : '故障描述不能为空', 400, 'BAD_REQUEST')
      }
      add(field, value)
    }

    if (has('actual_cost')) {
      const value = this.parseMoney(body.actual_cost)
      if (value === null) throw this.createError('实际费用格式不正确', 400, 'BAD_REQUEST')
      add('actual_cost', value)
    }

    if (has('repair_time')) {
      const value = body.repair_time ? String(body.repair_time).trim() : null
      if (!value || !REPAIR_TIME_PATTERN.test(value)) throw this.createError('维修时间格式不正确', 400, 'BAD_REQUEST')
      add('repair_time', value)
    }

    return { fields, values, submittedMedia: has('photos') ? body.photos : undefined }
  }

  async update(idValue, body, actor) {
    const id = this.parseId(idValue)
    if (!id) throw this.createError('维修单编号无效', 400, 'BAD_REQUEST')
    const userId = this.getActorId(actor)
    const update = await this.buildUpdate(body)
    if (!update.fields.length && update.submittedMedia === undefined) {
      throw this.createError('没有可更新的字段', 400, 'BAD_REQUEST')
    }

    return this.repository.withConnection(async connection => {
      let transactionStarted = false
      let committed = false
      let movedMedia = []
      let mediaToRemove = []
      try {
        await connection.beginTransaction()
        transactionStarted = true
        if (update.submittedMedia !== undefined) {
          const existingRow = await this.repository.getMediaForUpdate(connection, id)
          if (!existingRow) throw this.createError('维修单不存在', 404, 'NOT_FOUND')
          const existingMedia = this.normalizeMedia(this.parseStoredMedia(existingRow.photos))
          const submitted = this.validateMedia(update.submittedMedia, userId, existingMedia)
          const moveResult = await this.moveMedia(submitted, id, userId)
          movedMedia = moveResult.movedFiles
          update.fields.push('photos = ?')
          update.values.push(JSON.stringify(moveResult.archivedMedia))
          const nextUrls = new Set(moveResult.archivedMedia.map(item => item.url))
          mediaToRemove = existingMedia.filter(item => !nextUrls.has(item.url))
        }

        const [result] = await this.repository.update(connection, update.fields, update.values, id)
        if (!result.affectedRows) throw this.createError('维修单不存在', 404, 'NOT_FOUND')
        await connection.commit()
        transactionStarted = false
        committed = true

        await this.removeMedia(mediaToRemove).catch(error => {
          this.logger?.warn('清理已移除维修媒体失败:', error)
        })
        return await this.repository.getUpdated(connection, id)
      } catch (error) {
        if (transactionStarted) {
          await connection.rollback().catch(rollbackError => {
            error.rollbackError = rollbackError
          })
        }
        if (!committed && movedMedia.length) {
          await this.rollbackMedia(movedMedia).catch(rollbackError => {
            error.mediaRollbackError = rollbackError
          })
        }
        throw error
      }
    })
  }
}

module.exports = RepairUpdateService
