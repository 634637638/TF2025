'use strict'

const dataMaskingService = require('./data-masking.service')

/** 字段权限的读取、递归脱敏及写入判定；业务域保留各自的字段映射。 */
class FieldAccessService {
  constructor({ moduleKey, responseKeys = {}, transform, masking = dataMaskingService }) {
    this.moduleKey = moduleKey
    this.responseKeys = responseKeys
    this.transform = transform
    this.masking = masking
  }

  getPermissions(userId) {
    return this.masking.getUserFieldPermissions(userId, this.moduleKey)
  }

  maskPayload(value, permissions) {
    if (Array.isArray(value)) return value.map(item => this.maskPayload(item, permissions))
    if (!value || typeof value !== 'object') return value

    const masked = Object.fromEntries(Object.entries(value).map(([key, child]) => [
      key, this.maskPayload(child, permissions)
    ]))
    for (const fieldId of permissions.hiddenFields || []) {
      for (const key of this.responseKeys[fieldId] || []) {
        if (Object.prototype.hasOwnProperty.call(masked, key)) masked[key] = null
      }
    }
    this.transform?.(masked, permissions)
    return this.masking.filterSensitiveFields([masked], permissions)[0]
  }

  async getDeniedWrite(userId, body, fieldMap) {
    const permissions = await this.getPermissions(userId)
    const hiddenFields = new Set(permissions.hiddenFields || [])
    return Object.entries(fieldMap).find(([bodyField, fieldId]) => (
      body?.[bodyField] !== undefined && hiddenFields.has(fieldId)
    ))?.[1]
  }

  async isVisible(userId, fieldId) {
    const permissions = await this.getPermissions(userId)
    return !(permissions.hiddenFields || []).includes(fieldId)
  }
}

module.exports = FieldAccessService
