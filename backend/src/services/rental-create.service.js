'use strict'

const { ensureRentalSchema } = require('../utils/rental-schema')
const { isValidIdCard } = require('../utils/security-enhanced')
const { generateInvoiceNumber, prepareInvoiceNumberTransaction } = require('../utils/invoice-number')
const { positiveMoney, getPrincipalAmount } = require('../utils/rental-calculations')
const RentalCreateRepository = require('../repositories/rental-create.repository')
const { reconcileCustomerPointsForSale } = require('./customer-points.service')

const PAYMENT_METHODS = new Set(['cash', 'mobile', 'bank_card', 'subsidy_card', 'transfer', 'other'])
const invalid = message => Object.assign(new Error(message), { statusCode: 400 })
const contractNumberFor = (billingMode, startDate, rentalId) => {
  const prefix = billingMode === 'buyout' ? 'MD' : 'ZL'
  return `${prefix}${String(startDate).replace(/-/g, '').slice(0, 8)}${String(rentalId).padStart(4, '0')}`
}

class RentalCreateService {
  constructor({
    repository = new RentalCreateRepository(),
    ensureSchema = ensureRentalSchema,
    isValidIdCard: validateIdCard = isValidIdCard,
    prepareInvoiceTransaction = prepareInvoiceNumberTransaction,
    generateInvoice = generateInvoiceNumber,
    reconcilePoints = reconcileCustomerPointsForSale
  } = {}) {
    this.repository = repository
    this.ensureSchema = ensureSchema
    this.isValidIdCard = validateIdCard
    this.prepareInvoiceTransaction = prepareInvoiceTransaction
    this.generateInvoice = generateInvoice
    this.reconcilePoints = reconcilePoints
  }

  async create({ body = {}, operatorId }) {
    await this.ensureSchema()
    const billingMode = body.billing_mode
    const customerId = Number(body.customer_id)
    const phoneId = Number(body.phone_id)
    const unitPrice = Number(body.unit_price || 0)
    const salePrice = Number(body.sale_price || 0)
    const buyout = billingMode === 'buyout'
    const downPayment = buyout ? Number(body.down_payment || 0) : 0
    const monthlyRent = buyout ? Number(body.monthly_rent || 0) : 0
    const termMonths = buyout ? Number(body.term_months) : null
    const saleOperatorId = buyout ? Number(body.sale_operator_id) : null
    const saleStoreId = buyout ? Number(body.sale_store_id || 0) || null : null
    const salePaymentMethod = buyout ? String(body.sale_payment_method || '') : null
    const salePaymentChannel = buyout ? String(body.sale_payment_channel || '').trim() || null : null
    const saleRemarks = buyout ? String(body.sale_remarks || '').trim() || null : null
    const startDate = String(body.start_date || '')
    const deposit = Number(body.deposit || 0)
    const monitoringLock = buyout ? 1 : (body.monitoring_lock ? 1 : 0)

    if (!customerId || !phoneId || !['daily', 'buyout'].includes(billingMode) || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      throw invalid('请选择客户、租赁设备、计费方式和开始日期')
    }
    if (billingMode === 'daily' && (!positiveMoney(unitPrice) || unitPrice <= 0)) throw invalid('每日租金金额不正确')
    if (!positiveMoney(deposit)) throw invalid('押金金额不正确')
    if (buyout && (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 12)) throw invalid('到期买断请选择1至12期')
    if (!positiveMoney(salePrice) || salePrice <= 0) throw invalid('请输入销售价格')
    if (buyout && (!positiveMoney(downPayment) || downPayment > salePrice || !positiveMoney(monthlyRent))) {
      throw invalid('请正确填写销售总价、首付和每月租金')
    }
    if (buyout && (!saleOperatorId || !saleStoreId)) throw invalid('请选择销售员和销售店铺')
    if (buyout && !PAYMENT_METHODS.has(salePaymentMethod)) throw invalid('请选择有效的支付方式')

    return this.repository.withConnection(async connection => {
      try {
        // 初始化单号序列表必须发生在事务开始之前，以免 DDL 隐式提交。
        await this.prepareInvoiceTransaction(connection)
        await connection.beginTransaction()
        const customer = await this.repository.findActiveCustomerForUpdate(connection, customerId)
        if (!customer || !this.isValidIdCard(String(customer.id_card || ''))) {
          throw new Error('客户不存在、已停用或缺少正确身份证号')
        }
        const phone = await this.repository.findPhoneForUpdate(connection, phoneId)
        if (!phone || phone.status !== 'in_stock') throw new Error('设备已不在库，请重新选择')

        const purchaseCost = body.purchase_cost === undefined ? Number(phone.purchase_cost || 0) : Number(body.purchase_cost)
        if (buyout && !positiveMoney(purchaseCost)) throw new Error('入库价格金额不正确')
        if (buyout && body.purchase_cost !== undefined) {
          await this.repository.updatePhonePurchaseCost(connection, phoneId, purchaseCost)
        }
        const rentalId = await this.repository.createRental(connection, {
          billingMode, customerId, phoneId, unitPrice, salePrice, downPayment, monthlyRent,
          termMonths, monitoringLock, startDate, deposit: buyout ? 0 : deposit,
          principalAmount: buyout ? getPrincipalAmount(salePrice, downPayment) : null,
          operatorId, remarks: String(body.remarks || '').trim() || null
        })
        const generatedContractNumber = contractNumberFor(billingMode, startDate, rentalId)
        await this.repository.setContractNumber(connection, rentalId, generatedContractNumber)

        if (buyout) {
          const totalPrice = Number(salePrice.toFixed(2))
          const saleDate = `${startDate} 00:00:00`
          const invoiceNumber = await this.generateInvoice('retail', connection, saleDate)
          const saleId = await this.repository.createSale(connection, {
            phoneId, customerId, operatorId: saleOperatorId, storeId: saleStoreId || phone.store_id || null,
            salePrice: totalPrice, purchaseCost, paymentMethod: salePaymentMethod, invoiceNumber,
            remarks: saleRemarks || `租赁买断合同 ${generatedContractNumber}`, saleDate
          })
          await this.reconcilePoints({
            executor: connection, saleId, customerId, saleType: 'retail', salePrice: totalPrice,
            isNew: phone.is_new, initialize: true
          })
          await this.repository.linkSale(connection, saleId, rentalId)
          await this.repository.markPhoneSold(connection, {
            phoneId, salePrice: totalPrice, saleDate, operatorId: saleOperatorId,
            remarks: `\n租赁买断合同 ${generatedContractNumber}`
          })
          if (downPayment > 0) {
            const paymentRemarks = `买断首付 ${generatedContractNumber}`
            await this.repository.createDownPayment(connection, { rentalId, amount: downPayment, operatorId, remarks: paymentRemarks })
            if (await this.repository.findRentalSaleId(connection, rentalId)) {
              await this.repository.createPaymentRecord(connection, {
                saleId, customerId, paymentMethod: salePaymentMethod, paymentChannel: salePaymentChannel,
                amount: downPayment, paymentTime: saleDate, remarks: paymentRemarks
              })
            }
          }
        } else {
          await this.repository.markPhoneRented(connection, phoneId)
        }

        await connection.commit()
        return { id: rentalId, contract_number: generatedContractNumber, billing_mode: billingMode }
      } catch (error) {
        await connection.rollback().catch(() => {})
        throw error
      }
    })
  }
}

module.exports = RentalCreateService
