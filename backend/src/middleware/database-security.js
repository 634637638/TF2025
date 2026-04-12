/**
 * 数据库安全中间件
 * 用于保护数据库查询免受SQL注入和其他安全威胁
 */

const {
  validatePagination,
  validateSortField,
  validateSortDirection,
  detectSqlInjection,
  createSafeParams
} = require('../utils/securityUtils');
const log = require('../utils/log');

/**
 * 验证查询参数中间件
 * 自动验证和清理常见的查询参数（分页、排序、搜索等）
 */
function validateQueryParams(options = {}) {
  const {
    allowedSortFields = ['id', 'created_at', 'updated_at'],
    defaultSortField = 'id',
    defaultSortDirection = 'DESC',
    maxLimit = 100,
    defaultLimit = 10
  } = options;

  return (req, res, next) => {
    try {
      // 验证分页参数
      const pagination = validatePagination(
        req.query.page,
        req.query.limit,
        maxLimit
      );

      // 验证排序参数
      const sortField = validateSortField(
        req.query.sort || req.query.sortBy,
        allowedSortFields,
        defaultSortField
      );

      const sortDirection = validateSortDirection(
        req.query.order || req.query.sortOrder,
        defaultSortDirection
      );

      // 将验证后的参数附加到request对象
      req.validatedQuery = {
        ...req.query,
        page: pagination.page,
        limit: pagination.limit,
        offset: pagination.offset,
        sort: sortField,
        order: sortDirection
      };

      next();
    } catch (error) {
      log.error('查询参数验证失败:', error);
      return res.status(400).json({
        success: false,
        message: '无效的查询参数',
        code: 'INVALID_QUERY_PARAMS',
        details: error.message
      });
    }
  };
}

/**
 * 验证请求体参数中间件
 * 自动验证和清理请求体中的参数
 */
function validateBodyParams(options = {}) {
  const {
    requiredParams = [],
    optionalParams = [],
    strict = false // 是否严格模式（不允许额外参数）
  } = options;

  return (req, res, next) => {
    try {
      // 检查必需参数
      const missingParams = requiredParams.filter(param => !(param in req.body));
      if (missingParams.length > 0) {
        return res.status(400).json({
          success: false,
          message: '缺少必需参数',
          code: 'MISSING_REQUIRED_PARAMS',
          details: missingParams
        });
      }

      // 创建安全的参数对象
      const safeParams = createSafeParams(req.body, requiredParams);

      // 如果是严格模式，检查是否有额外参数
      if (strict) {
        const allowedParams = [...requiredParams, ...optionalParams];
        const extraParams = Object.keys(req.body).filter(
          key => !allowedParams.includes(key)
        );

        if (extraParams.length > 0) {
          return res.status(400).json({
            success: false,
            message: '包含不允许的参数',
            code: 'EXTRA_PARAMS_NOT_ALLOWED',
            details: extraParams
          });
        }
      }

      // 将安全参数附加到request对象
      req.safeBody = safeParams;

      next();
    } catch (error) {
      log.error('请求体参数验证失败:', error);
      return res.status(400).json({
        success: false,
        message: '无效的请求参数',
        code: 'INVALID_BODY_PARAMS',
        details: error.message
      });
    }
  };
}

/**
 * SQL注入检测中间件
 * 检测请求中的潜在SQL注入攻击
 */
function detectSqlInjectionMiddleware() {
  return (req, res, next) => {
    const checkValue = (value, path = '') => {
      if (typeof value === 'string') {
        if (detectSqlInjection(value)) {
          throw new Error(`检测到潜在的SQL注入攻击: ${path}`);
        }
      } else if (typeof value === 'object' && value !== null) {
        for (const [key, val] of Object.entries(value)) {
          checkValue(val, path ? `${path}.${key}` : key);
        }
      }
    };

    try {
      // 检查查询参数
      checkValue(req.query, 'query');

      // 检查请求体
      checkValue(req.body, 'body');

      // 检查路径参数
      checkValue(req.params, 'params');

      next();
    } catch (error) {
      log.error('SQL注入检测:', error.message);
      return res.status(403).json({
        success: false,
        message: '请求包含不安全的内容',
        code: 'SECURITY_VIOLATION',
        details: error.message
      });
    }
  };
}

/**
 * 创建安全的SQL查询构建器
 * 提供安全的SQL查询构建方法
 */
class SafeQueryBuilder {
  constructor(baseQuery) {
    this.query = baseQuery || '';
    this.params = [];
    this.whereConditions = [];
  }

  /**
   * 添加WHERE条件
   */
  where(condition, ...params) {
    this.whereConditions.push(condition);
    this.params.push(...params);
    return this;
  }

  /**
   * 添加WHERE条件（如果值存在）
   */
  whereIf(condition, value, ...params) {
    if (value !== undefined && value !== null && value !== '') {
      this.whereConditions.push(condition);
      this.params.push(...params);
    }
    return this;
  }

  /**
   * 添加LIKE条件
   */
  whereLike(field, value) {
    if (value && typeof value === 'string') {
      this.whereConditions.push(`${field} LIKE ?`);
      this.params.push(`%${value}%`);
    }
    return this;
  }

  /**
   * 添加IN条件
   */
  whereIn(field, values) {
    if (Array.isArray(values) && values.length > 0) {
      const placeholders = values.map(() => '?').join(', ');
      this.whereConditions.push(`${field} IN (${placeholders})`);
      this.params.push(...values);
    }
    return this;
  }

  /**
   * 添加ORDER BY
   */
  orderBy(field, direction = 'ASC') {
    // 验证排序字段和方向
    const safeField = field.replace(/[^a-zA-Z0-9_.]/g, '');
    const safeDirection = direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    this.query += ` ORDER BY ${safeField} ${safeDirection}`;
    return this;
  }

  /**
   * 添加LIMIT和OFFSET
   */
  limit(limit, offset = 0) {
    this.query += ` LIMIT ? OFFSET ?`;
    this.params.push(parseInt(limit) || 10, parseInt(offset) || 0);
    return this;
  }

  /**
   * 构建最终查询
   */
  build() {
    let finalQuery = this.query;

    if (this.whereConditions.length > 0) {
      finalQuery += ` WHERE ${this.whereConditions.join(' AND ')}`;
    }

    return {
      query: finalQuery,
      params: this.params
    };
  }

  /**
   * 获取查询字符串（不包含参数）
   */
  toString() {
    return this.query;
  }
}

/**
 * 创建安全的查询构建器
 */
function createSafeQuery(baseQuery) {
  return new SafeQueryBuilder(baseQuery);
}

/**
 * 数据库查询执行包装器
 * 提供额外的安全检查和错误处理
 */
function safeExecuteQuery(pool, query, params = []) {
  return new Promise((resolve, reject) => {
    try {
      // 验证查询和参数
      if (typeof query !== 'string') {
        throw new Error('查询必须是字符串');
      }

      if (!Array.isArray(params)) {
        throw new Error('参数必须是数组');
      }

      // 检测查询中的潜在注入
      const suspiciousPatterns = [
        /(\b(DROP|DELETE|UPDATE|INSERT)\s+\w+)/gi,
        /(--|\/\*|\*\/)/g,
        /(\b(UNION|EXEC|SCRIPT)\b)/gi
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(query)) {
          throw new Error('查询包含可疑内容');
        }
      }

      // 执行查询
      pool.execute(query, params)
        .then(([results, fields]) => {
          resolve({ results, fields });
        })
        .catch(error => {
          log.error('数据库查询失败:', error);
          reject(error);
        });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  validateQueryParams,
  validateBodyParams,
  detectSqlInjectionMiddleware,
  SafeQueryBuilder,
  createSafeQuery,
  safeExecuteQuery
};
