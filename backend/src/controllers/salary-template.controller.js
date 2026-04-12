const log = require('../utils/log');
const SalaryTemplateService = require('../services/salary-template.service');
const ApiResponse = require('../utils/response');

/**
 * 工资模板控制器
 */
class SalaryTemplateController {
  /**
   * 获取工资模板列表
   */
  async getTemplates(req, res) {
    try {
      const { page, limit, is_active, is_default } = req.query;

      log.debug('[获取模板列表] 查询参数:', { page, limit, is_active, is_default });

      const filters = {};
      // 处理 is_active 参数（支持字符串和布尔值）
      if (is_active !== undefined && is_active !== null && is_active !== '') {
        filters.is_active = is_active === 'true' || is_active === true;
      }
      // 处理 is_default 参数（支持字符串和布尔值）
      if (is_default !== undefined && is_default !== null && is_default !== '') {
        filters.is_default = is_default === 'true' || is_default === true;
      }

      log.debug('[获取模板列表] 筛选条件:', filters);

      const options = { page: parseInt(page) || 1, limit: parseInt(limit) || 20 };

      const result = await SalaryTemplateService.getTemplates(filters, options);
      log.debug('[获取模板列表] 返回记录数:', result.records?.length || 0);
      if (result.records && result.records.length > 0) {
        log.debug('[获取模板列表] 模板ID列表:', result.records.map(r => r.id));
      }
      ApiResponse.success(res, '获取工资模板列表成功', result, 200);
    } catch (error) {
      log.error('获取工资模板列表失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 获取工资模板详情
   */
  async getTemplateById(req, res) {
    try {
      const { id } = req.params;
      const result = await SalaryTemplateService.getTemplateById(id);

      if (!result) {
        return ApiResponse.error(res, '工资模板不存在', 404);
      }

      ApiResponse.success(res, '获取工资模板详情成功', result, 200);
    } catch (error) {
      log.error('获取工资模板详情失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 创建工资模板
   */
  async createTemplate(req, res) {
    try {
      log.debug('[创建模板] 请求数据:', JSON.stringify(req.body, null, 2));
      log.debug('[创建模板] 用户信息:', req.user);
      const userId = req.user.sub || req.user.id;
      log.debug('[创建模板] 用户ID:', userId);
      const result = await SalaryTemplateService.createTemplate(req.body, userId);
      log.debug('[创建模板] 创建结果:', result);
      ApiResponse.success(res, '创建工资模板成功', result, 201);
    } catch (error) {
      log.error('[创建模板] 失败:', error.message);
      log.debug('[创建模板] 错误堆栈:', error.stack);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 更新工资模板
   */
  async updateTemplate(req, res) {
    try {
      const { id } = req.params;
      const result = await SalaryTemplateService.updateTemplate(id, req.body);
      ApiResponse.success(res, '更新工资模板成功', result, 200);
    } catch (error) {
      log.error('更新工资模板失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 删除工资模板
   */
  async deleteTemplate(req, res) {
    try {
      const { id } = req.params;
      await SalaryTemplateService.deleteTemplate(id);
      ApiResponse.success(res, '删除工资模板成功', null, 200);
    } catch (error) {
      log.error('删除工资模板失败:', error);
      // 业务逻辑错误返回400，系统错误返回500
      const statusCode = error.message.includes('无法删除') ? 400 : 500;
      ApiResponse.error(res, error.message, statusCode);
    }
  }

  /**
   * 设为默认模板
   */
  async setAsDefault(req, res) {
    try {
      const { id } = req.params;
      await SalaryTemplateService.setAsDefault(id);
      ApiResponse.success(res, '设置默认模板成功', null, 200);
    } catch (error) {
      log.error('设置默认模板失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 获取激活的模板列表
   */
  async getActiveTemplates(req, res) {
    try {
      const result = await SalaryTemplateService.getActiveTemplates();
      ApiResponse.success(res, '获取激活模板列表成功', result, 200);
    } catch (error) {
      log.error('获取激活模板列表失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 设置员工工资模板
   */
  async setEmployeeTemplate(req, res) {
    try {
      const { userId } = req.params;
      const { templateId } = req.body;
      log.debug('[设置员工模板] userId:', userId, 'templateId:', templateId);
      const result = await SalaryTemplateService.setEmployeeTemplate(userId, templateId);
      log.debug('[设置员工模板] 结果:', result);
      ApiResponse.success(res, '设置员工工资模板成功', result, 200);
    } catch (error) {
      log.error('设置员工工资模板失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }
}

module.exports = new SalaryTemplateController();
