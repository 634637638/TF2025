'use strict'

const { clearCache } = require('../middleware/cache')
const { generateMemberNumber } = require('../utils/member-number')
const { reconcileCustomerPointsForSale } = require('./customer-points.service')
const { validateImei } = require('../utils/imei')
const { prepareInvoiceNumberTransaction, generateInvoiceNumber } = require('../utils/invoice-number')
const { formatLocalDate } = require('../utils/time')
const log = require('../utils/log')
const { hasUnifiedPermission } = require('../middleware/unified-auth')
const { normalizePhoneStatus } = require('../utils/phone-status')
const PhoneUpdateRepository = require('../repositories/phone-update.repository')
const syncPhoneMediaDirectory = require('./phone-media-directory.service')

class PhoneUpdateService {
  constructor({ repository = new PhoneUpdateRepository(), permissionCheck = hasUnifiedPermission, logger = log } = {}) {
    this.repository = repository
    this.permissionCheck = permissionCheck
    this.logger = logger
  }

  async update(req) {
    let transactionStarted = false
    let rollbackMediaDirectory = null
    let finalizeMediaDirectory = null
    try {
      const { id } = req.params
  
      const {
        brand_id,
        model_id,
        color_id,
        memory_id,
        supplier_id,
        store_id,
        condition,
        imei,
        serial_number,
        purchase_cost,
        sale_price,
        purchase_operator_id,
        sale_operator_id,
        inventory_time,
        sale_time,
        payment_method,
        payment_channel,
        // 客户信息字段 - 使用customer_id关联customers表
        customer_id,
        customer_name,       // 客户姓名
        customer_phone,      // 客户手机号
        apple_id,            // Apple ID
        status,               // 状态字段 (in_stock, sold, peer_transfer, supplier_proxy等)
        remarks
      } = req.body
  
      // 获取数据库连接
      return await this.repository.withConnection(async connection => {
        try {
  
          // 先读取当前记录。编辑请求可能只提交被修改的字段，未提交字段必须保留原值。
          const currentPhone = await this.repository.getPhoneForUpdate(connection, id)
  
          if (!currentPhone) {
            const error = new Error('手机不存在')
            error.status = 404
            throw error
          }
  
          const valueOrCurrent = (value, currentValue) => (
            value === undefined ? currentValue : value
          )
          const effectiveBrandId = valueOrCurrent(brand_id, currentPhone.brand_id)
          const effectiveModelId = valueOrCurrent(model_id, currentPhone.model_id)
          const effectiveColorId = valueOrCurrent(color_id, currentPhone.color_id)
          const effectiveMemoryId = valueOrCurrent(memory_id, currentPhone.memory_id)
          const effectiveStoreId = valueOrCurrent(store_id, currentPhone.store_id)
          const effectiveImei = valueOrCurrent(imei, currentPhone.imei)
          const effectiveSerialNumber = valueOrCurrent(serial_number, currentPhone.serial_number)
          const effectiveCondition = valueOrCurrent(
            condition,
            Number(currentPhone.is_new) === 1 ? 'new' : 'used'
          )
          const effectiveSupplierId = valueOrCurrent(supplier_id, currentPhone.supplier_id)
          const effectivePurchaseCost = valueOrCurrent(purchase_cost, currentPhone.purchase_cost)
          const effectiveSalePrice = valueOrCurrent(sale_price, currentPhone.sale_price)
          const effectiveInventoryTime = valueOrCurrent(inventory_time, currentPhone.inventory_time)
          const effectiveSaleTime = valueOrCurrent(sale_time, currentPhone.sale_time)
          const effectiveStatus = normalizePhoneStatus(valueOrCurrent(status, currentPhone.status))
          const finalNotes = valueOrCurrent(remarks, currentPhone.remarks) ?? ''

          if (payment_method !== undefined && ['sold', 'peer_transfer'].includes(effectiveStatus)) {
            const allowedChannels = {
              cash: [null],
              mobile: ['wechat', 'alipay'],
              bank_card: ['card_consumption', 'bank_transfer'],
              subsidy_card: ['subsidy_card']
            }
            const normalizedMethod = payment_method || null
            const normalizedChannel = payment_channel || null
            if (!normalizedMethod || !allowedChannels[normalizedMethod]) {
              throw new Error('请选择有效的支付方式')
            }
            if (!allowedChannels[normalizedMethod].includes(normalizedChannel)) {
              throw new Error('请选择有效的支付渠道')
            }
          }
  
          if (status && effectiveStatus !== normalizePhoneStatus(currentPhone.status)) {
            if (effectiveStatus === 'rented') {
              throw new Error('请在租赁管理创建按天租赁合同后设置租赁状态')
            }
            if (normalizePhoneStatus(currentPhone.status) === 'rented') {
              throw new Error('租赁中的设备请在租赁管理完成归还后再修改状态')
            }
          }
  
          if (!effectiveBrandId || !effectiveModelId || !effectiveColorId || !effectiveMemoryId) {
            throw new Error('品牌、型号、颜色和内存必须使用有效的数据库 ID')
          }
          if (!effectiveStoreId) {
            throw new Error('缺少店铺字段')
          }
          if (!effectiveImei) {
            throw new Error('缺少IMEI号')
          }
  
          const imeiValidation = validateImei(effectiveImei, effectiveSerialNumber)
          if (!imeiValidation.valid) {
            throw new Error(imeiValidation.reason)
          }
  
          const normalizedImei = imeiValidation.normalizedImei
          const normalizedSerialNumber = imeiValidation.normalizedSerialNumber || null
  
          // 打印调试信息
          log.debug('📝 收到的更新数据:', {
            id,
            brand_id: effectiveBrandId,
            model_id: effectiveModelId,
            color_id: effectiveColorId,
            memory_id: effectiveMemoryId,
            store_id: effectiveStoreId,
            imei: normalizedImei
          })
  
          // 检查IMEI是否重复（排除当前手机）
          // 只有当同一客户拥有相同IMEI时才报错，不同客户可以有相同IMEI
          let shouldRejectImei = false
  
          const duplicateImei = await this.repository.findDuplicateImei(connection, normalizedImei, id)
  
          if (duplicateImei.length > 0) {
            // 检查是否有相同客户的重复IMEI
            for (const dup of duplicateImei) {
              if (dup.customer_id === customer_id) {
                shouldRejectImei = true
                break
              }
            }
  
            if (shouldRejectImei) {
              throw new Error('该客户已存在相同IMEI的手机')
            }
            // 如果客户不同，允许相同IMEI（不同客户可以拥有相同IMEI的手机）
            log.debug(`ℹ️ IMEI ${normalizedImei} 已存在于其他客户，允许继续`)
          }
  
          const brandId = Number(effectiveBrandId)
          const modelId = Number(effectiveModelId)
          const colorId = Number(effectiveColorId)
          const memoryId = Number(effectiveMemoryId)
          const storeId = Number(effectiveStoreId)
          if (![brandId, modelId, colorId, memoryId, storeId].every(Number.isInteger)) {
            throw new Error('品牌、型号、颜色和内存 ID 无效')
          }
  
          // 获取对应的inventory_operator_id
          let inventoryOperatorId = null
          // 直接使用前端发送的操作员ID
          if (purchase_operator_id) {
            inventoryOperatorId = purchase_operator_id
            log.debug(`✅ 使用前端发送的入库员ID: ${inventoryOperatorId}`)
          } else {
            // 如果前端没有发送操作员ID，保持原有的操作员ID不变
            const currentPhoneRows = currentPhone
            if (currentPhoneRows) {
              inventoryOperatorId = currentPhoneRows.inventory_operator_id
              log.debug(`🔧 保持原有入库员ID: ${inventoryOperatorId}`)
            }
          }
  
          // 获取对应的sale_operator_id
          let saleOperatorId = null
          // 直接使用前端发送的销售员ID
          if (sale_operator_id) {
            saleOperatorId = sale_operator_id
            log.debug(`✅ 使用前端发送的销售员ID: ${saleOperatorId}`)
          } else {
            // 如果前端没有发送销售员ID，保持原有的销售员ID不变
            const currentPhoneRows = currentPhone
            if (currentPhoneRows) {
              saleOperatorId = currentPhoneRows.sale_operator_id
              log.debug(`🔧 保持原有销售员ID: ${saleOperatorId}`)
            }
          }
  
          // 构建动态更新SQL语句 - 不更新phones表的customer_id，只更新sales表
          const updateFields = [
            'brand_id = ?',
            'model_id = ?',
            'color_id = ?',
            'memory_id = ?',
            'store_id = ?',
            'imei = ?',
            'serial_number = ?',
            'purchase_cost = ?', // 只更新purchase_cost字段（真正的成本价）
            'sale_price = ?',     // 更新销售价格字段
            'is_new = ?',         // 更新全新/二手状态 (1=全新, 0=二手)
            'quality_grade = ?',
            'supplier_id = ?',
            'inventory_operator_id = ?', // 更新入库员ID
            'sale_operator_id = ?', // 更新销售员ID
            'remarks = ?',
            'inventory_time = ?',
            'sale_time = ?'
          ]
  
          // 如果提供了status字段，添加到更新列表
          if (status) {
            updateFields.push('status = ?')
          }
  
          const finalPurchaseCost = effectivePurchaseCost === null || effectivePurchaseCost === undefined || effectivePurchaseCost === ''
            ? null
            : Number(effectivePurchaseCost)
          let finalSalePrice = effectiveSalePrice === null || effectiveSalePrice === undefined || effectiveSalePrice === ''
            ? null
            : Number(effectiveSalePrice)
          if ([finalPurchaseCost, finalSalePrice].some(value => value !== null && !Number.isFinite(value))) {
            throw new Error('价格字段必须是有效数字')
          }
          const transactionTypeByStatus = {
            sold: 'retail',
            peer_transfer: 'wholesale',
            supplier_proxy: 'supplier_proxy'
          }
          const targetSaleType = transactionTypeByStatus[effectiveStatus]
          const isTransactionTypeChange = Boolean(
            status && targetSaleType && effectiveStatus !== normalizePhoneStatus(currentPhone.status)
          )
  
          if (isTransactionTypeChange) {
            const requiredPermission = {
              retail: ['sales:sell', 'business'],
              wholesale: ['sales:wholesale', 'business'],
              supplier_proxy: ['sales:proxy-transfer', 'business']
            }[targetSaleType]
            const hasTargetPermission = requiredPermission
              ? await this.permissionCheck(req.user, requiredPermission[0], requiredPermission[1])
              : false
            const hasInventorySellPermission = targetSaleType === 'retail'
              ? await this.permissionCheck(req.user, 'inventory:sell', 'system')
              : false
  
            if (!hasTargetPermission && !hasInventorySellPermission) {
              const error = new Error('缺少目标交易类型的操作权限')
              error.status = 403
              error.code = 'INSUFFICIENT_PERMISSIONS'
              throw error
            }
          }
  
          if (isTransactionTypeChange && effectiveStatus === 'supplier_proxy') {
            finalSalePrice = 0
          } else if (isTransactionTypeChange && effectiveStatus === 'peer_transfer' && (!finalSalePrice || finalSalePrice <= 0)) {
            throw new Error('转为批发/调货时，批发价格必须大于0')
          } else if (isTransactionTypeChange && effectiveStatus === 'sold' && (!finalSalePrice || finalSalePrice <= 0)) {
            throw new Error('转为销售时，销售价格必须大于0')
          }
          const finalTransactionCost = effectiveStatus === 'supplier_proxy'
            ? 0
            : finalPurchaseCost
          const normalizedCondition = effectiveCondition === 'new' || effectiveCondition === '全新' ? 'new' : 'used'
  
          const updateValues = [
            brandId || null,     // 使用转换后的brand_id
            modelId || null,     // 使用转换后的model_id
            colorId || null,     // 使用转换后的color_id
            memoryId || null,    // 使用转换后的memory_id
            storeId,
            normalizedImei,
            normalizedSerialNumber,
            finalPurchaseCost,
            finalSalePrice,     // 更新sale_price字段（销售价格）
            normalizedCondition === 'new' ? 1 : 0,
            normalizedCondition === 'new' ? 'A' : 'B',
            effectiveSupplierId || null,
            inventoryOperatorId, // 更新入库员ID
            saleOperatorId, // 更新销售员ID
            finalNotes,
            effectiveInventoryTime ?? null,
            effectiveSaleTime ?? null
          ]
  
          // 如果提供了status字段，添加到更新值
          if (status) {
            updateValues.push(effectiveStatus)
            if (targetSaleType) {
              updateFields.push('wholesale_date = ?', 'wholesale_price = ?')
              updateValues.push(
                effectiveStatus === 'peer_transfer' ? effectiveSaleTime : null,
                effectiveStatus === 'peer_transfer' ? finalSalePrice : 0
              )
            }
          }
  
          // 添加id作为最后一个参数
          updateValues.push(id)
  
          // 锁定并在单一事务内同步设备、销售记录和新类型单号。
          await prepareInvoiceNumberTransaction(connection)
          await connection.beginTransaction()
          transactionStarted = true
          const lockedStatus = await this.repository.lockPhoneStatus(connection, id)
          if (!lockedStatus || normalizePhoneStatus(lockedStatus) !== normalizePhoneStatus(currentPhone.status)) {
            throw new Error('设备状态已被其他操作修改，请刷新后重试')
          }
  
          // 执行更新phones表
          await this.repository.updatePhone(connection, updateFields, updateValues.slice(0, -1), id)
          log.debug('✅ phones表更新成功')
  
          const nextIsNew = normalizedCondition === 'new' ? 1 : 0
          const mediaDirectoryFieldsChanged = (
            String(normalizedSerialNumber || '') !== String(currentPhone.serial_number || '') ||
        String(effectiveInventoryTime || '') !== String(currentPhone.inventory_time || '') ||
        nextIsNew !== Number(currentPhone.is_new)
          )
          if (mediaDirectoryFieldsChanged) {
            const mediaDirectoryActions = await syncPhoneMediaDirectory(id, {
              is_new: nextIsNew,
              serial_number: normalizedSerialNumber,
              inventory_time: effectiveInventoryTime
            }, connection, this.repository)
            rollbackMediaDirectory = mediaDirectoryActions.rollback
            finalizeMediaDirectory = mediaDirectoryActions.finalize
            log.debug('✅ 手机图片目录已同步:', id)
          }
  
          // 🔥 处理客户信息更新
          // 规则：
          // 1. 只修改姓名或Apple ID → 直接更新customers表
          // 2. 修改手机号 → 根据新手机号查找客户，找到则关联，找不到则创建新客户
          let finalCustomerId = customer_id
  
          // 获取原始客户信息（用于比较手机号是否变化）
          let originalCustomerPhone = null
          if (finalCustomerId && finalCustomerId !== '') {
            originalCustomerPhone = await this.repository.findCustomerPhone(connection, finalCustomerId)
          }
  
          // 判断是否需要处理客户信息
          if (customer_name || customer_phone || apple_id) {
            // 检查手机号是否变化
            const phoneChanged = customer_phone && customer_phone !== originalCustomerPhone
  
            if (phoneChanged) {
              // 🔥 手机号变化：根据新手机号查找客户
              log.debug(`📱 手机号变化: ${originalCustomerPhone} → ${customer_phone}，重新查找客户`)
  
              const matchedCustomer = await this.repository.findCustomerByPhone(connection, customer_phone)
  
              if (matchedCustomer) {
                // 找到匹配的客户
                finalCustomerId = matchedCustomer.id
                log.debug(`✅ 找到匹配客户: ID=${finalCustomerId}, 姓名=${matchedCustomer.name}, 手机=${customer_phone}`)
  
                // 如果前端还提供了姓名，更新客户姓名
                if (customer_name && customer_name !== matchedCustomer.name) {
                  await this.repository.updateCustomerName(connection, customer_name, finalCustomerId)
                  log.debug(`✅ 更新客户姓名: ${customer_name}`)
                }
              } else {
                // 没找到匹配客户，创建新客户
                const memberNumber = await generateMemberNumber({ connection })
                finalCustomerId = await this.repository.createCustomer(connection, {
                  name: customer_name || null,
                  phone: customer_phone || null,
                  memberNumber
                })
                log.debug(`✅ 创建新客户: ID=${finalCustomerId}, 姓名=${customer_name}, 手机=${customer_phone}`)
              }
  
              // 客户归属统一维护在 sales.customer_id 中；当前 phones 表不包含 customer_id 字段。
              log.debug(`✅ 客户关联将在sales表同步: phone_id=${id}, customer_id=${finalCustomerId}`)
            } else {
              // 🔥 手机号未变化：只更新姓名或Apple ID
              if (finalCustomerId && finalCustomerId !== '') {
                // 更新现有客户
                const updateCustomerFields = []
                const updateCustomerValues = []
  
                if (customer_name !== null && customer_name !== undefined) {
                  updateCustomerFields.push('name = ?')
                  updateCustomerValues.push(customer_name)
                }
  
                if (updateCustomerFields.length > 0) {
                  updateCustomerValues.push(finalCustomerId)
  
                  await this.repository.updateCustomer(
                    connection,
                    updateCustomerFields,
                    updateCustomerValues.slice(0, -1),
                    finalCustomerId
                  )
                  log.debug(`✅ 更新客户姓名: ID=${finalCustomerId}, 姓名=${customer_name}`)
                }
              } else if (customer_name || customer_phone) {
                // 没有customer_id但有客户信息，先检查手机号是否存在
                if (customer_phone) {
                  // 🔥 先检查手机号是否已存在（确保唯一性）
                  const existingCustomerByPhone = await this.repository.findActiveCustomerByPhone(connection, customer_phone)
  
                  if (existingCustomerByPhone) {
                    // 手机号已存在，直接使用已有客户
                    finalCustomerId = existingCustomerByPhone.id
                    log.debug(`✅ 手机号 ${customer_phone} 已存在，使用已有客户 ID: ${finalCustomerId}`)
  
                    // 如果前端还提供了姓名，更新客户姓名
                    if (customer_name && customer_name !== existingCustomerByPhone.name) {
                      await this.repository.updateCustomerName(connection, customer_name, finalCustomerId)
                      log.debug(`✅ 更新客户姓名: ${customer_name}`)
                    }
                  } else {
                    // 手机号不存在，创建新客户
                    const memberNumber = await generateMemberNumber({ connection })
                    finalCustomerId = await this.repository.createCustomer(connection, {
                      name: customer_name || null,
                      phone: customer_phone,
                      memberNumber
                    })
                    log.debug(`✅ 创建新客户: ID=${finalCustomerId}, 姓名=${customer_name}, 手机=${customer_phone}`)
                  }
                } else {
                  // 没有手机号，直接创建新客户（用临时手机号）
                  const tempPhone = `TEMP_${Date.now()}`
                  const memberNumber = await generateMemberNumber({ connection })
                  finalCustomerId = await this.repository.createCustomer(connection, {
                    name: customer_name || null,
                    phone: tempPhone,
                    memberNumber
                  })
                  log.debug(`✅ 创建临时客户: ID=${finalCustomerId}, 姓名=${customer_name}`)
                }
  
                // 客户归属统一维护在 sales.customer_id 中；当前 phones 表不包含 customer_id 字段。
                log.debug(`✅ 客户关联将在sales表同步: phone_id=${id}, customer_id=${finalCustomerId}`)
              }
            }
  
            // 🔥 处理 Apple ID（存储在customers表）
            if (apple_id !== null && apple_id !== undefined && finalCustomerId) {
              await this.repository.updateCustomerAppleId(connection, apple_id || null, finalCustomerId)
              log.debug(`✅ 更新Apple ID到customers表: ${apple_id || '(清空)'}`)
            }
          }
  
          // 🔥 联动更新sales表 - 只要phones表更新了，就同步更新对应的sales记录
          // 先检查是否存在销售记录
          const existingSale = await this.repository.findLatestSaleByPhone(connection, id)
          let synchronizedSaleId = existingSale?.id || null
  
          // 预定交付后，销售管理或综合查询修改销售员时同步回预定单。
          // 预定页只读这条销售员关系，避免三个页面显示不一致。
          if (existingSale && saleOperatorId !== null && saleOperatorId !== undefined) {
            await this.repository.syncCompletedPreorderOperator(connection, {
              operatorId: saleOperatorId,
              saleId: existingSale.id,
              phoneId: id
            })
          }
  
          // 🔥 如果提供了客户信息但没有销售记录，创建一条销售记录
          if (
            !existingSale && targetSaleType &&
        (finalCustomerId || customer_name || customer_phone || isTransactionTypeChange)
          ) {
            log.debug('🔥 没有销售记录但提供了客户信息，创建销售记录')
  
            // 确定销售类型
            const statusToSaleType = {
              'sold': 'retail',
              'peer_transfer': 'wholesale',
              'supplier_proxy': 'supplier_proxy'
            }
            const saleType = statusToSaleType[effectiveStatus] || 'retail'
  
            const saleDate = effectiveSaleTime ?? null
            const invoiceNumber = await generateInvoiceNumber(saleType, connection, saleDate)
  
            // 创建销售记录
            synchronizedSaleId = await this.repository.createSale(connection, {
              phoneId: id,
              customerId: finalCustomerId || null,
              saleType,
              operatorId: saleOperatorId || null,
              storeId,
              salePrice: finalSalePrice,
              purchaseCost: finalTransactionCost || null,
              paymentMethod: payment_method || null,
              paymentChannel: payment_channel || null,
              saleTime: saleDate || null,
              invoiceNumber,
              remarks: finalNotes || null
            })
  
            await reconcileCustomerPointsForSale({
              executor: connection,
              saleId: synchronizedSaleId,
              customerId: finalCustomerId || null,
              saleType,
              salePrice: finalSalePrice,
              isNew: nextIsNew,
              initialize: true
            })
  
            log.debug(`✅ 创建销售记录成功, ID: ${synchronizedSaleId}, customer_id: ${finalCustomerId}, invoice_number: ${invoiceNumber}`)
          } else if (existingSale) {
  
            // 存在销售记录，执行更新
            const updateSalesFields = []
            const updateSalesValues = []
  
            // 只按业务日期比较，避免同一天的日期/日期时间格式差异触发重复换号。
            const nextSaleDate = sale_time ? formatLocalDate(sale_time) : ''
            const isSaleDateChange = Boolean(
              nextSaleDate && nextSaleDate !== formatLocalDate(existingSale.sale_time)
            )
            if (!existingSale.invoice_number || isTransactionTypeChange || isSaleDateChange) {
              const invoiceSaleType = isTransactionTypeChange
                ? targetSaleType
                : existingSale.sale_type || targetSaleType || 'retail'
              const invoiceNumber = await generateInvoiceNumber(
                invoiceSaleType,
                connection,
                effectiveSaleTime || existingSale.sale_time
              )
              if (isTransactionTypeChange) {
                updateSalesFields.push('sale_type = ?', 'invoice_number = ?')
                updateSalesValues.push(invoiceSaleType, invoiceNumber)
              } else {
                updateSalesFields.push('invoice_number = ?')
                updateSalesValues.push(invoiceNumber)
              }
              log.info('销售单据编号已更新', {
                phone_id: Number(id),
                sale_id: existingSale.id,
                from: existingSale.sale_type,
                to: invoiceSaleType,
                sale_date_changed: isSaleDateChange,
                previous_invoice_number: existingSale.invoice_number,
                invoice_number: invoiceNumber
              })
            }
  
            // 同步 customer_id（使用处理后的finalCustomerId）
            if (finalCustomerId !== null && finalCustomerId !== undefined && finalCustomerId !== '') {
              updateSalesFields.push('customer_id = ?')
              updateSalesValues.push(finalCustomerId)
              log.debug(`✅ 同步customer_id到sales表: ${finalCustomerId}`)
            }

            if (payment_method !== undefined) {
              updateSalesFields.push('payment_method = ?')
              updateSalesValues.push(payment_method || null)
            }
            if (payment_channel !== undefined) {
              updateSalesFields.push('payment_channel = ?')
              updateSalesValues.push(payment_channel || null)
            }
  
            // 同步 operator_id（如果前端提供了）
            if (saleOperatorId !== null && saleOperatorId !== undefined) {
              updateSalesFields.push('operator_id = ?')
              updateSalesValues.push(saleOperatorId)
            }
  
            // 同步 sale_date（从phones表同步）
            if (effectiveSaleTime !== null && effectiveSaleTime !== undefined) {
              updateSalesFields.push('sale_time = ?')
              updateSalesValues.push(effectiveSaleTime)
            }
  
            // 同步 store_id
            if (effectiveStoreId !== null && effectiveStoreId !== undefined) {
              updateSalesFields.push('store_id = ?')
              updateSalesValues.push(storeId)
            }
  
            // 🔥 同步销售价格 (price字段)
            if (effectiveSalePrice !== null && effectiveSalePrice !== undefined) {
              updateSalesFields.push('sale_price = ?')
              updateSalesValues.push(finalSalePrice)
              log.debug(`✅ 同步销售价格: ${finalSalePrice}`)
            }
  
            // 同步入库成本
            const costValue = effectivePurchaseCost !== null && effectivePurchaseCost !== undefined
              ? finalTransactionCost
              : null
            if (costValue !== null && costValue !== undefined) {
              updateSalesFields.push('purchase_cost = ?')
              updateSalesValues.push(parseFloat(costValue))
              log.debug(`✅ 同步入库成本: ${costValue}`)
            }
  
            // 同步 remarks
            updateSalesFields.push('remarks = ?')
            updateSalesValues.push(finalNotes)
  
            const pointsCustomerId = finalCustomerId !== null && finalCustomerId !== undefined && finalCustomerId !== ''
              ? finalCustomerId
              : existingSale.customer_id
            await reconcileCustomerPointsForSale({
              executor: connection,
              saleId: existingSale.id,
              customerId: pointsCustomerId,
              saleType: transactionTypeByStatus[effectiveStatus] || 'non_retail',
              salePrice: finalSalePrice,
              isNew: nextIsNew,
              initialize: isTransactionTypeChange
            })
  
            if (updateSalesFields.length > 0) {
              updateSalesFields.push('updated_at = NOW()')
              updateSalesValues.push(existingSale.id)
  
              const updateSalesResult = await this.repository.updateSale(
                connection,
                updateSalesFields,
                updateSalesValues.slice(0, -1),
                existingSale.id
              )
  
              log.debug(`✅ 同步更新sales表成功，影响行数: ${updateSalesResult.affectedRows}`)
            }
          }
  
          if (synchronizedSaleId) {
            await this.repository.linkPhoneSale(connection, {
              saleId: synchronizedSaleId,
              operatorId: saleOperatorId || null,
              phoneId: id
            })
          }
  
          await connection.commit()
          transactionStarted = false
          if (finalizeMediaDirectory) await finalizeMediaDirectory()
  
          // 获取更新后的完整手机信息
          log.debug(`🔍 查询更新后的手机信息，ID: ${id}`)
          const updatedPhone = await this.repository.getUpdatedPhone(connection, id)
          log.debug('📋 返回给前端的更新后数据:', {
            id: updatedPhone?.id,
            imei: updatedPhone?.imei,
            sale_operator_id: updatedPhone?.sale_operator_id,
            sale_operator_name: updatedPhone?.sale_operator_name,
            inventory_operator_id: updatedPhone?.inventory_operator_id,
            inventory_operator_name: updatedPhone?.inventory_operator_name
          })
  
          // 清除相关缓存，确保前端能看到最新数据
          log.debug('🧹 清除查询接口缓存...')
          try {
            clearCache('/api/query/comprehensive')
            clearCache('/api/query/statistics')
            log.debug('✅ 缓存清除完成')
          } catch (cacheError) {
            log.warn('⚠️ 缓存清除失败:', cacheError.message)
          }
  
          // 自动匹配预定单（当手机入库且状态为 in_stock 时）
          if (effectiveStatus === 'in_stock') {
            log.debug('🔍 开始自动匹配预定单...')
  
            try {
              // 查找符合条件的最早期预定单
              const preorder = await this.repository.findOldestMatchingPreorder(connection, {
                brandId,
                modelId,
                colorId,
                memoryId,
                isNew: nextIsNew
              })
  
              if (preorder) {
                log.debug(`✅ 找到匹配的预定单: ${preorder.preorder_number}`)
  
                // 自动匹配预定单
                await this.repository.matchPreorderToPhone(connection, {
                  phoneId: id,
                  imei: normalizedImei,
                  brandId,
                  modelId,
                  preorderId: preorder.id
                })
  
                // 更新手机状态为已预定
                await this.repository.markPhonePreordered(connection, id)
  
                log.debug(`✅ 预定单 ${preorder.preorder_number} 自动匹配成功`)
  
                // 添加提示信息到响应中
                if (updatedPhone) {
                  updatedPhone.auto_matched_preorder = preorder.preorder_number
                  updatedPhone.auto_matched_customer = preorder.customer_name
                }
              } else {
                log.debug('ℹ️ 没有找到匹配的预定单')
              }
            } catch (matchError) {
              log.error('❌ 自动匹配预定单失败:', matchError)
              // 不影响主流程，继续返回成功
            }
          }
  
          return updatedPhone
        } catch (error) {
          if (transactionStarted) {
            await connection.rollback()
            transactionStarted = false
          }
          if (rollbackMediaDirectory) {
            try {
              await rollbackMediaDirectory()
            } catch (rollbackError) {
              error.message += `；手机图片回滚失败: ${rollbackError.message}`
            }
          }
          throw error
        }
      })
    } catch (error) {
      throw error
    }
  }
}

module.exports = PhoneUpdateService
