'use strict'

const log = require('../utils/log')
const { clearCache } = require('../middleware/cache')
const SubsidyApplyRepository = require('../repositories/subsidy-apply.repository')
const {
  normalizeSubsidyPhotoStorageUrls,
  validateSubmittedSubsidyPhotos
} = require('../utils/subsidy-photo-submission')

class SubsidyApplyService {
  constructor({
    repository = new SubsidyApplyRepository(),
    invalidateCache = clearCache,
    logger = log,
    now = () => new Date()
  } = {}) {
    this.repository = repository
    this.invalidateCache = invalidateCache
    this.logger = logger
    this.now = now
  }

  async create(input, userId) {
    if (!input.phone_id || !input.customer_id || !input.imei1 || !input.imei2 || !input.sale_price) {
      return { status: 400, body: { success: false, message: 'IMEI2为必填项，请完整填写' } }
    }

    const storedPhotos = normalizeSubsidyPhotoStorageUrls(input.subsidy_photos || [])
    const result = await this.repository.withConnection(async connection => {
      let transactionStarted = false
      try {
        await connection.beginTransaction()
        transactionStarted = true

        const existing = await this.repository.findByPhoneForUpdate(connection, input.phone_id)
        if (existing) {
          await connection.rollback()
          transactionStarted = false
          return {
            status: 400,
            body: {
              success: false,
              message: '该设备已存在国补申请记录',
              data: { existing_id: existing.id, apply_status: existing.apply_status }
            }
          }
        }

        if (input.customer_idcard && input.customer_idcard.trim() !== '') {
          await this.repository.updateCustomerIdCard(connection, input.customer_id, input.customer_idcard.trim())
        }

        await validateSubmittedSubsidyPhotos({
          submittedPhotos: input.subsidy_photos || [],
          storedPhotos,
          userId,
          hasReference: relativePath => this.repository.hasPhotoReference(connection, relativePath)
        })

        const data = {
          ...input,
          subsidy_photos: storedPhotos,
          subsidy_amount: input.subsidy_amount || 0,
          subsidy_rate: input.subsidy_rate || 15,
          sale_time: this.normalizeSaleTime(input.sale_time),
          handler_name: input.has_different_handler && input.handler_info ? input.handler_info.handler_name : null,
          handler_phone: input.has_different_handler && input.handler_info ? input.handler_info.handler_phone : null,
          handler_idcard: input.has_different_handler && input.handler_info ? input.handler_info.handler_idcard : null
        }
        const id = await this.repository.create(connection, data)
        await connection.commit()
        transactionStarted = false
        return {
          status: 200,
          body: {
            success: true,
            message: '国补记录创建成功',
            data: { id, apply_time: this.now(), apply_status: 'completed' }
          }
        }
      } catch (error) {
        if (transactionStarted) {
          await connection.rollback().catch(rollbackError => {
            this.logger.error('创建国补申请事务回滚失败:', rollbackError)
          })
        }
        throw error
      }
    })

    if (result.status === 200) this.invalidateCache('/subsidy')
    return result
  }

  normalizeSaleTime(saleTime) {
    if (!saleTime) return null
    const dateMatch = String(saleTime).match(/(\d{4})-(\d{2})-(\d{2})/)
    if (dateMatch) return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]} 00:00:00`
    this.logger.warn('⚠️ 无法直接提取日期，保留原值:', saleTime)
    return saleTime
  }
}

module.exports = SubsidyApplyService
