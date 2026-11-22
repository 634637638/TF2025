'use strict'

const dataMaskingService = require('./data-masking.service')

/** 字段权限的读取、递归脱敏及写入判定；业务域保留各自的字段映射。 */
class FieldAccessService {
  constructor({ moduleKey, responseKeys = {}, fieldScope, transform, masking = dataMaskingService, strict = true }) {
    this.moduleKey = moduleKey
    this.fieldScope = fieldScope
    this.responseKeys = responseKeys
    this.transform = transform
    this.masking = masking
    this.strict = strict
  }

  getPermissions(userId) {
    return this.masking.getUserFieldPermissions(userId, this.moduleKey, { strict: this.strict, ...(this.fieldScope ? { fieldScope: this.fieldScope } : {}) })
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

  async getDeniedWrite(userId, body, fieldMap, { visibleOnly = false } = {}) {
    const permissions = await this.getPermissions(userId)
    return this.findDeniedWrite(body, fieldMap, permissions, { visibleOnly })
  }

  findDeniedWrite(body, fieldMap, permissions, { visibleOnly = false } = {}) {
    const denied = new Set(permissions.hiddenFields || [])
    if (!visibleOnly) {
      for (const field of permissions.readonlyFields || []) denied.add(field)
    }
    const editable = visibleOnly || permissions.editableFields === undefined ? null : new Set(permissions.editableFields)
    return Object.entries(fieldMap).find(([bodyField, fieldId]) => {
      let value = body
      for (const key of bodyField.split('.')) {
        // 整组清除或序列化对象同样属于子字段写入。
        if (value === null || (value !== undefined && typeof value !== 'object')) break
        value = value?.[key]
      }
      return value !== undefined && (denied.has(fieldId) || (editable && !editable.has(fieldId)))
    })?.[1]
  }

  async isVisible(userId, fieldId) {
    const permissions = await this.getPermissions(userId)
    return !(permissions.hiddenFields || []).includes(fieldId)
  }
}

module.exports = FieldAccessService
