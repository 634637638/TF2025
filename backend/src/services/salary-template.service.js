/**
 * 工资模板服务
 */
const SalaryTemplateRepository = require('../repositories/salary-template.repository');
const log = require('../utils/log');

class SalaryTemplateService {
  constructor() {
    this.repository = new SalaryTemplateRepository();
  }

  async getTemplates(filters, options) {
    try {
      return await this.repository.getTemplatesWithPagination(filters, options);
    } catch (error) {
      throw error;
    }
  }

  async getTemplateById(id) {
    try {
      return await this.repository.getTemplateById(id);
    } catch (error) {
      throw error;
    }
  }

  async createTemplate(data, userId) {
    try {
      // created_by 字段不存在于表中，移除此设置
      // data.created_by = userId;
      return await this.repository.createTemplate(data);
    } catch (error) {
      throw error;
    }
  }

  async updateTemplate(id, data) {
    try {
      return await this.repository.updateTemplate(id, data);
    } catch (error) {
      throw error;
    }
  }

  async deleteTemplate(id) {
    try {
      return await this.repository.deleteTemplate(id);
    } catch (error) {
      throw error;
    }
  }

  async setAsDefault(id) {
    try {
      return await this.repository.setAsDefault(id);
    } catch (error) {
      throw error;
    }
  }

  async getActiveTemplates() {
    try {
      return await this.repository.getActiveTemplates();
    } catch (error) {
      throw error;
    }
  }

  async getDefaultTemplate() {
    try {
      return await this.repository.getDefaultTemplate();
    } catch (error) {
      throw error;
    }
  }

  async setEmployeeTemplate(userId, templateId) {
    try {
      log.debug('[服务层] 设置员工模板 - userId:', userId, 'templateId:', templateId);
      // 直接更新用户的工资模板ID
      const { getDatabase } = require('../config/database');
      const db = getDatabase();

      const sql = 'UPDATE users SET salary_template_id = ? WHERE id = ?';
      const values = [templateId, userId];
      log.debug('[服务层] SQL:', sql, '参数:', values);
      const [result] = await db.execute(sql, values);
      log.debug('[服务层] 更新结果:', result);
      return { userId, templateId };
    } catch (error) {
      log.error('[服务层] 设置员工模板失败:', error);
      throw error;
    }
  }
}

module.exports = new SalaryTemplateService();
