const BaseRepository = require('./base.repository');
const log = require('../utils/log');

/**
 * 销售订单项仓库类
 * 处理销售订单项相关的数据库操作
 */
class SalesOrderItemRepository extends BaseRepository {
  constructor() {
    super('sales_order_items');
  }

  /**
   * 根据订单ID查找订单项
   * @param {number} orderId - 订单ID
   * @returns {Array} 订单项列表
   */
  async findByOrderId(orderId) {
    try {
      const records = await this.executeQuery(
        `SELECT * FROM ${this.tableName} WHERE order_id = ? ORDER BY id`,
        [orderId]
      );
      return records;
    } catch (error) {
      log.error('根据订单ID查找订单项失败:', error);
      throw error;
    }
  }

  /**
   * 根据手机ID查找订单项
   * @param {number} phoneId - 手机ID
   * @returns {Array} 订单项列表
   */
  async findByPhoneId(phoneId) {
    try {
      const records = await this.executeQuery(
        `SELECT * FROM ${this.tableName} WHERE phone_id = ? ORDER BY id`,
        [phoneId]
      );
      return records;
    } catch (error) {
      log.error('根据手机ID查找订单项失败:', error);
      throw error;
    }
  }

  /**
   * 更新订单项状态
   * @param {number} id - 订单项ID
   * @param {string} status - 新状态
   * @param {Object} extraData - 额外数据
   * @returns {boolean} 是否成功
   */
  async updateStatus(id, status, extraData = {}) {
    try {
      const updateData = {
        item_status: status,
        updated_at: new Date(),
        ...extraData
      };

      const result = await this.update(id, updateData);
      return result.affectedRows > 0;
    } catch (error) {
      log.error('更新订单项状态失败:', error);
      throw error;
    }
  }

  /**
   * 批量更新订单项状态
   * @param {number} orderId - 订单ID
   * @param {string} status - 新状态
   * @param {Object} extraData - 额外数据
   * @returns {boolean} 是否成功
   */
  async updateStatusByOrderId(orderId, status, extraData = {}) {
    try {
      const updateData = {
        item_status: status,
        updated_at: new Date(),
        ...extraData
      };

      const conditions = ['order_id = ?'];
      const params = [orderId];

      // 构建SET子句
      const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
      const updateParams = Object.values(updateData);

      const query = `
        UPDATE ${this.tableName}
        SET ${setClause}
        WHERE ${conditions.join(' AND ')}
      `;

      const allParams = [...updateParams, ...params];
      const result = await this.executeQuery(query, allParams);
      return result.affectedRows > 0;
    } catch (error) {
      log.error('批量更新订单项状态失败:', error);
      throw error;
    }
  }

  /**
   * 删除订单项
   * @param {number} id - 订单项ID
   * @returns {boolean} 是否成功
   */
  async deleteItem(id) {
    try {
      const result = await this.delete(id);
      return result.affectedRows > 0;
    } catch (error) {
      log.error('删除订单项失败:', error);
      throw error;
    }
  }

  /**
   * 获取订单项统计信息
   * @param {number} orderId - 订单ID
   * @returns {Object} 统计信息
   */
  async getOrderItemStats(orderId) {
    try {
      const statsQuery = `
        SELECT
          COUNT(*) as total_items,
          SUM(quantity) as total_quantity,
          SUM(unit_price * quantity) as total_amount,
          SUM(profit_amount * quantity) as total_profit,
          COUNT(CASE WHEN item_status = 'confirmed' THEN 1 END) as confirmed_items,
          COUNT(CASE WHEN item_status = 'delivered' THEN 1 END) as delivered_items,
          COUNT(CASE WHEN item_status = 'returned' THEN 1 END) as returned_items
        FROM ${this.tableName}
        WHERE order_id = ?
      `;

      const [statsResult] = await this.executeQuery(statsQuery, [orderId]);
      return statsResult;
    } catch (error) {
      log.error('获取订单项统计失败:', error);
      throw error;
    }
  }
}

module.exports = SalesOrderItemRepository;