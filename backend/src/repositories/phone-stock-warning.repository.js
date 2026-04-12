/**
 * 手机库存预警配置数据访问层
 */
const BaseRepository = require('./base.repository');
const { ensurePhoneStockWarningSchema } = require('../utils/phone-stock-warning-schema');
const log = require('../utils/log');

class PhoneStockWarningRepository extends BaseRepository {
  constructor() {
    super('phone_stock_warnings');
  }

  normalizeNullableId(value) {
    return value === null || value === undefined || value === 0 ? null : value;
  }

  normalizeIsNew(value) {
    return value === 0 || value === 1 ? value : null;
  }

  normalizeMinStock(value) {
    return value === undefined || value === null ? 3 : value;
  }

  buildConfigMatchQuery(baseQuery, {
    brandId,
    modelId,
    colorId = null,
    memoryId = null,
    isNew = null,
    excludeId = null
  }) {
    let query = baseQuery;
    const params = [];

    if (brandId !== null && brandId !== undefined) {
      query += ' AND brand_id = ?';
      params.push(brandId);
    } else {
      query += ' AND brand_id IS NULL';
    }

    if (modelId !== null && modelId !== undefined) {
      query += ' AND model_id = ?';
      params.push(modelId);
    } else {
      query += ' AND model_id IS NULL';
    }

    const normalizedColorId = this.normalizeNullableId(colorId);
    if (normalizedColorId !== null) {
      query += ' AND color_id = ?';
      params.push(normalizedColorId);
    } else {
      query += ' AND color_id IS NULL';
    }

    const normalizedMemoryId = this.normalizeNullableId(memoryId);
    if (normalizedMemoryId !== null) {
      query += ' AND memory_id = ?';
      params.push(normalizedMemoryId);
    } else {
      query += ' AND memory_id IS NULL';
    }

    const normalizedIsNew = this.normalizeIsNew(isNew);
    if (normalizedIsNew !== null) {
      query += ' AND is_new = ?';
      params.push(normalizedIsNew);
    } else {
      query += ' AND is_new IS NULL';
    }

    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }

    return { query, params };
  }

  /**
   * 获取所有预警配置（带品牌型号颜色内存信息）
   */
  async getAllConfigsWithDetails() {
    try {
      await ensurePhoneStockWarningSchema();

      const query = `
        SELECT
          psw.id,
          psw.brand_id,
          psw.model_id,
          psw.color_id,
          psw.memory_id,
          psw.is_new,
          psw.min_stock,
          psw.warning_enabled,
          psw.config_name,
          psw.remarks,
          psw.status,
          psw.created_at,
          psw.updated_at,
          br.name as brand_name,
          m.name as model_name,
          c.name as color_name,
          mem.size as memory_size
        FROM phone_stock_warnings psw
        LEFT JOIN brands br ON psw.brand_id = br.id
        LEFT JOIN models m ON psw.model_id = m.id
        LEFT JOIN colors c ON psw.color_id = c.id
        LEFT JOIN memories mem ON psw.memory_id = mem.id
        ORDER BY
          br.name,
          m.name,
          c.name,
          mem.size,
          psw.is_new DESC
      `;

      const configs = await this.executeQuery(query);
      return configs;
    } catch (error) {
      log.error('获取预警配置失败:', error);
      throw error;
    }
  }

  /**
   * 根据品牌、型号、颜色、内存获取预警配置
   * 优先级：具体配置 > 品牌型号配置 > 品牌配置 > 默认值
   */
  async getWarningConfig(brandId, modelId, colorId = null, memoryId = null) {
    try {
      const normalizedColorId = this.normalizeNullableId(colorId);
      const normalizedMemoryId = this.normalizeNullableId(memoryId);

      const query = `
        SELECT COALESCE(
          (SELECT min_stock FROM phone_stock_warnings
           WHERE brand_id = ? AND model_id = ?
           AND (color_id = ? OR color_id IS NULL)
           AND (memory_id = ? OR memory_id IS NULL)
           AND status = 1 AND warning_enabled = 1
           ORDER BY
             CASE WHEN color_id = ? THEN 0 ELSE 1 END,
             CASE WHEN memory_id = ? THEN 0 ELSE 1 END
           LIMIT 1),
          3
        ) as threshold
      `;

      const results = await this.executeQuery(query, [
        brandId,
        modelId,
        normalizedColorId,
        normalizedMemoryId,
        normalizedColorId,
        normalizedMemoryId
      ]);
      return results[0]?.threshold ?? 3;
    } catch (error) {
      log.error('获取预警阈值失败:', error);
      return 3;
    }
  }

  /**
   * 批量获取多个型号的预警阈值（优化版 - 避免 N+1 查询）
   * 返回 Map: { "brandId_modelId": threshold }
   */
  async getWarningConfigBatch(phoneList) {
    try {
      if (!phoneList || phoneList.length === 0) {
        return {};
      }

      // 构建品牌型号的唯一列表
      const uniquePairs = [...new Set(phoneList.map(p => `${p.brand_id}_${p.model_id}`))];

      if (uniquePairs.length === 0) {
        return {};
      }

      // 使用批量查询替代循环查询，避免 N+1 问题
      // 一次性查询所有品牌型号的预警阈值
      const placeholders = uniquePairs.map(() => '(?, ?)').join(', ');
      const params = uniquePairs.flatMap(pair => {
        const [brandId, modelId] = pair.split('_').map(Number);
        return [brandId, modelId];
      });

      const query = `
        SELECT
          psw.brand_id,
          psw.model_id,
          COALESCE(
            (SELECT MIN(min_stock) FROM phone_stock_warnings
             WHERE brand_id = psw.brand_id
               AND model_id = psw.model_id
               AND status = 1
               AND warning_enabled = 1
               AND (color_id IS NULL OR color_id = 0)
               AND (memory_id IS NULL OR memory_id = 0)),
            3
          ) as threshold
        FROM (SELECT DISTINCT ? as brand_id, ? as model_id ${uniquePairs.slice(1).map(() => `UNION ALL SELECT ?, ?`).join('')})
        AS unique_configs
        LEFT JOIN phone_stock_warnings psw
          ON psw.brand_id = unique_configs.brand_id
          AND psw.model_id = unique_configs.model_id
          AND psw.status = 1
          AND psw.warning_enabled = 1
      `;

      // 简化方案：使用 IN 子句批量查询
      const simpleQuery = `
        SELECT
          brand_id,
          model_id,
          COALESCE(
            (SELECT MIN(min_stock) FROM phone_stock_warnings psw2
             WHERE psw2.brand_id = phone_stock_warnings.brand_id
               AND psw2.model_id = phone_stock_warnings.model_id
               AND psw2.status = 1
               AND psw2.warning_enabled = 1
               AND (psw2.color_id IS NULL OR psw2.color_id = 0)
               AND (psw2.memory_id IS NULL OR psw2.memory_id = 0)
             LIMIT 1),
            3
          ) as threshold
        FROM phone_stock_warnings
        WHERE (brand_id, model_id) IN (${placeholders})
        GROUP BY brand_id, model_id
      `;

      const configMap = {};

      // 执行批量查询
      const results = await this.executeQuery(simpleQuery, params);

      // 构建结果 Map
      results.forEach(row => {
        const key = `${row.brand_id}_${row.model_id}`;
        configMap[key] = row.threshold || 3;
      });

      // 对于没有查询结果的配置，使用默认值 3
      uniquePairs.forEach(pair => {
        if (!configMap[pair]) {
          configMap[pair] = 3;
        }
      });

      return configMap;
    } catch (error) {
      log.error('批量获取预警阈值失败:', error);
      // 发生错误时返回默认值
      const configMap = {};
      const uniquePairs = [...new Set(phoneList.map(p => `${p.brand_id}_${p.model_id}`))];
      uniquePairs.forEach(pair => {
        configMap[pair] = 3;
      });
      return configMap;
    }
  }

  /**
   * 检查配置是否已存在
   */
  async checkConfigExists(brandId, modelId, colorId = null, memoryId = null, isNew = null, excludeId = null) {
    try {
      await ensurePhoneStockWarningSchema();

      const { query, params } = this.buildConfigMatchQuery(
        'SELECT id FROM phone_stock_warnings WHERE 1=1',
        { brandId, modelId, colorId, memoryId, isNew, excludeId }
      );

      const result = await this.executeQuery(query, params);
      return result && result.length > 0;
    } catch (error) {
      log.error('检查配置存在性失败:', error);
      return false;
    }
  }

  /**
   * 按精确组合查找配置
   */
  async findConfigByExactMatch(brandId, modelId, colorId = null, memoryId = null, isNew = null, excludeId = null) {
    try {
      await ensurePhoneStockWarningSchema();

      const { query, params } = this.buildConfigMatchQuery(
        'SELECT * FROM phone_stock_warnings WHERE 1=1',
        { brandId, modelId, colorId, memoryId, isNew, excludeId }
      );

      const rows = await this.executeQuery(`${query} ORDER BY id DESC LIMIT 1`, params);
      return rows && rows.length > 0 ? rows[0] : null;
    } catch (error) {
      log.error('查找精确预警配置失败:', error);
      throw error;
    }
  }

  /**
   * 创建预警配置
   */
  async createConfig(config) {
    try {
      await ensurePhoneStockWarningSchema();

      const { brand_id, model_id, color_id, memory_id, is_new, min_stock, warning_enabled, config_name, remarks } = config;

      const query = `
        INSERT INTO phone_stock_warnings
        (brand_id, model_id, color_id, memory_id, is_new, min_stock, warning_enabled, config_name, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const db = this.getConnection();
      const [result] = await db.execute(query, [
        this.normalizeNullableId(brand_id),
        this.normalizeNullableId(model_id),
        this.normalizeNullableId(color_id),
        this.normalizeNullableId(memory_id),
        this.normalizeIsNew(is_new),
        this.normalizeMinStock(min_stock),
        warning_enabled !== undefined ? warning_enabled : 1,
        config_name || null,
        remarks || null
      ]);

      return result.insertId;
    } catch (error) {
      log.error('创建预警配置失败:', error);
      throw error;
    }
  }

  /**
   * 更新预警配置
   */
  async updateConfig(id, config) {
    try {
      await ensurePhoneStockWarningSchema();

      const { brand_id, model_id, color_id, memory_id, is_new, min_stock, warning_enabled, config_name, remarks, status } = config;

      const query = `
        UPDATE phone_stock_warnings
        SET brand_id = ?,
            model_id = ?,
            color_id = ?,
            memory_id = ?,
            is_new = ?,
            min_stock = ?,
            warning_enabled = ?,
            config_name = ?,
            remarks = ?,
            status = ?
        WHERE id = ?
      `;

      await this.executeQuery(query, [
        this.normalizeNullableId(brand_id),
        this.normalizeNullableId(model_id),
        this.normalizeNullableId(color_id),
        this.normalizeNullableId(memory_id),
        this.normalizeIsNew(is_new),
        this.normalizeMinStock(min_stock),
        warning_enabled !== undefined ? warning_enabled : 1,
        config_name || null,
        remarks || null,
        status !== undefined ? status : 1,
        id
      ]);

      return true;
    } catch (error) {
      log.error('更新预警配置失败:', error);
      throw error;
    }
  }

  /**
   * 删除预警配置
   */
  async deleteConfig(id) {
    try {
      // 不允许删除默认全局配置（id=1 且 brand_id IS NULL AND model_id IS NULL）
      const config = await this.executeQuery('SELECT * FROM phone_stock_warnings WHERE id = ?', [id]);
      if (config && config.length > 0) {
        const cfg = config[0];
        if (cfg.brand_id === null && cfg.model_id === null) {
          throw new Error('不允许删除默认全局配置');
        }
      }

      await this.executeQuery('DELETE FROM phone_stock_warnings WHERE id = ?', [id]);
      return true;
    } catch (error) {
      log.error('删除预警配置失败:', error);
      throw error;
    }
  }

  /**
   * 启用/禁用预警
   */
  async toggleWarningEnabled(id, enabled) {
    try {
      const query = 'UPDATE phone_stock_warnings SET warning_enabled = ? WHERE id = ?';
      await this.executeQuery(query, [enabled ? 1 : 0, id]);
      return true;
    } catch (error) {
      log.error('切换预警状态失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有启用的品牌（用于下拉选择）
   */
  async getActiveBrands() {
    try {
      // 按照 sort_order 排序，如果没有则按名称排序
      const query = 'SELECT id, name FROM brands WHERE status = 1 ORDER BY sort_order, CONVERT(name USING gbk)';
      const brands = await this.executeQuery(query);
      return brands;
    } catch (error) {
      log.error('获取品牌列表失败:', error);
      throw error;
    }
  }

  /**
   * 根据品牌ID获取启用的型号
   */
  async getActiveModelsByBrand(brandId) {
    try {
      // 按照 sort_order 排序，如果没有则按名称排序
      const query = 'SELECT id, name FROM models WHERE brand_id = ? AND status = 1 ORDER BY sort_order, CONVERT(name USING gbk)';
      const models = await this.executeQuery(query, [brandId]);
      return models;
    } catch (error) {
      log.error('获取型号列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有启用的颜色
   */
  async getActiveColors() {
    try {
      // 按照 sort_order 排序，如果没有则按名称排序
      const query = 'SELECT id, name FROM colors WHERE status = 1 ORDER BY sort_order, CONVERT(name USING gbk)';
      const colors = await this.executeQuery(query);
      return colors;
    } catch (error) {
      log.error('获取颜色列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有启用的内存
   */
  async getActiveMemories() {
    try {
      // 按照 sort_order 排序，如果没有则按名称排序
      const query = 'SELECT id, size FROM memories WHERE status = 1 ORDER BY sort_order, CONVERT(size USING gbk)';
      const memories = await this.executeQuery(query);
      return memories;
    } catch (error) {
      log.error('获取内存列表失败:', error);
      throw error;
    }
  }
}

module.exports = PhoneStockWarningRepository;
