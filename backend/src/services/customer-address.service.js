'use strict'

const BaseService = require('../core/base/base.service')
const RegionService = require('./region.service')
const { LEVELS, NEW_LEVELS, COLUMNS } = require('../config/customer-address')

class CustomerAddressService extends BaseService {
  constructor({ repository, catalog = new RegionService() }) {
    super()
    this.repository = repository
    this.catalog = catalog
  }

  async capabilities() {
    const columns = await this.repository.getCustomerColumns()
    const manifest = await this.catalog.getManifest()
    return {
      ready: Object.keys(COLUMNS).every(field => columns.has(field)),
      version: manifest.version, coverage: manifest.coverage
    }
  }

  async prepare(body, previous = {}) {
    const hasNewFields = NEW_LEVELS.some(field => Object.hasOwn(body, field))
    const changedParent = Boolean(previous.region_version) && LEVELS.slice(0, 2)
      .some(field => Object.hasOwn(body, field) && body[field] !== previous[field])
    if (!hasNewFields && !changedParent) return {}
    for (const field of LEVELS) {
      if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field].length > 100 || /[\u0000-\u001f]/.test(body[field]))) {
        throw this.createError('地区必须是100字以内的单行文本', 400)
      }
    }
    const selection = Object.fromEntries(LEVELS.map(field => [field, body[field] ?? previous[field] ?? '']))
    for (let index = 0; index < LEVELS.length; index++) {
      const field = LEVELS[index]
      if (Object.hasOwn(body, field) && body[field] !== (previous[field] ?? '')) {
        for (const child of LEVELS.slice(index + 1)) if (!Object.hasOwn(body, child)) selection[child] = ''
      }
    }
    if (NEW_LEVELS.every(field => selection[field] === (previous[field] ?? '')) && !changedParent) return {}
    if (!(await this.capabilities()).ready) throw this.createError('五级地址字段尚未迁移，请联系管理员；原地址未改动', 409, 'ADDRESS_SCHEMA_REQUIRED')
    const resolved = await this.catalog.resolve(selection)
    return {
      ...Object.fromEntries(NEW_LEVELS.map(field => [field, resolved[field] || null])),
      region_version: resolved.region_version,
      ...(!previous.region_version && previous.address && !previous.legacy_address ? { legacy_address: previous.address } : {})
    }
  }

  async enrich(records, { includeLegacy = false } = {}) {
    if (!records.length || !(await this.capabilities()).ready) return records
    const fields = await this.repository.getCustomerAddressFields(records.map(record => record.id))
    const byId = new Map(fields.map(record => [Number(record.id), record]))
    return records.map(record => {
      const { legacy_address: legacyAddress, ...visible } = byId.get(Number(record.id)) || {}
      for (const field of [...NEW_LEVELS, 'region_version']) if (Object.hasOwn(visible, field)) visible[field] ??= ''
      return { ...record, ...visible, ...(includeLegacy ? { legacy_address: legacyAddress } : {}) }
    })
  }
}

module.exports = CustomerAddressService
