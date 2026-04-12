const log = require('../utils/log');
/**
 * 员工控制器
 * 处理所有员工相关的HTTP请求
 */
const EmployeeService = require('../services/employee.service');
const ApiResponse = require('../utils/response');

class EmployeeController {
  constructor() {
    this.employeeService = new EmployeeService();
  }

  /**
   * 测试员工模块
   */
  async testEmployees(req, res) {
    try {
      const result = await this.employeeService.testEmployees();
      ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('测试员工模块失败:', error);
      ApiResponse.serverError(res, '测试员工模块失败', error);
    }
  }

  /**
   * 获取员工列表
   */
  async getEmployees(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        name,
        role,
        status,
        store_id
      } = req.query;

      const filters = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        name,
        role,
        status: status !== undefined ? parseInt(status) : undefined,
        store_id: store_id ? parseInt(store_id) : undefined
      };

      const result = await this.employeeService.getEmployees(filters);

      if (result.success) {
        ApiResponse.paginated(
          res,
          result.message,
          result.data.employees,
          result.data.pagination
        );
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取员工列表失败:', error);
      ApiResponse.serverError(res, '获取员工列表失败', error);
    }
  }

  /**
   * 获取员工统计信息
   */
  async getEmployeeStats(req, res) {
    try {
      const result = await this.employeeService.getEmployeeStats();

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取员工统计信息失败:', error);
      ApiResponse.serverError(res, '获取员工统计信息失败', error);
    }
  }

  /**
   * 获取活跃员工
   */
  async getActiveEmployees(req, res) {
    try {
      const result = await this.employeeService.getActiveEmployees();

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取活跃员工失败:', error);
      ApiResponse.serverError(res, '获取活跃员工失败', error);
    }
  }

  /**
   * 获取员工排行榜
   */
  async getEmployeeRanking(req, res) {
    try {
      const { type = 'sales', period = 'month', limit = 10 } = req.query;

      const filters = {
        type,
        period,
        limit: parseInt(limit) || 10
      };

      const result = await this.employeeService.getEmployeeRanking(filters);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取员工排行榜失败:', error);
      ApiResponse.serverError(res, '获取员工排行榜失败', error);
    }
  }

  /**
   * 搜索员工
   */
  async searchEmployees(req, res) {
    try {
      const { keyword, page, limit, role, status, store_id } = req.query;

      if (!keyword) {
        return ApiResponse.validationError(res, '搜索关键词不能为空');
      }

      const filters = {
        keyword: keyword.trim(),
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        role,
        status: status !== undefined ? parseInt(status) : undefined,
        store_id: store_id ? parseInt(store_id) : undefined
      };

      const result = await this.employeeService.searchEmployees(filters.keyword, filters);

      if (result.success) {
        ApiResponse.paginated(
          res,
          result.message,
          result.data.employees,
          result.data.pagination
        );
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('搜索员工失败:', error);
      ApiResponse.serverError(res, '搜索员工失败', error);
    }
  }

  /**
   * 检查用户名可用性
   */
  async checkUsernameAvailability(req, res) {
    try {
      const { username, excludeId } = req.query;

      if (!username) {
        return ApiResponse.validationError(res, '用户名不能为空');
      }

      const result = await this.employeeService.checkUsernameAvailability(username.trim(), excludeId);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('检查用户名可用性失败:', error);
      ApiResponse.serverError(res, '检查用户名可用性失败', error);
    }
  }

  /**
   * 根据ID获取员工详情
   */
  async getEmployeeById(req, res) {
    try {
      const { id } = req.params;

      const result = await this.employeeService.getEmployeeById(id);

      if (result.success) {
        // 确保不返回敏感信息
        const employeeData = { ...result.data };
        if (employeeData.password) {
          delete employeeData.password;
        }
        ApiResponse.success(res, result.message, employeeData);
      } else {
        if (result.code === 'NOT_FOUND') {
          ApiResponse.notFound(res, result.message);
        } else {
          ApiResponse.error(res, result.message, 400, result.code);
        }
      }
    } catch (error) {
      log.error('获取员工详情失败:', error);
      ApiResponse.serverError(res, '获取员工详情失败', error);
    }
  }

  /**
   * 创建员工
   */
  async createEmployee(req, res) {
    try {
      const employeeData = req.body;

      const result = await this.employeeService.createEmployee(employeeData, req.user);

      if (result.success) {
        // 确保不返回密码信息
        const responseData = { ...result.data };
        if (responseData.password) {
          delete responseData.password;
        }
        ApiResponse.created(res, result.message, responseData);
      } else {
        if (result.code === 'VALIDATION_ERROR') {
          ApiResponse.validationError(res, result.message);
        } else if (result.code === 'DUPLICATE_USERNAME') {
          ApiResponse.conflict(res, result.message);
        } else {
          ApiResponse.error(res, result.message, 400, result.code);
        }
      }
    } catch (error) {
      log.error('创建员工失败:', error);
      ApiResponse.serverError(res, '创建员工失败', error);
    }
  }

  /**
   * 更新员工
   */
  async updateEmployee(req, res) {
    try {
      const { id } = req.params;
      const employeeData = req.body;

      const result = await this.employeeService.updateEmployee(id, employeeData, req.user);

      if (result.success) {
        // 确保不返回密码信息
        const responseData = { ...result.data };
        if (responseData.password) {
          delete responseData.password;
        }
        ApiResponse.success(res, result.message, responseData);
      } else {
        if (result.code === 'NOT_FOUND') {
          ApiResponse.notFound(res, result.message);
        } else if (result.code === 'VALIDATION_ERROR') {
          ApiResponse.validationError(res, result.message);
        } else if (result.code === 'DUPLICATE_USERNAME') {
          ApiResponse.conflict(res, result.message);
        } else {
          ApiResponse.error(res, result.message, 400, result.code);
        }
      }
    } catch (error) {
      log.error('更新员工失败:', error);
      ApiResponse.serverError(res, '更新员工失败', error);
    }
  }

  /**
   * 批量更新员工状态
   */
  async batchUpdateStatus(req, res) {
    try {
      const { ids, status } = req.body;

      const result = await this.employeeService.batchUpdateStatus(ids, status, req.user);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        if (result.code === 'VALIDATION_ERROR') {
          ApiResponse.validationError(res, result.message);
        } else if (result.code === 'CANNOT_DISABLE_SELF') {
          ApiResponse.forbidden(res, result.message);
        } else {
          ApiResponse.error(res, result.message, 400, result.code);
        }
      }
    } catch (error) {
      log.error('批量更新状态失败:', error);
      ApiResponse.serverError(res, '批量更新状态失败', error);
    }
  }

  /**
   * 删除员工
   */
  async deleteEmployee(req, res) {
    try {
      const { id } = req.params;

      const result = await this.employeeService.deleteEmployee(id, req.user);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        if (result.code === 'NOT_FOUND') {
          ApiResponse.notFound(res, result.message);
        } else if (result.code === 'CANNOT_DELETE_SELF') {
          ApiResponse.forbidden(res, result.message);
        } else if (result.code === 'HAS_RELATIONSHIPS') {
          ApiResponse.error(res, result.message, 409, result.code);
        } else {
          ApiResponse.error(res, result.message, 400, result.code);
        }
      }
    } catch (error) {
      log.error('删除员工失败:', error);
      ApiResponse.serverError(res, '删除员工失败', error);
    }
  }

  /**
   * 导出员工数据
   */
  async exportEmployees(req, res) {
    try {
      const { name, role, status, store_id } = req.query;

      const filters = {
        name,
        role,
        status: status !== undefined ? parseInt(status) : undefined,
        store_id: store_id ? parseInt(store_id) : undefined
      };

      const result = await this.employeeService.exportEmployees(filters);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('导出员工数据失败:', error);
      ApiResponse.serverError(res, '导出员工数据失败', error);
    }
  }
}

module.exports = EmployeeController;