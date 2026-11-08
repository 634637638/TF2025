'use strict'

const RentalListRepository = require('../repositories/rental-list.repository')
const dataMaskingService = require('./data-masking.service')
const { isBuyoutMode, addMonthsClamped } = require('../utils/rental-calculations')

const MODULE_KEY = 'rentals_rentalsview'
const SEARCHABLE_FIELDS = [
  ['customer_info.customer_name', 'c.name'],
  ['customer_info.customer_phone', 'c.phone'],
  ['device_info.imei', 'p.imei'],
  ['device_info.serial_number', 'p.serial_number'],
  ['contract_info.contract_number', 'r.contract_number']
]

class RentalListService {
  constructor({ repository = new RentalListRepository(), masking = dataMaskingService } = {}) {
    this.repository = repository
    this.masking = masking
  }

  async list(query, userId) {
    const permissions = await this.masking.getUserFieldPermissions(userId, MODULE_KEY)
    const hiddenFields = new Set(permissions.hiddenFields || [])
    const page = Math.max(Number(query.page) || 1, 1)
    const pageSize = Math.min(Math.max(Number(query.page_size) || 20, 1), 100)
    const keyword = String(query.keyword || '').trim()
    const searchableColumns = SEARCHABLE_FIELDS
      .filter(([fieldId]) => !hiddenFields.has(fieldId))
      .map(([, column]) => column)

    if (keyword && searchableColumns.length === 0) return { forbidden: '没有可用的租赁搜索字段' }
    if (query.status && hiddenFields.has('status_info.status')) {
      return { forbidden: '不能使用已隐藏的状态筛选字段' }
    }
    if (query.billing_mode && hiddenFields.has('contract_info.billing_mode')) {
      return { forbidden: '不能使用已隐藏的合同类型筛选字段' }
    }

    const result = await this.repository.list({
      page,
      pageSize,
      keyword,
      searchableColumns: keyword ? searchableColumns : [],
      status: query.status,
      billingMode: query.billing_mode
    })
    const filesByRental = new Map()
    const paymentsByRental = new Map()
    result.files.forEach(file => {
      const list = filesByRental.get(Number(file.rental_id)) || []
      list.push({
        id: file.id,
        file_url: `/api/rentals/${file.rental_id}/files/${file.id}/download`,
        file_name: file.file_name
      })
      filesByRental.set(Number(file.rental_id), list)
    })
    result.payments.forEach(payment => {
      const list = paymentsByRental.get(Number(payment.rental_id)) || []
      list.push(Number(payment.period_number))
      paymentsByRental.set(Number(payment.rental_id), list)
    })
    const rows = result.rows.map(row => {
      const output = { ...row }
      output.contract_files = filesByRental.get(Number(row.id)) || []
      output.paid_period_numbers = paymentsByRental.get(Number(row.id)) || []
      if (isBuyoutMode(row.billing_mode)) {
        const paid = new Set(output.paid_period_numbers)
        const nextPeriod = Array.from({ length: Number(row.term_months || 0) }, (_, index) => index + 1).find(number => !paid.has(number))
        output.next_due_date = nextPeriod ? addMonthsClamped(row.start_date, nextPeriod) : null
      }
      delete output.phone_id
      delete output.customer_id
      delete output.phone_status
      delete output.sale_order_price
      delete output.total_cost
      delete output.accrued_rent
      delete output.created_at
      delete output.operator_id
      delete output.sale_id
      delete output.sale_order_id
      delete output.paid_period_numbers
      if (hiddenFields.has('sales_info.sale_store_name')) delete output.sale_store_id
      if (hiddenFields.has('sales_info.sale_operator_name')) delete output.sale_operator_id
      return output
    })
    const totalPages = Math.ceil(result.total / pageSize)
    const summary = {
      active_count: hiddenFields.has('stats.active_count') ? null : Number(result.summary.active_count || 0),
      device_count: hiddenFields.has('stats.device_count') ? null : Number(result.summary.device_count || 0),
      receivable_amount: hiddenFields.has('stats.receivable_amount') ? null : Number(result.summary.receivable_amount || 0),
      deposit_amount: hiddenFields.has('stats.deposit_amount') ? null : Number(result.summary.deposit_amount || 0)
    }
    return {
      rows: this.masking.filterSensitiveFields(rows, permissions),
      pagination: {
        page,
        page_size: pageSize,
        total: result.total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1
      },
      summary
    }
  }
}

module.exports = RentalListService
