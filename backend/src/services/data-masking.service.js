/**
 * 数据脱敏服务
 * 根据用户角色权限动态过滤敏感数据
 */

const { getDatabase } = require('../config/database')
const { normalizeStoredFieldConfig, resolveQueryGoodsFieldConfigs } = require('../utils/field-permission-normalizer')
const UserFieldPermissionsRepository = require('../repositories/user-field-permissions.repository')
const { getActiveUserRoles } = require('./access-control.service')
const log = require('../utils/log')

class DataMaskingService {
  constructor({ database = getDatabase, logger = log, fieldRepository = new UserFieldPermissionsRepository(), getActiveRoles = getActiveUserRoles } = {}) {
    this.database = database
    this.logger = logger
    this.fieldRepository = fieldRepository
    this.getActiveRoles = getActiveRoles
  }

  /**
   * 根据用户角色获取字段权限配置
   * @param {number} userId - 用户ID
   * @param {string} moduleKey - 模块标识
   * @returns {Object} - 字段权限配置
   */
  async getUserFieldPermissions(userId, moduleKey, { fieldScope } = {}) {
    const pool = this.database()
    try {
      const userRoles = await this.getActiveRoles(userId, pool)

      if (userRoles.length === 0) {
        return { hiddenFields: [], readonlyFields: [] }
      }

      const roleIds = userRoles.map(r => r.role_id)
      // 获取角色的字段权限配置
      const fieldPermissions = fieldScope === 'goods' && moduleKey === 'query_queryview'
        ? (await Promise.all(['query_queryview', 'accessories_accessoriesview'].map(key =>
          this.fieldRepository.listRoleFieldPermissions(pool, roleIds, key)))).flat()
        : await this.fieldRepository.listRoleFieldPermissions(pool, roleIds, moduleKey)
      const normalizedPermissions = fieldScope === 'goods' && moduleKey === 'query_queryview'
        ? resolveQueryGoodsFieldConfigs(fieldPermissions).map(row => row.normalized)
        : fieldPermissions.map(row => normalizeStoredFieldConfig(row, { strict: true }))

      // 合并所有角色的权限（取最严格的）
      const mergedConfig = {
        hiddenFields: new Set(),
        readonlyFields: new Set()
      }

      const editableFields = new Set()
      let hasEditableScope = false
      normalizedPermissions.forEach(normalized => {
        try {
          if (!normalized) {
            throw new Error('字段权限配置无效')
          }
          const config = normalized.config
          if (normalized.hasEditableScope) {
            hasEditableScope = true
          }
          for (const field of config.editable_fields || []) editableFields.add(field)
          for (const field of normalized.readonlyFields || []) mergedConfig.readonlyFields.add(field)

          if (config.hidden_fields) {
            config.hidden_fields.forEach(field => {
              mergedConfig.hiddenFields.add(field)
            })
          }

        } catch {
          throw new Error('字段权限配置无效')
        }
      })

      return {
        hiddenFields: Array.from(mergedConfig.hiddenFields),
        readonlyFields: Array.from(mergedConfig.readonlyFields),
        ...(hasEditableScope ? { editableFields: Array.from(editableFields).filter(field =>
          !mergedConfig.hiddenFields.has(field) && !mergedConfig.readonlyFields.has(field)) } : {})
      }
    } catch (error) {
      this.logger.error('获取用户字段权限失败:', error)
      throw error
    }
  }

  /**
   * 过滤数据中的敏感字段
   * @param {Array} data - 数据数组
   * @param {Object} fieldConfig - 字段权限配置
   * @returns {Array} - 过滤后的数据
   */
  filterSensitiveFields(data, fieldConfig) {
    if (!Array.isArray(data) || !fieldConfig) {
      return data
    }

    const { hiddenFields, _readonlyFields } = fieldConfig

    return data.map(item => {
      const filteredItem = { ...item }

      const flatFieldAliases = {
        brand: ['brand', 'brand_id', 'brand_name', 'phone_brand'],
        model: ['model', 'model_id', 'model_name', 'phone_model'],
        color: ['color', 'color_id', 'color_name', 'phone_color'],
        memory: ['memory', 'memory_id', 'memory_size', 'phone_memory'],
        created_at: ['created_at', 'repair_time'],
        store_name: ['store_id', 'store_name'],
        supplier_name: ['supplier_id', 'supplier_name'],
        is_new: ['is_new', 'condition', 'phone_condition', 'quality_grade'],
        imei1: ['imei1', 'imei'],
        status: ['status', 'status_text', 'apply_status'],
        brand_name: ['brand_name', 'product_name'],
        model_name: ['model_name', 'actual_model', 'product_name'],
        color_name: ['color_name', 'product_name'],
        memory_size: ['memory_size', 'product_name'],
        expected_arrival: ['expected_arrival', 'arrival_date', 'days_remaining'],
        deposit_amount: ['deposit_amount', 'deposit_paid'],
        // 保留既有权限字段 ID，实际控制匹配候选设备的入库价。
        matchable_sale_price: ['purchase_cost']
      }

      // 同时处理扁平 API 字段和嵌套对象字段。
      hiddenFields.forEach(fieldPath => {
        const pathParts = fieldPath.split('.')
        const finalKey = pathParts[pathParts.length - 1]
        const topLevelCandidates = flatFieldAliases[finalKey] || [finalKey]
        topLevelCandidates.forEach(candidate => {
          if (Object.prototype.hasOwnProperty.call(filteredItem, candidate)) {
            filteredItem[candidate] = null
          }
        })

        let current = filteredItem

        // 找到要隐藏的字段的父对象
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i]

          // 处理中文键名
          if (part === 'basic_info' && (current.basic_info || current['基本信息'])) {
            current = current.basic_info || current['基本信息']
          } else if (part === 'price_info' && (current.price_info || current['价格信息'])) {
            current = current.price_info || current['价格信息']
          } else if (part === 'customer_info' && (current.customer_info || current['客户信息'])) {
            current = current.customer_info || current['客户信息']
          } else if (part === 'supplier_info' && (current.supplier_info || current['供应商信息'])) {
            current = current.supplier_info || current['供应商信息']
          } else if (part === 'operator_info' && (current.operator_info || current['操作员信息'])) {
            current = current.operator_info || current['操作员信息']
          } else if (part === 'time_info' && (current.time_info || current['时间信息'])) {
            current = current.time_info || current['时间信息']
          } else if (part === 'other_info' && current['其他信息']) {
            current = current['其他信息']
          } else {
            if (current[part]) {
              current = current[part]
            } else {
              return // 路径不存在
            }
          }
        }

        // 隐藏字段
        if (finalKey && typeof current === 'object' && current !== null) {
          current[finalKey] = null
        }
      })

      return filteredItem
    })
  }

  /**
   * 脱敏单个数据项
   * @param {Object} item - 数据项
   * @param {number} userId - 用户ID
   * @param {string} moduleKey - 模块标识
   * @returns {Object} - 脱敏后的数据项
   */
  async maskDataItem(item, userId, moduleKey) {
    const fieldConfig = await this.getUserFieldPermissions(userId, moduleKey)
    const filteredData = this.filterSensitiveFields([item], fieldConfig)
    return filteredData[0]
  }

  /**
   * 脱敏数据列表
   * @param {Array} items - 数据列表
   * @param {number} userId - 用户ID
   * @param {string} moduleKey - 模块标识
   * @returns {Array} - 脱敏后的数据列表
   */
  async maskDataList(items, userId, moduleKey) {
    const fieldConfig = await this.getUserFieldPermissions(userId, moduleKey)
    return this.filterSensitiveFields(items, fieldConfig)
  }
}

// 创建单例实例
const dataMaskingService = new DataMaskingService()

module.exports = dataMaskingService
