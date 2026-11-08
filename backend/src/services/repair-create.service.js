'use strict'

const crypto = require('crypto')
const BaseService = require('../core/base/base.service')

const requestError = message => Object.assign(new Error(message), { statusCode: 400, code: 'BAD_REQUEST' })
const REPAIR_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/

class RepairCreateService extends BaseService {
  constructor({ repository, parseId, validateMedia, moveMedia, rollbackMedia, randomBytes = crypto.randomBytes, now = () => new Date() } = {}) {
    super()
    if (!repository) throw new TypeError('RepairCreateService requires repository')
    if (typeof parseId !== 'function') throw new TypeError('RepairCreateService requires parseId')
    if (typeof validateMedia !== 'function') throw new TypeError('RepairCreateService requires validateMedia')
    if (typeof moveMedia !== 'function') throw new TypeError('RepairCreateService requires moveMedia')
    if (typeof rollbackMedia !== 'function') throw new TypeError('RepairCreateService requires rollbackMedia')
    this.repository = repository
    this.parseId = parseId
    this.validateMedia = validateMedia
    this.moveMedia = moveMedia
    this.rollbackMedia = rollbackMedia
    this.randomBytes = randomBytes
    this.now = now
  }

  generateOrderNo() {
    const date = this.now().toISOString().slice(0, 10).replaceAll('-', '')
    return `WX-${date}-${this.randomBytes(4).toString('hex').toUpperCase()}`
  }

  normalizeInput(body = {}) {
    const customerId = this.parseId(body.customer_id)
    const brandId = body.brand_id ? this.parseId(body.brand_id) : null
    const colorId = body.color_id ? this.parseId(body.color_id) : null
    const memoryId = body.memory_id ? this.parseId(body.memory_id) : null
    const phoneId = body.phone_id ? this.parseId(body.phone_id) : null
    const phoneModel = String(body.phone_model || '').trim()
    const problem = String(body.problem_description || '').trim()
    if (!customerId || !phoneModel || !problem) throw requestError('请填写客户、手机型号和故障描述')

    const technicianId = body.technician_id ? this.parseId(body.technician_id) : null
    if (body.technician_id && !technicianId) throw requestError('维修员编号无效')
    const repairTime = body.repair_time ? String(body.repair_time).trim() : null
    if (repairTime && !REPAIR_TIME_PATTERN.test(repairTime)) throw requestError('维修时间格式不正确')

    return {
      customerId,
      brandId,
      colorId,
      memoryId,
      phoneId,
      phoneModel,
      problem,
      technicianId,
      repairTime,
      imei: String(body.imei || '').trim() || null,
      serialNumber: String(body.serial_number || '').trim() || null,
      remarks: String(body.remarks || '').trim() || null
    }
  }

  async create(body, actor) {
    const userId = this.getActorId(actor)
    const input = this.normalizeInput(body)
    const submittedMedia = this.validateMedia(body.photos || [], userId)
    const referenceError = await this.repository.validateReferences(input)
    if (referenceError) throw requestError(referenceError)
    const orderNo = this.generateOrderNo()

    return this.repository.withConnection(async connection => {
      let transactionStarted = false
      let committed = false
      let movedFiles = []
      try {
        await connection.beginTransaction()
        transactionStarted = true
        const repairId = await this.repository.insert(connection, { ...input, orderNo })
        const moveResult = await this.moveMedia(submittedMedia, repairId, userId)
        movedFiles = moveResult.movedFiles
        if (moveResult.archivedMedia.length) {
          await this.repository.updatePhotos(connection, repairId, moveResult.archivedMedia)
        }
        await connection.commit()
        transactionStarted = false
        committed = true
        return await this.repository.getCreated(connection, repairId)
      } catch (error) {
        if (transactionStarted) {
          await connection.rollback().catch(rollbackError => {
            error.rollbackError = rollbackError
          })
        }
        if (!committed && movedFiles.length) {
          await this.rollbackMedia(movedFiles).catch(rollbackError => {
            error.mediaRollbackError = rollbackError
          })
        }
        throw error
      }
    })
  }
}

module.exports = RepairCreateService
