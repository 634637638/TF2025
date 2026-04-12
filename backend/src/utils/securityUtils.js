/**
 * 安全工具函数
 * 用于输入验证、清理和防止常见的安全漏洞
 */

/**
 * 验证和清理数字输入
 * @param {any} value - 要验证的值
 * @param {number} defaultValue - 默认值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 验证后的数字
 */
function validateNumber(value, defaultValue = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const num = parseInt(value, 10);

  if (isNaN(num)) {
    return defaultValue;
  }

  if (num < min) {
    return min;
  }

  if (num > max) {
    return max;
  }

  return num;
}

/**
 * 验证和清理字符串输入
 * @param {any} value - 要验证的值
 * @param {string} defaultValue - 默认值
 * @param {number} maxLength - 最大长度
 * @returns {string} 验证后的字符串
 */
function validateString(value, defaultValue = '', maxLength = 255) {
  if (typeof value !== 'string') {
    return defaultValue;
  }

  // 移除潜在的恶意字符
  let cleaned = value.trim();

  // 移除控制字符（除了换行、回车、制表符）
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 限制长度
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);
  }

  return cleaned;
}

/**
 * 验证和清理排序字段
 * @param {string} field - 排序字段
 * @param {Array} allowedFields - 允许的字段列表
 * @param {string} defaultField - 默认字段
 * @returns {string} 验证后的排序字段
 */
function validateSortField(field, allowedFields = [], defaultField = 'id') {
  const cleanField = validateString(field, defaultField);

  if (!allowedFields.includes(cleanField)) {
    return defaultField;
  }

  return cleanField;
}

/**
 * 验证和清理排序方向
 * @param {string} direction - 排序方向
 * @param {string} defaultDirection - 默认方向
 * @returns {string} 验证后的排序方向
 */
function validateSortDirection(direction, defaultDirection = 'ASC') {
  const cleanDirection = validateString(direction, defaultDirection).toUpperCase();

  if (cleanDirection !== 'ASC' && cleanDirection !== 'DESC') {
    return defaultDirection;
  }

  return cleanDirection;
}

/**
 * 验证和清理分页参数
 * @param {any} page - 页码
 * @param {any} limit - 每页数量
 * @param {number} maxLimit - 最大每页数量
 * @returns {Object} 验证后的分页参数 {page, limit, offset}
 */
function validatePagination(page = 1, limit = 10, maxLimit = 100) {
  const validatedPage = validateNumber(page, 1, 1);
  const validatedLimit = validateNumber(limit, 10, 1, maxLimit);
  const offset = (validatedPage - 1) * validatedLimit;

  return {
    page: validatedPage,
    limit: validatedLimit,
    offset: offset
  };
}

/**
 * 验证邮箱格式
 * @param {string} email - 邮箱地址
 * @returns {boolean} 是否有效
 */
function isValidEmail(email) {
  const cleanEmail = validateString(email);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(cleanEmail);
}

/**
 * 验证手机号格式（简单验证）
 * @param {string} phone - 手机号
 * @returns {boolean} 是否有效
 */
function isValidPhone(phone) {
  const cleanPhone = validateString(phone).replace(/[-\s]/g, '');
  const phoneRegex = /^\d{10,15}$/;
  return phoneRegex.test(cleanPhone);
}

/**
 * 验证用户名格式
 * @param {string} username - 用户名
 * @returns {boolean} 是否有效
 */
function isValidUsername(username) {
  const cleanUsername = validateString(username);
  // 用户名只允许字母、数字、下划线，3-20个字符
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(cleanUsername);
}

/**
 * 检测潜在的SQL注入攻击
 * @param {string} input - 输入字符串
 * @returns {boolean} 是否可疑
 */
function detectSqlInjection(input) {
  if (typeof input !== 'string') {
    return false;
  }

  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(--|\/\*|\*\/|;|'|")/,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\b(OR|AND)\s+['"][\w\s]+['"]\s*=\s*['"][\w\s]+['"])/i,
    /(\b(OR|AND)\s+TRUE|FALSE\b)/i,
    /(1\s*=\s*1|1\s*=\s*1\s*--)/
  ];

  return suspiciousPatterns.some(pattern => pattern.test(input));
}

/**
 * 检测潜在的XSS攻击
 * @param {string} input - 输入字符串
 * @returns {boolean} 是否可疑
 */
function detectXss(input) {
  if (typeof input !== 'string') {
    return false;
  }

  const suspiciousPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<[^>]*>/g
  ];

  return suspiciousPatterns.some(pattern => pattern.test(input));
}

/**
 * 清理HTML以防止XSS攻击
 * @param {string} html - HTML字符串
 * @returns {string} 清理后的HTML
 */
function sanitizeHtml(html) {
  if (typeof html !== 'string') {
    return '';
  }

  // 移除脚本标签
  let cleaned = html.replace(/<script[^>]*>.*?<\/script>/gi, '');

  // 移除危险的HTML属性
  cleaned = cleaned.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');

  // 移除javascript:协议
  cleaned = cleaned.replace(/javascript:/gi, '');

  return cleaned;
}

/**
 * 创建安全的数据库查询参数
 * @param {Object} params - 原始参数
 * @param {Array} requiredParams - 必需参数列表
 * @returns {Object} 安全的参数对象
 */
function createSafeParams(params, requiredParams = []) {
  const safeParams = {};

  // 验证必需参数
  for (const param of requiredParams) {
    if (!(param in params)) {
      throw new Error(`缺少必需参数: ${param}`);
    }
  }

  // 清理所有参数
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) {
      safeParams[key] = null;
    } else if (typeof value === 'string') {
      // 检测SQL注入
      if (detectSqlInjection(value)) {
        throw new Error(`参数 ${key} 包含潜在的SQL注入内容`);
      }
      safeParams[key] = value;
    } else if (typeof value === 'number') {
      safeParams[key] = validateNumber(value);
    } else if (Array.isArray(value)) {
      safeParams[key] = value.map(item =>
        typeof item === 'string' ? validateString(item) : item
      );
    } else {
      safeParams[key] = value;
    }
  }

  return safeParams;
}

module.exports = {
  validateNumber,
  validateString,
  validateSortField,
  validateSortDirection,
  validatePagination,
  isValidEmail,
  isValidPhone,
  isValidUsername,
  detectSqlInjection,
  detectXss,
  sanitizeHtml,
  createSafeParams
};