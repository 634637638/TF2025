'use strict'

const SubsidyPhoneDetailRepository = require('../repositories/subsidy-phone-detail.repository')

class SubsidyPhoneDetailService {
  constructor({ repository = new SubsidyPhoneDetailRepository() } = {}) {
    this.repository = repository
  }

  async getByPhoneId(phoneId) {
    const phone = await this.repository.findSoldPhoneById(phoneId)
    if (!phone) return null

    const sale = await this.repository.findSaleByPhoneId(phoneId)
    const salePrice = Number.parseFloat(phone.sale_price) || 0
    if (!sale) {
      return {
        phone_id: phone.phone_id,
        phone_brand: phone.brand,
        phone_model: phone.model,
        phone_color: phone.color,
        phone_memory: phone.memory,
        serial_number: phone.serial_number,
        imei1: phone.imei,
        imei2: null,
        sale_price: salePrice,
        eligible: false,
        eligible_reason: '该设备未找到销售记录，请先完成销售后再申请国补',
        requires_sale: true
      }
    }

    const existingSubsidy = await this.repository.findSubsidyByPhoneId(phoneId)
    const subsidyRate = 15
    const calculated = salePrice * subsidyRate / 100
    const subsidyAmount = phone.sale_price && salePrice <= 6000 ? Math.min(calculated, 500) : 0
    const eligibleReason = subsidyAmount > 0
      ? calculated > 500
        ? `补贴金额 ¥${calculated.toFixed(2)} 已达上限 ¥500`
        : `符合国补条件（售价 ${salePrice.toFixed(2)} × 15% = ¥${subsidyAmount.toFixed(2)}）`
      : `销售价格 ¥${salePrice.toFixed(2)} 超过6000元，不符合国补条件`

    return {
      phone_id: phone.phone_id,
      sale_id: sale.sale_id,
      customer_id: sale.customer_id,
      customer_name: sale.customer_name || '',
      customer_phone: sale.customer_phone || '',
      customer_idcard: sale.customer_idcard || '',
      phone_brand: phone.brand,
      phone_model: phone.model,
      phone_color: phone.color,
      phone_memory: phone.memory,
      serial_number: phone.serial_number,
      is_new: phone.is_new,
      inventory_time: phone.inventory_time,
      imei1: phone.imei,
      imei2: null,
      sale_price: salePrice,
      sale_time: phone.sale_time,
      store_id: phone.store_id,
      store_name: phone.store_name,
      salesman_id: phone.sale_operator_id,
      salesman_name: phone.salesman_name,
      subsidy_amount: subsidyAmount,
      subsidy_rate: subsidyRate,
      eligible: subsidyAmount > 0,
      eligible_reason: eligibleReason,
      existing_subsidy: existingSubsidy
    }
  }
}

module.exports = SubsidyPhoneDetailService
