'use strict'

const service = require('../services/salary-template.service')
const ApiResponse = require('../utils/response')
const { parseBooleanFilter } = require('../utils/status')
const FieldAccessService = require('../services/field-access.service')
const log = require('../utils/log')

const writeFields = Object.fromEntries([
  'name', 'description', 'base_salary', 'commission_type', 'commission_new_fixed',
  'commission_used_fixed', 'commission_percentage', 'goods_commission_rule',
  'overtime_hourly_rate', 'rest_days', 'is_active', 'is_default'
].map(field => [field, `template.${field}`]))
writeFields.commission_fixed = 'template.commission_new_fixed'
for (const field of ['enabled', 'months', 'amount', 'max_salary']) {
  writeFields[`auto_raise_rule.${field}`] = `template.auto_raise_${field}`
}
const responseKeys = Object.fromEntries(Object.entries(writeFields).map(([key, field]) =>
  [field, key.startsWith('auto_raise_rule.') ? ['auto_raise_rule'] : [key]]))
responseKeys['template.commission_new_fixed'] = ['commission_new_fixed', 'commission_fixed']

class SalaryTemplateController {
  constructor({ service: implementation = service, masking } = {}) {
    this.service = implementation
    this.fields = new FieldAccessService({ moduleKey: 'salary_salarytemplatesview',
      responseKeys, strict: true, ...(masking ? { masking } : {}) })
  }

  async respond(req, res, operation, message, { write = false, status = 200 } = {}) {
    try {
      if (write) {
        const denied = await this.fields.getDeniedWrite(req.user.id, req.body, writeFields)
        if (denied) return ApiResponse.error(res, '不能修改无编辑权限的工资模板字段', 403, 'FIELD_PERMISSION_DENIED')
      }
      const permissions = await this.fields.getPermissions(req.user.id)
      const result = await operation()
      return ApiResponse.success(res, message, this.fields.maskPayload(result, permissions), status)
    } catch (error) {
      const status = [400, 403, 404, 409].includes(error.statusCode) ? error.statusCode :
        error.message?.startsWith('无法删除') ? 400 : 500
      if (status === 500) log.error('工资模板操作失败:', error)
      return ApiResponse.error(res, error.message, status, error.code)
    }
  }

  getTemplates(req, res) {
    const filters = {}
    for (const field of ['is_active', 'is_default']) {
      if (req.query[field] !== undefined && req.query[field] !== null && req.query[field] !== '') {
        filters[field] = parseBooleanFilter(req.query[field])
      }
    }
    const options = { page: Math.max(1, parseInt(req.query.page, 10) || 1),
      page_size: Math.min(100, Math.max(1, parseInt(req.query.page_size, 10) || 20)) }
    return this.respond(req, res, () => this.service.getTemplates(filters, options), '获取工资模板列表成功')
  }

  getTemplateById(req, res) {
    return this.respond(req, res, async () => {
      const row = await this.service.getTemplateById(req.params.id)
      if (!row) throw Object.assign(new Error('工资模板不存在'), { statusCode: 404, code: 'NOT_FOUND' })
      return row
    }, '获取工资模板详情成功')
  }

  createTemplate(req, res) {
    return this.respond(req, res, () => this.service.createTemplate(req.body, req.user.id), '创建工资模板成功', { write: true, status: 201 })
  }

  updateTemplate(req, res) {
    return this.respond(req, res, () => this.service.updateTemplate(req.params.id, req.body), '更新工资模板成功', { write: true })
  }

  deleteTemplate(req, res) {
    return this.respond(req, res, () => this.service.deleteTemplate(req.params.id), '删除工资模板成功')
  }

  setAsDefault(req, res) {
    return this.respond({ ...req, body: { is_default: true } }, res, () => this.service.setAsDefault(req.params.id), '设置默认模板成功', { write: true })
  }

  getActiveTemplates(req, res) {
    return this.respond(req, res, () => this.service.getActiveTemplates(), '获取激活模板列表成功')
  }

  setEmployeeTemplate(req, res) {
    return this.respond(req, res, () => this.service.setEmployeeTemplate(req.params.userId, req.body.template_id), '设置员工工资模板成功')
  }
}

module.exports = new SalaryTemplateController()
