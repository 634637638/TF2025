const SalaryRecordService = require('../services/salary-record.service');
const ApiResponse = require('../utils/response');
const log = require('../utils/log');
const {
  getModuleAccessScope,
  resolveScopedTargetId,
  canAccessScopedTarget
} = require('../services/accessControl.service');

/**
 * 工资记录控制器
 */
class SalaryRecordController {
  get salaryScopeModuleKeys() {
    return ['salary_salaryrecordsview', 'salary_mysalaryview'];
  }

  /**
   * 获取当前用户ID
   */
  getUserId(req) {
    return req.user?.id || req.user?.userId || req.user?.sub;
  }

  async getSalaryScope(userId) {
    return getModuleAccessScope(userId, this.salaryScopeModuleKeys);
  }

  /**
   * 获取工资记录列表
   * 管理员（有完整增删改查权限）可以查看所有员工，普通员工只能查看自己
   */
  async getSalaryRecords(req, res) {
    try {
      const { page, limit, employee_id, status, period_start, period_end } = req.query;
      const userId = this.getUserId(req);

      const scopeInfo = await this.getSalaryScope(userId);

      const filters = {};

      const scopedEmployeeId = resolveScopedTargetId(scopeInfo, userId, employee_id);
      if (scopedEmployeeId !== null) {
        filters.employee_id = scopedEmployeeId;
      }

      if (scopeInfo.isAdmin) {
        // 管理员：可以查看所有员工，也可以通过 employee_id 过滤
        if (status) filters.status = status;
      } else {
        // 未发放工资不可见
        filters.status = 'paid';
      }

      if (period_start) filters.period_start = period_start;
      if (period_end) filters.period_end = period_end;

      const options = { page: parseInt(page) || 1, limit: parseInt(limit) || 20 };

      const result = await SalaryRecordService.getSalaryRecords(filters, options);
      ApiResponse.success(res, '获取工资记录列表成功', result, 200);
    } catch (error) {
      log.error('获取工资记录列表失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 获取个人工资记录
   * 兼容旧端点，内部复用统一列表逻辑
   */
  async getMySalaryRecords(req, res) {
    req.query = {
      ...req.query,
      employee_id: this.getUserId(req)
    };
    return this.getSalaryRecords(req, res);
  }

  /**
   * 获取工资记录详情
   */
  async getSalaryRecordById(req, res) {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req);
      const scopeInfo = await this.getSalaryScope(userId);
      const result = await SalaryRecordService.getSalaryRecordById(id);

      if (!result) {
        return ApiResponse.error(res, '工资记录不存在', 404);
      }

      if (!canAccessScopedTarget(scopeInfo, userId, result.employee_id)) {
        return ApiResponse.forbidden(res, '无权限查看其他员工工资');
      }

      if (!scopeInfo.isAdmin) {
        if (result.status !== 'paid') {
          return ApiResponse.forbidden(res, '工资尚未发放，暂不可查看');
        }
      }

      ApiResponse.success(res, '获取工资记录详情成功', result, 200);
    } catch (error) {
      log.error('获取工资记录详情失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 创建工资记录
   */
  async createSalaryRecord(req, res) {
    try {
      const userId = req.user.id;
      const result = await SalaryRecordService.createSalaryRecord(req.body, userId);
      ApiResponse.success(res, '创建工资记录成功', result, 201);
    } catch (error) {
      log.error('创建工资记录失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 更新工资记录
   */
  async updateSalaryRecord(req, res) {
    try {
      const { id } = req.params;
      const result = await SalaryRecordService.updateSalaryRecord(id, req.body);
      ApiResponse.success(res, '更新工资记录成功', result, 200);
    } catch (error) {
      log.error('更新工资记录失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 删除工资记录
   */
  async deleteSalaryRecord(req, res) {
    try {
      const { id } = req.params;
      await SalaryRecordService.deleteSalaryRecord(id);
      ApiResponse.success(res, '删除工资记录成功', null, 200);
    } catch (error) {
      log.error('删除工资记录失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 计算工资
   */
  async calculateSalary(req, res) {
    try {
      const { employee_id, period_start, period_end } = req.body;

      const result = await SalaryRecordService.calculateSalary(
        employee_id,
        period_start,
        period_end
      );

      ApiResponse.success(res, '计算工资成功', result, 200);
    } catch (error) {
      log.error('计算工资失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 保存计算的工资
   */
  async saveCalculatedSalary(req, res) {
    try {
      const userId = req.user.id;
      const result = await SalaryRecordService.saveCalculatedSalary(req.body, userId);
      ApiResponse.success(res, '保存工资记录成功', result, 201);
    } catch (error) {
      log.error('保存工资记录失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 批量计算工资
   */
  async batchCalculateSalaries(req, res) {
    try {
      const { employee_ids, period_start, period_end } = req.body;

      const results = await SalaryRecordService.batchCalculateSalaries(
        employee_ids,
        period_start,
        period_end
      );

      ApiResponse.success(res, '批量计算工资完成', results, 200);
    } catch (error) {
      log.error('批量计算工资失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 审批工资记录
   */
  async approveSalaryRecord(req, res) {
    try {
      const { id } = req.params;
      const approverId = req.user.id;

      await SalaryRecordService.approveSalaryRecord(id, approverId);
      ApiResponse.success(res, '审批工资记录成功', null, 200);
    } catch (error) {
      log.error('审批工资记录失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 标记工资为已发放
   */
  async markAsPaid(req, res) {
    try {
      const { id } = req.params;
      const { payment_method } = req.body;
      const updatedRecord = await SalaryRecordService.markAsPaid(id, { payment_method });
      ApiResponse.success(res, '工资发放成功', updatedRecord, 200);
    } catch (error) {
      log.error('标记工资发放失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 获取工资统计
   */
  async getSalaryStats(req, res) {
    try {
      const userId = this.getUserId(req);
      const scopeInfo = await this.getSalaryScope(userId);
      if (!scopeInfo.isAdmin) {
        return ApiResponse.forbidden(res, '无权限查看工资统计');
      }

      const { period_start, period_end, status } = req.query;

      const filters = {};
      if (period_start) filters.period_start = period_start;
      if (period_end) filters.period_end = period_end;
      if (status) filters.status = status;

      const result = await SalaryRecordService.getSalaryStats(filters);
      ApiResponse.success(res, '获取工资统计成功', result, 200);
    } catch (error) {
      log.error('获取工资统计失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 批量获取员工销售数据（用于薪资计算）
   * 返回指定时间段内所有员工的全新机销售统计
   */
  async getEmployeesSalesData(req, res) {
    try {
      const userId = this.getUserId(req);
      const { isAdmin } = await this.getSalaryScope(userId);
      if (!isAdmin) {
        return ApiResponse.forbidden(res, '无权限查看员工销售数据');
      }

      const { period_start, period_end } = req.query;

      if (!period_start || !period_end) {
        return ApiResponse.error(res, '请提供时间范围（period_start 和 period_end）', 400);
      }

      const result = await SalaryRecordService.getEmployeesSalesData(period_start, period_end);

      ApiResponse.success(res, '获取员工销售数据成功', result, 200);
    } catch (error) {
      log.error('获取员工销售数据失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 获取单个员工的销售明细列表
   * 返回指定时间段内该员工的销售记录详情
   * 员工只能查看自己的销售明细，管理员可以查看所有员工的销售明细
   */
  async getEmployeeSalesDetails(req, res) {
    try {
      const userId = this.getUserId(req);
      const scopeInfo = await this.getSalaryScope(userId);

      const { employee_id, period_start, period_end } = req.query;

      if (!employee_id || !period_start || !period_end) {
        return ApiResponse.error(res, '请提供员工ID和时间范围（employee_id, period_start, period_end）', 400);
      }

      // 检查权限：管理员可以查看所有员工，普通员工只能查看自己的销售明细
      if (!canAccessScopedTarget(scopeInfo, userId, employee_id)) {
        return ApiResponse.forbidden(res, '无权限查看其他员工的销售明细');
      }

      const result = await SalaryRecordService.getEmployeeSalesDetails(
        parseInt(resolveScopedTargetId(scopeInfo, userId, employee_id), 10),
        period_start,
        period_end
      );
      ApiResponse.success(res, '获取员工销售明细成功', result, 200);
    } catch (error) {
      log.error('获取员工销售明细失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 批量重算某月工资
   */
  async bulkRecalculateByPeriod(req, res) {
    try {
      const userId = this.getUserId(req);
      const { isAdmin } = await this.getSalaryScope(userId);
      if (!isAdmin) {
        return ApiResponse.forbidden(res, '无权限批量重算工资');
      }

      const { period_start, period_end } = req.body;
      if (!period_start || !period_end) {
        return ApiResponse.error(res, '请提供时间范围（period_start 和 period_end）', 400);
      }

      const result = await SalaryRecordService.bulkRecalculateByPeriod(period_start, period_end, userId);
      ApiResponse.success(res, '批量重算工资完成', result, 200);
    } catch (error) {
      log.error('批量重算工资失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }
}

module.exports = new SalaryRecordController();
