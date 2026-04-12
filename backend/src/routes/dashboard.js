const express = require('express');
const router = express.Router();
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const { getDatabase, isConnected } = require('../config/database');
const ApiResponse = require('../utils/response');
const DashboardService = require('../services/dashboard.service');
const log = require('../utils/log');

const dashboardService = new DashboardService();

// 获取仪表盘数据
router.get('/', unifiedAuth, requirePermission('dashboard:view'), async (req, res) => {
  try {
    if (!isConnected()) {
      log.debug('数据库未连接，返回token中的用户信息');
      return ApiResponse.success(res, {
        user: {
          id: req.user.id,
          username: req.user.username,
          name: req.user.name,
          phone: '',
          email: '',
          role: req.user.role,
          last_login: new Date().toISOString()
        }
      });
    }

    const database = getDatabase();

    // 获取统计数据
    const [userCount] = await database.execute('SELECT COUNT(*) as count FROM users WHERE status = 1');
    const [accessoryCount] = await database.execute('SELECT COUNT(*) as count FROM accessories WHERE status = 1');
    const [customerCount] = await database.execute('SELECT COUNT(*) as count FROM customers WHERE status = 1');

    // 获取库存手机数量（用于仪表盘"库存商品"显示）
    const [phoneStockCount] = await database.execute(`
      SELECT COUNT(*) as count
      FROM phones
      WHERE status = 'in_stock' AND supplier_id IS NOT NULL
    `);

    // 获取今日销售金额（包括手机零售、配件销售和批发销售）
    // 1. 手机零售销售
    const [todayRetailSalesAmount] = await database.execute(`
      SELECT COALESCE(SUM(sale_price), 0) as amount
      FROM phones
      WHERE DATE(salestime) = CURDATE() AND status = 'sold'
    `);

    // 2. 配件销售
    const [todayAccessorySalesAmount] = await database.execute(`
      SELECT COALESCE(SUM(total_price), 0) as amount
      FROM accessory_sales
      WHERE DATE(created_at) = CURDATE()
    `);

    // 3. 批发销售（从 sales 表中获取 sale_type = 'wholesale' 的记录）
    const [todayWholesaleSalesAmount] = await database.execute(`
      SELECT COALESCE(SUM(price), 0) as amount
      FROM sales
      WHERE DATE(sale_date) = CURDATE() AND sale_type = 'wholesale'
    `);

    const totalTodaySales = parseFloat(todayRetailSalesAmount[0].amount || 0) +
                            parseFloat(todayAccessorySalesAmount[0].amount || 0) +
                            parseFloat(todayWholesaleSalesAmount[0].amount || 0);

    // 调试：查询最近的销售记录来诊断问题
    const [recentPhoneSales] = await database.execute(`
      SELECT id, sale_price, salestime, status
      FROM phones
      WHERE status = 'sold'
      ORDER BY salestime DESC
      LIMIT 5
    `);

    // 调试：查询今日批发销售
    const [recentWholesaleSales] = await database.execute(`
      SELECT id, phone_id, price, sale_date, sale_type
      FROM sales
      WHERE DATE(sale_date) = CURDATE() AND sale_type = 'wholesale'
      ORDER BY sale_date DESC
      LIMIT 5
    `);

    log.debug('📊 今日销售统计:', {
      手机零售金额: todayRetailSalesAmount[0].amount,
      配件销售金额: todayAccessorySalesAmount[0].amount,
      批发销售金额: todayWholesaleSalesAmount[0].amount,
      总销售金额: totalTodaySales,
      当前日期: new Date().toISOString().split('T')[0],
      CURDATE: 'CURDATE()',
      最近手机销售: recentPhoneSales.map(p => ({
        id: p.id,
        价格: p.sale_price,
        销售时间: p.salestime,
        日期部分: p.salestime ? p.salestime.toString().split('T')[0] : null,
        状态: p.status
      })),
      今日批发记录: recentWholesaleSales.map(s => ({
        id: s.id,
        phone_id: s.phone_id,
        价格: s.price,
        销售日期: s.sale_date,
        类型: s.sale_type
      }))
    });

    const [todaySalesCount] = await database.execute(
      'SELECT COUNT(*) as count FROM accessory_sales WHERE DATE(created_at) = CURDATE()'
    );

    // 获取最近销售记录
    const [recentSales] = await database.execute(`
      SELECT asl.*, acc.name as accessory_name, c.name as customer_name, u.name as operator_name
      FROM accessory_sales asl
      LEFT JOIN accessories acc ON asl.accessory_id = acc.id
      LEFT JOIN customers c ON asl.customer_id = c.id
      LEFT JOIN users u ON asl.operator_id = u.id
      ORDER BY asl.created_at DESC
      LIMIT 5
    `);

    ApiResponse.success(res, {
      stats: {
        users: userCount[0].count,
        accessories: accessoryCount[0].count,
        customers: customerCount[0].count,
        todaySales: todaySalesCount[0].count,
        todaySalesAmount: totalTodaySales,
        phones: {
          in_stock: phoneStockCount[0].count
        }
      },
      recentSales
    });

  } catch (error) {
    log.error('获取仪表盘数据失败:', error);
    ApiResponse.error(res, '获取仪表盘数据失败', 500);
  }
});

/**
 * 获取综合预警信息
 * 包含：手机库存预警、配件库存预警、销售预警、入库预警
 * 查询参数：
 * - phoneThreshold: 手机库存预警阈值（默认3）
 * - limit: 返回数量限制（默认10）
 */
router.get('/warnings/comprehensive', unifiedAuth, requirePermission('dashboard:view'), async (req, res) => {
  try {
    const { phoneThreshold, limit } = req.query;
    const result = await dashboardService.getComprehensiveWarnings({ phoneThreshold, limit });

    if (result.success) {
      ApiResponse.success(res, result.data);
    } else {
      ApiResponse.error(res, result.message, 400);
    }
  } catch (error) {
    log.error('获取综合预警失败:', error);
    ApiResponse.error(res, '获取综合预警失败', 500);
  }
});

/**
 * 获取手机库存预警
 * 按型号、颜色、内存分组，显示库存低于阈值的机型
 * 查询参数：
 * - threshold: 预警阈值（默认3）
 * - limit: 返回数量限制（默认20）
 */
router.get('/warnings/phones', unifiedAuth, requirePermission('dashboard:view'), async (req, res) => {
  try {
    const { threshold, limit } = req.query;
    const result = await dashboardService.getPhoneStockWarnings({ threshold, limit });

    if (result.success) {
      ApiResponse.success(res, result.data);
    } else {
      ApiResponse.error(res, result.message, 400);
    }
  } catch (error) {
    log.error('获取手机库存预警失败:', error);
    ApiResponse.error(res, '获取手机库存预警失败', 500);
  }
});

/**
 * 获取机型库存预警详情
 * 包含全新机/二手机数量、价格区间等信息
 * 查询参数：
 * - threshold: 预警阈值（默认3）
 */
router.get('/warnings/models', unifiedAuth, requirePermission('dashboard:view'), async (req, res) => {
  try {
    const { threshold } = req.query;
    const result = await dashboardService.getModelStockWarnings({ threshold });

    if (result.success) {
      ApiResponse.success(res, result.data);
    } else {
      ApiResponse.error(res, result.message, 400);
    }
  } catch (error) {
    log.error('获取机型库存预警失败:', error);
    ApiResponse.error(res, '获取机型库存预警失败', 500);
  }
});

/**
 * 获取销售预警信息
 * 包含今日销售统计、近7天销售趋势
 */
router.get('/warnings/sales', unifiedAuth, requirePermission('dashboard:view'), async (req, res) => {
  try {
    const result = await dashboardService.getSalesWarnings();

    if (result.success) {
      ApiResponse.success(res, result.data);
    } else {
      ApiResponse.error(res, result.message, 400);
    }
  } catch (error) {
    log.error('获取销售预警失败:', error);
    ApiResponse.error(res, '获取销售预警失败', 500);
  }
});

/**
 * 获取入库预警信息
 * 包含最近入库记录、长期未入库的供应商
 */
router.get('/warnings/purchases', unifiedAuth, requirePermission('dashboard:view'), async (req, res) => {
  try {
    const result = await dashboardService.getPurchaseWarnings();

    if (result.success) {
      ApiResponse.success(res, result.data);
    } else {
      ApiResponse.error(res, result.message, 400);
    }
  } catch (error) {
    log.error('获取入库预警失败:', error);
    ApiResponse.error(res, '获取入库预警失败', 500);
  }
});

module.exports = router;
