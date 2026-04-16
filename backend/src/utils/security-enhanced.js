/**
 * 增强的安全工具库
 * 提供全面的安全防护功能
 * 用于补充现有的 security.js 中间件
 */

const log = require('./log');

// ============================================================================
// 1. SQL 注入防护工具
// ============================================================================

/**
 * SQL 排序白名单验证
 * 防止通过 ORDER BY 子句进行 SQL 注入
 */
const ORDER_BY_WHITELIST = {
  // 通用字段
  default: ['id', 'created_at', 'updated_at',
            'id ASC', 'id DESC',
            'created_at ASC', 'created_at DESC',
            'updated_at ASC', 'updated_at DESC'],

  // 品牌表
  brands: ['id', 'name', 'sort_order', 'created_at', 'updated_at',
           'id ASC', 'id DESC', 'name ASC', 'name DESC',
           'sort_order ASC', 'sort_order DESC',
           'created_at ASC', 'created_at DESC',
           'updated_at ASC', 'updated_at DESC'],

  // 供应商表
  suppliers: ['id', 'name', 'contact_phone', 'balance', 'created_at', 'updated_at',
              'id ASC', 'id DESC', 'name ASC', 'name DESC',
              'balance ASC', 'balance DESC'],

  // 客户表
  customers: ['id', 'name', 'phone', 'created_at', 'updated_at',
              'id ASC', 'id DESC', 'name ASC', 'name DESC'],

  // 销售表
  sales: ['id', 'sale_date', 'total_price', 'profit', 'created_at', 'updated_at',
          'id ASC', 'id DESC', 'sale_date ASC', 'sale_date DESC',
          'total_price ASC', 'total_price DESC'],

  // 库存表
  inventory: ['id', 'brand_id', 'model_id', 'quantity', 'updated_at',
              'id ASC', 'id DESC', 'quantity ASC', 'quantity DESC'],

  // 用户表
  users: ['id', 'username', 'name', 'created_at', 'updated_at',
          'id ASC', 'id DESC', 'username ASC', 'username DESC'],

  // 员工表
  employees: ['id', 'name', 'phone', 'created_at', 'updated_at',
              'id ASC', 'id DESC', 'name ASC', 'name DESC'],

  // 考勤表
  attendance: ['id', 'record_date', 'employee_id', 'created_at', 'updated_at',
               'id ASC', 'id DESC', 'record_date ASC', 'record_date DESC'],

  // 薪资表
  salary: ['id', 'employee_id', 'period', 'created_at', 'updated_at',
           'id ASC', 'id DESC', 'period ASC', 'period DESC'],
};

/**
 * 验证并清理 ORDER BY 子句
 * @param {string} orderBy - 要验证的排序字符串
 * @param {string} tableName - 表名（用于获取特定白名单）
 * @returns {string} 安全的排序字符串
 */
function sanitizeOrderBy(orderBy, tableName = 'default') {
  if (!orderBy || typeof orderBy !== 'string') {
    return 'id DESC';
  }

  // 获取允许的排序字段
  const allowedFields = ORDER_BY_WHITELIST[tableName] || ORDER_BY_WHITELIST.default;

  // 检查是否在白名单中
  const normalizedOrderBy = orderBy.trim();
  if (allowedFields.includes(normalizedOrderBy)) {
    return normalizedOrderBy;
  }

  // 如果不在白名单中，返回默认值
  log.warn(`[安全警告] 检测到可疑的 ORDER BY 参数: "${orderBy}"，已使用默认值`);
  return 'id DESC';
}

/**
 * 验证并清理 LIMIT 和 OFFSET 值
 * @param {number|string} value - 要验证的值
 * @param {number} max - 最大允许值
 * @returns {number} 安全的数字
 */
function sanitizeLimitOffset(value, max = 10000) {
  const num = parseInt(value, 10);

  if (isNaN(num) || num < 0) {
    return 0;
  }

  if (num > max) {
    log.warn(`[安全警告] LIMIT/OFFSET 值 ${num} 超过最大值 ${max}，已使用最大值`);
    return max;
  }

  return num;
}

/**
 * 验证表名（防止表名注入）
 * @param {string} tableName - 要验证的表名
 * @param {Array} allowedTables - 允许的表名列表
 * @returns {boolean} 是否有效
 */
function isValidTableName(tableName, allowedTables) {
  if (!tableName || typeof tableName !== 'string') {
    return false;
  }

  // 只允许字母、数字、下划线
  const validPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  if (!validPattern.test(tableName)) {
    return false;
  }

  // 检查是否在允许列表中
  return allowedTables.includes(tableName);
}

/**
 * 验证字段名（防止字段注入）
 * @param {string} fieldName - 要验证的字段名
 * @returns {boolean} 是否有效
 */
function isValidFieldName(fieldName) {
  if (!fieldName || typeof fieldName !== 'string') {
    return false;
  }

  // 只允许字母、数字、下划线
  const validPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  return validPattern.test(fieldName);
}

/**
 * 清理并验证 SQL 条件字段名
 * 防止通过对象 key 注入 SQL 片段
 * @param {string[]} fieldNames - 字段名列表
 * @param {string} context - 上下文信息，便于日志定位
 * @returns {string[]} 安全字段名列表
 */
function sanitizeConditionFieldNames(fieldNames, context = 'unknown') {
  if (!Array.isArray(fieldNames)) {
    return [];
  }

  const safeFields = [];

  for (const fieldName of fieldNames) {
    if (isValidFieldName(fieldName)) {
      safeFields.push(fieldName);
      continue;
    }

    log.warn(`[安全警告] 检测到可疑字段名: "${fieldName}"，上下文: ${context}，已拒绝处理`);
  }

  return safeFields;
}

// ============================================================================
// 2. XSS 防护工具
// ============================================================================

/**
 * HTML 实体编码
 * @param {string} str - 要编码的字符串
 * @returns {string} 编码后的字符串
 */
function escapeHtml(str) {
  if (str === null || str === undefined) {
    return '';
  }

  if (typeof str !== 'string') {
    str = String(str);
  }

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * 清理用户输入（移除潜在的恶意内容）
 * @param {string} input - 用户输入
 * @returns {string} 清理后的输入
 */
function sanitizeInput(input) {
  if (input === null || input === undefined) {
    return '';
  }

  if (typeof input !== 'string') {
    input = String(input);
  }

  // 移除控制字符（保留换行和制表符）
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 移除危险的 JavaScript 模式
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/vbscript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, ''); // 移除事件处理器如 onclick=
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gis, ''); // 移除 script 标签
  sanitized = sanitized.replace(/<iframe[^>]*>.*?<\/iframe>/gis, ''); // 移除 iframe 标签

  return sanitized.trim();
}

/**
 * 清理对象中的所有字符串值
 * @param {Object} obj - 要清理的对象
 * @returns {Object} 清理后的对象
 */
function sanitizeObject(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  const sanitized = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      // 验证字段名
      if (!isValidFieldName(key)) {
        log.warn(`[安全警告] 检测到无效的字段名: "${key}"，已跳过`);
        continue;
      }

      const value = obj[key];
      if (typeof value === 'string') {
        sanitized[key] = sanitizeInput(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item =>
          typeof item === 'string' ? sanitizeInput(item) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

/**
 * 清理查询参数
 * @param {Object} query - 查询参数对象
 * @returns {Object} 清理后的查询参数
 */
function sanitizeQuery(query) {
  const sanitized = {};

  for (const key in query) {
    if (query.hasOwnProperty(key)) {
      if (!isValidFieldName(key)) {
        log.warn(`[安全警告] 检测到无效的查询参数名: "${key}"，已跳过`);
        continue;
      }

      const value = query[key];
      if (typeof value === 'string') {
        sanitized[key] = sanitizeInput(value);
      } else if (typeof value === 'number' && !isNaN(value)) {
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item =>
          typeof item === 'string' ? sanitizeInput(item) : item
        );
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

// ============================================================================
// 3. 输入验证工具
// ============================================================================

/**
 * 验证邮箱地址
 * @param {string} email - 邮箱地址
 * @returns {boolean} 是否有效
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  // 更严格的邮箱验证
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * 验证电话号码（中国大陆）
 * @param {string} phone - 电话号码
 * @returns {boolean} 是否有效
 */
function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  // 支持手机号和固定电话
  const mobileRegex = /^1[3-9]\d{9}$/;
  const landlineRegex = /^0\d{2,3}-?\d{7,8}$/;
  return mobileRegex.test(phone) || landlineRegex.test(phone);
}

/**
 * 验证身份证号（中国大陆）
 * @param {string} idCard - 身份证号
 * @returns {boolean} 是否有效
 */
function isValidIdCard(idCard) {
  if (!idCard || typeof idCard !== 'string') {
    return false;
  }

  // 15位或18位
  const idCardRegex = /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
  if (!idCardRegex.test(idCard)) {
    return false;
  }

  // 验证校验码（18位）
  if (idCard.length === 18) {
    const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];

    let sum = 0;
    for (let i = 0; i < 17; i++) {
      sum += parseInt(idCard[i]) * weights[i];
    }

    const checkCode = checkCodes[sum % 11];
    return idCard[17].toUpperCase() === checkCode;
  }

  return true;
}

/**
 * 验证金额
 * @param {number|string} amount - 金额
 * @returns {boolean} 是否有效
 */
function isValidAmount(amount) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) {
    return false;
  }
  return num >= 0 && num <= 999999999.99 && /^\d+(\.\d{1,2})?$/.test(String(num));
}

// ============================================================================
// 4. 密码安全工具
// ============================================================================

/**
 * 验证密码强度
 * @param {string} password - 密码
 * @returns {Object} 验证结果 { valid: boolean, errors: string[], strength: string }
 */
function validatePassword(password) {
  const result = {
    valid: true,
    errors: [],
    strength: 'weak'
  };

  if (!password) {
    result.valid = false;
    result.errors.push('密码不能为空');
    return result;
  }

  if (password.length < 8) {
    result.valid = false;
    result.errors.push('密码长度至少为8位');
  }

  if (password.length > 128) {
    result.valid = false;
    result.errors.push('密码长度不能超过128位');
  }

  // 检查密码强度
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;

  if (strength <= 2) result.strength = 'weak';
  else if (strength <= 4) result.strength = 'medium';
  else result.strength = 'strong';

  return result;
}

/**
 * 生成安全的随机密码
 * @param {number} length - 密码长度（默认16）
 * @returns {string} 随机密码
 */
function generateSecurePassword(length = 16) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  // 确保至少包含每种字符类型
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  password += '0123456789'[Math.floor(Math.random() * 10)];
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)];

  // 填充剩余长度
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // 打乱字符顺序
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// ============================================================================
// 5. 文件安全工具
// ============================================================================

/**
 * 允许的文件扩展名白名单
 */
const ALLOWED_FILE_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', // 图片
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', // 文档
];

/**
 * 允许的 MIME 类型白名单
 */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

/**
 * 验证文件扩展名
 * @param {string} filename - 文件名
 * @returns {boolean} 是否有效
 */
function isValidFileExtension(filename) {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return ALLOWED_FILE_EXTENSIONS.includes(ext);
}

/**
 * 验证 MIME 类型
 * @param {string} mimeType - MIME 类型
 * @returns {boolean} 是否有效
 */
function isValidMimeType(mimeType) {
  if (!mimeType || typeof mimeType !== 'string') {
    return false;
  }
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

/**
 * 生成安全的文件名
 * @param {string} originalName - 原始文件名
 * @returns {string} 安全的文件名
 */
function generateSecureFilename(originalName) {
  if (!originalName || typeof originalName !== 'string') {
    return `file_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  // 获取扩展名
  const ext = originalName.toLowerCase().substring(originalName.lastIndexOf('.'));
  if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
    throw new Error('不允许的文件类型');
  }

  // 生成随机文件名
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}_${random}${ext}`;
}

/**
 * 验证文件大小
 * @param {number} size - 文件大小（字节）
 * @param {number} maxSize - 最大允许大小（字节，默认5MB）
 * @returns {boolean} 是否有效
 */
function isValidFileSize(size, maxSize = 5 * 1024 * 1024) {
  const num = parseInt(size, 10);
  return !isNaN(num) && num > 0 && num <= maxSize;
}

// ============================================================================
// 6. 路径安全工具
// ============================================================================

/**
 * 验证路径（防止路径遍历攻击）
 * @param {string} path - 路径
 * @returns {boolean} 是否安全
 */
function isSafePath(path) {
  if (!path || typeof path !== 'string') {
    return false;
  }

  // 检查路径遍历模式
  if (path.includes('..') || path.includes('~') || path.startsWith('/')) {
    return false;
  }

  // 只允许安全字符
  const safePattern = /^[a-zA-Z0-9_\-./]+$/;
  return safePattern.test(path);
}

/**
 * 规范化路径
 * @param {string} path - 路径
 * @returns {string} 规范化后的路径
 */
function normalizePath(path) {
  if (!path || typeof path !== 'string') {
    return '';
  }

  // 移除危险字符
  return path
    .replace(/\.\./g, '')
    .replace(/~/g, '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .trim();
}

// ============================================================================
// 导出所有工具函数
// ============================================================================

module.exports = {
  // SQL 注入防护
  sanitizeOrderBy,
  sanitizeLimitOffset,
  isValidTableName,
  isValidFieldName,
  sanitizeConditionFieldNames,
  ORDER_BY_WHITELIST,

  // XSS 防护
  escapeHtml,
  sanitizeInput,
  sanitizeObject,
  sanitizeQuery,

  // 输入验证
  isValidEmail,
  isValidPhone,
  isValidIdCard,
  isValidAmount,

  // 密码安全
  validatePassword,
  generateSecurePassword,

  // 文件安全
  isValidFileExtension,
  isValidMimeType,
  generateSecureFilename,
  isValidFileSize,
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_MIME_TYPES,

  // 路径安全
  isSafePath,
  normalizePath,
};
