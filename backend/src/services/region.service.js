'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const { gunzipSync } = require('node:zlib')
const { createHash } = require('node:crypto')
const BaseService = require('../core/base/base.service')
const contract = require('../contracts/regions.openapi.json')
const REGION_FIELDS = Object.keys(contract.components.schemas.RegionSelection.properties)

const DATA_DIRECTORY = path.resolve(__dirname, '../../data/regions/2023-06-30')

class RegionService extends BaseService {
  constructor({ directory = DATA_DIRECTORY } = {}) {
    super()
    this.directory = directory
    this.cache = new Map()
    this.pending = new Map()
  }

  async getManifest() {
    if (!this.manifest) this.manifest = fs.readFile(path.join(this.directory, 'manifest.json'), 'utf8')
      .then(JSON.parse).catch(error => { this.manifest = null; throw error })
    return this.manifest
  }

  async loadProvince(province) {
    if (!/^\d{2}$/.test(province)) throw this.createError('省级编码无效', 400)
    if (this.cache.has(province)) {
      const cached = this.cache.get(province)
      this.cache.delete(province)
      this.cache.set(province, cached)
      return cached
    }
    if (this.pending.has(province)) return this.pending.get(province)
    const request = (async () => {
      const manifest = await this.getManifest()
      const file = `${province}.json.gz`
      if (!Object.hasOwn(manifest.files, file)) throw this.createError('该地区不在当前五级数据覆盖范围内', 404)
      const buffer = await fs.readFile(path.join(this.directory, file))
      if (createHash('sha256').update(buffer).digest('hex') !== manifest.files[file].sha256) throw new Error('地区数据校验失败')
      const children = JSON.parse(gunzipSync(buffer, { maxOutputLength: 32 * 1024 * 1024 }).toString('utf8'))
      this.cache.set(province, children)
      while (this.cache.size > 3) this.cache.delete(this.cache.keys().next().value)
      return children
    })()
    this.pending.set(province, request)
    try { return await request } finally { this.pending.delete(province) }
  }

  async children(parent = '') {
    if (typeof parent !== 'string' || !/^(?:\d{2}|\d{4}|\d{6}|\d{9})?$/.test(parent)) throw this.createError('地区父级编码无效', 400)
    const manifest = await this.getManifest()
    const rows = parent ? (await this.loadProvince(parent.slice(0, 2)))[parent] : manifest.provinces
    if (!rows) throw this.createError('地区不存在或当前版本没有下级数据', 404)
    return { version: manifest.version, coverage: manifest.coverage, options: rows.map(([code, name]) => ({ code, name })) }
  }

  /** 根据完整父子链验证，不能仅凭编码前缀接受伪造地区。 */
  async resolve(selection) {
    const result = {}, codes = []
    let parent = ''
    for (const field of REGION_FIELDS) {
      const raw = selection[field] ?? ''
      if (typeof raw !== 'string') throw this.createError('地区必须是文本', 400)
      if (!raw) {
        if (REGION_FIELDS.slice(REGION_FIELDS.indexOf(field) + 1).some(key => selection[key])) throw this.createError('请选择完整的地区上级', 400)
        result[field] = ''
        continue
      }
      const { options } = await this.children(parent)
      let matches = options.filter(option => option.code === raw || option.name === raw)
      if (!matches.length && field === 'city' && ['11', '12', '31', '50'].includes(result.province)) {
        const manifest = await this.getManifest()
        if (manifest.provinces.some(([code, name]) => code === result.province && name === raw)) {
          const children = await this.loadProvince(result.province)
          matches = selection.district ? options.filter(option => children[option.code]?.some(([code, name]) => code === selection.district || name === selection.district)) : options.slice(0, 1)
        }
      }
      if (matches.length !== 1) throw this.createError('地区不存在、名称不唯一或不属于所选上级', 400)
      const match = matches[0]
      result[field] = field === 'province' ? match.code : match.name
      codes.push(match.code)
      parent = match.code
    }
    return { ...result, region_version: (await this.getManifest()).version }
  }
}

module.exports = RegionService
