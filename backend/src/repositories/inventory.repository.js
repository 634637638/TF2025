/**
 * 库存数据访问层
 * 封装所有数据库操作
 */
const { getDatabase } = require('../config/database');
const log = require('../utils/log');

class InventoryRepository {
  constructor() {
    this.tableName = 'inventory';
  }

  /**
   * 获取数据库连接（使用连接池）
   */
  getConnection() {
    return getDatabase();
  }

  /**
   * 执行查询（使用连接池）
   */
  async executeQuery(sql, params = []) {
    const db = this.getConnection();
    const [rows] = await db.execute(sql, params);
    return rows;
  }

  /**
   * 获取库存记录列表（带分页和过滤）
   */
  async getInventoryRecordsWithPagination(filters = {}, _options = {}) {
    const {
      page = 1,
      limit = 10
    } = filters;

    const validLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
    const validPage = Math.max(parseInt(page) || 1, 1);
    const offset = (validPage - 1) * validLimit;

    try {
      log.info('开始库存查询，参数:', { validPage, validLimit, offset });

      // 使用JOIN查询获取关联的真实数据
      const dataQuery = `
        SELECT
          p.id,
          p.imei,
          p.serial_number,
          p.quality_grade as phone_condition,
          p.purchase_cost as purchase_price,
          p.price as selling_price,
          p.store_id,
          p.supplier_id,
          p.status,
          p.is_new,
          p.Inventorytime,
          p.salestime,
          s.name as supplier_name,
          st.name as store_name,
          p.purchase_number as purchase_number,
          p.inventory_operator_id,
          inv_op.name as inventory_operator_name
        FROM phones p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN stores st ON p.store_id = st.id
        LEFT JOIN operators inv_op ON p.inventory_operator_id = inv_op.id
        WHERE p.status = 'in_stock'
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `;

      log.debug('执行库存数据查询...');
      const dataResult = await this.executeQuery(dataQuery, [validLimit, offset]);
      log.success(`查询成功，找到 ${dataResult.length} 条记录`);

      // 简化的计数查询
      log.debug('执行库存计数查询...');
      const [countResult] = await this.getConnection().execute(`
        SELECT COUNT(*) as total
        FROM phones p
        WHERE p.status = 'in_stock'
      `);
      const total = countResult.total;
      log.info(`总数: ${total}`);

      // 格式化返回数据
      const formattedData = dataResult.map(item => ({
        id: item.id,
        imei: item.imei || '',
        serial_number: item.serial_number || '',
        purchase_price: parseFloat(item.purchase_price) || 0,
        selling_price: parseFloat(item.selling_price) || 0,
        phone_condition: item.phone_condition || '',
        supplier_name: item.supplier_name || '未知供应商',
        store_name: item.store_name || '未知店铺',
        purchase_number: item.purchase_number || '',
        inventory_operator_id: item.inventory_operator_id,
        inventory_operator_name: item.inventory_operator_name || '未设置',
        status: item.status,
        is_new: item.is_new,
        created_at: item.created_at,
        updated_at: item.updated_at
      }));

      return {
        success: true,
        data: formattedData,
        pagination: {
          current: validPage,
          pageSize: validLimit,
          total: total,
          totalPages: Math.ceil(total / validLimit)
        }
      };

    } catch (error) {
      log.error('库存查询错误:', error);
      log.error('错误详情:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      });
      throw error;
    }
  }
}

module.exports = InventoryRepository;
