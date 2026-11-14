'use strict'

const XLSX = require('xlsx')
const BaseService = require('../core/base/base.service')
const { service: fields } = require('./customer-field-access.service')

// 二进制文件必须在序列化前脱敏，不能依赖 JSON 响应中间件。
class CustomerExportService extends BaseService {
  constructor({ customers }) { super(); this.customers = customers }

  async export(query, permissions) {
    if (!permissions) throw this.createError('缺少字段权限上下文', 403)
    const columns = [['member_number', '会员编号'], ['name', '姓名'], ['phone', '电话'], ['email', '邮箱'],
      ['province', '省份'], ['city', '城市'], ['district', '县/区'], ['town', '乡镇/街道'],
      ['village', '村/社区'], ['address', '详细地址']]
    const hidden = new Set(permissions.hiddenFields || [])
    const visibleColumns = columns.filter(([key]) => !hidden.has(`customer.${key}`) &&
      !(key === 'address' && ['province', 'city', 'district', 'town', 'village'].some(field => hidden.has(`customer.${field}`))) &&
      !(['district', 'town', 'village'].includes(key) && hidden.has('customer.address')))
    if (!visibleColumns.length) throw this.createError('没有可导出的客户字段', 403)
    const rows = [visibleColumns.map(([, label]) => label)]
    for (let page = 1; ; page++) {
      const result = await this.customers.list({ ...query, search: query.search || query.keyword, include_address_levels: '1', page, page_size: 100 }, permissions)
      if (result.data.pagination.total > 10000) throw this.createError('单次最多导出10000条客户，请缩小筛选范围', 400)
      for (const record of fields.maskPayload(result.data.customers, permissions)) {
        rows.push(visibleColumns.map(([key]) => (record[key] === null || record[key] === undefined) ? '' : String(record[key])))
      }
      if (!result.data.pagination.has_next) break
      if (page >= 100) throw this.createError('客户数据已变化，请缩小筛选范围后重试', 400)
    }
    const workbook = XLSX.utils.book_new()
    // aoa 的字符串单元格不会被当作 Excel 公式执行。
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), '客户')
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  }
}

module.exports = CustomerExportService
