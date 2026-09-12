/**
 * H5首页推荐服务
 * 功能：管理首页推荐区域和商品
 */

const db = require('../config/database')

class HomeSectionService {
  normalizeCount(value, fallback = 0) {
    const normalized = Number(value)
    if (!Number.isFinite(normalized)) {
      return fallback
    }
    return Math.max(0, Math.floor(normalized))
  }

  /**
   * 获取所有启用的推荐区域及其商品
   */
  async getActiveSections() {
    const query = `
      SELECT
        s.id,
        s.section_key,
        s.section_name,
        s.section_type,
        s.icon,
        s.product_limit,
        s.sort_order
      FROM H5_home_sections s
      WHERE s.is_enabled = TRUE
      ORDER BY s.sort_order ASC
    `
    const [sections] = await db.getDatabase().query(query)

    // 为每个区域获取商品
    for (const section of sections) {
      section.products = await this.getSectionProducts(
        section.id,
        section.product_limit,
        section
      )
    }

    return sections
  }

  /**
   * 获取指定区域的商品
   * @param {number} sectionId - 推荐区域ID
   * @param {number} productLimit - 最大显示数量
   */
  async getSectionProducts(sectionId, productLimit = 10, section = null) {
    const normalizedProductLimit = this.normalizeCount(productLimit, 10)

    // 1. 获取已配置的推荐商品
    const query = `
      SELECT
        sp.sort_order,
        -- 全新机模板信息
        t.id as template_id,
        NULL as phone_id,
        t.brand_id,
        b.name as brand_name,
        t.model_id,
        m.name as model_name,
        t.color_id,
        c.name as color_name,
        t.template_name,
        COALESCE(
          (SELECT image_url FROM H5_newimages WHERE template_id = t.id AND is_primary = 1 LIMIT 1),
          (SELECT image_url FROM H5_newimages WHERE template_id = t.id AND image_type <> 'video' ORDER BY sort_order ASC, id ASC LIMIT 1)
        ) as main_image,
        (SELECT MIN(pl.retail_price)
         FROM price_list pl
         WHERE pl.brand_id = t.brand_id AND pl.model_id = t.model_id AND pl.color_id = t.color_id
           AND pl.retail_price IS NOT NULL AND pl.retail_price > 0
        ) as min_price,
        (SELECT COUNT(*) FROM phones p2
         LEFT JOIN H5_product h5_1 ON p2.id = h5_1.phone_id
         WHERE p2.brand_id = t.brand_id AND p2.model_id = t.model_id AND p2.color_id = t.color_id
           AND p2.is_new = 1 AND p2.status = 'in_stock'
           AND (h5_1.is_published = 1 OR h5_1.is_published IS NULL)) as stock_count,
        (SELECT p3.id FROM phones p3
         LEFT JOIN H5_product h5_2 ON p3.id = h5_2.phone_id
         WHERE p3.brand_id = t.brand_id AND p3.model_id = t.model_id AND p3.color_id = t.color_id
           AND p3.is_new = 1 AND p3.status = 'in_stock'
           AND (h5_2.is_published = 1 OR h5_2.is_published IS NULL)
         ORDER BY p3.id ASC LIMIT 1
        ) as first_phone_id,
        (SELECT mem.size
         FROM phones p4
         LEFT JOIN memories mem ON p4.memory_id = mem.id
         LEFT JOIN H5_product h5_3 ON p4.id = h5_3.phone_id
         WHERE p4.brand_id = t.brand_id AND p4.model_id = t.model_id AND p4.color_id = t.color_id
           AND p4.is_new = 1 AND p4.status = 'in_stock'
           AND (h5_3.is_published = 1 OR h5_3.is_published IS NULL)
         ORDER BY p4.id ASC LIMIT 1
        ) as memory_name,
        NULL as quality_grade,
        NULL as condition_grade,
        1 as is_new,
        'new' as product_type
      FROM H5_home_section_products sp
      INNER JOIN H5_newtemplates t ON sp.template_id = t.id
      LEFT JOIN brands b ON t.brand_id = b.id
      LEFT JOIN models m ON t.model_id = m.id
      LEFT JOIN colors c ON t.color_id = c.id
      WHERE sp.section_id = ? AND sp.template_id IS NOT NULL AND t.is_published = 1

      UNION ALL

      SELECT
        sp.sort_order,
        -- 二手机信息
        NULL as template_id,
        p.id as phone_id,
        p.brand_id,
        b.name as brand_name,
        p.model_id,
        m.name as model_name,
        p.color_id,
        c.name as color_name,
        NULL as template_name,
        COALESCE(
          (SELECT image_url FROM H5_images WHERE phone_id = p.id AND is_primary = 1 LIMIT 1),
          (SELECT image_url FROM H5_images WHERE phone_id = p.id ORDER BY sort_order ASC, id ASC LIMIT 1)
        ) as main_image,
        h5.sale_price as min_price,
        1 as stock_count,
        p.id as first_phone_id,
        mem.size as memory_name,
        p.quality_grade,
        h5.condition_grade,
        0 as is_new,
        'used' as product_type
      FROM H5_home_section_products sp
      INNER JOIN phones p ON sp.phone_id = p.id
      LEFT JOIN H5_product h5 ON p.id = h5.phone_id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      WHERE sp.section_id = ? AND sp.phone_id IS NOT NULL AND p.status = 'in_stock'
        AND (h5.is_published = 1 OR h5.is_published IS NULL)

      ORDER BY sort_order ASC, main_image DESC
    `

    const [products] = await db.getDatabase().query(query, [sectionId, sectionId])

    if (normalizedProductLimit === 0) return []

    // 靓机/二手机专区除了手动设置外，自动补充真实在库二手机。
    // 其他专区仍只展示后台明确配置的商品，避免商品跨专区串入。
    const sectionKey = String(section?.section_key || '').toLowerCase()
    const sectionName = String(section?.section_name || '')
    const isAutomaticUsedSection = (
      sectionKey.includes('quality') ||
      sectionKey.includes('liangji') ||
      sectionKey.includes('used') ||
      sectionName.includes('靓机') ||
      sectionName.includes('二手')
    )

    if (!isAutomaticUsedSection || products.length >= normalizedProductLimit) {
      return products.slice(0, normalizedProductLimit)
    }

    const remainingLimit = normalizedProductLimit - products.length
    const qualityCondition = (
      sectionKey.includes('quality') ||
      sectionKey.includes('liangji') ||
      sectionName.includes('靓机')
    )
      ? 'AND (h5.condition_grade = \'靓机\' OR p.quality_grade = \'A\')'
      : ''
    const autoQuery = `
      SELECT
        2147483647 as sort_order,
        NULL as template_id,
        p.id as phone_id,
        p.brand_id,
        b.name as brand_name,
        p.model_id,
        m.name as model_name,
        p.color_id,
        c.name as color_name,
        NULL as template_name,
        COALESCE(
          (SELECT image_url FROM H5_images WHERE phone_id = p.id AND is_primary = 1 LIMIT 1),
          (SELECT image_url FROM H5_images WHERE phone_id = p.id ORDER BY sort_order ASC, id ASC LIMIT 1)
        ) as main_image,
        COALESCE(h5.sale_price, p.sale_price) as min_price,
        1 as stock_count,
        p.id as first_phone_id,
        mem.size as memory_name,
        p.quality_grade,
        h5.condition_grade,
        0 as is_new,
        'used' as product_type
      FROM phones p
      LEFT JOIN H5_product h5 ON p.id = h5.phone_id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      WHERE p.status = 'in_stock'
        AND p.is_new = 0
        AND (h5.is_published = 1 OR h5.is_published IS NULL)
        ${qualityCondition}
        AND NOT EXISTS (
          SELECT 1 FROM H5_home_section_products configured
          WHERE configured.section_id = ? AND configured.phone_id = p.id
        )
      ORDER BY p.inventory_time DESC, p.id DESC
      LIMIT ?
    `
    const [automaticProducts] = await db.getDatabase().query(
      autoQuery,
      [sectionId, remainingLimit]
    )

    return products.concat(automaticProducts).slice(0, normalizedProductLimit)
  }

  /**
   * 获取所有推荐区域（管理后台用）
   */
  async getAllSections() {
    const query = `
      SELECT
        s.id,
        s.section_key,
        s.section_name,
        s.section_type,
        s.icon,
        s.is_enabled,
        s.sort_order,
        s.product_limit,
        (SELECT COUNT(*) FROM H5_home_section_products WHERE section_id = s.id) as product_count
      FROM H5_home_sections s
      ORDER BY s.sort_order ASC
    `
    const [sections] = await db.getDatabase().query(query)
    return sections
  }

  /**
   * 创建推荐区域
   */
  async createSection(data) {
    const { section_key, section_name, section_type, icon, is_enabled, sort_order, product_limit } = data
    const query = `
      INSERT INTO H5_home_sections
      (section_key, section_name, section_type, icon, is_enabled, sort_order, product_limit)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    const [result] = await db.getDatabase().query(query, [
      section_key, section_name, section_type || 'products', icon || 'fas fa-list',
      is_enabled !== false, sort_order || 0, product_limit || 10
    ])
    return {
      id: result.insertId,
      section_key,
      section_name,
      section_type: section_type || 'products',
      icon: icon || 'fas fa-list',
      is_enabled: is_enabled !== false,
      sort_order: sort_order || 0,
      product_limit: product_limit || 10
    }
  }

  /**
   * 更新推荐区域
   */
  async updateSection(id, data) {
    const { section_name, section_type, icon, is_enabled, sort_order, product_limit } = data
    const query = `
      UPDATE H5_home_sections
      SET section_name = ?, section_type = ?, icon = ?, is_enabled = ?, sort_order = ?, product_limit = ?
      WHERE id = ?
    `
    await db.getDatabase().query(query, [
      section_name, section_type || 'products', icon || 'fas fa-list',
      is_enabled !== false, sort_order || 0, product_limit || 10,
      id
    ])
    return {
      id,
      section_name,
      section_type: section_type || 'products',
      icon: icon || 'fas fa-list',
      is_enabled: is_enabled !== false,
      sort_order: sort_order || 0,
      product_limit: product_limit || 10
    }
  }

  /**
   * 删除推荐区域
   */
  async deleteSection(id) {
    const query = 'DELETE FROM H5_home_sections WHERE id = ?'
    await db.getDatabase().query(query, [id])
  }

  /**
   * 获取推荐区域的商品列表
   */
  async getSectionProductsAdmin(sectionId) {
    const query = `
      SELECT
        sp.id,
        sp.sort_order,
        sp.phone_id,
        sp.template_id,
        -- 全新机信息
        t.template_name,
        t.brand_id,
        b.name as brand_name,
        t.model_id,
        m.name as model_name,
        t.color_id,
        c.name as color_name,
        COALESCE(
          (SELECT image_url FROM H5_newimages WHERE template_id = t.id AND is_primary = 1 LIMIT 1),
          (SELECT image_url FROM H5_newimages WHERE template_id = t.id AND image_type <> 'video' ORDER BY sort_order ASC, id ASC LIMIT 1),
          (SELECT image_url FROM H5_images WHERE phone_id = p.id AND is_primary = 1 LIMIT 1),
          (SELECT image_url FROM H5_images WHERE phone_id = p.id ORDER BY sort_order ASC, id ASC LIMIT 1)
        ) as main_image,
        (SELECT MIN(pl.retail_price)
         FROM price_list pl
         WHERE pl.brand_id = t.brand_id AND pl.model_id = t.model_id AND pl.color_id = t.color_id
           AND pl.retail_price IS NOT NULL AND pl.retail_price > 0
        ) as min_price,
        -- 二手机信息
        p.imei,
        p.quality_grade,
        h5.condition_grade,
        h5.sale_price as sale_price,
        CASE
          WHEN sp.template_id IS NOT NULL THEN 'new'
          ELSE 'used'
        END as product_type,
        CASE
          WHEN sp.template_id IS NOT NULL THEN CAST(CONCAT('全新机 - ', b.name, ' ', m.name) AS CHAR)
          ELSE CAST(CONCAT('二手机 - ', b.name, ' ', m.name, ' ', c.name, ' ', COALESCE(mem.size, '')) AS CHAR)
        END as display_text
      FROM H5_home_section_products sp
      LEFT JOIN H5_newtemplates t ON sp.template_id = t.id
      LEFT JOIN phones p ON sp.phone_id = p.id
      LEFT JOIN H5_product h5 ON p.id = h5.phone_id
      LEFT JOIN brands b ON (t.brand_id = b.id OR p.brand_id = b.id)
      LEFT JOIN models m ON (t.model_id = m.id OR p.model_id = m.id)
      LEFT JOIN colors c ON (t.color_id = c.id OR p.color_id = c.id)
      LEFT JOIN memories mem ON p.memory_id = mem.id
      WHERE sp.section_id = ?
      ORDER BY sp.sort_order ASC
    `
    const [products] = await db.getDatabase().query(query, [sectionId])
    return products
  }

  /**
   * 添加商品到推荐区域
   */
  async addProductToSection(sectionId, { phone_id, template_id, sort_order }) {
    const query = `
      INSERT INTO H5_home_section_products (section_id, phone_id, template_id, sort_order)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order)
    `
    await db.getDatabase().query(query, [sectionId, phone_id || null, template_id || null, sort_order || 0])
  }

  /**
   * 批量添加商品到推荐区域
   */
  async addProductsToSection(sectionId, products) {
    const values = products.map(p => [sectionId, p.phone_id || null, p.template_id || null, p.sort_order || 0])
    const _query = `
      INSERT INTO H5_home_section_products (section_id, phone_id, template_id, sort_order)
      VALUES ?
      ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order)
    `
    // 批量插入
    for (const value of values) {
      await this.addProductToSection(sectionId, { phone_id: value[1], template_id: value[2], sort_order: value[3] })
    }
  }

  /**
   * 移除推荐商品
   */
  async removeProductFromSection(id) {
    const query = 'DELETE FROM H5_home_section_products WHERE id = ?'
    await db.getDatabase().query(query, [id])
  }

  /**
   * 更新推荐商品排序
   */
  async updateProductSort(id, sort_order) {
    const query = 'UPDATE H5_home_section_products SET sort_order = ? WHERE id = ?'
    await db.getDatabase().query(query, [sort_order, id])
  }

  /**
   * 清空推荐区域的所有商品
   */
  async clearSectionProducts(sectionId) {
    const query = 'DELETE FROM H5_home_section_products WHERE section_id = ?'
    await db.getDatabase().query(query, [sectionId])
  }

  /**
   * 搜索可添加的商品
   */
  async searchProducts(keyword, type = 'all') {
    let query = ''
    let params = []

    // 如果没有关键词，返回所有商品（限制数量）
    const searchKeyword = keyword && keyword.trim() ? keyword.trim() : ''

    if (type === 'new' || type === 'all') {
      // 搜索全新机模板
      query = `
        SELECT
          t.id as template_id,
          NULL as phone_id,
          t.template_name,
          t.brand_id,
          b.name as brand_name,
          t.model_id,
          m.name as model_name,
          t.color_id,
          c.name as color_name,
        COALESCE(
          (SELECT image_url FROM H5_newimages WHERE template_id = t.id AND is_primary = 1 LIMIT 1),
          (SELECT image_url FROM H5_newimages WHERE template_id = t.id AND image_type <> 'video' ORDER BY sort_order ASC, id ASC LIMIT 1)
        ) as main_image,
          (SELECT MIN(pl.retail_price)
           FROM price_list pl
           WHERE pl.brand_id = t.brand_id AND pl.model_id = t.model_id AND pl.color_id = t.color_id
             AND pl.retail_price IS NOT NULL AND pl.retail_price > 0
          ) as price,
          'new' as product_type,
          CAST(CONCAT('全新机 - ', b.name, ' ', m.name) AS CHAR) as display_text
        FROM H5_newtemplates t
        LEFT JOIN brands b ON t.brand_id = b.id
        LEFT JOIN models m ON t.model_id = m.id
        LEFT JOIN colors c ON t.color_id = c.id
        WHERE t.is_active = TRUE
      `
      params = []
      if (searchKeyword) {
        query += ' AND (b.name LIKE ? OR m.name LIKE ? OR t.template_name LIKE ?)'
        params = [`%${searchKeyword}%`, `%${searchKeyword}%`, `%${searchKeyword}%`]
      }
    }

    if (type === 'used' || type === 'all') {
      // 搜索二手机
      const usedQuery = `
        SELECT
          NULL as template_id,
          p.id as phone_id,
          NULL as template_name,
          p.brand_id,
          b.name as brand_name,
          p.model_id,
          m.name as model_name,
          p.color_id,
          c.name as color_name,
        COALESCE(
          (SELECT image_url FROM H5_images WHERE phone_id = p.id AND is_primary = 1 LIMIT 1),
          (SELECT image_url FROM H5_images WHERE phone_id = p.id ORDER BY sort_order ASC, id ASC LIMIT 1)
        ) as main_image,
          h5.sale_price as price,
          'used' as product_type,
          CAST(CONCAT('二手机 - ', b.name, ' ', m.name, ' ', c.name, ' ', COALESCE(mem.size, '')) AS CHAR) as display_text
        FROM phones p
        LEFT JOIN H5_product h5 ON p.id = h5.phone_id
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN models m ON p.model_id = m.id
        LEFT JOIN colors c ON p.color_id = c.id
        LEFT JOIN memories mem ON p.memory_id = mem.id
        WHERE p.status = 'in_stock' AND p.is_new = 0
      `
      let usedParams = []
      if (searchKeyword) {
        usedQuery += ' AND (b.name LIKE ? OR m.name LIKE ? OR p.imei LIKE ?)'
        usedParams = [`%${searchKeyword}%`, `%${searchKeyword}%`, `%${searchKeyword}%`]
      }

      if (type === 'all') {
        query += ' UNION ALL ' + usedQuery
        params = [...params, ...usedParams]
      } else {
        query = usedQuery
        params = usedParams
      }
    }

    query += ' ORDER BY display_text ASC LIMIT 100'

    const [products] = await db.getDatabase().query(query, params)
    return products
  }
}

module.exports = new HomeSectionService()
