/**
 * 工资模板服务
 */
const SalaryTemplateRepository = require('../repositories/salary-template.repository')
const log = require('../utils/log')
const { normalizeGoodsCommissionRule } = require('../utils/goods-commission')
const { hasUnifiedPermission } = require('../middleware/unified-auth')
const { validId } = require('../utils/sale-input')

const writable = new Set(['name', 'description', 'base_salary', 'commission_type', 'commission_fixed',
  'commission_new_fixed', 'commission_used_fixed', 'commission_percentage', 'overtime_hourly_rate',
  'rest_days', 'auto_raise_rule', 'is_active', 'is_default', 'goods_commission_rule'])
const inputError = message => { throw Object.assign(new Error(message), { statusCode: 400, code: 'SALARY_TEMPLATE_INVALID' }) }
const parseId = id => { if (!validId(id)) inputError('工资模板或员工标识无效'); return Number(id) }

function normalizeInput(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Object.keys(data).length ||
    Object.keys(data).some(key => !writable.has(key))) inputError('工资模板包含无效或不支持的字段')
  const result = { ...data }
  if (Object.hasOwn(data, 'goods_commission_rule')) {
    const rule = data.goods_commission_rule
    if (rule !== null && (typeof rule !== 'object' || Array.isArray(rule) ||
      typeof rule?.fixed_amount !== 'number' || typeof rule?.percentage !== 'number')) {
      inputError('商品提成规则须为完整对象或空值，金额及比例须为数值')
    }
    result.goods_commission_rule = normalizeGoodsCommissionRule(data.goods_commission_rule)
  }
  return result
}

const readTemplate = row => row && ({ ...row,
  goods_commission_rule: normalizeGoodsCommissionRule(row.goods_commission_rule) })

class SalaryTemplateService {
  constructor({ repository = new SalaryTemplateRepository() } = {}) {
    this.repository = repository
  }

  async assertEmployeeTemplateWrite(data, actor, permissionCheck = hasUnifiedPermission) {
    if (Object.hasOwn(data, 'salary_template_id') &&
      !await permissionCheck(actor, 'salary-templates:edit')) {
      throw Object.assign(new Error('修改员工工资模板需要工资模板编辑权限'), {
        statusCode: 403, code: 'INSUFFICIENT_PERMISSIONS'
      })
    }
  }

  async getTemplates(filters, options) {
    const result = await this.repository.getTemplatesWithPagination(filters, options)
    return { ...result, records: result.records.map(readTemplate) }
  }

  async getTemplateById(id) {
    return readTemplate(await this.repository.getTemplateById(parseId(id)))
  }

  async createTemplate(data, _userId) {
    const result = await this.repository.createTemplate(normalizeInput(data))
    return { ...result, data: readTemplate(result.data) }
  }

  async updateTemplate(id, data) {
    const result = await this.repository.updateTemplate(parseId(id), normalizeInput(data))
    return { ...result, data: readTemplate(result.data) }
  }

  async deleteTemplate(id) {
    return await this.repository.deleteTemplate(parseId(id))
  }

  async setAsDefault(id) {
    return await this.repository.setAsDefault(parseId(id))
  }

  async getActiveTemplates() {
    return await this.repository.getActiveTemplates()
  }

  async getDefaultTemplate() {
    return readTemplate(await this.repository.getDefaultTemplate())
  }

  async setEmployeeTemplate(userId, templateId) {
    try {
      return await this.repository.setEmployeeTemplate(parseId(userId), templateId === null ? null : parseId(templateId))
    } catch (error) {
      log.error('[服务层] 设置员工模板失败:', error)
      throw error
    }
  }
}

module.exports = new SalaryTemplateService()
