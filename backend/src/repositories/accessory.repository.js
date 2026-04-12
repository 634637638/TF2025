/**
 * 配件数据访问层
 * 处理所有配件相关的数据库操作
 */
const BaseRepository = require('./base.repository');
const log = require('../utils/log');

class AccessoryRepository extends BaseRepository {
  constructor() {
    super('accessories');
  }

  /**
   * 获取配件列表（带分页和筛选）
   */
  async getAccessories(options = {}) {
    try {
      const {
        page = 1,
        pageSize = 50,
        category,
        brandId,
        modelId,
        supplierId,
        status = 1,
        search
      } = options;

      const offset = (page - 1) * pageSize;
      const conditions = [];
      const params = [];

      // 构建查询条件
      if (status !== null && status !== undefined) {
        conditions.push('a.status = ?');
        params.push(status);
      }

      if (category) {
        conditions.push('a.category = ?');
        params.push(category);
      }

      if (brandId) {
        conditions.push('a.brand_id = ?');
        params.push(brandId);
      }

      if (modelId) {
        conditions.push('a.model_id = ?');
        params.push(modelId);
      }

      if (supplierId) {
        conditions.push('a.supplier_id = ?');
        params.push(supplierId);
      }

      if (search) {
        conditions.push('(a.name LIKE ? OR a.barcode LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

      // 查询总数
      const countQuery = `
        SELECT COUNT(DISTINCT a.id) as total
        FROM accessories a
        ${whereClause}
      `;
      const countResult = await this.executeQuery(countQuery, params);
      const total = countResult && countResult.length > 0 ? countResult[0].total : 0;

      // 查询列表
      const query = `
        SELECT
          a.*,
          b.name as brand_name,
          m.name as model_name,
          c.name as color_name,
          s.name as supplier_name,
          COALESCE(SUM(ast.quantity), 0) as total_stock,
          COALESCE(SUM(ast.total_in), 0) as total_in,
          COALESCE(SUM(ast.total_out), 0) as total_out
        FROM accessories a
        LEFT JOIN brands b ON a.brand_id = b.id
        LEFT JOIN models m ON a.model_id = m.id
        LEFT JOIN colors c ON a.color_id = c.id
        LEFT JOIN suppliers s ON a.supplier_id = s.id
        LEFT JOIN accessory_stock ast ON a.id = ast.accessory_id
        ${whereClause}
        GROUP BY a.id
        ORDER BY a.id DESC
        LIMIT ? OFFSET ?
      `;

      const accessories = await this.executeQuery(query, [...params, pageSize, offset]);

      return {
        data: accessories,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error) {
      log.error('获取配件列表失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取配件详情
   */
  async getAccessoryById(id) {
    try {
      const query = `
        SELECT
          a.*,
          b.name as brand_name,
          m.name as model_name,
          c.name as color_name,
          s.name as supplier_name
        FROM accessories a
        LEFT JOIN brands b ON a.brand_id = b.id
        LEFT JOIN models m ON a.model_id = m.id
        LEFT JOIN colors c ON a.color_id = c.id
        LEFT JOIN suppliers s ON a.supplier_id = s.id
        WHERE a.id = ?
      `;

      const accessories = await this.executeQuery(query, [id]);
      return accessories && accessories.length > 0 ? accessories[0] : null;
    } catch (error) {
      log.error('获取配件详情失败:', error);
      throw error;
    }
  }

  /**
   * 根据条形码获取配件
   */
  async getAccessoryByBarcode(barcode) {
    try {
      const query = `
        SELECT
          a.*,
          b.name as brand_name,
          m.name as model_name,
          c.name as color_name,
          s.name as supplier_name
        FROM accessories a
        LEFT JOIN brands b ON a.brand_id = b.id
        LEFT JOIN models m ON a.model_id = m.id
        LEFT JOIN colors c ON a.color_id = c.id
        LEFT JOIN suppliers s ON a.supplier_id = s.id
        WHERE a.barcode = ? AND a.status = 1
      `;

      // executeQuery 已经返回解构后的 rows 数组，不需要再解构
      const accessories = await this.executeQuery(query, [barcode]);
      return accessories && accessories.length > 0 ? accessories[0] : null;
    } catch (error) {
      log.error('根据条形码获取配件失败:', error);
      throw error;
    }
  }

  /**
   * 创建配件
   */
  async createAccessory(data) {
    try {
      const query = `
        INSERT INTO accessories (
          name, barcode, category, brand_id, model_id, color_id, supplier_id,
          purchase_price, selling_price, specifications, unit, status,
          description, remarks, image_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        data.name,
        data.barcode || null,
        data.category || null,
        data.brand_id || null,
        data.model_id || null,
        data.color_id || null,
        data.supplier_id || null,
        data.purchase_price || 0,
        data.selling_price || 0,
        data.specifications || null,
        data.unit || '个',
        data.status !== undefined ? data.status : 1,
        data.description || null,
        data.remarks || null,
        data.image_url || null
      ];

      // INSERT 语句需要直接使用 db.query 来获取 insertId
      const db = this.getConnection();
      const queryResult = await db.query(query, params);

      // mysql2 pool.query 返回 [ResultSetHeader, fields]
      // ResultSetHeader 包含 insertId, affectedRows 等属性
      let result = queryResult;
      if (Array.isArray(queryResult) && queryResult.length > 0) {
        result = queryResult[0];
      }

      return result.insertId;
    } catch (error) {
      log.error('创建配件失败:', error);
      throw error;
    }
  }

  /**
   * 更新配件
   */
  async updateAccessory(id, data) {
    try {
      const fields = [];
      const params = [];

      const allowedFields = [
        'name', 'barcode', 'category', 'brand_id', 'model_id', 'color_id',
        'supplier_id', 'purchase_price', 'selling_price', 'specifications',
        'unit', 'status', 'description', 'remarks', 'image_url'
      ];

      allowedFields.forEach(field => {
        if (data[field] !== undefined) {
          fields.push(`${field} = ?`);
          params.push(data[field]);
        }
      });

      if (fields.length === 0) {
        return false;
      }

      params.push(id);

      const query = `
        UPDATE accessories
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = ?
      `;

      const result = await this.executeQuery(query, params);
      return result.affectedRows > 0;
    } catch (error) {
      log.error('更新配件失败:', error);
      throw error;
    }
  }

  /**
   * 删除配件（软删除）
   */
  async deleteAccessory(id) {
    try {
      const query = 'UPDATE accessories SET status = 0, updated_at = NOW() WHERE id = ?';
      const result = await this.executeQuery(query, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      log.error('删除配件失败:', error);
      throw error;
    }
  }

  /**
   * 获取配件库存（按门店）
   */
  async getAccessoryStock(accessoryId) {
    try {
      const query = `
        SELECT
          ast.id,
          ast.accessory_id,
          ast.store_id,
          s.name as store_name,
          ast.quantity,
          ast.min_stock,
          ast.max_stock,
          ast.total_in,
          ast.total_out,
          CASE
            WHEN ast.quantity = 0 THEN 'out_of_stock'
            WHEN ast.quantity <= ast.min_stock THEN 'low_stock'
            ELSE 'in_stock'
          END as stock_status
        FROM accessory_stock ast
        LEFT JOIN stores s ON ast.store_id = s.id
        WHERE ast.accessory_id = ?
        ORDER BY ast.store_id
      `;

      const stock = await this.executeQuery(query, [accessoryId]);

      // 计算总库存
      const totalStock = stock.reduce((sum, s) => sum + (s.quantity || 0), 0);

      return {
        accessory_id: accessoryId,
        total_stock: totalStock,
        stores: stock
      };
    } catch (error) {
      log.error('获取配件库存失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有配件库存列表
   */
  async getAllAccessoryStock(options = {}) {
    try {
      const {
        storeId,
        lowStockOnly = false,
        page = 1,
        pageSize = 50
      } = options;

      const offset = (page - 1) * pageSize;
      const conditions = [];
      const params = [];

      if (storeId) {
        conditions.push('ast.store_id = ?');
        params.push(storeId);
      }

      if (lowStockOnly) {
        conditions.push('ast.quantity <= ast.min_stock');
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

      // 查询总数
      const countQuery = `
        SELECT COUNT(*) as total
        FROM accessory_stock ast
        ${whereClause}
      `;
      const countResult = await this.executeQuery(countQuery, params);
      const total = countResult && countResult.length > 0 ? countResult[0].total : 0;

      // 查询列表
      const query = `
        SELECT
          ast.*,
          a.name as accessory_name,
          a.barcode,
          a.category,
          s.name as store_name,
          CASE
            WHEN ast.quantity = 0 THEN 'out_of_stock'
            WHEN ast.quantity <= ast.min_stock THEN 'low_stock'
            ELSE 'in_stock'
          END as stock_status
        FROM accessory_stock ast
        LEFT JOIN accessories a ON ast.accessory_id = a.id
        LEFT JOIN stores s ON ast.store_id = s.id
        ${whereClause}
        ORDER BY ast.store_id, a.id
        LIMIT ? OFFSET ?
      `;

      const stock = await this.executeQuery(query, [...params, pageSize, offset]);

      return {
        data: stock,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error) {
      log.error('获取配件库存列表失败:', error);
      throw error;
    }
  }

  /**
   * 更新配件库存（用于入库/销售/调拨）
   * 支持设置最小库存值
   */
  async updateAccessoryStock(accessoryId, storeId, quantity, operation = 'add', minStock = 5) {
    try {
      const operator = operation === 'add' ? '+' : '-';
      const totalInValue = operation === 'add' ? quantity : 0;
      const totalOutValue = operation === 'subtract' ? quantity : 0;

      const query = `
        INSERT INTO accessory_stock (accessory_id, store_id, quantity, total_in, total_out, min_stock)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          quantity = quantity ${operator} ?,
          total_in = total_in + ?,
          total_out = total_out + ?,
          min_stock = VALUES(min_stock),
          updated_at = NOW()
      `;

      // INSERT ... ON DUPLICATE KEY UPDATE 需要使用 db.query 来获取 affectedRows
      const db = this.getConnection();
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
      ]);

      // mysql2 pool.query 返回 [ResultSetHeader, fields]
      let result = queryResult;
      if (Array.isArray(queryResult) && queryResult.length > 0) {
        result = queryResult[0];
      }

      return result.affectedRows > 0;
    } catch (error) {
      log.error('更新配件库存失败:', error);
      throw error;
    }
  }

  /**
   * 创建入库记录
   */
  async createStockInRecord(data) {
    try {
      const query = `
        INSERT INTO accessory_stock_in (
          batch_no, accessory_id, supplier_id, store_id,
          quantity, purchase_price, total_amount,
          barcode_scanned, distribution, remarks,
          operator_id, operator_name, stock_in_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        data.batch_no,
        data.accessory_id,
        data.supplier_id,
        data.store_id,
        data.quantity,
        data.purchase_price,
        data.total_amount,
        data.barcode_scanned || null,
        data.distribution || null,
        data.remarks || null,
        data.operator_id,
        data.operator_name,
        data.stock_in_date,
        data.status || 'completed'
      ];

      // INSERT 语句需要直接使用 db.query 来获取 insertId
      const db = this.getConnection();
      const queryResult = await db.query(query, params);

      // mysql2 pool.query 返回 [ResultSetHeader, fields]
      let result = queryResult;
      if (Array.isArray(queryResult) && queryResult.length > 0) {
        result = queryResult[0];
      }

      return result.insertId;
    } catch (error) {
      log.error('创建入库记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取入库记录列表
   */
  async getStockInRecords(options = {}) {
    try {
      const {
        accessoryId,
        supplierId,
        storeId,
        startDate,
        endDate,
        page = 1,
        pageSize = 50
      } = options;

      const offset = (page - 1) * pageSize;
      const conditions = [];
      const params = [];

      if (accessoryId) {
        conditions.push('asi.accessory_id = ?');
        params.push(accessoryId);
      }

      if (supplierId) {
        conditions.push('asi.supplier_id = ?');
        params.push(supplierId);
      }

      if (storeId) {
        conditions.push('asi.store_id = ?');
        params.push(storeId);
      }

      if (startDate) {
        conditions.push('asi.stock_in_date >= ?');
        params.push(startDate);
      }

      if (endDate) {
        conditions.push('asi.stock_in_date <= ?');
        params.push(endDate);
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

      // 查询总数
      const countQuery = `
        SELECT COUNT(*) as total
        FROM accessory_stock_in asi
        ${whereClause}
      `;
      const countResult = await this.executeQuery(countQuery, params);
      const total = countResult && countResult.length > 0 ? countResult[0].total : 0;

      // 查询列表
      const query = `
        SELECT
          asi.*,
          a.name as accessory_name,
          a.barcode,
          s.name as supplier_name,
          st.name as store_name
        FROM accessory_stock_in asi
        LEFT JOIN accessories a ON asi.accessory_id = a.id
        LEFT JOIN suppliers s ON asi.supplier_id = s.id
        LEFT JOIN stores st ON asi.store_id = st.id
        ${whereClause}
        ORDER BY asi.stock_in_date DESC, asi.id DESC
        LIMIT ? OFFSET ?
      `;

      const records = await this.executeQuery(query, [...params, pageSize, offset]);

      return {
        data: records,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error) {
      log.error('获取入库记录失败:', error);
      throw error;
    }
  }

  /**
   * 创建配件销售记录
   */
  async createSalesRecord(data) {
    try {
      const query = `
        INSERT INTO accessory_sales (
          sale_no, accessory_id, store_id,
          customer_id, customer_name, customer_phone,
          quantity, unit_price, total_price,
          purchase_cost, profit, remarks,
          operator_id, operator_name, sale_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

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
        data.purchase_cost || 0,
        data.profit || 0,
        data.remarks || null,
        data.operator_id,
        data.operator_name,
        data.sale_time
      ];

      // INSERT 语句需要直接使用 db.query 来获取 insertId
      const db = this.getConnection();
      const queryResult = await db.query(query, params);

      // mysql2 pool.query 返回 [ResultSetHeader, fields]
      let result = queryResult;
      if (Array.isArray(queryResult) && queryResult.length > 0) {
        result = queryResult[0];
      }

      return result.insertId;
    } catch (error) {
      log.error('创建销售记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取配件分类统计
   */
  async getCategoryStats() {
    try {
      const query = `
        SELECT
          category,
          COUNT(*) as count,
          SUM(selling_price) as total_value
        FROM accessories
        WHERE status = 1 AND category IS NOT NULL
        GROUP BY category
        ORDER BY count DESC
      `;

      const stats = await this.executeQuery(query);
      return stats;
    } catch (error) {
      log.error('获取分类统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取库存预警列表
   */
  async getLowStockAccessories(threshold = null) {
    try {
      let query = `
        SELECT
          a.id,
          a.name,
          a.barcode,
          a.category,
          COALESCE(SUM(ast.quantity), 0) as total_quantity,
          MIN(ast.min_stock) as min_stock_threshold
        FROM accessories a
        LEFT JOIN accessory_stock ast ON a.id = ast.accessory_id
        WHERE a.status = 1
        GROUP BY a.id
        HAVING total_quantity <= COALESCE(MIN(ast.min_stock), 5)
        ORDER BY total_quantity ASC
      `;

      if (threshold) {
        query = `
          SELECT
            a.id,
            a.name,
            a.barcode,
            a.category,
            COALESCE(SUM(ast.quantity), 0) as total_quantity,
            MIN(ast.min_stock) as min_stock_threshold
          FROM accessories a
          LEFT JOIN accessory_stock ast ON a.id = ast.accessory_id
          WHERE a.status = 1
          GROUP BY a.id
          HAVING total_quantity <= ${threshold}
          ORDER BY total_quantity ASC
        `;
      }

      const [accessories] = await this.executeQuery(query);
      return accessories;
    } catch (error) {
      log.error('获取库存预警失败:', error);
      throw error;
    }
  }
}

module.exports = AccessoryRepository;
