'use strict'

const { ensureRentalSchema } = require('../utils/rental-schema')
const { isBuyoutMode, getPrincipalAmount, positiveMoney } = require('../utils/rental-calculations')
const RentalUpdateRepository = require('../repositories/rental-update.repository')
const { reconcileCustomerPointsForSale } = require('./customer-points.service')

const PAYMENT_METHODS = new Set(['cash', 'mobile', 'bank_card', 'subsidy_card', 'transfer', 'other'])

class RentalUpdateService {
  constructor({ repository = new RentalUpdateRepository(), ensureSchema = ensureRentalSchema, reconcilePoints = reconcileCustomerPointsForSale } = {}) {
    this.repository = repository
    this.ensureSchema = ensureSchema
    this.reconcilePoints = reconcilePoints
  }

  async update({ id: idValue, body, isAdministrator }) {
    await this.ensureSchema()
    const id = Number(idValue)
    return this.repository.withConnection(async connection => {
      await connection.beginTransaction()
      try {
        if (['customer_id', 'phone_id', 'start_date'].some(field => body[field] !== undefined)) {
          throw Object.assign(new Error('客户、设备和开始日期创建后不可修改'), { statusCode: 400 })
        }
        const current = await this.repository.findForUpdate(connection, id)
        if (!current) throw Object.assign(new Error('租赁合同不存在'), { code: 'RENTAL_NOT_FOUND' })
        if (current.status !== 'active' && !isAdministrator) {
          throw Object.assign(new Error('已结束合同仅管理员可编辑'), { statusCode: 400 })
        }

        const mode = current.billing_mode
        const requestedMode = body.billing_mode
        if (requestedMode && !((requestedMode === 'buyout' && isBuyoutMode(mode)) || requestedMode === mode)) {
          throw Object.assign(new Error('合同类型创建后不可切换'), { statusCode: 400 })
        }
        const normalizedMode = isBuyoutMode(mode) ? 'buyout' : 'daily'
        const valueOrCurrent = (field, currentValue) => body[field] === undefined ? Number(currentValue || 0) : Number(body[field])
        const unitPrice = valueOrCurrent('unit_price', current.unit_price)
        const salePrice = valueOrCurrent('sale_price', current.sale_price)
        const purchaseCost = valueOrCurrent('purchase_cost', current.purchase_cost)
        const downPayment = valueOrCurrent('down_payment', current.down_payment)
        const monthlyRent = valueOrCurrent('monthly_rent', current.monthly_rent)
        const deposit = valueOrCurrent('deposit', current.deposit)
        const termMonths = body.term_months === undefined ? Number(current.term_months || 0) : Number(body.term_months)
        const principalAmount = isBuyoutMode(mode) ? getPrincipalAmount(salePrice, downPayment) : null

        this.validateValues({ body, normalizedMode, mode, unitPrice, salePrice, purchaseCost, downPayment, monthlyRent, deposit, termMonths })
        if (isBuyoutMode(mode)) {
          const paidCount = await this.repository.countPaidPeriods(connection, id)
          if (paidCount > termMonths) throw Object.assign(new Error('买断期数不能少于已登记的还款期次'), { statusCode: 400 })
        }

        const rentalUpdates = []
        const rentalParams = []
        const addRentalUpdate = (sql, value) => { rentalUpdates.push(sql); rentalParams.push(value) }
        if (body.unit_price !== undefined && normalizedMode === 'daily') addRentalUpdate('unit_price=?', unitPrice)
        if (body.term_months !== undefined && normalizedMode === 'buyout') {
          addRentalUpdate('term_months=?', termMonths)
          rentalUpdates.push('end_date=DATE_ADD(start_date, INTERVAL ? MONTH)')
          rentalParams.push(termMonths)
        }
        if (body.sale_price !== undefined) {
          addRentalUpdate('sale_price=?', salePrice)
          if (normalizedMode === 'buyout') addRentalUpdate('total_cost=?', salePrice)
        }
        if (normalizedMode === 'buyout' && (body.sale_price !== undefined || body.down_payment !== undefined)) {
          if (body.down_payment !== undefined) addRentalUpdate('down_payment=?', downPayment)
          addRentalUpdate('principal_amount=?', principalAmount)
        }
        if (body.monthly_rent !== undefined && normalizedMode === 'buyout') addRentalUpdate('monthly_rent=?', monthlyRent)
        if (body.monitoring_lock !== undefined && normalizedMode === 'daily') addRentalUpdate('monitoring_lock=?', body.monitoring_lock ? 1 : 0)
        if (body.deposit !== undefined && normalizedMode === 'daily') addRentalUpdate('deposit=?', deposit)
        if (body.remarks !== undefined) addRentalUpdate('remarks=?', String(body.remarks || '').trim() || null)
        if (rentalUpdates.length) await this.repository.updateRental(connection, id, rentalUpdates, rentalParams)

        if (isBuyoutMode(mode) && current.sale_id) {
          const saleUpdates = []
          const saleParams = []
          const addSaleUpdate = (column, value) => { saleUpdates.push(`${column}=?`); saleParams.push(value) }
          if (body.sale_price !== undefined) addSaleUpdate('sale_price', Number(salePrice.toFixed(2)))
          if (body.purchase_cost !== undefined) addSaleUpdate('purchase_cost', purchaseCost)
          if (body.sale_store_id !== undefined) addSaleUpdate('store_id', Number(body.sale_store_id) || null)
          if (body.sale_operator_id !== undefined) addSaleUpdate('operator_id', Number(body.sale_operator_id) || null)
          if (body.sale_payment_method !== undefined) addSaleUpdate('payment_method', String(body.sale_payment_method || '') || null)
          if (body.sale_payment_channel !== undefined) addSaleUpdate('payment_channel', String(body.sale_payment_channel || '').trim() || null)
          if (body.sale_remarks !== undefined) addSaleUpdate('remarks', String(body.sale_remarks || '').trim() || null)
          if (body.sale_price !== undefined) {
            await this.reconcilePoints({
              executor: connection,
              saleId: current.sale_id,
              customerId: current.customer_id,
              saleType: 'retail',
              salePrice,
              isNew: current.is_new
            })
          }
          if (saleUpdates.length) await this.repository.updateSale(connection, current.sale_id, saleUpdates, saleParams)
          if (body.sale_price !== undefined) await this.repository.updateSoldPhonePrice(connection, current.phone_id, Number(salePrice.toFixed(2)))
        }
        if (normalizedMode === 'buyout' && body.purchase_cost !== undefined) {
          await this.repository.updatePhonePurchaseCost(connection, current.phone_id, purchaseCost)
        }

        await connection.commit()
        return { id }
      } catch (error) {
        await connection.rollback().catch(() => {})
        throw error
      }
    })
  }

  validateValues({ body, normalizedMode, mode, unitPrice, salePrice, purchaseCost, downPayment, monthlyRent, deposit, termMonths }) {
    if (normalizedMode === 'daily' && (!positiveMoney(unitPrice) || unitPrice <= 0 || !positiveMoney(deposit))) {
      throw Object.assign(new Error('租金和押金金额不正确'), { statusCode: 400 })
    }
    if (isBuyoutMode(mode) && (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 12)) {
      throw Object.assign(new Error('到期买断请选择1至12期'), { statusCode: 400 })
    }
    if (isBuyoutMode(mode) && (salePrice <= 0 || downPayment < 0 || downPayment > salePrice || monthlyRent < 0)) {
      throw Object.assign(new Error('销售总价、首付或每月租金不正确'), { statusCode: 400 })
    }
    if (isBuyoutMode(mode) && !positiveMoney(purchaseCost)) {
      throw Object.assign(new Error('入库价格金额不正确'), { statusCode: 400 })
    }
    if (body.sale_payment_method !== undefined && !PAYMENT_METHODS.has(body.sale_payment_method)) {
      throw Object.assign(new Error('请选择有效的支付方式'), { statusCode: 400 })
    }
  }
}

module.exports = RentalUpdateService
