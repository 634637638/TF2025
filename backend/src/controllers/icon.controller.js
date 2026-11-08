'use strict'

const { getDatabase: defaultGetDatabase } = require('../config/database')
const {
  ensureIconSchema: defaultEnsureIconSchema,
  extractIconifyName: defaultExtractIconifyName,
  fetchIconifySvg: defaultFetchIconifySvg,
  sanitizeSvg: defaultSanitizeSvg
} = require('../utils/iconStore')
const log = require('../utils/log')
const IconRepository = require('../repositories/icon.repository')

const ICON_COLUMNS = `
  id,
  class,
  name,
  category,
  description,
  tags,
  svg,
  iconify_name,
  source,
  is_valid,
  last_checked_at,
  created_at
`

class IconController {
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

  async searchOnline(req, res) {
    try {
      const { query, limit = this.defaultSearchLimit, prefix = '' } = req.query
      const normalizedQuery = String(query || '').trim()
      const normalizedPrefix = String(prefix || '').trim()
      if (!normalizedQuery) {
        return res.json({
          success: true,
          data: [],
          total: 0,
          message: '请提供搜索关键词',
          source: 'online'
        })
      }
      if (normalizedQuery.length > 100) {
        return res.status(400).json({ success: false, message: '搜索关键词不能超过100个字符' })
      }
      if (normalizedPrefix && !/^[a-z0-9-]{1,64}$/i.test(normalizedPrefix)) {
        return res.status(400).json({ success: false, message: '图标集合前缀无效' })
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
        return res.json({
          success: true,
          data: [],
          total: 0,
          message: '未找到匹配的图标',
          source: 'online'
        })
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

      return res.json({
        success: true,
        data: icons,
        total: icons.length,
        message: `从在线 API 搜索到 ${icons.length} 个图标`,
        source: 'online',
        collections: collectionList.length > 0 ? collectionList : undefined
      })
    } catch (error) {
      this.logger.error('❌ 在线搜索失败:', error)
      return res.status(500).json({
        success: false,
        message: '在线搜索失败',
        error: error.message,
        source: 'online'
      })
    }
  }

  async collections(_req, res) {
    try {
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

      return res.json({
        success: true,
        data: collectionList,
        total: collectionList.length,
        message: `获取到 ${collectionList.length} 个图标集合`
      })
    } catch (error) {
      this.logger.error('❌ 获取集合列表失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取集合列表失败',
        error: error.message
      })
    }
  }

  async collection(req, res) {
    try {
      const { prefix } = req.params
      const { limit = 500 } = req.query
      if (!/^[a-z0-9-]{1,64}$/i.test(prefix)) {
        return res.status(400).json({ success: false, message: '图标集合前缀无效' })
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

      return res.json({
        success: true,
        data: icons,
        total: icons.length,
        collection: {
          prefix,
          name: collectionData.name || prefix,
          total: collectionData.total || icons.length
        },
        message: `获取到 ${icons.length} 个图标`
      })
    } catch (error) {
      this.logger.error('❌ 获取集合图标失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取集合图标失败',
        error: error.message
      })
    }
  }

  async list(req, res) {
    try {
      const {
        limit = 96,
        page = 1,
        offset,
        category,
        search,
        includeInvalid = '0'
      } = req.query
      const pool = this.getDatabase()
      await this.ensureIconSchema(pool)
      const pageSize = Math.max(1, Math.min(parseInt(limit, 10) || 96, 100))
      const pageNumber = Math.max(1, parseInt(page, 10) || 1)
      const parsedOffset = Number.isFinite(Number(offset))
        ? Math.max(0, parseInt(offset, 10) || 0)
        : (pageNumber - 1) * pageSize

      let whereClause = 'WHERE 1=1'
      const params = []
      if (category) {
        whereClause += ' AND category = ?'
        params.push(category)
      }
      if (search) {
        whereClause += ' AND (name LIKE ? OR class LIKE ? OR category LIKE ? OR description LIKE ? OR tags LIKE ?)'
        const searchPattern = `%${search}%`
        params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern)
      }
      if (String(includeInvalid) !== '1') {
        whereClause += ' AND (is_valid IS NULL OR is_valid = 1)'
      }

      const query = `
        SELECT ${ICON_COLUMNS}
        FROM icons
        ${whereClause}
        ORDER BY category, name
        LIMIT ? OFFSET ?
      `
      const countQuery = `SELECT COUNT(*) AS total FROM icons ${whereClause}`
      const formattedQuery = pool.format(query, [...params, pageSize, parsedOffset])
      const formattedCountQuery = pool.format(countQuery, params)
      const [[countResult], [icons]] = await Promise.all([
        pool.execute(formattedCountQuery),
        pool.execute(formattedQuery)
      ])
      const total = Number(countResult?.[0]?.total || 0)

      return res.json({
        success: true,
        message: '图标数据获取成功',
        data: icons,
        total,
        page: pageNumber,
        limit: pageSize,
        hasMore: parsedOffset + icons.length < total
      })
    } catch (error) {
      this.logger.error('获取图标数据失败:', error)
      return res.status(500).json({ success: false, message: '获取图标数据失败', error: error.message })
    }
  }

  async byClass(req, res) {
    try {
      const iconClass = String(req.query.class || '').trim()
      if (!iconClass) {
        return res.status(400).json({ success: false, message: '图标 class 不能为空' })
      }

      const pool = this.getDatabase()
      await this.ensureIconSchema(pool)
      const [icons] = await pool.execute(`
        SELECT ${ICON_COLUMNS}
        FROM icons
        WHERE class = ? AND (is_valid IS NULL OR is_valid = 1)
        LIMIT 1
      `, [iconClass])

      if (icons.length === 0) return res.status(404).json({ success: false, message: '图标不存在' })
      return res.json({ success: true, message: '图标获取成功', data: icons[0] })
    } catch (error) {
      this.logger.error('按 class 获取图标失败:', error)
      return res.status(500).json({ success: false, message: '图标获取失败', error: error.message })
    }
  }

  async categories(_req, res) {
    try {
      const pool = this.getDatabase()
      await this.ensureIconSchema(pool)
      const [categories] = await pool.execute(`
        SELECT DISTINCT category
        FROM icons
        WHERE category IS NOT NULL AND category != '' AND (is_valid IS NULL OR is_valid = 1)
        ORDER BY category
      `, [])
      const categoryList = categories.map(category => category.category)
      return res.json({
        success: true,
        message: '分类数据获取成功',
        data: categoryList,
        total: categoryList.length
      })
    } catch (error) {
      this.logger.error('获取分类数据失败:', error)
      return res.status(500).json({ success: false, message: '获取分类数据失败', error: error.message })
    }
  }

  async cache(req, res) {
    try {
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
      } = req.body || {}

      const normalizedClass = String(iconClass || '').trim()
      const normalizedName = String(name || '').trim()
      const normalizedCategory = String(category || '').trim()
      const normalizedDescription = description ? String(description).trim() : null
      const normalizedTags = tags ? String(tags).trim() : null
      const normalizedIconifyName = String(iconifyName || this.extractIconifyName(normalizedClass) || '').trim() || null
      const normalizedSource = normalizedIconifyName ? 'iconify' : 'local'
      let normalizedSvg = this.sanitizeSvg(svg)

      if (!normalizedClass) {
        return res.status(400).json({
          success: false,
          message: '图标 class 不能为空'
        })
      }

      if (!normalizedName) {
        return res.status(400).json({
          success: false,
          message: '图标名称不能为空'
        })
      }

      if (!normalizedCategory) {
        return res.status(400).json({
          success: false,
          message: '图标分类不能为空'
        })
      }

      if (normalizedClass.length > 100) {
        return res.status(400).json({
          success: false,
          message: '图标 class 长度不能超过 100'
        })
      }

      if (normalizedName.length > 100) {
        return res.status(400).json({
          success: false,
          message: '图标名称长度不能超过 100'
        })
      }

      if (normalizedCategory.length > 50) {
        return res.status(400).json({
          success: false,
          message: '图标分类长度不能超过 50'
        })
      }

      if (normalizedTags && normalizedTags.length > 500) {
        return res.status(400).json({
          success: false,
          message: '图标标签长度不能超过 500'
        })
      }

      if (normalizedIconifyName && !normalizedSvg) {
        try {
          normalizedSvg = await this.fetchIconifySvg(normalizedIconifyName)
        } catch (svgError) {
          this.logger.warn(`获取 Iconify SVG 失败: ${normalizedIconifyName}`, svgError)
        }
      }

      const isValid = normalizedIconifyName ? (normalizedSvg ? 1 : 0) : 1

      const icon = {
        class: normalizedClass, name: normalizedName, category: normalizedCategory,
        description: normalizedDescription, tags: normalizedTags, svg: normalizedSvg,
        iconifyName: normalizedIconifyName, source: normalizedSource, isValid
      }
      await this.repository.upsert(pool, icon)
      const cachedIcon = await this.repository.findByClass(pool, normalizedClass)

      res.json({
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
      })
    } catch (error) {
      this.logger.error('缓存图标到本地数据库失败:', error)
      res.status(500).json({
        success: false,
        message: '缓存图标失败',
        error: error.message
      })
    }
  }

  async cleanup(req, res) {
    try {
      const pool = this.getDatabase()
      await this.ensureIconSchema(pool)

      const deletedCount = await this.repository.cleanup(pool)

      res.json({
        success: true,
        message: `已清理 ${deletedCount} 个无效图标`,
        data: {
          deletedCount
        }
      })
    } catch (error) {
      this.logger.error('清理无效图标失败:', error)
      res.status(500).json({
        success: false,
        message: '清理无效图标失败',
        error: error.message
      })
    }
  }

  async remove(req, res) {
    try {
      const pool = this.getDatabase()
      await this.ensureIconSchema(pool)
      const iconId = Number(req.params.id)

      if (!Number.isInteger(iconId) || iconId <= 0) {
        return res.status(400).json({
          success: false,
          message: '图标 ID 不正确'
        })
      }

      const icon = await this.repository.findById(pool, iconId)

      if (!icon) {
        return res.status(404).json({
          success: false,
          message: '图标不存在'
        })
      }

      const usedCount = await this.repository.countMenuUses(pool, icon.class)

      if (usedCount > 0) {
        return res.status(409).json({
          success: false,
          message: `该图标正在被 ${usedCount} 个菜单使用，请先更换菜单图标后再删除`
        })
      }

      await this.repository.deleteById(pool, iconId)

      res.json({
        success: true,
        message: '图标已删除',
        data: icon
      })
    } catch (error) {
      this.logger.error('删除图标失败:', error)
      res.status(500).json({
        success: false,
        message: '删除图标失败',
        error: error.message
      })
    }
  }

  async getById(req, res) {
    try {
      const pool = this.getDatabase()
      await this.ensureIconSchema(pool)
      const [icons] = await pool.execute(`
        SELECT ${ICON_COLUMNS}
        FROM icons
        WHERE id = ?
      `, [req.params.id])

      if (icons.length === 0) return res.status(404).json({ success: false, message: '图标不存在' })
      return res.json({ success: true, message: '图标获取成功', data: icons[0] })
    } catch (error) {
      this.logger.error('获取图标失败:', error)
      return res.status(500).json({ success: false, message: '获取图标失败', error: error.message })
    }
  }
}

module.exports = IconController
