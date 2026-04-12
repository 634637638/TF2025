/**
 * 会员号生成工具
 * 提供统一的会员号生成功能，避免代码重复
 */

const { getDatabase } = require('../config/database');
const log = require('./log');

/**
 * 获取数据库连接
 * 支持多种调用方式:
 * - 传入 connection 对象
 * - 传入 db 对象 (调用 .query 或 .getDatabase().query)
 * - 不传参数，自动获取
 */
function getDbConnection(dbInstance) {
  if (!dbInstance) {
    return getDatabase();
  }
  // 如果传入的是 connection，直接使用
  if (typeof dbInstance.query === 'function' && typeof dbInstance.execute !== 'function') {
    return dbInstance;
  }
  // 如果传入的是 db 对象，尝试获取连接池
  if (typeof dbInstance.getDatabase === 'function') {
    return dbInstance.getDatabase();
  }
  return dbInstance;
}

/**
 * 生成唯一会员号
 * 格式: TF + 6位数字 (如 TF000001)
 * 支持自动处理重复会员号
 *
 * @param {Object} options - 配置选项
 * @param {Object} options.connection - 数据库连接（可选）
 * @param {Object} options.db - 数据库实例（可选，会调用 getDatabase()）
 * @returns {Promise<string>} 生成的会员号
 */
async function generateMemberNumber(options = {}) {
  const { connection, db: dbInstance } = options;
  const db = connection ? null : (dbInstance ? getDbConnection(dbInstance) : getDatabase());
  const maxAttempts = 10;
  let attempts = 0;

  // 获取当前最大的会员编号
  const getMaxMemberNumber = async () => {
    const query = 'SELECT member_number FROM customers WHERE member_number IS NOT NULL AND member_number != "" ORDER BY member_number DESC LIMIT 1';
    if (connection) {
      const [result] = await connection.query(query);
      return result;
    }
    const [result] = await db.query(query);
    return result;
  };

  // 检查会员号是否已存在
  const checkExists = async (memberNumber) => {
    const query = 'SELECT id FROM customers WHERE member_number = ?';
    if (connection) {
      const [result] = await connection.query(query, [memberNumber]);
      return result.length > 0;
    }
    const [result] = await db.query(query, [memberNumber]);
    return result.length > 0;
  };

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const result = await getMaxMemberNumber();

      let maxNumber = 0;
      if (result.length > 0 && result[0].member_number) {
        const lastMemberNumber = result[0].member_number;
        // 处理不同格式的会员号
        if (lastMemberNumber.startsWith('TF')) {
          maxNumber = parseInt(lastMemberNumber.substring(2), 10) || 0;
        } else if (lastMemberNumber.startsWith('C')) {
          maxNumber = parseInt(lastMemberNumber.substring(1), 10) || 0;
        }
      }

      // 生成新的会员编号
      const newNumber = maxNumber + attempts;
      const paddedNumber = newNumber.toString().padStart(6, '0');
      const memberNumber = `TF${paddedNumber}`;

      // 检查是否已存在
      const exists = await checkExists(memberNumber);
      if (!exists) {
        return memberNumber;
      }

      log.debug(`会员号 ${memberNumber} 已存在，进行第 ${attempts + 1} 次尝试`);
    } catch (error) {
      log.error(`生成会员号失败 (尝试 ${attempts}):`, error);
      if (attempts >= maxAttempts) {
        const timestamp = Date.now().toString().slice(-6);
        return `TF${timestamp}`;
      }
    }
  }

  // 如果所有尝试都失败，使用时间戳
  const timestamp = Date.now().toString().slice(-6);
  return `TF${timestamp}`;
}

/**
 * 验证会员号格式
 * @param {string} memberNumber - 会员号
 * @returns {boolean} 是否有效
 */
function validateMemberNumber(memberNumber) {
  if (!memberNumber || typeof memberNumber !== 'string') {
    return false;
  }
  // 支持 TF 开头的6位数字，或 C 开头的数字
  return /^TF\d{6}$/.test(memberNumber) || /^C\d+$/.test(memberNumber);
}

module.exports = {
  generateMemberNumber,
  validateMemberNumber
};
