'use strict'

const CUSTOMER_NAME_FIELD = 'customer_info.customer_name'
const CUSTOMER_PHONE_FIELD = 'customer_info.customer_phone'
const DEVICE_FIELDS = [
  ['device_info.brand_name', 'brand_id', 'brand_name'],
  ['device_info.phone_model', 'model_id', 'model_name'],
  ['device_info.color_name', 'color_id', 'color_name'],
  ['device_info.memory_size', 'memory_id', 'memory_size'],
  ['device_info.imei', 'imei', 'imei'],
  ['device_info.serial_number', 'serial_number', 'serial_number']
]

const forbiddenByFieldPermission = message => Object.assign(new Error(message), {
  statusCode: 403,
  code: 'FIELD_PERMISSION_DENIED'
})

class RepairLookupService {
  constructor({ repository, getHiddenFields, searchCustomers } = {}) {
    if (!repository) throw new TypeError('RepairLookupService requires repository')
    if (typeof getHiddenFields !== 'function') throw new TypeError('RepairLookupService requires getHiddenFields')
    if (typeof searchCustomers !== 'function') throw new TypeError('RepairLookupService requires searchCustomers')
    this.repository = repository
    this.getHiddenFields = getHiddenFields
    this.searchCustomers = searchCustomers
  }

  async getOptions(req) {
    const options = await this.repository.getOptions()
    const hiddenFields = await this.getHiddenFields(req)
    return {
      brands: hiddenFields.has('device_info.brand_name') ? [] : options.brands,
      models: hiddenFields.has('device_info.phone_model') ? [] : options.models,
      colors: hiddenFields.has('device_info.color_name') ? [] : options.colors,
      memories: hiddenFields.has('device_info.memory_size') ? [] : options.memories,
      technicians: hiddenFields.has('repair_info.technician_name')
        ? []
        : options.technicians.map(item => ({ id: item.id, name: item.name || item.username }))
    }
  }

  async searchCustomersForRepair(req) {
    const keyword = String(req.query.keyword || '').trim()
    if (keyword.length < 2) return { data: [], message: '请输入至少2位姓名或手机号' }

    const hiddenFields = await this.getHiddenFields(req)
    const searchableFields = [
      [CUSTOMER_NAME_FIELD, 'name'],
      [CUSTOMER_PHONE_FIELD, 'phone']
    ].filter(([field]) => !hiddenFields.has(field))
    if (!searchableFields.length) throw forbiddenByFieldPermission('没有可用的客户检索字段')

    const result = await this.searchCustomers({
      keyword,
      page: req.query.page,
      page_size: req.query.page_size,
      fields: ['id', 'name', 'phone'],
      search_fields: searchableFields.map(([, column]) => column)
    })
    return {
      data: result.records.map(row => ({
        id: row.id,
        name: hiddenFields.has(CUSTOMER_NAME_FIELD) ? null : row.name,
        phone: hiddenFields.has(CUSTOMER_PHONE_FIELD) ? null : row.phone
      })),
      message: '客户检索成功'
    }
  }

  async searchDevicesForRepair(req) {
    const keyword = String(req.query.q || '').trim()
    if (keyword.length < 2) return { data: [], message: '请输入至少 2 位设备编号' }

    const [rows, hiddenFields] = await Promise.all([
      this.repository.searchDevices(keyword),
      this.getHiddenFields(req)
    ])
    return {
      data: rows.map(row => {
        const masked = { ...row }
        if (hiddenFields.has(CUSTOMER_NAME_FIELD)) {
          masked.customer_id = null
          masked.customer_name = null
        }
        if (hiddenFields.has(CUSTOMER_PHONE_FIELD)) masked.customer_phone = null
        for (const [field, idKey, nameKey] of DEVICE_FIELDS) {
          if (hiddenFields.has(field)) {
            masked[idKey] = null
            masked[nameKey] = null
          }
        }
        return masked
      }),
      message: '设备检索成功'
    }
  }
}

module.exports = RepairLookupService
