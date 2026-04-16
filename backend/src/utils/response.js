/**
 * 统一API响应格式工具类
 * 合并 response.js 和 api-response.js，保持向后兼容
 */
const ERROR_CODES = require('../constants/errorCodes');

class ApiResponse {
  /**
   * 成功响应
   * 支持两种调用方式（向后兼容）：
   * - success(res, message, data, statusCode, meta) - 原response.js方式
   * - success(res, data, message, statusCode, extra) - 原api-response.js方式
   */
  static success(res, arg2, arg3, arg4, arg5) {
    // 检测调用方式：如果arg2是字符串，则是原response.js方式
    // 如果arg2不是字符串（是数据），则是原api-response.js方式
    let message, data, statusCode, extra;

    if (typeof arg2 === 'string') {
      // 原response.js方式: success(res, message, data, statusCode, meta)
      message = arg2;
      data = arg3;
      statusCode = arg4 || 200;
      extra = arg5 || {};
    } else {
      // 原api-response.js方式: success(res, data, message, statusCode, extra)
      data = arg2;
      message = arg3 || '操作成功';
      statusCode = arg4 || 200;
      extra = arg5 || {};
    }

    const response = {
      success: true,
      message,
      timestamp: new Date().toISOString()
    };

    if (data !== null && data !== undefined) {
      response.data = data;
    }

    // 合并额外数据（如分页信息）
    if (extra && Object.keys(extra).length > 0) {
      Object.assign(response, extra);
    }

    return res.status(statusCode).json(response);
  }

  /**
   * 错误响应
   * 支持两种调用方式（向后兼容）
   */
  static error(res, arg2, arg3, arg4) {
    let message, statusCode, error;

    if (typeof arg3 === 'number') {
      // 原response.js方式: error(res, message, statusCode, error)
      message = arg2 || '操作失败';
      statusCode = arg3 || 400;
      error = arg4 || null;
    } else {
      // 原api-response.js方式: error(res, message, statusCode, code)
      message = arg2 || '操作失败';
      statusCode = arg3 || 500;
      const code = arg4 || null;
      if (code) {
        return res.status(statusCode).json({
          success: false,
          message,
          code
        });
      }
    }

    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString()
    };

    if (error !== null && error !== undefined) {
      response.error = error;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * 分页响应
   * 支持两种调用方式（向后兼容）
   */
  static paginated(res, arg2, arg3, arg4) {
    let message, data, pagination;

    if (typeof arg2 === 'string') {
      // 原response.js方式: paginated(res, message, data, pagination)
      message = arg2 || '获取成功';
      data = arg3 || [];
      pagination = arg4 || {};
    } else {
      // 原api-response.js方式: paginated(res, data, pagination, message)
      data = arg2 || [];
      pagination = arg3 || {};
      message = arg4 || '获取成功';
    }

    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total: pagination.total || 0,
        totalPages: pagination.totalPages || Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
        hasNextPage: pagination.hasNextPage || false,
        hasPrevPage: pagination.hasPrevPage || false,
        ...pagination
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 创建成功响应
   */
  static created(res, arg2, arg3, arg4) {
    let message, data, statusCode;

    if (typeof arg2 === 'string') {
      // 原response.js方式: created(res, message, data)
      message = arg2 || '创建成功';
      data = arg3 || null;
      statusCode = arg4 || 201;
    } else {
      // 原api-response.js方式: created(res, message, data, statusCode)
      message = arg2 || '创建成功';
      data = arg3 || null;
      statusCode = arg4 || 201;
    }

    return this.success(res, message, data, statusCode);
  }

  /**
   * 验证错误响应
   */
  static validationError(res, message = '数据验证失败') {
    const errors = Array.isArray(message) ? message : [message];

    return res.status(422).json({
      success: false,
      message: '数据验证失败',
      errors,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 未授权响应
   */
  static unauthorized(res, message = '未授权访问') {
    return res.status(401).json({
      success: false,
      message,
      code: ERROR_CODES.UNAUTHORIZED,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 权限不足响应
   */
  static forbidden(res, message = '权限不足') {
    return res.status(403).json({
      success: false,
      message,
      code: ERROR_CODES.FORBIDDEN,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 资源未找到响应
   */
  static notFound(res, message = '资源未找到') {
    return res.status(404).json({
      success: false,
      message,
      code: ERROR_CODES.NOT_FOUND,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 请求参数错误响应
   */
  static badRequest(res, message = '请求参数错误') {
    return res.status(400).json({
      success: false,
      message,
      code: ERROR_CODES.BAD_REQUEST,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 服务器错误响应
   */
  static serverError(res, message = '服务器内部错误', error = null) {
    const response = {
      success: false,
      message,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      timestamp: new Date().toISOString()
    };

    // 在开发环境中包含错误详情
    if (process.env.NODE_ENV === 'development' && error) {
      response.error = typeof error === 'object' ? error.message || error : error;
      if (error?.stack) {
        response.stack = error.stack;
      }
    }

    return res.status(500).json(response);
  }

  /**
   * 无内容响应
   */
  static noContent(res, message = '操作成功') {
    return res.status(204).json({
      success: true,
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 请求冲突响应
   */
  static conflict(res, message = '资源冲突', error = null) {
    const response = {
      success: false,
      message,
      code: 'CONFLICT',
      timestamp: new Date().toISOString()
    };

    if (error) {
      response.error = error;
    }

    return res.status(409).json(response);
  }

  /**
   * 请求超时响应
   */
  static timeout(res, message = '请求超时') {
    return res.status(408).json({
      success: false,
      message,
      code: 'REQUEST_TIMEOUT',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 请求过于频繁响应
   */
  static tooManyRequests(res, message = '请求过于频繁', retryAfter = null) {
    const response = {
      success: false,
      message,
      code: 'TOO_MANY_REQUESTS',
      timestamp: new Date().toISOString()
    };

    if (retryAfter) {
      response.retryAfter = retryAfter;
      res.setHeader('Retry-After', retryAfter);
    }

    return res.status(429).json(response);
  }
}

module.exports = ApiResponse;
