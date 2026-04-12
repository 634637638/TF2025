/**
 * 基础Service类
 * 提供通用的业务逻辑方法
 */
const log = require('../utils/log');

class BaseService {
  constructor(repository) {
    this.repository = repository;
  }

  /**
   * 验证必填字段
   * @param {Object} data - 要验证的数据
   * @param {Array} requiredFields - 必填字段列表
   * @throws {Error} 如果缺少必填字段
   */
  validateRequiredFields(data, requiredFields) {
    const missingFields = requiredFields.filter(field =>
      data[field] === undefined || data[field] === null || data[field] === ''
    );

    if (missingFields.length > 0) {
      throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
    }
  }

  /**
   * 格式化响应数据
   * @param {boolean} success - 操作是否成功
   * @param {string} message - 响应消息
   * @param {*} data - 响应数据
   * @param {Object} meta - 元数据（如分页信息）
   * @returns {Object} 格式化的响应对象
   */
  formatResponse(success = true, message = '', data = null, meta = null) {
    const response = {
      success,
      message
    };

    if (data !== null) {
      response.data = data;
    }

    if (meta !== null) {
      response.meta = meta;
    }

    return response;
  }

  /**
   * 格式化成功响应
   * @param {string} message - 成功消息
   * @param {*} data - 响应数据
   * @param {Object} meta - 元数据
   * @returns {Object} 成功响应对象
   */
  successResponse(message = '操作成功', data = null, meta = null) {
    return this.formatResponse(true, message, data, meta);
  }

  /**
   * 格式化错误响应
   * @param {string} message - 错误消息
   * @param {*} error - 错误详情
   * @returns {Object} 错误响应对象
   */
  errorResponse(message = '操作失败', error = null) {
    const response = this.formatResponse(false, message);
    if (error) {
      response.error = error;
    }
    return response;
  }

  /**
   * 验证ID是否有效
   * @param {number|string} id - 要验证的ID
   * @returns {number} 验证后的ID
   * @throws {Error} 如果ID无效
   */
  validateId(id) {
    const numId = parseInt(id, 10);
    if (isNaN(numId) || numId <= 0) {
      throw new Error('无效的ID');
    }
    return numId;
  }

  /**
   * 验证分页参数
   * @param {number} page - 页码
   * @param {number} limit - 每页数量
   * @returns {Object} 验证后的分页参数
   */
  validatePaginationParams(page = 1, limit = 10) {
    const validPage = Math.max(1, parseInt(page, 10) || 1);
    const validLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    return { page: validPage, limit: validLimit };
  }

  /**
   * 处理数据库错误
   * @param {Error} error - 数据库错误
   * @returns {Object} 格式化的错误响应
   */
  handleDatabaseError(error) {
    log.error('数据库操作失败', error);

    // 处理常见的数据库错误
    if (error.code === 'ER_DUP_ENTRY') {
      return this.errorResponse('数据已存在，请检查唯一性约束');
    }

    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return this.errorResponse('引用的数据不存在');
    }

    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return this.errorResponse('无法删除，该数据被其他记录引用');
    }

    if (error.message.includes('数据库连接池为空')) {
      return this.errorResponse('数据库连接失败，请稍后重试');
    }

    return this.errorResponse('数据库操作失败', error.message);
  }

  /**
   * 处理验证错误
   * @param {Error} error - 验证错误
   * @returns {Object} 格式化的错误响应
   */
  handleValidationError(error) {
    log.error('数据验证失败', error);
    return this.errorResponse('数据验证失败', error.message);
  }

  /**
   * 记录操作日志
   * @param {string} action - 操作类型
   * @param {Object} data - 操作数据
   * @param {Object} user - 操作用户
   */
  logOperation(action, data, user = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      data: JSON.stringify(data),
      user: user ? { id: user.id, username: user.username } : null
    };

    log.info('操作日志', logEntry);

    // 这里可以扩展为写入数据库或日志文件
    // 例如: this.logger.info(logEntry);
  }

  /**
   * 检查资源是否存在
   * @param {number} id - 资源ID
   * @returns {Promise<boolean>} 是否存在
   */
  async checkResourceExists(id) {
    try {
      return await this.repository.exists(id);
    } catch (error) {
      log.error('检查资源是否存在失败', error);
      return false;
    }
  }

  /**
   * 获取单个资源
   * @param {number} id - 资源ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 查询结果
   */
  async getById(id, options = {}) {
    try {
      const validId = this.validateId(id);
      const resource = await this.repository.findById(validId, options);

      if (!resource) {
        return this.errorResponse('资源不存在');
      }

      return this.successResponse('获取成功', resource);
    } catch (error) {
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 获取资源列表
   * @param {Object} filters - 过滤条件
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 查询结果
   */
  async getAll(filters = {}, options = {}) {
    try {
      const resources = await this.repository.findAll(options);
      return this.successResponse('获取成功', resources);
    } catch (error) {
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 分页获取资源列表
   * @param {number} page - 页码
   * @param {number} limit - 每页数量
   * @param {Object} filters - 过滤条件
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 分页查询结果
   */
  async getPaginated(page = 1, limit = 10, filters = {}, options = {}) {
    try {
      const { page: validPage, limit: validLimit } = this.validatePaginationParams(page, limit);

      const result = await this.repository.paginate(validPage, validLimit, {
        ...options,
        ...filters
      });

      return this.successResponse('获取成功', result.data, result.pagination);
    } catch (error) {
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 创建资源
   * @param {Object} data - 要创建的数据
   * @param {Array} requiredFields - 必填字段列表
   * @param {Object} user - 操作用户
   * @returns {Promise<Object>} 创建结果
   */
  async create(data, requiredFields = [], user = null) {
    try {
      // 验证必填字段
      if (requiredFields.length > 0) {
        this.validateRequiredFields(data, requiredFields);
      }

      const result = await this.repository.create(data);

      this.logOperation('create', { id: result.id, data }, user);

      return this.successResponse('创建成功', result.data);
    } catch (error) {
      if (error.message.includes('必填字段') || error.message.includes('已存在')) {
        return this.handleValidationError(error);
      }
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 更新资源
   * @param {number} id - 资源ID
   * @param {Object} data - 要更新的数据
   * @param {Object} user - 操作用户
   * @returns {Promise<Object>} 更新结果
   */
  async update(id, data, user = null) {
    try {
      const validId = this.validateId(id);

      // 检查资源是否存在
      if (!(await this.checkResourceExists(validId))) {
        return this.errorResponse('资源不存在');
      }

      const result = await this.repository.update(validId, data);

      this.logOperation('update', { id: validId, data }, user);

      return this.successResponse('更新成功', result.data);
    } catch (error) {
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 删除资源
   * @param {number} id - 资源ID
   * @param {Object} user - 操作用户
   * @returns {Promise<Object>} 删除结果
   */
  async delete(id, user = null) {
    try {
      const validId = this.validateId(id);

      // 检查资源是否存在
      if (!(await this.checkResourceExists(validId))) {
        return this.errorResponse('资源不存在');
      }

      const result = await this.repository.delete(validId);

      this.logOperation('delete', { id: validId }, user);

      return this.successResponse('删除成功', { deletedId: validId });
    } catch (error) {
      if (error.message.includes('被其他记录引用')) {
        return this.errorResponse('无法删除，该资源被其他记录引用');
      }
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 批量删除资源
   * @param {Array} ids - ID数组
   * @param {Object} user - 操作用户
   * @returns {Promise<Object>} 删除结果
   */
  async deleteMany(ids, user = null) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return this.errorResponse('请提供要删除的ID列表');
      }

      const validIds = ids.map(id => this.validateId(id));
      const result = await this.repository.deleteMany(validIds);

      this.logOperation('deleteMany', { ids: validIds }, user);

      return this.successResponse('批量删除成功', {
        deletedCount: result.affectedRows,
        deletedIds: validIds
      });
    } catch (error) {
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 获取统计信息
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Object>} 统计信息
   */
  async getStats(filters = {}) {
    try {
      const stats = await this.repository.count(filters);
      return this.successResponse('获取统计信息成功', { total: stats });
    } catch (error) {
      return this.handleDatabaseError(error);
    }
  }
}

module.exports = BaseService;
