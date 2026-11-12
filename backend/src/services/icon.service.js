'use strict'

const { getDatabase: defaultGetDatabase } = require('../config/database')
const {
  ensureIconSchema: defaultEnsureIconSchema,
  extractIconifyName: defaultExtractIconifyName,
  fetchIconifySvg: defaultFetchIconifySvg,
  iconSetToSvg,
  sanitizeSvg: defaultSanitizeSvg
} = require('../utils/iconStore')
const log = require('../utils/log')
const IconRepository = require('../repositories/icon.repository')

const BaseService = require('../core/base/base.service')

class IconService extends BaseService {
  constructor({
    getDatabase = defaultGetDatabase,
    ensureIconSchema = defaultEnsureIconSchema,
    extractIconifyName = defaultExtractIconifyName,
    fetchIconifySvg = defaultFetchIconifySvg,
    sanitizeSvg = defaultSanitizeSvg,
    repository = new IconRepository(),
    fetchIconifyJson = async () => { throw new Error('Iconify 请求未配置') },
    translateKeywords = query => [String(query || '').trim()].filter(Boolean),
    defaultSearchLimit = 50,
    logger = log
  } = {}) {
    super()
    this.getDatabase = getDatabase
    this.ensureIconSchema = ensureIconSchema
    this.extractIconifyName = extractIconifyName
    this.fetchIconifySvg = fetchIconifySvg
    this.sanitizeSvg = sanitizeSvg
    this.repository = repository
    this.fetchIconifyJson = fetchIconifyJson
    this.translateKeywords = translateKeywords
    this.defaultSearchLimit = defaultSearchLimit
    this.logger = logger
  }

  async searchOnline(queryOptions) {
    const { query, limit = this.defaultSearchLimit, prefix = '' } = queryOptions
    const normalizedQuery = String(query || '').trim()
    const normalizedPrefix = String(prefix || '').trim()
    if (!normalizedQuery) {
      return {
        success: true,
        data: [],
        total: 0,
        message: '请提供搜索关键词',
        source: 'online'
      }
    }
    if (normalizedQuery.length > 100) {
      throw this.createError('搜索关键词不能超过100个字符', 400)
    }
    if (normalizedPrefix && !/^[a-z0-9-]{1,64}$/i.test(normalizedPrefix)) {
      throw this.createError('图标集合前缀无效', 400)
    }

    const queryLimit = Math.max(1, Math.min(parseInt(limit, 10) || 50, 100))
    const translatedQueries = this.translateKeywords(normalizedQuery)
    const iconMap = new Map()
    let mergedCollections = {}

    for (const translatedQuery of translatedQueries) {
      let apiUrl = `https://api.iconify.design/search?query=${encodeURIComponent(translatedQuery)}&limit=${queryLimit}`
      if (normalizedPrefix) apiUrl += `&prefix=${encodeURIComponent(normalizedPrefix)}`

      const iconifyData = await this.fetchIconifyJson(apiUrl)
      mergedCollections = { ...mergedCollections, ...(iconifyData.collections || {}) }
      for (const iconName of iconifyData.icons || []) {
        if (!iconMap.has(iconName)) iconMap.set(iconName, iconName)
      }
      if (iconMap.size >= queryLimit) break
    }

    const iconNames = [...iconMap.values()].slice(0, queryLimit)
    if (iconNames.length === 0) {
      return {
        success: true,
        data: [],
        total: 0,
        message: '未找到匹配的图标',
        source: 'online'
      }
    }

    const icons = iconNames.map((iconName, index) => {
      const parts = iconName.split(':')
      const iconPrefix = parts[0]
      const iconSimpleName = parts[1] || iconName
      return {
        id: `online-${index}`,
        class: `iconify ${iconName}`,
        name: iconSimpleName.replace(/-/g, ' '),
        category: iconPrefix,
        description: `${iconPrefix} 图标`,
        tags: iconPrefix,
        source: 'online',
        iconifyName: iconName
      }
    })
    const collectionList = Object.keys(mergedCollections).map(key => ({
      prefix: key,
      name: mergedCollections[key].name,
      total: mergedCollections[key].total || 0
    }))

    return {
      success: true,
      data: icons,
      total: icons.length,
      message: `从在线 API 搜索到 ${icons.length} 个图标`,
      source: 'online',
      collections: collectionList.length > 0 ? collectionList : undefined
    }
  }

  async collections() {
    const collections = await this.fetchIconifyJson('https://api.iconify.design/collections')
    const collectionList = Object.entries(collections).map(([id, info]) => ({
      prefix: id,
      name: info.name,
      total: info.total || 0,
      author: info.author || 'Unknown',
      samples: info.samples || [],
      license: info.license || 'unknown'
    }))
    collectionList.sort((a, b) => b.total - a.total)

    return {
      success: true,
      data: collectionList,
      total: collectionList.length,
      message: `获取到 ${collectionList.length} 个图标集合`
    }
  }

  async preview(queryOptions) {
    const names = String(queryOptions.names || '').split(',')
    if (names.length > 24 || names.some(name => !/^[a-z0-9-]{1,64}:[a-z0-9-]{1,128}$/.test(name))) {
      throw this.createError('每次最多预览24个有效图标', 400)
    }
    const unique = [...new Set(names)]
    const groups = new Map()
    for (const name of unique) {
      const [prefix, simpleName] = name.split(':')
      if (!groups.has(prefix)) groups.set(prefix, [])
      groups.get(prefix).push(simpleName)
    }
    const results = new Map()
    const queue = [...groups]
    // 批量读取集合 JSON，限制外部并发；单个集合失败不影响其他候选。
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length) {
        const [prefix, icons] = queue.shift()
        try {
          const data = await this.fetchIconifyJson(`https://api.iconify.design/${prefix}.json?icons=${icons.map(encodeURIComponent).join(',')}`)
          for (const name of icons) results.set(`${prefix}:${name}`, await iconSetToSvg(data, name))
        } catch (error) {
          this.logger.warn('在线图标集合预览失败', { prefix, message: error.message })
        }
      }
    }))
    return {
      success: true,
      data: unique.map(name => ({ class: `iconify ${name}`, svg: results.get(name) || null })),
      message: '图标预览读取完成'
    }
  }

  async collection(params, queryOptions) {
    const { prefix } = params
    const { limit = 500 } = queryOptions
    if (!/^[a-z0-9-]{1,64}$/i.test(prefix)) {
      throw this.createError('图标集合前缀无效', 400)
    }
    const normalizedLimit = Math.max(1, Math.min(parseInt(limit, 10) || 500, 500))
    const collectionData = await this.fetchIconifyJson(
      `https://api.iconify.design/collection?prefix=${encodeURIComponent(prefix)}`
    )
    const icons = (collectionData.icons || []).slice(0, normalizedLimit).map((iconName, index) => ({
      id: `${prefix}-${index}`,
      class: `iconify ${prefix}:${iconName}`,
      name: iconName.replace(/-/g, ' '),
      category: prefix,
      description: `${prefix} 图标`,
      tags: prefix,
      source: 'online',
      iconifyName: `${prefix}:${iconName}`
    }))

    return {
      success: true,
      data: icons,
      total: icons.length,
      collection: {
        prefix,
        name: collectionData.name || prefix,
        total: collectionData.total || icons.length
      },
      message: `获取到 ${icons.length} 个图标`
    }
  }

  async list(queryOptions) {
    const {
      limit = 96,
      page = 1,
      offset,
      category,
      search,
      includeInvalid = '0'
    } = queryOptions
    const pool = this.getDatabase()
    await this.ensureIconSchema(pool)
    const pageSize = Math.max(1, Math.min(parseInt(limit, 10) || 96, 100))
    const pageNumber = Math.max(1, parseInt(page, 10) || 1)
    const parsedOffset = Number.isFinite(Number(offset))
      ? Math.max(0, parseInt(offset, 10) || 0)
      : (pageNumber - 1) * pageSize

    const { countResult, icons } = await this.repository.list(pool, { category, search, includeInvalid, pageSize, parsedOffset })
    const total = Number(countResult?.[0]?.total || 0)

    return {
      success: true,
      message: '图标数据获取成功',
      data: icons,
      total,
      page: pageNumber,
      limit: pageSize,
      hasMore: parsedOffset + icons.length < total
    }
  }

  async byClass(queryOptions) {
    const iconClass = String(queryOptions.class || '').trim()
    if (!iconClass) {
      throw this.createError('图标 class 不能为空', 400)
    }

    const pool = this.getDatabase()
    await this.ensureIconSchema(pool)
    const [icons] = await this.repository.readbyClass(pool, iconClass)

    if (icons.length === 0) {
      if (queryOptions.optional === '1') return { success: true, message: '图标尚未入库', data: null }
      throw this.createError('图标不存在', 404)
    }
    return { success: true, message: '图标获取成功', data: icons[0] }
  }

  async categories() {
    const pool = this.getDatabase()
    await this.ensureIconSchema(pool)
    const [categories] = await this.repository.readcategories(pool)
    const categoryList = categories.map(category => category.category)
    return {
      success: true,
      message: '分类数据获取成功',
      data: categoryList,
      total: categoryList.length
    }
  }

  async cache(body) {
    const pool = this.getDatabase()
    await this.ensureIconSchema(pool)
    const {
      class: iconClass,
      name,
      category,
      description,
      tags,
      iconifyName,
      svg
    } = body || {}

    const normalizedClass = String(iconClass || '').trim()
    const normalizedName = String(name || '').trim()
    const normalizedCategory = String(category || '').trim()
    const normalizedDescription = description ? String(description).trim() : null
    const normalizedTags = tags ? String(tags).trim() : null
    const normalizedIconifyName = String(iconifyName || this.extractIconifyName(normalizedClass) || '').trim() || null
    const normalizedSource = normalizedIconifyName ? 'iconify' : 'local'
    let normalizedSvg = this.sanitizeSvg(svg)

    if (!normalizedClass) {
      throw this.createError('图标 class 不能为空', 400)
    }

    if (!normalizedName) {
      throw this.createError('图标名称不能为空', 400)
    }

    if (!normalizedCategory) {
      throw this.createError('图标分类不能为空', 400)
    }

    if (normalizedClass.length > 100) {
      throw this.createError('图标 class 长度不能超过 100', 400)
    }

    if (normalizedName.length > 100) {
      throw this.createError('图标名称长度不能超过 100', 400)
    }

    if (normalizedCategory.length > 50) {
      throw this.createError('图标分类长度不能超过 50', 400)
    }

    if (normalizedTags && normalizedTags.length > 500) {
      throw this.createError('图标标签长度不能超过 500', 400)
    }

    if (normalizedIconifyName && !normalizedSvg) {
      const stored = await this.repository.findByClass(pool, normalizedClass)
      normalizedSvg = stored?.is_valid !== 0 ? this.sanitizeSvg(stored?.svg) : null
    }

    if (normalizedIconifyName && !normalizedSvg) {
      try {
        normalizedSvg = this.sanitizeSvg(await this.fetchIconifySvg(normalizedIconifyName))
      } catch (svgError) {
        this.logger.warn(`获取 Iconify SVG 失败: ${normalizedIconifyName}`, svgError)
      }
    }

    if (normalizedIconifyName && !normalizedSvg) {
      throw this.createError('图标资源获取失败，未保存，请重试', 502)
    }

    const isValid = normalizedIconifyName ? (normalizedSvg ? 1 : 0) : 1

    const icon = {
      class: normalizedClass, name: normalizedName, category: normalizedCategory,
      description: normalizedDescription, tags: normalizedTags, svg: normalizedSvg,
      iconifyName: normalizedIconifyName, source: normalizedSource, isValid
    }
    await this.repository.upsert(pool, icon)
    const cachedIcon = await this.repository.findByClass(pool, normalizedClass)

    return {
      success: true,
      message: '图标已同步到本地图标库',
      data: cachedIcon || {
        class: normalizedClass,
        name: normalizedName,
        category: normalizedCategory,
        description: normalizedDescription,
        tags: normalizedTags,
        svg: normalizedSvg,
        iconify_name: normalizedIconifyName,
        source: normalizedSource,
        is_valid: isValid
      }
    }
  }

  async cleanup() {
    const pool = this.getDatabase()
    await this.ensureIconSchema(pool)

    const deletedCount = await this.repository.cleanup(pool)

    return {
      success: true,
      message: `已清理 ${deletedCount} 个无效图标`,
      data: {
        deletedCount
      }
    }
  }

  async remove(params) {
    const pool = this.getDatabase()
    await this.ensureIconSchema(pool)
    const iconId = Number(params.id)

    if (!Number.isInteger(iconId) || iconId <= 0) {
      throw this.createError('图标 ID 不正确', 400)
    }

    const icon = await this.repository.findById(pool, iconId)

    if (!icon) {
      throw this.createError('图标不存在', 404)
    }

    const usedCount = await this.repository.countMenuUses(pool, icon.class)

    if (usedCount > 0) {
      throw this.createError(`该图标正在被 ${usedCount} 个菜单使用，请先更换菜单图标后再删除`, 409)
    }

    await this.repository.deleteById(pool, iconId)

    return {
      success: true,
      message: '图标已删除',
      data: icon
    }
  }

  async getById(params) {
    const pool = this.getDatabase()
    await this.ensureIconSchema(pool)
    const [icons] = await this.repository.readgetById(pool, params.id)

    if (icons.length === 0) throw this.createError('图标不存在', 404)
    return { success: true, message: '图标获取成功', data: icons[0] }
  }
}

module.exports = IconService
