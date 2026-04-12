const BaseService = require('./base.service');
const StoreRepository = require('../repositories/store.repository');

/**
 * 商店Service类
 * 处理商店相关的业务逻辑
 */
class StoreService extends BaseService {
  constructor() {
    super(new StoreRepository());
    this.storeRepository = new StoreRepository();
  }

  /**
   * 获取商店列表（分页和过滤）
   * @param {Object} filters - 过滤条件
   * @returns {Promise} 商店列表
   */
  async getStores(filters = {}) {
    try {
      const { page = 1, limit = 10, name, status } = filters;

      // 验证分页参数
      const { page: validPage, limit: validLimit } = this.validatePaginationParams(page, limit);

      const result = await this.storeRepository.getStoresWithPagination(
        { ...filters, page: validPage, limit: validLimit },
        {
          select: 's.*, u.name as manager_name, u.username as manager_username',
          join: 'LEFT JOIN users u ON s.manager_id = u.id',
          orderBy: 's.created_at DESC'
        }
      );

      return this.successResponse('获取商店列表成功', result.data, result.pagination);
    } catch (error) {
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 获取商店统计信息
   * @returns {Promise} 统计信息
   */
  async getStoreStats() {
    try {
      const stats = await this.storeRepository.getStoreStats();

      // 格式化统计信息
      const formattedStats = {
        total: stats.total,
        active: stats.active,
        inactive: stats.inactive,
        with_manager: stats.with_manager,
        recent: stats.recent,
        active_rate: stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0,
        manager_assigned_rate: stats.total > 0 ? Math.round((stats.with_manager / stats.total) * 100) : 0
      };

      return this.successResponse('获取商店统计信息成功', formattedStats);
    } catch (error) {
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 获取可用管理员列表
   * @returns {Promise} 管理员列表
   */
  async getAvailableManagers() {
    try {
      const managers = await this.storeRepository.getAvailableManagers();
      return this.successResponse('获取管理员列表成功', managers);
    } catch (error) {
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 根据ID获取商店详情
   * @param {number} id - 商店ID
   * @returns {Promise} 商店详情
   */
  async getStoreById(id) {
    try {
      const validId = this.validateId(id);
      const store = await this.storeRepository.getStoreById(validId);

      if (!store) {
        return this.errorResponse('商店不存在');
      }

      return this.successResponse('获取商店详情成功', store);
    } catch (error) {
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 创建商店
   * @param {Object} storeData - 商店数据
   * @param {Object} user - 操作用户
   * @returns {Promise} 创建结果
   */
  async createStore(storeData, user = null) {
    try {
      const { name, location, manager_id, phone, status } = storeData;

      // 验证必填字段
      this.validateRequiredFields(storeData, ['name']);

      // 验证商店名称长度
      if (name && (name.length < 2 || name.length > 100)) {
        return this.errorResponse('商店名称长度必须在2-100个字符之间');
      }

      // 验证状态值
      if (status !== undefined && status !== 0 && status !== 1) {
        return this.errorResponse('状态值只能是0（禁用）或1（启用）');
      }

      // 验证手机号格式（可选）
      if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
        return this.errorResponse('手机号格式不正确');
      }

      const result = await this.storeRepository.createStore({
        name: name.trim(),
        location: location ? location.trim() : null,
        manager_id: manager_id || null,
        phone: phone || null,
        status: status !== undefined ? status : 1
      });

      this.logOperation('createStore', {
        storeId: result.id,
        storeName: name.trim(),
        managerId: manager_id
      }, user);

      return this.successResponse('创建商店成功', result.data);
    } catch (error) {
      if (error.message.includes('已存在')) {
        return this.errorResponse('商店名称已存在');
      }
      if (error.message.includes('管理员不存在')) {
        return this.errorResponse('指定的管理员不存在或状态无效');
      }
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 更新商店信息
   * @param {number} id - 商店ID
   * @param {Object} storeData - 更新数据
   * @param {Object} user - 操作用户
   * @returns {Promise} 更新结果
   */
  async updateStore(id, storeData, user = null) {
    try {
      const validId = this.validateId(id);
      const { name, location, manager_id, phone, status } = storeData;

      // 验证商店名称长度（如果提供）
      if (name !== undefined) {
        if (name.length < 2 || name.length > 100) {
          return this.errorResponse('商店名称长度必须在2-100个字符之间');
        }
      }

      // 验证状态值（如果提供）
      if (status !== undefined && status !== 0 && status !== 1) {
        return this.errorResponse('状态值只能是0（禁用）或1（启用）');
      }

      // 验证手机号格式（如果提供）
      if (phone !== undefined && phone && !/^1[3-9]\d{9}$/.test(phone)) {
        return this.errorResponse('手机号格式不正确');
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name.trim();
      if (location !== undefined) updateData.location = location.trim() || null;
      if (manager_id !== undefined) updateData.manager_id = manager_id || null;
      if (phone !== undefined) updateData.phone = phone || null;
      if (status !== undefined) updateData.status = status;

      const result = await this.storeRepository.updateStore(validId, updateData);

      this.logOperation('updateStore', {
        storeId: validId,
        updateData
      }, user);

      return this.successResponse('更新商店信息成功', result.data);
    } catch (error) {
      if (error.message.includes('不存在')) {
        return this.errorResponse('商店不存在');
      }
      if (error.message.includes('已存在')) {
        return this.errorResponse('商店名称已存在');
      }
      if (error.message.includes('管理员不存在')) {
        return this.errorResponse('指定的管理员不存在或状态无效');
      }
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 删除商店
   * @param {number} id - 商店ID
   * @param {Object} user - 操作用户
   * @returns {Promise} 删除结果
   */
  async deleteStore(id, user = null) {
    try {
      const validId = this.validateId(id);

      const result = await this.storeRepository.deleteStore(validId);

      this.logOperation('deleteStore', {
        storeId: validId
      }, user);

      return this.successResponse('删除商店成功', { deletedId: validId });
    } catch (error) {
      if (error.message.includes('不存在')) {
        return this.errorResponse('商店不存在');
      }
      if (error.message.includes('关联数据')) {
        return this.errorResponse('无法删除，该商店存在关联数据（配件、客户或用户）');
      }
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 批量更新商店状态
   * @param {Array} ids - 商店ID数组
   * @param {number} status - 状态值
   * @param {Object} user - 操作用户
   * @returns {Promise} 更新结果
   */
  async batchUpdateStatus(ids, status, user = null) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return this.errorResponse('请提供要更新的商店ID列表');
      }

      // 验证状态值
      if (status !== 0 && status !== 1) {
        return this.errorResponse('状态值只能是0（禁用）或1（启用）');
      }

      // 验证所有ID
      const validIds = ids.map(id => this.validateId(id));

      const result = await this.storeRepository.batchUpdateStatus(validIds, status);

      this.logOperation('batchUpdateStoreStatus', {
        storeIds: validIds,
        status,
        count: result.updatedCount
      }, user);

      return this.successResponse(
        `批量${status === 1 ? '启用' : '禁用'}商店成功`,
        {
          updatedCount: result.updatedCount,
          storeIds: validIds
        }
      );
    } catch (error) {
      if (error.message.includes('商店ID列表')) {
        return this.errorResponse(error.message);
      }
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 根据管理员ID获取商店列表
   * @param {number} managerId - 管理员ID
   * @returns {Promise} 商店列表
   */
  async getStoresByManager(managerId) {
    try {
      const validManagerId = this.validateId(managerId);
      const stores = await this.storeRepository.getStoresByManager(validManagerId);
      return this.successResponse('获取管理员商店列表成功', stores);
    } catch (error) {
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 获取活跃商店列表
   * @returns {Promise} 活跃商店列表
   */
  async getActiveStores() {
    try {
      const stores = await this.storeRepository.getActiveStores();
      return this.successResponse('获取活跃商店列表成功', stores);
    } catch (error) {
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 检查商店名称可用性
   * @param {string} name - 商店名称
   * @param {number} excludeId - 排除的商店ID
   * @returns {Promise} 检查结果
   */
  async checkNameAvailability(name, excludeId = null) {
    try {
      if (!name || name.length < 2) {
        return this.errorResponse('商店名称长度不能少于2个字符');
      }

      const exists = await this.storeRepository.checkNameExists(name.trim(), excludeId);

      return this.successResponse('检查完成', {
        name: name.trim(),
        available: !exists,
        message: exists ? '商店名称已被使用' : '商店名称可用'
      });
    } catch (error) {
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 搜索商店
   * @param {string} keyword - 搜索关键词
   * @param {Object} options - 搜索选项
   * @returns {Promise} 搜索结果
   */
  async searchStores(keyword, options = {}) {
    try {
      if (!keyword || keyword.trim().length < 2) {
        return this.errorResponse('搜索关键词长度不能少于2个字符');
      }

      const { page = 1, limit = 10, status = null } = options;
      const { page: validPage, limit: validLimit } = this.validatePaginationParams(page, limit);

      const result = await this.storeRepository.getStoresWithPagination(
        {
          name: keyword.trim(),
          status,
          page: validPage,
          limit: validLimit
        },
        {
          select: 's.*, u.name as manager_name, u.username as manager_username',
          join: 'LEFT JOIN users u ON s.manager_id = u.id',
          orderBy: 's.name ASC, s.created_at DESC'
        }
      );

      return this.successResponse(
        `搜索到${result.pagination.total}个商店`,
        result.data,
        result.pagination
      );
    } catch (error) {
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 导出商店数据
   * @param {Object} filters - 过滤条件
   * @returns {Promise} 导出数据
   */
  async exportStores(filters = {}) {
    try {
      const { status = null } = filters;

      // 获取所有符合条件的数据（不分页）
      const stores = await this.storeRepository.getStoresWithPagination(
        { status, page: 1, limit: 10000 },
        {
          select: `
            s.id, s.name, s.location, s.phone, s.status,
            u.name as manager_name, u.username as manager_username,
            s.created_at, s.updated_at
          `,
          join: 'LEFT JOIN users u ON s.manager_id = u.id',
          orderBy: 's.name ASC'
        }
      );

      // 格式化导出数据
      const exportData = stores.data.map(store => ({
        ID: store.id,
        商店名称: store.name,
        地址: store.location || '',
        联系电话: store.phone || '',
        状态: store.status === 1 ? '启用' : '禁用',
        管理员: store.manager_name || '',
        管理员账号: store.manager_username || '',
        创建时间: new Date(store.created_at).toLocaleString('zh-CN'),
        更新时间: new Date(store.updated_at).toLocaleString('zh-CN')
      }));

      return this.successResponse('导出商店数据成功', {
        data: exportData,
        total: exportData.length,
        exportTime: new Date().toLocaleString('zh-CN')
      });
    } catch (error) {
      return this.handleDatabaseError(error);
    }
  }
}

module.exports = StoreService;