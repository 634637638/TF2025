/**
 * H5首页推荐服务
 * 功能：管理首页推荐区域和商品
 */

const db = require('../config/database');

class HomeSectionService {
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
        s.fill_count,
        s.sort_order
      FROM H5_home_sections s
      WHERE s.is_enabled = TRUE
      ORDER BY s.sort_order ASC
    `;
    const [sections] = await db.getDatabase().query(query);

    // 为每个区域获取商品
    for (const section of sections) {
      section.products = await this.getSectionProducts(
        section.id,
        section.product_limit,
        section.fill_count
      );
    }

    return sections;
  }

  /**
   * 获取指定区域的商品（支持自动补齐）
   * @param {number} sectionId - 推荐区域ID
   * @param {number} productLimit - 最大显示数量
   * @param {number} fillCount - 自动补齐阈值（0表示不补齐）
   */
  async getSectionProducts(sectionId, productLimit = 10, fillCount = 0) {
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
    `;

    const [products] = await db.getDatabase().query(query, [sectionId, sectionId]);

    // 2. 根据用户需求处理商品显示逻辑
    const availableCount = products.length;

    let finalProducts = [];

    if (availableCount >= productLimit) {
      finalProducts = products.slice(0, productLimit);
    } else if (fillCount > 0 && availableCount < fillCount) {
      const needCount = Math.min(fillCount, productLimit) - availableCount;
      const fillProducts = await this.getRandomStockProducts(sectionId, needCount, products);
      finalProducts = [...products, ...fillProducts];
    } else {
      finalProducts = products;
    }

    return finalProducts;
  }

  /**
   * 从在库商品中随机选择商品补齐（保持商品类型一致）
   * @param {number} sectionId - 推荐区域ID
   * @param {number} limit - 需要补齐的数量
   * @param {Array} existingProducts - 已存在的商品
   */
  async getRandomStockProducts(sectionId, limit, existingProducts = []) {
    // 获取已存在的商品ID，避免重复
    const existingTemplateIds = existingProducts
      .filter(p => p.product_type === 'new' && p.template_id)
      .map(p => p.template_id);

    const existingPhoneIds = existingProducts
      .filter(p => p.product_type === 'used' && p.phone_id)
      .map(p => p.phone_id);

    // 分析已选商品的类型比例
    const newCount = existingProducts.filter(p => p.product_type === 'new').length;
    const usedCount = existingProducts.filter(p => p.product_type === 'used').length;
    const totalCount = existingProducts.length;

    let randomProducts = [];

    if (newCount > 0 && usedCount === 0) {
      randomProducts = await this.getRandomNewProducts(limit, existingTemplateIds);
    }
    else if (usedCount > 0 && newCount === 0) {
      randomProducts = await this.getRandomUsedProducts(limit, existingPhoneIds);
    }
    else {
      const newRatio = newCount / totalCount;
      const usedRatio = usedCount / totalCount;

      const newFillCount = Math.ceil(limit * newRatio);
      const usedFillCount = Math.ceil(limit * usedRatio);

      const newProducts = await this.getRandomNewProducts(newFillCount, existingTemplateIds);
      const usedProducts = await this.getRandomUsedProducts(usedFillCount, existingPhoneIds);

      randomProducts = [...newProducts, ...usedProducts].slice(0, limit);
    }

    return randomProducts;
  }

  /**
   * 获取随机全新机模板
   */
  async getRandomNewProducts(limit, existingTemplateIds = []) {
    const query = `
      SELECT DISTINCT
        t.id as template_id,
        NULL as phone_id,
        t.brand_id,
        b.name as brand_name,
        t.model_id,
        m.name as model_name,
        t.color_id,
        c.name as color_name,
        t.template_name,
        (SELECT image_url FROM H5_newimages WHERE template_id = t.id AND is_primary = 1 LIMIT 1) as main_image,
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
        'new' as product_type,
        9999 as sort_order
      FROM H5_newtemplates t
      INNER JOIN brands b ON t.brand_id = b.id
      INNER JOIN models m ON t.model_id = m.id
      INNER JOIN colors c ON t.color_id = c.id
      WHERE t.is_active = TRUE AND t.is_published = 1
        AND t.id NOT IN (${existingTemplateIds.length > 0 ? existingTemplateIds.map(() => '?').join(',') : '0'})
      ORDER BY RAND()
      LIMIT ?
    `;

    const params = [...existingTemplateIds, limit];
    const [products] = await db.getDatabase().query(query, params);
    return products;
  }

  /**
   * 获取随机二手机
   */
  async getRandomUsedProducts(limit, existingPhoneIds = []) {
    const query = `
      SELECT
        NULL as template_id,
        p.id as phone_id,
        p.brand_id,
        b.name as brand_name,
        p.model_id,
        m.name as model_name,
        p.color_id,
        c.name as color_name,
        NULL as template_name,
        (SELECT image_url FROM H5_images WHERE phone_id = p.id AND is_primary = 1 LIMIT 1) as main_image,
        h5.sale_price as min_price,
        1 as stock_count,
        p.id as first_phone_id,
        mem.size as memory_name,
        p.quality_grade,
        h5.condition_grade,
        0 as is_new,
        'used' as product_type,
        9999 as sort_order
      FROM phones p
      LEFT JOIN H5_product h5 ON p.id = h5.phone_id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      WHERE p.status = 'in_stock'
        AND p.is_new = 0
        AND (h5.is_published = 1 OR h5.is_published IS NULL)
        AND p.id NOT IN (${existingPhoneIds.length > 0 ? existingPhoneIds.map(() => '?').join(',') : '0'})
      ORDER BY RAND()
      LIMIT ?
    `;

    const params = [...existingPhoneIds, limit];
    const [products] = await db.getDatabase().query(query, params);
    return products;
  }

  /**
   * 获取所有推荐区域（管理后台用）
   */
  async getAllSections() {
    const query = `
      SELECT
        s.*,
        (SELECT COUNT(*) FROM H5_home_section_products WHERE section_id = s.id) as product_count
      FROM H5_home_sections s
      ORDER BY s.sort_order ASC
    `;
    const [sections] = await db.getDatabase().query(query);
    return sections;
  }

  /**
   * 创建推荐区域
   */
  async createSection(data) {
    const { section_key, section_name, section_type, icon, is_enabled, sort_order, product_limit, fill_count, auto_fill } = data;
    const query = `
      INSERT INTO H5_home_sections
      (section_key, section_name, section_type, icon, is_enabled, sort_order, product_limit, fill_count, auto_fill)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.getDatabase().query(query, [
      section_key, section_name, section_type || 'products', icon || 'fas fa-list',
      is_enabled !== false, sort_order || 0, product_limit || 10, fill_count || 0, auto_fill || false
    ]);
    return { id: result.insertId, ...data };
  }

  /**
   * 更新推荐区域
   */
  async updateSection(id, data) {
    const { section_name, section_type, icon, is_enabled, sort_order, product_limit, fill_count, auto_fill } = data;
    const query = `
      UPDATE H5_home_sections
      SET section_name = ?, section_type = ?, icon = ?, is_enabled = ?, sort_order = ?, product_limit = ?, fill_count = ?, auto_fill = ?
      WHERE id = ?
    `;
    await db.getDatabase().query(query, [
      section_name, section_type || 'products', icon || 'fas fa-list',
      is_enabled !== false, sort_order || 0, product_limit || 10, fill_count || 0, auto_fill || false,
      id
    ]);
    return { id, ...data };
  }

  /**
   * 删除推荐区域
   */
  async deleteSection(id) {
    const query = 'DELETE FROM H5_home_sections WHERE id = ?';
    await db.getDatabase().query(query, [id]);
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
    `;
    const [products] = await db.getDatabase().query(query, [sectionId]);
    return products;
  }

  /**
   * 添加商品到推荐区域
   */
  async addProductToSection(sectionId, { phone_id, template_id, sort_order }) {
    const query = `
      INSERT INTO H5_home_section_products (section_id, phone_id, template_id, sort_order)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order)
    `;
    await db.getDatabase().query(query, [sectionId, phone_id || null, template_id || null, sort_order || 0]);
  }

  /**
   * 批量添加商品到推荐区域
   */
  async addProductsToSection(sectionId, products) {
    const values = products.map(p => [sectionId, p.phone_id || null, p.template_id || null, p.sort_order || 0]);
    const query = `
      INSERT INTO H5_home_section_products (section_id, phone_id, template_id, sort_order)
      VALUES ?
      ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order)
    `;
    // 批量插入
    for (const value of values) {
      await this.addProductToSection(sectionId, { phone_id: value[1], template_id: value[2], sort_order: value[3] });
    }
  }

  /**
   * 移除推荐商品
   */
  async removeProductFromSection(id) {
    const query = 'DELETE FROM H5_home_section_products WHERE id = ?';
    await db.getDatabase().query(query, [id]);
  }

  /**
   * 更新推荐商品排序
   */
  async updateProductSort(id, sort_order) {
    const query = 'UPDATE H5_home_section_products SET sort_order = ? WHERE id = ?';
    await db.getDatabase().query(query, [sort_order, id]);
  }

  /**
   * 清空推荐区域的所有商品
   */
  async clearSectionProducts(sectionId) {
    const query = 'DELETE FROM H5_home_section_products WHERE section_id = ?';
    await db.getDatabase().query(query, [sectionId]);
  }

  /**
   * 搜索可添加的商品
   */
  async searchProducts(keyword, type = 'all') {
    let query = '';
    let params = [];

    // 如果没有关键词，返回所有商品（限制数量）
    const searchKeyword = keyword && keyword.trim() ? keyword.trim() : '';

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
      `;
      params = [];
      if (searchKeyword) {
        query += ` AND (b.name LIKE ? OR m.name LIKE ? OR t.template_name LIKE ?)`;
        params = [`%${searchKeyword}%`, `%${searchKeyword}%`, `%${searchKeyword}%`];
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
      `;
      let usedParams = [];
      if (searchKeyword) {
        usedQuery += ` AND (b.name LIKE ? OR m.name LIKE ? OR p.imei LIKE ?)`;
        usedParams = [`%${searchKeyword}%`, `%${searchKeyword}%`, `%${searchKeyword}%`];
      }

      if (type === 'all') {
        query += ` UNION ALL ` + usedQuery;
        params = [...params, ...usedParams];
      } else {
        query = usedQuery;
        params = usedParams;
      }
    }

    query += ` ORDER BY display_text ASC LIMIT 100`;

    const [products] = await db.getDatabase().query(query, params);
    return products;
  }
}

module.exports = new HomeSectionService();
