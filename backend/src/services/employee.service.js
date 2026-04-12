/**
 * 员工业务逻辑层
 * 处理所有员工相关的业务逻辑和数据验证
 */
const EmployeeRepository = require('../repositories/employee.repository');
const ApiResponse = require('../utils/response');
const bcrypt = require('bcryptjs');
const { LEGACY_USER_ROLE_CODES } = require('./accessControl.service');
const log = require('../utils/log');

class EmployeeService {
  constructor() {
    this.employeeRepository = new EmployeeRepository();
  }

  /**
   * 创建成功的响应格式
   */
  createSuccessResponse(message, data = null) {
    return {
      success: true,
      message,
      data
    };
  }

  /**
   * 创建错误的响应格式
   */
  createErrorResponse(message, code = null) {
    return {
      success: false,
      message,
      code
    };
  }

  /**
   * 验证必填字段
   */
  validateRequiredFields(data, requiredFields) {
    const missingFields = requiredFields.filter(field =>
      !data[field] || String(data[field]).trim() === ''
    );

    if (missingFields.length > 0) {
      return {
        isValid: false,
        message: `缺少必填字段: ${missingFields.join(', ')}`
      };
    }

    return { isValid: true };
  }

  /**
   * 验证员工数据
   */
  validateEmployeeData(employeeData, isUpdate = false) {
    const {
      username,
      password,
      name,
      phone,
      email,
      role,
      status,
      store_id,
      salary_template_id
    } = employeeData;

    // 用户名验证
    if (username !== undefined) {
      if (!username || String(username).trim() === '') {
        return {
          isValid: false,
          message: '用户名不能为空'
        };
      }
      if (username.length < 3 || username.length > 20) {
        return {
          isValid: false,
          message: '用户名长度必须在3-20个字符之间'
        };
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return {
          isValid: false,
          message: '用户名只能包含字母、数字和下划线'
        };
      }
    } else if (!isUpdate) {
      return {
        isValid: false,
        message: '用户名不能为空'
      };
    }

    // 密码验证
    if (password !== undefined) {
      if (!password || String(password).trim() === '') {
        return {
          isValid: false,
          message: '密码不能为空'
        };
      }
      if (password.length < 6 || password.length > 100) {
        return {
          isValid: false,
          message: '密码长度必须在6-100个字符之间'
        };
      }
    } else if (!isUpdate) {
      return {
        isValid: false,
        message: '密码不能为空'
      };
    }

    // 姓名验证
    if (name !== undefined) {
      if (!name || String(name).trim() === '') {
        return {
          isValid: false,
          message: '姓名不能为空'
        };
      }
      if (name.length < 2 || name.length > 50) {
        return {
          isValid: false,
          message: '姓名长度必须在2-50个字符之间'
        };
      }
    } else if (!isUpdate) {
      return {
        isValid: false,
        message: '姓名不能为空'
      };
    }

    // 电话验证
    if (phone !== undefined && phone) {
      if (!/^[0-9-+() ]+$/.test(phone)) {
        return {
          isValid: false,
          message: '电话号码格式不正确'
        };
      }
      if (phone.length > 20) {
        return {
          isValid: false,
          message: '电话号码长度不能超过20个字符'
        };
      }
    }

    // 邮箱验证
    if (email !== undefined && email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return {
          isValid: false,
          message: '邮箱格式不正确'
        };
      }
      if (email.length > 100) {
        return {
          isValid: false,
          message: '邮箱长度不能超过100个字符'
        };
      }
    }

    // 角色验证
    if (role !== undefined && !LEGACY_USER_ROLE_CODES.includes(role)) {
      return {
        isValid: false,
        message: `角色值无效，必须是 ${LEGACY_USER_ROLE_CODES.join('、')}`
      };
    }

    // 状态验证
    if (status !== undefined && ![0, 1].includes(parseInt(status))) {
      return {
        isValid: false,
        message: '状态值只能是0(禁用)或1(启用)'
      };
    }

    // 商店ID验证
    if (store_id !== undefined && store_id !== null) {
      const storeId = parseInt(store_id);
      if (isNaN(storeId) || storeId <= 0) {
        return {
          isValid: false,
          message: '商店ID必须是正整数'
        };
      }
    }

    // 薪资模板ID验证
    if (salary_template_id !== undefined && salary_template_id !== null) {
      const templateId = parseInt(salary_template_id);
      if (isNaN(templateId) || templateId <= 0) {
        return {
          isValid: false,
          message: '薪资模板ID必须是正整数'
        };
      }
    }

    return { isValid: true };
  }

  /**
   * 加密密码
   */
  async hashPassword(password) {
    try {
      const salt = await bcrypt.genSalt(10);
      return await bcrypt.hash(password, salt);
    } catch (error) {
      log.error('密码加密失败:', error);
      throw new Error('密码加密失败');
    }
  }

  /**
   * 获取员工列表
   */
  async getEmployees(filters = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        name,
        role,
        status,
        store_id
      } = filters;

      // 验证分页参数
      const validPage = Math.max(parseInt(page) || 1, 1);
      const validLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

      const result = await this.employeeRepository.getEmployeesWithPagination(
        { page: validPage, limit: validLimit, name, role, status, store_id },
        options
      );

      return this.createSuccessResponse('获取员工列表成功', result);
    } catch (error) {
      log.error('获取员工列表失败:', error);
      return this.createErrorResponse('获取员工列表失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 根据ID获取员工详情
   */
  async getEmployeeById(id) {
    try {
      const employeeId = parseInt(id);
      if (isNaN(employeeId) || employeeId <= 0) {
        return this.createErrorResponse('无效的员工ID', 'INVALID_ID');
      }

      const employee = await this.employeeRepository.getEmployeeById(employeeId);
      if (!employee) {
        return this.createErrorResponse('员工不存在', 'NOT_FOUND');
      }

      return this.createSuccessResponse('获取员工详情成功', employee);
    } catch (error) {
      log.error('获取员工详情失败:', error);
      return this.createErrorResponse('获取员工详情失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 创建员工
   */
  async createEmployee(employeeData, user = null) {
    try {
      // 验证数据
      const validation = this.validateEmployeeData(employeeData);
      if (!validation.isValid) {
        return this.createErrorResponse(validation.message, 'VALIDATION_ERROR');
      }

      const { username, password, name } = employeeData;

      // 检查用户名是否已存在
      const isUsernameAvailable = await this.employeeRepository.checkUsernameAvailability(username);
      if (!isUsernameAvailable) {
        return this.createErrorResponse('用户名已存在', 'DUPLICATE_USERNAME');
      }

      // 加密密码
      const hashedPassword = await this.hashPassword(password);

      // 创建员工数据
      const employeeDataWithHashedPassword = {
        ...employeeData,
        password: hashedPassword,
        role: employeeData.role || 'employee',
        status: employeeData.status !== undefined ? parseInt(employeeData.status) : 1
      };

      // 创建员工
      const employeeId = await this.employeeRepository.createEmployee(employeeDataWithHashedPassword);
      if (!employeeId) {
        return this.createErrorResponse('创建员工失败', 'CREATE_FAILED');
      }

      // 获取创建的员工信息（不包含密码）
      const newEmployee = await this.employeeRepository.getEmployeeById(employeeId);
      if (newEmployee && newEmployee.password) {
        delete newEmployee.password; // 确保不返回密码
      }

      return this.createSuccessResponse('员工创建成功', {
        id: employeeId,
        ...newEmployee
      });
    } catch (error) {
      log.error('创建员工失败:', error);
      return this.createErrorResponse('创建员工失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 更新员工
   */
  async updateEmployee(id, employeeData, user = null) {
    try {
      const employeeId = parseInt(id);
      if (isNaN(employeeId) || employeeId <= 0) {
        return this.createErrorResponse('无效的员工ID', 'INVALID_ID');
      }

      // 检查员工是否存在
      const existingEmployee = await this.employeeRepository.getEmployeeById(employeeId);
      if (!existingEmployee) {
        return this.createErrorResponse('员工不存在', 'NOT_FOUND');
      }

      // 验证数据
      const validation = this.validateEmployeeData(employeeData, true);
      if (!validation.isValid) {
        return this.createErrorResponse(validation.message, 'VALIDATION_ERROR');
      }

      // 如果更新用户名，检查用户名是否重复
      if (employeeData.username && employeeData.username !== existingEmployee.username) {
        const isUsernameAvailable = await this.employeeRepository.checkUsernameAvailability(
          employeeData.username, employeeId
        );
        if (!isUsernameAvailable) {
          return this.createErrorResponse('用户名已存在', 'DUPLICATE_USERNAME');
        }
      }

      // 如果更新密码，进行加密
      let updateData = { ...employeeData };
      if (employeeData.password) {
        updateData.password = await this.hashPassword(employeeData.password);
      }

      // 更新员工
      const updated = await this.employeeRepository.updateEmployee(employeeId, updateData);
      if (!updated) {
        return this.createErrorResponse('更新员工失败', 'UPDATE_FAILED');
      }

      // 获取更新后的员工信息（不包含密码）
      const updatedEmployee = await this.employeeRepository.getEmployeeById(employeeId);
      if (updatedEmployee && updatedEmployee.password) {
        delete updatedEmployee.password; // 确保不返回密码
      }

      return this.createSuccessResponse('员工更新成功', updatedEmployee);
    } catch (error) {
      log.error('更新员工失败:', error);
      return this.createErrorResponse('更新员工失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 删除员工
   */
  async deleteEmployee(id, user = null) {
    try {
      const employeeId = parseInt(id);
      if (isNaN(employeeId) || employeeId <= 0) {
        return this.createErrorResponse('无效的员工ID', 'INVALID_ID');
      }

      // 检查员工是否存在
      const existingEmployee = await this.employeeRepository.getEmployeeById(employeeId);
      if (!existingEmployee) {
        return this.createErrorResponse('员工不存在', 'NOT_FOUND');
      }

      // 防止删除自己
      if (user && user.id === employeeId) {
        return this.createErrorResponse('不能删除自己的账户', 'CANNOT_DELETE_SELF');
      }

      // 尝试删除员工
      const deleteResult = await this.employeeRepository.deleteEmployee(employeeId);
      if (!deleteResult.canDelete) {
        return this.createErrorResponse(
          deleteResult.reason,
          'HAS_RELATIONSHIPS'
        );
      }

      if (!deleteResult.deleted) {
        return this.createErrorResponse('删除员工失败', 'DELETE_FAILED');
      }

      return this.createSuccessResponse('员工删除成功', {
        id: employeeId,
        name: existingEmployee.name
      });
    } catch (error) {
      log.error('删除员工失败:', error);
      return this.createErrorResponse('删除员工失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 批量更新员工状态
   */
  async batchUpdateStatus(ids, status, user = null) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return this.createErrorResponse('请选择要操作的员工', 'INVALID_IDS');
      }

      if (![0, 1].includes(parseInt(status))) {
        return this.createErrorResponse('状态值只能是0(禁用)或1(启用)', 'INVALID_STATUS');
      }

      // 验证ID格式
      const validIds = ids.filter(id => {
        const numId = parseInt(id);
        return !isNaN(numId) && numId > 0;
      });

      if (validIds.length === 0) {
        return this.createErrorResponse('无效的员工ID列表', 'INVALID_IDS');
      }

      // 防止禁用自己
      if (user && status == 0 && validIds.includes(user.id)) {
        return this.createErrorResponse('不能禁用自己的账户', 'CANNOT_DISABLE_SELF');
      }

      // 批量更新
      const affectedRows = await this.employeeRepository.batchUpdateStatus(validIds, status);

      return this.createSuccessResponse('批量更新状态成功', {
        updated_count: affectedRows,
        status: parseInt(status),
        status_text: status == 1 ? '启用' : '禁用'
      });
    } catch (error) {
      log.error('批量更新状态失败:', error);
      return this.createErrorResponse('批量更新状态失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 搜索员工
   */
  async searchEmployees(keyword, filters = {}) {
    try {
      if (!keyword || String(keyword).trim() === '') {
        return this.createErrorResponse('搜索关键词不能为空', 'INVALID_KEYWORD');
      }

      if (keyword.length < 2) {
        return this.createErrorResponse('搜索关键词长度至少2个字符', 'KEYWORD_TOO_SHORT');
      }

      const result = await this.employeeRepository.searchEmployees(keyword.trim(), filters);

      return this.createSuccessResponse('搜索员工成功', result);
    } catch (error) {
      log.error('搜索员工失败:', error);
      return this.createErrorResponse('搜索员工失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 检查用户名可用性
   */
  async checkUsernameAvailability(username, excludeId = null) {
    try {
      if (!username || String(username).trim() === '') {
        return this.createErrorResponse('用户名不能为空', 'INVALID_USERNAME');
      }

      if (username.length < 3 || username.length > 20) {
        return this.createErrorResponse('用户名长度必须在3-20个字符之间', 'INVALID_USERNAME_LENGTH');
      }

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return this.createErrorResponse('用户名只能包含字母、数字和下划线', 'INVALID_USERNAME_FORMAT');
      }

      const isAvailable = await this.employeeRepository.checkUsernameAvailability(username.trim(), excludeId);

      return this.createSuccessResponse('检查完成', {
        username: username.trim(),
        is_available: isAvailable,
        message: isAvailable ? '用户名可用' : '用户名已存在'
      });
    } catch (error) {
      log.error('检查用户名可用性失败:', error);
      return this.createErrorResponse('检查用户名可用性失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取员工统计信息
   */
  async getEmployeeStats() {
    try {
      const stats = await this.employeeRepository.getEmployeeStats();

      return this.createSuccessResponse('获取统计信息成功', stats);
    } catch (error) {
      log.error('获取员工统计信息失败:', error);
      return this.createErrorResponse('获取统计信息失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取活跃员工
   */
  async getActiveEmployees() {
    try {
      const employees = await this.employeeRepository.getActiveEmployees();

      return this.createSuccessResponse('获取活跃员工成功', employees);
    } catch (error) {
      log.error('获取活跃员工失败:', error);
      return this.createErrorResponse('获取活跃员工失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取员工排行榜
   */
  async getEmployeeRanking(filters = {}) {
    try {
      const rankings = await this.employeeRepository.getEmployeeRanking(filters);

      // 添加排名
      rankings.forEach((ranking, index) => {
        ranking.rank = index + 1;
      });

      return this.createSuccessResponse('获取员工排行榜成功', {
        type: filters.type || 'sales',
        period: filters.period || 'month',
        rankings: rankings
      });
    } catch (error) {
      log.error('获取员工排行榜失败:', error);
      return this.createErrorResponse('获取员工排行榜失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 导出员工数据
   */
  async exportEmployees(filters = {}) {
    try {
      const employees = await this.employeeRepository.exportEmployees(filters);

      return this.createSuccessResponse('导出员工数据成功', {
        data: employees,
        total_count: employees.length,
        export_time: new Date().toISOString()
      });
    } catch (error) {
      log.error('导出员工数据失败:', error);
      return this.createErrorResponse('导出员工数据失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 测试员工服务
   */
  async testEmployees() {
    return this.createSuccessResponse('员工管理模块工作正常', {
      message: '新的员工管理系统已成功集成',
      version: '1.0.0',
      features: [
        '员工CRUD操作',
        '分页查询和过滤',
        '搜索功能',
        '批量操作支持',
        '数据导出功能',
        '统计分析功能',
        '员工排行榜',
        '密码安全管理'
      ]
    });
  }
}

module.exports = EmployeeService;
