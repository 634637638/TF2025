const { getDatabase, isConnected } = require('../config/database');

// 数据库操作辅助函数
class DbHelper {
  // 执行查询
  static async execute(query, params = []) {
    if (!isConnected()) {
      throw new Error('数据库未连接');
    }
    const pool = getDatabase();
    const [rows] = await pool.execute(query, params);
    return rows;
  }
  
  // 执行事务
  static async transaction(callback) {
    if (!isConnected()) {
      throw new Error('数据库未连接');
    }
    const pool = getDatabase();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  // 格式化查询结果（处理常见的数据类型转换）
  static formatRow(row) {
    const formatted = {};
    for (const [key, value] of Object.entries(row)) {
      // 处理数字类型
      if (key.includes('id') || key.includes('_id') || key === 'status' || key === 'quantity') {
        formatted[key] = value ? parseInt(value) : 0;
      }
      // 处理浮点数
      else if (key.includes('price') || key.includes('cost') || key.includes('amount')) {
        formatted[key] = value ? parseFloat(value) : 0;
      }
      // 处理布尔值
      else if (key.includes('is_') || key === 'status') {
        formatted[key] = parseInt(value) === 1;
      }
      // 处理字符串
      else if (typeof value === 'string') {
        formatted[key] = value.trim();
      }
      // 处理日期
      else if (key.includes('_at') || key.includes('_date')) {
        formatted[key] = value ? new Date(value).toISOString() : null;
      }
      else {
        formatted[key] = value;
      }
    }
    return formatted;
  }
  
  // 格式化多行结果
  static formatRows(rows) {
    return rows.map(row => this.formatRow(row));
  }
}

module.exports = DbHelper;

