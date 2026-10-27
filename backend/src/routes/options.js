const express = require('express')
const router = express.Router()
const { getDatabase, isConnected } = require('../config/database')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const { unifiedAuth, requireAnyPermission } = require('../middleware/unified-auth')

router.use(unifiedAuth)

// 获取手机入库中使用的颜色和内存选项
router.get('/phone-options', requireAnyPermission(['accessories:view', 'accessories:create']), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const pool = getDatabase()

    // 从专门的colors表查询所有启用的颜色
    const [colors] = await pool.execute(`
      SELECT id, name, sort_order
      FROM colors
      WHERE status = 1
      ORDER BY sort_order ASC, name ASC, id ASC
    `)

    // 从专门的memories表查询所有启用的内存容量
    const [memories] = await pool.execute(`
      SELECT id, size, sort_order, status
      FROM memories
      WHERE status = 1
      ORDER BY sort_order ASC, size ASC, id ASC
    `)

    // 从专门的brands表查询所有启用的品牌（完整对象）
    const [brands] = await pool.execute(`
      SELECT id, name, sort_order, status
      FROM brands
      WHERE status = 1
      ORDER BY sort_order ASC, name ASC, id ASC
    `)

    // 从models表查询所有启用的型号（完整对象，包含brand_id）
    const [models] = await pool.execute(`
      SELECT m.id, m.name, m.brand_id, m.sort_order, m.status
      FROM models m
      INNER JOIN brands b ON m.brand_id = b.id
      WHERE m.status = 1 AND b.status = 1
      ORDER BY m.sort_order ASC, m.name ASC, m.id ASC
    `)

    // 从phones表获取实际使用的型号（补充专用表中没有的型号）
    const [actualModels] = await pool.execute(`
      SELECT DISTINCT m.id, m.name as model, m.brand_id, m.sort_order
      FROM phones p
      LEFT JOIN models m ON p.model_id = m.id
      WHERE m.name IS NOT NULL AND m.name != ''
      AND m.name NOT IN (
        SELECT name FROM models WHERE status = 1
      )
      ORDER BY m.sort_order ASC, m.name ASC, m.id ASC
    `)

    // 从phones表获取实际使用的品牌（补充专用表中没有的品牌）
    const [actualBrands] = await pool.execute(`
      SELECT DISTINCT b.id, b.name as brand, b.sort_order
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE b.name IS NOT NULL AND b.name != ''
      AND b.name NOT IN (
        SELECT name FROM brands WHERE status = 1
      )
      ORDER BY b.sort_order ASC, b.name ASC, b.id ASC
    `)

    // 从phones表获取实际使用的颜色（补充专用表中没有的颜色）
    const [actualColors] = await pool.execute(`
      SELECT DISTINCT c.id, c.name as color, c.sort_order
      FROM phones p
      LEFT JOIN colors c ON p.color_id = c.id
      WHERE c.name IS NOT NULL AND c.name != ''
      AND c.name NOT IN (
        SELECT name FROM colors WHERE status = 1
      )
      ORDER BY c.sort_order ASC, c.name ASC, c.id ASC
    `)

    // 从phones表获取实际使用的内存（补充专用表中没有的内存）
    const [actualMemories] = await pool.execute(`
      SELECT DISTINCT mem.id, mem.size as memory, mem.sort_order
      FROM phones p
      LEFT JOIN memories mem ON p.memory_id = mem.id
      WHERE mem.size IS NOT NULL AND mem.size != ''
      AND mem.size NOT IN (
        SELECT size FROM memories WHERE status = 1
      )
      ORDER BY mem.sort_order ASC, mem.size ASC, mem.id ASC
    `)

    // 查询所有采购编号
    const [purchaseNumbers] = await pool.execute(`
      SELECT DISTINCT purchase_number
      FROM phones
      WHERE purchase_number IS NOT NULL AND purchase_number != ''
      ORDER BY purchase_number DESC
    `)

    // 查询所有成色等级
    const [conditions] = await pool.execute(`
      SELECT DISTINCT quality_grade
      FROM phones
      WHERE quality_grade IS NOT NULL AND quality_grade != ''
      ORDER BY quality_grade
    `)

    // 查询所有启用的店铺
    const [stores] = await pool.execute(`
      SELECT id, name, sort_order
      FROM stores
      WHERE status = 1
      ORDER BY sort_order ASC, name ASC, id ASC
    `)

    // 构造全新/二手选项（基于is_new字段）
    const newConditions = [
      { value: 1, label: '全新' },
      { value: 0, label: '二手' }
    ]

    const capacityOptions = [
      ...memories.map(row => ({ id: row.id, size: String(row.size), sort_order: row.sort_order })),
      ...actualMemories.map(row => ({ id: row.id, size: String(row.memory), sort_order: row.sort_order }))
    ]
    // 品牌和型号返回完整对象数组，不只是名称
    const brandObjects = brands.map(row => ({
      id: row.id,
      name: String(row.name),
      sort_order: row.sort_order || 0,
      status: row.status
    }))
    const modelObjects = models.map(row => ({
      id: row.id,
      name: String(row.name),
      brand_id: row.brand_id,
      sort_order: row.sort_order || 0,
      status: row.status
    }))
    // 颜色返回完整对象
    const colorObjects = colors.map(row => ({
      id: row.id,
      name: String(row.name),
      sort_order: row.sort_order || 0,
      status: 1
    }))

    const brandOptions = [...brandObjects, ...actualBrands.map(row => ({ id: row.id, name: String(row.brand), sort_order: row.sort_order, status: 1 }))]
    const modelOptions = [...modelObjects, ...actualModels.map(row => ({ id: row.id, name: String(row.model), brand_id: row.brand_id, sort_order: row.sort_order, status: 1 }))]
    const fullColorOptions = [...colorObjects, ...actualColors.map(row => ({ id: row.id, name: String(row.color), sort_order: row.sort_order, status: 1 }))]

    const purchaseNumberOptions = purchaseNumbers.map(row => String(row.purchase_number))
    const conditionOptions = conditions.map(row => String(row.quality_grade))
    const storeOptions = stores.map(row => ({
      id: row.id,
      name: String(row.name),
      sort_order: row.sort_order || 0
    }))

    ApiResponse.success(res, {
      colors: fullColorOptions, // 完整对象数组
      memories: capacityOptions, // 保留排序信息的完整对象数组
      brands: brandOptions, // 完整对象数组
      models: modelOptions, // 完整对象数组
      purchaseNumbers: purchaseNumberOptions,
      conditions: conditionOptions,
      stores: storeOptions,
      newConditions: newConditions
    }, '获取手机选项成功')

  } catch (error) {
    log.error('获取手机选项失败:', error)
    ApiResponse.error(res, '获取手机选项失败', 500)
  }
})

module.exports = router
