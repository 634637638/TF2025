/**
 * 数据备份服务
 * 在执行危险操作前自动备份数据
 */
const { getDatabase } = require('../config/database');
const log = require('../utils/log');

class DataBackupService {
  constructor() {
    this.backupTable = 'data_check_backups';
  }

  getPool() {
    return getDatabase();
  }

  /**
   * 初始化备份表
   */
  async initBackupTable() {
    const connection = await this.getPool().getConnection();
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS ${this.backupTable} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          table_name VARCHAR(50) NOT NULL,
          operation_type ENUM('merge', 'delete') NOT NULL,
          backup_data JSON NOT NULL,
          created_by VARCHAR(100),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_table (table_name),
          INDEX idx_date (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } finally {
      connection.release();
    }
  }

  /**
   * 备份数据
   * @param {string} tableName - 表名
   * @param {string} operation - 操作类型 (merge/delete)
   * @param {Array} ids - 要操作的记录ID
   * @param {string} user - 操作用户
   */
  async backupData(tableName, operation, ids, user = null) {
    await this.initBackupTable();

    const connection = await this.getPool().getConnection();
    try {
      // 查询要备份的数据
      const placeholders = ids.map(() => '?').join(',');
      const [rows] = await connection.execute(
        `SELECT * FROM ${tableName} WHERE id IN (${placeholders})`,
        ids
      );

      if (rows.length === 0) {
        return { success: true, message: '没有数据需要备份' };
      }

      // 插入备份记录
      const [result] = await connection.execute(`
        INSERT INTO ${this.backupTable} (table_name, operation_type, backup_data, created_by)
        VALUES (?, ?, ?, ?)
      `, [tableName, operation, JSON.stringify(rows), user]);

      return {
        success: true,
        backupId: result.insertId,
        count: rows.length,
        message: `成功备份 ${rows.length} 条记录`
      };
    } catch (error) {
      log.error('备份数据失败:', error);
      return {
        success: false,
        message: '备份数据失败: ' + error.message
      };
    } finally {
      connection.release();
    }
  }

  /**
   * 恢复数据
   * @param {number} backupId - 备份ID
   */
  async restoreBackup(backupId) {
    const connection = await this.getPool().getConnection();
    try {
      await connection.beginTransaction();

      // 获取备份数据
      const [backups] = await connection.execute(
        `SELECT * FROM ${this.backupTable} WHERE id = ?`,
        [backupId]
      );

      if (backups.length === 0) {
        throw new Error('备份记录不存在');
      }

      const backup = backups[0];
      const data = JSON.parse(backup.backup_data);

      // 恢复数据
      for (const record of data) {
        const columns = Object.keys(record).filter(k => k !== 'id');
        const values = columns.map(k => record[k]);
        const placeholders = columns.map(() => '?').join(',');
        const updateClause = columns.map(k => `${k} = VALUES(${k})`).join(',');

        await connection.execute(`
          INSERT INTO ${backup.table_name} (id, ${columns.join(',')})
          VALUES (?, ${placeholders})
          ON DUPLICATE KEY UPDATE ${updateClause}
        `, [record.id, ...values]);
      }

      await connection.commit();

      return {
        success: true,
        message: `成功恢复 ${data.length} 条记录`,
        count: data.length
      };
    } catch (error) {
      await connection.rollback();
      log.error('恢复数据失败:', error);
      return {
        success: false,
        message: '恢复数据失败: ' + error.message
      };
    } finally {
      connection.release();
    }
  }

  /**
   * 获取备份列表
   */
  async getBackupList(tableName = null, limit = 50) {
    const connection = await this.getPool().getConnection();
    try {
      let sql = `
        SELECT
          id,
          table_name,
          operation_type,
          created_by,
          created_at,
          JSON_LENGTH(backup_data) as record_count
        FROM ${this.backupTable}
      `;

      const params = [];

      if (tableName) {
        sql += ' WHERE table_name = ?';
        params.push(tableName);
      }

      sql += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const [rows] = await connection.execute(sql, params);

      return {
        success: true,
        data: rows.map(r => ({
          ...r,
          record_count: r.record_count
        }))
      };
    } finally {
      connection.release();
    }
  }

  /**
   * 删除旧备份（保留最近30天）
   */
  async cleanOldBackups(days = 30) {
    const connection = await this.getPool().getConnection();
    try {
      const [result] = await connection.execute(`
        DELETE FROM ${this.backupTable}
        WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
      `, [days]);

      return {
        success: true,
        message: `清理了 ${result.affectedRows} 条旧备份记录`
      };
    } finally {
      connection.release();
    }
  }
}

module.exports = new DataBackupService();
