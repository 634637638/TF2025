'use strict'

const SubsidyPhoneSearchRepository = require('../repositories/subsidy-phone-search.repository')

class SubsidyPhoneSearchService {
  constructor({ repository = new SubsidyPhoneSearchRepository() } = {}) {
    this.repository = repository
  }

  async search(identifier, onProgress = () => {}) {
    const trimmedIdentifier = identifier.trim()
    const searchPattern = `%${trimmedIdentifier}%`
    const phones = await this.repository.findSoldPhones(searchPattern)
    onProgress('phones query completed', { matchCount: phones.length })
    if (phones.length === 0) return []

    const phoneIds = phones.map(phone => phone.phone_id)
    const { latestSales, subsidyRecords } = await this.repository.findRelatedData(phoneIds)
    onProgress('related data queries completed', {
      latestSalesCount: latestSales.length,
      subsidyRecordCount: subsidyRecords.length
    })

    const customerMap = new Map(latestSales.map(sale => [sale.phone_id, {
      customer_name: sale.customer_name || '',
      customer_phone: sale.customer_phone || ''
    }]))
    const subsidyMap = new Map(subsidyRecords.map(record => [record.phone_id, {
      status: record.apply_status,
      amount: record.subsidy_amount
    }]))

    return phones.map(phone => {
      const subsidy = subsidyMap.get(phone.phone_id)
      const customer = customerMap.get(phone.phone_id) || {}
      const salePrice = parseFloat(phone.sale_price) || 0
      const isNew = phone.is_new === 1
      return {
        phone_id: phone.phone_id,
        imei: phone.imei,
        serial_number: phone.serial_number,
        is_new: phone.is_new,
        status: phone.status,
        brand: phone.brand || '',
        model: phone.model || '',
        color: phone.color || '',
        memory: phone.memory || '',
        sale_price: salePrice,
        sale_time: phone.sale_time,
        store_name: phone.store_name || '',
        customer_name: customer.customer_name || '',
        customer_phone: customer.customer_phone || '',
        has_subsidy: Boolean(subsidy),
        subsidy_status: subsidy?.status || null,
        subsidy_amount: subsidy?.amount || 0,
        can_apply_subsidy: isNew && phone.sale_price <= 6000 && !subsidy,
        reason: subsidy ? '已记录国补资料' :
          !isNew ? '仅全新机可申请' :
            phone.sale_price > 6000 ? '售价超过6000元' : '符合条件'
      }
    })
  }
}

module.exports = SubsidyPhoneSearchService
