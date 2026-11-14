'use strict'

const SalesPhoneRepository = require('../repositories/sales-phone.repository')
const { generateInvoiceNumber, prepareInvoiceNumberTransaction } = require('../utils/invoice-number')
const { normalizeDateTime } = require('../utils/time')
const { hasColumn } = require('./schema-inspector.service')
const { generateMemberNumber } = require('../utils/member-number')
const { getCustomerPointsConfig, reconcileCustomerPointsForSale } = require('./customer-points.service')
const { validateSalePayment } = require('../utils/sale-payment')

const rejected = (status, message) => ({ status, body: { success: false, message } })
const abort = (status, message) => Object.assign(new Error(message), { saleResult: rejected(status, message) })
const { validId, moneyCents } = require('../utils/sale-input')

class SalesPhoneService {
  constructor({
    repository = new SalesPhoneRepository(),
    normalizeDate = normalizeDateTime,
    prepareInvoiceTransaction = prepareInvoiceNumberTransaction,
    generateInvoice = generateInvoiceNumber,
    inspectColumn = hasColumn,
    createMemberNumber = generateMemberNumber,
    getPointsConfig = getCustomerPointsConfig,
    reconcilePoints = reconcileCustomerPointsForSale
  } = {}) {
    this.repository = repository
    this.normalizeDate = normalizeDate
    this.prepareInvoiceTransaction = prepareInvoiceTransaction
    this.generateInvoice = generateInvoice
    this.inspectColumn = inspectColumn
    this.createMemberNumber = createMemberNumber
    this.getPointsConfig = getPointsConfig
    this.reconcilePoints = reconcilePoints
  }

  /** 由调用方的销售事务管理客户资料，手机与商品结算复用同一入口。 */
  async resolveCustomer(connection, customerInfo) {
    const existing = await this.repository.findCustomerByPhone(connection, customerInfo.phone)
    if (existing) {
      await this.repository.updateCustomer(connection, {
        name: customerInfo.name, appleId: customerInfo.apple_id || null, customerId: existing.id
      })
      return existing.id
    }
    const memberNumber = await this.createMemberNumber({ connection })
    return this.repository.createCustomer(connection, {
      name: customerInfo.name, phone: customerInfo.phone, appleId: customerInfo.apple_id || null, memberNumber
    })
  }

  async accountSalePoints({ connection, saleId, customerId, salePrice, isNew, config }) {
    return this.reconcilePoints({ executor: connection, saleId, customerId, saleType: 'retail',
      salePrice, isNew, config, initialize: true })
  }

  async sell({ body = {}, userId, connection: transactionConnection, pointsConfig: transactionPointsConfig, deferPoints = false }) {
    if (deferPoints && !transactionConnection) throw new Error('延迟积分必须使用共同结算事务')
    const {
      phone_id: phoneId,
      phones,
      customer_info: customerInfoInput,
      sale_type: saleType,
      sale_price: salePrice,
      purchase_cost: purchaseCost,
      supplier_id: supplierId,
      sale_time: saleTime,
      payment_info: paymentInfo,
      remarks,
      operator_id: operatorId,
      preorder_id: preorderId,
      advance_payment: advancePayment
    } = body

    const saleTimeValue = this.normalizeDate(saleTime, false)
    if (!saleTimeValue) return { ...rejected(400, '销售时间格式无效'), apiError: true }

    if (!['retail', 'batch', 'batch_item', undefined].includes(saleType)) return rejected(400, '此接口仅支持零售，批发及划拨请使用对应入口')
    if (phones !== undefined && (!Array.isArray(phones) || !phones.length || phones.length > 1000)) return rejected(400, '销售设备列表无效')
    const isBatchSale = Array.isArray(phones)
    const phoneInputs = isBatchSale ? phones : [{
      phone_id: phoneId,
      sale_price: salePrice,
      purchase_cost: purchaseCost,
      supplier_id: supplierId
    }]
    if (phoneInputs.some(phone => !phone || !validId(phone.phone_id) || moneyCents(phone.sale_price) === null || moneyCents(phone.sale_price) === 0 ||
      (phone.purchase_cost !== undefined && phone.purchase_cost !== null && phone.purchase_cost !== '' && moneyCents(phone.purchase_cost) === null) ||
      (phone.supplier_id !== undefined && phone.supplier_id !== null && phone.supplier_id !== '' && !validId(phone.supplier_id)))) {
      return rejected(400, '设备信息不完整或价格无效')
    }
    const phonesToSell = phoneInputs.map(phone => ({ ...phone, phone_id: Number(phone.phone_id) }))
    if (new Set(phonesToSell.map(phone => phone.phone_id)).size !== phonesToSell.length) return rejected(400, '同一台设备不能重复销售')
    const totalCents = phonesToSell.reduce((sum, phone) => sum + moneyCents(phone.sale_price), 0)
    if (totalCents >= 10000000000) return rejected(400, '销售总金额超出范围')
    const customerInfo = { ...(customerInfoInput || {}) }
    const customerName = String(customerInfo.name || '').trim()
    const customerPhone = String(customerInfo.phone || '').replace(/\D/g, '')
    if (phonesToSell.length === 0 || customerName.length < 2 || customerName.length > 50 || !/^1[3-9]\d{9}$/.test(customerPhone)) {
      return rejected(400, '客户姓名或手机号格式无效')
    }
    customerInfo.name = customerName
    customerInfo.phone = customerPhone

    if (!paymentInfo || !paymentInfo.payment_method) return rejected(400, '缺少支付方式信息')
    let payment
    try { payment = validateSalePayment(paymentInfo.payment_method, paymentInfo.payment_channel) }
    catch (error) { return rejected(400, error.message) }
    if (paymentInfo.payment_status !== undefined && paymentInfo.payment_status !== 'success') return rejected(400, '销售收款状态必须为成功')
    if (paymentInfo.payment_amount !== undefined && moneyCents(paymentInfo.payment_amount) !== totalCents) return rejected(400, '收款金额必须与销售明细合计一致')
    const paymentTime = this.normalizeDate(paymentInfo.payment_time || saleTimeValue, true)
    if (!paymentTime) return rejected(400, '收款时间格式无效')
    if (operatorId !== undefined && !validId(operatorId)) return rejected(400, '请选择有效的销售员')

    const run = async connection => {
      let transactionStarted = false
      try {
        if (!transactionConnection) {
          await this.prepareInvoiceTransaction(connection)
          await connection.beginTransaction()
          transactionStarted = true
        }
        const supportsPaymentChannel = await this.inspectColumn('sales', 'payment_channel', connection)

        const customerId = await this.resolveCustomer(connection, customerInfo)

        const phoneIds = phonesToSell.map(phone => phone.phone_id)
        const phoneChecks = await this.repository.findPhonesForSale(connection, phoneIds)
        if (phoneChecks.length !== phonesToSell.length) throw abort(404, '部分或全部设备不存在')

        let preorder = null
        if (preorderId) {
          if (isBatchSale) throw abort(400, '预定交付只能销售一台已匹配设备')
          preorder = await this.repository.findPreorderForUpdate(connection, parseInt(preorderId))
          if (!preorder) throw abort(404, '预定单不存在')
          if (preorder.status !== 'arrived') throw abort(400, '只有已匹配的预定单可以交付')
          if (Number(preorder.matched_phone_id) !== Number(phoneIds[0]) || Number(preorder.customer_id) !== Number(customerId)) {
            throw abort(400, '预定客户或交付设备与预定单不一致')
          }
        }

        for (const phone of phoneChecks) {
          const isReservedDelivery = Boolean(preorderId) && phone.status === 'reserved'
          if (phone.status !== 'in_stock' && !isReservedDelivery) {
            throw abort(400, `设备ID ${phone.id} 不在库存中，无法销售`)
          }
          if (phone.is_preordered === 1) {
            if (!preorderId) throw abort(400, `设备ID ${phone.id} 已被预订，销售时必须使用关联预定客户`)
            if (!phone.preorder_customer_id || Number(phone.preorder_customer_id) !== Number(customerId) ||
              !preorder || Number(preorder.matched_phone_id) !== Number(phone.id)) {
              throw abort(400, `设备ID ${phone.id} 已被客户"${phone.preorder_customer_name || '未知'}"预订，只能销售给该客户`)
            }
          }
        }

        if (customerId) {
          const duplicateSales = await this.repository.findDuplicateSales(connection, phoneIds, customerId)
          if (duplicateSales.length) {
            const duplicateList = duplicateSales.map(sale =>
              `IMEI: ${sale.imei}, 销售日期: ${new Date(sale.sale_time).toLocaleDateString()}`
            ).join('; ')
            throw abort(400, `检测到重复销售：以下设备已销售给该客户 - ${duplicateList}。请确认是否重复操作。`)
          }
        }

        const currentPhones = new Map(phoneChecks.map(phone => [Number(phone.id), phone]))
        const hasRemarksField = Object.prototype.hasOwnProperty.call(body, 'remarks')
        const requestedRemarks = String(remarks ?? '').trim()
        const finalizedPhones = phonesToSell.map(phone => {
          const currentPhone = currentPhones.get(phone.phone_id)
          const resolvedPurchaseCost = phone.purchase_cost !== undefined && phone.purchase_cost !== null && phone.purchase_cost !== ''
            ? parseFloat(phone.purchase_cost)
            : currentPhone.purchase_cost !== null && currentPhone.purchase_cost !== undefined
              ? parseFloat(currentPhone.purchase_cost)
              : null
          if (resolvedPurchaseCost !== null && moneyCents(resolvedPurchaseCost) === null) throw abort(409, '设备成本异常，请核对后再销售')
          return {
            ...phone,
            sale_price: parseFloat(phone.sale_price),
            resolved_purchase_cost: resolvedPurchaseCost,
            is_new: currentPhone.is_new,
            final_remarks: hasRemarksField
              ? (requestedRemarks || null)
              : (currentPhone.remarks || null)
          }
        })
        const totalAmount = totalCents / 100
        let saleId = null
        const createdSales = []

        for (const phone of finalizedPhones) {
          const currentSaleType = 'retail'
          const invoiceNumber = await this.generateInvoice(currentSaleType, connection, saleTimeValue)
          const createdSaleId = await this.repository.createSale(connection, {
            phoneId: phone.phone_id,
            customerId,
            saleType: currentSaleType,
            operatorId: operatorId || userId,
            storeId: body.store_id || null,
            salePrice: phone.sale_price,
            purchaseCost: phone.resolved_purchase_cost,
            paymentMethod: payment.payment_method,
            paymentChannel: payment.payment_channel,
            supportsPaymentChannel: supportsPaymentChannel,
            invoiceNumber,
            remarks: phone.final_remarks,
            saleTime: saleTimeValue
          })
          if (!isBatchSale) saleId = createdSaleId
          createdSales.push({ saleId: createdSaleId, phone })
        }

        const paymentRemarks = [
          paymentInfo.transaction_no ? `交易流水号: ${paymentInfo.transaction_no}` : null,
          paymentInfo.payment_channel ? `支付渠道: ${paymentInfo.payment_channel}` : null
        ].filter(Boolean).join(', ') || (isBatchSale ? '批量销售收款' : '单个销售收款')
        const paymentIds = []
        for (const sale of createdSales) {
          paymentIds.push(await this.repository.createPayment(connection, {
            orderId: sale.saleId,
            customerId,
            paymentMethod: payment.payment_method,
            paymentChannel: payment.payment_channel,
            amount: sale.phone.sale_price,
            status: 'success',
            transactionNo: paymentInfo.transaction_no || null,
            paymentTime,
            remarks: paymentRemarks
          }))
        }

        for (const phone of finalizedPhones) {
          const currentPhone = currentPhones.get(phone.phone_id)
          const finalSupplierId = phone.supplier_id !== undefined && phone.supplier_id !== null && phone.supplier_id !== ''
            ? parseInt(phone.supplier_id)
            : currentPhone.supplier_id
          const result = await this.repository.markPhoneSold(connection, {
            phoneId: phone.phone_id,
            salePrice: parseFloat(phone.sale_price),
            purchaseCost: phone.resolved_purchase_cost,
            supplierId: finalSupplierId,
            remarks: phone.final_remarks,
            saleTime: saleTimeValue,
            operatorId: operatorId || userId
          })
          if (result.affectedRows !== 1) throw abort(400, '部分设备状态更新失败')
        }

        if (preorderId) {
          const deliveredPhone = finalizedPhones[0]
          if (finalizedPhones.length !== 1 || !preorder || Number(preorder.matched_phone_id) !== Number(deliveredPhone.phone_id)) {
            throw abort(400, '交付设备与预定单已匹配设备不一致')
          }
          const depositAmount = parseFloat(advancePayment) || parseFloat(preorder.deposit_amount) || 0
          await this.repository.completePreorder(connection, {
            actualPrice: deliveredPhone.sale_price,
            saleTime: saleTimeValue,
            operatorId: operatorId || userId,
            saleId,
            remainingAmount: Math.max(0, deliveredPhone.sale_price - depositAmount),
            preorderId: parseInt(preorderId)
          })
        }

        const pointsConfig = transactionPointsConfig || await this.getPointsConfig(connection)
        let pointsEarned = 0
        let pointsEligibleAmount = 0
        for (const sale of deferPoints ? [] : createdSales) {
          const points = await this.accountSalePoints({
            connection,
            saleId: sale.saleId,
            customerId,
            salePrice: sale.phone.sale_price,
            isNew: sale.phone.is_new,
            config: pointsConfig
          })
          pointsEarned += points.points
          pointsEligibleAmount += points.eligibleAmount
        }

        if (!transactionConnection) await connection.commit()
        transactionStarted = false
        return {
          status: 200,
          body: {
            success: true,
            message: isBatchSale ? `批量销售成功！共销售 ${phonesToSell.length} 台设备` : '销售成功',
            data: {
              sale_id: isBatchSale ? null : saleId,
              customer_id: customerId,
              payment_id: paymentIds[0],
              payment_ids: paymentIds,
              customer_name: customerInfo.name,
              customer_phone: customerInfo.phone,
              phones_sold: finalizedPhones.length,
              total_amount: totalAmount,
              points_earned: pointsEarned,
              points_eligible_amount: pointsEligibleAmount,
              phone_details: createdSales.map(({ phone, saleId: itemSaleId }) => ({
                phone_id: phone.phone_id,
                sale_id: itemSaleId,
                sale_price: parseFloat(phone.sale_price),
                purchase_cost: phone.resolved_purchase_cost
              }))
            }
          }
        }
      } catch (error) {
        if (transactionStarted) await connection.rollback()
        if (error.saleResult) return error.saleResult
        throw error
      }
    }
    return transactionConnection ? run(transactionConnection) : this.repository.withConnection(run)
  }
}

module.exports = SalesPhoneService
