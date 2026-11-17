'use strict'

const Service = require('../services/dashboard-shortcuts.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const FieldAccessService = require('../services/field-access.service')

class DashboardShortcutsController {
  constructor({ service = new Service(), response = ApiResponse, logger = log,
    access = new FieldAccessService({ moduleKey: 'system_systemview', strict: true }) } = {}) {
    Object.assign(this, { service, response, logger, access })
  }

  async respond(res, operation) {
    try {
      return this.response.success(res, await operation())
    } catch (error) {
      if (error.statusCode >= 400 && error.statusCode < 500) return this.response.error(res, error.message, error.statusCode)
      this.logger.error('首页快捷方式操作失败:', error)
      return this.response.error(res, '快捷方式操作失败，请稍后重试', 500)
    }
  }

  list(_req, res) { return this.respond(res, () => this.service.list()) }
  async manage(req, res, operation, write = false) {
    return this.respond(res, async () => {
      const permissions = await this.access.getPermissions(req.user.id)
      if (permissions.hiddenFields?.includes('settings.site_info') || (write && permissions.readonlyFields?.includes('settings.site_info'))) {
        throw Object.assign(new Error('无权管理站点信息中的快捷方式'), { statusCode: 403 })
      }
      return operation()
    })
  }
  listAdmin(req, res) { return this.manage(req, res, () => this.service.list(true)) }
  create(req, res) { return this.manage(req, res, () => this.service.change(null, req.body), true) }
  update(req, res) { return this.manage(req, res, () => this.service.change(req.params.id, req.body), true) }
  remove(req, res) { return this.manage(req, res, () => this.service.change(req.params.id, null, true), true) }
}

module.exports = DashboardShortcutsController
