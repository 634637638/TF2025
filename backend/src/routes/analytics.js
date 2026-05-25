const express = require('express');
const router = express.Router();
const { unifiedAuth, requireBusinessUser } = require('../middleware/unified-auth');
const ApiResponse = require('../utils/response');
const { getDatabase, isConnected } = require('../config/database');
const SalaryCalculatorService = require('../services/salary-calculator.service');
const { getBeijingTimeString } = require('../utils/time');
const DashboardRepository = require('../repositories/dashboard.repository');
const log = require('../utils/log');

const dashboardRepository = new DashboardRepository();

// 模拟性能分析数据
const mockPerformanceData = {
  fcp: 1200, // First Contentful Paint (ms)
  tti: 2500, // Time to Interactive (ms)
  cls: 0.1, // Cumulative Layout Shift
  fid: 80,   // First Input Delay (ms)
  lcp: 1800, // Largest Contentful Paint (ms)
  apiLatency: {
    average: 150,
    p95: 300,
    p99: 500
  }
};

// 记录性能数据
router.post('/performance', unifiedAuth, requireBusinessUser, (req, res) => {
  try {
    const { fcp, tti, cls, fid, lcp, url, userAgent, timestamp } = req.body;

    // 模拟保存性能数据到数据库
    const performanceRecord = {
      id: Date.now().toString(),
      fcp: fcp || mockPerformanceData.fcp,
      tti: tti || mockPerformanceData.tti,
      cls: cls || mockPerformanceData.cls,
      fid: fid || mockPerformanceData.fid,
      lcp: lcp || mockPerformanceData.lcp,
      url: url || window?.location?.href || 'unknown',
      userAgent: userAgent || req.headers['user-agent'] || 'unknown',
      timestamp: timestamp || new Date().toISOString(),
      ip: req.ip || req.connection.remoteAddress || 'unknown'
    };

    log.debug('记录性能数据:', performanceRecord);

    // 计算性能评分
    const score = calculatePerformanceScore(performanceRecord);

    ApiResponse.success(res, {
      record: performanceRecord,
      score,
      message: '性能数据记录成功'
    });
  } catch (error) {
    log.error('记录性能数据失败:', error);
    ApiResponse.serverError(res, '记录性能数据失败', error);
  }
});

// 获取性能统计
router.get('/performance/stats', unifiedAuth, requireBusinessUser, (req, res) => {
  try {
    const { startDate, endDate, url } = req.query;

    // 模拟从数据库获取统计数据
    const stats = {
      totalRecords: 1250,
      averageMetrics: {
        fcp: { value: 1180, trend: 'improving' },
        tti: { value: 2450, trend: 'stable' },
        cls: { value: 0.12, trend: 'degrading' },
        fid: { value: 75, trend: 'improving' },
        lcp: { value: 1750, trend: 'stable' }
      },
      performanceDistribution: {
        excellent: 450,  // 90-100分
        good: 620,       // 75-89分
        needsImprovement: 150, // 50-74分
        poor: 30         // 0-49分
      },
      topSlowPages: [
        { url: '/dashboard', avgLoadTime: 3200, visits: 145 },
        { url: '/sales', avgLoadTime: 2800, visits: 98 },
        { url: '/inventory', avgLoadTime: 2400, visits: 67 }
      ]
    };

    ApiResponse.success(res, stats);
  } catch (error) {
    log.error('获取性能统计失败:', error);
    ApiResponse.serverError(res, '获取性能统计失败', error);
  }
});

// 获取性能优化建议
router.get('/performance/recommendations', unifiedAuth, requireBusinessUser, (req, res) => {
  try {
    const recommendations = [
      {
        category: 'images',
        title: '优化图片加载',
        description: '压缩图片文件大小，使用现代图片格式如WebP',
        impact: 'high',
        effort: 'medium'
      },
      {
        category: 'javascript',
        title: '减少JavaScript执行时间',
        description: '移除未使用的代码，优化bundle大小',
        impact: 'medium',
        effort: 'low'
      },
      {
        category: 'css',
        title: '优化CSS渲染',
        description: '避免使用复杂的CSS选择器，减少重排重绘',
        impact: 'medium',
        effort: 'low'
      },
      {
        category: 'network',
        title: '启用资源缓存',
        description: '设置合适的缓存策略，使用CDN加速',
        impact: 'high',
        effort: 'low'
      }
    ];

    ApiResponse.success(res, recommendations);
  } catch (error) {
    log.error('获取性能优化建议失败:', error);
    ApiResponse.serverError(res, '获取性能优化建议失败', error);
  }
});

// 计算性能评分
function calculatePerformanceScore(metrics) {
  let score = 100;

  // FCP (First Contentful Paint) - 1000ms以下满分
  if (metrics.fcp > 1000) {
    score -= Math.min(20, (metrics.fcp - 1000) / 50);
  }

  // TTI (Time to Interactive) - 3800ms以下满分
  if (metrics.tti > 3800) {
    score -= Math.min(20, (metrics.tti - 3800) / 100);
  }

  // CLS (Cumulative Layout Shift) - 0.1以下满分
  if (metrics.cls > 0.1) {
    score -= Math.min(20, (metrics.cls - 0.1) * 100);
  }

  // FID (First Input Delay) - 100ms以下满分
  if (metrics.fid > 100) {
    score -= Math.min(20, (metrics.fid - 100) / 5);
  }

  // LCP (Largest Contentful Paint) - 2500ms以下满分
  if (metrics.lcp > 2500) {
    score -= Math.min(20, (metrics.lcp - 2500) / 50);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function formatDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getProfitTrendGroupExpression(dateColumn, granularity) {
  switch (granularity) {
    case 'quarter':
      return `CONCAT(YEAR(${dateColumn}), '-Q', QUARTER(${dateColumn}))`;
    case 'year':
      return `DATE_FORMAT(${dateColumn}, '%Y')`;
    case 'month':
    default:
      return `DATE_FORMAT(${dateColumn}, '%Y-%m')`;
  }
}

function buildProfitTrendPeriods(granularity, anchorDate, count) {
  const periods = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    let start;
    let end;
    let key;
    let label;

    if (granularity === 'quarter') {
      const date = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - (offset * 3), 1);
      const quarter = Math.floor(date.getMonth() / 3);
      start = new Date(date.getFullYear(), quarter * 3, 1);
      end = new Date(date.getFullYear(), quarter * 3 + 3, 0);
      key = `${start.getFullYear()}-Q${quarter + 1}`;
      label = `${start.getFullYear()}年Q${quarter + 1}`;
    } else if (granularity === 'year') {
      const year = anchorDate.getFullYear() - offset;
      start = new Date(year, 0, 1);
      end = new Date(year, 11, 31);
      key = `${year}`;
      label = `${year}年`;
    } else {
      const date = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - offset, 1);
      start = new Date(date.getFullYear(), date.getMonth(), 1);
      end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      label = `${start.getFullYear()}年${start.getMonth() + 1}月`;
    }

    periods.push({
      key,
      label,
      startDate: formatDateString(start),
      endDate: formatDateString(end)
    });
  }

  return periods;
}

function getBeijingMonthRange(monthOffset = 0) {
  const beijingDate = getBeijingTimeString().slice(0, 10);
  const [year, month] = beijingDate.split('-').map(Number);
  const monthDate = new Date(year, (month - 1) + monthOffset, 1);
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

  return {
    monthKey: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
    startDate: formatDateString(start),
    endDate: formatDateString(end)
  };
}

function hasValidQueryValue(value) {
  return value !== undefined && value !== null && value !== '' && value !== 'undefined' && value !== 'null';
}

function parseOptionalInt(value) {
  if (!hasValidQueryValue(value)) {
    return null;
  }

  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildLatestSaleJoin({
  phoneAlias = 'p',
  joinType = 'LEFT JOIN',
  alias = 'latest_sale'
} = {}) {
  return `
    ${joinType} (
      SELECT s.phone_id, s.store_id, s.operator_id, s.sale_type, s.sale_date, s.id
      FROM sales s
      INNER JOIN (
        SELECT phone_id, MAX(id) AS max_id
        FROM sales
        GROUP BY phone_id
      ) latest_sales ON latest_sales.max_id = s.id
    ) ${alias} ON ${alias}.phone_id = ${phoneAlias}.id
  `;
}

function buildStoreFilterClause(storeId, {
  phoneAlias = 'p',
  saleAlias = 'latest_sale'
} = {}) {
  const normalizedStoreId = parseOptionalInt(storeId);

  if (!normalizedStoreId) {
    return {
      storeId: null,
      clause: '',
      params: []
    };
  }

  return {
    storeId: normalizedStoreId,
    clause: `AND COALESCE(${saleAlias}.store_id, ${phoneAlias}.store_id) = ?`,
    params: [normalizedStoreId]
  };
}

async function calculatePayrollSnapshot(db, periodStart, periodEnd) {
  const [employeeRows] = await db.execute(
    `SELECT id
     FROM users
     WHERE status = 1
       AND salary_template_id IS NOT NULL`
  );

  const summary = {
    totalSalary: 0,
    baseSalaryTotal: 0,
    commissionTotal: 0,
    overtimePayTotal: 0,
    deductionTotal: 0,
    templateEmployeeCount: employeeRows.length,
    calculatedEmployeeCount: 0,
    failedEmployeeCount: 0
  };

  if (employeeRows.length === 0) {
    return summary;
  }

  const results = await SalaryCalculatorService.batchCalculateSalary(
    employeeRows.map((row) => row.id),
    periodStart,
    periodEnd,
    {
      logExpectedErrors: false
    }
  );

  results.forEach((result) => {
    if (!result.success || !result.data) {
      summary.failedEmployeeCount += 1;
      return;
    }

    const salaryData = result.data;
    const baseSalary = parseFloat(salaryData.base_salary) || 0;
    const commissionAmount = parseFloat(salaryData.commission_amount) || 0;
    const overtimePay = parseFloat(salaryData.overtime_pay) || 0;
    const deductionAmount = (parseFloat(salaryData.leave_deduction) || 0) + (parseFloat(salaryData.other_deduction) || 0);

    summary.baseSalaryTotal += baseSalary;
    summary.commissionTotal += commissionAmount;
    summary.overtimePayTotal += overtimePay;
    summary.deductionTotal += deductionAmount;
    summary.totalSalary += baseSalary + commissionAmount + overtimePay - deductionAmount;
    summary.calculatedEmployeeCount += 1;
  });

  return {
    totalSalary: Math.round(summary.totalSalary * 100) / 100,
    baseSalaryTotal: Math.round(summary.baseSalaryTotal * 100) / 100,
    commissionTotal: Math.round(summary.commissionTotal * 100) / 100,
    overtimePayTotal: Math.round(summary.overtimePayTotal * 100) / 100,
    deductionTotal: Math.round(summary.deductionTotal * 100) / 100,
    templateEmployeeCount: summary.templateEmployeeCount,
    calculatedEmployeeCount: summary.calculatedEmployeeCount,
    failedEmployeeCount: summary.failedEmployeeCount
  };
}

// 记录页面访问
router.post('/pageview', unifiedAuth, requireBusinessUser, (req, res) => {
  try {
    const { url, referrer, userAgent, timestamp, sessionId } = req.body;

    // 模拟记录页面访问数据
    const pageviewRecord = {
      id: Date.now().toString(),
      url: url || '/',
      referrer: referrer || '',
      userAgent: userAgent || '',
      timestamp: timestamp || new Date().toISOString(),
      sessionId: sessionId || 'anonymous',
      ip: req.ip || req.connection.remoteAddress,
      visitedAt: new Date().toISOString()
    };

    log.debug(`页面访问记录: ${pageviewRecord.url} - ${pageviewRecord.ip}`);

    // 返回成功响应
    ApiResponse.success(res, {
      recorded: true,
      pageviewId: pageviewRecord.id,
      timestamp: pageviewRecord.timestamp
    }, '页面访问记录成功');

  } catch (error) {
    log.error('记录页面访问失败:', error);
    ApiResponse.serverError(res, '记录页面访问失败', error);
  }
});

// ==================== 销售分析相关API ====================

// 获取销售分析数据
router.get('/sales', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    const { startDate, endDate, storeId } = req.query;

    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();

    // 构建基础查询条件
    let whereConditions = ['so.order_status = "completed"'];
    let queryParams = [];

    if (startDate) {
      whereConditions.push('DATE(so.order_date) >= ?');
      queryParams.push(startDate);
    }
    if (endDate) {
      whereConditions.push('DATE(so.order_date) <= ?');
      queryParams.push(endDate);
    }
    if (storeId) {
      whereConditions.push('so.store_id = ?');
      queryParams.push(storeId);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 总销售额和订单数 - 使用 sales_orders 表
    const salesQuery = `
      SELECT
        COUNT(DISTINCT so.id) as totalOrders,
        SUM(so.final_amount) as totalSales,
        AVG(so.final_amount) as averageOrderValue,
        DATE(so.order_date) as date
      FROM sales_orders so
      ${whereClause}
      GROUP BY DATE(so.order_date)
      ORDER BY date DESC
      LIMIT 30
    `;

    // 按店铺销售分析
    const storeSalesQuery = `
      SELECT
        st.id,
        st.name,
        COUNT(DISTINCT so.id) as totalOrders,
        SUM(so.final_amount) as totalSales,
        AVG(so.final_amount) as averageOrderValue
      FROM stores st
      LEFT JOIN sales_orders so ON st.id = so.store_id AND so.order_status = 'completed'
      ${startDate || endDate ? 'WHERE ' + whereConditions.filter(c => !c.includes('store_id')).join(' AND ') : ''}
      GROUP BY st.id, st.name
      ORDER BY totalSales DESC
    `;

    // 热销产品 - 使用 sales 表关联 phones
    const topProductsQuery = `
      SELECT
        p.id,
        p.imei,
        m.name as model_name,
        b.name as brand_name,
        COUNT(s.id) as quantity,
        SUM(p.sale_price) as revenue
      FROM sales s
      JOIN phones p ON s.phone_id = p.id
      JOIN models m ON p.model_id = m.id
      JOIN brands b ON p.brand_id = b.id
      WHERE s.status = 'completed'
      ${startDate ? 'AND DATE(s.sale_date) >= ?' : ''}
      ${endDate ? 'AND DATE(s.sale_date) <= ?' : ''}
      GROUP BY p.id, m.name, b.name
      ORDER BY quantity DESC
      LIMIT 10
    `;

    const productParams = [];
    if (startDate) productParams.push(startDate);
    if (endDate) productParams.push(endDate);

    const [salesData, storeSales, topProducts] = await Promise.all([
      db.execute(salesQuery, queryParams),
      db.execute(storeSalesQuery, queryParams.filter(p => p != storeId)),
      db.execute(topProductsQuery, productParams)
    ]);

    // 计算环比/同比增长
    const calculateGrowth = (current, previous) => {
      if (!previous || previous === 0) return 0;
      return ((current - previous) / previous) * 100;
    };

    const totalSales = salesData[0].reduce((sum, item) => sum + parseFloat(item.totalSales || 0), 0);
    const totalOrders = salesData[0].reduce((sum, item) => sum + parseInt(item.totalOrders || 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    const result = {
      totalSales: {
        total: totalSales,
        change: calculateGrowth(totalSales, totalSales * 0.85),
        changePercent: calculateGrowth(totalSales, totalSales * 0.85),
        trend: totalSales > totalSales * 0.85 ? 'up' : 'down'
      },
      totalOrders: {
        total: totalOrders,
        change: calculateGrowth(totalOrders, totalOrders * 0.9),
        changePercent: calculateGrowth(totalOrders, totalOrders * 0.9),
        trend: totalOrders > totalOrders * 0.9 ? 'up' : 'down'
      },
      averageOrderValue: {
        total: averageOrderValue,
        change: calculateGrowth(averageOrderValue, averageOrderValue * 0.95),
        changePercent: calculateGrowth(averageOrderValue, averageOrderValue * 0.95),
        trend: 'stable'
      },
      topProducts: topProducts[0].map(item => ({
        ...item,
        growth: Math.random() * 20 - 5,
        stockStatus: 'in_stock'
      })),
      salesByStore: storeSales[0].map(item => ({
        ...item,
        performance: item.totalSales > 50000 ? 'excellent' :
                     item.totalSales > 20000 ? 'good' : 'average',
        growthRate: Math.random() * 15 - 5
      })),
      salesByPeriod: salesData[0].map(item => ({
        period: item.date,
        sales: parseFloat(item.totalSales || 0),
        orders: parseInt(item.totalOrders || 0),
        revenue: parseFloat(item.totalSales || 0),
        target: Math.random() * 10000 + 5000,
        achievement: (parseFloat(item.totalSales || 0) / (Math.random() * 10000 + 5000)) * 100
      }))
    };

    ApiResponse.success(res, result);
  } catch (error) {
    log.error('获取销售分析失败:', error);
    ApiResponse.serverError(res, '获取销售分析失败', error);
  }
});

// 获取库存分析数据（使用 phones 表代替 inventory 表）
router.get('/inventory', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    const { storeId, supplierId } = req.query;

    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();

    // 构建供应商筛选条件
    const supplierFilter = supplierId && supplierId !== '' && supplierId !== 'undefined' && supplierId !== 'null'
      ? `AND p.supplier_id = ${parseInt(supplierId)}`
      : '';

    // 获取手机库存统计 - 只统计 status = 'in_stock' 的在库商品
    const phonesSummaryQuery = `
      SELECT
        COUNT(DISTINCT CASE WHEN p.status = 'in_stock' THEN p.id END) as totalProducts,
        COUNT(CASE WHEN p.status = 'in_stock' THEN 1 END) as availableProducts,
        COUNT(CASE WHEN p.status = 'sold' THEN 1 END) as soldProducts,
        COUNT(CASE WHEN p.status = 'reserved' THEN 1 END) as reservedProducts,
        COALESCE(SUM(CASE WHEN p.status = 'in_stock' THEN COALESCE(p.purchase_cost, 0) ELSE 0 END), 0) as totalValue,
        COALESCE(SUM(CASE WHEN p.status = 'in_stock' THEN COALESCE(p.purchase_cost, 0) ELSE 0 END), 0) as availableValue
      FROM phones p
      WHERE 1=1
        ${storeId ? 'AND p.store_id = ?' : ''}
        ${supplierFilter}
    `;

    // 按品牌统计库存价值和数量
    const brandStatsQuery = `
      SELECT
        b.id,
        b.name as brand_name,
        COUNT(p.id) as totalItems,
        COUNT(CASE WHEN p.status = 'in_stock' THEN 1 END) as availableItems,
        COALESCE(SUM(p.purchase_cost), 0) as totalValue,
        COALESCE(SUM(CASE WHEN p.status = 'in_stock' THEN p.purchase_cost ELSE 0 END), 0) as availableValue
      FROM brands b
      LEFT JOIN phones p ON b.id = p.brand_id
      GROUP BY b.id, b.name
      HAVING totalItems > 0
      ORDER BY totalValue DESC
    `;

    // 按型号统计
    const modelStatsQuery = `
      SELECT
        m.id,
        m.name as model_name,
        b.name as brand_name,
        COUNT(p.id) as totalItems,
        COUNT(CASE WHEN p.status = 'in_stock' THEN 1 END) as availableItems,
        COALESCE(SUM(p.purchase_cost), 0) as totalValue,
        AVG(p.sale_price) as avgPrice
      FROM models m
      JOIN brands b ON m.brand_id = b.id
      LEFT JOIN phones p ON m.id = p.model_id
      GROUP BY m.id, m.name, b.name
      HAVING totalItems > 0
      ORDER BY totalValue DESC
      LIMIT 20
    `;

    // 获取按颜色统计
    const colorStatsQuery = `
      SELECT
        c.id,
        c.name as color_name,
        COUNT(p.id) as totalItems,
        COUNT(CASE WHEN p.status = 'in_stock' THEN 1 END) as availableItems,
        COALESCE(SUM(p.purchase_cost), 0) as totalValue
      FROM colors c
      LEFT JOIN phones p ON c.id = p.color_id
      GROUP BY c.id, c.name
      HAVING totalItems > 0
      ORDER BY totalValue DESC
    `;

    // 计算库存周转率（已售出商品/平均库存）
    const turnoverQuery = `
      SELECT
        COUNT(CASE WHEN p.status = 'sold' AND p.salestime >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as soldLast30Days,
        COUNT(CASE WHEN p.status = 'in_stock' THEN 1 END) as availableNow
      FROM phones p
      ${storeId ? 'WHERE p.store_id = ?' : ''}
    `;

    // 供应商分析
    const supplierAnalysisQuery = `
      SELECT
        s.id,
        s.name,
        COUNT(p.id) as totalProducts,
        COALESCE(SUM(p.purchase_cost), 0) as totalValue,
        AVG(p.sale_price) as avgSalePrice,
        COUNT(CASE WHEN p.status = 'in_stock' THEN 1 END) as availableProducts
      FROM suppliers s
      LEFT JOIN phones p ON s.id = p.supplier_id
      GROUP BY s.id, s.name
      HAVING totalProducts > 0
      ORDER BY totalValue DESC
      LIMIT 10
    `;

    const params = storeId ? [storeId] : [];

    const [summary, brands, models, colors, turnover, suppliers, configuredWarnings] = await Promise.all([
      db.execute(phonesSummaryQuery, params),
      db.execute(brandStatsQuery, []),
      db.execute(modelStatsQuery, []),
      db.execute(colorStatsQuery, []),
      db.execute(turnoverQuery, params),
      db.execute(supplierAnalysisQuery, []),
      dashboardRepository.getModelStockWarnings(undefined, 500)
    ]);

    const summaryData = summary[0][0];
    const turnoverData = turnover[0][0];

    // 计算周转率
    const soldLast30 = parseInt(turnoverData.soldLast30Days) || 0;
    const availableNow = parseInt(turnoverData.availableNow) || 0;
    const stockTurnover = availableNow > 0 ? (soldLast30 / availableNow) * 30 : 0;

    // 计算库存健康评分
    let healthScore = 100;
    const totalProducts = summaryData.totalProducts || 0;
    const availableProducts = summaryData.availableProducts || 0;
    const availableRate = totalProducts > 0 ? (availableProducts / totalProducts) * 100 : 0;
    const warningItems = Array.isArray(configuredWarnings) ? configuredWarnings : [];
    const lowStockItems = warningItems.length;
    const outOfStockItems = warningItems.filter(item => (parseInt(item.stock_count, 10) || 0) === 0).length;

    if (availableRate < 20) healthScore -= 30;
    else if (availableRate < 40) healthScore -= 15;

    if (lowStockItems > 5) healthScore -= 20;
    else if (lowStockItems > 0) healthScore -= 10;

    if (outOfStockItems > 3) healthScore -= 20;
    else if (outOfStockItems > 0) healthScore -= 10;

    // 生成库存问题
    const issues = [];
    if (lowStockItems > 0) {
      issues.push({
        type: 'low_stock',
        severity: lowStockItems > 5 ? 'high' : 'medium',
        description: `有 ${lowStockItems} 个型号库存不足`,
        affectedItems: lowStockItems,
        potentialLoss: warningItems.reduce((sum, item) => sum + ((parseFloat(item.avg_cost) || 0) * Math.max((parseInt(item.warning_threshold, 10) || 0) - (parseInt(item.stock_count, 10) || 0), 1)), 0)
      });
    }
    if (outOfStockItems > 0) {
      issues.push({
        type: 'out_of_stock',
        severity: 'high',
        description: `有 ${outOfStockItems} 个型号已售罄`,
        affectedItems: outOfStockItems,
        potentialLoss: outOfStockItems * 2000
      });
    }

    // 生成改进建议
    const recommendations = [];
    if (lowStockItems > 0) {
      recommendations.push('及时补充库存不足的商品');
    }
    if (outOfStockItems > 0) {
      recommendations.push('优先补货已售罄的热销型号');
    }
    if (availableRate < 40) {
      recommendations.push('增加商品备货以提高可售率');
    }
    recommendations.push('定期进行库存盘点确保数据准确性');

    const result = {
      totalProducts: totalProducts,
      totalValue: parseFloat(summaryData.totalValue) || 0,
      lowStockItems: lowStockItems,
      outOfStockItems: outOfStockItems,
      overstockItems: 0,
      stockTurnover: parseFloat(stockTurnover.toFixed(2)),
      inventoryHealth: {
        score: Math.max(0, healthScore),
        level: healthScore >= 80 ? 'excellent' :
               healthScore >= 60 ? 'good' :
               healthScore >= 40 ? 'warning' : 'critical',
        issues: issues,
        recommendations: recommendations
      },
      categoryAnalysis: brands[0].map(item => ({
        category: item.brand_name,
        totalItems: item.totalItems,
        totalValue: parseFloat(item.totalValue) || 0,
        turnoverRate: item.totalItems > 0 ? parseFloat(((soldLast30 / item.totalItems) * 30).toFixed(2)) : 0,
        margin: 15,
        growth: Math.random() * 20 - 5
      })),
      supplierAnalysis: suppliers[0].map(item => {
        const totalProducts = parseInt(item.totalProducts, 10) || 0;
        const availableProducts = parseInt(item.availableProducts, 10) || 0;
        const availabilityRate = totalProducts > 0 ? (availableProducts / totalProducts) * 100 : 0;

        return {
          id: item.id,
          name: item.name,
          totalProducts,
          totalValue: parseFloat(item.totalValue) || 0,
          averageDeliveryTime: null,
          qualityScore: parseFloat(availabilityRate.toFixed(1)),
          reliability: parseFloat(availabilityRate.toFixed(1))
        };
      })
    };

    ApiResponse.success(res, result);
  } catch (error) {
    log.error('获取库存分析失败:', error);
    ApiResponse.serverError(res, '获取库存分析失败', error);
  }
});

// 获取低库存预警列表
// 使用系统预警配置（phone_stock_warnings）统一判断
router.get('/inventory/low-stock', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const limitValue = parseInt(String(limit), 10) || 100;
    const warnings = await dashboardRepository.getModelStockWarnings(undefined, limitValue);

    const lowStockItems = (warnings || []).map((item, index) => {
      const currentStock = parseInt(item.stock_count, 10) || 0;
      const reorderPoint = parseInt(item.warning_threshold, 10) || 0;
      const avgCost = parseFloat(item.avg_cost) || 0;
      const colorName = item.color_name || '默认';
      const memoryName = item.memory_name || '';
      const conditionLabel = item.condition_label && item.condition_label !== '全部'
        ? ` · ${item.condition_label}`
        : '';

      return {
        id: `${item.model_id}-${item.color_id || 0}-${item.memory_id || 0}-${item.warning_condition ?? 'all'}-${index}`,
        brand: item.brand_name || '',
        model: `${item.model_name || ''}${memoryName ? ` ${memoryName}` : ''}${conditionLabel}`.trim(),
        color: colorName,
        currentStock,
        reorderPoint,
        unitCost: avgCost,
        totalValue: avgCost * currentStock,
        lastSaleDate: null,
        stockStatus: currentStock === 0 ? 'out_of_stock' : currentStock <= reorderPoint ? 'low_stock' : 'in_stock'
      };
    });

    ApiResponse.success(res, lowStockItems, '获取低库存预警成功');
  } catch (error) {
    log.error('获取低库存预警失败:', error);
    ApiResponse.serverError(res, '获取低库存预警失败', error);
  }
});

// 获取库存周转趋势
router.get('/inventory/turnover', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    const { period = '30d', storeId } = req.query;

    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();

    let days = 30;
    if (period === '90d') days = 90;
    else if (period === '180d') days = 180;

    const turnoverTrendQuery = `
      SELECT
        DATE(salestime) as date,
        COUNT(CASE WHEN status = 'sold' THEN 1 END) as soldCount
      FROM phones
      WHERE salestime >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND status = 'sold'
        ${storeId ? 'AND store_id = ?' : ''}
      GROUP BY DATE(salestime)
      ORDER BY date ASC
    `;

    const currentStockQuery = `
      SELECT COUNT(*) as availableCount
      FROM phones
      WHERE status = 'in_stock'
        ${storeId ? 'AND store_id = ?' : ''}
    `;

    const turnoverParams = storeId ? [days, parseInt(storeId)] : [days];
    const stockParams = storeId ? [parseInt(storeId)] : [];

    const [[results], [stockRows]] = await Promise.all([
      db.execute(turnoverTrendQuery, turnoverParams),
      db.execute(currentStockQuery, stockParams)
    ]);

    const currentAvailableCount = parseInt(stockRows[0]?.availableCount, 10) || 0;

    const turnoverData = results.map(item => {
      const sold = parseInt(item.soldCount) || 0;
      const dailyTurnover = currentAvailableCount > 0 ? (sold / currentAvailableCount) : 0;

      return {
        date: item.date,
        actualTurnover: parseFloat(dailyTurnover.toFixed(2)),
        targetTurnover: 0.08
      };
    });

    ApiResponse.success(res, turnoverData);
  } catch (error) {
    log.error('获取库存周转趋势失败:', error);
    ApiResponse.serverError(res, '获取库存周转趋势失败', error);
  }
});

// 获取供应商统计（有货的供应商数量）
router.get('/inventory/supplier-stats', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    const { storeId } = req.query;

    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();

    const supplierQuery = `
      SELECT
        COUNT(DISTINCT s.id) as supplierCount
      FROM suppliers s
      INNER JOIN phones p ON s.id = p.supplier_id
      WHERE p.status = 'in_stock'
        AND p.supplier_id IS NOT NULL
        ${storeId ? 'AND p.store_id = ?' : ''}
    `;

    const params = storeId ? [parseInt(storeId)] : [];
    const [results] = await db.execute(supplierQuery, params);

    ApiResponse.success(res, {
      supplierCount: results[0]?.supplierCount || 0
    });
  } catch (error) {
    log.error('获取供应商统计失败:', error);
    ApiResponse.serverError(res, '获取供应商统计失败', error);
  }
});

// 获取最近销售的型号
router.get('/inventory/recent-sold', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    const { storeId, limit = 10 } = req.query;

    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();

    // 构建查询和参数
    const hasValidStoreId = storeId && storeId !== '' && storeId !== 'undefined' && storeId !== 'null';
    const storeCondition = hasValidStoreId ? `AND p.store_id = ${parseInt(storeId)}` : '';
    const limitValue = parseInt(limit) || 10;

    const recentSoldQuery = `
      SELECT
        b.name as brand,
        m.name as model,
        c.name as color,
        p.sale_price as salePrice,
        p.salestime as saleDate,
        st.name as store,
        DATE(p.salestime) as saleDateOnly
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN stores st ON p.store_id = st.id
      WHERE p.status = 'sold'
        AND p.salestime IS NOT NULL
        ${storeCondition}
      ORDER BY p.salestime DESC
      LIMIT ${limitValue}
    `;

    const [results] = await db.execute(recentSoldQuery, []);

    const recentSold = results.map(row => ({
      brand: row.brand || '未知',
      model: row.model || '未知',
      color: row.color || '未知',
      salePrice: parseFloat(row.salePrice) || 0,
      saleDate: row.saleDate ? new Date(row.saleDate).toLocaleString('zh-CN') : '',
      store: row.store || '未知'
    }));

    ApiResponse.success(res, recentSold);
  } catch (error) {
    log.error('获取最近销售型号失败:', error);
    ApiResponse.serverError(res, '获取最近销售型号失败', error);
  }
});

// 获取库存价值
router.get('/inventory/value', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    const { storeId } = req.query;

    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();

    const valueQuery = `
      SELECT
        COALESCE(SUM(purchase_cost), 0) as totalValue,
        COUNT(CASE WHEN status = 'in_stock' THEN 1 END) as availableCount,
        COALESCE(SUM(CASE WHEN status = 'in_stock' THEN purchase_cost ELSE 0 END), 0) as availableValue,
        COUNT(CASE WHEN status = 'sold' THEN 1 END) as soldCount,
        COALESCE(SUM(CASE WHEN status = 'sold' THEN purchase_cost ELSE 0 END), 0) as soldValue,
        COUNT(CASE WHEN status = 'reserved' THEN 1 END) as reservedCount,
        COALESCE(SUM(CASE WHEN status = 'reserved' THEN purchase_cost ELSE 0 END), 0) as reservedValue
      FROM phones
      ${storeId ? 'WHERE store_id = ?' : ''}
    `;

    const params = storeId ? [parseInt(storeId)] : [];

    const [results] = await db.execute(valueQuery, params);
    const data = results[0];

    const result = {
      totalValue: parseFloat(data.totalValue) || 0,
      breakdown: {
        available: {
          count: parseInt(data.availableCount) || 0,
          value: parseFloat(data.availableValue) || 0
        },
        sold: {
          count: parseInt(data.soldCount) || 0,
          value: parseFloat(data.soldValue) || 0
        },
        reserved: {
          count: parseInt(data.reservedCount) || 0,
          value: parseFloat(data.reservedValue) || 0
        }
      }
    };

    ApiResponse.success(res, result);
  } catch (error) {
    log.error('获取库存价值失败:', error);
    ApiResponse.serverError(res, '获取库存价值失败', error);
  }
});

// 获取客户分析数据
router.get('/customers', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    log.debug('=== 客户分析API被调用 ===');
    const { period, startDate, endDate, storeId } = req.query;
    log.debug('请求参数:', { period, startDate, endDate, storeId });

    if (!isConnected()) {
      log.error('数据库连接失败');
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();
    log.debug('数据库连接成功');

    // 构建日期筛选条件
    let dateCondition = '';
    let dateParams = [];
    if (startDate && endDate) {
      dateCondition = 'AND DATE(c.created_at) >= ? AND DATE(c.created_at) <= ?';
      dateParams = [startDate, endDate];
    } else if (startDate) {
      dateCondition = 'AND DATE(c.created_at) >= ?';
      dateParams = [startDate];
    } else if (endDate) {
      dateCondition = 'AND DATE(c.created_at) <= ?';
      dateParams = [endDate];
    }

    // 构建店铺筛选条件（通过销售记录关联）
    let storeJoin = '';
    let storeCondition = '';
    let storeParams = [];
    if (storeId && storeId !== '' && storeId !== 'undefined' && storeId !== 'null') {
      storeJoin = 'LEFT JOIN sales s2 ON c.id = s2.customer_id';
      storeCondition = 'AND s2.store_id = ?';
      storeParams = [parseInt(storeId)];
    }

    // 1. 总客户数（统计所有客户）
    const totalCustomersQuery = `
      SELECT COUNT(DISTINCT c.id) as totalCustomers
      FROM customers c
      ${storeJoin}
      WHERE c.status = 1
      ${storeCondition}
      ${dateCondition}
    `;

    // 2. 本月新增客户（或指定日期范围内新增）
    let newCustomersDateCondition = '';
    let newCustomersParams = [...storeParams];
    if (startDate && endDate) {
      newCustomersDateCondition = 'AND DATE(c.created_at) >= ? AND DATE(c.created_at) <= ?';
      newCustomersParams.push(startDate, endDate);
    } else {
      newCustomersDateCondition = 'AND DATE_FORMAT(c.created_at, "%Y-%m") = DATE_FORMAT(NOW(), "%Y-%m")';
    }

    const newCustomersQuery = `
      SELECT COUNT(DISTINCT c.id) as newCustomers
      FROM customers c
      ${storeJoin}
      WHERE c.status = 1
      ${storeCondition}
      ${newCustomersDateCondition}
    `;

    // 3. 活跃客户（1年内或指定日期范围内多次交易的客户）
    let activeDateCondition = 'AND s.sale_date >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
    let activeParams = [...storeParams];
    if (startDate && endDate) {
      activeDateCondition = 'AND DATE(s.sale_date) >= ? AND DATE(s.sale_date) <= ?';
      activeParams.push(startDate, endDate);
    }

    let activeStoreCondition = '';
    if (storeId && storeId !== '' && storeId !== 'undefined' && storeId !== 'null') {
      activeStoreCondition = 'AND s.store_id = ?';
      activeParams.push(parseInt(storeId));
    }

    const activeCustomersQuery = `
      SELECT COUNT(*) as activeCustomers
      FROM (
        SELECT s.customer_id
        FROM sales s
        WHERE s.customer_id IS NOT NULL
          ${activeDateCondition}
          ${activeStoreCondition}
        GROUP BY s.customer_id
        HAVING COUNT(*) >= 2
      ) as repeat_customers
    `;

    // 4. 高价值客户统计（消费金额>=50000）
    let highValueParams = [...storeParams];
    if (startDate && endDate) {
      highValueParams.push(startDate, endDate);
    }

    let highValueStoreCondition = '';
    if (storeId && storeId !== '' && storeId !== 'undefined' && storeId !== 'null') {
      highValueStoreCondition = 'AND s.store_id = ?';
      highValueParams.push(parseInt(storeId));
    }

    const highValueQuery = `
      SELECT COUNT(DISTINCT s.customer_id) as highValueCount
      FROM sales s
      WHERE s.customer_id IS NOT NULL
        ${startDate && endDate ? 'AND DATE(s.sale_date) >= ? AND DATE(s.sale_date) <= ?' : ''}
        ${highValueStoreCondition}
      GROUP BY s.customer_id
      HAVING SUM(s.price) >= 50000
    `;

    // 5. 客户分群分析
    let segmentStoreCondition = '';
    let segmentParams = [];
    if (storeId && storeId !== '' && storeId !== 'undefined' && storeId !== 'null') {
      segmentStoreCondition = 'AND s.store_id = ?';
      segmentParams.push(parseInt(storeId));
    }
    if (startDate && endDate) {
      segmentParams.push(startDate, endDate);
    }

    const segmentQuery = `
      SELECT
        CASE
          WHEN totalSpent >= 50000 THEN '高价值客户'
          WHEN totalSpent >= 20000 THEN '中价值客户'
          WHEN totalSpent >= 5000 THEN '低价值客户'
          ELSE '新客户'
        END as segment,
        COUNT(*) as count,
        COALESCE(AVG(totalSpent), 0) as avgOrderValue,
        COALESCE(SUM(totalSpent), 0) as totalRevenue
      FROM (
        SELECT
          c.id,
          COALESCE(SUM(s.price), 0) as totalSpent
        FROM customers c
        LEFT JOIN sales s ON c.id = s.customer_id
        WHERE c.status = 1
          ${segmentStoreCondition}
          ${startDate && endDate ? 'AND DATE(s.sale_date) >= ? AND DATE(s.sale_date) <= ?' : ''}
        GROUP BY c.id
      ) customerData
      GROUP BY segment
    `;

    const [totalResult, newResult, activeResult, highValueResult, segmentsResult] = await Promise.all([
      db.execute(totalCustomersQuery, [...storeParams, ...dateParams]),
      db.execute(newCustomersQuery, newCustomersParams),
      db.execute(activeCustomersQuery, activeParams),
      db.execute(highValueQuery, highValueParams),
      db.execute(segmentQuery, segmentParams)
    ]);

    const totalCustomers = totalResult[0][0]?.totalCustomers || 0;
    const newCustomers = newResult[0][0]?.newCustomers || 0;
    const activeCustomers = activeResult[0][0]?.activeCustomers || 0;
    const highValueCount = highValueResult[0].length || 0;
    const segments = segmentsResult[0];

    // 计算增长率（对比上月新增客户）
    const lastMonthNewQuery = `
      SELECT COUNT(*) as lastMonthNew
      FROM customers c
      WHERE c.status = 1
        AND DATE_FORMAT(c.created_at, '%Y-%m') = DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m')
    `;

    const [lastMonthResult] = await db.execute(lastMonthNewQuery, []);
    const lastMonthNew = lastMonthResult[0][0]?.lastMonthNew || 0;

    const newCustomersGrowth = lastMonthNew > 0
      ? ((newCustomers - lastMonthNew) / lastMonthNew * 100).toFixed(1)
      : (newCustomers > 0 ? '100' : '0');

    // 计算活跃客户增长率（对比去年同期的活跃客户数）
    const lastYearActiveQuery = `
      SELECT COUNT(*) as lastYearActive
      FROM (
        SELECT s.customer_id
        FROM sales s
        WHERE s.customer_id IS NOT NULL
          AND s.sale_date >= DATE_SUB(DATE_SUB(NOW(), INTERVAL 1 YEAR), INTERVAL 1 YEAR)
          AND s.sale_date < DATE_SUB(NOW(), INTERVAL 1 YEAR)
        GROUP BY s.customer_id
        HAVING COUNT(*) >= 2
      ) as last_year_repeat_customers
    `;

    const [lastYearActiveResult] = await db.execute(lastYearActiveQuery, []);
    const lastYearActive = lastYearActiveResult[0][0]?.lastYearActive || 0;

    const activeCustomersGrowth = lastYearActive > 0
      ? ((activeCustomers - lastYearActive) / lastYearActive * 100).toFixed(1)
      : (activeCustomers > 0 ? '100' : '0');

    const result = {
      totalCustomers: totalCustomers,
      customersGrowth: parseFloat(newCustomersGrowth),
      newCustomers: newCustomers,
      lastMonthNewCustomers: lastMonthNew,
      newCustomersGrowth: parseFloat(newCustomersGrowth),
      activeCustomers: activeCustomers,
      activeCustomersGrowth: parseFloat(activeCustomersGrowth),
      highValueCustomers: highValueCount,
      highValueCustomersGrowth: 0,
      customerSegments: segments.map(item => ({
        segment: item.segment,
        count: item.count,
        avgOrderValue: item.avgOrderValue,
        totalRevenue: item.totalRevenue
      })),
      insights: [
        {
          type: 'info',
          title: '客户总览',
          content: `目前共有 ${totalCustomers.toLocaleString()} 位客户，本月新增 ${newCustomers} 位，上月新增 ${lastMonthNew} 位`,
          impact: 'medium',
          impactText: '本月新增客户'
        },
        {
          type: activeCustomers > 0 ? 'success' : 'warning',
          title: '活跃度分析',
          content: `${activeCustomers} 位客户在最近30天内有购买记录`,
          impact: activeCustomers > 100 ? 'high' : 'low',
          impactText: activeCustomers > 100 ? '活跃度高' : '需要提升活跃度'
        }
      ]
    };

    log.debug('客户分析结果:', result);
    ApiResponse.success(res, result, '获取客户分析成功');
  } catch (error) {
    log.error('获取客户分析失败:', error);
    ApiResponse.serverError(res, '获取客户分析失败', error);
  }
});

// 获取实时数据
router.get('/realtime', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();

    // 获取今日销售数据
    const todaySalesQuery = `
      SELECT
        COUNT(*) as orderCount,
        COALESCE(SUM(final_amount), 0) as totalSales
      FROM sales_orders
      WHERE DATE(created_at) = CURDATE()
      AND order_status = 'completed'
    `;

    // 获取待处理订单数
    const pendingOrdersQuery = `
      SELECT COUNT(*) as pendingCount
      FROM sales_orders
      WHERE order_status IN ('pending', 'processing')
    `;

    // 获取在线用户数（模拟）
    const activeUsers = Math.floor(Math.random() * 50) + 10;

    const [salesData, pendingData] = await Promise.all([
      db.execute(todaySalesQuery),
      db.execute(pendingOrdersQuery)
    ]);

    const realtimeData = {
      timestamp: new Date().toISOString(),
      activeUsers,
      currentSales: parseFloat(salesData[0]?.totalSales || 0),
      pendingOrders: parseInt(pendingData[0]?.pendingCount || 0),
      todayOrders: parseInt(salesData[0]?.orderCount || 0),
      systemLoad: {
        cpu: Math.random() * 30 + 20,
        memory: Math.random() * 60 + 40,
        disk: Math.random() * 50 + 30
      },
      alerts: generateRealTimeAlerts()
    };

    ApiResponse.success(res, realtimeData);
  } catch (error) {
    log.error('获取实时数据失败:', error);
    ApiResponse.serverError(res, '获取实时数据失败', error);
  }
});

// 辅助函数
function generateInventoryIssues(summary) {
  const issues = [];

  if (summary.lowStockItems > 0) {
    issues.push({
      type: 'low_stock',
      severity: summary.lowStockItems > 10 ? 'high' : 'medium',
      description: `有 ${summary.lowStockItems} 个商品库存不足`,
      affectedItems: summary.lowStockItems,
      potentialLoss: summary.lowStockItems * 1000
    });
  }

  if (summary.outOfStockItems > 0) {
    issues.push({
      type: 'out_of_stock',
      severity: 'high',
      description: `有 ${summary.outOfStockItems} 个商品已售罄`,
      affectedItems: summary.outOfStockItems,
      potentialLoss: summary.outOfStockItems * 2000
    });
  }

  return issues;
}

function generateInventoryRecommendations(summary) {
  const recommendations = [];

  if (summary.lowStockItems > 0) {
    recommendations.push('及时补充库存不足的商品');
  }

  if (summary.overstockItems > 0) {
    recommendations.push('考虑促销活动清理过量库存');
  }

  recommendations.push('定期进行库存盘点确保数据准确性');

  return recommendations;
}

function getSegmentCharacteristics(segment) {
  const characteristics = {
    '高价值客户': ['购买频率高', '客单价高', '忠诚度高'],
    '中价值客户': ['有一定购买力', '需要培养忠诚度'],
    '低价值客户': ['购买次数少', '客单价较低'],
    '新客户': ['首次购买', '需要引导和关怀']
  };

  return characteristics[segment] || [];
}

function generateCLVTrends() {
  const trends = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    trends.push({
      period: date.toISOString().slice(0, 7),
      value: Math.random() * 5000 + 8000,
      change: Math.random() * 1000 - 200
    });
  }

  return trends;
}

function generateRealTimeAlerts() {
  const alerts = [];

  // 随机生成一些示例告警
  if (Math.random() > 0.7) {
    alerts.push({
      type: 'warning',
      message: '库存不足：iPhone 15 Pro 库存低于安全水平',
      timestamp: new Date().toISOString(),
      acknowledged: false
    });
  }

  if (Math.random() > 0.8) {
    alerts.push({
      type: 'info',
      message: '新订单：客户下单 iPhone 15',
      timestamp: new Date().toISOString(),
      acknowledged: false
    });
  }

  return alerts;
}

// 获取客户增长数据
router.get('/customers/growth', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    const { period } = req.query;

    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();

    let days = 30;
    if (period === '7d') days = 7;
    else if (period === '90d') days = 90;

    const query = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as newCustomers
      FROM customers
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    const [results] = await db.execute(query);

    const labels = results.map(item => item.date);
    const values = results.map(item => item.newCustomers);

    ApiResponse.success(res, { labels, values }, '获取客户增长数据成功');
  } catch (error) {
    log.error('获取客户增长数据失败:', error);
    ApiResponse.serverError(res, '获取客户增长数据失败', error);
  }
});

// 获取高价值客户列表
router.get('/customers/high-value', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, search = '' } = req.query;
    const offset = (page - 1) * pageSize;

    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();

    // 构建搜索条件
    let searchCondition = '';

    if (search && search.trim() !== '') {
      searchCondition = ` AND (c.name LIKE '%${search}%' OR c.phone LIKE '%${search}%')`;
    }

    // 获取高价值客户（使用 sales 表）
    const customersQuery = `
      SELECT
        c.id,
        c.name,
        c.phone,
        c.created_at,
        COUNT(s.id) as orders_count,
        COALESCE(SUM(s.price), 0) as total_amount,
        COALESCE(SUM(s.price) / NULLIF(COUNT(s.id), 0), 0) as avg_order_value,
        MAX(s.sale_date) as last_order_date,
        CASE
          WHEN COALESCE(SUM(s.price), 0) >= 50000 THEN 'high-value'
          WHEN COALESCE(SUM(s.price), 0) >= 10000 THEN 'potential'
          WHEN DATEDIFF(NOW(), MAX(s.sale_date)) > 90 THEN 'lost'
          ELSE 'at-risk'
        END as segment
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id
      WHERE c.status = 1 ${searchCondition}
      GROUP BY c.id, c.name, c.phone, c.created_at
      HAVING COALESCE(SUM(s.price), 0) > 0
      ORDER BY total_amount DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    // 获取总数（使用相同的搜索条件）
    const countQuery = `
      SELECT COUNT(*) as total
      FROM (
        SELECT c.id
        FROM customers c
        LEFT JOIN sales s ON c.id = s.customer_id
        WHERE c.status = 1 ${searchCondition}
        GROUP BY c.id
        HAVING COALESCE(SUM(s.price), 0) > 0
      ) as customers_with_orders
    `;

    const [customersResult, totalResult] = await Promise.all([
      db.execute(customersQuery),
      db.execute(countQuery)
    ]);

    const customers = customersResult[0] || [];
    const total = totalResult[0]?.[0]?.total || 0;

    ApiResponse.success(res, customers, '获取成功', 200, {
      pagination: {
        page: parseInt(String(page)),
        pageSize: parseInt(String(pageSize)),
        total,
        totalPages: Math.ceil(total / parseInt(String(pageSize)))
      }
    });
  } catch (error) {
    log.error('获取高价值客户失败:', error);
    ApiResponse.serverError(res, '获取高价值客户失败', error);
  }
});

// 获取客户细分数据
router.get('/customers/segments', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();

    // 客户分群分析（使用正确的 sales 表）
    const segmentQuery = `
      SELECT
        CASE
          WHEN totalSpent >= 50000 THEN '高价值客户'
          WHEN totalSpent >= 20000 THEN '中价值客户'
          WHEN totalSpent >= 5000 THEN '低价值客户'
          ELSE '新客户'
        END as segment,
        COUNT(*) as count,
        COALESCE(AVG(totalSpent), 0) as avgOrderValue,
        COALESCE(SUM(totalSpent), 0) as totalRevenue
      FROM (
        SELECT
          c.id,
          COALESCE(SUM(s.price), 0) as totalSpent
        FROM customers c
        LEFT JOIN sales s ON c.id = s.customer_id
        WHERE c.status = 1
        GROUP BY c.id
      ) customerData
      GROUP BY segment
    `;

    const [results] = await db.execute(segmentQuery, []);

    ApiResponse.success(res, results, '获取客户细分成功');
  } catch (error) {
    log.error('获取客户细分数据失败:', error);
    ApiResponse.serverError(res, '获取客户细分数据失败', error);
  }
});

// 获取客户留存率
router.get('/customers/retention', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    const { cohort = 'monthly' } = req.query;

    // 简化的留存率模拟数据（返回数据即可，不需要查询数据库）
    const cohorts = [];
    const periods = ['第1月', '第2月', '第3月', '第4月', '第5月', '第6月'];

    for (let i = 5; i >= 0; i--) {
      const cohortName = cohort === 'monthly'
        ? `${new Date().getMonth() - i}月`
        : `Q${Math.floor((new Date().getMonth() - i * 3) / 3) + 1}`;

      const cohortData = [100]; // 第一个月100%

      for (let j = 1; j < 6; j++) {
        cohortData.push(Math.max(10, 100 - j * 15 - Math.random() * 10));
      }

      cohorts.push({
        cohort: cohortName,
        data: cohortData
      });
    }

    ApiResponse.success(res, {
      cohorts,
      periods
    });
  } catch (error) {
    log.error('获取客户留存率失败:', error);
    ApiResponse.serverError(res, '获取客户留存率失败', error);
  }
});

// 获取客户活跃度
router.get('/customers/activity', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }
    const db = getDatabase();

    // 1. 客户活跃度分布 - 根据最近购买时间分类（使用子查询避免GROUP BY问题）
    const activityDistributionQuery = `
      SELECT * FROM (
        SELECT
          CASE
            WHEN days_since_last_purchase <= 30 THEN '非常活跃'
            WHEN days_since_last_purchase <= 90 THEN '活跃'
            WHEN days_since_last_purchase <= 180 THEN '一般'
            ELSE '不活跃'
          END as activity_level,
          COUNT(*) as count
        FROM (
          SELECT
            c.id,
            DATEDIFF(NOW(), MAX(s.sale_date)) as days_since_last_purchase
          FROM customers c
          INNER JOIN sales s ON c.id = s.customer_id
          WHERE c.status = 1
          GROUP BY c.id
        ) customer_activity
        GROUP BY activity_level
      ) as result
    `;
    const [activityDistResult] = await db.execute(activityDistributionQuery, []);

    // 2. 活跃客户率（90天内有购买记录的客户占比）
    const activeRateQuery = `
      SELECT
        COUNT(DISTINCT c.id) as total_customers,
        COUNT(DISTINCT CASE WHEN s.sale_date >= DATE_SUB(NOW(), INTERVAL 90 DAY) THEN c.id END) as active_customers
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id
      WHERE c.status = 1
    `;
    const [activeRateResult] = await db.execute(activeRateQuery, []);
    const rateData = activeRateResult[0] && activeRateResult[0][0] ? activeRateResult[0][0] : { total_customers: 0, active_customers: 0 };
    const activeRate = rateData.total_customers > 0
      ? ((rateData.active_customers / rateData.total_customers) * 100).toFixed(1)
      : 0;

    // 3. 最近7天每日活跃客户数
    const weeklyActivityQuery = `
      SELECT
        DATE(DATE_SUB(NOW(), INTERVAL n DAY)) as date,
        COUNT(DISTINCT s.customer_id) as active_users
      FROM (
        SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3
        UNION SELECT 4 UNION SELECT 5 UNION SELECT 6
      ) days
      LEFT JOIN sales s ON DATE(s.sale_date) = DATE(DATE_SUB(NOW(), INTERVAL n DAY))
      GROUP BY DATE(DATE_SUB(NOW(), INTERVAL n DAY))
      ORDER BY date ASC
    `;
    const [weeklyActivityResult] = await db.execute(weeklyActivityQuery, []);

    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weeklyActivity = weeklyActivityResult.map(row => {
      const date = new Date(row.date);
      return {
        date: row.date,
        day: dayNames[date.getDay()],
        activeUsers: row.active_users || 0
      };
    });

    // 构建活跃度分布数组（确保包含所有分类）
    const allLevels = ['非常活跃', '活跃', '一般', '不活跃'];
    const distribution = allLevels.map(level => {
      const found = activityDistResult.find(r => r.activity_level === level);
      return {
        name: level,
        value: found ? found.count : 0
      };
    });

    const activityData = {
      activeRate: parseFloat(activeRate),
      distribution: distribution,
      weeklyActivity: weeklyActivity
    };

    ApiResponse.success(res, activityData, '获取客户活跃度成功');
  } catch (error) {
    log.error('获取客户活跃度失败:', error);
    ApiResponse.serverError(res, '获取客户活跃度失败', error);
  }
});

// 获取性能分析数据
router.get('/performance', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    // 模拟性能数据
    const performanceData = {
      overallStatus: 'healthy',
      systemHealth: '系统运行正常',
      latency: {
        avg: Math.random() * 200 + 100,
        min: Math.random() * 50 + 20,
        max: Math.random() * 500 + 300,
        p95: Math.random() * 400 + 200
      },
      memory: {
        usagePercent: Math.random() * 60 + 30,
        used: Math.random() * 4000000000 + 2000000000, // bytes
        total: 8000000000
      },
      cpu: {
        user: Math.random() * 30 + 10,
        system: Math.random() * 20 + 5,
        idle: Math.random() * 30 + 40
      },
      disk: {
        used: Math.random() * 500000000000 + 100000000000, // bytes
        total: 1000000000000,
        available: Math.random() * 500000000000 + 100000000000
      },
      network: {
        inbound: Math.random() * 1000000 + 500000, // bytes per second
        outbound: Math.random() * 1000000 + 500000,
        total: Math.random() * 2000000 + 1000000
      },
      errorRate: Math.random() * 0.02, // 0-2%
      throughput: {
        current: Math.floor(Math.random() * 1000 + 500),
        peak: Math.floor(Math.random() * 2000 + 1000)
      },
      alerts: generatePerformanceAlerts(),
      optimizations: generateOptimizationSuggestions()
    };

    ApiResponse.success(res, performanceData);
  } catch (error) {
    log.error('获取性能分析失败:', error);
    ApiResponse.serverError(res, '获取性能分析失败', error);
  }
});

// 获取性能指标汇总（前端调用的路由）
router.get('/performance/metrics', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    // 返回性能指标汇总数据
    const metricsData = {
      avgResponseTime: Math.floor(Math.random() * 200 + 100),
      avgLoadTime: Math.floor(Math.random() * 1000 + 500),
      errorRate: parseFloat((Math.random() * 0.05).toFixed(4)),
      throughput: Math.floor(Math.random() * 1000 + 500),
      uptime: parseFloat((99 + Math.random()).toFixed(2)),
      requests: Math.floor(Math.random() * 10000 + 5000)
    };

    ApiResponse.success(res, metricsData);
  } catch (error) {
    log.error('获取性能指标失败:', error);
    ApiResponse.serverError(res, '获取性能指标失败', error);
  }
});

// 获取实时性能数据
router.get('/performance/realtime', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    // 模拟实时性能数据
    const realtimeData = {
      timestamp: new Date().toISOString(),
      latency: {
        avg: Math.random() * 200 + 100
      },
      throughput: {
        current: Math.floor(Math.random() * 1000 + 500)
      },
      errorRate: Math.random() * 0.02,
      memory: Math.random() * 60 + 30
    };

    ApiResponse.success(res, realtimeData);
  } catch (error) {
    log.error('获取实时性能数据失败:', error);
    ApiResponse.serverError(res, '获取实时性能数据失败', error);
  }
});

// 获取API性能指标
router.get('/performance/api-metrics', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    // 模拟API性能数据
    const endpoints = [
      '/api/sales/orders',
      '/api/inventory/items',
      '/api/customers',
      '/api/phones',
      '/api/analytics/sales',
      '/api/analytics/inventory',
      '/api/auth/login',
      '/api/users/profile'
    ];

    const metrics = endpoints.map(endpoint => ({
      endpoint,
      method: ['GET', 'POST', 'PUT', 'DELETE'][Math.floor(Math.random() * 4)],
      avgResponseTime: Math.random() * 300 + 50,
      requestCount: Math.floor(Math.random() * 10000 + 1000),
      errorRate: Math.random() * 0.05,
      throughput: Math.floor(Math.random() * 500 + 50),
      trend: Array.from({ length: 10 }, () => Math.random() * 300 + 50)
    }));

    const paginatedMetrics = metrics.slice(offset, offset + parseInt(pageSize));

    ApiResponse.success(res, paginatedMetrics, {
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: metrics.length,
        totalPages: Math.ceil(metrics.length / pageSize)
      }
    });
  } catch (error) {
    log.error('获取API性能指标失败:', error);
    ApiResponse.serverError(res, '获取API性能指标失败', error);
  }
});

// 获取数据库性能指标
router.get('/performance/database-metrics', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    // 模拟数据库性能数据
    const queries = [
      'SELECT查询',
      'INSERT操作',
      'UPDATE操作',
      'DELETE操作',
      'JOIN查询',
      '聚合查询',
      '索引扫描',
      '全表扫描'
    ];

    const metrics = queries.map(query => ({
      query,
      avgExecutionTime: Math.random() * 200 + 10,
      executionCount: Math.floor(Math.random() * 50000 + 5000),
      slowQueries: Math.floor(Math.random() * 100),
      cpuUsage: Math.random() * 50 + 10,
      indexUsage: Math.random() * 0.8 + 0.2
    }));

    const paginatedMetrics = metrics.slice(offset, offset + parseInt(pageSize));

    ApiResponse.success(res, paginatedMetrics, {
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: metrics.length,
        totalPages: Math.ceil(metrics.length / pageSize)
      }
    });
  } catch (error) {
    log.error('获取数据库性能指标失败:', error);
    ApiResponse.serverError(res, '获取数据库性能指标失败', error);
  }
});

// 辅助函数
function generatePerformanceAlerts() {
  return [
    {
      id: '1',
      level: 'warning',
      title: '响应时间增加',
      message: 'API平均响应时间较昨天增加15%，建议检查数据库查询性能',
      timestamp: new Date(Date.now() - 300000).toISOString()
    },
    {
      id: '2',
      level: 'info',
      title: '系统负载正常',
      message: '系统CPU和内存使用率保持在正常范围内',
      timestamp: new Date(Date.now() - 600000).toISOString()
    }
  ];
}

// 获取盈利分析数据
router.get('/profit', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    const { startDate, endDate, timeType = 'month', storeId } = req.query;

    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();

    // 如果没有指定日期，默认使用当月
    let queryStartDate = startDate;
    let queryEndDate = endDate;

    if (!queryStartDate || !queryEndDate) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      queryStartDate = `${year}-${month}-01`;
      queryEndDate = `${year}-${month}-${new Date(year, now.getMonth() + 1, 0).getDate()}`;
    }

    // 计算上月日期范围
    const startDateObj = new Date(queryStartDate);
    const lastMonthStart = new Date(startDateObj.getFullYear(), startDateObj.getMonth() - 1, 1);
    const lastMonthEnd = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), 0);

    const lastMonthStartDate = `${lastMonthStart.getFullYear()}-${String(lastMonthStart.getMonth() + 1).padStart(2, '0')}-01`;
    const lastMonthEndDate = `${lastMonthEnd.getFullYear()}-${String(lastMonthEnd.getMonth() + 1).padStart(2, '0')}-${lastMonthEnd.getDate()}`;

    log.debug('本月日期范围:', queryStartDate, '-', queryEndDate);
    log.debug('上月日期范围:', lastMonthStartDate, '-', lastMonthEndDate);

    // 构建查询条件 - 包含零售销售和批发（调货），排除划拨
    // 零售：status = 'sold'，使用 salestime
    // 批发：status = 'peer_transfer'，使用 wholesale_date
    // 划拨：status = 'supplier_proxy'，不计算利润（代供应商划拨，不产生货款）

    const storeFilter = buildStoreFilterClause(storeId, { phoneAlias: 'p', saleAlias: 'latest_sale' });
    const latestSaleJoin = buildLatestSaleJoin({ phoneAlias: 'p', alias: 'latest_sale' });

    // 本月零售数据查询
    const currentRetailQuery = `
      SELECT
        COUNT(p.id) as totalSales,
        COALESCE(SUM(p.sale_price), 0) as totalRevenue,
        COALESCE(SUM(p.purchase_cost), 0) as totalCost
      FROM phones p
      ${latestSaleJoin}
      WHERE p.status = 'sold'
        AND DATE(p.salestime) >= ?
        AND DATE(p.salestime) <= ?
        ${storeFilter.clause}
    `;

    // 本月批发数据查询
    const currentWholesaleQuery = `
      SELECT
        COUNT(p.id) as totalSales,
        COALESCE(SUM(p.sale_price), 0) as totalRevenue,
        COALESCE(SUM(p.purchase_cost), 0) as totalCost
      FROM phones p
      ${latestSaleJoin}
      WHERE p.status = 'peer_transfer'
        AND p.wholesale_date IS NOT NULL
        AND DATE(p.wholesale_date) >= ?
        AND DATE(p.wholesale_date) <= ?
        ${storeFilter.clause}
    `;

    // 上月零售数据查询
    const lastRetailQuery = `
      SELECT
        COUNT(p.id) as totalSales,
        COALESCE(SUM(p.sale_price), 0) as totalRevenue,
        COALESCE(SUM(p.purchase_cost), 0) as totalCost
      FROM phones p
      ${latestSaleJoin}
      WHERE p.status = 'sold'
        AND DATE(p.salestime) >= ?
        AND DATE(p.salestime) <= ?
        ${storeFilter.clause}
    `;

    // 上月批发数据查询
    const lastWholesaleQuery = `
      SELECT
        COUNT(p.id) as totalSales,
        COALESCE(SUM(p.sale_price), 0) as totalRevenue,
        COALESCE(SUM(p.purchase_cost), 0) as totalCost
      FROM phones p
      ${latestSaleJoin}
      WHERE p.status = 'peer_transfer'
        AND p.wholesale_date IS NOT NULL
        AND DATE(p.wholesale_date) >= ?
        AND DATE(p.wholesale_date) <= ?
        ${storeFilter.clause}
    `;

    // 构建查询参数
    const currentRetailParams = [queryStartDate, queryEndDate, ...storeFilter.params];
    const currentWholesaleParams = [queryStartDate, queryEndDate, ...storeFilter.params];
    const lastRetailParams = [lastMonthStartDate, lastMonthEndDate, ...storeFilter.params];
    const lastWholesaleParams = [lastMonthStartDate, lastMonthEndDate, ...storeFilter.params];

    log.debug('本月零售查询:', currentRetailQuery);
    log.debug('本月零售参数:', currentRetailParams);
    log.debug('本月批发查询:', currentWholesaleQuery);
    log.debug('本月批发参数:', currentWholesaleParams);

    // 并行执行四个查询
    const [currentRetailResult, currentWholesaleResult, lastRetailResult, lastWholesaleResult] = await Promise.all([
      db.execute(currentRetailQuery, currentRetailParams),
      db.execute(currentWholesaleQuery, currentWholesaleParams),
      db.execute(lastRetailQuery, lastRetailParams),
      db.execute(lastWholesaleQuery, lastWholesaleParams)
    ]);

    log.debug('本月零售结果:', currentRetailResult[0]);
    log.debug('本月批发结果:', currentWholesaleResult[0]);
    log.debug('上月零售结果:', lastRetailResult[0]);
    log.debug('上月批发结果:', lastWholesaleResult[0]);

    // 合并零售和批发数据
    const currentRetail = currentRetailResult[0]?.[0] || { totalSales: 0, totalRevenue: 0, totalCost: 0 };
    const currentWholesale = currentWholesaleResult[0]?.[0] || { totalSales: 0, totalRevenue: 0, totalCost: 0 };
    const lastRetail = lastRetailResult[0]?.[0] || { totalSales: 0, totalRevenue: 0, totalCost: 0 };
    const lastWholesale = lastWholesaleResult[0]?.[0] || { totalSales: 0, totalRevenue: 0, totalCost: 0 };

    // 累加零售和批发数据
    const currentData = {
      totalSales: (parseInt(currentRetail.totalSales) || 0) + (parseInt(currentWholesale.totalSales) || 0),
      totalRevenue: (parseFloat(currentRetail.totalRevenue) || 0) + (parseFloat(currentWholesale.totalRevenue) || 0),
      totalCost: (parseFloat(currentRetail.totalCost) || 0) + (parseFloat(currentWholesale.totalCost) || 0)
    };

    const lastData = {
      totalSales: (parseInt(lastRetail.totalSales) || 0) + (parseInt(lastWholesale.totalSales) || 0),
      totalRevenue: (parseFloat(lastRetail.totalRevenue) || 0) + (parseFloat(lastWholesale.totalRevenue) || 0),
      totalCost: (parseFloat(lastRetail.totalCost) || 0) + (parseFloat(lastWholesale.totalCost) || 0)
    };

    log.debug('合并后本月数据:', currentData);
    log.debug('合并后上月数据:', lastData);

    const currentSales = parseInt(currentData.totalSales) || 0;
    const currentRevenue = parseFloat(currentData.totalRevenue) || 0;
    const currentCost = parseFloat(currentData.totalCost) || 0;
    let lastRevenue = parseFloat(lastData.totalRevenue) || 0;
    let lastCost = parseFloat(lastData.totalCost) || 0;

    // 如果上月数据为0，尝试查找最近有销售数据的月份
    if ((lastRevenue === 0 || lastCost === 0) && (currentRevenue > 0 || currentCost > 0)) {
      log.debug('上月数据为空，尝试查找最近有销售数据的月份...');

      // 查询最近6个月内有销售数据的月份
      const recentMonthsQuery = `
        SELECT
          DATE_FORMAT(salestime, '%Y-%m') as month,
          COUNT(*) as salesCount,
          COALESCE(SUM(sale_price), 0) as totalRevenue,
          COALESCE(SUM(purchase_cost), 0) as totalCost
        FROM phones p
        ${latestSaleJoin}
        WHERE p.status = 'sold'
          AND DATE(p.salestime) < ?
          AND DATE(p.salestime) >= DATE_SUB(?, INTERVAL 6 MONTH)
          ${storeFilter.clause}
        GROUP BY DATE_FORMAT(salestime, '%Y-%m')
        HAVING totalRevenue > 0
        ORDER BY month DESC
        LIMIT 1
      `;

      const [recentMonths] = await db.execute(recentMonthsQuery, [queryStartDate, queryStartDate, ...storeFilter.params]);

      if (recentMonths && recentMonths.length > 0 && recentMonths[0].length > 0) {
        const recentMonth = recentMonths[0][0];
        lastRevenue = parseFloat(recentMonth.totalRevenue) || 0;
        lastCost = parseFloat(recentMonth.totalCost) || 0;
        log.debug('找到最近有销售数据的月份:', recentMonth.month, '数据:', { lastRevenue, lastCost });
      } else {
        log.debug('未找到最近有销售数据的月份');
      }
    }

    log.debug('本月数据:', { sales: currentSales, revenue: currentRevenue, cost: currentCost });
    log.debug('上月数据:', { revenue: lastRevenue, cost: lastCost });

    // 计算本月指标
    const currentGrossProfit = currentRevenue - currentCost;
    const currentMarginRate = currentRevenue > 0 ? (currentGrossProfit / currentRevenue) * 100 : 0;
    // 净利润 = 销售价 - 入库价，即毛利润
    const currentNetProfit = currentGrossProfit;
    const currentNetMarginRate = currentRevenue > 0 ? (currentNetProfit / currentRevenue) * 100 : 0;

    // 计算上月指标
    const lastGrossProfit = lastRevenue - lastCost;
    const lastMarginRate = lastRevenue > 0 ? (lastGrossProfit / lastRevenue) * 100 : 0;
    // 净利润 = 销售价 - 入库价，即毛利润
    const lastNetProfit = lastGrossProfit;
    const lastNetMarginRate = lastRevenue > 0 ? (lastNetProfit / lastRevenue) * 100 : 0;

    // 计算环比变化
    const revenueChange = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue * 100) : 0;
    const netProfitChange = lastNetProfit > 0 ? ((currentNetProfit - lastNetProfit) / lastNetProfit * 100) : 0;
    const netMarginRateChange = currentNetMarginRate - lastNetMarginRate;

    const result = {
      summary: {
        totalRevenue: Math.round(currentRevenue),
        totalCost: Math.round(currentCost),
        grossProfit: Math.round(currentGrossProfit),
        marginRate: parseFloat(currentMarginRate.toFixed(1)),
        netMarginRate: parseFloat(currentNetMarginRate.toFixed(1)),
        netProfit: Math.round(currentNetProfit),
        totalSalesCount: currentSales,
        roi: currentCost > 0 ? parseFloat((currentGrossProfit / currentCost * 100).toFixed(1)) : 0,
        perCapitaOutput: currentSales > 0 ? Math.round(currentRevenue / currentSales) : 0,
        // 上月数据
        lastMonth: {
          totalRevenue: Math.round(lastRevenue),
          netProfit: Math.round(lastNetProfit),
          netMarginRate: parseFloat(lastNetMarginRate.toFixed(1))
        },
        // 环比数据
        revenueTrend: revenueChange >= 0 ? 'up' : 'down',
        revenueChange: parseFloat(Math.abs(revenueChange).toFixed(1)),
        netProfitTrend: netProfitChange >= 0 ? 'up' : 'down',
        netProfitChange: parseFloat(Math.abs(netProfitChange).toFixed(1)),
        netMarginRateTrend: netMarginRateChange >= 0 ? 'up' : 'down',
        netMarginRateChange: parseFloat(Math.abs(netMarginRateChange).toFixed(1))
      },
      costBreakdown: []  // 简化，暂时不返回成本分类
    };

    log.debug('盈利分析数据:', result.summary);
    ApiResponse.success(res, result);
  } catch (error) {
    log.error('获取盈利分析失败:', error);
    log.error('错误堆栈:', error.stack);
    ApiResponse.serverError(res, '获取盈利分析失败', error);
  }
});

// 获取盈利趋势数据（月度/季度/年度）
router.get('/profit-trend', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    const { granularity = 'month', endDate, storeId } = req.query;

    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const supportedGranularity = ['month', 'quarter', 'year'];
    const normalizedGranularity = supportedGranularity.includes(String(granularity)) ? String(granularity) : 'month';
    const bucketCount = normalizedGranularity === 'quarter' ? 8 : normalizedGranularity === 'year' ? 6 : 12;

    const parsedAnchorDate = endDate ? new Date(String(endDate)) : new Date();
    const anchorDate = Number.isNaN(parsedAnchorDate.getTime()) ? new Date() : parsedAnchorDate;
    const periods = buildProfitTrendPeriods(normalizedGranularity, anchorDate, bucketCount);

    if (periods.length === 0) {
      return ApiResponse.success(res, {
        granularity: normalizedGranularity,
        series: []
      });
    }

    const rangeStart = periods[0].startDate;
    const rangeEnd = periods[periods.length - 1].endDate;
    const storeFilter = buildStoreFilterClause(storeId, { phoneAlias: 'p', saleAlias: 'latest_sale' });
    const latestSaleJoin = buildLatestSaleJoin({ phoneAlias: 'p', alias: 'latest_sale' });

    const db = getDatabase();
    const soldPeriodExpr = getProfitTrendGroupExpression('p.salestime', normalizedGranularity);
    const wholesalePeriodExpr = getProfitTrendGroupExpression('p.wholesale_date', normalizedGranularity);

    const trendQuery = `
      SELECT
        period_key,
        SUM(total_sales) AS totalSales,
        SUM(total_revenue) AS totalRevenue,
        SUM(total_cost) AS totalCost
      FROM (
        SELECT
          ${soldPeriodExpr} AS period_key,
          COUNT(p.id) AS total_sales,
          COALESCE(SUM(p.sale_price), 0) AS total_revenue,
          COALESCE(SUM(p.purchase_cost), 0) AS total_cost
        FROM phones p
        ${latestSaleJoin}
        WHERE p.status = 'sold'
          AND p.salestime IS NOT NULL
          AND DATE(p.salestime) >= ?
          AND DATE(p.salestime) <= ?
          ${storeFilter.clause}
        GROUP BY period_key

        UNION ALL

        SELECT
          ${wholesalePeriodExpr} AS period_key,
          COUNT(p.id) AS total_sales,
          COALESCE(SUM(p.sale_price), 0) AS total_revenue,
          COALESCE(SUM(p.purchase_cost), 0) AS total_cost
        FROM phones p
        ${latestSaleJoin}
        WHERE p.status = 'peer_transfer'
          AND p.wholesale_date IS NOT NULL
          AND DATE(p.wholesale_date) >= ?
          AND DATE(p.wholesale_date) <= ?
          ${storeFilter.clause}
        GROUP BY period_key
      ) AS profit_periods
      GROUP BY period_key
      ORDER BY period_key ASC
    `;

    const queryParams = [
      rangeStart,
      rangeEnd,
      ...storeFilter.params,
      rangeStart,
      rangeEnd,
      ...storeFilter.params
    ];

    const [rows] = await db.execute(trendQuery, queryParams);
    const rowMap = new Map(
      (rows || []).map((row) => [
        row.period_key,
        {
          totalSales: parseInt(row.totalSales, 10) || 0,
          totalRevenue: Math.round(parseFloat(row.totalRevenue) || 0),
          totalCost: Math.round(parseFloat(row.totalCost) || 0)
        }
      ])
    );

    const series = periods.map((period) => {
      const raw = rowMap.get(period.key) || { totalSales: 0, totalRevenue: 0, totalCost: 0 };
      const profit = raw.totalRevenue - raw.totalCost;

      return {
        key: period.key,
        label: period.label,
        startDate: period.startDate,
        endDate: period.endDate,
        totalSales: raw.totalSales,
        totalRevenue: raw.totalRevenue,
        totalCost: raw.totalCost,
        totalProfit: profit
      };
    });

    return ApiResponse.success(res, {
      granularity: normalizedGranularity,
      rangeStart,
      rangeEnd,
      series
    });
  } catch (error) {
    log.error('获取盈利趋势数据失败:', error);
    return ApiResponse.serverError(res, '获取盈利趋势数据失败', error);
  }
});

// 获取门店利润数据
router.get('/store-profit', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    log.debug('=== 门店利润 API 被调用 ===');
    const { startDate, endDate, storeId, supplierId } = req.query;

    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();

    // 如果没有指定日期，默认使用当月
    let queryStartDate = startDate;
    let queryEndDate = endDate;

    if (!queryStartDate || !queryEndDate) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      queryStartDate = `${year}-${month}-01`;
      queryEndDate = `${year}-${month}-${new Date(year, now.getMonth() + 1, 0).getDate()}`;
    }

    const storeFilter = buildStoreFilterClause(storeId, { phoneAlias: 'p', saleAlias: 'latest_sale' });
    const supplierFilter = parseOptionalInt(supplierId);
    const supplierClause = supplierFilter ? 'AND p.supplier_id = ?' : '';
    const subQueryParams = [
      queryStartDate,
      queryEndDate,
      ...storeFilter.params,
      ...(supplierFilter ? [supplierFilter] : [])
    ];

    const storeProfitQuery = `
      SELECT
        summary.store_id,
        st.name AS store_name,
        SUM(summary.sales_count) AS sales_count,
        SUM(summary.total_revenue) AS total_revenue,
        SUM(summary.total_cost) AS total_cost
      FROM (
        SELECT
          COALESCE(latest_sale.store_id, p.store_id) AS store_id,
          COUNT(p.id) AS sales_count,
          COALESCE(SUM(p.sale_price), 0) AS total_revenue,
          COALESCE(SUM(p.purchase_cost), 0) AS total_cost
        FROM phones p
        ${buildLatestSaleJoin({ phoneAlias: 'p', alias: 'latest_sale' })}
        WHERE p.status = 'sold'
          AND p.salestime IS NOT NULL
          AND DATE(p.salestime) >= ?
          AND DATE(p.salestime) <= ?
          ${storeFilter.clause}
          ${supplierClause}
        GROUP BY COALESCE(latest_sale.store_id, p.store_id)

        UNION ALL

        SELECT
          COALESCE(latest_sale.store_id, p.store_id) AS store_id,
          COUNT(p.id) AS sales_count,
          COALESCE(SUM(p.sale_price), 0) AS total_revenue,
          COALESCE(SUM(p.purchase_cost), 0) AS total_cost
        FROM phones p
        ${buildLatestSaleJoin({ phoneAlias: 'p', alias: 'latest_sale' })}
        WHERE p.status = 'peer_transfer'
          AND p.wholesale_date IS NOT NULL
          AND DATE(p.wholesale_date) >= ?
          AND DATE(p.wholesale_date) <= ?
          ${storeFilter.clause}
          ${supplierClause}
        GROUP BY COALESCE(latest_sale.store_id, p.store_id)
      ) summary
      LEFT JOIN stores st ON st.id = summary.store_id
      WHERE summary.store_id IS NOT NULL
      GROUP BY summary.store_id, st.name
      ORDER BY (SUM(summary.total_revenue) - SUM(summary.total_cost)) DESC
    `;

    log.debug('门店利润查询:', storeProfitQuery);

    const [storeRows] = await db.execute(storeProfitQuery, [
      ...subQueryParams,
      ...subQueryParams
    ]);

    const storeProfitList = Array.from(storeRows || [])
      .filter(item => (parseInt(item.sales_count, 10) || 0) > 0)
      .map(item => ({
        id: item.store_id,
        name: item.store_name || '未知门店',
        revenue: Math.round(parseFloat(item.total_revenue) || 0),
        cost: Math.round(parseFloat(item.total_cost) || 0),
        count: parseInt(item.sales_count, 10) || 0,
        profit: Math.round((parseFloat(item.total_revenue) || 0) - (parseFloat(item.total_cost) || 0))
      }))
      .sort((a, b) => b.profit - a.profit);

    log.debug('门店利润查询成功，返回', storeProfitList.length, '条数据');
    ApiResponse.success(res, storeProfitList);
  } catch (error) {
    log.error('获取门店利润失败:', error);
    ApiResponse.serverError(res, '获取门店利润失败', error);
  }
});

// 获取品牌销量排行
router.get('/ranking/brands', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    log.debug('=== 品牌销量排行 API 被调用 ===');
    const { startDate, endDate, storeId, supplierId, limit = 10 } = req.query;
    log.debug('查询参数:', { startDate, endDate, storeId, supplierId, limit });

    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();

    // 构建零售查询条件（从 phones 表查询 status = 'sold'）
    const storeFilter = buildStoreFilterClause(storeId, { phoneAlias: 'p', saleAlias: 'latest_sale' });
    const latestSaleJoin = buildLatestSaleJoin({ phoneAlias: 'p', alias: 'latest_sale' });
    let retailConditions = ['p.status = "sold"', 'p.salestime IS NOT NULL'];
    let retailParams = [];

    if (startDate) {
      retailConditions.push('DATE(p.salestime) >= ?');
      retailParams.push(startDate);
    }
    if (endDate) {
      retailConditions.push('DATE(p.salestime) <= ?');
      retailParams.push(endDate);
    }
    if (storeFilter.storeId) {
      retailConditions.push('COALESCE(latest_sale.store_id, p.store_id) = ?');
      retailParams.push(storeFilter.storeId);
    }
    if (supplierId && supplierId !== '' && supplierId !== 'undefined' && supplierId !== 'null') {
      retailConditions.push('p.supplier_id = ?');
      retailParams.push(parseInt(String(supplierId)));
    }

    const retailWhereClause = retailConditions.join(' AND ');

    // 构建批发查询条件（从 phones 表查询 status = 'peer_transfer'）
    let wholesaleConditions = [
      "p.status = 'peer_transfer'",
      "p.wholesale_date IS NOT NULL"
    ];
    let wholesaleParams = [];

    if (startDate) {
      wholesaleConditions.push('DATE(p.wholesale_date) >= ?');
      wholesaleParams.push(startDate);
    }
    if (endDate) {
      wholesaleConditions.push('DATE(p.wholesale_date) <= ?');
      wholesaleParams.push(endDate);
    }
    if (storeFilter.storeId) {
      wholesaleConditions.push('COALESCE(latest_sale.store_id, p.store_id) = ?');
      wholesaleParams.push(storeFilter.storeId);
    }
    if (supplierId && supplierId !== '' && supplierId !== 'undefined' && supplierId !== 'null') {
      wholesaleConditions.push('p.supplier_id = ?');
      wholesaleParams.push(parseInt(String(supplierId)));
    }

    const wholesaleWhereClause = wholesaleConditions.join(' AND ');

    // 零售数据查询（从 phones 表查询 status = 'sold'）
    const retailQuery = `
      SELECT
        b.id,
        b.name,
        COUNT(p.id) as count,
        COALESCE(SUM(p.sale_price), 0) as amount
      FROM brands b
      LEFT JOIN phones p ON b.id = p.brand_id
      ${latestSaleJoin}
      WHERE ${retailWhereClause}
      GROUP BY b.id, b.name
    `;

    // 批发数据查询
    const wholesaleQuery = `
      SELECT
        b.id,
        b.name,
        COUNT(p.id) as count,
        COALESCE(SUM(p.sale_price), 0) as amount
      FROM brands b
      LEFT JOIN phones p ON b.id = p.brand_id
      ${latestSaleJoin}
      WHERE ${wholesaleWhereClause}
      GROUP BY b.id, b.name
    `;

    log.debug('零售查询:', retailQuery);
    log.debug('零售参数:', retailParams);
    log.debug('批发查询:', wholesaleQuery);
    log.debug('批发参数:', wholesaleParams);

    // 执行两个查询
    const [retailResults, wholesaleResults] = await Promise.all([
      db.execute(retailQuery, retailParams),
      db.execute(wholesaleQuery, wholesaleParams)
    ]);

    // 合并零售和批发数据
    const brandMap = new Map();

    // 处理零售数据 - 确保count是数字
    retailResults[0].forEach(item => {
      brandMap.set(item.id, {
        id: item.id,
        name: item.name,
        count: parseInt(item.count) || 0,
        amount: parseFloat(item.amount) || 0
      });
    });

    // 处理批发数据，累加到零售数据 - 确保count是数字
    wholesaleResults[0].forEach(item => {
      const existing = brandMap.get(item.id);
      const wholesaleCount = parseInt(item.count) || 0;
      if (existing) {
        existing.count += wholesaleCount;
        existing.amount += (parseFloat(item.amount) || 0);
      } else if (wholesaleCount > 0) {
        brandMap.set(item.id, {
          id: item.id,
          name: item.name,
          count: wholesaleCount,
          amount: parseFloat(item.amount) || 0
        });
      }
    });

    // 转换为数组并排序
    const rankings = Array.from(brandMap.values())
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, parseInt(String(limit || '10')));

    const maxCount = rankings.length > 0 ? rankings[0].count : 1;

    const result = rankings.map(item => ({
      name: item.name,
      count: parseInt(item.count) || 0,
      amount: item.amount,
      percent: Math.round((item.count / maxCount) * 100)
    }));

    log.debug('品牌销量排行查询成功（包含批发），返回', result.length, '条数据');
    ApiResponse.success(res, result);
  } catch (error) {
    log.error('获取品牌销量排行失败:', error);
    log.error('错误堆栈:', error.stack);
    ApiResponse.serverError(res, '获取品牌销量排行失败', error);
  }
});

// 获取型号销量排行
router.get('/ranking/models', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    log.debug('=== 型号销量排行 API 被调用 ===');
    const { startDate, endDate, storeId, supplierId, limit = 10, sortBy = 'count' } = req.query;
    log.debug('查询参数:', { startDate, endDate, storeId, supplierId, limit, sortBy });

    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();

    // 构建零售查询条件（从 phones 表查询 status = 'sold'）
    const storeFilter = buildStoreFilterClause(storeId, { phoneAlias: 'p', saleAlias: 'latest_sale' });
    const latestSaleJoin = buildLatestSaleJoin({ phoneAlias: 'p', alias: 'latest_sale' });
    let retailConditions = ['p.status = "sold"', 'p.salestime IS NOT NULL'];
    let retailParams = [];

    if (startDate) {
      retailConditions.push('DATE(p.salestime) >= ?');
      retailParams.push(startDate);
    }
    if (endDate) {
      retailConditions.push('DATE(p.salestime) <= ?');
      retailParams.push(endDate);
    }
    if (storeFilter.storeId) {
      retailConditions.push('COALESCE(latest_sale.store_id, p.store_id) = ?');
      retailParams.push(storeFilter.storeId);
    }
    if (supplierId && supplierId !== '' && supplierId !== 'undefined' && supplierId !== 'null') {
      retailConditions.push('p.supplier_id = ?');
      retailParams.push(parseInt(String(supplierId)));
    }

    const retailWhereClause = retailConditions.join(' AND ');

    // 构建批发查询条件（从 phones 表查询 status = 'peer_transfer'）
    let wholesaleConditions = [
      "p.status = 'peer_transfer'",
      "p.wholesale_date IS NOT NULL"
    ];
    let wholesaleParams = [];

    if (startDate) {
      wholesaleConditions.push('DATE(p.wholesale_date) >= ?');
      wholesaleParams.push(startDate);
    }
    if (endDate) {
      wholesaleConditions.push('DATE(p.wholesale_date) <= ?');
      wholesaleParams.push(endDate);
    }
    if (storeFilter.storeId) {
      wholesaleConditions.push('COALESCE(latest_sale.store_id, p.store_id) = ?');
      wholesaleParams.push(storeFilter.storeId);
    }
    if (supplierId && supplierId !== '' && supplierId !== 'undefined' && supplierId !== 'null') {
      wholesaleConditions.push('p.supplier_id = ?');
      wholesaleParams.push(parseInt(String(supplierId)));
    }

    const wholesaleWhereClause = wholesaleConditions.join(' AND ');

    // 零售数据查询（从 phones 表查询 status = 'sold'）
    const retailQuery = `
      SELECT
        m.id,
        m.name,
        b.name as brand_name,
        COUNT(p.id) as count,
        COALESCE(SUM(p.sale_price), 0) as amount,
        COALESCE(SUM(p.purchase_cost), 0) as cost
      FROM models m
      LEFT JOIN brands b ON m.brand_id = b.id
      LEFT JOIN phones p ON m.id = p.model_id
      ${latestSaleJoin}
      WHERE ${retailWhereClause}
      GROUP BY m.id, m.name, b.name
    `;

    // 批发数据查询
    const wholesaleQuery = `
      SELECT
        m.id,
        m.name,
        b.name as brand_name,
        COUNT(p.id) as count,
        COALESCE(SUM(p.sale_price), 0) as amount,
        COALESCE(SUM(p.purchase_cost), 0) as cost
      FROM models m
      LEFT JOIN brands b ON m.brand_id = b.id
      LEFT JOIN phones p ON m.id = p.model_id
      ${latestSaleJoin}
      WHERE ${wholesaleWhereClause}
      GROUP BY m.id, m.name, b.name
    `;

    log.debug('零售查询:', retailQuery);
    log.debug('零售参数:', retailParams);
    log.debug('批发查询:', wholesaleQuery);
    log.debug('批发参数:', wholesaleParams);

    // 执行两个查询
    const [retailResults, wholesaleResults] = await Promise.all([
      db.execute(retailQuery, retailParams),
      db.execute(wholesaleQuery, wholesaleParams)
    ]);

    // 合并零售和批发数据
    const modelMap = new Map();

    // 处理零售数据 - 确保count是数字
    retailResults[0].forEach(item => {
      modelMap.set(item.id, {
        id: item.id,
        name: item.name,
        brand_name: item.brand_name,
        count: parseInt(item.count) || 0,
        amount: parseFloat(item.amount) || 0,
        cost: parseFloat(item.cost) || 0
      });
    });

    // 处理批发数据，累加到零售数据 - 确保count是数字
    wholesaleResults[0].forEach(item => {
      const existing = modelMap.get(item.id);
      const wholesaleCount = parseInt(item.count) || 0;
      if (existing) {
        existing.count += wholesaleCount;
        existing.amount += (parseFloat(item.amount) || 0);
        existing.cost += (parseFloat(item.cost) || 0);
      } else if (wholesaleCount > 0) {
        modelMap.set(item.id, {
          id: item.id,
          name: item.name,
          brand_name: item.brand_name,
          count: wholesaleCount,
          amount: parseFloat(item.amount) || 0,
          cost: parseFloat(item.cost) || 0
        });
      }
    });

    const normalizedSortBy = ['count', 'amount', 'profit'].includes(String(sortBy))
      ? String(sortBy)
      : 'count';

    // 转换为数组并排序
    const rankings = Array.from(modelMap.values())
      .map(item => ({
        ...item,
        profit: (item.amount || 0) - (item.cost || 0)
      }))
      .filter(item => item.count > 0)
      .sort((a, b) => {
        if (normalizedSortBy === 'amount') {
          return b.amount - a.amount;
        }
        if (normalizedSortBy === 'profit') {
          return b.profit - a.profit;
        }
        return b.count - a.count;
      })
      .slice(0, parseInt(String(limit || '10')));

    const maxCount = rankings.length > 0 ? rankings[0].count : 1;
    const maxAmount = rankings.length > 0 ? rankings[0].amount : 1;
    const maxProfit = rankings.length > 0 ? rankings[0].profit : 1;

    const result = rankings.map(item => ({
      name: `${item.brand_name} ${item.name}`,
      count: parseInt(item.count) || 0,
      amount: item.amount,
      cost: item.cost,
      profit: item.profit,
      percent: Math.round(
        normalizedSortBy === 'amount'
          ? ((item.amount || 0) / (maxAmount || 1)) * 100
          : normalizedSortBy === 'profit'
            ? ((item.profit || 0) / (maxProfit || 1)) * 100
            : ((item.count || 0) / (maxCount || 1)) * 100
      )
    }));

    log.debug('型号销量排行查询成功（包含批发），返回', result.length, '条数据');
    ApiResponse.success(res, result);
  } catch (error) {
    log.error('获取型号销量排行失败:', error);
    log.error('错误堆栈:', error.stack);
    ApiResponse.serverError(res, '获取型号销量排行失败', error);
  }
});

// 获取全新/二手销售数据
router.get('/sales-by-condition', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    log.debug('=== 全新/二手销售数据 API 被调用 ===');
    const { startDate, endDate, storeId, supplierId } = req.query;
    log.debug('查询参数:', { startDate, endDate, storeId, supplierId });

    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();
    const storeFilter = buildStoreFilterClause(storeId, { phoneAlias: 'p', saleAlias: 'latest_sale' });
    const latestSaleJoin = buildLatestSaleJoin({ phoneAlias: 'p', alias: 'latest_sale' });

    // 构建查询条件 - 使用 phones 表的 salestime 字段
    // 注意：如果 salestime 为 NULL，使用 updated_at 作为备选
    let queryParams = [];
    let soldWhereConditions = ['p.status = "sold"', 'p.salestime IS NOT NULL'];

    // 日期条件：使用 salestime 字段过滤
    if (startDate) {
      soldWhereConditions.push('DATE(p.salestime) >= ?');
      queryParams.push(startDate);
    }
    if (endDate) {
      soldWhereConditions.push('DATE(p.salestime) <= ?');
      queryParams.push(endDate);
    }
    if (storeFilter.storeId) {
      soldWhereConditions.push('COALESCE(latest_sale.store_id, p.store_id) = ?');
      queryParams.push(storeFilter.storeId);
    }
    if (supplierId) {
      soldWhereConditions.push('p.supplier_id = ?');
      queryParams.push(parseInt(String(supplierId))); // 确保是整数
    }

    const soldWhereClause = soldWhereConditions.join(' AND ');

    // 全新机销售数据（phones.status = 'sold' AND is_new = 1）
    const newQuery = `
      SELECT
        COUNT(p.id) as salesCount,
        COALESCE(SUM(p.sale_price), 0) as salesAmount,
        COALESCE(SUM(p.sale_price - COALESCE(p.purchase_cost, 0)), 0) as profit
      FROM phones p
      ${latestSaleJoin}
      WHERE ${soldWhereClause} AND p.is_new = 1
    `;

    // 二手机销售数据（phones.status = 'sold' AND (is_new = 0 OR NULL)）
    const usedQuery = `
      SELECT
        COUNT(p.id) as salesCount,
        COALESCE(SUM(p.sale_price), 0) as salesAmount,
        COALESCE(SUM(p.sale_price - COALESCE(p.purchase_cost, 0)), 0) as profit
      FROM phones p
      ${latestSaleJoin}
      WHERE ${soldWhereClause} AND (p.is_new = 0 OR p.is_new IS NULL)
    `;

    log.debug('📊 [DEBUG] 全新机销售查询:', newQuery);
    log.debug('📊 [DEBUG] 二手机销售查询:', usedQuery);
    log.debug('📊 [DEBUG] 查询参数:', queryParams);

    // 批发数据直接从 phones 表查询（status = 'peer_transfer'）
    // 构建批发查询条件
    // 注意：批发数据必须有有效的调货日期，否则会被排除
    let wholesaleWhereConditions = ['p.wholesale_date IS NOT NULL'];
    let wholesaleParams = [];

    if (startDate) {
      wholesaleWhereConditions.push('DATE(p.wholesale_date) >= ?');
      wholesaleParams.push(startDate);
    }
    if (endDate) {
      wholesaleWhereConditions.push('DATE(p.wholesale_date) <= ?');
      wholesaleParams.push(endDate);
    }
    if (storeFilter.storeId) {
      wholesaleWhereConditions.push('COALESCE(latest_sale.store_id, p.store_id) = ?');
      wholesaleParams.push(storeFilter.storeId);
    }
    if (supplierId && supplierId !== '' && supplierId !== 'undefined' && supplierId !== 'null') {
      wholesaleWhereConditions.push('p.supplier_id = ?');
      wholesaleParams.push(parseInt(String(supplierId)));
    }

    const wholesaleWhereClause = 'AND ' + wholesaleWhereConditions.join(' AND ');

    // 全新机批发数据（从 phones 表查询）
    const newWholesaleQuery = `
      SELECT
        COUNT(p.id) as salesCount,
        COALESCE(SUM(p.sale_price), 0) as salesAmount,
        COALESCE(SUM(p.sale_price - COALESCE(p.purchase_cost, 0)), 0) as profit
      FROM phones p
      ${latestSaleJoin}
      WHERE p.status = 'peer_transfer'
        AND p.is_new = 1
        ${wholesaleWhereClause}
    `;

    // 二手机批发数据（从 phones 表查询）
    const usedWholesaleQuery = `
      SELECT
        COUNT(p.id) as salesCount,
        COALESCE(SUM(p.sale_price), 0) as salesAmount,
        COALESCE(SUM(p.sale_price - COALESCE(p.purchase_cost, 0)), 0) as profit
      FROM phones p
      ${latestSaleJoin}
      WHERE p.status = 'peer_transfer'
        AND (p.is_new = 0 OR p.is_new IS NULL)
        ${wholesaleWhereClause}
    `;

    log.debug('全新机批发查询:', newWholesaleQuery);
    log.debug('二手机批发查询:', usedWholesaleQuery);
    log.debug('批发查询参数:', wholesaleParams);

    // 先执行销售查询
    const [newResult, usedResult] = await Promise.all([
      db.execute(newQuery, queryParams),
      db.execute(usedQuery, queryParams)
    ]);

    // 执行批发查询
    let newWholesale = { salesCount: 0, salesAmount: 0, profit: 0 };
    let usedWholesale = { salesCount: 0, salesAmount: 0, profit: 0 };

    try {
      const [newWholesaleResult, usedWholesaleResult] = await Promise.all([
        db.execute(newWholesaleQuery, wholesaleParams),
        db.execute(usedWholesaleQuery, wholesaleParams)
      ]);
      newWholesale = (newWholesaleResult[0] && newWholesaleResult[0][0]) || { salesCount: 0, salesAmount: 0, profit: 0 };
      usedWholesale = (usedWholesaleResult[0] && usedWholesaleResult[0][0]) || { salesCount: 0, salesAmount: 0, profit: 0 };
      log.debug('全新机批发结果:', newWholesaleResult);
      log.debug('二手机批发结果:', usedWholesaleResult);
    } catch (wholesaleError) {
      log.error('批发数据查询失败:', wholesaleError);
    }

    log.debug('全新机结果:', newResult);
    log.debug('二手机结果:', usedResult);
    log.debug('全新机批发结果:', newWholesale);
    log.debug('二手机批发结果:', usedWholesale);

    // execute()返回 [rows, fields]，需要取第一个元素
    const newSales = (newResult[0] && newResult[0][0]) || { salesCount: 0, salesAmount: 0, profit: 0 };
    const usedSales = (usedResult[0] && usedResult[0][0]) || { salesCount: 0, salesAmount: 0, profit: 0 };

    log.debug('解析后 - 全新机销售:', newSales);
    log.debug('解析后 - 二手机销售:', usedSales);
    log.debug('解析后 - 全新机批发:', newWholesale);
    log.debug('解析后 - 二手机批发:', usedWholesale);

    // 只返回普通销售数据，不包括批发数据
    // 批发数据通过 /transfers/statistics 接口单独获取
    const newTotalCount = parseInt(newSales.salesCount) || 0;
    const newTotalAmount = parseFloat(newSales.salesAmount) || 0;
    const newTotalProfit = parseFloat(newSales.profit) || 0;

    const usedTotalCount = parseInt(usedSales.salesCount) || 0;
    const usedTotalAmount = parseFloat(usedSales.salesAmount) || 0;
    const usedTotalProfit = parseFloat(usedSales.profit) || 0;

    log.debug('全新机销售数据（不含批发）:', newTotalCount);
    log.debug('二手机销售数据（不含批发）:', usedTotalCount);

    // 计算衍生数据
    const newAvgPrice = newTotalCount > 0 ? newTotalAmount / newTotalCount : 0;
    const usedAvgPrice = usedTotalCount > 0 ? usedTotalAmount / usedTotalCount : 0;
    const newMarginRate = newTotalAmount > 0 ? (newTotalProfit / newTotalAmount) * 100 : 0;
    const usedMarginRate = usedTotalAmount > 0 ? (usedTotalProfit / usedTotalAmount) * 100 : 0;

    const result = {
      new: {
        salesCount: parseInt(newTotalCount) || 0,
        salesAmount: parseFloat(newTotalAmount) || 0,
        profit: parseFloat(newTotalProfit) || 0,
        marginRate: parseFloat(newMarginRate.toFixed(1)),
        avgPrice: parseFloat(newAvgPrice.toFixed(0))
      },
      used: {
        salesCount: parseInt(usedTotalCount) || 0,
        salesAmount: parseFloat(usedTotalAmount) || 0,
        profit: parseFloat(usedTotalProfit) || 0,
        marginRate: parseFloat(usedMarginRate.toFixed(1)),
        avgPrice: parseFloat(usedAvgPrice.toFixed(0))
      }
    };

    log.debug('全新/二手销售数据查询成功（包含批发）:', result);
    ApiResponse.success(res, result);
  } catch (error) {
    log.error('获取全新/二手销售数据失败:', error);
    log.error('错误堆栈:', error.stack);
    ApiResponse.serverError(res, '获取全新/二手销售数据失败', error);
  }
});

// 获取员工业绩统计
router.get('/employee-performance', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    log.debug('=== 员工业绩统计 API 被调用 ===');
    const { startDate, endDate, storeId } = req.query;
    log.debug('查询参数:', { startDate, endDate, storeId });

    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();

    // 如果没有提供日期，使用当月
    let queryStartDate = startDate;
    let queryEndDate = endDate;

    if (!queryStartDate || !queryEndDate) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      queryStartDate = `${year}-${month}-01`;
      queryEndDate = `${year}-${month}-${new Date(year, now.getMonth() + 1, 0).getDate()}`;
    }

    const storeFilter = buildStoreFilterClause(storeId, { phoneAlias: 'p', saleAlias: 'latest_sale' });
    const retailLatestSaleJoin = buildLatestSaleJoin({ phoneAlias: 'p', alias: 'latest_sale' });
    const wholesaleLatestSaleJoin = buildLatestSaleJoin({ phoneAlias: 'p', alias: 'latest_sale' });
    const retailParams = [queryStartDate, queryEndDate, ...storeFilter.params];
    const wholesaleParams = [queryStartDate, queryEndDate, ...storeFilter.params];

    // 员工业绩查询 - 使用子查询分别处理零售和批发数据
    // 零售数据查询
    const retailQuery = `
      SELECT
        u.id as user_id,
        u.username as user_name,
        u.name as real_name,
        s.id as store_id,
        s.name as store_name,

        COALESCE(SUM(CASE WHEN p.is_new = 1 THEN 1 ELSE 0 END), 0) as new_sales_count,
        COALESCE(SUM(CASE WHEN p.is_new = 1 THEN p.sale_price ELSE 0 END), 0) as new_sales_amount,
        COALESCE(SUM(CASE WHEN p.is_new = 1 THEN (p.sale_price - COALESCE(p.purchase_cost, 0)) ELSE 0 END), 0) as new_profit,

        COALESCE(SUM(CASE WHEN p.is_new = 0 OR p.is_new IS NULL THEN 1 ELSE 0 END), 0) as used_sales_count,
        COALESCE(SUM(CASE WHEN p.is_new = 0 OR p.is_new IS NULL THEN p.sale_price ELSE 0 END), 0) as used_sales_amount,
        COALESCE(SUM(CASE WHEN p.is_new = 0 OR p.is_new IS NULL THEN (p.sale_price - COALESCE(p.purchase_cost, 0)) ELSE 0 END), 0) as used_profit

      FROM users u
      LEFT JOIN stores s ON u.store_id = s.id
      LEFT JOIN phones p ON p.sale_operator_id = u.id
        AND p.status = 'sold'
        AND DATE(p.salestime) >= ?
        AND DATE(p.salestime) <= ?
      ${retailLatestSaleJoin}
      WHERE u.status = 1
        ${storeFilter.storeId ? 'AND COALESCE(latest_sale.store_id, p.store_id) = ?' : ''}
      GROUP BY u.id, u.username, u.name, s.id, s.name
    `;

    // 批发数据查询
    const wholesaleQuery = `
      SELECT
        u.id as user_id,

        COALESCE(SUM(CASE WHEN p.is_new = 1 THEN 1 ELSE 0 END), 0) as new_wholesale_count,
        COALESCE(SUM(CASE WHEN p.is_new = 1 THEN p.sale_price ELSE 0 END), 0) as new_wholesale_amount,
        COALESCE(SUM(CASE WHEN p.is_new = 1 THEN (p.sale_price - COALESCE(p.purchase_cost, 0)) ELSE 0 END), 0) as new_wholesale_profit,

        COALESCE(SUM(CASE WHEN p.is_new = 0 OR p.is_new IS NULL THEN 1 ELSE 0 END), 0) as used_wholesale_count,
        COALESCE(SUM(CASE WHEN p.is_new = 0 OR p.is_new IS NULL THEN p.sale_price ELSE 0 END), 0) as used_wholesale_amount,
        COALESCE(SUM(CASE WHEN p.is_new = 0 OR p.is_new IS NULL THEN (p.sale_price - COALESCE(p.purchase_cost, 0)) ELSE 0 END), 0) as used_wholesale_profit

      FROM users u
      LEFT JOIN phones p ON p.sale_operator_id = u.id
        AND p.status = 'peer_transfer'
        AND p.wholesale_date IS NOT NULL
        AND DATE(p.wholesale_date) >= ?
        AND DATE(p.wholesale_date) <= ?
      ${wholesaleLatestSaleJoin}
      WHERE u.status = 1
        ${storeFilter.storeId ? 'AND COALESCE(latest_sale.store_id, p.store_id) = ?' : ''}
      GROUP BY u.id
    `;

    log.debug('员工业绩零售查询参数:', retailParams);
    log.debug('员工业绩批发查询参数:', wholesaleParams);

    // 执行查询
    const [retailResults] = await db.execute(retailQuery, retailParams);
    const [wholesaleResults] = await db.execute(wholesaleQuery, wholesaleParams);

    // 合并零售和批发数据
    const wholesaleMap = new Map();
    wholesaleResults.forEach(row => {
      wholesaleMap.set(row.user_id, row);
    });

    const employeeData = retailResults.map(row => {
      const wholesale = wholesaleMap.get(row.user_id) || {
        new_wholesale_count: 0,
        new_wholesale_amount: 0,
        new_wholesale_profit: 0,
        used_wholesale_count: 0,
        used_wholesale_amount: 0,
        used_wholesale_profit: 0
      };

      const newCount = (parseInt(row.new_sales_count) || 0) + (parseInt(wholesale.new_wholesale_count) || 0);
      const newAmount = (parseFloat(row.new_sales_amount) || 0) + (parseFloat(wholesale.new_wholesale_amount) || 0);
      const newProfit = (parseFloat(row.new_profit) || 0) + (parseFloat(wholesale.new_wholesale_profit) || 0);

      const usedCount = (parseInt(row.used_sales_count) || 0) + (parseInt(wholesale.used_wholesale_count) || 0);
      const usedAmount = (parseFloat(row.used_sales_amount) || 0) + (parseFloat(wholesale.used_wholesale_amount) || 0);
      const usedProfit = (parseFloat(row.used_profit) || 0) + (parseFloat(wholesale.used_wholesale_profit) || 0);

      const totalCount = newCount + usedCount;
      const totalAmount = newAmount + usedAmount;
      const totalProfit = newProfit + usedProfit;

      return {
        id: row.user_id,
        name: row.real_name || row.user_name,
        store: row.store_name || '未分配',
        newCount: newCount,
        newAmount: Math.round(newAmount),
        newProfit: Math.round(newProfit),
        usedCount: usedCount,
        usedAmount: Math.round(usedAmount),
        usedProfit: Math.round(usedProfit),
        totalCount: totalCount,
        totalAmount: Math.round(totalAmount),
        totalProfit: Math.round(totalProfit)
      };
    }).filter(emp => emp.totalCount > 0).sort((a, b) => b.totalCount - a.totalCount);

    log.debug('员工业绩统计查询成功，返回', employeeData.length, '条数据');
    ApiResponse.success(res, employeeData);
  } catch (error) {
    log.error('获取员工业绩统计失败:', error);
    log.error('错误堆栈:', error.stack);
    ApiResponse.serverError(res, '获取员工业绩统计失败', error);
  }
});

function generateOptimizationSuggestions() {
  return [
    {
      id: '1',
      priority: 'high',
      title: '优化数据库查询',
      description: '发现多个慢查询，建议添加合适的索引以提升查询性能',
      expectedImprovement: '响应时间减少30%'
    },
    {
      id: '2',
      priority: 'medium',
      title: '启用缓存机制',
      description: '对频繁访问的数据启用缓存，减少数据库压力',
      expectedImprovement: '吞吐量提升50%'
    }
  ];
}

/**
 * 📊 获取划拨批发分析数据
 * GET /api/analytics/transfers-and-allocations
 */
router.get('/transfers-and-allocations', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    log.debug('=== 划拨批发分析 API 被调用 ===');
    const { startDate, endDate, storeId } = req.query;
    log.debug('查询参数:', { startDate, endDate, storeId });

    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();

    // 日期范围参数
    let startStr = '';
    let endStr = '';

    if (startDate && endDate) {
      startStr = startDate;
      endStr = endDate;
    } else {
      // 默认使用本月
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      startStr = monthStart.toISOString().split('T')[0];
      endStr = monthEnd.toISOString().split('T')[0];
    }

    // 门店过滤条件
    const storeFilter = storeId ? ` AND p.store_id = ${parseInt(String(storeId))}` : '';

    // 1. 批发统计 (peer_transfer) - 从 phones 表查询
    // 批发使用 wholesale_date 字段
    const wholesaleQuery = `
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(p.wholesale_price), 0) as amount,
        COALESCE(SUM(p.wholesale_price - COALESCE(p.purchase_cost, 0)), 0) as profit
      FROM phones p
      WHERE p.status = 'peer_transfer'
        AND p.wholesale_date IS NOT NULL
        AND DATE(p.wholesale_date) >= '${startStr}'
        AND DATE(p.wholesale_date) <= '${endStr}'
        ${storeFilter}
    `;

    // 2. 划拨统计 (supplier_proxy) - 从 phones 表查询
    // 划拨使用 Inventorytime 字段
    const allocationQuery = `
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(p.purchase_cost), 0) as amount
      FROM phones p
      WHERE p.status = 'supplier_proxy'
        AND p.Inventorytime IS NOT NULL
        AND DATE(p.Inventorytime) >= '${startStr}'
        AND DATE(p.Inventorytime) <= '${endStr}'
        ${storeFilter}
    `;

    // 3. 本月调货趋势数据（按日期）- 从 phones 表查询
    const trendQuery = `
      SELECT
        date,
        COUNT(*) as count,
        SUM(wholesale_count) as wholesale_count,
        SUM(allocation_count) as allocation_count
      FROM (
        SELECT
          DATE(p.wholesale_date) as date,
          1 as wholesale_count,
          0 as allocation_count
        FROM phones p
        WHERE p.status = 'peer_transfer'
          AND p.wholesale_date IS NOT NULL
          AND DATE(p.wholesale_date) >= '${startStr}'
          AND DATE(p.wholesale_date) <= '${endStr}'
          ${storeFilter}
        UNION ALL
        SELECT
          DATE(p.Inventorytime) as date,
          0 as wholesale_count,
          1 as allocation_count
        FROM phones p
        WHERE p.status = 'supplier_proxy'
          AND p.Inventorytime IS NOT NULL
          AND DATE(p.Inventorytime) >= '${startStr}'
          AND DATE(p.Inventorytime) <= '${endStr}'
          ${storeFilter}
      ) AS combined
      GROUP BY date
      ORDER BY date ASC
    `;

    // 4. 产品排行（按型号）- 批发 TOP10 - 从 phones 表查询
    const wholesaleProductRankQuery = `
      SELECT
        m.name as model_name,
        b.name as brand_name,
        COUNT(*) as count,
        COALESCE(SUM(p.wholesale_price), 0) as amount,
        COALESCE(SUM(p.wholesale_price - COALESCE(p.purchase_cost, 0)), 0) as profit
      FROM phones p
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.status = 'peer_transfer'
        AND p.wholesale_date IS NOT NULL
        AND DATE(p.wholesale_date) >= '${startStr}'
        AND DATE(p.wholesale_date) <= '${endStr}'
        ${storeFilter}
      GROUP BY p.model_id, m.name, b.name
      ORDER BY count DESC
      LIMIT 10
    `;

    // 5. 产品排行（按型号）- 划拨 TOP10 - 从 phones 表查询
    const allocationProductRankQuery = `
      SELECT
        m.name as model_name,
        b.name as brand_name,
        COUNT(*) as count,
        COALESCE(SUM(p.purchase_cost), 0) as amount
      FROM phones p
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.status = 'supplier_proxy'
        AND p.Inventorytime IS NOT NULL
        AND DATE(p.Inventorytime) >= '${startStr}'
        AND DATE(p.Inventorytime) <= '${endStr}'
        ${storeFilter}
      GROUP BY p.model_id, m.name, b.name
      ORDER BY count DESC
      LIMIT 10
    `;

    // 6. 店铺分布 - 从 phones 表查询
    const storeDistributionQuery = `
      SELECT
        p.store_id,
        s.name as store_name,
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN p.status = 'peer_transfer' THEN p.wholesale_price ELSE p.purchase_cost END), 0) as amount,
        SUM(CASE WHEN p.status = 'peer_transfer' THEN 1 ELSE 0 END) as wholesale_count,
        SUM(CASE WHEN p.status = 'supplier_proxy' THEN 1 ELSE 0 END) as allocation_count
      FROM phones p
      LEFT JOIN stores s ON p.store_id = s.id
      WHERE p.status IN ('peer_transfer', 'supplier_proxy')
        AND (
          (p.status = 'peer_transfer' AND p.wholesale_date IS NOT NULL AND DATE(p.wholesale_date) >= '${startStr}' AND DATE(p.wholesale_date) <= '${endStr}')
          OR
          (p.status = 'supplier_proxy' AND p.Inventorytime IS NOT NULL AND DATE(p.Inventorytime) >= '${startStr}' AND DATE(p.Inventorytime) <= '${endStr}')
        )
        ${storeFilter}
      GROUP BY p.store_id, s.name
      ORDER BY amount DESC
    `;

    // 7. 最近记录 - 从 phones 表查询
    const recentRecordsQuery = `
      SELECT
        p.id,
        COALESCE(sal.invoice_number, CONCAT('SALE-', p.sale_id)) as order_no,
        CASE WHEN p.status = 'peer_transfer' THEN 'wholesale' ELSE 'allocation' END as type,
        p.store_id,
        s.name as from_store_name,
        COALESCE(sup.name, '-') as supplier_name,
        b.name as brand_name,
        m.name as model_name,
        COALESCE(cust.name, '-') as to_store_name,
        CASE WHEN p.status = 'peer_transfer' THEN p.wholesale_price ELSE p.purchase_cost END as amount,
        CASE
          WHEN p.status = 'peer_transfer' THEN p.wholesale_price - COALESCE(p.purchase_cost, 0)
          ELSE NULL
        END as profit,
        'completed' as status,
        CASE WHEN p.status = 'peer_transfer' THEN p.wholesale_date ELSE p.Inventorytime END as created_at,
        u.name as operator_name,
        p.brand_id,
        p.model_id,
        p.color_id,
        c.name as color_name
      FROM phones p
      LEFT JOIN stores s ON p.store_id = s.id
      LEFT JOIN suppliers sup ON p.supplier_id = sup.id
      LEFT JOIN sales sal ON p.sale_id = sal.id
      LEFT JOIN customers cust ON sal.customer_id = cust.id
      LEFT JOIN users u ON p.inventory_operator_id = u.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      WHERE p.status IN ('peer_transfer', 'supplier_proxy')
        AND (
          (p.status = 'peer_transfer' AND p.wholesale_date IS NOT NULL AND DATE(p.wholesale_date) >= '${startStr}' AND DATE(p.wholesale_date) <= '${endStr}')
          OR
          (p.status = 'supplier_proxy' AND p.Inventorytime IS NOT NULL AND DATE(p.Inventorytime) >= '${startStr}' AND DATE(p.Inventorytime) <= '${endStr}')
        )
        ${storeFilter}
      ORDER BY created_at DESC
      LIMIT 20
    `;

    // 并行执行所有查询
    const [
      wholesaleRows,
      allocationRows,
      trendRows,
      wholesaleProductRankRows,
      allocationProductRankRows,
      storeDistributionRows,
      recentRecordsRows
    ] = await Promise.all([
      db.execute(wholesaleQuery),
      db.execute(allocationQuery),
      db.execute(trendQuery),
      db.execute(wholesaleProductRankQuery),
      db.execute(allocationProductRankQuery),
      db.execute(storeDistributionQuery),
      db.execute(recentRecordsQuery)
    ]);

    log.debug('📊 批发查询结果:', wholesaleRows[0]);
    log.debug('📊 划拨查询结果:', allocationRows[0]);

    const wholesale = wholesaleRows[0]?.[0] || { count: 0, amount: 0, profit: 0 };
    const allocation = allocationRows[0]?.[0] || { count: 0, amount: 0 };

    // 计算调货统计
    const transferCount = parseInt(wholesale.count || 0) + parseInt(allocation.count || 0);

    // 处理趋势数据（本月按日期）
    const trends = (trendRows[0] || []).map(row => ({
      date: row.date,
      wholesale: parseInt(row.wholesale_count || 0),
      allocation: parseInt(row.allocation_count || 0)
    }));

    // 处理批发产品排行 TOP10
    const wholesaleProductRanks = (wholesaleProductRankRows[0] || []).map(row => ({
      name: `${row.brand_name || ''} ${row.model_name || '未知型号'}`.trim(),
      count: parseInt(row.count || 0),
      amount: parseFloat(row.amount || 0),
      profit: parseFloat(row.profit || 0)
    }));

    // 处理划拨产品排行 TOP10
    const allocationProductRanks = (allocationProductRankRows[0] || []).map(row => ({
      name: `${row.brand_name || ''} ${row.model_name || '未知型号'}`.trim(),
      count: parseInt(row.count || 0),
      amount: parseFloat(row.amount || 0)
    }));

    // 处理店铺分布
    const storeData = (storeDistributionRows[0] || []).map(row => ({
      store_id: row.store_id,
      store_name: row.store_name || '未知店铺',
      count: parseInt(row.count || 0),
      amount: parseFloat(row.amount || 0),
      wholesale_count: parseInt(row.wholesale_count || 0),
      allocation_count: parseInt(row.allocation_count || 0)
    }));

    // 处理最近记录
    const records = (recentRecordsRows[0] || []).map(row => ({
      id: row.id,
      order_no: row.order_no || `TF${row.id}`,
      type: row.type === 'wholesale' ? 'wholesale' : 'allocation',
      from_store_id: row.store_id,
      from_store_name: row.from_store_name || '总店',
      supplier_name: row.supplier_name || '-',
      to_store_id: null,
      to_store_name: row.to_store_name || '客户',
      brand_name: row.brand_name || '',
      model_name: row.model_name || '',
      color_name: row.color_name || '',
      quantity: 1,
      amount: parseFloat(row.amount || 0),
      profit: row.profit !== null ? parseFloat(row.profit) : null,
      status: row.status,
      created_at: row.created_at ? new Date(row.created_at).toLocaleString('zh-CN') : '',
      operator_name: row.operator_name || ''
    }));

    // 返回结果
    const result = {
      transfer: {
        transferCount,
        inboundCount: parseInt(allocation.count || 0),
        outboundCount: parseInt(wholesale.count || 0),
        pendingCount: 0,
        transferGrowth: 0 // 环比增长率（可后续优化）
      },
      allocation: {
        allocationCount: parseInt(allocation.count || 0),
        wholesaleCount: parseInt(wholesale.count || 0),
        allocationAmount: parseFloat(allocation.amount || 0),
        wholesaleAmount: parseFloat(wholesale.amount || 0),
        wholesaleProfit: parseFloat(wholesale.profit || 0),
        allocationGrowth: 0,
        wholesaleGrowth: 0
      },
      trends,
      wholesaleProductRanks,
      allocationProductRanks,
      storeDistribution: storeData,
      records,
      monthRange: {
        start: startStr,
        end: endStr
      }
    };

    log.debug('✅ 划拨批发分析数据查询成功');
    log.debug('返回数据:', JSON.stringify(result, null, 2));
    ApiResponse.success(res, result, '获取划拨批发分析数据成功');
  } catch (error) {
    log.error('❌ 获取划拨批发分析数据失败:', error);
    ApiResponse.serverError(res, '获取划拨批发分析数据失败', error);
  }
});

// ==================== 员工分析相关API ====================

/**
 * 获取员工分析详情数据
 * 包括：员工总数、在职员工、工资总额、出勤率、销售数据等
 */
router.get('/employees/detail', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    log.debug('[员工分析] API被调用');

    if (!isConnected()) {
      log.error('[员工分析] 数据库未连接');
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const { startDate, endDate, storeId } = req.query;
    log.debug('[员工分析] 请求参数:', { startDate, endDate, storeId });

    const db = getDatabase();

    // 确定查询的日期范围
    let queryStartDate = startDate;
    let queryEndDate = endDate;
    let useCustomRange = !!(startDate && endDate);

    // 如果没有提供日期范围，使用当前月份
    if (!useCustomRange) {
      const currentMonthRange = getBeijingMonthRange(0);
      queryStartDate = currentMonthRange.startDate;
      queryEndDate = currentMonthRange.endDate;
    }

    // 构建店铺筛选条件
    const storeFilter = storeId && storeId !== '' && storeId !== 'undefined' && storeId !== 'null'
      ? `AND store_id = ${parseInt(storeId)}`
      : '';

    log.debug('[员工分析] 开始查询数据，日期范围:', { queryStartDate, queryEndDate });

    // 并行查询所有员工统计数据
    const [
      totalEmployees,
      activeEmployees,
      stores,
      newPhoneSales,
      usedPhoneSales,
      totalSalesAmount,
      currentMonthPayroll
    ] = await Promise.all([
      // 员工总数 - 简化查询条件
      db.execute(`SELECT COUNT(*) as count FROM users WHERE 1=1 ${storeFilter}`),
      // 在职员工
      db.execute(`SELECT COUNT(*) as count FROM users WHERE status = 1 ${storeFilter}`),
      // 店铺数量
      db.execute('SELECT COUNT(DISTINCT store_id) as count FROM users WHERE store_id IS NOT NULL'),
      // 指定日期范围内全新机销量
      db.execute(
        `SELECT COUNT(*) as count
         FROM phones
         WHERE status = 'sold' AND is_new = 1 AND DATE(salestime) >= ? AND DATE(salestime) <= ? ${storeFilter}`,
        [queryStartDate, queryEndDate]
      ),
      // 指定日期范围内二手机销量
      db.execute(
        `SELECT COUNT(*) as count
         FROM phones
         WHERE status = 'sold' AND is_new = 0 AND DATE(salestime) >= ? AND DATE(salestime) <= ? ${storeFilter}`,
        [queryStartDate, queryEndDate]
      ),
      // 指定日期范围内销售总额
      db.execute(
        `SELECT COALESCE(SUM(sale_price), 0) as total
         FROM phones
         WHERE status = 'sold' AND DATE(salestime) >= ? AND DATE(salestime) <= ? ${storeFilter}`,
        [queryStartDate, queryEndDate]
      ),
      calculatePayrollSnapshot(db, queryStartDate, queryEndDate)
    ]);

    log.debug('📊 [员工分析] 查询结果:', {
      totalEmployees: totalEmployees[0][0],
      activeEmployees: activeEmployees[0][0],
      currentMonthPayroll,
      stores: stores[0][0],
      newPhoneSales: newPhoneSales[0][0],
      usedPhoneSales: usedPhoneSales[0][0],
      totalSalesAmount: totalSalesAmount[0][0]
    });

    const totalCount = totalEmployees[0][0]?.count || 0;
    const activeCount = activeEmployees[0][0]?.count || 0;
    const totalSalary = currentMonthPayroll.totalSalary || 0;
    const baseSalaryTotal = currentMonthPayroll.baseSalaryTotal || 0;
    const commissionTotal = currentMonthPayroll.commissionTotal || 0;
    const overtimePayTotal = currentMonthPayroll.overtimePayTotal || 0;
    const deductionTotal = currentMonthPayroll.deductionTotal || 0;
    const storeCount = stores[0][0]?.count || 0;
    const newCount = newPhoneSales[0][0]?.count || 0;
    const usedCount = usedPhoneSales[0][0]?.count || 0;
    const totalSales = totalSalesAmount[0][0]?.total || 0;

    // 计算平均出勤率（指定日期范围或本月）
    const attendanceQuery = `
      SELECT
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(*) as total
      FROM attendance_records
      WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
        AND status != 'cancelled'
    `;
    const [attendanceResult] = await db.execute(attendanceQuery, [queryStartDate, queryEndDate]);
    const avgAttendance = attendanceResult[0]?.total > 0
      ? Math.round((attendanceResult[0].approved / attendanceResult[0].total) * 100)
      : 95;

    log.debug('📊 [员工分析] 出勤率查询结果:', attendanceResult[0]);

    // 人均销售额
    const avgSales = activeCount > 0 ? Math.round(totalSales / activeCount) : 0;

    ApiResponse.success(res, {
      totalCount,
      activeCount,
      totalSalary,
      baseSalaryTotal,
      commissionTotal,
      overtimePayTotal,
      deductionTotal,
      templateEmployeeCount: currentMonthPayroll.templateEmployeeCount || 0,
      calculatedEmployeeCount: currentMonthPayroll.calculatedEmployeeCount || 0,
      failedEmployeeCount: currentMonthPayroll.failedEmployeeCount || 0,
      avgAttendance,
      storeCount,
      newCount,
      usedCount,
      avgSales,
      totalTrend: 'up',
      totalChange: 5.2,
      salaryTrend: 'stable',
      salaryChange: 0
    }, '获取员工分析数据成功');
  } catch (error) {
    log.error('获取员工分析数据失败:', error);
    ApiResponse.serverError(res, '获取员工分析数据失败', error);
  }
});

/**
 * 获取员工销售业绩排行
 * 支持按不同指标排序：总销售额、全新机销量、二手机销量、批发量、划拨量
 */
router.get('/employees/performance', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    log.debug('[员工业绩] API被调用');

    const { metric = 'totalSales', limit = 20 } = req.query;

    if (!isConnected()) {
      log.error('[员工业绩] 数据库未连接');
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();
    const limitNum = parseInt(String(limit)) || 20;

    log.debug('[员工业绩] 查询参数:', { metric, limit });

    // 根据排序指标确定 ORDER BY
    let orderBy = 'total_sales DESC';
    switch (metric) {
      case 'newSales':
        orderBy = 'new_sales DESC';
        break;
      case 'usedSales':
        orderBy = 'used_sales DESC';
        break;
      case 'wholesale':
        orderBy = 'wholesale_count DESC';
        break;
      case 'allocation':
        orderBy = 'allocation_count DESC';
        break;
      default:
        orderBy = 'total_sales DESC';
    }

    // 查询员工业绩数据（本月）- 简化版本
    const performanceQuery = `
      SELECT
        u.id,
        u.name,
        u.store_id,
        s.name as store_name,
        COALESCE(SUM(CASE WHEN p.is_new = 1 AND p.status = 'sold' AND MONTH(p.salestime) = MONTH(CURDATE()) AND YEAR(p.salestime) = YEAR(CURDATE()) THEN 1 ELSE 0 END), 0) as new_sales,
        COALESCE(SUM(CASE WHEN p.is_new = 0 AND p.status = 'sold' AND MONTH(p.salestime) = MONTH(CURDATE()) AND YEAR(p.salestime) = YEAR(CURDATE()) THEN 1 ELSE 0 END), 0) as used_sales,
        COALESCE(SUM(CASE WHEN p.status = 'peer_transfer' AND MONTH(p.wholesale_date) = MONTH(CURDATE()) AND YEAR(p.wholesale_date) = YEAR(CURDATE()) THEN 1 ELSE 0 END), 0) as wholesale_count,
        COALESCE(SUM(CASE WHEN p.status = 'supplier_proxy' AND MONTH(p.wholesale_date) = MONTH(CURDATE()) AND YEAR(p.wholesale_date) = YEAR(CURDATE()) THEN 1 ELSE 0 END), 0) as allocation_count,
        COALESCE(SUM(CASE WHEN p.status = 'sold' AND MONTH(p.salestime) = MONTH(CURDATE()) AND YEAR(p.salestime) = YEAR(CURDATE()) THEN p.sale_price ELSE 0 END), 0) as total_sales
      FROM users u
      LEFT JOIN stores s ON u.store_id = s.id
      LEFT JOIN phones p ON p.sale_operator_id = u.id AND MONTH(p.salestime) = MONTH(CURDATE()) AND YEAR(p.salestime) = YEAR(CURDATE())
      WHERE (u.status = 1 OR u.status = 'active')
      GROUP BY u.id, u.name, u.store_id, s.name
      ORDER BY ${orderBy}
      LIMIT ${limitNum}
    `;

    log.debug('[员工业绩] 执行查询');
    const [performanceData] = await db.execute(performanceQuery, []);
    log.debug('[员工业绩] 查询结果数量:', performanceData.length);

    // 获取本月实时工资数据（按工资计算口径，不依赖已生成工资记录）
    const currentMonthRange = getBeijingMonthRange(0);
    const employeeIds = performanceData.map(e => e.id);

    let salaryData = {};
    if (employeeIds.length > 0) {
      const salaryResults = await SalaryCalculatorService.batchCalculateSalary(
        employeeIds,
        currentMonthRange.startDate,
        currentMonthRange.endDate,
        {
          logExpectedErrors: false
        }
      );

      salaryData = Object.fromEntries(
        salaryResults
          .filter(item => item.success && item.data)
          .map(item => {
            const salary = item.data.base_salary +
              item.data.commission_amount +
              item.data.overtime_pay -
              (item.data.leave_deduction + item.data.other_deduction);

            return [item.data.employee_id, salary];
          })
      );
    }

    // 获取出勤率数据
    let attendanceData = {};
    if (employeeIds.length > 0) {
      // 使用直接插入ID的方式避免参数绑定问题
      const attendanceQuery = `
        SELECT
          u.id as employee_id,
          COUNT(CASE WHEN ar.status = 'approved' THEN 1 END) as approved,
          COUNT(*) as total
        FROM users u
        LEFT JOIN attendance_records ar ON ar.employee_id = u.id
          AND DATE(ar.created_at) >= DATE_FORMAT(NOW(), '%Y-%m-01')
          AND ar.status != 'cancelled'
        WHERE u.id IN (${employeeIds.join(',')})
        GROUP BY u.id
      `;
      const [attendanceResult] = await db.execute(attendanceQuery, []);
      attendanceData = Object.fromEntries(
        attendanceResult.map(a => [
          a.employee_id,
          a.total > 0 ? ((a.approved / a.total) * 100) : 95
        ])
      );
    }

    // 组合结果并计算趋势
    const result = performanceData.map(emp => {
      const sales = parseFloat(emp.total_sales) || 0;
      const trend = sales > 50000 ? 'up' : sales > 20000 ? 'stable' : 'down';

      return {
        ...emp,
        new_sales: parseInt(emp.new_sales) || 0,
        used_sales: parseInt(emp.used_sales) || 0,
        wholesale_count: parseInt(emp.wholesale_count) || 0,
        allocation_count: parseInt(emp.allocation_count) || 0,
        total_sales: sales,
        salary: Math.round(salaryData[emp.id] || 0),
        attendance_rate: Math.round(attendanceData[emp.id] || 95),
        trend
      };
    });

    log.debug('[员工业绩] 返回数据数量:', result.length);
    ApiResponse.success(res, result, '获取员工业绩排行成功');
  } catch (error) {
    log.error('[员工业绩] 错误:', error);
    ApiResponse.serverError(res, '获取员工业绩排行失败', error);
  }
});

/**
 * 获取员工角色分布数据
 */
router.get('/employees/roles', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();

    // 从 user_roles 和 roles 表关联获取角色分布
    const query = `
      SELECT
        r.name as role_name,
        COUNT(ur.user_id) as count
      FROM user_roles ur
      INNER JOIN roles r ON ur.role_id = r.id
      INNER JOIN users u ON ur.user_id = u.id
      WHERE ur.status = 'active'
        AND u.status = 1
        AND r.is_active = 1
      GROUP BY r.id, r.name
      ORDER BY count DESC
    `;

    const [result] = await db.execute(query);

    const data = result.map(item => ({
      name: item.role_name,
      value: item.count
    }));

    ApiResponse.success(res, data, '获取员工角色分布成功');
  } catch (error) {
    log.error('获取员工角色分布失败:', error);
    ApiResponse.serverError(res, '获取员工角色分布失败', error);
  }
});

/**
 * 获取员工工资趋势数据
 */
router.get('/employees/salary-trend', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    const { months: monthParam = 6 } = req.query;
    const monthCount = parseInt(String(monthParam)) || 6;

    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();

    const query = `
      SELECT
        DATE_FORMAT(period_start, '%Y-%m') as month,
        COALESCE(SUM(net_salary), 0) as total
      FROM salary_records
      WHERE status != 'cancelled'
        AND period_start >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL ? MONTH)
      GROUP BY DATE_FORMAT(period_start, '%Y-%m')
      ORDER BY month ASC
    `;

    const [result] = await db.execute(query, [monthCount]);

    const months = [];
    const salaries = [];
    const now = new Date();

    // 生成最近N个月的完整数据
    for (let i = monthCount - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = date.toISOString().slice(0, 7);
      months.push(`${date.getMonth() + 1}月`);

      const found = result.find(r => r.month === monthStr);
      salaries.push(found ? Math.round(found.total) : 0);
    }

    ApiResponse.success(res, { months, salaries }, '获取工资趋势成功');
  } catch (error) {
    log.error('获取工资趋势失败:', error);
    ApiResponse.serverError(res, '获取工资趋势失败', error);
  }
});

/**
 * 获取员工出勤统计
 */
router.get('/employees/attendance', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();

    const query = `
      SELECT
        record_type,
        status,
        COUNT(*) as count
      FROM attendance_records
      WHERE DATE(created_at) >= DATE_FORMAT(NOW(), '%Y-%m-01')
        AND status != 'cancelled'
      GROUP BY record_type, status
    `;

    const [result] = await db.execute(query);

    // 统计各类出勤情况
    const stats = {
      normal: 0,
      late: 0,
      early: 0,
      absent: 0,
      leave: 0
    };

    result.forEach(item => {
      if (item.status === 'approved') {
        switch (item.record_type) {
          case 'normal':
            stats.normal += item.count;
            break;
          case 'late':
            stats.late += item.count;
            break;
          case 'early_leave':
            stats.early += item.count;
            break;
          case 'absent':
            stats.absent += item.count;
            break;
          case 'leave':
            stats.leave += item.count;
            break;
        }
      }
    });

    const total = Object.values(stats).reduce((sum, val) => sum + val, 0) || 1;

    const data = [
      { value: Math.round((stats.normal / total) * 100) || 85, name: '正常', color: '#52c41a' },
      { value: Math.round((stats.late / total) * 100) || 8, name: '迟到', color: '#faad14' },
      { value: Math.round((stats.early / total) * 100) || 4, name: '早退', color: '#fa8c16' },
      { value: Math.round((stats.absent / total) * 100) || 3, name: '缺勤', color: '#ff4d4f' }
    ];

    ApiResponse.success(res, data, '获取出勤统计成功');
  } catch (error) {
    log.error('获取出勤统计失败:', error);
    ApiResponse.serverError(res, '获取出勤统计失败', error);
  }
});

/**
 * 获取考勤记录（含异常）
 */
router.get('/attendance/summary', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();

    const summaryQuery = `
      SELECT
        COUNT(*) as total_records,
        COUNT(DISTINCT ar.employee_id) as employee_count,
        SUM(CASE WHEN ar.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN ar.status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN ar.record_type IN ('late', 'early_leave', 'absent') THEN 1 ELSE 0 END) as abnormal_count,
        SUM(CASE WHEN ar.record_type IN ('leave', 'monthly_leave') THEN 1 ELSE 0 END) as leave_count,
        SUM(CASE WHEN ar.record_type = 'overtime' THEN 1 ELSE 0 END) as overtime_count
      FROM attendance_records ar
      WHERE ar.status != 'cancelled'
        AND ar.record_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `;

    const recordsQuery = `
      SELECT
        DATE_FORMAT(ar.record_date, '%Y-%m-%d') as record_date,
        u.name as employee_name,
        s.name as store_name,
        ar.record_type,
        ar.leave_type,
        ar.leave_days,
        ar.overtime_hours,
        ar.status
        ,DATE_FORMAT(ar.approved_at, '%Y-%m-%d %H:%i') as approved_at
        ,ar.approval_note
      FROM attendance_records ar
      LEFT JOIN users u ON ar.employee_id = u.id
      LEFT JOIN stores s ON u.store_id = s.id
      WHERE ar.status != 'cancelled'
        AND ar.record_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      ORDER BY ar.record_date DESC, ar.created_at DESC
      LIMIT 30
    `;

    const alertsQuery = `
      SELECT
        DATE_FORMAT(ar.record_date, '%Y-%m-%d') as record_date,
        u.name as employee_name,
        s.name as store_name,
        ar.record_type,
        ar.status
      FROM attendance_records ar
      LEFT JOIN users u ON ar.employee_id = u.id
      LEFT JOIN stores s ON u.store_id = s.id
      WHERE ar.record_type IN ('late', 'early_leave', 'absent')
        AND ar.status != 'cancelled'
        AND ar.record_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      ORDER BY ar.record_date DESC, ar.created_at DESC
      LIMIT 20
    `;

    const [summaryRows, recordRows, alertRows] = await Promise.all([
      db.execute(summaryQuery),
      db.execute(recordsQuery),
      db.execute(alertsQuery)
    ]);

    const summaryRow = summaryRows[0]?.[0] || {};
    const formatRecordType = (recordType, leaveType) => {
      const typeMap = {
        late: '迟到',
        early_leave: '早退',
        absent: '缺勤',
        leave: '请假',
        monthly_leave: '月休',
        overtime: '加班',
        normal: '正常'
      };

      if (recordType === 'leave' && leaveType) {
        return `${typeMap[recordType] || recordType}·${leaveType}`;
      }

      return typeMap[recordType] || recordType || '未知';
    };

    const records = (recordRows[0] || []).map(item => {
      let detail = '-';

      if (item.record_type === 'leave') {
        detail = `${parseFloat(item.leave_days) || 0}天`;
      } else if (item.record_type === 'monthly_leave') {
        detail = `${parseFloat(item.leave_days || item.monthly_leave_days) || 0}天`;
      } else if (item.record_type === 'overtime') {
        detail = `${parseFloat(item.overtime_hours) || 0}小时`;
      }

      return {
        date: item.record_date,
        employee_name: item.employee_name || '未知',
        store_name: item.store_name || '',
        type: formatRecordType(item.record_type, item.leave_type),
        status: item.status === 'pending' ? 'pending' : item.status === 'approved' ? 'approved' : 'processed',
        detail,
        approved_at: item.approved_at || '',
        approval_note: item.approval_note || ''
      };
    });

    const alerts = (alertRows[0] || []).map(item => ({
      date: item.record_date,
      employee_name: item.employee_name || '未知',
      store_name: item.store_name || '',
      type: formatRecordType(item.record_type),
      status: item.status === 'pending' ? 'pending' : 'processed'
    }));

    const summary = {
      totalRecords: parseInt(summaryRow.total_records, 10) || 0,
      employeeCount: parseInt(summaryRow.employee_count, 10) || 0,
      pendingCount: parseInt(summaryRow.pending_count, 10) || 0,
      approvedCount: parseInt(summaryRow.approved_count, 10) || 0,
      abnormalCount: parseInt(summaryRow.abnormal_count, 10) || 0,
      leaveCount: parseInt(summaryRow.leave_count, 10) || 0,
      overtimeCount: parseInt(summaryRow.overtime_count, 10) || 0
    };

    ApiResponse.success(res, { summary, records, alerts }, '获取考勤记录成功');
  } catch (error) {
    log.error('获取考勤记录失败:', error);
    ApiResponse.serverError(res, '获取考勤记录失败', error);
  }
});

// 销售预测 API - 基于历史数据预测具体型号+颜色+内存组合的销售趋势
router.get('/sales-forecast', unifiedAuth, requireBusinessUser, async (req, res) => {
  try {
    const { period = 'month', storeId, limit = 10 } = req.query;
    log.debug('=== 销售预测 API 被调用 ===');
    log.debug('查询参数:', { period, storeId, limit });

    if (!isConnected()) {
      return ApiResponse.serverError(res, '数据库连接失败');
    }

    const db = getDatabase();

    // 使用多时间窗口加权组合计算"最有可能销售"的产品
    // 权重：30天×50% + 60天×30% + 90天×20%
    const now = new Date();

    // 计算各时间窗口的日期
    const day30Ago = new Date(now);
    day30Ago.setDate(day30Ago.getDate() - 30);
    const day60Ago = new Date(now);
    day60Ago.setDate(day60Ago.getDate() - 60);
    const day90Ago = new Date(now);
    day90Ago.setDate(day90Ago.getDate() - 90);

    const day30AgoStr = formatDateString(day30Ago);
    const day60AgoStr = formatDateString(day60Ago);
    const day90AgoStr = formatDateString(day90Ago);
    const todayStr = formatDateString(now);

    const storeCondition = storeId ? 'AND p.store_id = ?' : '';

    // 查询"最有可能销售"的产品组合（多时间窗口加权算法）
    // 综合得分 = 30天销量×0.5 + 60天销量×0.3 + 90天销量×0.2
    const topProductsQuery = `
      SELECT
        b.name as brand_name,
        m.name as model_name,
        c.name as color_name,
        mem.size as memory,
        COALESCE(SUM(CASE WHEN DATE(p.salestime) >= ? THEN 1 ELSE 0 END), 0) as sales_30d,
        COALESCE(SUM(CASE WHEN DATE(p.salestime) >= ? AND DATE(p.salestime) < ? THEN 1 ELSE 0 END), 0) as sales_31_60d,
        COALESCE(SUM(CASE WHEN DATE(p.salestime) >= ? AND DATE(p.salestime) < ? THEN 1 ELSE 0 END), 0) as sales_61_90d,
        COUNT(p.id) as total_sales,
        ROUND(
          COALESCE(SUM(CASE WHEN DATE(p.salestime) >= ? THEN 1 ELSE 0 END), 0) * 0.5 +
          COALESCE(SUM(CASE WHEN DATE(p.salestime) >= ? AND DATE(p.salestime) < ? THEN 1 ELSE 0 END), 0) * 0.3 +
          COALESCE(SUM(CASE WHEN DATE(p.salestime) >= ? AND DATE(p.salestime) < ? THEN 1 ELSE 0 END), 0) * 0.2,
          2
        ) as weighted_score
      FROM phones p
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      WHERE p.status = 'sold'
        AND p.salestime IS NOT NULL
        AND DATE(p.salestime) >= ?
        AND m.name IS NOT NULL
        AND c.name IS NOT NULL
        AND mem.size IS NOT NULL
        ${storeCondition}
      GROUP BY b.name, m.name, c.name, mem.size
      ORDER BY weighted_score DESC, total_sales DESC
      LIMIT 10
    `;

    // 参数顺序：30天开始, 60天开始, 30天开始, 90天开始, 60天开始, 加权计算的重复参数, 90天开始
    const topProductsParams = [
      day30AgoStr,        // sales_30d
      day60AgoStr, day30AgoStr,  // sales_31_60d
      day90AgoStr, day60AgoStr,  // sales_61_90d
      day30AgoStr,        // weighted: 30d
      day60AgoStr, day30AgoStr,  // weighted: 31-60d
      day90AgoStr, day60AgoStr,  // weighted: 61-90d
      day90AgoStr         // WHERE条件
    ];
    if (storeId) {
      topProductsParams.push(parseInt(storeId));
    }

    const [topProducts] = await db.query(topProductsQuery, topProductsParams);

    log.debug(`📊 最有可能销售的产品（加权算法 30天×50% + 60天×30% + 90天×20%）:`);
    topProducts.forEach((p, i) => {
      log.debug(`   ${i+1}. ${p.brand_name} ${p.model_name} ${p.color_name} ${p.memory}`);
      log.debug(`      30天:${p.sales_30d}台 + 31-60天:${p.sales_31_60d}台 + 61-90天:${p.sales_61_90d}台`);
      log.debug(`      加权得分:${p.weighted_score}, 总销量:${p.total_sales}`);
    });

    if (topProducts.length === 0) {
      return ApiResponse.success(res, {
        combinations: [],
        summary: {
          total_combinations: 0,
          avg_confidence: 0
        }
      });
    }

    // 获取这些产品组合的详细历史数据（用于预测）
    const mergedProducts = topProducts;

    // 构建 IN 查询条件
    const productConditions = mergedProducts.map(p =>
      `(b.name = ? AND m.name = ? AND c.name = ? AND mem.size = ?)`
    ).join(' OR ');

    const queryParams = [];
    queryParams.push(day90AgoStr, todayStr);
    mergedProducts.forEach(p => {
      queryParams.push(p.brand_name, p.model_name, p.color_name, p.memory);
    });
    if (storeId) {
      queryParams.push(parseInt(storeId));
    }

    // 获取具体型号+颜色+内存组合的销售历史数据
    const combinationQuery = `
      SELECT
        b.name as brand_name,
        m.name as model_name,
        c.name as color_name,
        mem.size as memory,
        COUNT(p.id) as sales_count,
        COALESCE(SUM(p.sale_price), 0) as total_revenue,
        COALESCE(SUM(p.sale_price - COALESCE(p.purchase_cost, 0)), 0) as total_profit,
        DATE(p.salestime) as sale_date
      FROM phones p
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      WHERE p.status = 'sold'
        AND p.salestime IS NOT NULL
        AND DATE(p.salestime) >= ?
        AND DATE(p.salestime) <= ?
        AND m.name IS NOT NULL
        AND c.name IS NOT NULL
        AND mem.size IS NOT NULL
        AND (${productConditions})
        ${storeCondition}
      GROUP BY b.name, m.name, c.name, mem.size, DATE(p.salestime)
      ORDER BY sale_date DESC
    `;

    // 执行查询
    const [results] = await db.execute(combinationQuery, queryParams);

    // 处理预测数据
    const forecastData = processCombinationForecast(results, period, parseInt(limit));

    ApiResponse.success(res, {
      combinations: forecastData,
      period,
      historicalDays: 90,
      forecastDays: period === 'week' ? 7 : period === 'month' ? 30 : 90
    });
  } catch (error) {
    log.error('获取销售预测失败:', error);
    ApiResponse.serverError(res, '获取销售预测失败', error);
  }
});

// 处理型号+颜色+内存组合预测数据
function processCombinationForecast(rawData, period, limit) {
  // 按组合聚合数据
  const combinationMap = new Map();

  rawData.forEach(row => {
    const key = `${row.brand_name}_${row.model_name}_${row.color_name}_${row.memory}`;
    if (!combinationMap.has(key)) {
      combinationMap.set(key, {
        brand_name: row.brand_name,
        model_name: row.model_name,
        color_name: row.color_name,
        memory: row.memory,
        display_name: `${row.brand_name} ${row.model_name} ${row.color_name} ${row.memory}`,
        historical_sales: [],
        daily_sales: {},
        total_sales: 0,
        total_revenue: 0,
        total_profit: 0
      });
    }

    const combination = combinationMap.get(key);
    const dateStr = row.sale_date ? new Date(row.sale_date).toISOString().split('T')[0] : '';

    combination.historical_sales.push({
      date: dateStr,
      count: parseInt(row.sales_count) || 0
    });

    // 按日期聚合
    if (!combination.daily_sales[dateStr]) {
      combination.daily_sales[dateStr] = 0;
    }
    combination.daily_sales[dateStr] += parseInt(row.sales_count) || 0;

    combination.total_sales += parseInt(row.sales_count) || 0;
    combination.total_revenue += parseFloat(row.total_revenue) || 0;
    combination.total_profit += parseFloat(row.total_profit) || 0;
  });

  // 计算预测值
  const forecastData = [];
  combinationMap.forEach((combination, key) => {
    // 只保留有销售记录的组合（至少有1次销售）
    if (combination.total_sales === 0) return;

    // 计算日均销量
    const avgDailySales = combination.total_sales / 90;

    // 计算预测周期的销量
    let forecastDays = 30;
    if (period === 'week') forecastDays = 7;
    else if (period === 'quarter') forecastDays = 90;

    const predictedSales = Math.round(avgDailySales * forecastDays);
    const predictedRevenue = Math.round((combination.total_revenue / combination.total_sales) * predictedSales);
    const predictedProfit = Math.round((combination.total_profit / combination.total_sales) * predictedSales);

    // 计算趋势（最近30天 vs 之前60天）
    const now = new Date();
    const recent30DaysAgo = new Date(now);
    recent30DaysAgo.setDate(recent30DaysAgo.getDate() - 30);
    const recent60DaysAgo = new Date(now);
    recent60DaysAgo.setDate(recent60DaysAgo.getDate() - 90);

    let recent30DaysSales = 0;
    let previous60DaysSales = 0;

    Object.keys(combination.daily_sales).forEach(dateStr => {
      const date = new Date(dateStr);
      if (date >= recent30DaysAgo) {
        recent30DaysSales += combination.daily_sales[dateStr];
      } else if (date >= recent60DaysAgo) {
        previous60DaysSales += combination.daily_sales[dateStr];
      }
    });

    const trend = previous60DaysSales > 0
      ? ((recent30DaysSales / 30) / (previous60DaysSales / 60) - 1) * 100
      : 0;

    // 生成历史和预测的时间序列数据（用于图表）
    const timeSeriesData = generateTimeSeries(combination.daily_sales, period, combination.total_sales, combination.historical_sales.length);

    forecastData.push({
      brand_name: combination.brand_name,
      model_name: combination.model_name,
      color_name: combination.color_name,
      memory: combination.memory,
      display_name: combination.display_name,
      actual_sales: combination.total_sales,
      actual_revenue: Math.round(combination.total_revenue),
      actual_profit: Math.round(combination.total_profit),
      predicted_sales: predictedSales,
      predicted_revenue: predictedRevenue,
      predicted_profit: predictedProfit,
      trend: parseFloat(trend.toFixed(1)),
      confidence: calculateConfidence(combination.historical_sales),
      time_series: timeSeriesData
    });
  });

  // 按实际销量排序，取前 N 个
  return forecastData.sort((a, b) => b.actual_sales - a.actual_sales).slice(0, limit);
}

// 生成时间序列数据（历史 + 预测）- 基于实际销售数据的智能预测
function generateTimeSeries(dailySales, period, totalSales, historicalDays) {
  const result = {
    dates: [],
    actual: [],
    predicted: [],
    upper_bound: [],
    lower_bound: []
  };

  // 生成过去90天的历史数据（使用本地时间，适配北京时间）
  const now = new Date();
  const last90DaysData = [];
  const last90DaysDates = [];

  for (let i = 89; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = formatDateString(date); // 使用本地时间（北京时间）
    const sales = dailySales[dateStr] || 0;

    last90DaysData.push(sales);
    last90DaysDates.push(dateStr);

    // 显示最近30天的历史数据在图表上（包括今天）
    if (i <= 29) {
      result.dates.push(dateStr);
      result.actual.push(sales);
      result.predicted.push(null);
      result.upper_bound.push(null);
      result.lower_bound.push(null);
    }
  }

  // 如果没有任何销售数据，直接返回全0预测
  if (totalSales === 0) {
    const forecastDays = period === 'week' ? 7 : period === 'month' ? 30 : 90;
    for (let i = 1; i <= forecastDays; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      result.dates.push(formatDateString(date));
      result.actual.push(null);
      result.predicted.push(0);
      result.upper_bound.push(0);
      result.lower_bound.push(0);
    }
    return result;
  }

  // 分析90天数据，分为三个时间段：最近30天、31-60天、61-90天
  const last30Days = last90DaysData.slice(-30);
  const days31to60 = last90DaysData.slice(-60, -30);
  const days61to90 = last90DaysData.slice(-90, -60);

  // 计算每个时间段的销售统计
  const stats30 = calculatePeriodStats(last30Days);
  const stats60 = calculatePeriodStats(days31to60);
  const stats90 = calculatePeriodStats(days61to90);

  // 产品类型分类
  let productType = 'normal';
  let productTypeDesc = '正常销售';

  // 热销产品：最近30天销售频率>30%（即30天内至少9天有销售），且总销量>=5台
  if (stats30.frequency > 0.3 && stats30.totalSales >= 5) {
    productType = 'hot';
    productTypeDesc = '热销产品';
  }
  // 高频产品：最近30天销售频率>50%（即30天内至少15天有销售）
  else if (stats30.frequency > 0.5) {
    productType = 'hot';
    productTypeDesc = '高频销售';
  }
  // 滞销产品：最近30天销售频率<10%（即30天内少于3天有销售）
  else if (stats30.frequency < 0.1) {
    productType = 'slow';
    productTypeDesc = '滞销产品';
  }
  // 新品：最近30天有销售，但之前60天没有或很少
  else if (stats30.totalSales > 0 && stats60.totalSales === 0 && stats90.totalSales === 0) {
    productType = 'new';
    productTypeDesc = '新品';
  }

  // 根据产品类型使用不同的预测策略
  // 核心算法：多时间窗口加权组合 30天×50% + 60天×30% + 90天×20%
  let predictedDailySales = 0;

  if (productType === 'hot') {
    // 热销产品：加权组合 + 趋势加成
    const weightedAvg = stats30.avgPerDay * 0.5 +
                        stats60.avgPerDay * 0.3 +
                        stats90.avgPerDay * 0.2;
    predictedDailySales = weightedAvg;
  } else if (productType === 'slow') {
    // 滞销产品：使用活跃日平均 * 频率，加权组合
    predictedDailySales = (stats30.avgPerActiveDay * stats30.frequency * 0.5 +
                          stats60.avgPerActiveDay * stats60.frequency * 0.3 +
                          stats90.avgPerActiveDay * stats90.frequency * 0.2);
    // 滞销产品至少保证有一定的预测值（如果90天有销售）
    if (predictedDailySales < 0.05 && totalSales > 0) {
      predictedDailySales = totalSales / 90; // 使用90天平均
    }
  } else if (productType === 'new') {
    // 新品：主要基于最近30天，使用日均销量并增加增长预期
    predictedDailySales = stats30.avgPerDay * 0.7 * 1.2 + // 30天占70%，增长20%
                          stats60.avgPerDay * 0.3;
  } else {
    // 正常产品：标准加权组合 30天×50% + 60天×30% + 90天×20%
    predictedDailySales = stats30.avgPerDay * 0.5 +
                          stats60.avgPerDay * 0.3 +
                          stats90.avgPerDay * 0.2;
  }

  // 计算趋势系数
  let trendFactor = 1.0;
  if (stats60.avgPerDay > 0) {
    trendFactor = stats30.avgPerDay / stats60.avgPerDay;
    // 根据产品类型调整趋势系数的影响范围
    if (productType === 'hot') {
      trendFactor = Math.max(0.8, Math.min(1.5, trendFactor)); // 热销产品允许更大波动
    } else if (productType === 'slow') {
      trendFactor = Math.max(0.9, Math.min(1.1, trendFactor)); // 滞销产品趋势变化小
    } else {
      trendFactor = Math.max(0.85, Math.min(1.3, trendFactor)); // 正常产品中等波动
    }
  }

  // 应用趋势系数
  predictedDailySales *= trendFactor;

  // 调试日志 - 显示加权组合算法
  log.debug(`\n📊 [${productTypeDesc}] 预测计算 (加权组合: 30天×50% + 60天×30% + 90天×20%)`);
  log.debug(`   总销量: ${totalSales}台 (90天)`);
  log.debug(`   最近30天: 销售${stats30.totalSales}台, 日均${stats30.avgPerDay.toFixed(3)}台`);
  log.debug(`   31-60天: 销售${stats60.totalSales}台, 日均${stats60.avgPerDay.toFixed(3)}台`);
  log.debug(`   61-90天: 销售${stats90.totalSales}台, 日均${stats90.avgPerDay.toFixed(3)}台`);
  log.debug(`   加权日均: ${stats30.avgPerDay.toFixed(3)}×0.5 + ${stats60.avgPerDay.toFixed(3)}×0.3 + ${stats90.avgPerDay.toFixed(3)}×0.2 = ${(stats30.avgPerDay * 0.5 + stats60.avgPerDay * 0.3 + stats90.avgPerDay * 0.2).toFixed(3)}台`);
  log.debug(`   趋势系数: ${trendFactor.toFixed(2)}`);
  log.debug(`   最终日均预测: ${predictedDailySales.toFixed(3)}台/天`);

  // 生成未来的预测数据
  let forecastDays = 30;
  if (period === 'week') forecastDays = 7;
  else if (period === 'quarter') forecastDays = 90;

  // 计算整个预测周期的总销量
  const rawPredicted = predictedDailySales * forecastDays;
  let totalPredicted = Math.round(rawPredicted);

  // 对于小数预测，使用更合理的规则：
  // - 如果原始预测 >= 0.2台，至少预测1台（因为有一定销售可能性）
  // - 如果原始预测 < 0.2台，预测0台（销售可能性很低）
  if (totalPredicted === 0 && rawPredicted >= 0.2) {
    totalPredicted = 1;
  }

  log.debug(`   预测周期: ${forecastDays}天`);
  log.debug(`   原始预测: ${rawPredicted.toFixed(2)}台`);
  log.debug(`   预测总销量: ${totalPredicted}台\n`);

  // 将总销量智能分配到各天
  const dailyPredictions = distributeSalesIntelligent(totalPredicted, forecastDays, stats30.frequency, productType);

  log.debug(`   每日分配: [${dailyPredictions.slice(0, 8).join(', ')}]`);

  // 计算标准差（用于置信区间）
  const stdDev = Math.sqrt(stats30.variance);

  // 先更新今天的预测值（今天的历史数据已在前面添加，需要更新其predicted值）
  // 找到今天在result.dates中的索引
  const todayStr = formatDateString(now);
  const todayIndex = result.dates.indexOf(todayStr);
  if (todayIndex !== -1) {
    // 今天也使用第一天的预测值
    const todayPredicted = dailyPredictions[0] || 0;
    result.predicted[todayIndex] = todayPredicted;
    log.debug(`   今天(${todayStr})预测: ${todayPredicted}台, 实际: ${result.actual[todayIndex]}台`);
  }

  // 从明天开始预测
  for (let i = 1; i <= forecastDays; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    const dateStr = formatDateString(date);

    const predicted = dailyPredictions[i] || 0;

    // 计算置信区间
    let upperBound, lowerBound;

    if (totalPredicted === 0) {
      upperBound = 0;
      lowerBound = 0;
    } else if (productType === 'hot') {
      // 热销产品：置信区间较窄
      const confidenceRange = Math.max(1, Math.round(stdDev * 1.2));
      upperBound = predicted + confidenceRange;
      lowerBound = Math.max(0, predicted - Math.round(confidenceRange * 0.8));
    } else if (productType === 'slow') {
      // 滞销产品：置信区间较宽
      const confidenceRange = Math.max(1, Math.round(stdDev * 2));
      upperBound = predicted + confidenceRange;
      lowerBound = Math.max(0, predicted - confidenceRange);
    } else {
      // 正常产品：中等置信区间
      const confidenceRange = Math.max(1, Math.round(stdDev * 1.5));
      upperBound = predicted + confidenceRange;
      lowerBound = Math.max(0, predicted - confidenceRange);
    }

    result.dates.push(dateStr);
    result.actual.push(null);
    result.predicted.push(predicted);
    result.upper_bound.push(upperBound);
    result.lower_bound.push(lowerBound);
  }

  return result;
}

// 计算时间段的统计数据
function calculatePeriodStats(salesData) {
  const totalDays = salesData.length;
  const totalSales = salesData.reduce((sum, val) => sum + val, 0);
  const activeDays = salesData.filter(val => val > 0).length;
  const frequency = activeDays / totalDays;
  const avgPerDay = totalSales / totalDays;
  const avgPerActiveDay = activeDays > 0 ? totalSales / activeDays : 0;

  // 计算方差
  const mean = avgPerDay;
  const variance = salesData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / totalDays;

  return {
    totalSales,
    activeDays,
    frequency,
    avgPerDay,
    avgPerActiveDay,
    variance
  };
}

// 智能分配销量到各天
function distributeSalesIntelligent(totalSales, days, frequency, productType) {
  const distribution = new Array(days + 1).fill(0);

  if (totalSales === 0) return distribution;

  // 根据产品类型和销售频率决定分配策略
  if (productType === 'hot') {
    // 热销产品：更均匀地分配，大部分天都有销售
    const avgPerDay = totalSales / days;
    let remaining = totalSales;

    for (let i = 0; i < days; i++) {
      // 添加一些随机性，但保持在合理范围
      const variation = Math.random() * 0.4 - 0.2; // -20% to +20%
      const allocated = Math.max(0, Math.round(avgPerDay * (1 + variation)));
      distribution[i] = Math.min(allocated, remaining);
      remaining -= distribution[i];
    }

    // 将剩余的分配到随机几天
    while (remaining > 0) {
      const randomDay = Math.floor(Math.random() * days);
      distribution[randomDay]++;
      remaining--;
    }
  } else if (productType === 'slow') {
    // 滞销产品：集中在少数几天
    const activeDaysCount = Math.max(1, Math.round(days * frequency));
    const salesPerActiveDay = Math.ceil(totalSales / activeDaysCount);
    let remaining = totalSales;

    // 均匀间隔选择活跃日
    const interval = Math.floor(days / activeDaysCount);
    for (let i = 0; i < activeDaysCount && remaining > 0; i++) {
      const dayIndex = Math.min(i * interval, days - 1);
      const allocated = Math.min(salesPerActiveDay, remaining);
      distribution[dayIndex] = allocated;
      remaining -= allocated;
    }
  } else {
    // 正常产品：基于频率分配
    const expectedActiveDays = Math.max(1, Math.round(days * frequency));

    if (totalSales <= expectedActiveDays) {
      // 销量少，每个活跃日1台
      const interval = Math.floor(days / totalSales);
      for (let i = 0; i < totalSales; i++) {
        const dayIndex = Math.min(i * interval, days);
        distribution[dayIndex] = 1;
      }
    } else {
      // 销量多，平均分配到活跃日
      const avgPerActiveDay = Math.ceil(totalSales / expectedActiveDays);
      let remaining = totalSales;
      const interval = Math.floor(days / expectedActiveDays);

      for (let i = 0; i < expectedActiveDays && remaining > 0; i++) {
        const dayIndex = Math.min(i * interval, days - 1);
        const allocated = Math.min(avgPerActiveDay, remaining);
        distribution[dayIndex] = allocated;
        remaining -= allocated;
      }

      // 将剩余的分配到第一个活跃日
      if (remaining > 0) {
        distribution[0] += remaining;
      }
    }
  }

  return distribution;
}


// 计算预测置信度（基于数据稳定性）
function calculateConfidence(historicalSales) {
  if (historicalSales.length < 7) return 'low';

  // 计算变异系数（标准差/平均值）
  const counts = historicalSales.map(item => item.count);
  const avg = counts.reduce((sum, val) => sum + val, 0) / counts.length;

  if (avg === 0) return 'low';

  const variance = counts.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / counts.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / avg;

  // 变异系数越小，数据越稳定，置信度越高
  if (cv < 0.3) return 'high';
  if (cv < 0.6) return 'medium';
  return 'low';
}

module.exports = router;
