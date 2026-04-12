const BaseRepository = require('./base.repository');
const log = require('../utils/log');

/**
 * 销售订单仓库类
 * 处理销售订单相关的数据库操作
 */
class SalesOrderRepository extends BaseRepository {
  constructor() {
    super('sales_orders');
  }

  /**
   * 创建销售订单
   * @param {Object} orderData - 订单数据
   * @returns {Object} 创建结果
   */
  async createOrder(orderData) {
    try {
      // 生成订单号
      const orderNo = this.generateOrderNumber();

      const data = {
        ...orderData,
        order_no: orderNo,
        order_status: orderData.order_status || 'draft',
        created_at: new Date(),
        updated_at: new Date()
      };

      log.debug(`创建销售订单参数 [${this.tableName}]:`, data);

      const result = await this.create(data);

      log.info(`创建销售订单成功 [${this.tableName}]，ID: ${result.id}`);
      return result;
    } catch (error) {
      log.error('创建销售订单失败:', error);
      throw error;
    }
  }

  /**
   * 生成订单号
   * @returns {string} 订单号
   */
  generateOrderNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-6);
    return `SO${year}${month}${day}${timestamp}`;
  }

  /**
   * 添加订单项
   * @param {Object} itemData - 订单项数据
   * @returns {Object} 创建结果
   */
  async addOrderItem(itemData) {
    try {
      const orderItemsRepo = require('./sales-order-item.repository');
      const orderItems = new orderItemsRepo();

      const data = {
        ...itemData,
        item_status: 'confirmed',
        created_at: new Date(),
        updated_at: new Date()
      };

      log.debug(`添加订单项 [sales_order_items]:`, data);

      const result = await orderItems.create(data);

      log.info(`添加订单项成功 [sales_order_items]，ID: ${result.id}`);
      return result;
    } catch (error) {
      log.error('添加订单项失败:', error);
      throw error;
    }
  }

  /**
   * 根据订单号查找订单
   * @param {string} orderNo - 订单号
   * @returns {Object|null} 订单信息
   */
  async findByOrderNo(orderNo) {
    try {
      const records = await this.executeQuery(
        `SELECT * FROM ${this.tableName} WHERE order_no = ?`,
        [orderNo]
      );

      if (records && records.length > 0) {
        return records[0];
      }
      return null;
    } catch (error) {
      log.error('根据订单号查找订单失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID查找订单详情（包含订单项）
   * @param {number} id - 订单ID
   * @returns {Object|null} 订单详情
   */
  async findByIdWithItems(id) {
    try {
      // 查找订单基本信息
      const order = await this.findById(id);
      if (!order) {
        return null;
      }

      // 查找订单项
      const orderItemsRepo = require('./sales-order-item.repository');
      const orderItems = new orderItemsRepo();

      const items = await orderItems.findByOrderId(id);

      // 合并订单和订单项信息
      return {
        ...order,
        items: items || []
      };
    } catch (error) {
      log.error('查找订单详情失败:', error);
      throw error;
    }
  }

  /**
   * 获取客户的销售订单列表
   * @param {number} customerId - 客户ID
   * @param {Object} options - 查询选项
   * @returns {Object} 订单列表和分页信息
   */
  async getCustomerOrders(customerId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        startDate,
        endDate
      } = options;

      const offset = (page - 1) * limit;
      const conditions = ['customer_id = ?'];
      const params = [customerId];

      if (status) {
        conditions.push('order_status = ?');
        params.push(status);
      }

      if (startDate) {
        conditions.push('order_date >= ?');
        params.push(startDate);
      }

      if (endDate) {
        conditions.push('order_date <= ?');
        params.push(endDate);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // 查询数据
      const query = `
        SELECT * FROM ${this.tableName}
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;

      const dataParams = [...params, parseInt(limit), parseInt(offset)];
      const records = await this.executeQuery(query, dataParams);

      // 查询总数
      const countQuery = `
        SELECT COUNT(*) as total FROM ${this.tableName}
        ${whereClause}
      `;
      const [countResult] = await this.executeQuery(countQuery, params);
      const total = countResult.total;

      return {
        records,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      log.error('获取客户订单列表失败:', error);
      throw error;
    }
  }

  /**
   * 更新订单状态
   * @param {number} id - 订单ID
   * @param {string} status - 新状态
   * @returns {boolean} 是否成功
   */
  async updateStatus(id, status) {
    try {
      const updateData = {
        order_status: status,
        updated_at: new Date()
      };

      if (status === 'completed') {
        updateData.completed_date = new Date();
      }

      const result = await this.update(id, updateData);
      return result.affectedRows > 0;
    } catch (error) {
      log.error('更新订单状态失败:', error);
      throw error;
    }
  }

  /**
   * 更新支付状态
   * @param {number} id - 订单ID
   * @param {string} paymentStatus - 支付状态
   * @param {number} paidAmount - 已付金额
   * @returns {boolean} 是否成功
   */
  async updatePaymentStatus(id, paymentStatus, paidAmount = 0) {
    try {
      const updateData = {
        payment_status: paymentStatus,
        paid_amount: paidAmount,
        updated_at: new Date()
      };

      const result = await this.update(id, updateData);
      return result.affectedRows > 0;
    } catch (error) {
      log.error('更新支付状态失败:', error);
      throw error;
    }
  }

  /**
   * 取消订单
   * @param {number} id - 订单ID
   * @param {string} reason - 取消原因
   * @returns {boolean} 是否成功
   */
  async cancelOrder(id, reason = '') {
    try {
      // 开始事务
      const db = this.getConnection();

      try {
        await db.execute('START TRANSACTION');

        // 更新订单状态
        await db.execute(
          `UPDATE ${this.tableName}
           SET order_status = 'cancelled',
               updated_at = NOW()
           WHERE id = ?`,
          [id]
        );

        // 更新所有订单项状态为已取消
        await db.execute(
          `UPDATE sales_order_items
           SET item_status = 'returned',
               return_date = NOW(),
               return_reason = ?,
               updated_at = NOW()
           WHERE order_id = ?`,
          [reason, id]
        );

        // 提交事务
        await db.execute('COMMIT');

        log.info(`取消订单成功 [${this.tableName}]，ID: ${id}`);
        return true;
      } catch (error) {
        await db.execute('ROLLBACK');
        throw error;
      }
    } catch (error) {
      log.error('取消订单失败:', error);
      throw error;
    }
  }

  /**
   * 完成订单
   * @param {number} id - 订单ID
   * @returns {boolean} 是否成功
   */
  async completeOrder(id) {
    try {
      // 开始事务
      const db = this.getConnection();

      try {
        await db.execute('START TRANSACTION');

        // 获取订单信息
        const [orderResult] = await db.execute(
          `SELECT * FROM ${this.tableName} WHERE id = ?`,
          [id]
        );

        if (!orderResult || orderResult.length === 0) {
          throw new Error('订单不存在');
        }

        const order = orderResult[0];

        // 更新订单状态
        await db.execute(
          `UPDATE ${this.tableName}
           SET order_status = 'completed',
               completed_date = NOW(),
               updated_at = NOW()
           WHERE id = ?`,
          [id]
        );

        // 更新支付状态为已付清
        await db.execute(
          `UPDATE ${this.tableName}
           SET payment_status = 'paid',
               paid_amount = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [order.final_amount, id]
        );

        // 更新所有订单项状态为已交付
        await db.execute(
          `UPDATE sales_order_items
           SET item_status = 'delivered',
               delivery_date = NOW(),
               updated_at = NOW()
           WHERE order_id = ?`,
          [id]
        );

        // 提交事务
        await db.execute('COMMIT');

        log.info(`完成订单成功 [${this.tableName}]，ID: ${id}`);
        return true;
      } catch (error) {
        await db.execute('ROLLBACK');
        throw error;
      }
    } catch (error) {
      log.error('完成订单失败:', error);
      throw error;
    }
  }

  /**
   * 获取订单统计信息
   * @param {Object} filters - 过滤条件
   * @returns {Object} 统计信息
   */
  async getStats(filters = {}) {
    try {
      const {
        startDate,
        endDate,
        storeId,
        operatorId,
        status
      } = filters;

      const conditions = [];
      const params = [];

      if (startDate) {
        conditions.push('order_date >= ?');
        params.push(startDate);
      }

      if (endDate) {
        conditions.push('order_date <= ?');
        params.push(endDate);
      }

      if (storeId) {
        conditions.push('store_id = ?');
        params.push(storeId);
      }

      if (operatorId) {
        conditions.push('operator_id = ?');
        params.push(operatorId);
      }

      if (status) {
        conditions.push('order_status = ?');
        params.push(status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const statsQuery = `
        SELECT
          COUNT(*) as total_orders,
          SUM(final_amount) as total_amount,
          SUM(total_profit) as total_profit,
          AVG(final_amount) as avg_order_value,
          COUNT(CASE WHEN order_status = 'completed' THEN 1 END) as completed_orders,
          COUNT(CASE WHEN order_status = 'cancelled' THEN 1 END) as cancelled_orders,
          COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_orders
        FROM ${this.tableName}
        ${whereClause}
      `;

      const result = await this.executeQuery(statsQuery, params);
      return result[0];
    } catch (error) {
      log.error('获取订单统计失败:', error);
      throw error;
    }
  }

  /**
   * 批量创建订单
   * @param {Array} ordersList - 订单列表
   * @returns {Array} 创建结果列表
   */
  async batchCreateOrders(ordersList) {
    try {
      const results = [];

      // 开始事务
      const db = this.getConnection();
      await db.execute('START TRANSACTION');

      try {
        for (const orderData of ordersList) {
          // 生成订单号
          const orderNo = this.generateOrderNumber();

          const data = {
            ...orderData,
            order_no: orderNo,
            order_status: orderData.order_status || 'draft',
            created_at: new Date(),
            updated_at: new Date()
          };

          log.debug(`批量创建销售订单参数 [${this.tableName}]:`, data);

          const result = await this.create(data);
          results.push({
            ...result,
            order_no: orderNo
          });
        }

        // 提交事务
        await db.execute('COMMIT');

        log.info(`批量创建销售订单成功 [${this.tableName}]，数量: ${results.length}`);
        return results;
      } catch (error) {
        await db.execute('ROLLBACK');
        throw error;
      }
    } catch (error) {
      log.error('批量创建销售订单失败:', error);
      throw error;
    }
  }

  /**
   * 根据日期范围获取订单
   * @param {Date} startDate - 开始日期
   * @param {Date} endDate - 结束日期
   * @param {Object} options - 查询选项
   * @returns {Object} 订单列表和分页信息
   */
  async getOrdersByDateRange(startDate, endDate, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        customerId
      } = options;

      const offset = (page - 1) * limit;
      const conditions = ['order_date >= ? AND order_date <= ?'];
      const params = [startDate, endDate];

      if (status) {
        conditions.push('order_status = ?');
        params.push(status);
      }

      if (customerId) {
        conditions.push('customer_id = ?');
        params.push(customerId);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // 查询数据
      const query = `
        SELECT * FROM ${this.tableName}
        ${whereClause}
        ORDER BY order_date DESC, created_at DESC
        LIMIT ? OFFSET ?
      `;

      const dataParams = [...params, parseInt(limit), parseInt(offset)];
      const records = await this.executeQuery(query, dataParams);

      // 查询总数
      const countQuery = `
        SELECT COUNT(*) as total FROM ${this.tableName}
        ${whereClause}
      `;
      const [countResult] = await this.executeQuery(countQuery, params);
      const total = countResult.total;

      return {
        records,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      log.error('根据日期范围获取订单失败:', error);
      throw error;
    }
  }

  /**
   * 更新订单配送信息
   * @param {number} id - 订单ID
   * @param {Object} deliveryData - 配送信息
   * @returns {boolean} 是否成功
   */
  async updateDeliveryInfo(id, deliveryData) {
    try {
      const updateData = {
        ...deliveryData,
        updated_at: new Date()
      };

      const result = await this.update(id, updateData);
      return result.affectedRows > 0;
    } catch (error) {
      log.error('更新订单配送信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取最近的订单
   * @param {number} limit - 数量限制
   * @param {Object} filters - 过滤条件
   * @returns {Array} 订单列表
   */
  async getRecentOrders(limit = 10, filters = {}) {
    try {
      const {
        customerId,
        status,
        operatorId
      } = filters;

      const conditions = [];
      const params = [];

      if (customerId) {
        conditions.push('customer_id = ?');
        params.push(customerId);
      }

      if (status) {
        conditions.push('order_status = ?');
        params.push(status);
      }

      if (operatorId) {
        conditions.push('operator_id = ?');
        params.push(operatorId);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT * FROM ${this.tableName}
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ?
      `;

      const records = await this.executeQuery(query, [...params, parseInt(limit)]);
      return records;
    } catch (error) {
      log.error('获取最近订单失败:', error);
      throw error;
    }
  }
}

module.exports = SalesOrderRepository;