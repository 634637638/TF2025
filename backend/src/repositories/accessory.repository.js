/**
 * 配件数据访问层
 * 处理所有配件相关的数据库操作
 */
const BaseRepository = require('./base.repository')
const log = require('../utils/log')
const { appendStoreScopeCondition } = require('../utils/store-scope')
const { hasColumn } = require('../utils/schema-inspector')
const { purchaseSnapshotText } = require('../utils/accessory-purchase-snapshot')
const { appendPurchaseStoreScope } = require('../utils/accessory-purchase-scope')
const { normalizedModelSql, escapeLikePattern } = require('../utils/search')
const AccessoryTemplateColorRepository = require('./accessory-template-color.repository')

// 品牌库存商品继承模板的共享资料；品牌、采购来源和库存仍归实际商品。
const templateField = field => `IF(a.template_id IS NULL, a.${field}, t.${field})`
const ACCESSORY_STATUS = templateField('status')
const ACCESSORY_SELECT_FIELDS = (purchaseCost = 'a.purchase_cost') => `
  a.id, a.template_id,
  ${['name', 'barcode', 'category_id', 'model_id', 'color_id', 'sale_price', 'unit_id', 'description', 'image_url', 'serial_tracking', 'min_stock', 'product_model', 'remarks'].map(field => `${templateField(field)} AS ${field}`).join(',\n  ')},
  COALESCE(ac.name, ${templateField('category')}) AS category,
  COALESCE(au.name, ${templateField('unit')}) AS unit,
  a.brand_id, a.supplier_id, ${purchaseCost} AS purchase_cost,
  ${ACCESSORY_STATUS} AS status,
  a.created_at, a.updated_at
`

// 展示进价取授权范围内最近一笔有效采购；不改商品主档或历史交易成本。
function purchaseCostProjection(scope) {
  if (!scope) return { sql: 'a.purchase_cost', params: [] }
  const conditions = ['si.accessory_id = a.id', "si.status = 'completed'"], params = []
  appendPurchaseStoreScope(scope, 'si', conditions, params)
  return { sql: `COALESCE((SELECT si.purchase_cost FROM accessory_stock_in si
    WHERE ${conditions.join(' AND ')} ORDER BY si.inventory_time DESC, si.id DESC LIMIT 1), a.purchase_cost)`, params }
}

class AccessoryRepository extends BaseRepository {
  constructor({ columnExists = hasColumn, templateColors = new AccessoryTemplateColorRepository() } = {}) {
    super('accessories')
    this.columnExists = columnExists
    this.templateColors = templateColors
  }

  /** 积分范围选项仅公开商品档案，不返回库存、成本或供应商。 */
  async getPointsProducts({ categoryIds = [], ids = [], search = '', page = 1, pageSize = 50 } = {}) {
    const conditions = [], params = []
    if (ids.length) {
      conditions.push(`a.id IN (${ids.map(() => '?').join(',')})`)
      params.push(...ids)
    } else {
      conditions.push(`${ACCESSORY_STATUS} = 1`, '(a.template_id IS NOT NULL OR EXISTS (SELECT 1 FROM accessory_stock ps WHERE ps.accessory_id = a.id))')
    }
    if (categoryIds.length) {
      conditions.push(`${templateField('category_id')} IN (${categoryIds.map(() => '?').join(',')})`)
      params.push(...categoryIds)
    }
    if (search) {
      conditions.push(`(${templateField('name')} LIKE ? OR ${templateField('product_model')} LIKE ? OR b.name LIKE ?)`)
      const keyword = `%${escapeLikePattern(search)}%`
      params.push(keyword, keyword, keyword)
    }
    const from = `FROM accessories a LEFT JOIN accessories t ON t.id = a.template_id
      LEFT JOIN brands b ON b.id = a.brand_id LEFT JOIN colors c ON c.id = ${templateField('color_id')}
      WHERE ${conditions.length ? conditions.join(' AND ') : '1 = 0'}`
    const [count] = await this.queryRows(`SELECT COUNT(*) AS total ${from}`, params)
    const data = await this.queryRows(`SELECT a.id, ${templateField('name')} AS name,
      ${templateField('category_id')} AS category_id, ${templateField('product_model')} AS product_model,
      b.name AS brand_name, c.name AS color_name, ${ACCESSORY_STATUS} AS status
      ${from} ORDER BY a.id LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, params)
    return { data: data.map(row => ({ ...row, id: Number(row.id), category_id: Number(row.category_id), status: Number(row.status) })),
      pagination: { page, page_size: pageSize, total: Number(count.total) } }
  }

  async filmReady(executor) {
    return this.columnExists('accessories', 'free_film', executor)
  }

  async filmSelect(executor) {
    const ready = await this.filmReady(executor)
    return `${ready ? templateField('free_film') : 'NULL'} AS free_film`
  }

  /** 共用分类首行串行化模板配置与适配范围变更，不创建业务锁记录。 */
  async lockFilmConfiguration(executor, data = {}) {
    if (!await this.filmReady(executor)) {
      if (data.free_film !== undefined) throw Object.assign(new Error('模板贴膜结构尚未就绪，请先完成迁移'), { statusCode: 409, code: 'FILM_SERVICE_NOT_READY' })
      return false
    }
    await this.queryRows('SELECT id FROM accessory_categories ORDER BY id LIMIT 1 FOR UPDATE', [], executor)
    return true
  }

  async queryRows(sql, params = [], executor) {
    const [rows] = await (executor || this.getConnection()).query(sql, params)
    return rows
  }

  /** 销售候选只读取所选授权门店，不返回采购成本或其他门店库存。 */
  async getSaleOptions({ storeId, search, searchFields, page, pageSize, filmOnly = false, filmFreeOnly, filmModelId, searchMode, exactMatch = false, includePurchaseCost = false }) {
    const category = `COALESCE(sale_category.name, ${templateField('category')})`
    const columns = { name: templateField('name'), category, barcode: templateField('barcode'), brand_name: 'b.name', product_model: templateField('product_model') }
    const conditions = ['st.store_id = ?', 'st.quantity > 0', `${ACCESSORY_STATUS} = 1`]
    const params = [storeId]
    const serialCount = "(SELECT COUNT(*) FROM accessory_serials sn WHERE sn.accessory_id = a.id AND sn.store_id = st.store_id AND sn.status = 'in_stock')"
    if (searchMode === 'regular') conditions.push(`st.quantity > ${serialCount}`)
    if (searchMode === 'serial' && !searchFields.includes('serial_number')) conditions.push('1 = 0')
    if (filmOnly) {
      // 贴膜候选只允许膜类目录，避免把手机壳、数据线等普通配件混入办理流程。
      conditions.push(`EXISTS (SELECT 1 FROM accessory_categories fc WHERE fc.id = ${templateField('category_id')} AND fc.status = 1 AND fc.name LIKE '%膜%')`)
      if (filmFreeOnly === true) conditions.push(`${templateField('free_film')} = 1`)
      // 收费模式允许选择免费专用膜并按正常价格收费；只有免费模式需要限定开关。
      if (filmModelId) {
        conditions.push(`(EXISTS (SELECT 1 FROM accessory_compatible_models fm WHERE fm.accessory_id = COALESCE(a.template_id,a.id) AND fm.model_id = ?) OR (NOT EXISTS (SELECT 1 FROM accessory_compatible_models fm WHERE fm.accessory_id = COALESCE(a.template_id,a.id)) AND (${templateField('model_id')} IS NULL OR ${templateField('model_id')} = ?)))`)
        params.push(filmModelId, filmModelId)
      }
    }
    if (exactMatch) {
      if (searchMode === 'serial' && searchFields.includes('serial_number')) conditions.push('picked_sn.serial_number = ?')
      else if (searchMode === 'regular' && searchFields.includes('barcode')) conditions.push(`${columns.barcode} = ?`)
      else conditions.push('1 = 0')
      if ((searchMode === 'serial' && searchFields.includes('serial_number')) || (searchMode === 'regular' && searchFields.includes('barcode'))) params.push(search)
    } else if (searchMode === 'serial' && search) {
      // 商品模式也要能按名称、型号、条码找到纯 SN 库存，SN 本身仍保留为检索条件。
      const serialMatches = searchFields.filter(field => columns[field]).map(field => `${columns[field]} LIKE ?`)
      serialMatches.push('picked_sn.serial_number LIKE ?')
      params.push(...serialMatches.map(() => `%${search}%`))
      conditions.push(`(${serialMatches.join(' OR ')})`)
    } else if (search) {
      const matches = searchFields.filter(field => columns[field]).map(field => `${columns[field]} LIKE ?`)
      params.push(...matches.map(() => `%${search}%`))
      if (!searchMode && searchFields.includes('serial_number')) {
        matches.push("EXISTS (SELECT 1 FROM accessory_serials sn WHERE sn.accessory_id = a.id AND sn.store_id = st.store_id AND sn.status = 'in_stock' AND sn.serial_number LIKE ?)")
        params.push(`%${search}%`)
      }
      conditions.push(matches.length ? `(${matches.join(' OR ')})` : '1 = 0')
    }
    const from = `FROM accessory_stock st JOIN accessories a ON a.id = st.accessory_id
      LEFT JOIN accessories t ON t.id = a.template_id LEFT JOIN brands b ON b.id = a.brand_id
      LEFT JOIN accessory_categories sale_category ON sale_category.id = ${templateField('category_id')}
      LEFT JOIN colors sale_color ON sale_color.id = ${templateField('color_id')}
      LEFT JOIN accessory_units sale_unit ON sale_unit.id = ${templateField('unit_id')}
      ${searchMode === 'serial' ? 'JOIN accessory_serials picked_sn ON picked_sn.accessory_id = a.id AND picked_sn.store_id = st.store_id AND picked_sn.status = \'in_stock\'' : ''}
      WHERE ${conditions.join(' AND ')}`
    const [count] = await this.queryRows(`SELECT COUNT(*) AS total ${from}`, params)
    const data = await this.queryRows(`SELECT a.id, ${templateField('name')} AS name,
      ${templateField('barcode')} AS barcode, ${category} AS category, b.name AS brand_name, ${templateField('product_model')} AS product_model,
      sale_color.name AS color_name, COALESCE(sale_unit.name, ${templateField('unit')}) AS unit,
      ${templateField('sale_price')} AS sale_price${includePurchaseCost ? ', a.purchase_cost AS purchase_cost' : ''},
      ${searchMode === 'regular' ? `st.quantity - ${serialCount}` : searchMode === 'serial' ? '1' : 'st.quantity'} AS quantity,
      ${searchMode === 'regular' ? '0' : searchMode === 'serial' ? '1' : serialCount} AS serial_quantity
      ${searchMode === 'serial' ? ', picked_sn.serial_number' : ''}
      ${from} ORDER BY ${templateField('name')}, b.name, a.id${searchMode === 'serial' ? ', picked_sn.serial_number' : ''} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, params)
    return { data, pagination: { page, page_size: pageSize, total: Number(count.total) } }
  }

  async getProductCatalog() {
    const filmReady = await this.filmReady()
    const [categories, units] = await Promise.all([
      this.getProductCategories(),
      this.queryRows('SELECT id, name, status, sort_order, created_at, updated_at FROM accessory_units ORDER BY sort_order, name, id')
    ])
    return { categories, units, film_ready: filmReady }
  }

  async getProductCategories() {
    return this.queryRows(`SELECT id, name, status, sort_order, description,
      created_at, updated_at FROM accessory_categories ORDER BY sort_order, name, id`)
  }

  async saveCatalogItem(kind, id, data) {
    const tables = { category: 'accessory_categories', unit: 'accessory_units' }
    const table = tables[kind]
    if (!table) throw new Error('不支持的商品资料类型')
    if (data.film_enabled !== undefined) throw Object.assign(new Error('贴膜配置已移至商品模板'), { statusCode: 400, code: 'VALIDATION_ERROR' })
    if (id) {
      const [result] = await this.executePrepared(
        `UPDATE ${table} SET name = ?, status = ?, sort_order = ?, ${kind === 'category' ? 'description = ?,' : ''} updated_at = NOW() WHERE id = ?`,
        kind === 'category'
          ? [data.name, data.status, data.sort_order, data.description, id]
          : [data.name, data.status, data.sort_order, id]
      )
      return result.affectedRows > 0
    }
    const columns = kind === 'category' ? 'name, status, sort_order, description' : 'name, status, sort_order'
    const values = kind === 'category' ? [data.name, data.status, data.sort_order, data.description] : [data.name, data.status, data.sort_order]
    const [result] = await this.executePrepared(`INSERT INTO ${table} (${columns}) VALUES (${values.map(() => '?').join(', ')})`, values)
    return result.insertId
  }

  /** 只查询已有公共资料，不在入库时创建或修改公共主档。 */
  async getReference(id, resource, executor) {
    const tables = { brand_id: 'brands', model_id: 'models', color_id: 'colors', supplier_id: 'suppliers', store_id: 'stores', category_id: 'accessory_categories', unit_id: 'accessory_units' }
    const table = tables[resource]
    if (!table) throw new Error('不支持的配件参考资料')
    const extra = resource === 'model_id' ? ', brand_id, (SELECT business_scope FROM brands WHERE id = models.brand_id) AS brand_business_scope' : ''
    const scopeColumn = ['supplier_id', 'brand_id'].includes(resource) ? ', business_scope' : ''
    // 事务内采购引用持有供应商共享锁，与删除的排他锁串行，避免历史单据成为孤儿。
    const lock = resource === 'supplier_id' && executor ? ' LOCK IN SHARE MODE' : ''
    const rows = await this.queryRows(`SELECT id, name, status${extra}${scopeColumn} FROM ${table} WHERE id = ?${lock}`, [id], executor)
    return rows[0] || null
  }

  async getEntryOptions({ storeScope, brandId, modelIds = [], current = {} }) {
    const options = {}
    const resources = [
      ['brands', 'brand_id'], ['colors', 'color_id'], ['suppliers', 'supplier_id'], ['stores', 'store_id']
    ]
    for (const [table, field] of resources) {
      const params = [current[field] || null]
      let where = '(status = 1 OR id = ?)'
      if (table === 'brands') {
        where = '(status = 1 OR id IN (?, ?))'
        params.push(current.model_brand_id || null)
      }
      if (table === 'stores' && !storeScope.allStores) {
        if (!storeScope.storeIds.length) {
          options[table] = []
          continue
        }
        where += ` AND id IN (${storeScope.storeIds.map(() => '?').join(',')})`
        params.push(...storeScope.storeIds)
      }
      if (table === 'suppliers') {
        where = "((business_scope IN ('accessory', 'both') AND status = 1) OR id = ?)"
      }
      options[table] = await this.queryRows(
        `SELECT id, name, status, sort_order${table === 'brands' ? ', business_scope' : ''} FROM ${table} WHERE ${where} ORDER BY sort_order, name, id`, params
      )
    }
    const brandOption = row => ({ id: row.id, name: row.name, status: row.status, sort_order: row.sort_order })
    options.model_brands = options.brands.filter(row => (Number(row.status) === 1 && row.business_scope !== 'accessory') || Number(row.id) === Number(current.model_brand_id)).map(brandOption)
    options.brands = options.brands.filter(row => (Number(row.status) === 1 && row.business_scope !== 'phone') || Number(row.id) === Number(current.brand_id)).map(brandOption)
    options.film_ready = await this.filmReady()
    options.categories = await this.queryRows(
      'SELECT id, name, status, sort_order FROM accessory_categories WHERE status = 1 OR id = ? ORDER BY sort_order, name, id',
      [current.category_id || null]
    )
    options.units = await this.queryRows(
      'SELECT id, name, status, sort_order FROM accessory_units WHERE status = 1 OR id = ? ORDER BY sort_order, name, id',
      [current.unit_id || null]
    )
    const currentModelIds = Array.isArray(current.model_ids)
      ? current.model_ids
      : String(current.model_ids || current.model_id || '').split(',').filter(Boolean)
    const selectedModelIds = [...new Set([...modelIds, ...currentModelIds].map(Number).filter(Number.isSafeInteger))]
    const modelParams = []
    const selectedCondition = selectedModelIds.length ? `m.id IN (${selectedModelIds.map(() => '?').join(',')})` : '1 = 0'
    const activeBrandCondition = brandId ? "(m.brand_id = ? AND m.status = 1 AND b.status = 1 AND b.business_scope IN ('phone', 'both'))" : '1 = 0'
    const modelConditions = [`(${activeBrandCondition} OR ${selectedCondition})`]
    if (brandId) modelParams.push(brandId)
    modelParams.push(...selectedModelIds)
    options.models = brandId || selectedModelIds.length ? await this.queryRows(
      `SELECT m.id, m.name, m.brand_id, m.status, m.sort_order FROM models m
       INNER JOIN brands b ON b.id = m.brand_id
       WHERE ${modelConditions.join(' AND ')}
       ORDER BY m.sort_order, m.name, m.id`, modelParams
    ) : []
    return options
  }

  /**
   * 获取配件列表（带分页和筛选）
   */
  async getAccessories(options = {}, executor) {
    try {
      const {
        page = 1,
        page_size = 50,
        category,
        brand_id,
        model_id,
        model_name,
        color_id,
        supplier_id,
        status = 1,
        search,
        mode,
        search_fields = ['name', 'barcode']
      } = options

      const normalized_page_size = Math.min(100, Math.max(1, Number.parseInt(page_size, 10) || 50))
      const normalizedPage = Math.max(1, Number.parseInt(page, 10) || 1)
      const offset = (normalizedPage - 1) * normalized_page_size
      const conditions = []
      const params = []
      const templateColorsReady = mode === 'templates' && executor && await this.templateColors.ready(executor)
      const modelNameColumn = `CONCAT_WS(' ', mb.name, m.name, (
        SELECT GROUP_CONCAT(CONCAT_WS(' ', search_brand.name, search_model.name))
        FROM accessory_compatible_models search_am
        INNER JOIN models search_model ON search_model.id = search_am.model_id
        INNER JOIN brands search_brand ON search_brand.id = search_model.brand_id
        WHERE search_am.accessory_id = COALESCE(a.template_id, a.id)
      ))`

      const stockConditions = ['current_stock.accessory_id = a.id'], stockParams = []
      appendStoreScopeCondition(options.store_scope, 'current_stock.store_id', stockConditions, stockParams)
      const stockExists = `EXISTS (SELECT 1 FROM accessory_stock current_stock WHERE ${stockConditions.join(' AND ')})`
      if (mode === 'templates') {
        conditions.push('a.template_id IS NULL')
        if (templateColorsReady) conditions.push('NOT EXISTS (SELECT 1 FROM accessory_template_colors variant WHERE variant.accessory_id = a.id)')
      }
      else {
        conditions.push(mode === 'inventory' ? stockExists : `(a.template_id IS NULL OR ${stockExists})`)
        params.push(...stockParams)
      }
      const stockJoinConditions = ['a.id = ast.accessory_id'], stockJoinParams = []
      appendStoreScopeCondition(options.store_scope, 'ast.store_id', stockJoinConditions, stockJoinParams)

      // 构建查询条件
      if (status !== null && status !== undefined) {
        conditions.push(`${ACCESSORY_STATUS} = ?`)
        params.push(status)
      }

      if (category) {
        conditions.push(`COALESCE(ac.name, ${templateField('category')}) = ?`)
        params.push(category)
      }

      if (brand_id) {
        if (mode === 'templates') {
          const brandStockConditions = ['brand_stock.accessory_id = branded_product.id'], brandStockParams = []
          appendStoreScopeCondition(options.store_scope, 'brand_stock.store_id', brandStockConditions, brandStockParams)
          const linkedTemplate = templateColorsReady
            ? '(branded_product.template_id = a.id OR branded_product.template_id IN (SELECT brand_variant.accessory_id FROM accessory_template_colors brand_variant WHERE brand_variant.template_id = a.id))'
            : 'branded_product.template_id = a.id'
          conditions.push(`(a.brand_id = ? OR EXISTS (SELECT 1 FROM accessories branded_product
            WHERE branded_product.brand_id = ? AND ${linkedTemplate}
              AND EXISTS (SELECT 1 FROM accessory_stock brand_stock WHERE ${brandStockConditions.join(' AND ')})))`)
          params.push(brand_id, brand_id, ...brandStockParams)
        } else {
          conditions.push('a.brand_id = ?')
          params.push(brand_id)
        }
      }

      if (model_id) {
        conditions.push(`(${templateField('model_id')} = ? OR EXISTS (SELECT 1 FROM accessory_compatible_models am WHERE am.accessory_id = COALESCE(a.template_id, a.id) AND am.model_id = ?))`)
        params.push(model_id, model_id)
      }

      if (model_name?.trim() === '通用') {
        conditions.push(`(${templateField('model_id')} IS NULL AND NOT EXISTS (SELECT 1 FROM accessory_compatible_models am WHERE am.accessory_id = COALESCE(a.template_id, a.id)))`)
      } else if (model_name?.trim()) {
        for (const keyword of model_name.trim().split(/\s+/u).filter(Boolean)) {
          conditions.push(`CONVERT(${normalizedModelSql(modelNameColumn)} USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONVERT(${normalizedModelSql('?')} USING utf8mb4) COLLATE utf8mb4_unicode_ci ESCAPE '!'`)
          params.push(`%${escapeLikePattern(keyword)}%`)
        }
      }

      if (color_id) {
        conditions.push(templateColorsReady
          ? `(${templateField('color_id')} = ? OR EXISTS (SELECT 1 FROM accessory_template_colors selected_color WHERE selected_color.template_id = a.id AND selected_color.color_id = ?))`
          : `${templateField('color_id')} = ?`)
        params.push(color_id, ...(templateColorsReady ? [color_id] : []))
      }

      if (supplier_id) {
        conditions.push('a.supplier_id = ?')
        params.push(supplier_id)
      }

      if (search) {
        const allowedSearchColumns = {
          name: templateField('name'), barcode: templateField('barcode'), category: `COALESCE(ac.name, ${templateField('category')})`,
          brand_name: 'b.name', product_model: templateField('product_model'), color_name: 'c.name',
          model_name: modelNameColumn
        }
        const searchColumns = search_fields.filter(field => Object.hasOwn(allowedSearchColumns, field)).map(field => ({
          column: field === 'barcode' ? allowedSearchColumns[field] : normalizedModelSql(allowedSearchColumns[field]),
          parameter: field === 'barcode' ? '?' : normalizedModelSql('?')
        }))
        // 多关键词共同限定同一商品；名称和型号复用公共标准化规则，不在前端二次过滤。
        for (const keyword of search.trim().split(/\s+/u).filter(Boolean)) {
          if (!searchColumns.length) break
          const matches = searchColumns.map(({ column, parameter }) => `CONVERT(${column} USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONVERT(${parameter} USING utf8mb4) COLLATE utf8mb4_unicode_ci ESCAPE '!'`)
          params.push(...searchColumns.map(() => `%${escapeLikePattern(keyword)}%`))
          for (const field of ['barcode', 'color_name'].filter(field => templateColorsReady && search_fields.includes(field))) {
            matches.push(`EXISTS (SELECT 1 FROM accessory_template_colors variant
              JOIN accessories color_product ON color_product.id = variant.accessory_id
              LEFT JOIN colors variant_color ON variant_color.id = variant.color_id
              WHERE variant.template_id = a.id AND ${field === 'barcode' ? 'color_product.barcode' : 'variant_color.name'} LIKE ? ESCAPE '!')`)
            params.push(`%${escapeLikePattern(keyword)}%`)
          }
          conditions.push(`(${matches.join(' OR ')})`)
        }
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

      // 查询总数
      const countQuery = `
        SELECT COUNT(DISTINCT a.id) as total
        FROM accessories a
        LEFT JOIN accessories t ON t.id = a.template_id
        LEFT JOIN accessory_categories ac ON ac.id = ${templateField('category_id')}
        LEFT JOIN brands b ON b.id = a.brand_id
        LEFT JOIN models m ON m.id = ${templateField('model_id')}
        LEFT JOIN brands mb ON mb.id = m.brand_id
        LEFT JOIN colors c ON ${templateField('color_id')} = c.id
        ${whereClause}
      `
      const countResult = await this.queryRows(countQuery, params, executor)
      const total = countResult && countResult.length > 0 ? countResult[0].total : 0

      // 查询列表
      const cost = purchaseCostProjection(mode === 'templates' ? undefined : options.store_scope)
      const query = `
        SELECT
          ${ACCESSORY_SELECT_FIELDS(cost.sql)}, ${await this.filmSelect(executor)},
          b.name as brand_name,
          m.name as model_name,
          m.brand_id as model_brand_id,
          mb.name as model_brand_name,
          cm.model_ids,
          cm.compatible_model_names,
          cm.compatible_brand_names,
          c.name as color_name,
          s.name as supplier_name,
          COALESCE(SUM(ast.quantity), 0) as total_stock,
          COALESCE(SUM(ast.total_in), 0) as total_in,
          COALESCE(SUM(ast.total_out), 0) as total_out
        FROM accessories a
        LEFT JOIN accessories t ON t.id = a.template_id
        LEFT JOIN accessory_categories ac ON ac.id = ${templateField('category_id')}
        LEFT JOIN accessory_units au ON au.id = ${templateField('unit_id')}
        LEFT JOIN brands b ON a.brand_id = b.id
        LEFT JOIN models m ON ${templateField('model_id')} = m.id
        LEFT JOIN brands mb ON m.brand_id = mb.id
        LEFT JOIN (
          SELECT am.accessory_id,
                 GROUP_CONCAT(DISTINCT am.model_id ORDER BY am.model_id) AS model_ids,
                 GROUP_CONCAT(DISTINCT CONCAT(model_brand.name, ' ', compatible_model.name) ORDER BY model_brand.name, compatible_model.name SEPARATOR ', ') AS compatible_model_names,
                 GROUP_CONCAT(DISTINCT model_brand.name ORDER BY model_brand.name SEPARATOR ' / ') AS compatible_brand_names
          FROM accessory_compatible_models am
          INNER JOIN models compatible_model ON compatible_model.id = am.model_id
          INNER JOIN brands model_brand ON model_brand.id = compatible_model.brand_id
          GROUP BY am.accessory_id
        ) cm ON cm.accessory_id = COALESCE(a.template_id, a.id)
        LEFT JOIN colors c ON ${templateField('color_id')} = c.id
        LEFT JOIN suppliers s ON a.supplier_id = s.id
        LEFT JOIN accessory_stock ast ON ${stockJoinConditions.join(' AND ')}
        ${whereClause}
        GROUP BY a.id
        ORDER BY a.id DESC
        LIMIT ? OFFSET ?
      `

      const accessories = await this.queryRows(query, [...cost.params, ...stockJoinParams, ...params, normalized_page_size, offset], executor)

      return {
        data: await this.templateColors.attach(accessories, executor),
        pagination: {
          page: normalizedPage,
          page_size: normalized_page_size,
          total,
          total_pages: Math.ceil(total / normalized_page_size),
          has_next: normalizedPage * normalized_page_size < total,
          has_prev: normalizedPage > 1
        }
      }
    } catch (error) {
      log.error('获取配件列表失败:', error)
      throw error
    }
  }

  /**
   * 根据ID获取配件详情
   */
  async getAccessoryById(id, executor, { forUpdate = false, currentRead = false, storeScope } = {}) {
    try {
      const cost = purchaseCostProjection(storeScope)
      const query = `
        SELECT
          ${ACCESSORY_SELECT_FIELDS(cost.sql)}, ${await this.filmSelect(executor)},
          b.name as brand_name,
          m.name as model_name,
          m.brand_id as model_brand_id,
          mb.name as model_brand_name,
          cm.model_ids,
          cm.compatible_model_names,
          cm.compatible_brand_names,
          c.name as color_name,
          s.name as supplier_name
        FROM accessories a
        LEFT JOIN accessories t ON t.id = a.template_id
        LEFT JOIN accessory_categories ac ON ac.id = ${templateField('category_id')}
        LEFT JOIN accessory_units au ON au.id = ${templateField('unit_id')}
        LEFT JOIN brands b ON a.brand_id = b.id
        LEFT JOIN models m ON ${templateField('model_id')} = m.id
        LEFT JOIN brands mb ON m.brand_id = mb.id
        LEFT JOIN (
          SELECT am.accessory_id,
                 GROUP_CONCAT(DISTINCT am.model_id ORDER BY am.model_id) AS model_ids,
                 GROUP_CONCAT(DISTINCT CONCAT(model_brand.name, ' ', compatible_model.name) ORDER BY model_brand.name, compatible_model.name SEPARATOR ', ') AS compatible_model_names,
                 GROUP_CONCAT(DISTINCT model_brand.name ORDER BY model_brand.name SEPARATOR ' / ') AS compatible_brand_names
          FROM accessory_compatible_models am
          INNER JOIN models compatible_model ON compatible_model.id = am.model_id
          INNER JOIN brands model_brand ON model_brand.id = compatible_model.brand_id
          GROUP BY am.accessory_id
        ) cm ON cm.accessory_id = COALESCE(a.template_id, a.id)
        LEFT JOIN colors c ON ${templateField('color_id')} = c.id
        LEFT JOIN suppliers s ON a.supplier_id = s.id
        WHERE a.id = ?
        ${forUpdate ? 'FOR UPDATE' : currentRead ? 'LOCK IN SHARE MODE' : ''}
      `

      const accessories = await this.queryRows(query, [...cost.params, id], executor)
      return accessories && accessories.length > 0 ? (await this.templateColors.attach(accessories, executor, { currentRead }))[0] : null
    } catch (error) {
      log.error('获取配件详情失败:', error)
      throw error
    }
  }

  /**
   * 根据条形码获取配件
   */
  async getAccessoryByBarcode(barcode, executor, { includeInactive = false, storeScope } = {}) {
    try {
      const cost = purchaseCostProjection(storeScope)
      const query = `
        SELECT
          ${ACCESSORY_SELECT_FIELDS(cost.sql)}, ${await this.filmSelect(executor)},
          b.name as brand_name,
          m.name as model_name,
          m.brand_id as model_brand_id,
          mb.name as model_brand_name,
          cm.model_ids,
          cm.compatible_model_names,
          cm.compatible_brand_names,
          c.name as color_name,
          s.name as supplier_name
        FROM accessories a
        LEFT JOIN accessories t ON t.id = a.template_id
        LEFT JOIN accessory_categories ac ON ac.id = ${templateField('category_id')}
        LEFT JOIN accessory_units au ON au.id = ${templateField('unit_id')}
        LEFT JOIN brands b ON a.brand_id = b.id
        LEFT JOIN models m ON ${templateField('model_id')} = m.id
        LEFT JOIN brands mb ON m.brand_id = mb.id
        LEFT JOIN (
          SELECT am.accessory_id,
                 GROUP_CONCAT(DISTINCT am.model_id ORDER BY am.model_id) AS model_ids,
                 GROUP_CONCAT(DISTINCT CONCAT(model_brand.name, ' ', compatible_model.name) ORDER BY model_brand.name, compatible_model.name SEPARATOR ', ') AS compatible_model_names,
                 GROUP_CONCAT(DISTINCT model_brand.name ORDER BY model_brand.name SEPARATOR ' / ') AS compatible_brand_names
          FROM accessory_compatible_models am
          INNER JOIN models compatible_model ON compatible_model.id = am.model_id
          INNER JOIN brands model_brand ON model_brand.id = compatible_model.brand_id
          GROUP BY am.accessory_id
        ) cm ON cm.accessory_id = COALESCE(a.template_id, a.id)
        LEFT JOIN colors c ON ${templateField('color_id')} = c.id
        LEFT JOIN suppliers s ON a.supplier_id = s.id
        WHERE a.barcode = ? ${includeInactive ? '' : 'AND a.status = 1'}
      `

      const accessories = await this.queryRows(query, [...cost.params, barcode], executor)
      return accessories && accessories.length > 0 ? (await this.templateColors.attach(accessories, executor))[0] : null
    } catch (error) {
      log.error('根据条形码获取配件失败:', error)
      throw error
    }
  }

  /**
   * 创建配件
   */
  async createAccessory(data, executor) {
    try {
      const filmWrite = data.free_film !== undefined
      if (filmWrite && !await this.filmReady(executor)) throw Object.assign(new Error('模板贴膜结构尚未就绪'), { statusCode: 409, code: 'FILM_SERVICE_NOT_READY' })
      const query = `
        INSERT INTO accessories (
          name, barcode, category, category_id, product_model, brand_id, model_id, color_id, supplier_id,
          purchase_cost, sale_price, unit, unit_id, status,
          description, remarks, image_url, template_id, serial_tracking, min_stock${filmWrite ? ', free_film' : ''}
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${filmWrite ? ', ?' : ''})
      `

      const params = [
        data.name,
        data.barcode || null,
        data.category || null,
        data.category_id || null,
        data.product_model || null,
        data.brand_id || null,
        data.model_id || null,
        data.color_id || null,
        data.supplier_id || null,
        data.purchase_cost || 0,
        data.sale_price || 0,
        data.unit || '个',
        data.unit_id || null,
        data.status !== undefined ? data.status : 1,
        data.description || null,
        data.remarks || null,
        data.image_url || null,
        data.template_id || null,
        data.serial_tracking ? 1 : 0,
        data.min_stock ?? 5,
        ...(filmWrite ? [data.free_film] : [])
      ]

      const [result] = await (executor || this.getConnection()).query(query, params)
      return result.insertId
    } catch (error) {
      log.error('创建配件失败:', error)
      throw error
    }
  }

  /** 只同步商品展示资料，交易数量、金额、成本、SN与历史身份均保留。 */
  async syncProductProfileSnapshots(id, rootId, executor) {
    const profile = `JSON_SET(SNAPSHOT_COLUMN,
      '$.brand_id', product.brand_id, '$.brand_name', brand.name,
      '$.name', IF(product.template_id IS NULL, product.name, template.name),
      '$.category', COALESCE(category.name, IF(product.template_id IS NULL, product.category, template.category)),
      '$.product_model', IF(product.template_id IS NULL, product.product_model, template.product_model), '$.color_name', color.name,
      '$.unit', COALESCE(unit.name, IF(product.template_id IS NULL, product.unit, template.unit)))`
    const historyJoins = `JOIN accessories product ON product.id = ROW_ACCESSORY_ID
      LEFT JOIN accessories template ON template.id = product.template_id
      LEFT JOIN brands brand ON brand.id = product.brand_id
      LEFT JOIN accessory_categories category ON category.id = IF(product.template_id IS NULL, product.category_id, template.category_id)
      LEFT JOIN colors color ON color.id = IF(product.template_id IS NULL, product.color_id, template.color_id)
      LEFT JOIN accessory_units unit ON unit.id = IF(product.template_id IS NULL, product.unit_id, template.unit_id)`
    await executor.query(`UPDATE accessory_stock_in si ${historyJoins.replaceAll('ROW_ACCESSORY_ID', 'si.accessory_id')}
      SET si.updated_at = si.updated_at,
        si.product_snapshot = CASE WHEN si.product_snapshot IS NULL THEN NULL ELSE ${profile.replaceAll('SNAPSHOT_COLUMN', 'si.product_snapshot')} END
      WHERE product.id = ? OR product.template_id = ?`, [rootId, rootId])
    await executor.query(`UPDATE sales_order_items i
      LEFT JOIN accessory_sales s ON s.id = i.accessory_sale_id AND i.item_type = 'accessory'
      ${historyJoins.replaceAll('ROW_ACCESSORY_ID', 'COALESCE(i.accessory_id, s.accessory_id)')}
      SET i.snapshot = ${profile.replaceAll('SNAPSHOT_COLUMN', 'i.snapshot')}
      WHERE i.item_type = 'accessory' AND (product.id = ? OR product.template_id = ?) AND i.snapshot IS NOT NULL`, [rootId, rootId])
  }

  /** 根模板行锁串行化同一模板的品牌建档，唯一索引提供最终约束。 */
  async lockAccessory(id, executor) {
    const rows = await this.queryRows('SELECT * FROM accessories WHERE id = ? FOR UPDATE', [id], executor)
    return rows[0] || null
  }

  async createSerial(data, executor) {
    const [result] = await executor.query(`INSERT INTO accessory_serials
      (accessory_id, serial_number, store_id, stock_in_id, purchase_cost, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'in_stock', ?, ?)`,
    [data.accessory_id, data.serial_number, data.store_id, data.stock_in_id, data.purchase_cost, data.time, data.time])
    return result.insertId
  }

  async createSerialEvent(data, executor) {
    await executor.query(`INSERT INTO accessory_serial_events
      (serial_id, event_type, stock_in_id, sale_id, store_id, operator_id, operator_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [data.serial_id, data.event_type, data.stock_in_id || null,
      data.sale_id || null, data.store_id, data.operator_id, data.operator_name || null, data.time])
  }

  async lockSerials(serialNumbers, executor) {
    if (!serialNumbers.length) return []
    return this.queryRows(`SELECT * FROM accessory_serials WHERE serial_number IN
      (${serialNumbers.map(() => '?').join(',')}) ORDER BY serial_number FOR UPDATE`, serialNumbers, executor)
  }

  async markSerialOut(id, saleId, type, time, executor) {
    const [result] = await executor.query(`UPDATE accessory_serials SET status = ?, sale_id = ?, updated_at = ?
      WHERE id = ? AND status = 'in_stock'`, [type === 'gift' ? 'gifted' : 'sold', saleId, time, id])
    return result.affectedRows === 1
  }

  async saleForReturn(id, executor, forUpdate = false) {
    const rows = await this.queryRows(`SELECT * FROM accessory_sales WHERE id = ?${forUpdate ? ' FOR UPDATE' : ''}`, [id], executor)
    return rows[0] || null
  }

  async returnSerial(id, saleId, storeId, time, executor) {
    const [result] = await executor.query(`UPDATE accessory_serials SET status = 'in_stock', sale_id = NULL, store_id = ?, updated_at = ?
      WHERE id = ? AND sale_id = ? AND status IN ('sold', 'gifted')`, [storeId, time, id, saleId])
    return result.affectedRows === 1
  }

  async restoreSaleStock(accessoryId, storeId, quantity, minStock, executor) {
    // 退货增加可用量，不伪造采购入库或抹掉累计出库；退回数量从独立流水核对。
    const [result] = await executor.query(`INSERT INTO accessory_stock (accessory_id, store_id, quantity, total_in, total_out, min_stock)
      VALUES (?, ?, ?, 0, 0, ?) ON DUPLICATE KEY UPDATE quantity = quantity + ?, updated_at = NOW()`,
    [accessoryId, storeId, quantity, minStock, quantity])
    return result.affectedRows > 0
  }

  async lockStoreStock(accessoryId, storeId, executor) {
    const rows = await this.queryRows('SELECT * FROM accessory_stock WHERE accessory_id = ? AND store_id = ? FOR UPDATE', [accessoryId, storeId], executor)
    return rows[0] || null
  }

  /** 调用方先持有根模板锁及门店库存锁，避免SN数量被并发入库/出库改变。 */
  async countStockSerials(accessoryId, storeId, executor) {
    const rows = await this.queryRows("SELECT id FROM accessory_serials WHERE accessory_id = ? AND store_id = ? AND status = 'in_stock' ORDER BY id FOR UPDATE", [accessoryId, storeId], executor)
    return rows.length
  }

  async deductStock(accessoryId, storeId, quantity, executor) {
    const [result] = await executor.query(`UPDATE accessory_stock SET quantity = quantity - ?, total_out = total_out + ?, updated_at = NOW()
      WHERE accessory_id = ? AND store_id = ? AND quantity >= ?`, [quantity, quantity, accessoryId, storeId, quantity])
    return result.affectedRows === 1
  }

  async getSerials({ accessoryId, scope, search, page, pageSize, stockOnly = false }) {
    const conditions = ['(sn.accessory_id = ? OR a.template_id = ?)']
    const params = [accessoryId, accessoryId]
    appendStoreScopeCondition(scope, 'sn.store_id', conditions, params)
    if (stockOnly) conditions.push("sn.status = 'in_stock'")
    if (search) { conditions.push('sn.serial_number LIKE ?'); params.push(`%${search}%`) }
    const joins = `FROM accessory_serials sn JOIN accessories a ON a.id = sn.accessory_id
      LEFT JOIN accessory_stock_in si ON si.id = sn.stock_in_id
      LEFT JOIN suppliers supplier ON supplier.id = si.supplier_id
      LEFT JOIN stores store ON store.id = sn.store_id
      LEFT JOIN accessory_sales sale ON sale.id = sn.sale_id`
    const where = `WHERE ${conditions.join(' AND ')}`
    const [[count]] = await this.getConnection().query(`SELECT COUNT(*) AS total ${joins} ${where}`, params)
    const rows = await this.queryRows(`SELECT sn.id, sn.accessory_id, sn.serial_number, sn.status, sn.store_id,
      store.name AS store_name, sn.purchase_cost, si.batch_no, si.supplier_id, ${purchaseSnapshotText('supplier_name', 'supplier.name')} AS supplier_name,
      si.operator_name AS inventory_operator_name, sn.created_at AS inventory_time,
      sale.sale_no, sale.sale_type, sale.customer_name, sale.customer_phone, sale.operator_name,
      sale.sale_time, sale.unit_price, sale.remarks ${joins} ${where}
      ORDER BY sn.id DESC LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize])
    return { data: rows, pagination: { page, page_size: pageSize, total: Number(count.total) } }
  }

  async getTransferByKey(key, executor) {
    const rows = await this.queryRows('SELECT * FROM accessory_transfers WHERE request_key = ? FOR UPDATE', [key], executor)
    return rows[0] || null
  }

  async createTransfer(data, executor) {
    const [result] = await executor.query(`INSERT INTO accessory_transfers
      (request_key, request_hash, accessory_id, from_store_id, to_store_id, quantity, serial_numbers, operator_id, operator_name, remarks, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [data.request_key, data.request_hash, data.accessory_id, data.from_store_id,
      data.to_store_id, data.quantity, JSON.stringify(data.serial_numbers), data.operator_id, data.operator_name, data.remarks || null, data.time])
    return result.insertId
  }

  /** 店间移动仅改变位置和现存量，不增加采购入库或销售计数。 */
  async moveInventory(data, executor) {
    const [source] = await executor.query(`UPDATE accessory_stock SET quantity = quantity - ?, updated_at = NOW()
      WHERE accessory_id = ? AND store_id = ? AND quantity >= ?`, [data.quantity, data.accessory_id, data.from_store_id, data.quantity])
    if (source.affectedRows !== 1) return false
    await executor.query(`INSERT INTO accessory_stock (accessory_id, store_id, quantity, total_in, total_out, min_stock)
      VALUES (?, ?, ?, 0, 0, ?) ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), updated_at = NOW()`,
    [data.accessory_id, data.to_store_id, data.quantity, data.min_stock])
    return true
  }

  async moveSerial(id, fromStore, toStore, time, executor) {
    const [result] = await executor.query(`UPDATE accessory_serials SET store_id = ?, updated_at = ?
      WHERE id = ? AND store_id = ? AND status = 'in_stock'`, [toStore, time, id, fromStore])
    return result.affectedRows === 1
  }

  async getTransfers(accessoryId, scope, page, pageSize) {
    const conditions = ['(a.id = ? OR a.template_id = ?)']
    const params = [accessoryId, accessoryId]
    appendStoreScopeCondition(scope, 'tr.from_store_id', conditions, params)
    appendStoreScopeCondition(scope, 'tr.to_store_id', conditions, params)
    const from = `FROM accessory_transfers tr JOIN accessories a ON a.id = tr.accessory_id
      LEFT JOIN stores src ON src.id = tr.from_store_id LEFT JOIN stores dest ON dest.id = tr.to_store_id
      WHERE ${conditions.join(' AND ')}`
    const [[count]] = await this.getConnection().query(`SELECT COUNT(*) AS total ${from}`, params)
    const rows = await this.queryRows(`SELECT tr.id, tr.accessory_id, tr.from_store_id, tr.to_store_id,
      src.name AS from_store_name, dest.name AS to_store_name, tr.quantity, tr.serial_numbers,
      tr.operator_name, tr.created_at, tr.remarks ${from} ORDER BY tr.id DESC LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize])
    return { data: rows, pagination: { page, page_size: pageSize, total: Number(count.total) } }
  }

  async getInventoryLocations(accessoryId, scope, includeVariants = true) {
    const conditions = [includeVariants ? '(a.id = ? OR a.template_id = ?)' : 'a.id = ?']
    const params = includeVariants ? [accessoryId, accessoryId] : [accessoryId]
    appendStoreScopeCondition(scope, 'st.store_id', conditions, params)
    return this.queryRows(`SELECT st.store_id, store.name AS store_name, SUM(st.quantity) AS quantity,
      SUM(COALESCE(sn.quantity, 0)) AS serial_quantity,
      SUM(st.quantity - COALESCE(sn.quantity, 0)) AS plain_quantity
      FROM accessory_stock st JOIN accessories a ON a.id = st.accessory_id
      LEFT JOIN (SELECT accessory_id, store_id, COUNT(*) AS quantity FROM accessory_serials
        WHERE status = 'in_stock' GROUP BY accessory_id, store_id) sn ON sn.accessory_id = st.accessory_id AND sn.store_id = st.store_id
      LEFT JOIN stores store ON store.id = st.store_id
      WHERE ${conditions.join(' AND ')} GROUP BY st.store_id, store.name ORDER BY st.store_id`, params)
  }

  async getSerialTrace(serialNumber, scope) {
    const conditions = ['sn.serial_number = ?']
    const params = [serialNumber]
    appendStoreScopeCondition(scope, 'sn.store_id', conditions, params)
    const rows = await this.queryRows(`SELECT sn.id, sn.serial_number, sn.accessory_id, sn.status
      FROM accessory_serials sn WHERE ${conditions.join(' AND ')}`, params)
    if (!rows.length) return null
    const events = await this.queryRows(`SELECT e.event_type, e.store_id, s.name AS store_name,
      e.operator_id, e.operator_name, e.created_at, si.batch_no, si.supplier_id,
      ${purchaseSnapshotText('supplier_name', 'supplier.name')} AS supplier_name, sale.sale_no, sale.sale_type, sale.customer_name,
      sale.customer_phone, sale.unit_price, sale.sale_time, sale.remarks
      FROM accessory_serial_events e LEFT JOIN stores s ON s.id = e.store_id
      LEFT JOIN accessory_stock_in si ON si.id = e.stock_in_id
      LEFT JOIN suppliers supplier ON supplier.id = si.supplier_id
      LEFT JOIN accessory_sales sale ON sale.id = e.sale_id
      WHERE e.serial_id = ? ORDER BY e.id`, [rows[0].id])
    const transferConditions = ['tr.accessory_id = ?', 'JSON_CONTAINS(tr.serial_numbers, JSON_QUOTE(?))']
    const transferParams = [rows[0].accessory_id, serialNumber]
    appendStoreScopeCondition(scope, 'tr.from_store_id', transferConditions, transferParams)
    appendStoreScopeCondition(scope, 'tr.to_store_id', transferConditions, transferParams)
    const transfers = await this.queryRows(`SELECT 'transfer' AS event_type, tr.id AS transfer_id,
      tr.from_store_id, tr.to_store_id, src.name AS from_store_name, dest.name AS to_store_name,
      tr.operator_id, tr.operator_name, tr.created_at, tr.remarks
      FROM accessory_transfers tr LEFT JOIN stores src ON src.id = tr.from_store_id
      LEFT JOIN stores dest ON dest.id = tr.to_store_id WHERE ${transferConditions.join(' AND ')} ORDER BY tr.id`, transferParams)
    return { ...rows[0], events, transfers }
  }

  async getBrandVariant(templateId, brandId, executor) {
    const rows = await this.queryRows('SELECT id, brand_id, status FROM accessories WHERE template_id = ? AND brand_id <=> ? FOR UPDATE',
      [templateId, brandId], executor)
    return rows[0] || null
  }

  /** 根模板与来源商品已锁定。目标是空子档案时，保留待更正商品的采购身份。 */
  async resolveBrandProfileTarget(source, root, brandId, connection) {
    const sourceId = Number(source.id)
    if (brandId === undefined || Number(brandId || 0) === Number(source.brand_id || 0)) return sourceId

    const rootId = Number(root.id)
    const duplicate = Number(root.brand_id || 0) === Number(brandId || 0) ? root
      : await this.getBrandVariant(rootId, brandId, connection)
    if (!duplicate || Number(duplicate.id) === sourceId) return sourceId

    if (Number(duplicate.id) !== rootId && !await this.checkUnusedBrandVariant(duplicate.id, connection)) {
      await this.deleteBrandVariantRows(duplicate.id, rootId, connection)
      return sourceId
    }
    return this.mergeUnusedBrandVariant(sourceId, duplicate.id, rootId, connection)
  }

  async mergeUnusedBrandVariant(sourceId, targetId, templateId, executor) {
    const ids = [Number(sourceId), Number(targetId)].sort((left, right) => left - right)
    const [locked] = await executor.query(
      'SELECT id, template_id FROM accessories WHERE id IN (?, ?) ORDER BY id FOR UPDATE', ids
    )
    const source = locked.find(row => Number(row.id) === Number(sourceId))
    const target = locked.find(row => Number(row.id) === Number(targetId))
    const sourceIsTemplate = Number(source?.id) === Number(templateId) && source.template_id === null
    if (!source || !target || (!sourceIsTemplate && Number(source.template_id) !== Number(templateId)) ||
        Number(target.template_id || target.id) !== Number(templateId)) {
      throw Object.assign(new Error('品牌商品关系已变化，请刷新后重试'), { statusCode: 409, code: 'ACCESSORY_DELETE_STALE' })
    }

    const [stockRows] = await executor.query(
      'SELECT quantity, total_out FROM accessory_stock WHERE accessory_id = ? ORDER BY store_id FOR UPDATE', [sourceId]
    )
    if (stockRows.some(row => Number(row.quantity) !== 0 || Number(row.total_out) !== 0)) {
      throw Object.assign(new Error('该品牌商品仍有库存或销售出库数量，不能合并'), { statusCode: 409, code: 'ACCESSORY_DELETE_HAS_ACTIVITY' })
    }

    const requiredTables = ['accessories', 'accessory_stock', 'accessory_stock_in', 'accessory_sales', 'accessory_compatible_models']
    const optionalTables = ['accessory_transfers', 'accessory_serials', 'accessory_serial_events', 'accessory_inventory_events', 'accessory_inventory_adjustments', 'sales_order_items']
    const tableNames = [...requiredTables, ...optionalTables]
    const [tables] = await executor.query(`SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${tableNames.map(() => '?').join(', ')})`, tableNames)
    const availableTables = new Set(tables.map(row => row.TABLE_NAME))
    if (requiredTables.some(table => !availableTables.has(table))) {
      throw Object.assign(new Error('品牌商品关联检查所需的数据结构未就绪，暂不能合并'), { statusCode: 409, code: 'ACCESSORY_DELETE_NOT_READY' })
    }

    const references = [
      ['销售记录', 'accessory_sales', 'SELECT id FROM accessory_sales WHERE accessory_id = ? LIMIT 1 FOR UPDATE'],
      ['划拨记录', 'accessory_transfers', 'SELECT id FROM accessory_transfers WHERE accessory_id = ? LIMIT 1 FOR UPDATE'],
      ['SN商品记录', 'accessory_serials', 'SELECT id FROM accessory_serials WHERE accessory_id = ? LIMIT 1 FOR UPDATE'],
      ['SN历史记录', 'accessory_serial_events', `SELECT event.id FROM accessory_serial_events event
        JOIN accessory_serials serial ON serial.id = event.serial_id WHERE serial.accessory_id = ? LIMIT 1 FOR UPDATE`],
      ['库存盘点', 'accessory_inventory_adjustments', 'SELECT id FROM accessory_inventory_adjustments WHERE accessory_id = ? LIMIT 1 FOR UPDATE'],
      ['共同销售订单', 'sales_order_items', 'SELECT id FROM sales_order_items WHERE item_type = \'accessory\' AND accessory_id = ? LIMIT 1 FOR UPDATE']
    ]
    for (const [label, table, sql] of references) {
      if (!availableTables.has(table) || table === 'accessory_serial_events' && !availableTables.has('accessory_serials')) continue
      const [found] = await executor.query(sql, [sourceId])
      if (found.length) {
        throw Object.assign(new Error(`该品牌商品关联了${label}，不能合并`), { statusCode: 409, code: 'ACCESSORY_DELETE_HAS_ACTIVITY' })
      }
    }

    await executor.query(`INSERT INTO accessory_stock (accessory_id, store_id, quantity, total_in, total_out, min_stock)
      SELECT ?, source_stock.store_id, 0, source_stock.total_in, 0, source_stock.min_stock
      FROM accessory_stock AS source_stock WHERE source_stock.accessory_id = ?
      ON DUPLICATE KEY UPDATE total_in = accessory_stock.total_in + source_stock.total_in, updated_at = NOW()`, [targetId, sourceId])
    await executor.query(`UPDATE accessory_stock_in SET accessory_id = ?,
      product_snapshot = JSON_SET(product_snapshot, '$.accessory_id', CAST(? AS UNSIGNED)), updated_at = updated_at
      WHERE accessory_id = ?`, [targetId, targetId, sourceId])
    if (availableTables.has('accessory_inventory_events')) {
      await executor.query('UPDATE accessory_inventory_events SET accessory_id = ? WHERE accessory_id = ?', [targetId, sourceId])
    }
    if (sourceIsTemplate) {
      await executor.query('DELETE FROM accessory_stock WHERE accessory_id = ?', [sourceId])
      await executor.query('UPDATE accessories SET brand_id = NULL, updated_at = NOW() WHERE id = ? AND template_id IS NULL', [sourceId])
    } else {
      await executor.query(`INSERT IGNORE INTO accessory_compatible_models (accessory_id, model_id)
        SELECT ?, model_id FROM accessory_compatible_models WHERE accessory_id = ?`, [targetId, sourceId])
      await this.deleteBrandVariantRows(sourceId, templateId, executor)
    }
    return Number(targetId)
  }

  /**
   * 更新配件
   */
  async updateAccessory(id, data, executor) {
    try {
      const fields = []
      const params = []

      const allowedFields = [
        'name', 'barcode', 'category', 'category_id', 'product_model', 'brand_id', 'model_id', 'color_id',
        'supplier_id', 'purchase_cost', 'sale_price',
        'unit', 'unit_id', 'status', 'description', 'remarks', 'image_url', 'serial_tracking', 'min_stock', 'free_film'
      ]
      allowedFields.forEach(field => {
        if (data[field] !== undefined) {
          fields.push(`${field} = ?`)
          params.push(data[field])
        }
      })

      if (fields.length === 0 && data.model_ids === undefined) {
        return false
      }

      if (fields.length === 0) return true

      params.push(id)

      const query = `
        UPDATE accessories
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = ?
      `

      const [result] = await (executor || this.getConnection()).query(query, params)
      return result.affectedRows > 0
    } catch (error) {
      log.error('更新配件失败:', error)
      throw error
    }
  }

  async replaceCompatibleModels(accessoryId, modelIds, executor) {
    const connection = executor || this.getConnection()
    await connection.query('DELETE FROM accessory_compatible_models WHERE accessory_id = ?', [accessoryId])
    if (!modelIds.length) return
    const values = modelIds.map(() => '(?, ?)').join(', ')
    const params = modelIds.flatMap(modelId => [accessoryId, modelId])
    await connection.query(`INSERT INTO accessory_compatible_models (accessory_id, model_id) VALUES ${values}`, params)
  }

  async getCompatibleModelIds(accessoryId, executor, { forUpdate = false } = {}) {
    const rows = await this.queryRows(
      `SELECT model_id FROM accessory_compatible_models WHERE accessory_id = ? ORDER BY model_id${forUpdate ? ' FOR UPDATE' : ''}`,
      [accessoryId], executor
    )
    return rows.map(row => Number(row.model_id))
  }

  /**
   * 删除配件（软删除）
   */
  async deleteAccessory(id) {
    try {
      const query = 'UPDATE accessories SET status = 0, updated_at = NOW() WHERE id = ?'
      const [result] = await this.executePrepared(query, [id])
      return result.affectedRows > 0
    } catch (error) {
      log.error('删除配件失败:', error)
      throw error
    }
  }

  /** 调用方先锁根模板及商品，关联校验使用当前读。 */
  async checkUnusedBrandVariant(id, connection) {
    const requiredTables = ['accessories', 'accessory_stock', 'accessory_stock_in', 'accessory_sales', 'accessory_compatible_models']
    const optionalTables = [
      'accessory_transfers', 'accessory_serials', 'accessory_serial_events', 'accessory_inventory_events',
      'accessory_purchase_payments', 'accessory_stock_corrections', 'accessory_inventory_adjustments', 'sales_order_items'
    ]
    const [tables] = await connection.query(`SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${[...requiredTables, ...optionalTables].map(() => '?').join(', ')})`, [...requiredTables, ...optionalTables])
    const availableTables = new Set(tables.map(row => row.TABLE_NAME))
    if (requiredTables.some(table => !availableTables.has(table))) {
      throw Object.assign(new Error('商品关联检查所需的数据结构未就绪，暂不能删除'), { statusCode: 409, code: 'ACCESSORY_DELETE_NOT_READY' })
    }

    const [stockRows] = await connection.query(`SELECT quantity, total_out FROM accessory_stock
      WHERE accessory_id = ? ORDER BY store_id FOR UPDATE`, [id])
    if (stockRows.some(row => Number(row.quantity) !== 0 || Number(row.total_out) !== 0)) {
      return { message: '该品牌商品仍有库存或销售出库数量，不能删除', code: 'ACCESSORY_DELETE_HAS_ACTIVITY' }
    }

    const references = [
      ['采购入库', 'accessory_stock_in', 'SELECT id FROM accessory_stock_in WHERE accessory_id = ? LIMIT 1 FOR UPDATE'],
      ['销售订单', 'accessory_sales', 'SELECT id FROM accessory_sales WHERE accessory_id = ? LIMIT 1 FOR UPDATE'],
      ['库存划拨', 'accessory_transfers', 'SELECT id FROM accessory_transfers WHERE accessory_id = ? LIMIT 1 FOR UPDATE'],
      ['SN商品记录', 'accessory_serials', 'SELECT id FROM accessory_serials WHERE accessory_id = ? LIMIT 1 FOR UPDATE'],
      ['SN历史记录', 'accessory_serial_events', `SELECT event.id FROM accessory_serial_events event
        JOIN accessory_serials serial ON serial.id = event.serial_id WHERE serial.accessory_id = ? LIMIT 1 FOR UPDATE`],
      ['库存流水', 'accessory_inventory_events', 'SELECT id FROM accessory_inventory_events WHERE accessory_id = ? LIMIT 1 FOR UPDATE'],
      ['采购付款', 'accessory_purchase_payments', `SELECT payment.id FROM accessory_purchase_payments payment
        JOIN accessory_stock_in purchase ON purchase.id = payment.stock_in_id WHERE purchase.accessory_id = ? LIMIT 1 FOR UPDATE`],
      ['采购更正', 'accessory_stock_corrections', `SELECT correction.id FROM accessory_stock_corrections correction
        JOIN accessory_stock_in purchase ON purchase.id IN (correction.source_stock_in_id, correction.target_stock_in_id)
        WHERE purchase.accessory_id = ? LIMIT 1 FOR UPDATE`],
      ['库存盘点', 'accessory_inventory_adjustments', 'SELECT id FROM accessory_inventory_adjustments WHERE accessory_id = ? LIMIT 1 FOR UPDATE'],
      ['共同销售订单', 'sales_order_items', 'SELECT id FROM sales_order_items WHERE item_type = \'accessory\' AND accessory_id = ? LIMIT 1 FOR UPDATE']
    ]
    for (const [label, table, sql] of references) {
      if (table === 'accessory_serial_events' && !availableTables.has('accessory_serials')) continue
      if (!availableTables.has(table)) continue
      const [found] = await connection.query(sql, [id])
      if (found.length) {
        return { message: `该商品关联了${label}记录，保留商品档案以维护历史`, code: 'ACCESSORY_DELETE_HAS_HISTORY' }
      }
    }

    return null
  }

  async deleteBrandVariantRows(id, templateId, connection) {
    await connection.query('DELETE FROM accessory_compatible_models WHERE accessory_id = ?', [id])
    await connection.query('DELETE FROM accessory_stock WHERE accessory_id = ?', [id])
    const [result] = await connection.query('DELETE FROM accessories WHERE id = ? AND template_id = ?', [id, templateId])
    if (result.affectedRows !== 1) {
      throw Object.assign(new Error('商品资料已变化，请刷新后重试'), { statusCode: 409, code: 'ACCESSORY_DELETE_STALE' })
    }
  }

  async deleteUnusedBrandVariant(id) {
    return this.withConnection(async connection => {
      await connection.beginTransaction()
      try {
        const [rows] = await connection.query('SELECT id, template_id FROM accessories WHERE id = ?', [id])
        const accessory = rows[0]
        if (!accessory) throw Object.assign(new Error('商品不存在或已删除'), { statusCode: 404, code: 'NOT_FOUND' })
        if (!accessory.template_id) {
          throw Object.assign(new Error('商品模板不能从库存行删除，请在商品模板中停用'), { statusCode: 409, code: 'ACCESSORY_TEMPLATE_DELETE_BLOCKED' })
        }
        if (!await this.lockAccessory(accessory.template_id, connection)) {
          throw Object.assign(new Error('商品模板不存在，请刷新后重试'), { statusCode: 409, code: 'ACCESSORY_DELETE_STALE' })
        }

        const locked = await this.lockAccessory(id, connection)
        if (!locked || Number(locked.template_id) !== Number(accessory.template_id)) {
          throw Object.assign(new Error('商品资料已变化，请刷新后重试'), { statusCode: 409, code: 'ACCESSORY_DELETE_STALE' })
        }
        const blocked = await this.checkUnusedBrandVariant(id, connection)
        if (blocked) throw Object.assign(new Error(blocked.message), { statusCode: 409, code: blocked.code })
        await this.deleteBrandVariantRows(id, accessory.template_id, connection)
        await connection.commit()
        return true
      } catch (error) {
        await connection.rollback()
        throw error
      }
    })
  }

  /**
   * 获取配件库存（按门店）
   */
  async getAccessoryStock(accessoryId, executor, scope) {
    try {
      const conditions = ['ast.accessory_id = ?'], params = [accessoryId]
      appendStoreScopeCondition(scope, 'ast.store_id', conditions, params)
      const query = `
        SELECT
          ast.id,
          ast.accessory_id,
          ast.store_id,
          s.name as store_name,
          ast.quantity,
          COALESCE(t.min_stock, a.min_stock, ast.min_stock) AS min_stock,
          ast.max_stock,
          ast.total_in,
          ast.total_out,
          CASE
            WHEN ast.quantity = 0 THEN 'out_of_stock'
            WHEN ast.quantity <= COALESCE(t.min_stock, a.min_stock, ast.min_stock) THEN 'low_stock'
            ELSE 'in_stock'
          END as stock_status
        FROM accessory_stock ast
        JOIN accessories a ON a.id = ast.accessory_id
        LEFT JOIN accessories t ON t.id = a.template_id
        LEFT JOIN stores s ON ast.store_id = s.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY ast.store_id
      `

      const stock = await this.queryRows(query, params, executor)

      // 计算总库存
      const totalStock = stock.reduce((sum, s) => sum + Number(s.quantity || 0), 0)

      return {
        accessory_id: accessoryId,
        total_stock: totalStock,
        stores: stock
      }
    } catch (error) {
      log.error('获取配件库存失败:', error)
      throw error
    }
  }

  /**
   * 获取所有配件库存列表
   */
  async getAllAccessoryStock(options = {}, executor) {
    try {
      const {
        low_stock_only = false,
        page = 1,
        page_size = 50
      } = options

      const normalized_page_size = Number(page_size) || 50
      const offset = (page - 1) * normalized_page_size
      const conditions = []
      const params = []

      appendStoreScopeCondition(options.store_scope, 'ast.store_id', conditions, params)

      if (low_stock_only) {
        conditions.push('ast.quantity <= COALESCE(t.min_stock, a.min_stock, ast.min_stock)')
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

      // 查询总数
      const countQuery = `
        SELECT COUNT(*) as total
        FROM accessory_stock ast
        JOIN accessories a ON a.id = ast.accessory_id
        LEFT JOIN accessories t ON t.id = a.template_id
        ${whereClause}
      `
      const countResult = await this.queryRows(countQuery, params, executor)
      const total = countResult && countResult.length > 0 ? countResult[0].total : 0

      // 查询列表
      const query = `
        SELECT
          ast.id,
          ast.accessory_id,
          ast.store_id,
          ast.quantity,
          COALESCE(t.min_stock, a.min_stock, ast.min_stock) AS min_stock,
          ast.max_stock,
          ast.total_in,
          ast.total_out,
          ast.created_at,
          ast.updated_at,
          ${templateField('name')} AS accessory_name,
          ${templateField('barcode')} AS barcode,
          COALESCE(ac.name, ${templateField('category')}) AS category,
          a.template_id, a.brand_id, b.name AS brand_name,
          s.name as store_name,
          CASE
            WHEN ast.quantity = 0 THEN 'out_of_stock'
            WHEN ast.quantity <= COALESCE(t.min_stock, a.min_stock, ast.min_stock) THEN 'low_stock'
            ELSE 'in_stock'
          END as stock_status
        FROM accessory_stock ast
        JOIN accessories a ON ast.accessory_id = a.id
        LEFT JOIN accessories t ON t.id = a.template_id
        LEFT JOIN accessory_categories ac ON ac.id = ${templateField('category_id')}
        LEFT JOIN brands b ON b.id = a.brand_id
        LEFT JOIN stores s ON ast.store_id = s.id
        ${whereClause}
        ORDER BY ast.store_id, a.id
        LIMIT ? OFFSET ?
      `

      const stock = await this.queryRows(query, [...params, normalized_page_size, offset], executor)

      return {
        data: stock,
        pagination: {
          page: parseInt(page),
          page_size: normalized_page_size,
          total,
          total_pages: Math.ceil(total / normalized_page_size),
          has_next: page * normalized_page_size < total,
          has_prev: page > 1
        }
      }
    } catch (error) {
      log.error('获取配件库存列表失败:', error)
      throw error
    }
  }

  /**
   * 更新配件库存（用于入库/销售/调拨）
   * 支持设置最小库存值
   */
  async updateAccessoryStock(accessoryId, storeId, quantity, operation = 'add', minStock = 5, executor) {
    try {
      const operator = operation === 'add' ? '+' : '-'
      const totalInValue = operation === 'add' ? quantity : 0
      const totalOutValue = operation === 'subtract' ? quantity : 0

      const query = `
        INSERT INTO accessory_stock (accessory_id, store_id, quantity, total_in, total_out, min_stock)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          quantity = quantity ${operator} ?,
          total_in = total_in + ?,
          total_out = total_out + ?,
          updated_at = NOW()
      `

      // INSERT ... ON DUPLICATE KEY UPDATE 需要使用 db.query 来获取 affectedRows
      const db = executor || this.getConnection()
      const queryResult = await db.query(query, [
        accessoryId,
        storeId,
        quantity,           // INSERT 时的初始 quantity
        totalInValue,       // INSERT 时的初始 total_in
        totalOutValue,      // INSERT 时的初始 total_out
        minStock,           // INSERT 时的初始 min_stock
        quantity,           // UPDATE 时 quantity = quantity + quantity
        totalInValue,       // UPDATE 时 total_in = total_in + totalInValue
        totalOutValue       // UPDATE 时 total_out = total_out + totalOutValue
      ])

      // mysql2 pool.query 返回 [ResultSetHeader, fields]
      let result = queryResult
      if (Array.isArray(queryResult) && queryResult.length > 0) {
        result = queryResult[0]
      }

      return result.affectedRows > 0
    } catch (error) {
      log.error('更新配件库存失败:', error)
      throw error
    }
  }

  /** 防重字段与唯一键必须一同就绪；运行时不执行DDL或降级为非幂等入库。 */
  async stockInRequestsReady(executor) {
    const state = await this.getStockInRequestSchema(executor)
    return state.engine === 'InnoDB' && ['request_key', 'request_hash'].every((name, index) => {
      const field = state.fields.find(row => row.COLUMN_NAME === name)
      return field?.COLUMN_TYPE.toLowerCase() === `char(${index ? 64 : 32})` &&
        field.IS_NULLABLE === 'YES' && field.COLLATION_NAME === 'ascii_bin'
    }) && state.indexes.filter(row => row.INDEX_NAME === 'uq_accessory_stock_in_request').length === 1 &&
      state.indexes.some(row => row.INDEX_NAME === 'uq_accessory_stock_in_request' && row.COLUMN_NAME === 'request_key' &&
        Number(row.NON_UNIQUE) === 0 && Number(row.SEQ_IN_INDEX) === 1 && row.SUB_PART === null)
  }

  async stockInReady(executor) {
    if (!await this.stockInRequestsReady(executor)) return false
    const [rows] = await executor.query("SELECT COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessory_stock_in' AND COLUMN_NAME = 'product_snapshot'")
    return rows.length === 1 && rows[0].COLUMN_TYPE.toLowerCase() === 'json' && rows[0].IS_NULLABLE === 'YES'
  }

  /** 模板锁内当前锁定读最终资料，避免等待模板锁前建立的RR旧快照；供应商取本次采购。 */
  async purchaseSnapshotSource(accessoryId, supplierId, storeId, executor) {
    const [rows] = await executor.query(`SELECT a.id AS accessory_id, s.id AS supplier_id, st.id AS store_id,
      COALESCE(t.name, a.name) AS name, b.name AS brand_name, ${templateField('product_model')} AS product_model,
      c.name AS color_name, COALESCE(category.name, t.category, a.category) AS category,
      COALESCE(unit.name, t.unit, a.unit) AS unit, s.name AS supplier_name, st.name AS store_name
      FROM accessories a LEFT JOIN accessories t ON t.id = a.template_id
      LEFT JOIN brands b ON b.id = a.brand_id
      LEFT JOIN colors c ON c.id = IF(a.template_id IS NULL, a.color_id, t.color_id)
      LEFT JOIN accessory_categories category ON category.id = IF(a.template_id IS NULL, a.category_id, t.category_id)
      LEFT JOIN accessory_units unit ON unit.id = IF(a.template_id IS NULL, a.unit_id, t.unit_id)
      JOIN suppliers s ON s.id = ? JOIN stores st ON st.id = ? WHERE a.id = ?
      LOCK IN SHARE MODE`, [supplierId, storeId, accessoryId])
    return rows[0] || null
  }

  async getStockInRequestSchema(executor) {
    const [tables] = await executor.query("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessory_stock_in'")
    const [fields] = await executor.query("SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessory_stock_in'")
    const [indexes] = await executor.query("SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX, SUB_PART FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessory_stock_in' ORDER BY INDEX_NAME, SEQ_IN_INDEX")
    return { engine: tables[0]?.ENGINE, fields, indexes }
  }

  async getStockInByKey(key, executor) {
    const [rows] = await executor.query(`SELECT id, batch_no, accessory_id, supplier_id, store_id, quantity, purchase_cost, total_amount,
      DATE_FORMAT(inventory_time, '%Y-%m-%d %H:%i:%s') AS inventory_time,
      distribution, operator_id, status, request_hash FROM accessory_stock_in WHERE request_key = ?`, [key])
    const row = rows[0]
    if (row?.status === 'cancelled') {
      row.corrected = false
      const [tables] = await executor.query("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessory_stock_corrections'")
      if (tables.length) {
        const [corrections] = await executor.query('SELECT id FROM accessory_stock_corrections WHERE source_stock_in_id = ? LIMIT 1', [row.id])
        row.corrected = corrections.length === 1
      }
    }
    return row || null
  }

  /** 创建原采购与请求凭据，跟随外层库存事务一起提交。 */
  async createStockInRecord(data, executor) {
    try {
      const query = `
        INSERT INTO accessory_stock_in (
          batch_no, accessory_id, supplier_id, store_id,
          quantity, purchase_cost, total_amount,
          barcode_scanned, distribution, remarks,
          operator_id, operator_name, inventory_time, status, request_key, request_hash, product_snapshot
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `

      const params = [
        data.batch_no,
        data.accessory_id,
        data.supplier_id,
        data.store_id,
        data.quantity,
        data.purchase_cost,
        data.total_amount,
        data.barcode_scanned || null,
        data.distribution || null,
        data.remarks || null,
        data.operator_id,
        data.operator_name,
        data.inventory_time,
        data.status || 'completed',
        data.request_key,
        data.request_hash,
        JSON.stringify(data.product_snapshot)
      ]

      const [result] = await (executor || this.getConnection()).query(query, params)
      return result.insertId
    } catch (error) {
      log.error('创建入库记录失败:', error)
      throw error
    }
  }

  /**
   * 获取入库记录列表
   */
  async getStockInRecords(options = {}) {
    try {
      const {
        accessory_id,
        supplier_id,
        store_id,
        start_date,
        end_date,
        page = 1,
        page_size = 50
      } = options

      const normalized_page_size = Number(page_size) || 50
      const offset = (page - 1) * normalized_page_size
      const conditions = []
      const params = []
      appendPurchaseStoreScope(options.store_scope, 'asi', conditions, params)

      if (accessory_id) {
        conditions.push('asi.accessory_id = ?')
        params.push(accessory_id)
      }

      if (supplier_id) {
        conditions.push('asi.supplier_id = ?')
        params.push(supplier_id)
      }

      if (store_id) {
        conditions.push('asi.store_id = ?')
        params.push(store_id)
      }

      if (start_date) {
        conditions.push('asi.inventory_time >= ?')
        params.push(start_date)
      }

      if (end_date) {
        conditions.push('asi.inventory_time <= ?')
        params.push(end_date)
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

      // 查询总数
      const countQuery = `
        SELECT COUNT(*) as total
        FROM accessory_stock_in asi
        ${whereClause}
      `
      const countResult = await this.executeQuery(countQuery, params)
      const total = countResult && countResult.length > 0 ? countResult[0].total : 0

      // 查询列表
      const query = `
        SELECT
          asi.id,
          asi.batch_no,
          asi.accessory_id,
          asi.supplier_id,
          asi.store_id,
          asi.quantity,
          asi.purchase_cost,
          asi.total_amount,
          asi.barcode_scanned,
          asi.distribution,
          asi.remarks,
          asi.operator_id,
          asi.operator_name,
          asi.inventory_time,
          asi.status,
          asi.created_at,
          asi.updated_at,
          asi.product_snapshot,
          ${templateField('name')} AS name,
          ${templateField('barcode')} AS barcode,
          a.template_id, a.brand_id, b.name AS brand_name, ${templateField('product_model')} AS product_model,
          s.name as supplier_name,
          st.name as store_name
        FROM accessory_stock_in asi
        LEFT JOIN accessories a ON asi.accessory_id = a.id
        LEFT JOIN accessories t ON t.id = a.template_id
        LEFT JOIN brands b ON b.id = a.brand_id
        LEFT JOIN suppliers s ON asi.supplier_id = s.id
        LEFT JOIN stores st ON asi.store_id = st.id
        ${whereClause}
        ORDER BY asi.inventory_time DESC, asi.id DESC
        LIMIT ? OFFSET ?
      `

      const records = await this.executeQuery(query, [...params, normalized_page_size, offset])

      return {
        data: records,
        pagination: {
          page: parseInt(page),
          page_size: normalized_page_size,
          total,
          total_pages: Math.ceil(total / normalized_page_size),
          has_next: page * normalized_page_size < total,
          has_prev: page > 1
        }
      }
    } catch (error) {
      log.error('获取入库记录失败:', error)
      throw error
    }
  }

  /**
   * 创建配件销售记录
   */
  async createSalesRecord(data, executor) {
    try {
      const query = `
        INSERT INTO accessory_sales (
          sale_no, accessory_id, store_id,
          customer_id, customer_name, customer_phone,
          quantity, unit_price, total_price,
          purchase_cost, profit, remarks,
          operator_id, operator_name, sale_time, sale_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `

      const params = [
        data.sale_no,
        data.accessory_id,
        data.store_id,
        data.customer_id || null,
        data.customer_name || null,
        data.customer_phone || null,
        data.quantity,
        data.unit_price,
        data.total_price,
        data.purchase_cost ?? null,
        data.profit ?? null,
        data.remarks || null,
        data.operator_id,
        data.operator_name,
        data.sale_time,
        data.sale_type || 'sale'
      ]

      // INSERT 语句需要直接使用 db.query 来获取 insertId
      const db = executor || this.getConnection()
      const queryResult = await db.query(query, params)

      // mysql2 pool.query 返回 [ResultSetHeader, fields]
      let result = queryResult
      if (Array.isArray(queryResult) && queryResult.length > 0) {
        result = queryResult[0]
      }

      return result.insertId
    } catch (error) {
      log.error('创建销售记录失败:', error)
      throw error
    }
  }

  /**
   * 获取配件分类统计
   */
  async getCategoryStats(scope) {
    try {
      const conditions = [`${ACCESSORY_STATUS} = 1`, `COALESCE(ac.name, ${templateField('category')}) IS NOT NULL`], params = []
      appendStoreScopeCondition(scope, 'ast.store_id', conditions, params)
      const query = `
        SELECT
          COALESCE(ac.name, ${templateField('category')}) AS category,
          COALESCE(SUM(ast.quantity), 0) AS count,
          COALESCE(SUM(ast.quantity * COALESCE(${templateField('sale_price')}, 0)), 0) AS total_value
        FROM accessory_stock ast
        JOIN accessories a ON a.id = ast.accessory_id
        LEFT JOIN accessories t ON t.id = a.template_id
        LEFT JOIN accessory_categories ac ON ac.id = ${templateField('category_id')}
        WHERE ${conditions.join(' AND ')}
        GROUP BY COALESCE(ac.name, ${templateField('category')})
        ORDER BY count DESC, category ASC
      `

      const stats = await this.executeQuery(query, params)
      return stats
    } catch (error) {
      log.error('获取分类统计失败:', error)
      throw error
    }
  }

  /**
   * 获取库存预警列表
   */
  async getLowStockAccessories(threshold = null, scope) {
    const conditions = [`${ACCESSORY_STATUS} = 1`], params = []
    appendStoreScopeCondition(scope, 'ast.store_id', conditions, params)
    if (threshold !== null) params.push(threshold)
    const query = `SELECT a.id, a.template_id, a.brand_id, b.name AS brand_name,
        ${templateField('name')} AS name, ${templateField('barcode')} AS barcode,
        COALESCE(ac.name, ${templateField('category')}) AS category,
        COALESCE(SUM(ast.quantity), 0) AS total_quantity, MIN(COALESCE(t.min_stock, a.min_stock, ast.min_stock)) AS min_stock_threshold
      FROM accessories a
      LEFT JOIN accessories t ON t.id = a.template_id
      LEFT JOIN accessory_categories ac ON ac.id = ${templateField('category_id')}
      LEFT JOIN brands b ON b.id = a.brand_id
      INNER JOIN accessory_stock ast ON ast.accessory_id = a.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY a.id
      HAVING total_quantity <= ${threshold === null ? 'COALESCE(MIN(COALESCE(t.min_stock, a.min_stock, ast.min_stock)), 5)' : '?'}
      ORDER BY total_quantity ASC, a.id ASC`
    return this.executeQuery(query, params)
  }

}

module.exports = AccessoryRepository
