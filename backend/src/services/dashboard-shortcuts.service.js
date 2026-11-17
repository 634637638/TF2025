'use strict'

const { randomUUID } = require('node:crypto')
const BaseService = require('../core/base/base.service')
const SystemSettingsRepository = require('../repositories/system-settings.repository')
const SiteSettingsRepository = require('../repositories/site-settings.repository')
const config = require('../config/dashboard-shortcuts.json')

class DashboardShortcutsService extends BaseService {
  constructor({ repository = new SystemSettingsRepository(), schema = new SiteSettingsRepository() } = {}) {
    super()
    Object.assign(this, { repository, schema })
  }

  async assertSchema() {
    const meta = await this.schema.getTableMeta()
    if (!meta.isKeyValueTable || !meta.availableColumns.has('type')) {
      throw this.createError('当前站点配置表不支持快捷方式，请先核对 settings 键值结构', 409, 'SHORTCUT_SETTINGS_SCHEMA_UNSUPPORTED')
    }
  }

  normalize(body) {
    const keys = ['label', 'kind', 'target', 'icon', 'sortOrder', 'enabled']
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !keys.includes(key)) ||
      typeof body.label !== 'string' || !body.label.trim() || body.label.trim().length > 40 ||
      !['page', 'action'].includes(body.kind) || typeof body.target !== 'string' ||
      !config.icons.some(icon => icon.value === body.icon) || typeof body.enabled !== 'boolean' ||
      !Number.isSafeInteger(body.sortOrder) || body.sortOrder < 0 || body.sortOrder > 9999) {
      throw this.createError('请填写有效的快捷方式名称、目标、图标、排序和状态', 400, 'INVALID_SHORTCUT')
    }
    // 页面仅保存无参数的站内路径；功能参数来自唯一登记表，不接受 URL、脚本或任意查询串。
    if (body.kind === 'page' ? !/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(body.target) :
      !config.actions.some(action => action.id === body.target)) {
      throw this.createError('请选择有效的站内页面或已接通功能', 400, 'INVALID_SHORTCUT_TARGET')
    }
    return Object.fromEntries(keys.map(key => [key, key === 'label' ? body.label.trim() : body[key]]))
  }

  parse(value) {
    const items = typeof value === 'string' ? JSON.parse(value) : value
    if (!Array.isArray(items)) throw this.createError('快捷方式配置损坏，请核对原配置', 409, 'INVALID_SHORTCUT_SETTINGS')
    const ids = new Set()
    return items.map(item => {
      if (!item || typeof item.id !== 'string' || !/^[a-f0-9-]{36}$/.test(item.id) || ids.has(item.id)) {
        throw this.createError('快捷方式编号异常，请核对原配置', 409, 'INVALID_SHORTCUT_SETTINGS')
      }
      ids.add(item.id)
      const { id, ...input } = item
      return { id, ...this.normalize(input) }
    })
  }

  sort(items) {
    return items.slice().sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
  }

  async list(admin = false) {
    await this.assertSchema()
    const row = await this.repository.getSettingByKey(config.settingKey)
    const items = row ? this.parse(row.value) : []
    return this.sort(admin ? items : items.filter(item => item.enabled))
  }

  async change(id, body, remove = false) {
    if (id !== null && (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))) {
      throw this.createError('快捷方式编号无效', 400, 'INVALID_SHORTCUT_ID')
    }
    const input = remove ? null : this.normalize(body)
    await this.assertSchema()
    const result = await this.repository.mutateJsonSetting(config.settingKey, [], value => {
      const items = this.parse(value)
      const index = items.findIndex(item => item.id === id)
      if (id !== null && index < 0) throw this.createError('快捷方式已不存在，请刷新列表', 404, 'SHORTCUT_NOT_FOUND')
      if (remove) items.splice(index, 1)
      else if (id === null) items.push({ id: randomUUID(), ...input })
      else items[index] = { id, ...input }
      if (Buffer.byteLength(JSON.stringify(items), 'utf8') > 60000) {
        throw this.createError('快捷方式配置过多，请精简后保存', 400, 'SHORTCUT_SETTINGS_TOO_LARGE')
      }
      return this.sort(items)
    })
    return result
  }
}

module.exports = DashboardShortcutsService
