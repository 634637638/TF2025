'use strict'

const crypto = require('node:crypto')
const { resolveStoreScope, assertStoreInScope } = require('../utils/store-scope')

const CustomerMutationAccessService = require('./customer-mutation-access.service')
const SalesPhoneRepository = require('../repositories/sales-phone.repository')
const SalesCheckoutRepository = require('../repositories/sales-checkout.repository')
const { generateInvoiceNumber, generateDailyDocumentNumber, prepareInvoiceNumberTransaction } = require('../utils/invoice-number')
const { normalizeDateTime, normalizeBusinessDateTime } = require('../utils/time')
const { hasColumn } = require('./schema-inspector.service')
const { generateMemberNumber } = require('../utils/member-number')
const { getCustomerPointsConfig, reconcileCustomerPointsForSale } = require('./customer-points.service')
const { validateSalePayment } = require('../utils/sale-payment')
const FilmService = require('./film-service.service')
const AccessoryService = require('./accessory.service')

const rejected = (status, message) => ({ status, body: { success: false, message } })
const abort = (status, message) => Object.assign(new Error(message), { saleResult: rejected(status, message) })
const { validId, moneyCents } = require('../utils/sale-input')

class SalesPhoneService {
  constructor({
    repository = new SalesPhoneRepository(),
    checkoutRepository = new SalesCheckoutRepository(),
    normalizeDate = normalizeDateTime,
    normalizeBusinessTime = normalizeBusinessDateTime,
    prepareInvoiceTransaction = prepareInvoiceNumberTransaction,
    generateInvoice = generateInvoiceNumber,
    generateOrderNumber = generateDailyDocumentNumber,
    inspectColumn = hasColumn,
    createMemberNumber = generateMemberNumber,
    getPointsConfig = getCustomerPointsConfig,
    customerAccess = new CustomerMutationAccessService(),
    reconcilePoints = reconcileCustomerPointsForSale, autoFilm = false, films = null, accessories = null
  } = {}) {
    this.customerAccess = customerAccess
    this.repository = repository
    this.checkoutRepository = checkoutRepository
    this.normalizeDate = normalizeDate
    this.normalizeBusinessTime = normalizeBusinessTime
    this.prepareInvoiceTransaction = prepareInvoiceTransaction
    this.generateInvoice = generateInvoice
    this.generateOrderNumber = generateOrderNumber
    this.inspectColumn = inspectColumn
    this.createMemberNumber = createMemberNumber
    this.getPointsConfig = getPointsConfig
    this.reconcilePoints = reconcilePoints
    this.autoFilm = autoFilm
    this.films = films || (autoFilm ? new FilmService() : null)
    this.accessories = accessories || (autoFilm ? new AccessoryService() : null)
  }

  async createStandaloneOrder({ connection, customer, customerId, salesStoreId, operatorId, userId, saleTime,
    remarks, payment, paymentIds, createdSales, issuedFilms, pointsConfig }) {
    const repository = this.checkoutRepository
    const phoneIds = createdSales.map(sale => sale.phone.phone_id)
    const phones = await repository.phoneSnapshots(connection, phoneIds)
    const sales = await repository.sales(connection, createdSales.map(sale => sale.saleId))
    if (phones.length !== createdSales.length || sales.length !== createdSales.length) throw abort(409, '手机共同订单明细不完整')
    const phoneSnapshots = new Map(phones.map(phone => [Number(phone.id), phone]))
    const salesById = new Map(sales.map(sale => [Number(sale.id), sale]))
    const salesByPhone = new Map(createdSales.map(sale => [Number(sale.phone.phone_id), sale.saleId]))
    const totalAmount = createdSales.reduce((sum, sale) => sum + moneyCents(sale.phone.sale_price), 0) / 100
    const orderNo = await this.generateOrderNumber('SO', connection, saleTime, 8)
    const requestHash = crypto.createHash('sha256').update(JSON.stringify({
      phones: createdSales.map(({ saleId, phone }) => [saleId, phone.phone_id, phone.sale_price]),
      customerId, salesStoreId, operatorId, saleTime, remarks, payment
    })).digest('hex')
    const orderId = await repository.createOrder(connection, {
      order_no: orderNo, request_key: crypto.randomUUID(), request_hash: requestHash,
      customer_id: customerId, customer_name: customer.name, customer_phone: customer.phone,
      store_id: salesStoreId, operator_id: operatorId || userId, created_by: userId,
      time: saleTime, remarks, config: pointsConfig ?? await this.getPointsConfig(connection)
    })
    await repository.linkPayments(connection, paymentIds, orderId)
    let pointsAwarded = 0
    let totalCostCents = 0
    let totalCostKnown = true
    const addCost = value => {
      if (value === null || value === undefined) {
        totalCostKnown = false
        return
      }
      const cents = moneyCents(value)
      if (cents === null) throw abort(409, '商品成本快照异常，手机销售已取消')
      totalCostCents += cents
    }
    for (const { saleId, phone } of createdSales) {
      const sale = salesById.get(Number(saleId))
      const snapshot = phoneSnapshots.get(Number(phone.phone_id))
      if (!sale || !snapshot) throw abort(409, '手机共同订单快照不完整')
      const points = Number(sale.points_awarded || 0)
      pointsAwarded += points
      addCost(sale.purchase_cost)
      await repository.createItem(connection, {
        order_id: orderId, key: `phone:${phone.phone_id}`, type: 'phone', sale_id: saleId,
        phone_id: phone.phone_id, quantity: 1, unit_price: sale.sale_price, total_amount: sale.sale_price,
        purchase_cost: sale.purchase_cost, points_awarded: points,
        snapshot: { ...snapshot, invoice_number: sale.invoice_number, remarks }, time: saleTime
      })
    }
    for (const { request, issued } of issuedFilms) {
      const linkedPhoneSaleId = salesByPhone.get(Number(request.linked_phone_id))
      if (!linkedPhoneSaleId) throw abort(409, '自动赠膜关联手机不存在')
      await repository.createItem(connection, {
        order_id: orderId, key: `goods:${request.key}`, type: 'accessory', accessory_sale_id: issued.sale_id,
        accessory_id: request.accessory_id, linked_phone_sale_id: linkedPhoneSaleId, quantity: issued.quantity,
        unit_price: request.unit_price, total_amount: issued.total_price, purchase_cost: issued.purchase_cost,
        points_awarded: 0,
        snapshot: { name: issued.accessory.name, category_id: issued.accessory.category_id,
          category: issued.accessory.category, brand_id: issued.accessory.brand_id, brand_name: issued.accessory.brand_name,
          product_model: issued.accessory.product_model, barcode: issued.accessory.barcode,
          template_id: issued.accessory.template_id, model_id: issued.accessory.model_id, model_ids: issued.accessory.model_ids,
          compatible_model_names: issued.accessory.compatible_model_names, color_id: issued.accessory.color_id,
          color_name: issued.accessory.color_name, unit: issued.accessory.unit, unit_id: issued.accessory.unit_id,
          sale_type: 'gift', sale_no: issued.sale_no, serial_numbers: issued.serial_numbers,
          points_used: 0, deduction_cents: 0, gross_cents: 0, gift_return_unit_price: null, remarks }, time: saleTime
      })
      if (typeof this.films?.appendAutomatic !== 'function') throw abort(409, '自动赠膜历史服务不可用')
      await this.films.appendAutomatic(connection, {
        orderId, customerId, storeId: salesStoreId, operatorId: operatorId || userId, createdBy: userId,
        businessTime: saleTime, request, phone: phoneSnapshots.get(Number(request.linked_phone_id)),
        saleId: linkedPhoneSaleId, issuedQuantity: issued.quantity
      })
      addCost(issued.purchase_cost)
    }
    await repository.completeOrder(connection, {
      id: orderId, total_amount: totalAmount, final_amount: totalAmount,
      total_cost: totalCostKnown ? totalCostCents / 100 : null,
      total_profit: totalCostKnown ? totalAmount - totalCostCents / 100 : null,
      points_awarded: pointsAwarded, payment_method: payment.payment_method,
      payment_channel: payment.payment_channel, time: saleTime,
      result: { order_id: orderId, order_no: orderNo, total_amount: totalAmount, paid_amount: totalAmount }
    })
    return { order_id: orderId, order_no: orderNo }
  }

  async prepareAutomaticFilms(connection, phones, storeId) {
    return this.autoFilm ? this.films.prepareAutomaticForSale(connection, phones, storeId) : []
  }

  async issueAutomaticFilms(connection, films, { actor, customer, customerId, storeId, operatorId, saleTime, remarks }) {
    const issuedFilms = []
    for (const film of films) {
      const issued = await this.accessories.issueSale({ ...film, store_id: storeId, customer_id: customerId,
        customer_name: customer.name, customer_phone: customer.phone, remarks }, actor, connection,
      { time: saleTime, sellerId: operatorId, sellerName: actor.name || actor.username || '' })
      issuedFilms.push({ request: film, issued })
    }
    return issuedFilms
  }

  /** 由调用方的销售事务管理客户资料，手机与商品结算复用同一入口。 */
  async resolveCustomer(connection, customerInfo, actor) {
    const existing = await this.repository.findCustomerByPhone(connection, customerInfo.phone)
    if (existing) {
      const nameChanged = customerInfo.name !== existing.name
      const appleChanged = customerInfo.apple_id !== undefined && (customerInfo.apple_id || null) !== (existing.apple_id || null)
      if (nameChanged || appleChanged) {
        await this.customerAccess.require(actor, 'edit')
        await this.repository.updateCustomer(connection, {
          name: nameChanged ? customerInfo.name : null,
          appleId: appleChanged ? customerInfo.apple_id || null : null, customerId: existing.id
        })
      }
      return existing.id
    }
    await this.customerAccess.require(actor, 'create')
    const memberNumber = await this.createMemberNumber({ connection })
    return this.repository.createCustomer(connection, {
      name: customerInfo.name, phone: customerInfo.phone, appleId: customerInfo.apple_id || null, memberNumber
    })
  }

  async accountSalePoints({ connection, saleId, customerId, salePrice, isNew, config, hasAccessory = false }) {
    return this.reconcilePoints({ executor: connection, saleId, customerId, saleType: 'retail',
      salePrice, isNew, config, initialize: true,
      description: hasAccessory ? '购买手机+商品（自动生成）' : '购买手机（自动生成）' })
  }

  async sell({ body = {}, userId, actor, connection: transactionConnection, pointsConfig: transactionPointsConfig, deferPoints = false, hasAccessory = false }) {
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

    const saleTimeValue = this.normalizeBusinessTime(saleTime)
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
        const scope = resolveStoreScope(actor)
        const salesStoreId = assertStoreInScope(scope, body.store_id)
        const supportsPaymentChannel = await this.inspectColumn('sales', 'payment_channel', connection)

        const customerId = await this.resolveCustomer(connection, customerInfo, actor)

        const phoneIds = phonesToSell.map(phone => phone.phone_id)
        const phoneChecks = await this.repository.findPhonesForSale(connection, phoneIds)
        if (phoneChecks.length !== phonesToSell.length) throw abort(404, '部分或全部设备不存在')

        for (const phone of phoneChecks) assertStoreInScope(scope, phone.store_id)

        let preorder = null
        if (preorderId) {
          if (isBatchSale) throw abort(400, '预定交付只能销售一台已匹配设备')
          preorder = await this.repository.findPreorderForUpdate(connection, parseInt(preorderId))
          if (!preorder) throw abort(404, '预定单不存在')
          assertStoreInScope(scope, preorder.store_id)
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
        const automaticFilms = await this.prepareAutomaticFilms(connection,
          finalizedPhones.map(phone => currentPhones.get(phone.phone_id)), salesStoreId)
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
            storeId: salesStoreId,
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

        const issuedFilms = await this.issueAutomaticFilms(connection, automaticFilms, {
          actor, customer: customerInfo, customerId, storeId: salesStoreId, operatorId: operatorId || userId,
          saleTime: saleTimeValue, remarks: requestedRemarks
        })

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
            config: pointsConfig,
            hasAccessory: hasAccessory || automaticFilms.length > 0
          })
          pointsEarned += points.points
          pointsEligibleAmount += points.eligibleAmount
        }

        let sharedOrder = null
        if (!transactionConnection) {
          sharedOrder = await this.createStandaloneOrder({ connection, customer: customerInfo, customerId,
            salesStoreId, operatorId, userId, saleTime: saleTimeValue, remarks: requestedRemarks || null,
            payment, paymentIds, createdSales, issuedFilms, pointsConfig })
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
              ...(sharedOrder || {}),
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
        if (error.statusCode === 403) return rejected(403, error.message)
        if (error.saleResult) return error.saleResult
        throw error
      }
    }
    return transactionConnection ? run(transactionConnection) : this.repository.withConnection(run)
  }
}

module.exports = SalesPhoneService
