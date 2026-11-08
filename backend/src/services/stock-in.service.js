'use strict'

const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')
const BaseService = require('../core/base/base.service')
const StockInRepository = require('../repositories/stock-in.repository')
const { validateImei: validateImeiUtil } = require('../utils/imei')
const { prepareInvoiceNumberTransaction: prepareInvoiceNumbersUtil, generatePurchaseNumber: generatePurchaseNumberUtil } = require('../utils/invoice-number')
const { assertStoreInScope, resolveStoreScope } = require('../utils/store-scope')
const log = require('../utils/log')
const MAX_STOCK_IN_PRODUCTS = 200

class StockInService extends BaseService {
  constructor({ database = getDatabase, logger = log, repository = new StockInRepository(), validateImei = validateImeiUtil, prepareInvoiceNumbers = prepareInvoiceNumbersUtil, generatePurchaseNumber = generatePurchaseNumberUtil } = {}) {
    super()
    Object.assign(this, { database, logger, repository, validateImei, prepareInvoiceNumbers, generatePurchaseNumber })
  }
  static formatRecord(record) {
    return {
      id: record.id,
      phone_id: record.id,
      imei: record.imei,
      serial_number: record.serial_number,
      purchase_cost: record.purchase_cost === null || record.purchase_cost === undefined ? null : Number(record.purchase_cost),
      store_id: record.store_id,
      store_name: record.store_name,
      supplier_id: record.supplier_id,
      supplier_name: record.supplier_name,
      inventory_operator_id: record.inventory_operator_id,
      operator_name: record.operator_name,
      operator_username: record.operator_username,
      status: record.status,
      is_new: record.is_new,
      inventory_time: record.inventory_time,
      purchase_number: record.purchase_number,
      remarks: record.remarks,
      sale_time: record.sale_time,
      payment_status: record.payment_status,
      payment_time: record.payment_time,
      brand_name: record.brand_name,
      model_name: record.model_name,
      color_name: record.color_name,
      memory_name: record.memory_name,
      condition: Number(record.is_new) === 1 ? 'new' : 'used',
      product_type: 'phone',
      product_name: [record.brand_name, record.model_name].filter(Boolean).join(' ') || null,
      quantity: 1,
      operation_type: 'in',
      reason: '采购入库',
      is_settled: record.payment_status === 'paid' ? 1 : 0,
      reference_type: 'purchase',
      reference_id: record.purchase_number
    }
  }
  list(actor, query) {
    return withConnection(this.database, async connection => {
      const { records, total, page, page_size } = await this.repository.list(connection, actor, query)
      return { records: records.map(StockInService.formatRecord), pagination: { page, page_size, total, total_pages: Math.ceil(total / page_size), has_next: page * page_size < total, has_prev: page > 1 } }
    })
  }
  detail(actor, query, id) {
    return withConnection(this.database, async connection => {
      const record = await this.repository.detail(connection, actor, query, id)
      if (!record) throw this.createError('入库记录不存在', 404)
      return StockInService.formatRecord(record)
    })
  }
  overview(actor, query) { return withConnection(this.database, connection => this.repository.overview(connection, actor, query)) }

  create(actor, body) {
    return withConnection(this.database, async connection => {
      let transactionStarted = false
      try {
        const {
          supplier_id,
          store_id,
          inventory_time,
          operator_name,
          condition,
          products,
          remarks
        } = body

        const inventoryTime = inventory_time
        const finalRemarks = remarks ?? ''

        // 统一使用当前登录用户作为入库操作员，不再回退到固定管理员ID
        const currentUser = actor || {}
        if (!(currentUser.id || currentUser.sub)) {
          throw this.createError('用户未登录或登录已失效', 401)
        }

        const currentUserId = this.getActorId(currentUser)
        const inventoryOperatorId = currentUserId
        let actualOperatorName = operator_name?.trim()

        const [userResult] = await this.repository.findOperator(connection, [currentUserId])

        if (userResult.length > 0) {
          const user = userResult[0]
          actualOperatorName = user.name || user.username || actualOperatorName
        }

        // 数据验证
        if (!supplier_id) {
          throw this.createError('请选择供应商', 400)
        }

        if (!store_id) {
          throw this.createError('请选择店铺', 400)
        }
        const storeScope = resolveStoreScope(actor, store_id)
        const normalizedStoreId = assertStoreInScope(storeScope, store_id)

        if (!inventoryTime) {
          throw this.createError('请选择入库时间', 400)
        }

        if (!operator_name?.trim()) {
          throw this.createError('操作员不能为空', 400)
        }

        if (!condition || !['全新', '二手'].includes(condition)) {
          throw this.createError('请选择商品状态', 400)
        }

        if (!products || !Array.isArray(products) || products.length === 0) {
          throw this.createError('商品列表不能为空', 400)
        }
        if (products.length > MAX_STOCK_IN_PRODUCTS) {
          throw this.createError(`单次最多入库 ${MAX_STOCK_IN_PRODUCTS} 件商品`, 400)
        }

        const submittedImeis = new Set()
        // 验证每个商品
        for (let i = 0; i < products.length; i++) {
          const product = products[i]

          if (!product.brand_id) {
            throw this.createError(`第${i + 1}行商品请选择品牌`, 400)
          }

          if (!product.model_id) {
            throw this.createError(`第${i + 1}行商品请选择型号`, 400)
          }

          if (!product.color_id) {
            throw this.createError(`第${i + 1}行商品请选择颜色`, 400)
          }

          if (!product.memory_id) {
            throw this.createError(`第${i + 1}行商品请选择内存`, 400)
          }

          // IMEI验证：如果是15位纯数字，或与序列号相同（无IMEI设备如iPad、手表等）
          if (!product.imei) {
            throw this.createError(`第${i + 1}行商品请输入IMEI号`, 400)
          }
          const imeiValidation = this.validateImei(product.imei, product.serial_number)
          if (!imeiValidation.valid) {
            throw this.createError(`第${i + 1}行商品IMEI号必须为15位数字，或与序列号相同（无IMEI设备）`, 400)
          }

          product.imei = imeiValidation.normalizedImei
          product.serial_number = imeiValidation.normalizedSerialNumber
          if (submittedImeis.has(product.imei)) {
            throw this.createError(`第${i + 1}行商品IMEI号在本次入库中重复`, 400)
          }
          submittedImeis.add(product.imei)

          if (product.serial_number && product.serial_number.length > 50) {
            throw this.createError(`第${i + 1}行商品序列号最长50位`, 400)
          }

          if (!product.purchase_cost || product.purchase_cost <= 0) {
            throw this.createError(`第${i + 1}行商品请输入有效的入库价格`, 400)
          }
        }

        // 先完成序列表结构预检，再在入库事务内锁定并分配北京时间日序号。
        // 开始事务
        await this.prepareInvoiceNumbers(connection)
        await connection.beginTransaction()
        transactionStarted = true

        const purchase_number = await this.generatePurchaseNumber(connection)
        const insertedProducts = []

        const [brandMap, modelMap, colorMap, memoryMap, existingPhoneRows] = await Promise.all([
          this.repository.loadReferenceMap(connection, 'brands', 'name', products.map(product => product.brand_id)),
          this.repository.loadReferenceMap(connection, 'models', 'name', products.map(product => product.model_id)),
          this.repository.loadReferenceMap(connection, 'colors', 'name', products.map(product => product.color_id)),
          this.repository.loadReferenceMap(connection, 'memories', 'size', products.map(product => product.memory_id)),
          this.repository.findExistingPhones(connection, products).then(([rows]) => rows)
        ])
        const existingPhonesByImei = new Map(existingPhoneRows.map(row => [String(row.imei), row]))

        // 批量插入每个商品
        for (let i = 0; i < products.length; i++) {
          const product = products[i]

          const brandName = brandMap.get(Number(product.brand_id)) || ''
          const modelName = modelMap.get(Number(product.model_id)) || ''
          const colorName = colorMap.get(Number(product.color_id)) || ''
          const memoryName = memoryMap.get(Number(product.memory_id)) || ''
          if (!brandName || !modelName || !colorName || !memoryName) {
            throw new Error(`第${i + 1}行商品的品牌、型号、颜色或内存不存在`)
          }

          // 只有在库状态才报错，已售出的商品可以回收后重新入库
          const existingPhone = existingPhonesByImei.get(product.imei)
          if (existingPhone) {
            if (existingPhone.status === 'in_stock') {
              throw this.createError(`第${i + 1}行商品IMEI号已在库中，无法重复入库`, 400)
            }
            // 如果是已售出或其他状态，允许重新入库（回收商品）
            log.debug(`ℹ️  IMEI ${product.imei} 已存在但状态为 ${existingPhone.status}，允许回收入库`)
          }

          // 插入phones表 - 使用基本的必需字段
          // 确保所有ID字段都有效，如果为null则设为null
          const insertValues = [
            purchase_number,
            inventoryOperatorId, // 记录入库操作员ID
            product.brand_id || null,
            product.model_id || null,
            product.color_id || null,
            product.memory_id || null,
            product.imei,
            product.serial_number || '',
            product.purchase_cost,
            // sale_price: 如果前端传了 sale_price 则使用，否则为 null（显示"电询"）
            (product.sale_price !== undefined && product.sale_price !== null && product.sale_price > 0)
              ? product.sale_price
              : null,
            condition === '全新' ? 1 : 0,
            supplier_id,
            normalizedStoreId,
            'in_stock',
            condition === '全新' ? 'A' : 'B', // quality_grade
            finalRemarks,
            inventoryTime,
            null  // sale_time 在入库时为空
          ]

          log.debug('📝 插入phones表的数据:', {
            purchase_number,
            inventoryOperatorId,
            brand_id: product.brand_id,
            model_id: product.model_id,
            color_id: product.color_id,
            memory_id: product.memory_id,
            imei: product.imei
          })

          const [insertResult] = await this.repository.insertPhone(connection, insertValues)

          const phoneId = insertResult.insertId

          // 如果是二手商品，同时创建 H5_product 记录
          if (condition === '二手') {
            const isPublished = product.is_published !== undefined ? product.is_published : 1
            await this.repository.publishUsedPhone(connection, [phoneId, isPublished])
            log.debug(`✅ 创建 H5_product 记录: phone_id=${phoneId}, is_published=${isPublished}`)
          }

          insertedProducts.push({
            id: phoneId,
            brand_id: product.brand_id || null,
            model_id: product.model_id || null,
            color_id: product.color_id || null,
            memory_id: product.memory_id || null,
            store_id: normalizedStoreId,
            brand_name: brandName,
            model_name: modelName,
            color_name: colorName,
            memory_name: memoryName,
            imei: product.imei,
            serial_number: product.serial_number,
            purchase_cost: product.purchase_cost,
            is_new: condition === '全新' ? 1 : 0
          })
        }

        // 检查是否有匹配的待匹配预定单，并自动匹配
        const autoMatchedPreorders = []

        for (const product of insertedProducts) {
          const brandId = product.brand_id || null
          const modelId = product.model_id || null
          const colorId = product.color_id || null
          const memoryId = product.memory_id || null

          // 锁定同门店最早待匹配预订单，确保并发入库只能匹配一次。
          const [preorderResult] = await this.repository.findPendingPreorder(connection, [normalizedStoreId, brandId, modelId, colorId, memoryId, product.is_new])

          if (preorderResult.length > 0) {
            const preorder = preorderResult[0]

            const [preorderUpdate] = await this.repository.matchPreorder(connection, [product.id, product.imei, preorder.id])
            if (preorderUpdate.affectedRows !== 1) {
              throw new Error(`预订单 ${preorder.preorder_number} 已被其他入库操作匹配`)
            }

            const [phoneUpdate] = await this.repository.markPreorderedPhone(connection, [product.id])
            if (phoneUpdate.affectedRows !== 1) {
              throw new Error(`入库商品 ${product.imei} 的预订状态更新失败`)
            }

            autoMatchedPreorders.push({
              preorder_id: preorder.id,
              preorder_number: preorder.preorder_number,
              customer_name: preorder.customer_name,
              phone_id: product.id,
              imei: product.imei
            })

            log.debug(`✅ 自动匹配预定单: ${preorder.preorder_number} -> IMEI: ${product.imei}`)
          }
        }

        // 入库与自动匹配在同一事务中提交，任何一步失败都不产生半完成数据。
        await connection.commit()
        transactionStarted = false

        // 构建响应数据
        const responseData = {
          purchase_number,
          supplier_id,
          store_id: normalizedStoreId,
          inventory_time: inventoryTime,
          operator_name: actualOperatorName,
          condition,
          products: insertedProducts,
          total_count: products.length,
          total_amount: products.reduce((sum, product) => sum + Number(product.purchase_cost), 0),
          remarks: finalRemarks
        }

        // 如果有自动匹配的预定单，添加到响应中
        if (autoMatchedPreorders.length > 0) {
          responseData.auto_matched_preorders = autoMatchedPreorders
          responseData.has_auto_matched = true
        }

        // 返回成功结果
        const successMessage = autoMatchedPreorders.length > 0
          ? `商品入库成功，已自动匹配 ${autoMatchedPreorders.length} 个预定单`
          : '商品入库成功'

        return { data: responseData, message: successMessage }

      } catch (error) {
        if (transactionStarted) {
          await connection.rollback().catch(rollbackError => this.logger.error('回滚入库操作失败:', rollbackError))
          transactionStarted = false
        }
        throw error
      } finally {
        if (transactionStarted) await connection.rollback().catch(() => {})
      }
    })
  }

  update(actor, id, body) {
    return withConnection(this.database, async connection => {
      let transactionStarted = false
      try {
        const storeScope = resolveStoreScope(actor, null)
        await connection.beginTransaction()
        transactionStarted = true

        const [existingRecords] = await this.repository.lockPhone(connection, [id])
        if (existingRecords.length === 0) throw this.createError('入库记录不存在', 404)
        assertStoreInScope(storeScope, existingRecords[0].store_id)

        const updateData = body
        const updateFields = []
        const updateValues = []
        const fieldMap = [
          ['brand_id', 'brand_id'],
          ['model_id', 'model_id'],
          ['color_id', 'color_id'],
          ['memory_id', 'memory_id'],
          ['imei', 'imei'],
          ['serial_number', 'serial_number'],
          ['purchase_cost', 'purchase_cost'],
          ['inventory_time', 'inventory_time'],
          ['sale_price', 'sale_price']
        ]

        for (const [inputField, column] of fieldMap) {
          if (updateData[inputField] !== undefined) {
            updateFields.push(`${column} = ?`)
            updateValues.push(updateData[inputField])
          }
        }

        if (updateData.is_new !== undefined) {
          const isNew = updateData.is_new === '全新'
            ? 1
            : updateData.is_new === '二手'
              ? 0
              : updateData.is_new
          updateFields.push('is_new = ?')
          updateValues.push(isNew)
        }
        if (updateData.status !== undefined) {
          updateFields.push('status = ?')
          updateValues.push(updateData.status)
        }
        if (updateData.store_id !== undefined) {
          updateFields.push('store_id = ?')
          updateValues.push(assertStoreInScope(storeScope, updateData.store_id))
        }
        if (updateData.supplier_id !== undefined) {
          updateFields.push('supplier_id = ?')
          updateValues.push(updateData.supplier_id)
        }
        if (updateData.remarks !== undefined) {
          updateFields.push('remarks = ?')
          updateValues.push(updateData.remarks)
        }
        if (updateFields.length === 0) throw this.createError('没有提供要更新的字段', 400)

        await this.repository.updateRecord(connection, id, storeScope, updateFields, updateValues)

        const [updatedRecords] = await this.repository.getUpdatedRecord(connection, [id])

        await connection.commit()
        transactionStarted = false
        return updatedRecords[0]

      } catch (error) {
        if (transactionStarted) {
          await connection.rollback().catch(rollbackError => this.logger.error('回滚入库操作失败:', rollbackError))
          transactionStarted = false
        }
        throw error
      } finally {
        if (transactionStarted) await connection.rollback().catch(() => {})
      }
    })
  }

  remove(actor, id, query) {
    const storeScope = resolveStoreScope(actor, query.store_id)
    return withConnection(this.database, async connection => {
      let transactionStarted = false
      try {
        await connection.beginTransaction()
        transactionStarted = true

        const [existingRecords] = await this.repository.lockPhone(connection, [id])
        if (existingRecords.length === 0) throw this.createError('入库记录不存在', 404)
        assertStoreInScope(storeScope, existingRecords[0].store_id)

        const [deleteResult] = await this.repository.deleteScoped(connection, id, storeScope)
        if (deleteResult.affectedRows !== 1) {
          throw new Error('入库记录已变化或不在授权门店范围内，请刷新后重试')
        }

        await connection.commit()
        transactionStarted = false
        return {
          id: parseInt(id),
          deleted: true
        }

      } catch (error) {
        if (transactionStarted) {
          await connection.rollback().catch(rollbackError => this.logger.error('回滚入库操作失败:', rollbackError))
          transactionStarted = false
        }
        throw error
      } finally {
        if (transactionStarted) await connection.rollback().catch(() => {})
      }
    })
  }
}
module.exports = StockInService
