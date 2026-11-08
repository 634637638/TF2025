'use strict'

const BaseService = require('../core/base/base.service')
const InventoryRepository = require('../repositories/inventory.repository')
const { getDatabase, isConnected } = require('../config/database')
const { validateImei: defaultValidateImei } = require('../utils/imei')
const { normalizeDateTime: defaultNormalizeDateTime } = require('../utils/time')
const { generateMemberNumber: defaultGenerateMemberNumber } = require('../utils/member-number')
const {
  prepareInvoiceNumberTransaction: defaultPrepareInvoiceNumberTransaction,
  generateInvoiceNumber: defaultGenerateInvoiceNumber
} = require('../utils/invoice-number')
const { reconcileCustomerPointsForSale: defaultReconcileCustomerPointsForSale } = require('./customer-points.service')
const { COMPLETED_TRANSACTION_STATUSES } = require('../utils/phone-status')
const log = require('../utils/log')

class InventoryError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.name = 'InventoryError'
    this.statusCode = statusCode
  }
}

const TRANSACTION_CONFIG = Object.freeze({
  sold: { saleType: 'retail', phoneStatus: 'sold', invoiceType: 'retail' },
  peer_transfer: { saleType: 'wholesale', phoneStatus: 'peer_transfer', invoiceType: 'wholesale' },
  supplier_proxy: { saleType: 'supplier_proxy', phoneStatus: 'supplier_proxy', invoiceType: 'supplier_proxy' }
})

class InventoryService extends BaseService {
  constructor({
    repository,
    database = getDatabase,
    connected = isConnected,
    logger = log,
    validateImei = defaultValidateImei,
    normalizeDateTime = defaultNormalizeDateTime,
    generateMemberNumber = defaultGenerateMemberNumber,
    prepareInvoiceNumberTransaction = defaultPrepareInvoiceNumberTransaction,
    generateInvoiceNumber = defaultGenerateInvoiceNumber,
    reconcileCustomerPointsForSale = defaultReconcileCustomerPointsForSale
  } = {}) {
    super()
    this.repository = repository || new InventoryRepository({ database })
    this.database = database
    this.connected = connected
    this.logger = logger
    this.validateImei = validateImei
    this.normalizeDateTime = normalizeDateTime
    this.generateMemberNumber = generateMemberNumber
    this.prepareInvoiceNumberTransaction = prepareInvoiceNumberTransaction
    this.generateInvoiceNumber = generateInvoiceNumber
    this.reconcileCustomerPointsForSale = reconcileCustomerPointsForSale
  }

  async list(query = {}) {
    const pageSize = Math.min(Math.max(parseInt(query.page_size ?? query.limit) || 10, 1), 100)
    const page = Math.max(parseInt(query.page) || 1, 1)
    const { whereConditions, whereClause, queryParams } = this.repository.listFilters(query, { includeLegacyDate: true })
    this.logger.debug('库存查询条件:', whereConditions)
    this.logger.debug('库存查询参数:', queryParams)
    const { rows, total } = await this.repository.withConnection(connection => this.repository.list(connection, {
      whereClause,
      queryParams,
      limit: pageSize,
      offset: (page - 1) * pageSize
    }))
    const data = rows.map(item => ({
      id: item.id,
      imei: item.imei || '',
      serial_number: item.serial_number || '',
      model: item.model || '',
      brand: item.brand || '',
      color: item.color || '',
      memory: item.memory || '',
      phone_condition: item.phone_condition || '',
      condition: Number(item.is_new) === 1 ? 'new' : 'used',
      purchase_cost: parseFloat(item.purchase_cost) || 0,
      sale_price: parseFloat(item.sale_price) || 0,
      inventory_time: item.inventory_time || null,
      sale_time: item.sale_time || null,
      supplier_id: item.supplier_id,
      supplier_name: item.supplier_name || '未知供应商',
      store_id: item.store_id,
      store_name: item.store_name || '未知店铺',
      purchase_number: item.purchase_number || '',
      inventory_operator_id: item.inventory_operator_id,
      inventory_operator_name: item.inventory_operator_name || '未设置',
      remarks: item.remarks || '',
      status: item.status,
      is_preordered: item.is_preordered === 1,
      preorder_id: item.preorder_id || null,
      preorder_customer_id: item.preorder_customer_id || null,
      preorder_customer_name: item.preorder_customer_name || '',
      preorder_customer_phone: item.preorder_customer_phone || '',
      preorder_deposit_amount: item.preorder_deposit_amount === null || item.preorder_deposit_amount === undefined ? null : Number(item.preorder_deposit_amount),
      preorder_total_price: item.preorder_total_price === null || item.preorder_total_price === undefined ? null : Number(item.preorder_total_price),
      preorder_actual_price: item.preorder_actual_price === null || item.preorder_actual_price === undefined ? null : Number(item.preorder_actual_price),
      is_new: item.is_new,
      created_at: item.inventory_time
    }))
    const totalPages = Math.ceil(total / pageSize)
    return {
      success: true,
      data,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    }
  }

  async detail(id) {
    if (!id || isNaN(id)) throw new InventoryError('无效的商品ID', 400)
    const item = await this.repository.withConnection(connection => this.repository.detail(connection, parseInt(id)))
    if (!item) throw new InventoryError('商品不存在', 404)
    return {
      id: item.id,
      brand_id: item.brand_id || null,
      model_id: item.model_id || null,
      color_id: item.color_id || null,
      memory_id: item.memory_id || null,
      brand: item.brand || '',
      model: item.model || '',
      color: item.color || '',
      memory: item.memory || '',
      imei: item.imei || '',
      serial_number: item.serial_number || '',
      purchase_cost: item.purchase_cost ?? null,
      sale_price: item.sale_price ?? null,
      price: item.sale_price ?? 0,
      supplier_id: item.supplier_id || null,
      store_id: item.store_id || null,
      inventory_time: item.inventory_time,
      condition: Number(item.is_new) === 1 ? 'new' : 'used',
      quality_grade: item.quality_grade,
      purchase_remarks: item.purchase_remarks || '',
      remarks: item.purchase_remarks || '',
      is_new: item.is_new,
      status: item.status === 'in_stock' && Number(item.is_preordered) === 1 ? 'reserved' : item.status,
      is_preordered: Number(item.is_preordered) === 1,
      sale_time: item.sale_time,
      supplier_name: item.supplier_name || '',
      store_name: item.store_name || '',
      operator_name: item.operator_name || ''
    }
  }

  async remove(id) {
    if (!id || isNaN(id)) throw new InventoryError('无效的商品ID', 400)
    return this.repository.withConnection(async connection => {
      try {
        await connection.beginTransaction()
        const item = await this.repository.findForRemoval(connection, id)
        if (!item) throw new InventoryError('商品不存在', 404)
        if (COMPLETED_TRANSACTION_STATUSES.includes(item.status) || Number(item.is_preordered) === 1) {
          throw new InventoryError(Number(item.is_preordered) === 1
            ? '预订设备不能直接删除，请先取消或重新匹配预定单'
            : '已完成交易的商品不能从库存台账删除', 400)
        }
        const related = await this.repository.relatedCounts(connection, id)
        const labels = [
          ['rental', '租借记录'], ['sale', '销售记录'], ['repair', '维修记录']
        ].filter(([key]) => related[key] > 0).map(([key, label]) => `${label}(${related[key]}条)`)
        if (labels.length) {
          throw new InventoryError(`无法删除商品：存在关联的${labels.join('、')}。请先处理这些关联记录后再删除商品。`, 400)
        }
        if (!await this.repository.deletePhone(connection, id)) {
          throw new InventoryError('删除失败，商品可能已被删除', 500)
        }
        await connection.commit()
        return { id: parseInt(id), deleted: true, item: { id: item.id, imei: item.imei } }
      } catch (error) {
        await connection.rollback()
        throw error
      }
    })
  }

  async update(id, body = {}) {
    if (!id || isNaN(id)) throw new InventoryError('无效的商品ID', 400)
    const { Inventorytime: legacyInventoryTime, ...requestData } = body
    const updateData = { ...requestData, inventory_time: requestData.inventory_time ?? legacyInventoryTime }
    return this.repository.withConnection(async connection => {
      try {
        await connection.beginTransaction()
        const item = await this.repository.findForUpdate(connection, id)
        if (!item) throw new InventoryError('商品不存在', 404)
        if (updateData.imei && updateData.imei !== item.imei
          && await this.repository.phoneImeiExists(connection, updateData.imei, id)) {
          throw new InventoryError('该IMEI号已被其他商品使用', 400)
        }
        const includeSupplier = !updateData.supplier_id || await this.repository.referenceExists(connection, 'suppliers', updateData.supplier_id)
        const includeStore = !updateData.store_id || await this.repository.referenceExists(connection, 'stores', updateData.store_id)
        const fields = {
          imei: updateData.imei,
          serial_number: updateData.serial_number,
          purchase_cost: updateData.price,
          sale_price: updateData.price * 1.2,
          ...(includeSupplier && { supplier_id: updateData.supplier_id }),
          ...(includeStore && { store_id: updateData.store_id }),
          inventory_time: updateData.inventory_time,
          is_new: updateData.is_new
        }
        const result = await this.repository.updatePhone(connection, id, fields)
        if (!result.query) throw new InventoryError('没有有效的更新字段', 400)
        if (!result.affectedRows) throw new InventoryError('更新失败，商品可能已被删除', 500)
        await connection.commit()
        return await this.repository.updatedPhone(connection, id)
      } catch (error) {
        await connection.rollback()
        throw error
      }
    })
  }

  async quickSale(body = {}, actor) {
    const inventoryOperatorId = this.getActorId(actor)
    const {
      brand_id, model_id, color_id, memory_id, is_new, imei, serial_number,
      supplier_id, store_id, purchase_cost, sale_price, customer_name,
      customer_phone, apple_id, inventory_time, sale_time, sale_operator_id,
      payment_method, payment_channel, status = 'sold', remarks
    } = body
    const transactionConfig = TRANSACTION_CONFIG[status]
    if (!transactionConfig) throw new InventoryError('请选择销售、批发调货或划拨', 400)
    if (![brand_id, model_id, color_id, memory_id].every(id => Number.isInteger(id) && id > 0)) {
      throw new InventoryError('设备信息不完整，请选择有效的品牌、型号、颜色和内存', 400)
    }
    if (!serial_number) throw new InventoryError('序列号不能为空', 400)
    if (!imei || typeof imei !== 'string') throw new InventoryError('IMEI不能为空', 400)
    const imeiValidation = this.validateImei(imei, serial_number)
    const { normalizedImei, normalizedSerialNumber } = imeiValidation
    if (!imeiValidation.valid) throw new InventoryError(imeiValidation.reason, 400)
    if (!supplier_id || !store_id) throw new InventoryError('供应商和店铺不能为空', 400)

    const requestedPurchaseCost = purchase_cost === null || purchase_cost === undefined ? null : Number(purchase_cost)
    const requestedSalePrice = sale_price === null || sale_price === undefined ? null : Number(sale_price)
    const purchaseCost = status === 'supplier_proxy' ? 0 : requestedPurchaseCost
    const salePrice = status === 'supplier_proxy' ? 0 : requestedSalePrice
    if (purchaseCost !== null && (!Number.isFinite(purchaseCost) || purchaseCost < 0)) throw new InventoryError('入库价格不能为负数', 400)
    if (status !== 'supplier_proxy' && (!Number.isFinite(salePrice) || salePrice <= 0)) {
      throw new InventoryError(status === 'peer_transfer' ? '批发价格必须大于0' : '销售价格必须大于0', 400)
    }
    if (status === 'peer_transfer' && (!Number.isFinite(purchaseCost) || purchaseCost < 0)) {
      throw new InventoryError('批发调货必须填写有效的入库成本', 400)
    }
    if (!customer_phone) throw new InventoryError('客户手机号不能为空', 400)
    if (status === 'sold' && !['cash', 'mobile', 'bank_card', 'subsidy_card'].includes(payment_method)) {
      throw new InventoryError('请选择有效的支付方式', 400)
    }
    const saleOperatorId = Number(sale_operator_id)
    if (!Number.isInteger(saleOperatorId) || saleOperatorId <= 0) throw new InventoryError('请选择有效的销售员', 400)
    const allowedPaymentChannels = {
      cash: [null], mobile: ['wechat', 'alipay'],
      bank_card: ['card_consumption', 'bank_transfer'], subsidy_card: ['subsidy_card']
    }
    const normalizedPaymentChannel = status !== 'sold' || payment_method === 'cash' ? null : String(payment_channel || '')
    if (status === 'sold' && !allowedPaymentChannels[payment_method].includes(normalizedPaymentChannel)) {
      throw new InventoryError('请选择有效的支付渠道', 400)
    }
    const normalizedAppleId = String(apple_id || '').trim() || null

    return this.repository.withConnection(async connection => {
      try {
        await this.prepareInvoiceNumberTransaction(connection)
        await connection.beginTransaction()
        const validReferences = await this.repository.validateQuickSaleReferences(connection, {
          brandId: brand_id, modelId: model_id, colorId: color_id, memoryId: memory_id
        })
        if (!validReferences) throw new InventoryError('品牌、型号、颜色或内存不存在或已停用', 400)
        const existingCustomer = await this.repository.findCustomer(connection, customer_phone)
        const customerId = existingCustomer
          ? existingCustomer.id
          : await this.repository.createCustomer(connection, {
            name: customer_name || '',
            phone: customer_phone,
            appleId: normalizedAppleId,
            memberNumber: await this.generateMemberNumber({ connection })
          })
        if (existingCustomer) {
          await this.repository.updateCustomer(connection, {
            name: customer_name || '', appleId: normalizedAppleId, customerId
          })
        }
        if (await this.repository.hasCustomerPhoneDuplicate(connection, { imei: normalizedImei, customerId })) {
          throw new InventoryError('该客户已存在相同IMEI的手机', 400)
        }
        if (await this.repository.quickSaleImeiExists(connection, normalizedImei)) {
          this.logger.debug(`IMEI ${normalizedImei} 已存在于其他客户，允许当前客户使用相同IMEI`)
        }

        const purchaseNumber = `QS${Date.now()}`
        const inventoryTime = this.normalizeDateTime(inventory_time, false)
        const saleTime = this.normalizeDateTime(sale_time, false)
        if (!inventoryTime || !saleTime) throw new InventoryError('请选择有效的入库日期和销售日期', 400)
        const invoiceNumber = await this.generateInvoiceNumber(transactionConfig.invoiceType, connection, saleTime)
        const effectiveIsNew = is_new !== undefined ? is_new : 1
        const phoneId = await this.repository.createQuickSalePhone(connection, [
          purchaseNumber, inventoryOperatorId, brand_id, model_id, color_id, memory_id,
          normalizedImei, normalizedSerialNumber, purchaseCost, salePrice, effectiveIsNew,
          supplier_id, store_id, transactionConfig.phoneStatus, is_new === 1 ? 'A' : 'B',
          remarks || null, inventoryTime, saleTime, saleOperatorId, status === 'sold' ? payment_method : null
        ])
        const saleId = await this.repository.createQuickSale(connection, [
          phoneId, customerId, transactionConfig.saleType, saleOperatorId, store_id,
          salePrice, purchaseCost, status === 'sold' ? payment_method : null,
          normalizedPaymentChannel, invoiceNumber, saleTime, remarks || null
        ])
        await this.repository.updateQuickSalePhone(connection, [
          saleId, status === 'peer_transfer' ? saleTime : null,
          status === 'peer_transfer' ? salePrice : 0, phoneId
        ])
        if (status === 'sold') {
          await this.repository.createQuickSalePayment(connection, [
            saleId, customerId, payment_method, normalizedPaymentChannel,
            salePrice, saleTime, '快速出库销售收款'
          ])
        }
        const points = await this.reconcileCustomerPointsForSale({
          executor: connection, saleId, customerId,
          saleType: transactionConfig.saleType, salePrice, isNew: effectiveIsNew, initialize: true
        })
        await connection.commit()
        return {
          phone_id: phoneId, sale_id: saleId, imei: normalizedImei, customer_name,
          purchase_cost: purchaseCost, sale_price: salePrice, invoice_number: invoiceNumber,
          inventory_time: inventoryTime, sale_time: saleTime, sale_operator_id: saleOperatorId,
          payment_method, payment_channel: normalizedPaymentChannel,
          status: transactionConfig.phoneStatus, sale_type: transactionConfig.saleType,
          points_earned: points.points
        }
      } catch (error) {
        await connection.rollback()
        throw error
      }
    })
  }

  async overview(query = {}) {
    if (!this.connected()) throw new InventoryError('数据库未连接', 500)
    const filters = this.repository.listFilters(query)
    const result = await this.repository.overview(this.database(), filters)
    const stats = result.stats
    return {
      total: parseInt(stats.total) || 0,
      new_count: parseInt(stats.new_count) || 0,
      used_count: parseInt(stats.used_count) || 0,
      total_value: parseFloat(stats.total_value) || 0,
      by_store: result.stores.reduce((acc, row) => {
        acc[row.store_name || '未知店铺'] = row.count
        return acc
      }, {}),
      by_brand: result.brands.reduce((acc, row) => {
        acc[row.brand_name || '未知品牌'] = row.count
        return acc
      }, {})
    }
  }

  async stats() {
    if (!this.connected()) throw new InventoryError('数据库未连接', 500)
    const stats = await this.repository.stats(this.database())
    return { ...stats, totalValue: parseFloat(stats.totalValue) || 0 }
  }
}

module.exports = InventoryService
