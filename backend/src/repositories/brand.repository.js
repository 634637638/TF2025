/**
 * 品牌数据访问层
 * 封装所有数据库操作
 */
const { executeQuery } = require('../config/database');
const BaseRepository = require('./base.repository');

class BrandRepository extends BaseRepository {
  constructor() {
    super('brands');
  }

  /**
   * 获取品牌列表（带分页和过滤）
   */
  async getBrandsWithPagination(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      name,
      status
    } = filters;

    const validLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
    const validPage = Math.max(parseInt(page) || 1, 1);
    const offset = (validPage - 1) * validLimit;

    // 构建查询条件
    const whereConditions = [];
    const params = [];

    if (name) {
      whereConditions.push('b.name LIKE ?');
      params.push(`%${name}%`);
    }

    if (status !== undefined) {
      whereConditions.push('b.status = ?');
      params.push(parseInt(status));
    }

    const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '';

    // 排序
    const orderBy = options.orderBy || 'b.sort_order ASC, b.created_at DESC';

    // 查询数据
    const dataQuery = `
      SELECT
        b.id,
        b.name,
        b.status,
        b.sort_order,
        b.created_at,
        b.updated_at,
        COALESCE(p.phone_count, 0) as phone_count,
        COALESCE(a.accessory_count, 0) as accessory_count,
        COALESCE(m.model_count, 0) as model_count,
        COALESCE(p.phone_count, 0) + COALESCE(a.accessory_count, 0) as total_product_count
      FROM ${this.tableName} b
      LEFT JOIN (
        SELECT brand, COUNT(*) as phone_count
        FROM phones GROUP BY brand
      ) p ON b.name = p.brand
      LEFT JOIN (
        SELECT brand, COUNT(*) as accessory_count
        FROM accessories GROUP BY brand
      ) a ON b.name = a.brand
      LEFT JOIN (
        SELECT brand_id, COUNT(*) as model_count
        FROM models GROUP BY brand_id
      ) m ON b.id = m.brand_id
      ${whereClause ? `WHERE ${whereClause}` : ''}
      ORDER BY ${orderBy}
      LIMIT ${validLimit} OFFSET ${offset}
    `;

    const [brands] = await this.executeQuery(dataQuery, params);

    // 格式化数据
    const formattedBrands = brands.map(row => ({
      id: parseInt(row.id),
      name: String(row.name || '').trim(),
      status: parseInt(row.status) || 0,
      sort_order: parseInt(row.sort_order) || 0,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      stats: {
        phone_count: parseInt(row.phone_count) || 0,
        accessory_count: parseInt(row.accessory_count) || 0,
        model_count: parseInt(row.model_count) || 0,
        total_product_count: parseInt(row.total_product_count) || 0
      }
    }));

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total FROM ${this.tableName} b
      ${whereClause ? `WHERE ${whereClause}` : ''}
    `;
    const [countResult] = await this.executeQuery(countQuery, params);
    const total = countResult[0].total;

    return {
      brands: formattedBrands,
      pagination: {
        page: validPage,
        limit: validLimit,
        total: total,
        totalPages: Math.ceil(total / validLimit),
        hasNextPage: validPage < Math.ceil(total / validLimit),
        hasPrevPage: validPage > 1
      }
    };
  }

  /**
   * 根据ID获取品牌详情
   */
  async getBrandById(id) {
    const brandQuery = `
      SELECT * FROM ${this.tableName} WHERE id = ?
    `;
    const [brands] = await this.executeQuery(brandQuery, [id]);

    if (brands.length === 0) {
      return null;
    }

    const brand = brands[0];

    // 获取型号信息
    const modelsQuery = `
      SELECT
        m.id,
        m.name as model_name,
        m.status,
        m.sort_order,
        m.created_at,
        COALESCE(p.phone_count, 0) as phone_count,
        COALESCE(a.accessory_count, 0) as accessory_count
      FROM models m
      LEFT JOIN (
        SELECT model, COUNT(*) as phone_count
        FROM phones
        WHERE brand = ?
        GROUP BY model
      ) p ON m.name = p.model
      LEFT JOIN (
        SELECT model, COUNT(*) as accessory_count
        FROM accessories
        WHERE brand = ?
        GROUP BY model
      ) a ON m.name = a.model
      WHERE m.brand_id = ?
      ORDER BY m.sort_order ASC, m.name ASC
    `;

    const [models] = await this.executeQuery(modelsQuery, [brand.name, brand.name, id]);

    // 获取统计信息
    const [phoneStats] = await this.executeQuery(
      'SELECT COUNT(*) as count FROM phones WHERE brand = ?',
      [brand.name]
    );
    const [accessoryStats] = await this.executeQuery(
      'SELECT COUNT(*) as count FROM accessories WHERE brand = ?',
      [brand.name]
    );
    const [modelStats] = await this.executeQuery(
      'SELECT COUNT(*) as count FROM models WHERE brand_id = ?',
      [id]
    );

    return {
      id: parseInt(brand.id),
      name: String(brand.name || '').trim(),
      status: parseInt(brand.status) || 0,
      sort_order: parseInt(brand.sort_order) || 0,
      created_at: brand.created_at ? new Date(brand.created_at).toISOString() : null,
      updated_at: brand.updated_at ? new Date(brand.updated_at).toISOString() : null,
      models: models.map(model => ({
        id: parseInt(model.id),
        name: String(model.model_name || '').trim(),
        status: parseInt(model.status) || 0,
        sort_order: parseInt(model.sort_order) || 0,
        created_at: model.created_at ? new Date(model.created_at).toISOString() : null,
        stats: {
          phone_count: parseInt(model.phone_count) || 0,
          accessory_count: parseInt(model.accessory_count) || 0
        }
      })),
      stats: {
        phone_count: parseInt(phoneStats[0].count) || 0,
        accessory_count: parseInt(accessoryStats[0].count) || 0,
        model_count: parseInt(modelStats[0].count) || 0,
        total_product_count: (parseInt(phoneStats[0].count) || 0) + (parseInt(accessoryStats[0].count) || 0)
      }
    };
  }

  /**
   * 创建品牌
   */
  async createBrand(brandData) {
    const { name, status = 1, sort_order = 0 } = brandData;

    const query = `
      INSERT INTO ${this.tableName} (
        name, status, sort_order, created_at
      ) VALUES (?, ?, ?, NOW())
    `;

    const params = [
      name,
      parseInt(status) || 1,
      parseInt(sort_order) || 0
    ];

    const [result] = await this.executeQuery(query, params);
    return result.insertId;
  }

  /**
   * 更新品牌
   */
  async updateBrand(id, brandData) {
    const { name, status, sort_order } = brandData;

    const query = `
      UPDATE ${this.tableName} SET
        name = ?, status = ?, sort_order = ?, updated_at = NOW()
      WHERE id = ?
    `;

    const params = [
      name,
      parseInt(status) || 0,
      parseInt(sort_order) || 0,
      parseInt(id)
    ];

    const [result] = await this.executeQuery(query, params);
    return result.affectedRows > 0;
  }

  /**
   * 删除品牌
   */
  async deleteBrand(id) {
    // 获取品牌名称
    const [brandResult] = await this.executeQuery(
      'SELECT name FROM brands WHERE id = ?',
      [id]
    );

    if (brandResult.length === 0) {
      return {
        canDelete: false,
        reason: '品牌不存在',
        deleted: false
      };
    }

    const brandName = brandResult[0].name;

    // 检查是否有关联的手机和配件
    const [phoneCount] = await this.executeQuery(
      'SELECT COUNT(*) as count FROM phones WHERE brand = ?',
      [brandName]
    );
    const [accessoryCount] = await this.executeQuery(
      'SELECT COUNT(*) as count FROM accessories WHERE brand = ?',
      [brandName]
    );

    if (phoneCount[0].count > 0 || accessoryCount[0].count > 0) {
      return {
        canDelete: false,
        reason: `该品牌下还有 ${phoneCount[0].count} 个手机和 ${accessoryCount[0].count} 个配件，无法删除`,
        phoneCount: phoneCount[0].count,
        accessoryCount: accessoryCount[0].count
      };
    }

    // 删除关联的型号
    await this.executeQuery('DELETE FROM models WHERE brand_id = ?', [id]);

    // 删除品牌
    const [result] = await this.executeQuery(
      `DELETE FROM ${this.tableName} WHERE id = ?`,
      [id]
    );

    return {
      canDelete: true,
      deleted: result.affectedRows > 0,
      name: brandName
    };
  }

  /**
   * 批量更新品牌状态
   */
  async batchUpdateStatus(ids, status) {
    const placeholders = ids.map(() => '?').join(',');
    const query = `
      UPDATE ${this.tableName}
      SET status = ?, updated_at = NOW()
      WHERE id IN (${placeholders})
    `;

    const params = [parseInt(status), ...ids.map(id => parseInt(id))];
    const [result] = await this.executeQuery(query, params);
    return result.affectedRows;
  }

  /**
   * 搜索品牌
   */
  async searchBrands(keyword, filters = {}) {
    const { page = 1, limit = 20, status } = filters;
    const validLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const validPage = Math.max(parseInt(page) || 1, 1);
    const offset = (validPage - 1) * validLimit;

    const whereConditions = [
      '(b.name LIKE ?)'
    ];
    const params = [
      `%${keyword}%`
    ];

    if (status !== undefined) {
      whereConditions.push('b.status = ?');
      params.push(parseInt(status));
    }

    const whereClause = whereConditions.join(' AND ');

    const query = `
      SELECT
        b.*,
        COALESCE(p.phone_count, 0) as phone_count,
        COALESCE(a.accessory_count, 0) as accessory_count
      FROM ${this.tableName} b
      LEFT JOIN (
        SELECT brand, COUNT(*) as phone_count
        FROM phones GROUP BY brand
      ) p ON b.name = p.brand
      LEFT JOIN (
        SELECT brand, COUNT(*) as accessory_count
        FROM accessories GROUP BY brand
      ) a ON b.name = a.brand
      WHERE ${whereClause}
      ORDER BY b.sort_order ASC, b.name
      LIMIT ${validLimit} OFFSET ${offset}
    `;

    const [brands] = await this.executeQuery(query, params);

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total FROM ${this.tableName} b
      WHERE ${whereClause}
    `;
    const [countResult] = await this.executeQuery(countQuery, params);
    const total = countResult[0].total;

    return {
      brands: brands.map(row => ({
        id: parseInt(row.id),
        name: String(row.name || '').trim(),
        status: parseInt(row.status) || 0,
        sort_order: parseInt(row.sort_order) || 0,
        stats: {
          phone_count: parseInt(row.phone_count) || 0,
          accessory_count: parseInt(row.accessory_count) || 0
        }
      })),
      pagination: {
        page: validPage,
        limit: validLimit,
        total: total,
        totalPages: Math.ceil(total / validLimit),
        hasNextPage: validPage < Math.ceil(total / validLimit),
        hasPrevPage: validPage > 1
      }
    };
  }

  /**
   * 检查品牌名称是否可用
   */
  async checkNameAvailability(name, excludeId = null) {
    let query = `SELECT id FROM ${this.tableName} WHERE name = ?`;
    let params = [name];

    if (excludeId) {
      query += ' AND id != ?';
      params.push(parseInt(excludeId));
    }

    const [result] = await this.executeQuery(query, params);
    return result.length === 0;
  }

  /**
   * 获取品牌统计信息
   */
  async getBrandStats() {
    const [totalStats] = await this.executeQuery(`
      SELECT
        COUNT(*) as total_brands,
        COUNT(CASE WHEN status = 1 THEN 1 END) as active_brands,
        COUNT(CASE WHEN status = 0 THEN 1 END) as inactive_brands
      FROM ${this.tableName}
    `);

    const [productStats] = await this.executeQuery(`
      SELECT
        COUNT(DISTINCT b.id) as brands_with_products
      FROM ${this.tableName} b
      LEFT JOIN phones p ON b.name = p.brand
      LEFT JOIN accessories a ON b.name = a.brand
      WHERE p.id IS NOT NULL OR a.id IS NOT NULL
    `);

    return {
      total_brands: parseInt(totalStats[0].total_brands) || 0,
      active_brands: parseInt(totalStats[0].active_brands) || 0,
      inactive_brands: parseInt(totalStats[0].inactive_brands) || 0,
      brands_with_products: parseInt(productStats[0].brands_with_products) || 0
    };
  }

  /**
   * 获取活跃品牌
   */
  async getActiveBrands() {
    const query = `
      SELECT id, name, sort_order
      FROM ${this.tableName}
      WHERE status = 1
      ORDER BY sort_order ASC, name
    `;

    const [brands] = await this.executeQuery(query);
    return brands.map(row => ({
      id: parseInt(row.id),
      name: String(row.name || '').trim(),
      sort_order: parseInt(row.sort_order) || 0
    }));
  }

  /**
   * 获取品牌下的所有型号
   */
  async getBrandModels(brandId, status = 1) {
    const query = `
      SELECT
        m.id,
        m.name,
        m.status,
        m.sort_order,
        b.name as brand_name
      FROM models m
      LEFT JOIN brands b ON m.brand_id = b.id
      WHERE m.brand_id = ? AND m.status = ?
      ORDER BY m.sort_order ASC, m.name
    `;

    const [models] = await this.executeQuery(query, [parseInt(brandId), parseInt(status)]);
    return models.map(row => ({
      id: parseInt(row.id),
      name: String(row.name || '').trim(),
      status: parseInt(row.status) || 0,
      sort_order: parseInt(row.sort_order) || 0,
      brand_name: String(row.brand_name || '').trim()
    }));
  }

  /**
   * 品牌搜索建议
   */
  async getBrandSuggestions(keyword, limit = 5) {
    if (!keyword || keyword.length < 2) {
      return [];
    }

    const query = `
      SELECT
        id,
        name,
        status
      FROM ${this.tableName}
      WHERE name LIKE ?
        AND status = 1
      ORDER BY sort_order ASC, name
      LIMIT ?
    `;

    const [brands] = await this.executeQuery(query, [`%${keyword}%`, parseInt(limit)]);
    return brands.map(row => ({
      id: parseInt(row.id),
      name: String(row.name || '').trim(),
      status: parseInt(row.status) || 0
    }));
  }

  /**
   * 导出品牌数据
   */
  async exportBrands(filters = {}) {
    const { name, status } = filters;

    const whereConditions = [];
    const params = [];

    if (name) {
      whereConditions.push('b.name LIKE ?');
      params.push(`%${name}%`);
    }

    if (status !== undefined) {
      whereConditions.push('b.status = ?');
      params.push(parseInt(status));
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT
        b.id,
        b.name,
        b.status,
        b.sort_order,
        b.created_at,
        b.updated_at,
        COALESCE(p.phone_count, 0) as phone_count,
        COALESCE(a.accessory_count, 0) as accessory_count,
        COALESCE(m.model_count, 0) as model_count,
        COALESCE(p.phone_count, 0) + COALESCE(a.accessory_count, 0) as total_product_count
      FROM ${this.tableName} b
      LEFT JOIN (
        SELECT brand, COUNT(*) as phone_count
        FROM phones GROUP BY brand
      ) p ON b.name = p.brand
      LEFT JOIN (
        SELECT brand, COUNT(*) as accessory_count
        FROM accessories GROUP BY brand
      ) a ON b.name = a.brand
      LEFT JOIN (
        SELECT brand_id, COUNT(*) as model_count
        FROM models GROUP BY brand_id
      ) m ON b.id = m.brand_id
      ${whereClause}
      ORDER BY b.sort_order ASC, b.name
    `;

    const [brands] = await this.executeQuery(query, params);

    return brands.map(row => ({
      ID: parseInt(row.id),
      品牌名称: String(row.name || '').trim(),
      状态: parseInt(row.status) === 1 ? '启用' : '禁用',
      排序: parseInt(row.sort_order) || 0,
      手机数量: parseInt(row.phone_count) || 0,
      配件数量: parseInt(row.accessory_count) || 0,
      型号数量: parseInt(row.model_count) || 0,
      总商品数量: parseInt(row.total_product_count) || 0,
      创建时间: row.created_at ? new Date(row.created_at).toLocaleString() : '',
      更新时间: row.updated_at ? new Date(row.updated_at).toLocaleString() : ''
    }));
  }
}

module.exports = BrandRepository;