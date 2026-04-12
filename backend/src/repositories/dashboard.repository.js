/**
 * 仪表板数据访问层
 * 处理所有仪表板相关的数据库操作
 */
const BaseRepository = require('./base.repository');
const { ensurePhoneStockWarningSchema } = require('../utils/phone-stock-warning-schema');
const log = require('../utils/log');

class DashboardRepository extends BaseRepository {
  constructor() {
    super('dashboards');
  }

  buildWarningSpecificitySql(alias) {
    return `
      (
        CASE WHEN ${alias}.color_id IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN ${alias}.memory_id IS NOT NULL THEN 1 ELSE 0 END
      )
    `;
  }

  buildPhoneInventoryAggregateSql() {
    return `
      SELECT
        p.brand_id,
        p.model_id,
        p.color_id,
        p.memory_id,
        COUNT(*) as total_stock,
        SUM(CASE WHEN p.is_new = 1 THEN 1 ELSE 0 END) as new_count,
        SUM(CASE WHEN p.is_new = 0 THEN 1 ELSE 0 END) as used_count,
        GROUP_CONCAT(p.imei ORDER BY p.id SEPARATOR ', ') as imeis,
        MIN(p.purchase_cost) as min_cost,
        MAX(p.purchase_cost) as max_cost,
        AVG(p.purchase_cost) as avg_cost
      FROM phones p
      WHERE p.status = 'in_stock'
        AND p.supplier_id IS NOT NULL
      GROUP BY p.brand_id, p.model_id, p.color_id, p.memory_id
    `;
  }

  buildWarningCandidatesSql() {
    const inventoryAggregateSql = this.buildPhoneInventoryAggregateSql();
    const specificitySql = this.buildWarningSpecificitySql('psw');

    return `
      (
        SELECT
          psw.id as config_id,
          psw.brand_id,
          psw.model_id,
          psw.color_id,
          psw.memory_id,
          psw.is_new,
          psw.min_stock,
          psw.warning_enabled,
          ${specificitySql} as specificity
        FROM phone_stock_warnings psw
        WHERE psw.status = 1
          AND psw.warning_enabled = 1
          AND psw.color_id IS NOT NULL
          AND psw.memory_id IS NOT NULL
        UNION ALL
        SELECT
          psw.id as config_id,
          psw.brand_id,
          psw.model_id,
          COALESCE(psw.color_id, inv.color_id) as color_id,
          COALESCE(psw.memory_id, inv.memory_id) as memory_id,
          psw.is_new,
          psw.min_stock,
          psw.warning_enabled,
          ${specificitySql} as specificity
        FROM phone_stock_warnings psw
        INNER JOIN (${inventoryAggregateSql}) inv ON
          inv.brand_id = psw.brand_id AND
          inv.model_id = psw.model_id AND
          (psw.color_id = inv.color_id OR psw.color_id IS NULL) AND
          (psw.memory_id = inv.memory_id OR psw.memory_id IS NULL)
        WHERE psw.status = 1
          AND psw.warning_enabled = 1
          AND (psw.color_id IS NULL OR psw.memory_id IS NULL)
      )
    `;
  }

  /**
   * 获取仪表板统计数据
   * 优化：使用 Promise.all 并行执行多个独立查询，显著提升响应速度
   */
  async getDashboardStats() {
    try {
      const stats = {};

      // 并行执行所有独立的统计查询，避免串行等待
      const [
        userCount,
        accessoryCount,
        customerCount,
        todaySales,
        phoneStats,
        supplierCount,
        storeCount,
        brandCount
      ] = await Promise.all([
        this.executeQuery('SELECT COUNT(*) as count FROM users WHERE status = 1'),
        this.executeQuery('SELECT COUNT(*) as count FROM accessories WHERE status = 1'),
        this.executeQuery('SELECT COUNT(*) as count FROM customers WHERE status = 1'),
        this.executeQuery('SELECT COUNT(*) as count FROM accessory_sales WHERE DATE(created_at) = CURDATE()'),
        this.executeQuery(`
          SELECT
            COUNT(*) as total_phones,
            COUNT(CASE WHEN status = 1 THEN 1 END) as in_stock,
            COUNT(CASE WHEN is_new = 1 THEN 1 END) as new_phones,
            COUNT(CASE WHEN is_new = 0 THEN 1 END) as used_phones,
            SUM(CASE WHEN status = 1 THEN purchase_unit_price ELSE 0 END) as total_cost,
            SUM(CASE WHEN status = 1 THEN price ELSE 0 END) as total_value
          FROM phones
        `),
        this.executeQuery('SELECT COUNT(*) as count FROM suppliers WHERE status = 1'),
        this.executeQuery('SELECT COUNT(*) as count FROM stores WHERE status = 1'),
        this.executeQuery('SELECT COUNT(*) as count FROM brands WHERE status = 1')
      ]);

      stats.users = userCount[0].count;
      stats.accessories = accessoryCount[0].count;
      stats.customers = customerCount[0].count;
      stats.todaySales = todaySales[0].count;
      stats.phones = phoneStats[0];
      stats.suppliers = supplierCount[0].count;
      stats.stores = storeCount[0].count;
      stats.brands = brandCount[0].count;

      return stats;
    } catch (error) {
      log.error('获取仪表板统计数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取最近销售记录
   */
  async getRecentSales(limit = 5) {
    try {
      const query = `
        SELECT
          asl.*,
          acc.name as accessory_name,
          c.name as customer_name,
          u.name as operator_name,
          st.name as store_name
        FROM accessory_sales asl
        LEFT JOIN accessories acc ON asl.accessory_id = acc.id
        LEFT JOIN customers c ON asl.customer_id = c.id
        LEFT JOIN users u ON asl.operator_id = u.id
        LEFT JOIN stores st ON asl.store_id = st.id
        ORDER BY asl.created_at DESC
        LIMIT ?
      `;

      const recentSales = await this.executeQuery(query, [limit]);
      return recentSales;
    } catch (error) {
      log.error('获取最近销售记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取库存预警（配件）
   */
  async getStockWarnings(limit = 5) {
    try {
      const query = `
        SELECT
          id,
          name,
          stock,
          min_stock,
          CASE
            WHEN stock = 0 THEN '已缺货'
            WHEN stock <= min_stock THEN '库存不足'
            ELSE '库存正常'
          END as status
        FROM accessories
        WHERE stock <= min_stock AND status = 1
        ORDER BY stock ASC
        LIMIT ?
      `;

      const stockWarnings = await this.executeQuery(query, [limit]);
      return stockWarnings;
    } catch (error) {
      log.error('获取库存预警失败:', error);
      throw error;
    }
  }

  /**
   * 获取手机库存预警（支持自定义阈值）
   * 按型号、颜色、内存分组统计，使用配置的预警值进行判断
   * 优先级：型号级配置 > 品牌级配置 > 全局配置
   */
  async getPhoneStockWarnings(threshold = 3, limit = 20) {
    try {
      await ensurePhoneStockWarningSchema();

      const inventoryAggregateSql = this.buildPhoneInventoryAggregateSql();
      const warningCandidatesSql = this.buildWarningCandidatesSql();
      const betterSpecificitySql = this.buildWarningSpecificitySql('psw2');

      const query = `
        SELECT
          candidate.brand_id,
          br.name as brand_name,
          candidate.model_id,
          m.name as model_name,
          candidate.color_id,
          c.name as color_name,
          candidate.memory_id,
          mem.size as memory_name,
          CASE
            WHEN candidate.is_new = 1 THEN COALESCE(inv.new_count, 0)
            WHEN candidate.is_new = 0 THEN COALESCE(inv.used_count, 0)
            ELSE COALESCE(inv.total_stock, 0)
          END as stock_count,
          COALESCE(inv.new_count, 0) as new_count,
          COALESCE(inv.used_count, 0) as used_count,
          inv.imeis,
          candidate.min_stock as warning_threshold,
          candidate.warning_enabled,
          candidate.is_new as warning_condition,
          CASE
            WHEN candidate.is_new = 1 THEN '全新'
            WHEN candidate.is_new = 0 THEN '二手'
            ELSE '全部'
          END as condition_label
        FROM ${warningCandidatesSql} candidate
        LEFT JOIN (${inventoryAggregateSql}) inv ON
          inv.brand_id = candidate.brand_id AND
          inv.model_id = candidate.model_id AND
          (inv.color_id <=> candidate.color_id) AND
          (inv.memory_id <=> candidate.memory_id)
        LEFT JOIN brands br ON candidate.brand_id = br.id
        LEFT JOIN models m ON candidate.model_id = m.id
        LEFT JOIN colors c ON candidate.color_id = c.id
        LEFT JOIN memories mem ON candidate.memory_id = mem.id
        WHERE (
          CASE
            WHEN candidate.is_new = 1 THEN COALESCE(inv.new_count, 0)
            WHEN candidate.is_new = 0 THEN COALESCE(inv.used_count, 0)
            ELSE COALESCE(inv.total_stock, 0)
          END
        ) <= candidate.min_stock
          AND NOT EXISTS (
            SELECT 1
            FROM phone_stock_warnings psw2
            WHERE psw2.brand_id = candidate.brand_id
              AND psw2.model_id = candidate.model_id
              AND (psw2.color_id = candidate.color_id OR psw2.color_id IS NULL)
              AND (psw2.memory_id = candidate.memory_id OR psw2.memory_id IS NULL)
              AND psw2.is_new <=> candidate.is_new
              AND psw2.status = 1
              AND psw2.warning_enabled = 1
              AND (
                ${betterSpecificitySql} > candidate.specificity
                OR (${betterSpecificitySql} = candidate.specificity AND psw2.id > candidate.config_id)
              )
          )
        ORDER BY stock_count ASC, br.name, m.name, c.name, mem.size, candidate.is_new DESC
        LIMIT ?
      `;

      const phoneWarnings = await this.executeQuery(query, [limit]);
      return phoneWarnings;
    } catch (error) {
      log.error('获取手机库存预警失败:', error);
      throw error;
    }
  }

  /**
   * 获取手机库存统计（概览）
   * 用于仪表盘显示各型号库存情况
   */
  async getPhoneStockSummary() {
    try {
      const query = `
        SELECT
          br.name as brand_name,
          m.name as model_name,
          COUNT(*) as total_count,
          SUM(CASE WHEN p.status = 'in_stock' THEN 1 ELSE 0 END) as in_stock_count,
          SUM(CASE WHEN p.status = 'sold' THEN 1 ELSE 0 END) as sold_count,
          SUM(CASE WHEN p.status = 'peer_transfer' THEN 1 ELSE 0 END) as wholesale_count,
          SUM(CASE WHEN p.status = 'supplier_proxy' THEN 1 ELSE 0 END) as transfer_count
        FROM phones p
        LEFT JOIN brands br ON p.brand_id = br.id
        LEFT JOIN models m ON p.model_id = m.id
        WHERE p.supplier_id IS NOT NULL
        GROUP BY br.name, m.name
        ORDER BY in_stock_count ASC, total_count DESC
      `;

      const stockSummary = await this.executeQuery(query);
      return stockSummary;
    } catch (error) {
      log.error('获取手机库存统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取今日销售统计
   * 用于显示今日销售情况预警
   */
  async getTodaySalesWarnings() {
    try {
      const query = `
        SELECT
          COUNT(*) as sales_count,
          SUM(p.sale_price) as total_amount,
          SUM(p.sale_price - p.purchase_cost) as total_profit,
          COUNT(DISTINCT p.sale_operator_id) as operator_count
        FROM phones p
        WHERE DATE(p.salestime) = CURDATE()
          AND p.status = 'sold'
      `;

      const [result] = await this.executeQuery(query);
      return result || { sales_count: 0, total_amount: 0, total_profit: 0, operator_count: 0 };
    } catch (error) {
      log.error('获取今日销售预警失败:', error);
      throw error;
    }
  }

  /**
   * 获取近7天销售预警
   * 对比上周同期，显示销售趋势
   */
  async getSalesTrendWarnings() {
    try {
      const query = `
        SELECT
          DATE(p.salestime) as sale_date,
          COUNT(*) as sales_count,
          SUM(p.sale_price) as total_amount
        FROM phones p
        WHERE p.salestime >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
          AND p.status = 'sold'
        GROUP BY DATE(p.salestime)
        ORDER BY sale_date DESC
      `;

      const trends = await this.executeQuery(query);
      return trends;
    } catch (error) {
      log.error('获取销售趋势预警失败:', error);
      throw error;
    }
  }

  /**
   * 获取入库预警
   * 显示最近入库情况和长期未入库的供应商
   */
  async getPurchaseWarnings() {
    try {
      // 最近7天入库统计
      const recentPurchaseQuery = `
        SELECT
          DATE(p.Inventorytime) as purchase_date,
          COUNT(*) as purchase_count,
          s.name as supplier_name
        FROM phones p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE DATE(p.Inventorytime) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
          AND p.supplier_id IS NOT NULL
          AND p.Inventorytime IS NOT NULL
        GROUP BY DATE(p.Inventorytime), s.name
        ORDER BY purchase_date DESC, purchase_count DESC
      `;

      const recentPurchases = await this.executeQuery(recentPurchaseQuery);

      // 长期未入库的供应商（超过7天未进货）
      const noPurchaseQuery = `
        SELECT
          s.id,
          s.name as supplier_name,
          MAX(p.Inventorytime) as last_purchase_date,
          DATEDIFF(CURDATE(), MAX(p.Inventorytime)) as days_since_purchase
        FROM suppliers s
        LEFT JOIN phones p ON s.id = p.supplier_id
          AND p.Inventorytime IS NOT NULL
        WHERE s.status = 1
        GROUP BY s.id, s.name
        HAVING days_since_purchase > 7 OR last_purchase_date IS NULL
        ORDER BY days_since_purchase DESC
      `;

      const noPurchases = await this.executeQuery(noPurchaseQuery);

      return {
        recent: recentPurchases,
        noRecent: noPurchases
      };
    } catch (error) {
      log.error('获取入库预警失败:', error);
      throw error;
    }
  }

  /**
   * 获取机型库存预警详情（支持自定义阈值）
   * 按品牌+型号+颜色+内存维度，显示库存低于预警值的机型
   * 只显示有配置预警的型号，没有配置的不会出现在列表中
   */
  async getModelStockWarnings(threshold = 3, limit = 20) {
    try {
      await ensurePhoneStockWarningSchema();

      const inventoryAggregateSql = this.buildPhoneInventoryAggregateSql();
      const warningCandidatesSql = this.buildWarningCandidatesSql();
      const betterSpecificitySql = this.buildWarningSpecificitySql('psw2');

      const query = `
        SELECT
          candidate.brand_id,
          br.name as brand_name,
          candidate.model_id,
          m.name as model_name,
          candidate.color_id,
          c.name as color_name,
          candidate.memory_id,
          mem.size as memory_name,
          CASE
            WHEN candidate.is_new = 1 THEN COALESCE(inv.new_count, 0)
            WHEN candidate.is_new = 0 THEN COALESCE(inv.used_count, 0)
            ELSE COALESCE(inv.total_stock, 0)
          END as stock_count,
          COALESCE(inv.new_count, 0) as new_count,
          COALESCE(inv.used_count, 0) as used_count,
          inv.min_cost,
          inv.max_cost,
          inv.avg_cost,
          candidate.min_stock as warning_threshold,
          candidate.warning_enabled,
          candidate.is_new as warning_condition,
          CASE
            WHEN candidate.is_new = 1 THEN '全新'
            WHEN candidate.is_new = 0 THEN '二手'
            ELSE '全部'
          END as condition_label
        FROM ${warningCandidatesSql} candidate
        LEFT JOIN (${inventoryAggregateSql}) inv ON
          inv.brand_id = candidate.brand_id AND
          inv.model_id = candidate.model_id AND
          (inv.color_id <=> candidate.color_id) AND
          (inv.memory_id <=> candidate.memory_id)
        LEFT JOIN brands br ON candidate.brand_id = br.id
        LEFT JOIN models m ON candidate.model_id = m.id
        LEFT JOIN colors c ON candidate.color_id = c.id
        LEFT JOIN memories mem ON candidate.memory_id = mem.id
        WHERE (
          CASE
            WHEN candidate.is_new = 1 THEN COALESCE(inv.new_count, 0)
            WHEN candidate.is_new = 0 THEN COALESCE(inv.used_count, 0)
            ELSE COALESCE(inv.total_stock, 0)
          END
        ) <= candidate.min_stock
          AND NOT EXISTS (
            SELECT 1
            FROM phone_stock_warnings psw2
            WHERE psw2.brand_id = candidate.brand_id
              AND psw2.model_id = candidate.model_id
              AND (psw2.color_id = candidate.color_id OR psw2.color_id IS NULL)
              AND (psw2.memory_id = candidate.memory_id OR psw2.memory_id IS NULL)
              AND psw2.is_new <=> candidate.is_new
              AND psw2.status = 1
              AND psw2.warning_enabled = 1
              AND (
                ${betterSpecificitySql} > candidate.specificity
                OR (${betterSpecificitySql} = candidate.specificity AND psw2.id > candidate.config_id)
              )
          )
        ORDER BY stock_count ASC, br.name, m.name, c.name, mem.size, candidate.is_new DESC
        LIMIT ?
      `;

      const warnings = await this.executeQuery(query, [limit]);
      return warnings;
    } catch (error) {
      log.error('获取机型库存预警失败:', error);
      throw error;
    }
  }

  /**
   * 获取综合预警信息
   * 汇总所有预警类型，用于仪表盘显示
   * 注意：暂时移除配件预警，等后续需要时再加
   */
  async getComprehensiveWarnings(options = {}) {
    try {
      const {
        phoneThreshold = 3,
        limit = 10
      } = options;

      // 并行获取各类预警数据（移除配件预警 accessoryWarnings）
      const [
        phoneWarnings,
        todaySales,
        salesTrend,
        purchaseWarnings,
        modelWarnings
      ] = await Promise.all([
        this.getPhoneStockWarnings(phoneThreshold, limit),
        this.getTodaySalesWarnings(),
        this.getSalesTrendWarnings(),
        this.getPurchaseWarnings(),
        this.getModelStockWarnings(phoneThreshold, limit)
      ]);

      return {
        phones: {
          warnings: phoneWarnings,
          threshold: phoneThreshold,
          count: phoneWarnings.length
        },
        // 暂时移除配件预警
        // accessories: {
        //   warnings: [],
        //   count: 0
        // },
        sales: {
          today: todaySales,
          trend: salesTrend,
          avgDailySales: salesTrend.length > 0
            ? Math.round(salesTrend.reduce((sum, t) => sum + (t.sales_count || 0), 0) / salesTrend.length)
            : 0
        },
        purchases: purchaseWarnings,
        models: {
          warnings: modelWarnings,
          count: modelWarnings.length
        },
        summary: {
          totalWarnings: phoneWarnings.length + modelWarnings.length,
          hasWarnings: (phoneWarnings.length + modelWarnings.length) > 0,
          note: '配件预警功能暂未启用'
        }
      };
    } catch (error) {
      log.error('获取综合预警失败:', error);
      throw error;
    }
  }

  /**
   * 获取销售趋势数据（最近7天）
   */
  async getSalesTrends(days = 7) {
    try {
      const query = `
        SELECT
          DATE(created_at) as date,
          COUNT(*) as sales_count,
          SUM(total_price) as total_amount,
          SUM(profit) as total_profit
        FROM accessory_sales
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;

      const salesTrends = await this.executeQuery(query, [days]);
      return salesTrends;
    } catch (error) {
      log.error('获取销售趋势数据失败:', error);
      throw error;
    }
  }

  
  /**
   * 获取热销产品排行
   */
  async getTopSellingProducts(limit = 10) {
    try {
      const query = `
        SELECT
          acc.id,
          acc.name,
          acc.category,
          SUM(asl.quantity) as total_sold,
          SUM(asl.total_price) as total_revenue,
          COUNT(DISTINCT asl.customer_id) as customer_count
        FROM accessory_sales asl
        LEFT JOIN accessories acc ON asl.accessory_id = acc.id
        WHERE asl.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY asl.accessory_id, acc.id, acc.name, acc.category
        ORDER BY total_sold DESC
        LIMIT ?
      `;

      const topProducts = await this.executeQuery(query, [limit]);
      return topProducts;
    } catch (error) {
      log.error('获取热销产品排行失败:', error);
      throw error;
    }
  }

  /**
   * 获取员工绩效排行
   */
  async getTopEmployees(limit = 10) {
    try {
      const query = `
        SELECT
          u.id,
          u.username,
          u.name,
          COUNT(DISTINCT asl.id) as sales_count,
          SUM(asl.total_price) as total_revenue
        FROM accessory_sales asl
        LEFT JOIN users u ON asl.operator_id = u.id
        WHERE asl.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY asl.operator_id, u.id, u.username, u.name
        ORDER BY total_revenue DESC
        LIMIT ?
      `;

      const topEmployees = await this.executeQuery(query, [limit]);
      return topEmployees;
    } catch (error) {
      log.error('获取员工绩效排行失败:', error);
      throw error;
    }
  }

  /**
   * 获取分类销售统计
   */
  async getCategorySalesStats() {
    try {
      const query = `
        SELECT
          acc.category,
          COUNT(DISTINCT asl.id) as sales_count,
          SUM(asl.quantity) as total_quantity,
          SUM(asl.total_price) as total_revenue
        FROM accessory_sales asl
        LEFT JOIN accessories acc ON asl.accessory_id = acc.id
        WHERE asl.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY acc.category
        ORDER BY total_revenue DESC
      `;

      const categoryStats = await this.executeQuery(query);
      return categoryStats;
    } catch (error) {
      log.error('获取分类销售统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取菜单列表
   */
  async getMenus() {
    try {
      const query = 'SELECT * FROM menus ORDER BY sort_order ASC, id ASC';
      const menus = await this.executeQuery(query);

      // 确保返回的数据格式正确
      const formattedMenus = menus.map(menu => ({
        ...menu,
        is_active: Boolean(menu.is_active) // 转换为布尔值
      }));

      return formattedMenus;
    } catch (error) {
      log.error('获取菜单列表失败:', error);
      throw error;
    }
  }
}

module.exports = DashboardRepository;
