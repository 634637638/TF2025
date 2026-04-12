const { getDatabase } = require('../config/database');
const {
  sanitizeOrderBy,
  sanitizeLimitOffset
} = require('../utils/security-enhanced');
const log = require('../utils/log');

/**
 * 基础Repository类
 * 提供通用的数据库操作方法
 */
class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
  }

  /**
   * 获取数据库连接
   */
  getConnection() {
    const db = getDatabase();
    if (!db) {
      throw new Error('数据库连接池为空');
    }
    return db;
  }

  /**
   * 执行查询（带超时）
   * @param {string} sql - SQL查询语句
   * @param {Array} params - 查询参数
   * @param {number} timeoutMs - 超时时间（毫秒）
   * @returns {Promise} 查询结果
   */
  async executeQueryWithTimeout(sql, params = [], timeoutMs = 10000) {
    return Promise.race([
      this.executeQuery(sql, params),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`数据库查询超时 [${this.tableName}]: ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  }

  /**
   * 执行查询
   * @param {string} sql - SQL查询语句
   * @param {Array} params - 查询参数
   * @returns {Promise} 查询结果
   */
  async executeQuery(sql, params = []) {
    let db = null;
    try {
      db = this.getConnection();

      // 确保db存在
      if (!db) {
        throw new Error(`数据库连接无效 [${this.tableName}]`);
      }

      log.debug(`执行查询 [${this.tableName}]:`, sql.substring(0, 100));

      // 对于云端数据库，使用 query 而不是 execute，更稳定
      // pool.query 返回 [rows, fields]
      const result = await db.query(sql, params);
      log.debug(`原始result类型:`, typeof result, '是否为数组:', Array.isArray(result));

      // 检查 result 是否有效
      if (!result) {
        log.warn(`数据库查询返回 null [${this.tableName}]`);
        return [];
      }

      // mysql2 pool.query 返回 [rows, fields]
      let rows = result;
      if (Array.isArray(result) && result.length >= 1) {
        rows = result[0];
        log.debug(`解构后rows类型:`, typeof rows, '是否为数组:', Array.isArray(rows));
      }

      // 确保rows是数组
      if (!Array.isArray(rows)) {
        log.warn(`数据库查询返回非数组结果 [${this.tableName}]，转换为数组:`, rows);
        return rows ? [rows] : [];
      }

      // 最终确保返回数组
      if (!rows) {
        log.warn(`数据库查询rows为空 [${this.tableName}]`);
        return [];
      }

      log.debug(`查询结果记录数:`, rows.length);
      return rows;
    } catch (error) {
      log.error(`数据库查询失败 [${this.tableName}]:`, {
        message: error.message,
        code: error.code,
        sql: sql,
        params: params,
        stack: error.stack
      });

      // 如果是连接问题，尝试重新获取连接
      if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') {
        log.debug(`尝试重新连接数据库 [${this.tableName}]...`);
        try {
          // 重新获取数据库连接
          const { getDatabase } = require('../config/database');
          const freshDb = getDatabase();
          if (freshDb && typeof freshDb.query === 'function') {
            // mysql2 pool.query 返回 [rows, fields]
            const queryResult = await freshDb.query(sql, params);
            if (Array.isArray(queryResult) && queryResult.length >= 1) {
              const retryRows = queryResult[0];
              if (Array.isArray(retryRows)) {
                log.debug(`重连查询成功 [${this.tableName}]`);
                return retryRows;
              }
            }
          }
        } catch (retryError) {
          log.error(`重连查询失败 [${this.tableName}]:`, retryError.message);
        }
      }

      throw error;
    }
  }

  /**
   * 查找所有记录
   * @param {Object} options - 查询选项
   * @returns {Promise} 查询结果
   */
  async findAll(options = {}) {
    const {
      where = '',
      orderBy = 'id DESC',
      limit = '',
      join = ''
    } = options;

    let sql = `SELECT * FROM ${this.tableName}`;

    if (join) {
      sql += ` ${join}`;
    }

    if (where) {
      sql += ` WHERE ${where}`;
    }

    // 🔒 安全：验证 ORDER BY 参数
    const safeOrderBy = sanitizeOrderBy(orderBy, this.tableName);
    if (safeOrderBy) {
      sql += ` ORDER BY ${safeOrderBy}`;
    }

    if (limit) {
      // 🔒 安全：验证 LIMIT 参数
      const safeLimit = sanitizeLimitOffset(limit, 10000);
      sql += ` LIMIT ${safeLimit}`;
    }

    const result = await this.executeQuery(sql);

    // 确保总是返回数组
    if (!result || !Array.isArray(result)) {
      log.warn(`findAll 返回非数组结果 [${this.tableName}]，转换为空数组`);
      return [];
    }

    return result;
  }

  /**
   * 根据ID查找记录
   * @param {number} id - 记录ID
   * @param {Object} options - 查询选项
   * @returns {Promise} 查询结果
   */
  async findById(id, options = {}) {
    const {
      select = '*',
      join = ''
    } = options;

    let sql = `SELECT ${select} FROM ${this.tableName}`;

    if (join) {
      sql += ` ${join}`;
    }

    sql += ` WHERE id = ?`;

    const results = await this.executeQuery(sql, [id]);

    // 确保 results 是数组
    if (!results || !Array.isArray(results)) {
      log.warn(`findById 返回非数组结果 [${this.tableName}]，返回 null`);
      return null;
    }

    return results.length > 0 ? results[0] : null;
  }

  /**
   * 根据条件查找记录
   * @param {Object} conditions - 查询条件
   * @param {Object} options - 查询选项
   * @returns {Promise} 查询结果
   */
  async findBy(conditions, options = {}) {
    const {
      select = '*',
      orderBy = 'id DESC',
      limit = '',
      join = ''
    } = options;

    const whereClause = Object.keys(conditions)
      .map(key => `${key} = ?`)
      .join(' AND ');

    const values = Object.values(conditions);

    let sql = `SELECT ${select} FROM ${this.tableName}`;

    if (join) {
      sql += ` ${join}`;
    }

    sql += ` WHERE ${whereClause}`;

    // 🔒 安全：验证 ORDER BY 参数
    const safeOrderBy = sanitizeOrderBy(orderBy, this.tableName);
    if (safeOrderBy) {
      sql += ` ORDER BY ${safeOrderBy}`;
    }

    if (limit) {
      // 🔒 安全：验证 LIMIT 参数
      const safeLimit = sanitizeLimitOffset(limit, 10000);
      sql += ` LIMIT ${safeLimit}`;
    }

    const result = await this.executeQuery(sql, values);

    // 确保总是返回数组
    if (!result || !Array.isArray(result)) {
      log.warn(`findBy 返回非数组结果 [${this.tableName}]，转换为空数组`);
      return [];
    }

    return result;
  }

  /**
   * 创建新记录
   * @param {Object} data - 要创建的数据
   * @returns {Promise} 创建结果
   */
  async create(data) {
    // 过滤掉 id 字段，让数据库自动生成
    const { id, ...dataToInsert } = data;
    const keys = Object.keys(dataToInsert);
    const values = Object.values(dataToInsert);
    const placeholders = keys.map(() => '?').join(', ');

    const sql = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;

    try {
      const db = this.getConnection();

      // 调试：考勤记录创建时打印关键信息
      if (this.tableName === 'attendance_records') {
        log.debug('创建记录:', dataToInsert);
      }

      // 对于云端数据库，使用 query 而不是 execute
      // pool.query 返回 [rows, fields] 或 [ResultSetHeader, fields]
      const queryResult = await db.query(sql, values);

      // 安全地解构结果
      let result;
      if (Array.isArray(queryResult) && queryResult.length > 0) {
        result = queryResult[0];
      } else {
        result = queryResult;
      }

      // 调试：打印插入结果
      if (this.tableName === 'attendance_records') {
        log.debug('创建结果:', {
          insertId: result?.insertId,
          affectedRows: result?.affectedRows
        });
      }

      return {
        id: result?.insertId || 0,
        affectedRows: result?.affectedRows || 0,
        data: { id: result?.insertId || 0, ...dataToInsert }
      };
    } catch (error) {
      log.error(`创建记录失败 [${this.tableName}]:`, error);
      throw error;
    }
  }

  /**
   * 更新记录
   * @param {number} id - 记录ID
   * @param {Object} data - 要更新的数据
   * @returns {Promise} 更新结果
   */
  async update(id, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);

    if (keys.length === 0) {
      throw new Error('没有要更新的字段');
    }

    const setClause = keys.map(key => `${key} = ?`).join(', ');
    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;

    const updateValues = [...values, id];

    try {
      const db = this.getConnection();
      log.debug(`更新记录 [${this.tableName}] SQL:`, sql.substring(0, 100));

      // 对于云端数据库，使用 query 而不是 execute
      // pool.query 返回 [rows, fields] 或 [OkPacket, fields]
      const queryResult = await db.query(sql, updateValues);
      log.debug(`更新结果类型:`, typeof queryResult, '是否为数组:', Array.isArray(queryResult));

      // 安全地解构结果
      let result;
      if (Array.isArray(queryResult) && queryResult.length > 0) {
        result = queryResult[0];
      } else {
        result = queryResult;
      }

      log.debug(`解构后结果:`, result);

      return {
        affectedRows: result?.affectedRows || 0,
        changedRows: result?.changedRows || 0,
        data: { id, ...data }
      };
    } catch (error) {
      log.error(`更新记录失败 [${this.tableName}]:`, error);
      throw error;
    }
  }

  /**
   * 删除记录
   * @param {number} id - 记录ID
   * @returns {Promise} 删除结果
   */
  async delete(id) {
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;

    try {
      const db = this.getConnection();
      const [result] = await db.execute(sql, [id]);
      return {
        affectedRows: result.affectedRows,
        deletedId: id
      };
    } catch (error) {
      log.error(`删除记录失败 [${this.tableName}]:`, error);
      throw error;
    }
  }

  /**
   * 批量删除记录
   * @param {Array} ids - ID数组
   * @returns {Promise} 删除结果
   */
  async deleteMany(ids) {
    if (!ids || ids.length === 0) {
      throw new Error('请提供要删除的ID列表');
    }

    const placeholders = ids.map(() => '?').join(', ');
    const sql = `DELETE FROM ${this.tableName} WHERE id IN (${placeholders})`;

    try {
      const db = this.getConnection();
      const [result] = await db.execute(sql, ids);
      return {
        affectedRows: result.affectedRows,
        deletedIds: ids
      };
    } catch (error) {
      log.error(`批量删除记录失败 [${this.tableName}]:`, error);
      throw error;
    }
  }

  /**
   * 统计记录数量
   * @param {Object} conditions - 查询条件
   * @returns {Promise} 统计结果
   */
  async count(conditions = {}) {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;

    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map(key => `${key} = ?`)
        .join(' AND ');
      const values = Object.values(conditions);

      sql += ` WHERE ${whereClause}`;

      const result = await this.executeQuery(sql, values);

      if (!result || !Array.isArray(result) || result.length === 0) {
        log.warn(`count 查询返回无效结果 [${this.tableName}]，返回 0`);
        return 0;
      }

      return result[0].count;
    } else {
      const result = await this.executeQuery(sql);

      if (!result || !Array.isArray(result) || result.length === 0) {
        log.warn(`count 查询返回无效结果 [${this.tableName}]，返回 0`);
        return 0;
      }

      return result[0].count;
    }
  }

  /**
   * 检查记录是否存在
   * @param {number} id - 记录ID
   * @returns {Promise} 是否存在
   */
  async exists(id) {
    const sql = `SELECT 1 FROM ${this.tableName} WHERE id = ? LIMIT 1`;
    const result = await this.executeQuery(sql, [id]);

    if (!result || !Array.isArray(result)) {
      log.warn(`exists 查询返回无效结果 [${this.tableName}]，返回 false`);
      return false;
    }

    return result.length > 0;
  }

  /**
   * 分页查询
   * @param {number} page - 页码
   * @param {number} limit - 每页数量
   * @param {Object} options - 查询选项
   * @returns {Promise} 分页结果
   */
  async paginate(page = 1, limit = 10, options = {}) {
    const {
      where = '',
      orderBy = 'id DESC',
      join = '',
      select = '*'
    } = options;

    // 🔒 安全：验证分页参数
    const safePage = Math.max(1, sanitizeLimitOffset(page, 100000));
    const safeLimit = Math.max(1, Math.min(100, sanitizeLimitOffset(limit, 100)));
    const offset = (safePage - 1) * safeLimit;

    // 查询数据
    let dataSql = `SELECT ${select} FROM ${this.tableName}`;

    if (join) {
      dataSql += ` ${join}`;
    }

    if (where) {
      dataSql += ` WHERE ${where}`;
    }

    // 🔒 安全：验证 ORDER BY 参数
    const safeOrderBy = sanitizeOrderBy(orderBy, this.tableName);
    dataSql += ` ORDER BY ${safeOrderBy} LIMIT ${safeLimit} OFFSET ${offset}`;

    // 查询总数
    let countSql = `SELECT COUNT(*) as total FROM ${this.tableName}`;

    if (join) {
      // 如果有JOIN，可能需要调整COUNT查询
      countSql = `SELECT COUNT(*) as total FROM ${this.tableName} ${join}`;
    }

    if (where) {
      countSql += ` WHERE ${where}`;
    }

    try {
      const [data, countResult] = await Promise.all([
        this.executeQuery(dataSql),
        this.executeQuery(countSql)
      ]);

      // 确保 data 是数组
      const safeData = Array.isArray(data) ? data : [];

      // 确保 countResult 是数组且有值
      const total = (countResult && Array.isArray(countResult) && countResult.length > 0)
        ? countResult[0].total
        : 0;

      const totalPages = Math.ceil(total / limit);

      return {
        data: safeData,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      log.error(`分页查询失败 [${this.tableName}]:`, error);
      throw error;
    }
  }
}

module.exports = BaseRepository;