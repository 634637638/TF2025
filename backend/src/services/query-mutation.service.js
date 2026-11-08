'use strict'

const BaseService = require('../core/base/base.service')
const QueryRepository = require('../repositories/query.repository')
const { StoreScopeError } = require('../utils/store-scope')
const { reverseCustomerPointsForSale: defaultReversePoints } = require('./customer-points.service')
const log = require('../utils/log')

class QueryMutationService extends BaseService {
  constructor({ repository = new QueryRepository(), reversePoints = defaultReversePoints } = {}) {
    super()
    this.repository = repository
    this.reversePoints = reversePoints
  }

  async returnToStock(phoneId, operatorId, returnInfo = {}, storeScope = {}) {
    return this.repository.withConnection(async connection => {
      try {
        // 开始事务
        await connection.beginTransaction()

        // 1. 获取手机当前信息
        const [phoneRecords] = await this.repository.lockPhoneForReturn(connection, phoneId)

        if (phoneRecords.length === 0) {
          throw new Error('手机不存在')
        }

        const phone = phoneRecords[0]
        if (!storeScope.allStores && !storeScope.storeIds?.includes(Number(phone.store_id))) {
          throw new StoreScopeError('无权操作该门店数据')
        }

        // 只允许退库已售出、同行批发、代供应商划拨的手机
        const allowedStatuses = ['sold', 'peer_transfer', 'supplier_proxy']
        if (!allowedStatuses.includes(phone.status)) {
          throw new Error('只能退库已售出、同行批发或划拨的手机')
        }

        // 2. 获取销售记录信息
        const [saleRecords] = await this.repository.lockLatestSaleForReturn(connection, phoneId)

        if (saleRecords.length === 0) {
          throw new Error('未找到相关销售记录，无法退库。只有已创建销售记录的已售出/批发/划拨商品才能退库。')
        }

        const originalSaleId = saleRecords[0].id
        const originalCustomerId = saleRecords[0].customer_id
        const saleType = phone.status
        const originalSaleOperatorId = saleRecords[0].operator_id || null
        const originalSaleOperatorName = saleRecords[0].sale_operator_name || null

        // 3. 删除销售记录
        await this.reversePoints({
          executor: connection,
          saleId: originalSaleId
        })
        const [deleteSaleResult] = await this.repository.deleteSaleById(connection, originalSaleId)
        if (deleteSaleResult.affectedRows !== 1) {
          throw new Error('销售记录状态已变化，请刷新后重试')
        }

        const [phoneUpdateResult] = await this.repository.restoreReturnedPhone(connection, phoneId)
        if (phoneUpdateResult.affectedRows !== 1) {
          throw new Error('手机状态已变化，请刷新后重试')
        }

        // 5. 记录退库日志
        const remarks = returnInfo.remarks || `客户退库操作 - ${returnInfo.return_reason || '未指定原因'} (${returnInfo.handle_method || '未指定处理方式'})`
        await this.repository.insertReversalLog(connection, phoneId, originalSaleId, saleType, originalCustomerId, originalSaleOperatorId, originalSaleOperatorName, operatorId, remarks)

        await connection.commit()

        return {
          success: true,
          message: '退库成功，手机已恢复到未销售状态'
        }
      } catch (error) {
        await connection.rollback()
        log.error('退库操作失败:', error)
        throw error
      }
    })
  }

  async deletePhoneRecord(phoneId, storeScope = {}) {
    return this.repository.withConnection(async connection => {
      try {
        // 开始事务
        await connection.beginTransaction()

        const [phoneRows] = await this.repository.lockPhoneForDelete(connection, phoneId)
        if (phoneRows.length === 0) {
          throw new Error('手机记录不存在')
        }
        if (!storeScope.allStores && !storeScope.storeIds?.includes(Number(phoneRows[0].store_id))) {
          throw new StoreScopeError('无权操作该门店数据')
        }

        // 1. 删除关联的销售记录
        const [saleRows] = await this.repository.lockSalesForDelete(connection, phoneId)
        for (const sale of saleRows) {
          await this.reversePoints({
            executor: connection,
            saleId: sale.id
          })
        }
        await this.repository.deletePhoneSales(connection, phoneId)

        // 2. 尝试删除返销日志记录（如果表存在）
        try {
          await this.repository.deletePhoneReversalLogs(connection, phoneId)
        } catch (logError) {
        // 如果表不存在，忽略错误继续执行
          if (!logError.message.includes('Table') || !logError.message.includes("doesn't exist")) {
            throw logError // 如果是其他错误，重新抛出
          }
        }

        // 3. 删除其他可能引用该手机的记录
        try {
          await this.repository.deletePhoneOrderItems(connection, phoneId)
        } catch (orderError) {
        // 如果表不存在或约束问题，忽略错误继续执行
          if (!orderError.message.includes('Table') || !orderError.message.includes("doesn't exist")) {
            log.warn(`删除销售订单项记录时出现警告: ${orderError.message}`)
          }
        }

        try {
          await this.repository.deletePhoneRentals(connection, phoneId)
        } catch (rentalError) {
        // 如果表不存在或约束问题，忽略错误继续执行
          if (!rentalError.message.includes('Table') || !rentalError.message.includes("doesn't exist")) {
            log.warn(`删除租赁记录时出现警告: ${rentalError.message}`)
          }
        }

        // 4. 删除手机记录
        const [result] = await this.repository.deletePhoneById(connection, phoneId)

        if (result.affectedRows === 0) {
          throw new Error('手机记录不存在')
        }

        // 提交事务
        await connection.commit()

        return {
          success: true,
          message: '删除成功',
          deletedRecords: {
            sales: result.affectedRows,
            phone: 1
          }
        }
      } catch (error) {
        // 回滚事务
        await connection.rollback()
        log.error('删除手机记录失败:', error)
        throw error
      }
    })
  }
}

module.exports = QueryMutationService
