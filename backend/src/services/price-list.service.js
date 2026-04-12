/**
 * 价目表服务
 * 功能：
 * 1. 从外部URL抓取价格数据（支持登录和验证码识别）
 * 2. 定时同步价格
 * 3. 价格管理
 */
const axios = require('axios');
let cheerio = null;
try {
  cheerio = require('cheerio');
} catch (error) {
  log.warn('⚠️ cheerio 模块未安装，价格抓取功能将不可用');
}
const crypto = require('crypto');
const CaptchaRecognizer = require('./captcha-recognizer');
const PuppeteerLoginService = require('./puppeteer-login.service');
const HttpLoginService = require('./http-login.service');
const SystemSettingsService = require('./system-settings.service');
const { matchProductName } = require('../config/product-name-mapping');
const log = require('../utils/log');

class PriceListService {
  constructor() {
    this.db = null;
    // Cookie存储，用于保持登录状态
    this.cookies = new Map();
    // 验证码识别器
    this.captchaRecognizer = new CaptchaRecognizer();
    // Puppeteer登录服务（用于绕过安全控件）
    this.puppeteerService = new PuppeteerLoginService();
    // HTTP登录服务（作为备选方案，不依赖Chrome）
    this.httpLoginService = HttpLoginService;

    /**
     * 生成时间字符串格式
     * @returns {string} 格式: 2026-02-03 15:01:30
     */
    this.getBeijingTime = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    // 外部颜色名称到数据库颜色名称的映射
    this.colorMapping = {
      // 蓝色系
      '深蓝色': '蓝色',
      '青雾蓝色': '蓝色',
      '水蓝色': '蓝色',
      '丹宁色': '蓝色',
      '深青色': '青色',
      '青雾蓝色': '蓝色',
      '天青蓝': '蓝色',
      '蓝色': '蓝色',

      // 紫色系
      '浅紫色': '紫色',
      '薰衣草紫色': '紫色',
      '曙光紫': '紫色',
      '烟霞紫': '紫色',
      '紫色': '紫色',

      // 白色系
      '流金白': '白色',
      '云白色': '白色',
      '云雾白': '白色',
      '星辉白': '白色',
      '雪松白': '白色',
      '星光色': '白色',
      '银色': '白色',
      '白色钛金属': '白色',
      '白色': '白色',

      // 灰色/黑色系
      '深黑色': '黑色',
      '子夜黑': '黑色',
      '星岩黑': '黑色',
      '深空灰': '黑色',
      '深空灰色': '黑色',
      '午夜色': '黑色',
      '银灰色': '黑色',
      '黑色钛金属': '黑色',
      '灰色': '灰色',
      '黑色': '黑色',

      // 金色系
      '沙漠色钛金属': '金色',
      '钛金色': '金色',
      '茶色': '金色',
      '金色': '金色',

      // 原色系（钛金属原色）
      '原色钛金属': '原色',
      '钛金属': '原色',
      '原色': '原色',

      // 橙色系
      '星宇橙色': '橙色',
      '橙色': '橙色',

      // 绿色系
      '鼠尾草绿色': '绿色',
      '青柠绿': '绿色',
      '绿色': '绿色',

      // 其他颜色
      '玫瑰金': '粉色',
      '粉色': '粉色',
      '黄色': '黄色',
      '红色': '红色',
      '青色': '青色'
    };
  }

  /**
   * 将外部颜色名称映射到数据库颜色名称
   * 支持智能模糊匹配：包含关键字就映射到目标颜色
   */
  normalizeColor(colorName) {
    if (!colorName) return colorName;

    const normalized = colorName.trim();

    // 优先使用显式颜色映射，处理星光色/深空灰色等命名差异
    if (this.colorMapping[normalized]) {
      return this.colorMapping[normalized];
    }

    // 🔥 智能映射规则：按优先级从高到低匹配
    // 包含特定关键字 → 映射到标准颜色
    // 注意：匹配顺序很重要，先匹配更具体的组合词

    // 黑色系（包含 黑、乌、墨、灰、碳、石墨 等）
    if (/黑|乌|墨|灰|碳|石墨|午夜|深空|子夜|星岩|深黑/.test(normalized)) return '黑色';

    // 白色系（包含 银、白、霜、雪、云、雾 等）- 必须先匹配"银色"
    if (/银色/.test(normalized)) return '白色';
    if (/银|霜|雪|云|雾|流金白|星辉白|星光色|月光|冰霜/.test(normalized)) return '白色';
    if (/白/.test(normalized)) return '白色';

    // 蓝色系（排除"银色"中的"青"字，避免误匹配）
    if (/蓝[^青]|深蓝|水蓝|丹宁|靛|天蓝[^青]/.test(normalized)) return '蓝色';

    // 紫色系（包含 紫、罗兰、薰衣草 等）
    if (/紫|罗兰|薰衣草|葡萄|丁香|浅紫|曙光|烟霞/.test(normalized)) return '紫色';

    // 绿色系
    if (/绿|翠|碧|青绿|橄榄|薄荷|草|鼠尾草|青柠/.test(normalized)) return '绿色';

    // 橙色系
    if (/橙|橘|星宇/.test(normalized)) return '橙色';
    // 特别处理"星宇橙色" -> "橙色"
    if (/星宇橙色/.test(normalized)) return '橙色';

    // 粉色系
    if (/粉|桃|樱|蔷薇|玫瑰|牡丹|玫瑰金/.test(normalized)) return '粉色';

    // 金色系
    if (/金|铜|钛金|茶|沙漠/.test(normalized)) return '金色';

    // 原色系
    if (/原色|钛金属/.test(normalized)) return '原色';

    // 黄色系
    if (/黄/.test(normalized)) return '黄色';

    // 红色系
    if (/红/.test(normalized)) return '红色';

    // 青色系
    if (/青色|深青/.test(normalized)) return '青色';

    // 如果没有匹配，返回原始颜色
    return normalized;
  }

  /**
   * 从外部产品文本中提取存储规格。
   * 优先识别显式 GB/TB，并取最大的容量，避免把 12GB+256GB 中的 12GB 识别成存储，
   * 也避免把尾部型号码如 4G4 误识别成 4GB。
   */
  extractMemoryFromText(text) {
    if (!text) return '';

    const normalizedText = String(text);
    const capacities = [];

    const tbMatches = normalizedText.matchAll(/(\d+(?:\.\d+)?)\s*TB/ig);
    for (const match of tbMatches) {
      const value = parseFloat(match[1]);
      if (!Number.isNaN(value) && value > 0) {
        capacities.push(value * 1024);
      }
    }

    const gbMatches = normalizedText.matchAll(/(\d+(?:\.\d+)?)\s*GB/ig);
    for (const match of gbMatches) {
      const value = parseFloat(match[1]);
      if (!Number.isNaN(value) && value > 0) {
        capacities.push(value);
      }
    }

    // 兼容 256G / 1T 这种缩写，但要求前后是分隔符，避免误匹配 4G4。
    const shortMatches = normalizedText.matchAll(/(?:^|[-+\s(（])(\d{2,4})([GT])(?:$|[-+\s)）])/ig);
    for (const match of shortMatches) {
      const value = parseFloat(match[1]);
      const unit = match[2].toUpperCase();
      if (Number.isNaN(value) || value <= 0) continue;
      capacities.push(unit === 'T' ? value * 1024 : value);
    }

    if (capacities.length === 0) {
      return '';
    }

    const maxGb = Math.max(...capacities);
    if (maxGb >= 2048) return '2TB';
    if (maxGb >= 1024) return '1TB';
    return `${Math.round(maxGb)}GB`;
  }

  /**
   * 判断外部商品文本是否标记为“同城”
   */
  isSameCityProduct(text) {
    if (!text) return false;
    return String(text).includes('同城');
  }

  /**
   * 对候选价格按优先级排序：
   * 1. 同城优先
   * 2. 颜色信息完整优先
   * 3. 内存信息完整优先
   *
   * 业务规则说明：
   * - 苹果 iPhone 15 及以下：同城优先，但允许回退到全国价
   * - 苹果 iPhone 16 及以上：由 getEligiblePriceCandidates 进一步限制为“只能同城”
   */
  prioritizePriceCandidates(priceList = []) {
    return [...priceList].sort((a, b) => {
      const sameCityDiff = Number(Boolean(b?.isLocal)) - Number(Boolean(a?.isLocal));
      if (sameCityDiff !== 0) return sameCityDiff;

      const colorDiff = Number(Boolean(b?.color)) - Number(Boolean(a?.color));
      if (colorDiff !== 0) return colorDiff;

      return Number(Boolean(b?.memory)) - Number(Boolean(a?.memory));
    });
  }

  /**
   * 提取 iPhone 代数，如 iphone16 / 16promax / iPhone 16 Pro => 16
   */
  extractIPhoneGeneration(modelText) {
    if (!modelText) return null;

    const normalized = String(modelText)
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[()]/g, '');

    const match = normalized.match(/(?:iphone)?(\d{2})/);
    if (!match) return null;

    const generation = Number(match[1]);
    return Number.isNaN(generation) ? null : generation;
  }

  /**
   * 苹果 iPhone 16 及以上只能使用同城价格
   *
   * 业务口径：
   * - iPhone 15 及以下：返回 false，允许全国价作为回退候选
   * - iPhone 16 及以上：返回 true，后续匹配时必须过滤掉全国价
   */
  requiresSameCityOnly(productLike = {}) {
    const brand = String(productLike.brand || productLike.brand_name || '').toLowerCase();
    const model = productLike.model || productLike.model_number || '';

    const isAppleLike = brand.includes('苹果') || brand.includes('apple') || String(model).toLowerCase().includes('iphone');
    if (!isAppleLike) return false;

    const generation = this.extractIPhoneGeneration(model);
    return generation !== null && generation >= 16;
  }

  /**
   * 获取最终可参与匹配的候选价格：
   * - 统一先按优先级排序
   * - iPhone 16 及以上只保留同城价
   *
   * 最终效果：
   * - iPhone 15 及以下：候选顺序为“同城在前，全国在后”
   * - iPhone 16 及以上：候选列表里只保留同城记录，没有同城则视为无法匹配
   */
  getEligiblePriceCandidates(priceList = [], productLike = {}) {
    const prioritized = this.prioritizePriceCandidates(priceList);

    if (!this.requiresSameCityOnly(productLike)) {
      return prioritized;
    }

    return prioritized.filter(item => item?.isLocal === true);
  }

  /**
   * 设置数据库连接
   */
  setDatabase(db) {
    this.db = db;
  }

  /**
   * 通用响应格式
   */
  createSuccessResponse(message, data = null) {
    return { success: true, message, data };
  }

  createErrorResponse(message, code = null) {
    return { success: false, message, code };
  }

  getLatestPublishedWholesaleSyncTimeSubquery() {
    return `(
      SELECT MAX(pls.last_sync_time)
      FROM price_list pls
      WHERE pls.status = 1
        AND COALESCE(pls.is_collect, 1) = 1
        AND (pls.show_price = 1 OR pls.show_price IS NULL)
        AND COALESCE(pls.wholesale_price, 0) > 0
        AND pls.last_sync_time IS NOT NULL
    )`;
  }

  buildLatestPublishedWholesaleFilters(alias = 'p') {
    const latestSyncTimeSubquery = this.getLatestPublishedWholesaleSyncTimeSubquery();
    return `
      ${alias}.status = 1
      AND COALESCE(${alias}.is_collect, 1) = 1
      AND (${alias}.show_price = 1 OR ${alias}.show_price IS NULL)
      AND COALESCE(${alias}.wholesale_price, 0) > 0
      AND ${alias}.last_sync_time IS NOT NULL
      AND ${alias}.last_sync_time = ${latestSyncTimeSubquery}
    `;
  }

  getLatestPublishedRetailSyncTimeSubquery() {
    return `(
      SELECT MAX(pls.last_sync_time)
      FROM price_list pls
      WHERE pls.status = 1
        AND (pls.show_price = 1 OR pls.show_price IS NULL)
        AND COALESCE(pls.retail_price, 0) > 0
        AND pls.last_sync_time IS NOT NULL
    )`;
  }

  buildLatestPublishedRetailFilters(alias = 'p') {
    const latestSyncTimeSubquery = this.getLatestPublishedRetailSyncTimeSubquery();
    return `
      ${alias}.status = 1
      AND (${alias}.show_price = 1 OR ${alias}.show_price IS NULL)
      AND COALESCE(${alias}.retail_price, 0) > 0
      AND ${alias}.last_sync_time IS NOT NULL
      AND ${alias}.last_sync_time = ${latestSyncTimeSubquery}
    `;
  }

  // ==================== 价格列表管理 ====================

  /**
   * 获取价格列表（以 price_list 表为主数据源）
   * price_list 表存储所有需要跟踪价格的商品
   * is_collect: 0-不采集, 1-采集
   */
  async getPriceList(params = {}) {
    try {
      const {
        search,
        brand_name,
        model_number,
        external_model,
        color_name,
        memory,
        status,
        page = 1,
        limit = 50
      } = params;

      log.debug('获取价格列表参数:', params);

      // 筛选条件
      const conditions = [];
      const queryParams = [];

      // 关键词搜索
      if (search) {
        const searchTerm = `%${search}%`;
        conditions.push('(b.name LIKE ? OR mo.name LIKE ? OR c.name LIKE ? OR mem.size LIKE ? OR pl.external_model LIKE ?)');
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }

      // 品牌筛选
      if (brand_name) {
        conditions.push('b.name LIKE ?');
        queryParams.push(`%${brand_name}%`);
      }

      // 型号筛选
      if (model_number) {
        conditions.push('mo.name LIKE ?');
        queryParams.push(`%${model_number}%`);
      }

      // 颜色筛选
      if (color_name) {
        conditions.push('c.name LIKE ?');
        queryParams.push(`%${color_name}%`);
      }

      // 内存筛选
      if (memory) {
        conditions.push('mem.size LIKE ?');
        queryParams.push(`%${memory}%`);
      }

      // 外部型号筛选
      if (external_model) {
        conditions.push('pl.external_model LIKE ?');
        queryParams.push(`%${external_model}%`);
      }

      // 状态筛选
      if (status !== undefined) {
        conditions.push('COALESCE(pl.status, 1) = ?');
        queryParams.push(status);
      }

      // 采集模式筛选
      if (params.is_collect !== undefined) {
        conditions.push('COALESCE(pl.is_collect, 1) = ?');
        queryParams.push(params.is_collect);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // 获取总数
      const countQuery = `
        SELECT COUNT(*) as total
        FROM price_list pl
        JOIN brands b ON pl.brand_id = b.id
        JOIN models mo ON pl.model_id = mo.id
        LEFT JOIN colors c ON pl.color_id = c.id
        LEFT JOIN memories mem ON pl.memory_id = mem.id
        ${whereClause}
      `;
      const [countResult] = await this.db.query(countQuery, queryParams);
      const total = parseInt(countResult[0].total) || 0;

      log.debug('价格列表总数:', total);

      // 获取分页数据
      const offset = (page - 1) * limit;
      const dataQuery = `
        SELECT
          b.name as brand_name,
          mo.name as model_number,
          c.name as color_name,
          mem.size as memory,
          COALESCE(real_stock.stock_count, pl.stock_quantity, 0) as stock_quantity,
          pl.retail_price,
          pl.wholesale_price,
          pl.last_sync_time,
          pl.id as price_list_id,
          COALESCE(pl.status, 1) as status,
          COALESCE(pl.is_collect, 1) as is_collect,
          COALESCE(pl.show_price, 0) as show_price,
          pl.external_model,
          -- 提取型号数字用于排序
          CAST(REGEXP_SUBSTR(mo.name, '[0-9]+') AS UNSIGNED) as model_sort_num,
          -- 提取内存数值用于排序
          CASE
            WHEN mem.size REGEXP '[0-9]+TB' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED) * 1024
            WHEN mem.size REGEXP '[0-9]+GB' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED)
            WHEN mem.size REGEXP '[0-9]+T' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED) * 1024
            WHEN mem.size REGEXP '[0-9]+G' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED)
            ELSE 0
          END as memory_sort_num
        FROM price_list pl
        JOIN brands b ON pl.brand_id = b.id
        JOIN models mo ON pl.model_id = mo.id
        LEFT JOIN colors c ON pl.color_id = c.id
        LEFT JOIN memories mem ON pl.memory_id = mem.id
        LEFT JOIN (
          SELECT
            ph.brand_id,
            ph.model_id,
            ph.color_id,
            ph.memory_id,
            COUNT(*) as stock_count
          FROM phones ph
          WHERE ph.status = 'in_stock' AND ph.is_new = 1
          GROUP BY ph.brand_id, ph.model_id, ph.color_id, ph.memory_id
        ) real_stock ON real_stock.brand_id = pl.brand_id
          AND real_stock.model_id = pl.model_id
          AND (real_stock.color_id = pl.color_id OR (real_stock.color_id IS NULL AND pl.color_id IS NULL))
          AND (real_stock.memory_id = pl.memory_id OR (real_stock.memory_id IS NULL AND pl.memory_id IS NULL))
        ${whereClause}
        ORDER BY
          -- 排序规则：采集(1)排在前面，不采集(0)排在后面
          CASE COALESCE(pl.is_collect, 1)
            WHEN 0 THEN 1
            ELSE 0
          END ASC,
          b.name, model_sort_num, mo.name, memory_sort_num, c.name
        LIMIT ? OFFSET ?
      `;
      const allParams = [...queryParams, parseInt(limit), parseInt(offset)];

      const [rows] = await this.db.query(dataQuery, allParams);

      log.debug('查询到的价格列表数据:', rows.length, '条');
      if (rows.length > 0) {
        log.debug('前3条数据:', JSON.stringify(rows.slice(0, 3), null, 2));
      }

      return this.createSuccessResponse('获取成功', {
        list: rows,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      log.error('获取价格列表失败:', error);
      return this.createErrorResponse('获取价格列表失败');
    }
  }

  /**
   * 根据品牌获取价格（公开接口）
   */
  async getPricesByBrand(brandName) {
    try {
      const latestPublishedFilters = this.buildLatestPublishedWholesaleFilters('p');
      const query = `
        SELECT
          mo.name as model_number,
          c.name as color_name,
          mem.size as memory,
          p.retail_price,
          p.wholesale_price,
          p.stock_quantity,
          -- 提取型号数字用于排序
          CAST(REGEXP_SUBSTR(mo.name, '[0-9]+') AS UNSIGNED) as model_sort_num,
          -- 提取内存数值用于排序 (将256GB转为256, 1TB转为1024)
          CASE
            WHEN mem.size REGEXP '[0-9]+TB' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED) * 1024
            WHEN mem.size REGEXP '[0-9]+GB' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED)
            WHEN mem.size REGEXP '[0-9]+T' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED) * 1024
            WHEN mem.size REGEXP '[0-9]+G' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED)
            ELSE 0
          END as memory_sort_num
        FROM price_list p
        INNER JOIN brands b ON p.brand_id = b.id
        INNER JOIN models mo ON p.model_id = mo.id
        INNER JOIN colors c ON p.color_id = c.id
        INNER JOIN memories mem ON p.memory_id = mem.id
        WHERE b.name = ?
        AND ${latestPublishedFilters}
        ORDER BY model_sort_num, mo.name, memory_sort_num, c.name
      `;
      const [rows] = await this.db.query(query, [brandName]);

      return this.createSuccessResponse('获取成功', rows);
    } catch (error) {
      log.error('根据品牌获取价格失败:', error);
      return this.createErrorResponse('获取价格失败');
    }
  }

  /**
   * 获取所有价格（公开接口，批发页面使用）
   * 只返回最近一次有效同步批次中，开启报价且有最新采集价的商品
   */
  async getAllPrices() {
    try {
      const latestPublishedFilters = this.buildLatestPublishedWholesaleFilters('p');
      const query = `
        SELECT
          b.name as brand_name,
          mo.name as model_number,
          c.name as color_name,
          mem.size as memory,
          p.retail_price,
          p.wholesale_price,
          COALESCE(real_stock.stock_count, 0) as stock_quantity,
          p.show_price,
          -- 提取型号数字用于排序
          CAST(REGEXP_SUBSTR(mo.name, '[0-9]+') AS UNSIGNED) as model_sort_num,
          -- 提取内存数值用于排序 (将256GB转为256, 1TB转为1024)
          CASE
            WHEN mem.size REGEXP '[0-9]+TB' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED) * 1024
            WHEN mem.size REGEXP '[0-9]+GB' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED)
            WHEN mem.size REGEXP '[0-9]+T' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED) * 1024
            WHEN mem.size REGEXP '[0-9]+G' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED)
            ELSE 0
          END as memory_sort_num
        FROM price_list p
        INNER JOIN brands b ON p.brand_id = b.id
        INNER JOIN models mo ON p.model_id = mo.id
        INNER JOIN colors c ON p.color_id = c.id
        INNER JOIN memories mem ON p.memory_id = mem.id
        LEFT JOIN (
          SELECT
            ph.brand_id,
            ph.model_id,
            ph.color_id,
            ph.memory_id,
            COUNT(*) as stock_count
          FROM phones ph
          WHERE ph.status = 'in_stock' AND ph.is_new = 1
          GROUP BY ph.brand_id, ph.model_id, ph.color_id, ph.memory_id
        ) real_stock ON p.brand_id = real_stock.brand_id
          AND p.model_id = real_stock.model_id
          AND (p.color_id = real_stock.color_id OR (p.color_id IS NULL AND real_stock.color_id IS NULL))
          AND (p.memory_id = real_stock.memory_id OR (p.memory_id IS NULL AND real_stock.memory_id IS NULL))
        WHERE ${latestPublishedFilters}
        ORDER BY b.name, model_sort_num, mo.name, memory_sort_num, c.name
        LIMIT 500
      `;
      const [rows] = await this.db.query(query);

      return this.createSuccessResponse('获取成功', rows);
    } catch (error) {
      log.error('获取所有价格失败:', error);
      return this.createErrorResponse('获取失败');
    }
  }

  /**
   * 获取所有销售价格（公开接口，显示所有有价格的商品，不限采集状态）
   */
  async getAllSalesPrices() {
    try {
      const latestRetailFilters = this.buildLatestPublishedRetailFilters('p');
      const query = `
        SELECT
          b.name as brand_name,
          mo.name as model_number,
          c.name as color_name,
          mem.size as memory,
          p.retail_price,
          p.wholesale_price,
          p.stock_quantity,
          p.last_sync_time,
          -- 计算距离现在的天数
          DATEDIFF(NOW(), p.last_sync_time) as days_since_sync,
          -- 提取型号数字用于排序
          CAST(REGEXP_SUBSTR(mo.name, '[0-9]+') AS UNSIGNED) as model_sort_num,
          -- 提取内存数值用于排序 (将256GB转为256, 1TB转为1024)
          CASE
            WHEN mem.size REGEXP '[0-9]+TB' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED) * 1024
            WHEN mem.size REGEXP '[0-9]+GB' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED)
            WHEN mem.size REGEXP '[0-9]+T' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED) * 1024
            WHEN mem.size REGEXP '[0-9]+G' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED)
            ELSE 0
          END as memory_sort_num
        FROM price_list p
        INNER JOIN brands b ON p.brand_id = b.id
        INNER JOIN models mo ON p.model_id = mo.id
        INNER JOIN colors c ON p.color_id = c.id
        INNER JOIN memories mem ON p.memory_id = mem.id
        WHERE ${latestRetailFilters}
        ORDER BY b.name, model_sort_num, mo.name, memory_sort_num, c.name
        LIMIT 500
      `;
      const [rows] = await this.db.query(query);

      return this.createSuccessResponse('获取成功', rows);
    } catch (error) {
      log.error('获取销售价格失败:', error);
      return this.createErrorResponse('获取失败');
    }
  }

  /**
   * 搜索销售价格（公开接口，不限采集状态）
   */
  async searchSalesPrices(keyword) {
    try {
      const latestRetailFilters = this.buildLatestPublishedRetailFilters('p');
      // 尝试通过映射获取标准型号名称
      let modelNames = [keyword];
      const mapping = matchProductName(keyword);
      if (mapping && mapping.model) {
        modelNames.push(mapping.model);
      }

      // 构建搜索条件：支持品牌、型号名称、外部型号代码
      const searchConditions = [];
      const searchParams = [];

      for (const modelName of modelNames) {
        const searchTerm = `%${modelName}%`;
        searchConditions.push('(b.name LIKE ? OR mo.name LIKE ? OR p.external_model LIKE ?)');
        searchParams.push(searchTerm, searchTerm, searchTerm);
      }

      const query = `
        SELECT
          b.name as brand_name,
          mo.name as model_number,
          c.name as color_name,
          mem.size as memory,
          p.retail_price,
          p.wholesale_price,
          COALESCE(real_stock.stock_count, 0) as stock_quantity,
          p.show_price,
          -- 提取型号数字用于排序
          CAST(REGEXP_SUBSTR(mo.name, '[0-9]+') AS UNSIGNED) as model_sort_num,
          -- 提取内存数值用于排序 (将256GB转为256, 1TB转为1024)
          CASE
            WHEN mem.size REGEXP '[0-9]+TB' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED) * 1024
            WHEN mem.size REGEXP '[0-9]+GB' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED)
            WHEN mem.size REGEXP '[0-9]+T' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED) * 1024
            WHEN mem.size REGEXP '[0-9]+G' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED)
            ELSE 0
          END as memory_sort_num
        FROM price_list p
        INNER JOIN brands b ON p.brand_id = b.id
        INNER JOIN models mo ON p.model_id = mo.id
        INNER JOIN colors c ON p.color_id = c.id
        INNER JOIN memories mem ON p.memory_id = mem.id
        LEFT JOIN (
          SELECT
            ph.brand_id,
            ph.model_id,
            ph.color_id,
            ph.memory_id,
            COUNT(*) as stock_count
          FROM phones ph
          WHERE ph.status = 'in_stock' AND ph.is_new = 1
          GROUP BY ph.brand_id, ph.model_id, ph.color_id, ph.memory_id
        ) real_stock ON p.brand_id = real_stock.brand_id
          AND p.model_id = real_stock.model_id
          AND (p.color_id = real_stock.color_id OR (p.color_id IS NULL AND real_stock.color_id IS NULL))
          AND (p.memory_id = real_stock.memory_id OR (p.memory_id IS NULL AND real_stock.memory_id IS NULL))
        WHERE (${searchConditions.join(' OR ')})
        AND ${latestRetailFilters}
        ORDER BY b.name, model_sort_num, mo.name, memory_sort_num, c.name
        LIMIT 100
      `;
      const [rows] = await this.db.query(query, searchParams);

      return this.createSuccessResponse('搜索成功', rows);
    } catch (error) {
      log.error('搜索销售价格失败:', error);
      return this.createErrorResponse('搜索失败');
    }
  }

  /**
   * 搜索价格（公开接口）
   */
  async searchPrices(keyword) {
    try {
      const latestPublishedFilters = this.buildLatestPublishedWholesaleFilters('p');
      // 尝试通过映射获取标准型号名称
      let modelNames = [keyword];
      const mapping = matchProductName(keyword);
      if (mapping && mapping.model) {
        modelNames.push(mapping.model);
      }

      // 构建搜索条件：支持品牌、型号名称、外部型号代码
      const searchConditions = [];
      const searchParams = [];

      for (const modelName of modelNames) {
        const searchTerm = `%${modelName}%`;
        searchConditions.push('(b.name LIKE ? OR mo.name LIKE ? OR p.external_model LIKE ?)');
        searchParams.push(searchTerm, searchTerm, searchTerm);
      }

      const query = `
        SELECT
          b.name as brand_name,
          mo.name as model_number,
          c.name as color_name,
          mem.size as memory,
          p.retail_price,
          p.wholesale_price,
          COALESCE(real_stock.stock_count, 0) as stock_quantity,
          p.show_price,
          -- 提取型号数字用于排序
          CAST(REGEXP_SUBSTR(mo.name, '[0-9]+') AS UNSIGNED) as model_sort_num,
          -- 提取内存数值用于排序 (将256GB转为256, 1TB转为1024)
          CASE
            WHEN mem.size REGEXP '[0-9]+TB' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED) * 1024
            WHEN mem.size REGEXP '[0-9]+GB' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED)
            WHEN mem.size REGEXP '[0-9]+T' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED) * 1024
            WHEN mem.size REGEXP '[0-9]+G' THEN CAST(REGEXP_SUBSTR(mem.size, '[0-9]+') AS UNSIGNED)
            ELSE 0
          END as memory_sort_num
        FROM price_list p
        INNER JOIN brands b ON p.brand_id = b.id
        INNER JOIN models mo ON p.model_id = mo.id
        INNER JOIN colors c ON p.color_id = c.id
        INNER JOIN memories mem ON p.memory_id = mem.id
        LEFT JOIN (
          SELECT
            ph.brand_id,
            ph.model_id,
            ph.color_id,
            ph.memory_id,
            COUNT(*) as stock_count
          FROM phones ph
          WHERE ph.status = 'in_stock' AND ph.is_new = 1
          GROUP BY ph.brand_id, ph.model_id, ph.color_id, ph.memory_id
        ) real_stock ON p.brand_id = real_stock.brand_id
          AND p.model_id = real_stock.model_id
          AND (p.color_id = real_stock.color_id OR (p.color_id IS NULL AND real_stock.color_id IS NULL))
          AND (p.memory_id = real_stock.memory_id OR (p.memory_id IS NULL AND real_stock.memory_id IS NULL))
        WHERE (${searchConditions.join(' OR ')})
        AND ${latestPublishedFilters}
        ORDER BY b.name, model_sort_num, mo.name, memory_sort_num, c.name
        LIMIT 100
      `;
      const [rows] = await this.db.query(query, searchParams);

      return this.createSuccessResponse('搜索成功', rows);
    } catch (error) {
      log.error('搜索价格失败:', error);
      return this.createErrorResponse('搜索失败');
    }
  }

  /**
   * 创建/更新价格记录
   * 每次同步都会覆盖最新价格和时间
   * @param {Object} data - 价格数据
   * @param {string} syncTime - 可选的统一同步时间（北京时间）
   * @param {Object} options - 可选配置 { allowCreate: true, isManualEdit: false }
   */
  async upsertPriceItem(data, syncTime = null, options = {}) {
    try {
      const {
        allowCreate = true,  // 默认允许创建新记录
        changeReason = null
      } = options;
      let { isManualEdit = false } = options;

      const {
        brand_name,
        model_number,
        external_model = null,
        color_name = null,
        memory = null,
        retail_price,
        wholesale_price,
        cost_price,
        stock_quantity = 0,
        status = 1,
        is_collect = 1,
        show_price,
        last_sync_time = null,
        remark = ''
      } = data;
      const hasStockQuantity = Object.prototype.hasOwnProperty.call(data, 'stock_quantity');

      // is_collect: 0=不采集, 1=采集
      const inputIsCollect = is_collect !== undefined ? is_collect : 1;

      log.debug(`📝 upsertPriceItem 接收到的完整数据:`, JSON.stringify({
        brand_name,
        model_number,
        wholesale_price,
        retail_price,
        is_collect,
        show_price,
        remark,
        is_manual_edit: data.is_manual_edit
      }, null, 2));
      log.debug(`📝 upsertPriceItem 参数: is_collect=${is_collect}`);
      log.debug(`📝 upsertPriceItem 接收到的 show_price=${data.show_price}, 类型=${typeof data.show_price}`);

      // 将名称转换为 ID
      const [brandResult] = await this.db.query('SELECT id FROM brands WHERE name = ? LIMIT 1', [brand_name]);
      const [modelResult] = await this.db.query('SELECT id FROM models WHERE name = ? LIMIT 1', [model_number]);

      const brand_id = brandResult[0]?.id;
      const model_id = modelResult[0]?.id;

      if (!brand_id || !model_id) {
        log.error(`品牌或型号不存在: ${brand_name} - ${model_number}`);
        return this.createErrorResponse('品牌或型号不存在');
      }

      // 获取 color_id 和 memory_id（可能为 null）
      let color_id = null;
      let memory_id = null;

      if (color_name) {
        const [colorResult] = await this.db.query('SELECT id FROM colors WHERE name = ? LIMIT 1', [color_name]);
        color_id = colorResult[0]?.id || null;
      }

      if (memory) {
        const [memoryResult] = await this.db.query('SELECT id FROM memories WHERE size = ? LIMIT 1', [memory]);
        memory_id = memoryResult[0]?.id || null;
      }

      // 如果零售价为空且有批发价，按“模板优先、全局兜底”自动计算销售价
      let finalRetailPrice = retail_price;
      if ((!finalRetailPrice || finalRetailPrice === null) && wholesale_price && wholesale_price > 0) {
        try {
          const retailPriceResult = await this.calculateRetailPrice(
            brand_id,
            model_id,
            color_id,
            memory_id,
            wholesale_price
          );
          if (retailPriceResult.retailPrice !== null) {
            finalRetailPrice = retailPriceResult.retailPrice;
            log.debug(`    💰 自动计算销售价(${retailPriceResult.sourceLabel}): 批发价¥${wholesale_price} => 零售价¥${finalRetailPrice}`);
          }
        } catch (markupError) {
          log.error(`    ⚠️ 加价计算失败: ${markupError.message}`);
        }
      }

      // 检查是否已存在（使用 ID 关联）
      const checkQuery = `
        SELECT id, retail_price, wholesale_price, is_collect, last_sync_time FROM price_list
        WHERE brand_id = ? AND model_id = ?
          AND (color_id = ? OR (color_id IS NULL AND ? IS NULL))
          AND (memory_id = ? OR (memory_id IS NULL AND ? IS NULL))
      `;
      const [existing] = await this.db.query(checkQuery, [
        brand_id,
        model_id,
        color_id,
        color_id,
        memory_id,
        memory_id
      ]);

      let priceItemId;
      let changeType = 'create';
      let finalIsCollect = inputIsCollect;

      // 判断是否是手动编辑（有传入 last_sync_time 参数）还是自动同步
      // 手动编辑时 last_sync_time 可能是 null（清空）或具体时间
      // 自动同步时没有传入 last_sync_time，使用 syncTime 参数
      // 或者直接使用 is_manual_edit 标志
      // 合并 options 传入的 isManualEdit 和从 data 判断的结果
      const detectedManualEdit = data.hasOwnProperty('last_sync_time') || data.is_manual_edit === true;
      isManualEdit = isManualEdit || detectedManualEdit;

      log.debug(`🔍 手动编辑检测: isManualEdit=${isManualEdit}, hasOwnProperty('last_sync_time')=${data.hasOwnProperty('last_sync_time')}, is_manual_edit=${data.is_manual_edit}`);
      if (isManualEdit && data.hasOwnProperty('last_sync_time')) {
        log.debug(`  last_sync_time 值: ${last_sync_time}`);
      }

      // 确定要使用的同步时间：
      // 1. 手动编辑：使用传入的 last_sync_time（可能为 null 表示清空）
      // 2. 自动同步：使用 syncTime 或当前时间
      let finalSyncTime;
      if (isManualEdit) {
        // 手动编辑，使用传入的时间（可能为空字符串或 null）
        // 如果没有传 last_sync_time（例如只是修改 show_price），保持原时间
        if (data.hasOwnProperty('last_sync_time')) {
          finalSyncTime = last_sync_time && last_sync_time.trim() !== '' ? last_sync_time : null;
        } else {
          // 只是修改 show_price 等其他字段，不修改时间
          finalSyncTime = null; // 使用 SQL 中的 last_sync_time = last_sync_time 保持原值
        }
      } else {
        // 自动同步，使用 syncTime 或当前北京时间
        finalSyncTime = syncTime || this.getBeijingTime();
      }

      if (existing.length > 0) {
        // 更新 - 只在价格变化时才更新
        priceItemId = existing[0].id;
        changeType = 'update';

        const oldPrices = existing[0];

        // 需要正确处理 null 和数值的比较
        const normalizePrice = (price) => {
          if (price === null || price === undefined || price === '') return null;
          const num = parseFloat(price);
          return isNaN(num) ? null : num;
        };

        const oldRetail = normalizePrice(oldPrices.retail_price);
        const oldWholesale = normalizePrice(oldPrices.wholesale_price);
        const oldIsCollect = oldPrices.is_collect ?? 1;
        const newRetail = normalizePrice(finalRetailPrice);
        const newWholesale = normalizePrice(wholesale_price);

        // 手动编辑和自动同步都统一走“模板优先、全局兜底”销售价计算
        let finalRetailPriceForUpdate = newRetail;
        let autoCalculatedRetailPrice = null;
        let retailPriceSourceLabel = '';

        if ((retail_price === null || retail_price === undefined || retail_price === '') && newWholesale && newWholesale > 0) {
          try {
            const retailPriceResult = await this.calculateRetailPrice(
              brand_id,
              model_id,
              color_id,
              memory_id,
              newWholesale
            );
            autoCalculatedRetailPrice = retailPriceResult.retailPrice;
            retailPriceSourceLabel = retailPriceResult.sourceLabel;
            if (autoCalculatedRetailPrice !== null) {
              finalRetailPriceForUpdate = autoCalculatedRetailPrice;
              log.debug(`    💰 ${isManualEdit ? '编辑时' : '同步时'}自动计算销售价(${retailPriceSourceLabel}): 批发价¥${newWholesale} => 零售价¥${finalRetailPriceForUpdate}`);
            }
          } catch (markupError) {
            log.error(`    ⚠️ 自动计算销售价失败: ${markupError.message}`);
          }
        }

        // 🔥 关键修复：自动同步时保留原有的采集模式
        // 如果是自动同步（没有传入采集模式），使用数据库中的值
        // 如果是手动编辑，使用传入的值
        finalIsCollect = inputIsCollect !== undefined ? inputIsCollect : oldIsCollect;

        // 历史记录口径只看采集价变化，销售价变化不单独记历史
        const wholesaleChanged = oldWholesale !== newWholesale;
        const priceChanged = wholesaleChanged;

        // 检查采集模式是否变化
        const isCollectChanged = (finalIsCollect !== oldIsCollect);

        log.debug(`🔍 采集模式检查: oldIsCollect=${oldIsCollect}, inputIsCollect=${inputIsCollect}, finalIsCollect=${finalIsCollect}, isCollectChanged=${isCollectChanged}, isManualEdit=${isManualEdit}`);
        log.debug(`🔍 价格检查: oldRetail=${oldRetail} (${typeof oldRetail}), newRetail=${newRetail} (${typeof newRetail}), oldWholesale=${oldWholesale} (${typeof oldWholesale}), newWholesale=${newWholesale} (${typeof newWholesale}), wholesaleChanged=${wholesaleChanged}, priceChanged=${priceChanged}`);

        // 🔥 价格变动检测：历史口径只按采集价判断
        let priceChangeType = 'unchanged';
        if (wholesaleChanged) {
          if (oldWholesale === null && newWholesale !== null) {
            priceChangeType = 'new_price';
          } else if (oldWholesale !== null && newWholesale === null) {
            priceChangeType = 'price_dropped';
          } else if (newWholesale > oldWholesale) {
            priceChangeType = 'price_increased';
          } else if (newWholesale < oldWholesale) {
            priceChangeType = 'price_decreased';
          }
        }

        if (oldWholesale === null && newWholesale !== null) {
          priceChangeType = 'new_price';
        } else if (oldWholesale !== null && newWholesale === null) {
          priceChangeType = 'price_dropped';
        } else if (newWholesale > oldWholesale) {
          priceChangeType = 'price_increased';
        } else if (newWholesale < oldWholesale) {
          priceChangeType = 'price_decreased';
        }

        log.debug(`  💰 价格变动类型: ${priceChangeType} (零售 ${oldRetail}->${newRetail}, 批发 ${oldWholesale}->${newWholesale})`);

        // 🔥 只在价格真正变化时才记录历史和更新价格
        // 价格变化检测：需要至少有一个价格字段发生实际变化
        if (priceChanged || isCollectChanged || isManualEdit) {
          // 价格、采集模式有变化，或者手动编辑，记录历史（仅在价格变化时）并更新

          // 只在价格真正变化时才记录历史
          if (priceChanged) {
            log.debug(`  ✅ 价格变化，记录历史: 零售 ${oldRetail} -> ${newRetail}, 批发 ${oldWholesale} -> ${newWholesale}, 变动类型: ${priceChangeType}`);
            await this.recordPriceHistory(priceItemId, {
              retail_price: newRetail,
              wholesale_price: newWholesale,
              cost_price: null
            }, priceChangeType, changeReason || (isManualEdit ? 'manual' : 'sync'));
          } else {
            // 价格未变化，不记录历史（避免重复记录相同价格）
            log.debug(`  ⏭️  价格未变化，跳过历史记录`);
          }

          // 处理价格值
          const normalizePriceValue = (price) => {
            if (price === null || price === undefined || price === '' || isNaN(Number(price))) {
              return null;
            }
            return Number(price);
          };

          const newRetailPrice = normalizePriceValue(finalRetailPriceForUpdate);
          const newWholesalePrice = normalizePriceValue(wholesale_price);

          // 🔥 关键修复：
          // - 手动编辑时：允许清空价格（设置为 NULL），并更新采集模式
          // - 自动同步时：只有当新价格不为 null 时才更新价格，否则保持原值
          // - 自动同步时：如果没有传入采集模式，保持数据库中原有的采集模式不变
          // - 自动同步时：不更新 show_price，保持原有值不变
          // - 手动编辑只更新 show_price 时，不更新价格字段
          const shouldUpdateCollectMode = isManualEdit || inputIsCollect !== undefined;
          const shouldUpdateShowPrice = isManualEdit && show_price !== undefined;
          const shouldUpdateStockQuantity = hasStockQuantity;
          const hasLastSyncTime = data.hasOwnProperty('last_sync_time'); // 是否传入了 last_sync_time
          const onlyUpdatingShowPrice = isManualEdit &&
            show_price !== undefined &&
            retail_price === undefined &&
            wholesale_price === undefined;

          // 分步构建 SQL 和参数，避免模板字符串变量求值问题
          const updateQuery = `UPDATE price_list
            SET retail_price = ${onlyUpdatingShowPrice ? 'retail_price' : (isManualEdit ? '?' : 'COALESCE(?, retail_price)')},
                wholesale_price = ${onlyUpdatingShowPrice ? 'wholesale_price' : (isManualEdit ? '?' : 'COALESCE(?, wholesale_price)')},
                stock_quantity = ${shouldUpdateStockQuantity ? '?' : 'stock_quantity'}, status = ?,
                is_collect = ${shouldUpdateCollectMode ? '?' : 'is_collect'},
                remark = ?,
                external_model = ?,
                ${shouldUpdateShowPrice ? 'show_price = ?' : 'show_price = show_price'},
                ${hasLastSyncTime && isManualEdit && finalSyncTime === null ? 'last_sync_time = NULL' : (isManualEdit && !hasLastSyncTime ? 'last_sync_time = last_sync_time' : 'last_sync_time = ?')},
                updated_at = ?
            WHERE id = ?
          `;
          const updateParams = [
            // 🔥 关键修复：只在非仅更新 show_price 时使用价格参数
          ];

          // 价格参数
          if (!onlyUpdatingShowPrice) {
            updateParams.push(
              newRetailPrice,
              isManualEdit ? newWholesalePrice : newWholesalePrice
            );
          }

          // 通用参数
          if (shouldUpdateStockQuantity) {
            updateParams.push(stock_quantity);
          }
          updateParams.push(status);

          // 只有在需要更新采集模式时才添加该参数
          if (shouldUpdateCollectMode) {
            updateParams.push(finalIsCollect);
          }

          updateParams.push(remark);
          updateParams.push(external_model);

          // 只有在手动编辑且传入了 show_price 时才更新该字段
          if (shouldUpdateShowPrice) {
            updateParams.push(show_price);
          }

          // 根据是否需要更新时间来添加参数
          if (hasLastSyncTime || !isManualEdit) {
            // 需要更新时间：要么传入了 last_sync_time，要么是自动同步
            updateParams.push(finalSyncTime);
          }
          // 如果是手动编辑但没有传入 last_sync_time，SQL 使用 'last_sync_time = last_sync_time' 保持原值

          updateParams.push(finalSyncTime || this.getBeijingTime()); // updated_at
          updateParams.push(priceItemId);

          await this.db.query(updateQuery, updateParams);

          const showPriceLog = shouldUpdateShowPrice ? `更新为 ${show_price}` : `保持原值`;
          log.debug(`  ✅ 更新价格: ${brand_name} ${model_number} ${external_model || ''} ${color_name || ''} ${memory || ''} -> 批发价:${wholesale_price}, 零售价:${newRetailPrice}, show_price:${showPriceLog} (北京时间: ${finalSyncTime})`);
          log.debug(`  📝 shouldUpdateShowPrice=${shouldUpdateShowPrice}, onlyUpdatingShowPrice=${onlyUpdatingShowPrice}, isManualEdit=${isManualEdit}, 传入show_price=${show_price}`);
          log.debug(`  📝 UPDATE 参数:`, updateParams);
        } else {
          // 价格没有变化，跳过更新，只更新同步时间
          log.debug(`  ⏭️  价格未变化，跳过更新: ${brand_name} ${model_number} ${external_model || ''} ${color_name || ''} ${memory || ''}`);

          // 只更新同步时间，不更新价格
          await this.db.query(
            `UPDATE price_list SET last_sync_time = ?, updated_at = ? WHERE id = ?`,
            [finalSyncTime || this.getBeijingTime(), finalSyncTime || this.getBeijingTime(), priceItemId]
          );
        }
      }

      // 🔥 关键修复：只更新已有记录，不自动创建新记录
      // 当 allowCreate 为 false 时，如果记录不存在则跳过
      if (!priceItemId) {
        if (allowCreate) {
          const insertTimestamp = this.getBeijingTime();
          const insertLastSyncTime = finalSyncTime;

          // 新增 - 使用 ID 关联
          const insertQuery = `
            INSERT INTO price_list
            (brand_id, model_id, color_id, memory_id, external_model, retail_price, wholesale_price,
             stock_quantity, status, is_collect, show_price, remark, last_sync_time, updated_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          const [result] = await this.db.query(insertQuery, [
            brand_id,
            model_id,
            color_id,
            memory_id,
            external_model,
            finalRetailPrice || null,
            wholesale_price || null,
            stock_quantity,
            status,
            finalIsCollect,
            show_price !== undefined ? show_price : 0,
            remark,
            insertLastSyncTime,
            insertTimestamp,
            insertTimestamp
          ]);

          priceItemId = result.insertId;

          // 记录价格历史
          const normalizePriceForHistory = (price) => {
            if (price === null || price === undefined || price === '') return null;
            const num = parseFloat(price);
            return Number.isNaN(num) ? null : num;
          };

          await this.recordPriceHistory(priceItemId, {
            retail_price: normalizePriceForHistory(finalRetailPrice),
            wholesale_price: normalizePriceForHistory(wholesale_price),
            cost_price: null
          }, 'create', changeReason || (isManualEdit ? 'manual' : 'sync'));

          log.debug(`  新增价格: ${brand_name} ${model_number} ${external_model || ''} ${color_name || ''} ${memory || ''} -> 批发价:${wholesale_price} (北京时间: ${finalSyncTime})`);
        } else {
          // 不允许创建新记录，跳过
          log.debug(`  ⏭️  跳过创建新记录（allowCreate=false）: ${brand_name} ${model_number} ${external_model || ''} ${color_name || ''} ${memory || ''}`);
          return this.createErrorResponse('记录不存在且不允许创建', { skipped: true });
        }
      }

      return this.createSuccessResponse('保存成功', { id: priceItemId, changeType });
    } catch (error) {
      log.error('保存价格记录失败:', {
        message: error.message,
        code: error.code,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
        stack: error.stack
      });
      return this.createErrorResponse(error.message || '保存失败');
    }
  }

  /**
   * 批量导入价格
   */
  async bulkImportPrices(items) {
    try {
      const results = {
        success: 0,
        failed: 0,
        errors: []
      };

      for (const item of items) {
        const result = await this.upsertPriceItem(item);
        if (result.success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({
            item: `${item.brand_name} - ${item.model_number}`,
            error: result.message
          });
        }
      }

      return this.createSuccessResponse('导入完成', results);
    } catch (error) {
      log.error('批量导入失败:', error);
      return this.createErrorResponse('批量导入失败');
    }
  }

  // ==================== 同步配置管理 ====================

  /**
   * 获取同步配置
   * @param {boolean} hidePassword 是否隐藏密码（默认true，用于前端显示；设为false返回真实密码用于编辑）
   */
  async getSyncConfig(hidePassword = true) {
    try {
      // 同步主链路统一只认默认配置
      const query = `SELECT * FROM price_sync_config WHERE is_default = 1 LIMIT 1`;
      const [rows] = await this.db.query(query);

      if (rows.length === 0) {
        return this.createErrorResponse('未找到默认同步配置');
      }

      const config = rows[0];

      // 处理密码字段
      if (config.login_password) {
        if (hidePassword) {
          // 前端显示时使用占位符
          config.login_password = '••••••••';
        } else {
          // 返回真实密码（解密后的）用于编辑
          try {
            config.login_password = this.decryptPassword(config.login_password);
          } catch (e) {
            // 解密失败，保持原样
            config.login_password = '••••••••';
          }
        }
      }

      return this.createSuccessResponse('获取成功', config);
    } catch (error) {
      log.error('获取同步配置失败:', error);
      return this.createErrorResponse('获取配置失败');
    }
  }

  /**
   * 根据ID获取同步配置（用于编辑，返回真实密码）
   */
  async getSyncConfigById(configId) {
    try {
      const query = 'SELECT * FROM price_sync_config WHERE id = ?';
      const [rows] = await this.db.query(query, [configId]);

      if (rows.length === 0) {
        return this.createErrorResponse('未找到同步配置');
      }

      const config = rows[0];

      // 解密密码返回真实密码（用于编辑显示）
      if (config.login_password) {
        try {
          config.login_password = this.decryptPassword(config.login_password);
          log.debug('✅ 编辑配置：密码解密成功，密码长度:', config.login_password?.length);
        } catch (e) {
          log.error('❌ 解密密码失败:', e);
          config.login_password = '';
        }
      }

      return this.createSuccessResponse('获取成功', config);
    } catch (error) {
      log.error('获取同步配置失败:', error);
      return this.createErrorResponse('获取配置失败');
    }
  }

  /**
   * 根据ID获取同步配置的真实密码（用于同步时）
   */
  async getSyncConfigWithPassword(configId) {
    try {
      const query = 'SELECT * FROM price_sync_config WHERE id = ?';
      const [rows] = await this.db.query(query, [configId]);

      if (rows.length === 0) {
        return this.createErrorResponse('未找到同步配置');
      }

      const config = rows[0];

      // 解密密码返回真实密码
      if (config.login_password) {
        try {
          config.login_password = this.decryptPassword(config.login_password);
        } catch (e) {
          log.error('解密密码失败:', e);
          config.login_password = null;
        }
      }

      return this.createSuccessResponse('获取成功', config);
    } catch (error) {
      log.error('获取同步配置失败:', error);
      return this.createErrorResponse('获取配置失败');
    }
  }

  /**
   * 更新同步配置
   */
  async updateSyncConfig(configData) {
    try {
      const {
        config_name,
        source_url,
        login_url,
        login_username,
        login_password,
        sync_interval
      } = configData;

      // 只更新当前默认配置，避免 is_active 和 is_default 口径混用
      const [currentConfigs] = await this.db.query(
        'SELECT id FROM price_sync_config WHERE is_default = 1 LIMIT 1'
      );

      if (currentConfigs.length === 0) {
        return this.createErrorResponse('未找到默认同步配置');
      }

      const configId = currentConfigs[0].id;

      // 只有当密码不是占位符且有值时才更新密码
      const shouldUpdatePassword = login_password && login_password !== '******';

      // 加密密码
      let encryptedPassword = null;
      if (shouldUpdatePassword) {
        encryptedPassword = this.encryptPassword(login_password);
      }

      const query = `
        UPDATE price_sync_config
        SET config_name = ?,
            source_url = ?,
            login_url = ?,
            login_username = ?,
            ${shouldUpdatePassword ? 'login_password = ?,' : ''}
            sync_interval = ?
        WHERE id = ?
      `;

      const params = [config_name, source_url, login_url, login_username];
      if (shouldUpdatePassword) {
        params.push(encryptedPassword);
      }
      params.push(sync_interval, configId);

      await this.db.query(query, params);

      return this.createSuccessResponse('配置更新成功');
    } catch (error) {
      log.error('更新同步配置失败:', error);
      return this.createErrorResponse('更新配置失败');
    }
  }

  /**
   * 获取所有同步配置列表
   */
  async getAllSyncConfigs() {
    try {
      const query = 'SELECT id, config_name, login_username, source_url, is_default, last_sync_time, last_sync_status FROM price_sync_config ORDER BY is_default DESC, id';
      const [rows] = await this.db.query(query);

      return this.createSuccessResponse('获取成功', rows);
    } catch (error) {
      log.error('获取同步配置列表失败:', error);
      return this.createErrorResponse('获取配置列表失败');
    }
  }

  /**
   * 创建新的同步配置
   */
  async createSyncConfig(configData) {
    try {
      const {
        config_name,
        source_url,
        login_url,
        login_username,
        login_password,
        sync_interval = 60
      } = configData;

      // 加密密码
      const encryptedPassword = this.encryptPassword(login_password);

      // 如果这是第一个配置，设置为默认
      const [countResult] = await this.db.query('SELECT COUNT(*) as count FROM price_sync_config');
      const isFirst = countResult[0].count === 0;

      const query = `
        INSERT INTO price_sync_config
        (config_name, source_url, login_url, login_username, login_password, sync_interval, is_default)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db.query(query, [
        config_name,
        source_url,
        login_url,
        login_username,
        encryptedPassword,
        sync_interval,
        isFirst ? 1 : 0
      ]);

      return this.createSuccessResponse('创建成功');
    } catch (error) {
      log.error('创建同步配置失败:', error);
      return this.createErrorResponse('创建配置失败');
    }
  }

  /**
   * 设置默认同步配置
   */
  async setDefaultSyncConfig(configId) {
    try {
      // 先取消所有默认标记
      await this.db.query('UPDATE price_sync_config SET is_default = 0');

      // 设置新的默认配置
      await this.db.query('UPDATE price_sync_config SET is_default = 1 WHERE id = ?', [configId]);

      return this.createSuccessResponse('默认配置已设置');
    } catch (error) {
      log.error('设置默认配置失败:', error);
      return this.createErrorResponse('设置默认配置失败');
    }
  }

  /**
   * 删除同步配置
   */
  async deleteSyncConfig(configId) {
    try {
      // 检查是否是默认配置
      const [configs] = await this.db.query('SELECT is_default FROM price_sync_config WHERE id = ?', [configId]);

      if (configs.length === 0) {
        return this.createErrorResponse('配置不存在');
      }

      if (configs[0].is_default) {
        return this.createErrorResponse('不能删除默认配置，请先设置其他配置为默认');
      }

      await this.db.query('DELETE FROM price_sync_config WHERE id = ?', [configId]);

      return this.createSuccessResponse('删除成功');
    } catch (error) {
      log.error('删除同步配置失败:', error);
      return this.createErrorResponse('删除配置失败');
    }
  }

  /**
   * 更新指定ID的同步配置
   */
  async updateSyncConfigById(configId, configData) {
    try {
      const {
        config_name,
        source_url,
        login_url,
        login_username,
        login_password,
        sync_interval
      } = configData;

      // 只有当密码不是占位符且有值时才更新密码
      const shouldUpdatePassword = login_password && login_password !== '••••••••' && login_password !== '******';

      // 加密密码
      let encryptedPassword = null;
      if (shouldUpdatePassword) {
        encryptedPassword = this.encryptPassword(login_password);
      }

      const query = `
        UPDATE price_sync_config
        SET config_name = ?,
            source_url = ?,
            login_url = ?,
            login_username = ?,
            ${shouldUpdatePassword ? 'login_password = ?,' : ''}
            sync_interval = ?
        WHERE id = ?
      `;

      const params = [config_name, source_url, login_url, login_username];
      if (shouldUpdatePassword) {
        params.push(encryptedPassword);
      }
      params.push(sync_interval, configId);

      await this.db.query(query, params);

      return this.createSuccessResponse('配置更新成功');
    } catch (error) {
      log.error('更新同步配置失败:', error);
      return this.createErrorResponse('更新配置失败');
    }
  }

  // ==================== 同步功能 ====================

  /**
   * 执行同步（核心功能）
   */
  async executeSync(configId = null, syncType = 'manual', userId = null) {
    // 🔍 检查数据库是否已初始化
    if (!this.db) {
      log.error('❌ 数据库未初始化，无法执行同步');
      return this.createErrorResponse('数据库未初始化');
    }

    const logId = await this.createSyncLog(configId, syncType, userId);

    try {
      // 更新日志状态为运行中
      await this.updateSyncLog(logId, { status: 'running' });

      // 获取配置 - 优先使用 configId 获取完整配置
      let config;
      if (configId) {
        const result = await this.getSyncConfigWithPassword(configId);
        if (!result.success || !result.data) {
          throw new Error(`未找到ID为 ${configId} 的同步配置`);
        }
        config = result;
      } else {
        // 如果没有指定 configId，获取默认激活的配置
        config = await this.getSyncConfig();
        if (!config.success || !config.data) {
          throw new Error('未找到有效的同步配置');
        }
      }

      const syncConfig = config.data;
      log.debug(`🔧 使用同步配置: ${syncConfig.config_name}, 账号: ${syncConfig.login_username || '无'}`);
      log.debug(`📋 配置详情:`, {
        login_url: syncConfig.login_url,
        source_url: syncConfig.source_url,
        has_password: !!syncConfig.login_password
      });

      // 如果有登录信息，先登录
      if (syncConfig.login_url && syncConfig.login_username) {
        // 清除该配置的旧cookie，确保每次都重新登录
        const cookieKeys = [syncConfig.id, `${syncConfig.id}_array`];
        cookieKeys.forEach(key => {
          if (this.cookies.has(key)) {
            log.debug(`🗑️  清除配置ID:${syncConfig.id}的旧cookie (${key})`);
            this.cookies.delete(key);
          }
        });

        log.debug('🔐 开始登录数据源...');
        log.debug(`   登录URL: ${syncConfig.login_url}`);
        log.debug(`   用户名: ${syncConfig.login_username}`);
        const loginSuccess = await this.loginToSource(syncConfig);
        log.debug('🔐 登录结果:', loginSuccess);
        if (!loginSuccess) {
          throw new Error('登录失败');
        }
        log.debug('✅ 登录成功');
      }

      // 抓取价格数据
      log.debug('🌐 开始抓取价格数据...');
      const prices = await this.fetchPriceData(syncConfig);
      log.debug('✅ 数据抓取完成');

      // 生成统一的同步时间（北京时间）
      const syncTime = this.getBeijingTime();
      log.debug(`🕐 统一同步时间: ${syncTime}`);

      // 解析并保存数据
      log.debug('📊 开始解析和保存数据...');
      // 注意：只更新 price_list 表中 is_collect = 1 的记录
      const changeReason = syncType === 'manual' ? 'manual' : 'sync';
      const results = await this.parseAndSavePrices(prices, syncTime, changeReason);
      log.debug('✅ 数据解析和保存完成:', results);

      // 构建详细的同步结果
      const syncDetails = {
        summary: {
          total: results.total,
          success: results.success,
          failed: results.failed,
          auto_completed: 0,
          success_rate: results.total > 0 ? Math.round((results.success / results.total) * 100) : 0
        },
        items: {
          success: results.details?.success || [],
          failed: results.details?.failed || []
        },
        timestamp: new Date().toISOString(),
        config: {
          id: syncConfig.id,
          name: syncConfig.config_name
        }
      };

      // 更新同步日志
      await this.updateSyncLog(logId, {
        status: 'success',
        end_time: new Date(),
        total_count: results.total,
        success_count: results.success,
        failed_count: results.failed,
        sync_details: JSON.stringify(syncDetails)
      });

      // 更新配置的最后同步时间
      await this.db.query(
        'UPDATE price_sync_config SET last_sync_time = NOW(), last_sync_status = ? WHERE id = ?',
        ['success', syncConfig.id]
      );

      return this.createSuccessResponse('同步成功', results);
    } catch (error) {
      log.error('❌ 同步失败:', error.message);
      log.error('❌ 错误堆栈:', error.stack);

      // 构建失败详情
      const syncDetails = {
        summary: {
          total: 0,
          success: 0,
          failed: 0,
          success_rate: 0
        },
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        timestamp: new Date().toISOString(),
        config: {
          id: configId,
          name: 'Unknown'  // 在错误情况下无法获取配置名称
        }
      };

      await this.updateSyncLog(logId, {
        status: 'failed',
        end_time: new Date(),
        error_message: error.message,
        sync_details: JSON.stringify(syncDetails)
      });

      await this.db.query(
        'UPDATE price_sync_config SET last_sync_status = ? WHERE id = ?',
        ['failed', configId]
      );

      return this.createErrorResponse(error.message);
    }
  }

  /**
   * 登录数据源 - 优先使用HTTP登录（无需Chrome），失败后降级到Puppeteer
   */
  async loginToSource(config) {
    try {
      log.debug(`🔐 开始登录: 用户名=${config.login_username}`);

      // 检查密码是否已经解密（如果不是加密格式，说明已经是明文）
      let password = config.login_password;
      if (password && password.includes(':')) {
        // 是加密格式，需要解密
        password = this.decryptPassword(password);
      }

      // 如果解密返回的是占位符或为空，说明密码无效
      if (!password || password === '••••••••') {
        log.error('❌ 密码无效或解密失败');
        return false;
      }

      log.debug(`🔑 使用密码长度: ${password.length}`);

      // 准备登录配置
      const loginConfig = {
        login_url: config.login_url,
        login_username: config.login_username,
        login_password: password
      };

      // 🔥 方案1: HTTP 登录（带 OCR 验证码识别，无需 Chrome）
      // 优先使用 HTTP 登录，适合云端环境（无需浏览器）
      log.debug(`🌐 尝试使用 HTTP 登录（无需浏览器）...`);
      try {
        const httpResult = await this.httpLoginService.login(loginConfig);
        if (httpResult.success) {
          this.cookies.set(config.id, httpResult.cookies);
          // 同时存储 cookiesArray，供后续使用
          if (httpResult.cookiesArray) {
            this.cookies.set(`${config.id}_array`, httpResult.cookiesArray);
          }
          log.debug(`✅ HTTP 登录成功 (用户: ${config.login_username})`);
          log.debug(`   已存储 cookies 和 cookiesArray`);
          return true;
        }
        log.debug(`⚠️ HTTP 登录失败: ${httpResult.error || '未知错误'}`);
      } catch (httpError) {
        log.debug(`⚠️ HTTP 登录异常: ${httpError.message}`);
      }

      // 🔥 方案2: 使用 Puppeteer 浏览器登录（备用方案，需要 Chrome）
      log.debug(`🔄 HTTP 登录失败，尝试使用 Puppeteer 浏览器登录...`);

      // 先检查 Chrome 是否可用
      const hasChrome = await this.puppeteerService.isChromeAvailable();
      if (!hasChrome) {
        log.debug(`⚠️ 云端环境: Chrome 浏览器不可用，跳过 Puppeteer 登录`);
        log.debug(`💡 HTTP 登录失败，且 Puppeteer 不可用，请检查：`);
        log.debug(`   1. 验证码识别是否正确`);
        log.debug(`   2. 登录凭据是否有效`);
        log.debug(`   3. 目标网站是否可访问`);
        return false;
      }

      try {
        await this.puppeteerService.launchBrowser();
        const puppeteerResult = await this.puppeteerService.login(loginConfig);

        if (puppeteerResult.success) {
          this.cookies.set(config.id, puppeteerResult.cookies);
          this.cookies.set(`${config.id}_array`, puppeteerResult.cookiesArray);
          log.debug(`✅ Puppeteer 登录成功 (用户: ${config.login_username})`);
          return true;
        }
        log.error(`❌ Puppeteer 登录失败: ${puppeteerResult.error}`);
        return false;
      } catch (puppeteerError) {
        // 云端环境常见的 memlock 错误，提供友好提示
        if (puppeteerError.message.includes('memlock') || puppeteerError.message.includes('Operation not permitted')) {
          log.error(`❌ 云端环境限制: Puppeteer 无法启动 (memlock 权限限制)`);
          log.error(`💡 建议: 仅使用 HTTP 登录方式，或联系服务器管理员配置 memlock 权限`);
        } else {
          log.error(`❌ Puppeteer 登录异常: ${puppeteerError.message}`);
        }
        return false;
      }

    } catch (error) {
      log.error('❌ 登录失败:', error.message);
      return false;
    }
  }

  /**
   * 抓取价格数据 - 先获取通用数据，然后针对缺失的型号单独搜索
   */
  async fetchPriceData(config) {
    try {
      log.debug('🔍 开始抓取价格数据，配置ID:', config.id);
      log.debug('📍 数据源URL:', config.source_url);
      log.debug('👤 使用账户:', config.login_username);

      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Connection': 'keep-alive'
      };

      // 使用登录后的cookies（必须在executeSync中先登录）
      if (this.cookies.has(config.id)) {
        headers['Cookie'] = this.cookies.get(config.id);
        log.debug('📝 使用登录后的cookies获取数据 (账户:', config.login_username, ')');
        log.debug('📝 Cookies长度:', headers['Cookie'].length);
        log.debug('📝 Cookies内容:', headers['Cookie'].substring(0, 100) + '...');
      } else {
        log.debug('⚠️ 未找到cookies，可能未登录');
        log.debug('⚠️ 当前存储的cookie键:', Array.from(this.cookies.keys()));
      }

      // 📝 测试cookies是否有效 - 发送一个简单的HEAD请求
      log.debug('🧪 测试cookies有效性...');
      try {
        const testResponse = await axios.head(config.source_url, {
          headers,
          timeout: 10000,
          maxRedirects: 5
        });
        log.debug('   测试响应状态:', testResponse.status);
        log.debug('   测试响应头:', JSON.stringify(testResponse.headers).substring(0, 200));
      } catch (testError) {
        log.debug('   ⚠️ 测试请求失败:', testError.message);
        if (testError.response) {
          log.debug('   响应状态:', testError.response.status);
        }
      }

      // 获取库存中所有苹果产品的型号
      log.debug('📦 查询库存中的苹果产品型号...');
      const [inventoryModels] = await this.db.query(`
        SELECT DISTINCT mo.name as model_number
        FROM phones p
        JOIN models mo ON p.model_id = mo.id
        JOIN brands b ON p.brand_id = b.id
        WHERE p.status = 'in_stock' AND b.name = '苹果'
        ORDER BY mo.name
      `);

      log.debug('📦 库存中的苹果型号数量:', inventoryModels.length);
      if (inventoryModels.length > 0) {
        log.debug('📦 库存中的苹果型号:', inventoryModels.map(m => m.model_number));
      } else {
        log.debug('⚠️ 库存中没有苹果产品，无法同步价格');
      }

      // price_list 中启用采集的苹果型号也必须参与搜索，不能只依赖 phones 库存
      const [collectedPriceListModels] = await this.db.query(`
        SELECT DISTINCT mo.name AS model_number
        FROM price_list p
        JOIN models mo ON p.model_id = mo.id
        JOIN brands b ON p.brand_id = b.id
        WHERE b.name = '苹果' AND COALESCE(p.is_collect, 1) = 1
        ORDER BY mo.name
      `);
      log.debug('📦 price_list 中开启采集的苹果型号:', collectedPriceListModels.map(m => m.model_number));

      const combinedModelMap = new Map();
      [...inventoryModels, ...collectedPriceListModels].forEach(item => {
        if (item?.model_number) {
          combinedModelMap.set(item.model_number, item);
        }
      });
      const searchSourceModels = Array.from(combinedModelMap.values());
      log.debug('📦 最终用于搜索的苹果型号:', searchSourceModels.map(m => m.model_number));

      // 🔥 关键修复：如果库存为空，仍然尝试搜索重要型号（用于无库采集）
      if (inventoryModels.length === 0) {
        log.debug('🔥 库存为空，但仍然尝试搜索重要型号以支持无库采集');
        // 不在这里添加，让下面的逻辑处理
      }

      // 需要搜索的型号代码映射
      const modelCodeMappings = {
        'iphone15': 'A3092',
        'iphone15plus': 'A3096',
        'iphone15pro': 'A3104',
        'iphone15promax': 'A3108',
        'iphone17air': 'A3518',
        'iphone17': 'A3521',
        'iphone17pro': 'A3524',
        'iphone17promax': 'A3527',
        'iphone17e': 'A3635',
        'iphone16': 'A3288',
        'iphone16plus': 'A3291',
        'iphone16pro': 'A3294',
        'iphone16promax': 'A3297',
        'iphone16e': 'A3410',
        'airpods': 'pods',
        'airpods4': 'pods',
        'airpodspro3': 'pods',
        'airpodspro2': 'pods',
        'airpodsmax': 'pods',
        'ipad': 'iPad'
      };

      // 添加反向映射：从库存型号到标准型号
      const inventoryToStandardMapping = {
        '17promax': 'iphone17promax',
        '17pro': 'iphone17pro',
        '17air': 'iphone17air',
        '15promax': 'iphone15promax',
        '16promax': 'iphone16promax',
        // 其他数字开头的型号
        '15pro': 'iphone15pro',
        '16pro': 'iphone16pro'
      };

      // 步骤1: 先获取通用搜索数据
      log.debug('📡 步骤1: 获取通用"同城"搜索数据...');
      log.debug('   配置ID:', config.id);
      log.debug('   配置名称:', config.config_name);
      log.debug('   登录账户:', config.login_username);
      log.debug('   请求URL:', config.source_url);
      let combinedRows = '';

      try {
        const response = await axios.get(config.source_url, {
          headers,
          timeout: 30000,
          maxRedirects: 5
        });

        log.debug('   响应状态:', response.status);
        log.debug('   响应头:', JSON.stringify(response.headers).substring(0, 200));
        log.debug('   响应数据长度:', response.data?.length || 0);
        log.debug('   响应数据前500字符:', response.data?.substring(0, 500) || '');

        const $ = cheerio.load(response.data);
        const table = $('table').first();
        if (table.length > 0) {
          // 提取所有行（包括表头）
          combinedRows = table.html() || '';
          log.debug('✓ 通用数据获取成功，行数:', $('tr').length);
        } else {
          log.debug('⚠️ 页面中没有找到table元素');
          log.debug('   页面标题:', $('title').text());
          log.debug('   页面body前200字符:', $('body').text().substring(0, 200));

          // 如果HTTP请求没有获取到数据，尝试使用Puppeteer
          if (this.cookies.has(`${config.id}_array`)) {
            log.debug('🔄 尝试使用Puppeteer获取数据...');
            try {
              const cookiesArray = this.cookies.get(`${config.id}_array`);
              const html = await this.puppeteerService.fetchData(config.source_url, cookiesArray);
              const $puppeteer = cheerio.load(html);
              const tablePuppeteer = $puppeteer('table').first();
              if (tablePuppeteer.length > 0) {
                combinedRows = tablePuppeteer.html() || '';
                log.debug('✓ Puppeteer获取数据成功，行数:', $puppeteer('tr').length);
              }
            } catch (puppeteerError) {
              log.debug('⚠️ Puppeteer获取数据也失败:', puppeteerError.message);
            }
          }
        }

        // 检查通用数据中包含了哪些型号代码
        // 注意：只在表格内容中检查，不在整个HTML页面中检查
        const foundModelCodes = new Set();
        for (const [modelKey, modelCode] of Object.entries(modelCodeMappings)) {
          // 只在表格行中检查型号代码是否存在
          if (combinedRows.includes(modelCode)) {
            foundModelCodes.add(modelKey);
          }
        }
        log.debug('✓ 通用数据表格中已包含的型号代码:', Array.from(foundModelCodes));

        // 步骤2: 找出缺失的型号，进行单独搜索
        // 对于iPhone 16及以上，即使通用数据中有型号代码，也要单独搜索以确保获取完整数据
        const alwaysSearchModels = ['iphone16', 'iphone16plus', 'iphone16pro', 'iphone16promax', 'iphone16e', 'iphone17air', 'iphone17', 'iphone17e', 'iphone17pro', 'iphone17promax'];

        // 🔥 关键修复：如果是无库采集模式，强制搜索所有重要型号，即使库存中没有
        let missingModels = searchSourceModels
          .map(m => {
            // 标准化型号名称
            let modelKey = m.model_number.toLowerCase().replace(/\s+/g, '');

            // 先检查是否需要转换（如 17promax -> iphone17promax）
            if (inventoryToStandardMapping[modelKey]) {
              modelKey = inventoryToStandardMapping[modelKey];
            }
            // 如果以数字开头，添加 iphone 前缀
            else if (/^\d/.test(modelKey)) {
              modelKey = 'iphone' + modelKey;
            }

            log.debug(`  转换型号: ${m.model_number} -> ${modelKey}`);
            return modelKey;
          })
          .filter(modelKey => {
            // 🔥 特殊处理iPad：iPad总是需要单独搜索
            if (modelKey.includes('ipad')) {
              log.debug(`  ${modelKey} 是iPad产品，需要单独搜索`);
              return true;
            }

            // 如果没有型号代码映射，跳过（除了iPad）
            if (!modelCodeMappings[modelKey]) return false;

            // 对于iPhone 16及以上，总是进行单独搜索
            if (alwaysSearchModels.includes(modelKey)) {
              log.debug(`  ${modelKey} 是iPhone 16+系列，强制单独搜索`);
              return true;
            }

            // 其他型号：只在通用数据中没有时才搜索
            // 例外：AirPods 和 iPad 产品总是单独搜索
            return !foundModelCodes.has(modelKey) ||
                   modelKey.includes('airpods') ||
                   modelKey.includes('ipad');
          });

        // 🔥 关键修复：如果库存为空或很少（少于5个），强制搜索所有重要型号以支持无库采集
        // 🔥 同时也处理库存为空的情况
        if (inventoryModels.length === 0 || inventoryModels.length < 5) {
          const inventoryModelKeys = new Set(inventoryModels.map(m => {
            let key = m.model_number.toLowerCase().replace(/\s+/g, '');
            if (inventoryToStandardMapping[key]) {
              key = inventoryToStandardMapping[key];
            } else if (/^\d/.test(key)) {
              key = 'iphone' + key;
            }
            return key;
          }));

          // 添加库存中没有但需要搜索的型号
          alwaysSearchModels.forEach(modelKey => {
            if (!inventoryModelKeys.has(modelKey) && !missingModels.includes(modelKey)) {
              const reason = inventoryModels.length === 0 ? '库存为空' : `库存较少(${inventoryModels.length}个)`;
              log.debug(`🔥 ${reason}，强制搜索 ${modelKey}`);
              missingModels.push(modelKey);
            }
          });
        }

        if (missingModels.length > 0) {
          log.debug('📡 步骤2: 以下型号需要单独搜索:', missingModels);

          // 🔥 优化：如果有iPad型号，只搜索一次"iPad"即可
          const hasIPad = missingModels.some(m => m.includes('ipad'));
          const hasAirPods = missingModels.some(m => m.includes('airpods'));
          const nonIPadAndAirPodsModels = missingModels.filter(m => !m.includes('ipad') && !m.includes('airpods'));

          // 先搜索iPad（如果有）
          if (hasIPad) {
            log.debug(`  正在搜索所有iPad产品 (搜索词: "iPad")...`);
            const searchUrl = `https://81119.byb2b.cn/quoteList.action?km=&pp=%E8%8B%B9%E6%9E%9C&network=&arg_name=iPad&s_jg=&e_jg=&policyid=&tykhgsdm=&isqh=0`;

            try {
              const response = await axios.get(searchUrl, {
                headers,
                timeout: 30000,
                maxRedirects: 5
              });

              const $ = cheerio.load(response.data);
              const table = $('table').first();
              if (table.length > 0) {
                combinedRows += table.html();
                log.debug(`  ✓ iPad 数据获取成功`);
              }
            } catch (error) {
              log.debug(`  ⚠️ iPad 数据获取失败:`, error.message);
            }
          }

          // 搜索AirPods（如果有）
          if (hasAirPods) {
            log.debug(`  正在搜索所有AirPods产品 (搜索词: "pods")...`);
            const searchUrl = `https://81119.byb2b.cn/quoteList.action?km=&pp=&network=&arg_name=pods&s_jg=&e_jg=&policyid=&tykhgsdm=&isqh=0`;

            try {
              const response = await axios.get(searchUrl, {
                headers,
                timeout: 30000,
                maxRedirects: 5
              });

              const $ = cheerio.load(response.data);
              const table = $('table').first();
              if (table.length > 0) {
                combinedRows += table.html();
                log.debug(`  ✓ AirPods 数据获取成功，行数:`, $('tr').length);
              }
            } catch (error) {
              log.debug(`  ⚠️ AirPods 数据获取失败:`, error.message);
            }
          }

          // 再搜索其他型号
          for (const modelKey of nonIPadAndAirPodsModels) {
            const modelCode = modelCodeMappings[modelKey];

            // 🔥 关键修复：对于 iPhone 16 系列，使用产品名称搜索而不是型号代码
            // 因为外部网站搜索 "iPhone 16" 会返回所有 16 系列产品（包括 Plus、Pro、Pro Max）
            let searchTerm = modelCode;
            if (modelKey === 'iphone16') {
              searchTerm = 'iPhone 16'; // 搜索 "iPhone 16" 会返回所有 16 系列产品
              log.debug(`  正在搜索 ${modelKey} (使用搜索词: "${searchTerm}")...`);
            } else {
              log.debug(`  正在搜索 ${modelKey} (${modelCode})...`);
            }

            const searchUrl = `https://81119.byb2b.cn/quoteList.action?km=&pp=%E8%8B%B9%E6%9E%9C&network=&arg_name=${searchTerm}&s_jg=&e_jg=&policyid=&tykhgsdm=&isqh=0`;

            try {
              log.debug(`  请求URL: ${searchUrl}`);
              log.debug(`  请求头Cookie: ${headers.Cookie?.substring(0, 100)}...`);
              const response = await axios.get(searchUrl, {
                headers,
                timeout: 30000,
                maxRedirects: 5
              });

              log.debug(`  响应状态: ${response.status}`);
              log.debug(`  响应数据长度: ${response.data?.length || 0}`);

              // 提取表格内容并合并（只合并行，不添加table标签）
              const $ = cheerio.load(response.data);
              const table = $('table').first();
              if (table.length > 0) {
                const rowCount = $('tr').length;
                combinedRows += table.html();
                log.debug(`  ✓ ${modelKey} (${modelCode}) 数据获取成功，行数: ${rowCount}`);
              } else {
                log.debug(`  ⚠️ ${modelKey} (${modelCode}) 响应中没有找到表格`);
                log.debug(`     页面标题: ${$('title').text()}`);
              }
            } catch (error) {
              log.debug(`  ⚠️ ${modelKey} (${modelCode}) 数据获取失败:`, error.message);
              if (error.response) {
                log.debug(`     响应状态: ${error.response.status}`);
              }
            }
          }

          log.debug('✓ 合并数据完成，总行数:', combinedRows.length / 100);
        } else {
          log.debug('✓ 所有型号都在通用数据中，无需单独搜索');
        }
      } catch (error) {
        log.debug('⚠️ 通用数据获取失败:', error.message);
        log.debug('   错误类型:', error.code);
        log.debug('   错误详情:', error.response?.status, error.response?.statusText);
      }

      log.debug('📊 最终数据汇总:');
      log.debug('   combinedRows长度:', combinedRows.length);

      if (!combinedRows) {
        log.error('❌ 错误: 没有获取到任何数据');
        log.error('   可能的原因:');
        log.error('   1. 数据源URL无法访问');
        log.error('   2. 页面结构变化，没有找到table元素');
        log.error('   3. 库存中没有苹果产品，无需同步');
        throw new Error('没有获取到任何数据');
      }

      // 将所有行包装在一个 table 中
      return '<table>' + combinedRows + '</table>';
    } catch (error) {
      log.error('抓取数据失败:', error.message);
      throw new Error('抓取数据失败: ' + error.message);
    }
  }

  /**
   * 解析并保存价格数据
   * 支持JSON API数据和HTML数据
   * @param {string|object} data - HTML字符串或JSON对象
   * @param {string} syncTime - 统一同步时间（北京时间）
   */
  async parseAndSavePrices(data, syncTime = null, changeReason = 'sync') {
    try {
      // 如果没有传入时间，生成统一的当前时间（北京时间）
      if (!syncTime) {
        syncTime = this.getBeijingTime();
      }

      // 判断数据类型
      const isJsonData = typeof data === 'object' && data !== null && !Buffer.isBuffer(data);

      if (isJsonData) {
        log.debug('📊 检测到JSON数据，使用JSON解析方式');
        return await this.parseJsonData(data, syncTime, changeReason);
      } else {
        log.debug('📄 检测到HTML数据，使用HTML解析方式');
        return await this.parseHtmlData(data, syncTime, changeReason);
      }
    } catch (error) {
      log.error('解析数据失败:', error);
      throw error;
    }
  }

  /**
   * 解析JSON格式的价格数据
   * @param {object} jsonData - JSON数据对象
   * @param {string} syncTime - 统一同步时间（北京时间）
   */
  async parseJsonData(jsonData, syncTime = null, changeReason = 'sync') {
    // 如果没有传入时间，生成统一的当前时间（北京时间）
    if (!syncTime) {
      syncTime = this.getBeijingTime();
    }

    log.debug('📊 解析JSON数据:', JSON.stringify(jsonData, null, 2).substring(0, 1000));

    const prices = [];
    let successCount = 0;
    let failedCount = 0;

    // 步骤1: 从 price_list 表中获取需要采集的记录（is_collect = 1）
    log.debug('🔍 查询 price_list 表中需要采集的记录...');
    const [inventoryItems] = await this.db.query(`
      SELECT DISTINCT
        b.name as brand_name,
        mo.name as model_number,
        c.name as color_name,
        mem.size as memory
      FROM price_list p
      INNER JOIN brands b ON p.brand_id = b.id
      INNER JOIN models mo ON p.model_id = mo.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      WHERE COALESCE(p.is_collect, 1) = 1
      ORDER BY b.name, mo.name, c.name, mem.size
    `);

    log.debug(`📦 price_list 表中有 ${inventoryItems.length} 条价格记录需要更新`);

    // 步骤2: 解析JSON数据，提取价格信息
    const externalPrices = new Map();

    // 假设JSON格式为: { list: [{ brand, model, color, memory, price }, ...] }
    // 或者: { data: [...] }
    const priceList = jsonData.list || jsonData.data || jsonData.items || (Array.isArray(jsonData) ? jsonData : []);

    log.debug(`✓ 从JSON中解析到 ${priceList.length} 条价格数据`);

    priceList.forEach(item => {
      // 尝试各种可能的字段名
      const brand = item.brand || item.brand_name || item.pp || item.brandName || '苹果';
      let model = item.model || item.model_number || item.xh || item.modelName || '';
      const color = item.color || item.color_name || item.ys || item.colorName || '';
      const memory = item.memory || item.size || item.nc || item.memorySize || '';
      const price = parseFloat(item.price || item.jg || item.priceValue || 0);
      const localHintText = [
        item.title,
        item.name,
        item.product_name,
        item.description,
        item.desc,
        item.region,
        item.location,
        brand,
        model,
        color,
        memory
      ].filter(Boolean).join('-');
      const isLocal = item.isLocal === true ||
        item.is_local === 1 ||
        item.local === 1 ||
        String(item.region || item.location || '').includes('同城') ||
        this.isSameCityProduct(localHintText);

      // 使用型号代码映射
      if (model) {
        const modelCode = this.extractModelCode(model);
        if (modelCode) {
          const mappedModel = this.getModelCodeMapping(modelCode);
          if (mappedModel) {
            model = mappedModel;
          }
        }
      }

      if (brand && model && price > 0) {
        const key = `${brand}-${model}`.toLowerCase().replace(/\s+/g, '');
        if (!externalPrices.has(key)) {
          externalPrices.set(key, []);
        }
        externalPrices.get(key).push({
          brand,
          model,
          color,
          memory,
          isLocal,
          price
        });
      }
    });

    log.debug('✓ 解析到', externalPrices.size, '个品牌-型号组合的价格数据');

    // 输出所有外部价格key，帮助调试
    log.debug('📊 外部价格key列表:');
    for (const [key, priceList] of externalPrices.entries()) {
      log.debug('  ' + key + ': ' + priceList.length + '条价格, 示例价格: ' + priceList[0].price);
    }

    // 步骤3: 匹配库存产品与外部价格（复用现有逻辑）
    return await this.matchInventoryWithPrices(inventoryItems, externalPrices, syncTime, changeReason);
  }

  /**
   * 解析HTML格式的价格数据
   * @param {string} html - HTML内容
   * @param {string} syncTime - 统一同步时间（北京时间）
   */
  async parseHtmlData(html, syncTime = null, changeReason = 'sync') {
    try {
      // 如果没有传入时间，生成统一的当前时间（北京时间）
      if (!syncTime) {
        syncTime = this.getBeijingTime();
      }
      const $ = cheerio.load(html);

      // 调试：保存完整HTML到文件
      const fs = require('fs');
      const debugPath = '/Users/imac/Desktop/webtset/TF2025/backend/logs/debug-html-' + Date.now() + '.html';
      try {
        fs.writeFileSync(debugPath, html);
        log.debug('📝 完整HTML已保存到:', debugPath);
      } catch (e) {
        log.debug('⚠️ 无法保存HTML调试文件');
      }

      // 调试：输出 HTML 内容的前2000字符
      log.debug('📄 外部网页HTML内容预览 (前2000字符):');
      log.debug(html.substring(0, 2000));

      // 调试：检查是否包含特定产品
      const htmlContent = html;
      const hasA3521 = htmlContent.includes('A3521');
      const hasA3524 = htmlContent.includes('A3524');
      const hasA3527 = htmlContent.includes('A3527');
      log.debug(`🔍 HTML中包含的型号代码: A3521=${hasA3521}, A3524=${hasA3524}, A3527=${hasA3527}`);

      // 调试：检查"同城"出现次数
      const localCount = (htmlContent.match(/同城/g) || []).length;
      log.debug(`🔍 HTML中"同城"出现次数: ${localCount}`);

      // 调试：特别检查 iPhone 17 256GB
      const hasA3521_256 = htmlContent.includes('A3521') && htmlContent.includes('256GB');
      log.debug(`🔍 HTML中包含 "A3521" + "256GB": ${hasA3521_256}`);

      // 🔍 特别搜索：查找所有包含 5590 和 5650 的位置
      const price5590Matches = [...htmlContent.matchAll(/5590/g)];
      const price5650Matches = [...htmlContent.matchAll(/5650/g)];
      log.debug(`🔍 HTML中 "5590" 出现 ${price5590Matches.length} 次`);
      log.debug(`🔍 HTML中 "5650" 出现 ${price5650Matches.length} 次`);

      // 显示5590周围的上下文
      if (price5590Matches.length > 0) {
        log.debug('📋 5590 周围的文本上下文:');
        price5590Matches.slice(0, 3).forEach(pos => {
          const start = Math.max(0, pos - 100);
          const end = Math.min(htmlContent.length, pos + 100);
          log.debug('  ...' + htmlContent.substring(start, end) + '...');
        });
      }

      // 搜索所有包含 "A3521" 和 "256GB" 的价格数据
      const a3521_256_matches = htmlContent.match(/苹果 iPhone 17 \(A3521\)-256GB[^<]*?<[^>]*￥[\d,]+\.?\d*/g);
      log.debug(`🔍 找到 "A3521-256GB" 价格数据: ${a3521_256_matches ? a3521_256_matches.length : 0} 个`);
      if (a3521_256_matches && a3521_256_matches.length > 0) {
        log.debug('📋 A3521-256GB 价格数据示例:');
        a3521_256_matches.slice(0, 5).forEach((m) => {
          log.debug(`  ${m}`);
        });
      }

      // 步骤1: 获取需要采集价格的产品列表
      // 🔥 只查询 price_list 表中 is_collect = 1 的记录（需要采集）
      log.debug('🔍 查询 price_list 表中需要采集的记录...');
      const [priceListItems] = await this.db.query(`
        SELECT DISTINCT
          b.name as brand_name,
          mo.name as model_number,
          c.name as color_name,
          mem.size as memory
        FROM price_list p
        INNER JOIN brands b ON p.brand_id = b.id
        INNER JOIN models mo ON p.model_id = mo.id
        LEFT JOIN colors c ON p.color_id = c.id
        LEFT JOIN memories mem ON p.memory_id = mem.id
        WHERE COALESCE(p.is_collect, 1) = 1
        ORDER BY b.name, mo.name, c.name, mem.size
      `);
      const inventoryItems = priceListItems;
      log.debug(`📦 price_list 表中有 ${inventoryItems.length} 条价格记录需要更新`);

      // 步骤2: 解析外部网页，提取所有价格数据
      // 尝试查找 table，如果不存在则直接在 body 中查找 tr 元素
      let table = $('table').first();
      let useDirectRows = false;

      if (table.length === 0) {
        log.debug('⚠️ 未找到 table 标签，尝试直接解析 tr 元素');
        // 创建一个虚拟的 table 包含所有 tr
        const allRows = $('tr');
        if (allRows.length > 0) {
          log.debug(`✓ 找到 ${allRows.length} 个 tr 元素`);
          useDirectRows = true;
        } else {
          log.debug('页面内容预览:', html.substring(0, 500));
          throw new Error('未找到价格表格，可能需要先登录或页面结构已变化');
        }
      }

      // 获取表头
      const headers = [];
      if (!useDirectRows) {
        table.find('thead tr th, thead tr td, tr:first-child td, tr:first-child th').each((i, el) => {
          const text = $(el).text().trim();
          headers.push(text.toLowerCase());
        });
      } else {
        // 从第一个 tr 提取表头
        $('tr').first().find('td, th').each((i, el) => {
          const text = $(el).text().trim();
          headers.push(text.toLowerCase());
        });
      }

      log.debug('检测到的表头:', headers);

      // 检测表格格式
      const isEmptyHeaders = headers.every(h => !h || h.trim() === '');
      log.debug('表头是否为空:', isEmptyHeaders);

      // 存储外部网页的所有价格数据
      const externalPrices = new Map(); // key: 品牌型号, value: [{颜色, 内存, 价格}]

      if (isEmptyHeaders) {
        log.debug('🔍 使用智能解析模式（精确匹配颜色-内存-价格）');

        // 获取所有需要处理的行
        const rowsToProcess = useDirectRows ? $('tr') : table.find('tr');

        // 🔥 新的智能解析策略：按单元格成对解析产品-价格
        // 外部网站格式通常是：[产品描述] [价格] [产品描述] [价格] ...
        // 产品描述包含：型号-颜色-内存

        const rowsArray = [];
        rowsToProcess.each((_, row) => {
          rowsArray.push(row);
        });

        log.debug(`\n📊 开始解析 ${rowsArray.length} 行数据...`);

        for (const row of rowsArray) {
          const cells = $(row).find('td');
          if (cells.length < 2) continue;

          // 🔥 核心改进：成对解析相邻单元格 (产品, 价格)
          let i = 0;
          while (i < cells.length - 1) {
            const productCell = $(cells[i]);
            const priceCell = $(cells[i + 1]);
            const productText = productCell.text().trim();
            const priceText = priceCell.text().trim();

            // 跳过空单元格或明显不是产品的单元格
            if (!productText || productText === '购' || productText === '批发' || /^￥?[\d.]+$/.test(productText)) {
              i++;
              continue;
            }

            // 判断是否是 iPhone 16 及以上型号
            const modelMatch = productText.match(/iPhone\s*(\d+)|\((A\d{4})\)/i);
            let isIPhone16OrAbove = false;

            if (modelMatch) {
              const modelNum = modelMatch[1] ? parseInt(modelMatch[1]) : null;
              const modelCode = modelMatch[2] || null;

              if (modelNum) {
                isIPhone16OrAbove = modelNum >= 16;
              } else if (modelCode) {
                const codeNum = parseInt(modelCode.substring(1, 4));
                isIPhone16OrAbove = codeNum >= 328;
              }
            }

            // 应用过滤规则
            let shouldAccept = false;
            if (isIPhone16OrAbove) {
              shouldAccept = productText.includes('同城');
            } else {
              shouldAccept = true;
            }

            if (!shouldAccept) {
              i++;
              continue;
            }

            // 解析产品字符串
            const productData = await this.parseExternalProduct(productText);
            if (!productData || !productData.brand || !productData.model) {
              i++;
              continue;
            }

            // 🔥 核心改进：从紧邻的下一个单元格提取价格
            let price = null;
            let priceSource = '';

            // 检查价格单元格
            const priceMatch = priceText.match(/[￥¥](\d+\.?\d*)/);
            if (priceMatch) {
              price = parseFloat(priceMatch[1]);
              priceSource = `相邻单元格: "${priceText}"`;

              // 优先使用批发价
              if (priceText.includes('批发')) {
                priceSource += ' (批发价)';
              }
            }

            // 如果相邻单元格没有价格，检查产品单元格本身是否包含价格
            if (!price && productData.price) {
              price = productData.price;
              priceSource = '产品单元格内嵌价格';
            }

      // 🔥 调试输出：显示解析结果（iPhone 17、17E 和 AirPods）
      if (productData.brand === '苹果' && (productData.model.includes('17') || productData.model.includes('AirPods'))) {
        log.debug(`\n  📱 解析: "${productText.substring(0, 50)}..."`);
        log.debug(`     品牌: ${productData.brand}, 型号: ${productData.model}`);
        log.debug(`     颜色: ${productData.color || '⚠️未识别'}, 内存: ${productData.memory || '⚠️未识别'}`);
        log.debug(`     型号代码: ${productData.modelCode || '无'}`);
        log.debug(`     价格单元格: "${priceText}"`);
        log.debug(`     提取价格: ¥${price} (${priceSource})`);

        // 🔥 调试：如果内存未识别，显示原始文本
        if (!productData.memory) {
          log.debug(`     ⚠️ 内存提取失败，原始文本: "${productText}"`);
        }
      }

            // 保存解析结果
            if (price) {
              // 🔥 修复：标准化型号名称，去除空格和特殊字符，确保匹配一致
              const normalizedModel = productData.model.toLowerCase().replace(/\s+/g, '').replace(/[()]/g, '');
              const key = `${productData.brand}-${normalizedModel}`;
              if (!externalPrices.has(key)) {
                externalPrices.set(key, []);
              }

              // 🔥 核心：保存完整的三元组 (颜色, 内存, 价格)
              const priceEntry = {
                brand: productData.brand,
                model: productData.model,
                modelCode: productData.modelCode,
                color: productData.color || '',
                memory: productData.memory || '',
                isLocal: productData.isLocal === true || this.isSameCityProduct(productText),
                price: price,
                originalText: productText.substring(0, 80)
              };

              externalPrices.get(key).push(priceEntry);

              // 🔥 调试：显示 iPhone 17 的数据
              if (productData.brand === '苹果' && productData.model.includes('17')) {
                log.debug(`     ✅ 已保存: ${priceEntry.color}/${priceEntry.memory} = ¥${priceEntry.price}`);
                log.debug(`     📋 保存详情: key="${key}", 原始型号="${productData.model}", 标准化型号="${normalizedModel}"`);
                log.debug(`     📋 原始文本: "${productText.substring(0, 80)}"`);
              }
            }

            // 🔥 跳过价格单元格，继续下一对
            i += 2;
          }
        }

        log.debug('\n✅ 智能解析完成！');
        log.debug(`📊 解析统计: ${externalPrices.size} 个品牌-型号组合`);

        // 🔥 调试：显示所有 iPhone 17 系列的详细数据
        log.debug('\n📱 iPhone 17 系列价格数据详情:');
        let iphone17Count = 0;
        for (const [key, priceList] of externalPrices.entries()) {
          if (key.toLowerCase().includes('17')) {
            iphone17Count++;
            log.debug(`\n  【${key}】共 ${priceList.length} 条:`);
            priceList.forEach((p, idx) => {
              const memInfo = p.memory ? p.memory : '⚠️无内存信息';
              log.debug(`    ${idx + 1}. ${p.color || '?'} / ${memInfo} = ¥${p.price} (型号代码: ${p.modelCode || '无'})`);
            });
          }
        }
        if (iphone17Count === 0) {
          log.debug('  ⚠️ 未找到 iPhone 17 系列数据');
        }
      }

      // 步骤3: 使用共享的匹配方法
      const matchResult = await this.matchInventoryWithPrices(inventoryItems, externalPrices, syncTime, changeReason);

      return matchResult;
    } catch (error) {
      log.error('解析HTML数据失败:', error);
      throw error;
    }
  }

  /**
   * 将库存产品与外部价格进行匹配并保存
   * 这是一个共享方法，被 JSON 和 HTML 解析共用
   * @param {Array} inventoryItems - price_list中的产品列表
   * @param {Map} externalPrices - 外部价格数据
   * @param {string} syncTime - 可选的统一同步时间（北京时间）
   */
  async matchInventoryWithPrices(inventoryItems, externalPrices, syncTime = null, changeReason = 'sync') {
    let successCount = 0;
    let failedCount = 0;

    // 🔥 防御：如果外部价格解析失败，提前返回
    if (!externalPrices || externalPrices.size === 0) {
      log.debug('⚠️ 外部价格数据为空，无法进行匹配');
      return { total: 0, success: 0, failed: 0, details: { success: [], failed: [] } };
    }

    // 记录详细的结果列表
    const successItems = [];
    const failedItems = [];

    // 如果没有传入时间，生成统一的当前时间（北京时间）
    if (!syncTime) {
      syncTime = this.getBeijingTime();
    }

    log.debug(`\n🔍 开始匹配库存产品与外部价格...`);
    log.debug(`📦 库存产品数: ${inventoryItems.length}`);
    log.debug(`📊 外部价格组合数: ${externalPrices.size}`);
    log.debug(`🕐 统一同步时间（北京时间）: ${syncTime}\n`);

    for (const inventoryItem of inventoryItems) {
      // 生成标准化的库存产品 key
      // 处理各种型号格式：17promax, iphone17, iPhone16 等
      let inventoryModel = (inventoryItem.model_number || '')
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[()]/g, '');

      // 统一型号格式：如果以数字开头（如 17promax），添加 iphone 前缀
      if (/^\d/.test(inventoryModel)) {
        inventoryModel = 'iphone' + inventoryModel;
      }

      const modelCodeByInventoryModel = {
        iphone15: 'A3092',
        iphone15plus: 'A3096',
        iphone15pro: 'A3104',
        iphone15promax: 'A3108',
        iphone16: 'A3288',
        iphone16plus: 'A3291',
        iphone16pro: 'A3294',
        iphone16promax: 'A3297',
        iphone16e: 'A3410',
        iphone17air: 'A3518',
        iphone17: 'A3521',
        iphone17pro: 'A3524',
        iphone17promax: 'A3527',
        iphone17e: 'A3635'
      };

      const possibleNames = [
        `${inventoryItem.brand_name} ${inventoryItem.model_number}`.trim(),
        String(inventoryItem.model_number || '').trim(),
        inventoryModel
      ].filter(Boolean);

      let modelCode = null;
      let productCategory = null;
      for (const name of possibleNames) {
        const mapping = matchProductName(name);
        if (!mapping) continue;

        if (!productCategory) {
          productCategory = mapping.category;
        }

        if (mapping.external_model) {
          modelCode = mapping.external_model;
          break;
        }
      }

      if (!modelCode) {
        modelCode = modelCodeByInventoryModel[inventoryModel] || null;
      }

      // 判断是否是配件（没有内存规格的产品）
      const isAccessory = productCategory === 'accessory' || !inventoryItem.memory;

      const brandModelKey = `${inventoryItem.brand_name}-${inventoryModel}`.toLowerCase().replace(/\s+/g, '');

      // 使用型号代码进行匹配（优先），如果没有型号代码则使用型号名称
      const externalModelForMatch = modelCode || inventoryItem.model_number || '';
      const requiresStrictModelCodeMatch = Boolean(modelCode) && /^iphone/.test(inventoryModel);
      const hasCompatibleModelCode = (priceData) => {
        if (!requiresStrictModelCodeMatch) return true;
        return Boolean(priceData?.modelCode) && priceData.modelCode === modelCode;
      };

      log.debug(`\n检查库存产品: ${inventoryItem.brand_name} - ${inventoryItem.model_number} (${inventoryModel}) - ${inventoryItem.color_name || '无'} - ${inventoryItem.memory || '无'}${isAccessory ? ' [配件]' : ''}`);
      log.debug(`  库存key: ${brandModelKey}, 型号代码: ${modelCode || '无'}, 严格型号代码匹配: ${requiresStrictModelCodeMatch}`);

      // 🔥 调试：显示所有外部价格 key
      log.debug(`  📊 可用的外部价格 key (${externalPrices.size} 个):`);
      for (const [key, list] of externalPrices.entries()) {
        if (key.includes('17')) {
          log.debug(`    - ${key}: ${list.length} 条`);
          list.slice(0, 3).forEach(p => {
            log.debug(`      ${p.color || '?'} / ${p.memory || '?'} = ¥${p.price}`);
          });
        }
      }

      // 查找外部价格
      let matchedPrice = null;

      // 🔥 使用型号名称进行匹配
      if (externalModelForMatch) {
        log.debug(`  🎯 尝试使用型号 ${externalModelForMatch} 进行匹配...`);

        // 🔥 新策略：如果型号名称包含完整的产品名称（如 "iPhone 17 Pro Max"）
        // 直接在外部价格数据中进行字符串匹配
        const isFullExternalName = externalModelForMatch.includes('iPhone') ||
                                    externalModelForMatch.includes('iPad') ||
                                    externalModelForMatch.includes('MacBook') ||
                                    externalModelForMatch.includes('AirPods');

        if (isFullExternalName) {
          log.debug(`  🔍 检测到完整型号名称，进行精确字符串匹配...`);

          // 遍历所有外部价格数据，查找完整产品名称匹配
          for (const [, priceList] of externalPrices.entries()) {
            for (const priceData of this.getEligiblePriceCandidates(priceList, inventoryItem)) {
              // 标准化库存的型号名称
              const normalizedInvExternal = externalModelForMatch.toLowerCase().replace(/\s+/g, '');

              // 🔥 匹配策略：
              // 1. 如果有型号代码（如 A3527），必须匹配型号代码
              // 2. 如果没有型号代码（如 iPad），通过型号名称匹配

              let isMatch = false;

              if (priceData.modelCode) {
                if (!hasCompatibleModelCode(priceData)) continue;

                // 有型号代码：必须匹配型号代码
                const modelCodeMatch = normalizedInvExternal.includes(priceData.modelCode.toLowerCase());
                if (!modelCodeMatch) continue;

                // 进一步检查内存和颜色
                // 🔥 修复：如果外部数据没有内存信息，跳过匹配（避免将所有内存匹配到同一价格）
                const memoryMatch = priceData.memory && normalizedInvExternal.includes(priceData.memory.toLowerCase().replace('gb', ''));
                const colorMatch = !priceData.color || normalizedInvExternal.includes(priceData.color.toLowerCase());

                isMatch = memoryMatch && colorMatch;
              } else {
                // 没有型号代码（如 iPad）：通过型号名称、颜色、内存匹配
                // 检查型号名称是否匹配（如 "ipad11" 匹配 "苹果11英寸iPad(第十一代)"）
                const normalizedModel = priceData.model.toLowerCase().replace(/\s+/g, '');
                const modelMatch = normalizedInvExternal.includes(normalizedModel) ||
                                   (normalizedModel.includes('ipad') && normalizedInvExternal.includes('ipad'));

                if (!modelMatch) continue;

                // 进一步检查内存和颜色
                // 🔥 修复：如果外部数据没有内存信息，跳过匹配（避免将所有内存匹配到同一价格）
                const memoryMatch = priceData.memory && normalizedInvExternal.includes(priceData.memory.toLowerCase().replace('gb', ''));
                const colorMatch = !priceData.color || normalizedInvExternal.includes(priceData.color.toLowerCase());

                isMatch = memoryMatch && colorMatch;
              }

              // 匹配成功
              if (isMatch) {
                matchedPrice = priceData;
                log.debug(`  ✓✓✓ 完整外部名称匹配成功!`);
                log.debug(`     库存外部名称: "${inventoryItem.model_number}"`);
                log.debug(`     匹配到: 品牌=${priceData.brand}, 型号=${priceData.model}, 型号代码=${priceData.modelCode || '无'}, 颜色=${priceData.color}, 内存=${priceData.memory}, 价格=${priceData.price}`);
                break;
              }
            }
            if (matchedPrice) break;
          }

          // 如果完整外部名称匹配成功，直接保存数据
          if (matchedPrice) {
            const priceData = {
              brand_name: inventoryItem.brand_name,
              model_number: inventoryItem.model_number,
              external_model: inventoryItem.model_number,
              color_name: inventoryItem.color_name,
              memory: inventoryItem.memory,
              retail_price: null,
              wholesale_price: matchedPrice.price,
              cost_price: null,
              stock_quantity: 0,
              status: 1,
              show_price: 0,  // 新增的记录默认关闭报价显示
              remark: '从外部同步（完整外部名称匹配）'
            };

            const result = await this.upsertPriceItem(priceData, syncTime, { allowCreate: false, isManualEdit: false, changeReason });
            if (result.success) {
              successCount++;
              successItems.push({
                brand: inventoryItem.brand_name,
                model: inventoryItem.model_number,
                color: inventoryItem.color_name,
                memory: inventoryItem.memory,
                price: matchedPrice.price,
                match_type: '完整外部名称匹配'
              });
            } else {
              failedCount++;
              failedItems.push({
                brand: inventoryItem.brand_name,
                model: inventoryItem.model_number,
                color: inventoryItem.color_name,
                memory: inventoryItem.memory,
                error: result.message || '保存失败',
                match_type: '完整外部名称匹配'
              });
            }
            continue;
          }
        }

        // 原有策略：使用型号代码（如 A3527）进行匹配
        // 遍历所有外部价格数据，查找 modelCode 匹配的
        for (const [extKey, priceList] of externalPrices.entries()) {
          // 🔥 调试：显示 iPhone 17 的所有外部价格数据
          if (inventoryItem.model_number.toLowerCase().includes('17') && extKey.includes('17')) {
            log.debug(`  🔍 检查外部价格 key: "${extKey}", 共 ${priceList.length} 条记录`);
            priceList.slice(0, 5).forEach((p, idx) => {
              log.debug(`    ${idx + 1}. ${p.color || '?'} / ${p.memory || '?'} = ¥${p.price}`);
            });
          }

          for (const priceData of this.getEligiblePriceCandidates(priceList, inventoryItem)) {
            // 检查型号代码是否匹配
            if (priceData.modelCode && priceData.modelCode === modelCode) {
              // 找到匹配的型号代码，严格检查颜色和内存
              const normalizedExtColor = this.normalizeColor(priceData.color);
              const normalizedInvColor = this.normalizeColor(inventoryItem.color_name);

              // 颜色必须精确匹配（使用标准化后的颜色）
              const colorMatch = !inventoryItem.color_name || !priceData.color ||
                normalizedInvColor === normalizedExtColor;

              // 内存必须精确匹配（去除空格后比较）
              // 支持多种格式兼容：1TB = 1tb = 1024GB = 1024gb
              const invMemory = inventoryItem.memory ? inventoryItem.memory.replace(/\s+/g, '').toLowerCase() : '';
              const extMemory = priceData.memory ? priceData.memory.replace(/\s+/g, '').toLowerCase() : '';

              // 标准化内存格式用于比较
              const normalizeMemoryForMatch = (mem) => {
                if (!mem) return mem;
                // 1TB -> 1024, 2TB -> 2048
                if (mem.includes('tb')) {
                  const tb = parseFloat(mem);
                  return (tb * 1024).toString();
                }
                // 1024GB -> 1024, 256GB -> 256
                if (mem.includes('gb')) {
                  return mem.replace('gb', '');
                }
                return mem;
              };

              const normalizedInvMem = normalizeMemoryForMatch(invMemory);
              const normalizedExtMem = normalizeMemoryForMatch(extMemory);
              // 配件产品不需要匹配内存
              // 🔥 修复：严格内存匹配逻辑
              // 1. 配件产品：不需要匹配内存，直接成功
              // 2. 外部和库存都有内存：必须精确匹配才成功
              // 3. 外部和库存都没有内存：匹配成功
              // 4. 一方有内存一方没有：不匹配（这是关键修复！）
              let memoryMatch = false;
              if (isAccessory) {
                memoryMatch = true;
              } else if (!extMemory && !invMemory) {
                memoryMatch = true;
              } else if (extMemory && invMemory && normalizedInvMem === normalizedExtMem) {
                memoryMatch = true;
              } else {
                // 一方有内存一方没有，不匹配
                memoryMatch = false;
              }

              // 🔥 调试：显示内存匹配详情
              if (inventoryItem.model_number.toLowerCase().includes('17') || inventoryItem.model_number.toLowerCase().includes('iphone')) {
                log.debug(`       🧠 内存匹配检查:`);
                log.debug(`          库存内存: "${invMemory}" -> "${normalizedInvMem}"`);
                log.debug(`          外部内存: "${extMemory}" -> "${normalizedExtMem}"`);
                log.debug(`          匹配结果: ${memoryMatch ? '✅ 成功' : '❌ 失败'}`);
              }

              // 型号代码、颜色必须匹配（配件产品不需要匹配内存）
              if (colorMatch && memoryMatch) {
                matchedPrice = priceData;
                log.debug(`  ✓✓✓ 精确匹配成功!`);
                log.debug(`     型号代码:${priceData.modelCode} ✓`);
                log.debug(`     颜色: 外部=${priceData.color}(${normalizedExtColor}) vs 库存=${inventoryItem.color_name}(${normalizedInvColor}) ✓`);
                log.debug(`     内存: 外部=${priceData.memory} vs 库存=${inventoryItem.memory} ✓`);
                log.debug(`     价格:${priceData.price}`);
                break;
              } else {
                // 输出不匹配的原因，方便调试
                log.debug(`  ⚠️ 型号代码匹配 ${priceData.modelCode} 但其他不匹配:`);
                if (!colorMatch) {
                  log.debug(`     颜色不匹配 - 外部:${priceData.color}(${normalizedExtColor}) ≠ 库存:${inventoryItem.color_name}(${normalizedInvColor})`);
                }
                if (!memoryMatch) {
                  log.debug(`     内存不匹配 - 外部:${priceData.memory} ≠ 库存:${inventoryItem.memory}`);
                }
              }
            }
          }

          if (matchedPrice) break;
        }

        // 如果外部型号匹配成功，直接保存数据
        if (matchedPrice) {
          const priceData = {
            brand_name: inventoryItem.brand_name,
            model_number: inventoryItem.model_number,
            external_model: inventoryItem.model_number,
            color_name: inventoryItem.color_name,
            memory: inventoryItem.memory,
            retail_price: null,
            wholesale_price: matchedPrice.price,
            cost_price: null,
            stock_quantity: 0,
            status: 1,
            show_price: 0,  // 新增的记录默认关闭报价显示
            remark: '从外部同步'
          };

          const result = await this.upsertPriceItem(priceData, syncTime, { allowCreate: false, isManualEdit: false, changeReason });
          if (result.success) {
            successCount++;
            successItems.push({
              brand: inventoryItem.brand_name,
              model: inventoryItem.model_number,
              color: inventoryItem.color_name,
              memory: inventoryItem.memory,
              price: matchedPrice.price,
              match_type: '型号代码匹配'
            });
          } else {
            failedCount++;
            failedItems.push({
              brand: inventoryItem.brand_name,
              model: inventoryItem.model_number,
              color: inventoryItem.color_name,
              memory: inventoryItem.memory,
              error: result.message || '保存失败',
              match_type: '型号代码匹配'
            });
          }
          continue;
        }
      }

      // 精确匹配品牌-型号
      if (externalPrices.has(brandModelKey)) {
        const priceList = externalPrices.get(brandModelKey);

        // 🔥 在价格列表中查找匹配的颜色和内存（严格匹配）
        for (const priceData of this.getEligiblePriceCandidates(priceList, inventoryItem)) {
          if (!hasCompatibleModelCode(priceData)) {
            continue;
          }

          // 🔥 如果外部颜色为空，记录警告并跳过（无法精确匹配）
          if (!priceData.color || priceData.color.trim() === '') {
            log.debug(`  ⚠️ 外部价格数据缺少颜色信息，跳过匹配 (内存:${priceData.memory}, 价格:¥${priceData.price})`);
            continue;
          }

          // 严格颜色匹配：必须使用标准化后的颜色进行精确匹配
          const normalizedExtColor = this.normalizeColor(priceData.color);
          const normalizedInvColor = this.normalizeColor(inventoryItem.color_name);

          // 颜色必须精确匹配（标准化后完全相等）
          const colorMatch = !inventoryItem.color_name || normalizedInvColor === normalizedExtColor;

          // 内存必须精确匹配（去除空格后完全相等）
          // 支持多种格式兼容：1TB = 1tb = 1024GB = 1024gb
          const invMemory = inventoryItem.memory ? inventoryItem.memory.replace(/\s+/g, '').toLowerCase() : '';
          const extMemory = priceData.memory ? priceData.memory.replace(/\s+/g, '').toLowerCase() : '';

          // 标准化内存格式用于比较
          const normalizeMemoryForMatch = (mem) => {
            if (!mem) return mem;
            if (mem.includes('tb')) {
              const tb = parseFloat(mem);
              return (tb * 1024).toString();
            }
            if (mem.includes('gb')) {
              return mem.replace('gb', '');
            }
            return mem;
          };

          const normalizedInvMem = normalizeMemoryForMatch(invMemory);
          const normalizedExtMem = normalizeMemoryForMatch(extMemory);
          // 配件产品不需要匹配内存
          // 🔥 修复：如果外部数据没有内存信息，跳过匹配（避免将所有内存匹配到同一价格）
          const memoryMatch = isAccessory || (!extMemory && !invMemory) || (extMemory && invMemory && normalizedInvMem === normalizedExtMem);

          if (colorMatch && memoryMatch) {
            matchedPrice = priceData;
            log.debug(`  ✓ 精确匹配成功!`);
            log.debug(`     外部颜色:${priceData.color}→${normalizedExtColor}, 库存颜色:${inventoryItem.color_name}→${normalizedInvColor} ✓`);
            log.debug(`     内存:${priceData.memory}, 价格:¥${priceData.price}`);
            break;
          }
        }
      }

      // 如果精确匹配失败，尝试型号模糊匹配
      if (!matchedPrice) {
        // 先尝试精确的型号字符串匹配（忽略大小写和空格）
        for (const [extKey, priceList] of externalPrices.entries()) {
          const [extBrand, extModel] = extKey.split('-');

          // 品牌必须匹配
          if (extBrand !== inventoryItem.brand_name.toLowerCase()) continue;

          // 标准化型号后直接比较
          const normalizedInventoryModel = inventoryModel.replace(/\s+/g, '').toLowerCase();
          const normalizedExtModel = extModel.replace(/\s+/g, '').toLowerCase();

          if (normalizedInventoryModel === normalizedExtModel) {
            // 型号完全匹配，查找颜色和内存（严格匹配）
            for (const priceData of this.getEligiblePriceCandidates(priceList, inventoryItem)) {
              if (!hasCompatibleModelCode(priceData)) {
                continue;
              }

              // 🔥 如果外部颜色为空，跳过
              if (!priceData.color || priceData.color.trim() === '') {
                continue;
              }

              const normalizedExtColor = this.normalizeColor(priceData.color);
              const normalizedInvColor = this.normalizeColor(inventoryItem.color_name);

              // 颜色必须精确匹配（标准化后完全相等）
              const colorMatch = !inventoryItem.color_name || normalizedInvColor === normalizedExtColor;

              // 内存必须精确匹配（去除空格后完全相等）
              // 支持多种格式兼容：1TB = 1tb = 1024GB = 1024gb
              const invMemory = inventoryItem.memory ? inventoryItem.memory.replace(/\s+/g, '').toLowerCase() : '';
              const extMemory = priceData.memory ? priceData.memory.replace(/\s+/g, '').toLowerCase() : '';

              // 标准化内存格式用于比较
              const normalizeMemoryForMatch = (mem) => {
                if (!mem) return mem;
                if (mem.includes('tb')) {
                  const tb = parseFloat(mem);
                  return (tb * 1024).toString();
                }
                if (mem.includes('gb')) {
                  return mem.replace('gb', '');
                }
                return mem;
              };

              const normalizedInvMem = normalizeMemoryForMatch(invMemory);
              const normalizedExtMem = normalizeMemoryForMatch(extMemory);
              const memoryMatch = !invMemory || !extMemory || normalizedInvMem === normalizedExtMem;

              if (colorMatch && memoryMatch) {
                matchedPrice = priceData;
                log.debug(`  ✓ 型号精确匹配成功! 外部key:${extKey}, 外部颜色:${priceData.color}→${normalizedExtColor}, 库存颜色:${inventoryItem.color_name}→${normalizedInvColor} ✓`);
                log.debug(`     内存:${priceData.memory}, 价格:¥${priceData.price}`);
                break;
              }
            }

            if (matchedPrice) break;
          }
        }
      }

      // 如果还是没匹配到，尝试更宽松的模糊匹配
      if (!matchedPrice) {
        for (const [extKey, priceList] of externalPrices.entries()) {
          const [extBrand, extModel] = extKey.split('-');

          // 品牌必须匹配
          if (extBrand !== inventoryItem.brand_name.toLowerCase()) continue;

          // 型号模糊匹配：提取数字部分
          const inventoryModelNumbers = inventoryModel.match(/\d+/g);
          const extModelNumbers = extModel.match(/\d+/g);

          if (inventoryModelNumbers && extModelNumbers && inventoryModelNumbers[0] === extModelNumbers[0]) {
            // 检查 promax/max/max 等后缀的匹配优先级
            const inventoryHasPromax = /promax/.test(inventoryModel);
            const extHasPromax = /promax/.test(extModel);
            const inventoryHasPro = /pro/.test(inventoryModel);
            const extHasPro = /pro/.test(extModel);
            const inventoryHasMax = /max/.test(inventoryModel);
            const extHasMax = /max/.test(extModel);

            // 规则1: 如果库存有 promax，外部必须有 promax
            if (inventoryHasPromax && !extHasPromax) continue;
            // 规则2: 如果外部有 promax，库存必须有 promax
            if (extHasPromax && !inventoryHasPromax) continue;

            // 规则3: 如果库存有 pro（但不是 promax），外部不能有 promax
            if (inventoryHasPro && !inventoryHasPromax && extHasPromax) continue;
            // 规则4: 如果库存没有 pro/promax/max，外部也不能有（标准版不能匹配pro版）
            if (!inventoryHasPro && !inventoryHasPromax && !inventoryHasMax && (extHasPro || extHasPromax || extHasMax)) continue;

            for (const priceData of this.getEligiblePriceCandidates(priceList, inventoryItem)) {
              if (!hasCompatibleModelCode(priceData)) {
                continue;
              }

              // 🔥 如果外部颜色为空，跳过
              if (!priceData.color || priceData.color.trim() === '') {
                continue;
              }

              const normalizedExtColor = this.normalizeColor(priceData.color);
              const normalizedInvColor = this.normalizeColor(inventoryItem.color_name);

              // 颜色必须精确匹配（标准化后完全相等）
              const colorMatch = !inventoryItem.color_name || normalizedInvColor === normalizedExtColor;

              // 内存必须精确匹配（去除空格后完全相等）
              // 支持多种格式兼容：1TB = 1tb = 1024GB = 1024gb
              const invMemory = inventoryItem.memory ? inventoryItem.memory.replace(/\s+/g, '').toLowerCase() : '';
              const extMemory = priceData.memory ? priceData.memory.replace(/\s+/g, '').toLowerCase() : '';

              // 标准化内存格式用于比较
              const normalizeMemoryForMatch = (mem) => {
                if (!mem) return mem;
                if (mem.includes('tb')) {
                  const tb = parseFloat(mem);
                  return (tb * 1024).toString();
                }
                if (mem.includes('gb')) {
                  return mem.replace('gb', '');
                }
                return mem;
              };

              const normalizedInvMem = normalizeMemoryForMatch(invMemory);
              const normalizedExtMem = normalizeMemoryForMatch(extMemory);
              const memoryMatch = !invMemory || !extMemory || normalizedInvMem === normalizedExtMem;

              if (colorMatch && memoryMatch) {
                matchedPrice = priceData;
                log.debug(`  ✓ 型号模糊匹配成功! 外部key:${extKey}, 外部颜色:${priceData.color}→${normalizedExtColor}, 库存颜色:${inventoryItem.color_name}→${normalizedInvColor} ✓`);
                log.debug(`     内存:${priceData.memory}, 价格:¥${priceData.price}`);
                break;
              }
            }

            if (matchedPrice) break;
          }
        }
      }

      // 保存匹配到的价格
      if (matchedPrice) {
        const priceData = {
          brand_name: inventoryItem.brand_name,
          model_number: inventoryItem.model_number,
          external_model: inventoryItem.model_number,
          color_name: inventoryItem.color_name,
          memory: inventoryItem.memory,
          retail_price: null,
          wholesale_price: matchedPrice.price,
          cost_price: null,
          stock_quantity: 0,
          status: 1,
          show_price: 0,  // 新增的记录默认关闭报价显示
          remark: '从外部同步'
        };

        const result = await this.upsertPriceItem(priceData, syncTime, { changeReason });
        if (result.success) {
          successCount++;
          successItems.push({
            brand: inventoryItem.brand_name,
            model: inventoryItem.model_number,
            color: inventoryItem.color_name,
            memory: inventoryItem.memory,
            price: matchedPrice.price,
            match_type: '型号模糊匹配'
          });
        } else {
          failedCount++;
          failedItems.push({
            brand: inventoryItem.brand_name,
            model: inventoryItem.model_number,
            color: inventoryItem.color_name,
            memory: inventoryItem.memory,
            error: result.message || '保存失败',
            match_type: '型号模糊匹配'
          });
        }
      } else {
        log.debug(`  ✗ 未找到匹配的价格`);
        failedCount++;
        failedItems.push({
          brand: inventoryItem.brand_name,
          model: inventoryItem.model_number,
          color: inventoryItem.color_name,
          memory: inventoryItem.memory,
          error: '未找到匹配的价格',
          match_type: '无匹配'
        });
      }
    }

    log.debug(`\n同步完成: 总共${inventoryItems.length}条, 成功${successCount}条, 失败${failedCount}条`);

    return {
      total: inventoryItems.length,
      success: successCount,
      failed: failedCount,
      details: {
        success: successItems,
        failed: failedItems
      }
    };
  }

  /**
   * 保存外部数据中未匹配的价格到 price_list 表
   * 根据已有的 is_collect 决定是否采集：
   * - is_collect = 0 (不采集) → 跳过，不更新价格
   * - is_collect = 1 (采集) → 采集价格
   * @param {Map} externalPrices - 外部价格数据
   * @param {string} syncTime - 同步时间
   * @param {Array} matchedItems - 已匹配的库存项目列表
   * @returns {Object} 创建和更新的数量
   */
  async saveUnmatchedExternalPrices(externalPrices, syncTime, matchedItems) {
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0; // 添加失败计数

    // 收集所有已匹配的外部价格（避免重复保存）
    const matchedPrices = new Set();
    for (const item of matchedItems) {
      // 生成唯一标识：品牌-型号-颜色-内存
      const colorKey = (item.color || '').toLowerCase().replace(/\s+/g, '');
      const memoryKey = (item.memory || '').toLowerCase().replace(/\s+/g, '');
      const uniqueKey = `${item.brand}-${item.model}-${colorKey}-${memoryKey}`.toLowerCase().replace(/\s+/g, '');
      matchedPrices.add(uniqueKey);
    }

    log.debug(`  📊 外部价格组合数: ${externalPrices.size}, 已匹配库存数: ${matchedPrices.size}`);

    // 🔍 调试：输出已匹配的唯一key
    log.debug(`  🔍 已匹配key示例:`, Array.from(matchedPrices).slice(0, 5));

    // 遍历所有外部价格，保存未匹配的
    for (const [extKey, priceList] of externalPrices.entries()) {
      const [extBrand, extModel] = extKey.split('-');

      // 🔥 关键修复：查询数据库中是否存在该型号，如果不存在则尝试查找相似型号
      // 因为外部数据的型号名称（如iphone17promax）可能与数据库中的名称（如17promax）不一致
      let actualModelNumber = extModel;
      try {
        // 首先尝试精确匹配
        const [modelCheck] = await this.db.query(
          'SELECT name FROM models WHERE name = ? LIMIT 1',
          [extModel]
        );
        if (!modelCheck || modelCheck.length === 0) {
          // 精确匹配失败，尝试模糊匹配（查找包含extModel去掉前缀的型号）
          const modelNamePattern = extModel.replace(/^iphone|ipad|macbook/im, '');
          const [modelByPattern] = await this.db.query(
            'SELECT name FROM models WHERE name LIKE ? LIMIT 1',
            [`%${modelNamePattern}%`]
          );
          if (modelByPattern && modelByPattern.length > 0) {
            actualModelNumber = modelByPattern[0].name;
            log.debug(`    🔗 型号模糊匹配: ${extModel} -> ${actualModelNumber}`);
          } else {
            log.debug(`    ⚠️  型号未找到: ${extModel}, 尝试模式: ${modelNamePattern}`);
          }
        }
      } catch (e) {
        log.error(`    ❌ 型号查询失败: ${e.message}`);
        // 查询失败，使用原始型号名称
      }

      for (const priceData of this.getEligiblePriceCandidates(priceList, { brand: extBrand, model: actualModelNumber })) {
        // 标准化颜色名称（使用与匹配时相同的normalizeColor方法）
        const normalizedColor = this.normalizeColor(priceData.color);
        const colorKey = (normalizedColor || '').toLowerCase().replace(/\s+/g, '');
        const memoryKey = (priceData.memory || '').toLowerCase().replace(/\s+/g, '');

        // 生成唯一标识（使用实际的型号名称）
        const uniqueKey = `${extBrand}-${actualModelNumber}-${colorKey}-${memoryKey}`;

        // 🔍 调试：输出每个外部价格的匹配key
        if (extModel.includes('17') && (priceData.memory === '1TB')) {
          log.debug(`  🔍 检查key: \${uniqueKey}, 已匹配: \${matchedPrices.has(uniqueKey)}`);
        }

        // 跳过已匹配的
        if (matchedPrices.has(uniqueKey)) {
          continue;
        }

        try {
          // 准备保存数据（使用实际的型号名称）
        const priceDataToSave = {
          brand_name: this.capitalizeFirst(extBrand),
          model_number: actualModelNumber,
          external_model: priceData.modelCode || actualModelNumber,
          color_name: normalizedColor || null,
          memory: priceData.memory || null,
          retail_price: null,
          wholesale_price: priceData.price,
          cost_price: null,
          stock_quantity: 0, // 无库存
          status: 1,
          show_price: 0,  // 新增的记录默认关闭报价显示
          last_sync_time: syncTime,
          remark: '从外部数据源自动采集（无库）'
        };

        // 检查是否已存在，同时获取其 is_collect（使用实际的型号名称）
        const existingResult = await this.checkPriceListExistsWithMode({
          ...priceDataToSave,
          model_number: actualModelNumber
        });

        if (existingResult.exists) {
          // 已存在记录
          // 🔥 关键：根据 is_collect 决定是否更新
          // is_collect = 0 (不采集) → 跳过
          // is_collect = 1 (采集) → 更新价格
          if (existingResult.is_collect === 0) {
            skippedCount++;
            log.debug(`  ⏭️  跳过(不采集): ${priceDataToSave.brand_name} ${actualModelNumber} ${normalizedColor || ''} ${priceData.memory || ''} = ¥${priceData.price}`);
            continue;
          }

          // 更新已有记录（保持原有的 is_collect）
          priceDataToSave.id = existingResult.id;
          priceDataToSave.is_collect = existingResult.is_collect; // 保持原有的采集模式
          priceDataToSave.remark = '从外部数据源更新价格';

          const result = await this.upsertPriceItem(priceDataToSave, null, { allowCreate: false, isManualEdit: false });
          if (result.success) {
            updatedCount++;
            log.debug(`  🔄 更新: ${priceDataToSave.brand_name} ${actualModelNumber} ${normalizedColor || ''} ${priceData.memory || ''} = ¥${priceData.price} (模式: ${existingResult.is_collect})`);
          }
        } else {
          // 不存在，跳过创建（根据用户需求，只更新已有记录，不创建新记录）
          skippedCount++;
          log.debug(`  ⏭️  跳过创建新记录: ${priceDataToSave.brand_name} ${actualModelNumber} ${normalizedColor || ''} ${priceData.memory || ''} = ¥${priceData.price} (price_list表中不存在)`);
        }
      } catch (error) {
        // 🔥 关键修复：捕获单条记录处理失败，避免影响后续记录
        log.error(`  ❌ 处理失败 ${extBrand} ${actualModelNumber} ${priceData?.color || ''} ${priceData?.memory || ''}: ${error.message}`);
        failedCount++;
      }
    }
    }

    log.debug(`  📊 未匹配价格处理完成: 新增${createdCount}条, 更新${updatedCount}条, 跳过${skippedCount}条, 失败${failedCount}条`);

    return { created: createdCount, updated: updatedCount, skipped: skippedCount, failed: failedCount };
  }

  /**
   * 检查 price_list 中是否存在对应记录，同时返回 is_collect
   * @param {Object} priceData - 价格数据
   * @returns {Object} { exists: boolean, id: number, is_collect: number }
   */
  async checkPriceListExistsWithMode(priceData) {
    try {
      // 🔍 调试：输出查询参数
      log.debug(`    🔍 checkPriceListExistsWithMode: brand=${priceData.brand_name}, model=${priceData.model_number}, color=${priceData.color_name}, memory=${priceData.memory}`);

      const [result] = await this.db.query(`
        SELECT p.id, p.is_collect FROM price_list p
        INNER JOIN brands b ON p.brand_id = b.id
        INNER JOIN models m ON p.model_id = m.id
        LEFT JOIN colors c ON p.color_id = c.id
        LEFT JOIN memories mem ON p.memory_id = mem.id
        WHERE b.name = ?
          AND m.name = ?
          AND (c.name = ? OR (c.name IS NULL AND ? IS NULL))
          AND (mem.size = ? OR (mem.size IS NULL AND ? IS NULL))
        LIMIT 1
      `, [priceData.brand_name, priceData.model_number, priceData.color_name, priceData.color_name, priceData.memory, priceData.memory]);

      // 🔍 调试：输出查询结果
      if (result.length > 0) {
        log.debug(`    🔍 查询结果: exists=true, id=${result[0].id}, is_collect=${result[0].is_collect}`);
      } else {
        log.debug(`    🔍 查询结果: exists=false`);
      }

      return {
        exists: result && result.length > 0,
        id: result && result[0] ? result[0].id : null,
        is_collect: result && result[0] ? (result[0].is_collect ?? 1) : 1
      };
    } catch (error) {
      log.error('检查价格记录存在性失败:', error);
      return { exists: false, id: null, is_collect: 1 };
    }
  }

  /**
   * 检查 price_list 中是否存在对应记录
   * @param {Object} priceData - 价格数据
   * @returns {Object} { exists: boolean, id: number }
   */
  /**
   * 首字母大写
   */
  capitalizeFirst(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * 自动补全所有缺失的内存规格组合
   * 检查 phones 表中的在库商品，确保 price_list 中都有对应的记录
   */
  async autoCompleteMissingMemorySpecs() {
    try {
      // 获取 phones 表中所有在库的商品（需要采集价格的）
      const [inventoryItems] = await this.db.query(`
        SELECT DISTINCT
          b.name as brand_name,
          mo.name as model_number,
          c.name as color_name,
          mem.size as memory
        FROM phones p
        INNER JOIN brands b ON p.brand_id = b.id
        INNER JOIN models mo ON p.model_id = mo.id
        LEFT JOIN colors c ON p.color_id = c.id
        LEFT JOIN memories mem ON p.memory_id = mem.id
        WHERE p.status = 'in_stock'
        AND p.is_new = 1
        ORDER BY b.name, mo.name, c.name, mem.size
      `);

      log.debug(`  📦 检查 ${inventoryItems.length} 个在库商品...`);

      let createdCount = 0;
      let skippedCount = 0;

      for (const item of inventoryItems) {
        // 检查 price_list 中是否已有对应的记录
        const [existing] = await this.db.query(`
          SELECT p.id FROM price_list p
          INNER JOIN brands b ON p.brand_id = b.id
          INNER JOIN models m ON p.model_id = m.id
          LEFT JOIN colors c ON p.color_id = c.id
          LEFT JOIN memories mem ON p.memory_id = mem.id
          WHERE b.name = ?
            AND m.name = ?
            AND (c.name = ? OR (c.name IS NULL AND ? IS NULL))
            AND (mem.size = ? OR (mem.size IS NULL AND ? IS NULL))
          LIMIT 1
        `, [item.brand_name, item.model_number, item.color_name, item.color_name, item.memory, item.memory]);

        if (existing.length === 0) {
          // 不存在，创建新记录
          const priceData = {
            brand_name: item.brand_name,
            model_number: item.model_number,
            external_model: item.model_number,
            color_name: item.color_name,
            memory: item.memory,
            retail_price: null,
            wholesale_price: null,
            cost_price: null,
            stock_quantity: 0,
            status: 1,
            is_collect: 1,
            show_price: 0,  // 新增的记录默认关闭报价显示
            remark: '自动创建（外部数据源暂无价格）'
          };

          const result = await this.upsertPriceItem(priceData);
          if (result.success) {
            createdCount++;
            log.debug(`  ✅ 创建: ${item.brand_name} ${item.model_number} ${item.color_name || ''} ${item.memory || ''}`);
          }
        } else {
          skippedCount++;
        }
      }

      log.debug(`  📊 补全完成: 创建 ${createdCount} 条，跳过 ${skippedCount} 条`);

      return {
        total: inventoryItems.length,
        success: createdCount,
        failed: 0
      };
    } catch (error) {
      log.error('❌ 自动补全失败:', error);
      return {
        total: 0,
        success: 0,
        failed: 1
      };
    }
  }

  /**
   * 通过关键字在数据库中智能搜索产品
   * @param {string} externalName - 外部系统产品名称
   * @returns {Object|null} 匹配的产品信息 { brand, model, model_id, brand_id }
   */
  async findProductByKeywords(externalName) {
    if (!this.db || !externalName) return null;

    try {
      // 标准化外部名称
      const normalized = externalName.toLowerCase().replace(/\s+/g, '');

      if (normalized.includes('mini') || normalized.includes('妙控键盘') || normalized.includes('键盘')) {
        return null;
      }

      // 提取可能的关键字
      const keywords = [];

      // 添加产品类型关键字 - 增强iPad支持
      if (normalized.includes('ipad')) {
        keywords.push('ipad', '平板');
        // 添加更具体的关键字 - 包括各种格式变体
        if (normalized.includes('pro')) {
          keywords.push('ipad pro', 'ipadpro', 'ipadpro', 'pro 11', 'pro11', 'pro 9.7', 'pro9.7');
        }
        if (normalized.includes('air')) {
          keywords.push('ipad air', 'ipadair', 'air2', 'air3', 'air4', 'air5', 'air6', 'air7');
        }
        // 各种代数
        if (normalized.includes('11')) keywords.push('ipad 11', 'ipad11', 'ipad11', '11');
        if (normalized.includes('10')) keywords.push('ipad 10', 'ipad10', 'ipad10', '10');
        if (normalized.includes('13')) keywords.push('ipad 13', 'ipad13', 'ipad13', '13');
        if (normalized.includes('9')) keywords.push('ipad 9', 'ipad9', 'ipad9', '9');
        if (normalized.includes('8')) keywords.push('ipad 8', 'ipad8', 'ipad8', '8');
        if (normalized.includes('7')) keywords.push('ipad 7', 'ipad7', 'ipad7', '7');
        if (normalized.includes('6')) keywords.push('ipad 6', 'ipad6', 'ipad6', '6');
        if (normalized.includes('5')) keywords.push('ipad 5', 'ipad5', 'ipad5', '5');
      }
      if (normalized.includes('iphone')) {
        keywords.push('iphone');
        if (normalized.includes('17')) keywords.push('iphone 17', 'iphone17', '17');
        if (normalized.includes('16')) keywords.push('iphone 16', 'iphone16', '16');
        if (normalized.includes('15')) keywords.push('iphone 15', 'iphone15', '15');
      }
      if (normalized.includes('macbook')) {
        keywords.push('macbook', '笔记本');
        if (normalized.includes('pro')) keywords.push('macbook pro', 'macbookpro');
        if (normalized.includes('air')) keywords.push('macbook air', 'macbookair');
      }
      if (normalized.includes('airpods')) {
        keywords.push('airpods', '耳机');
        if (normalized.includes('pro')) keywords.push('airpods pro', 'airpodspro');
        if (normalized.includes('max')) keywords.push('airpods max', 'airpodsmax');
      }

      // 在数据库中搜索匹配的型号
      if (keywords.length > 0) {
        log.debug(`    🔍 搜索关键字: ${keywords.join(', ')}`);

        // 构建搜索查询 - 使用 LOWER() 进行不区分大小写的搜索
        const searchConditions = keywords.map(() => 'LOWER(m.name) LIKE LOWER(?)').join(' OR ');
        const searchParams = [];
        keywords.forEach(kw => {
          searchParams.push(`%${kw}%`);
        });

        const query = `
          SELECT
            b.name as brand_name,
            m.name as model_name,
            m.id as model_id,
            b.id as brand_id
          FROM models m
          JOIN brands b ON m.brand_id = b.id
          WHERE (${searchConditions})
          LIMIT 1
        `;

        const [results] = await this.db.query(query, searchParams);

        if (results && results.length > 0) {
          const result = results[0];
          log.debug(`    ✅ 数据库匹配: "${externalName}" -> ${result.brand_name} - ${result.model_name}`);
          return {
            brand: result.brand_name,
            model: result.model_name,
            model_id: result.model_id,
            brand_id: result.brand_id,
            external_model: null
          };
        }
      }

      log.debug(`    ⚠️ 数据库中未找到匹配的产品`);
      return null;
    } catch (error) {
      log.error('数据库关键字搜索出错:', error.message);
      return null;
    }
  }

  /**
   * 解析外部网页的产品字符串，提取品牌、型号、颜色、内存、价格
   * 返回: { brand, model, color, memory, price, modelCode }
   */
  async parseExternalProduct(productStr) {
    if (!productStr || productStr.length < 3) return null;

    // 清理字符串
    let str = productStr.trim();

    // 🔥 第一步：尝试使用静态产品名称映射（针对常见产品）
    const nameMapping = matchProductName(str);
    if (nameMapping) {
      log.debug(`    📋 使用静态映射: "${str}" -> ${nameMapping.brand} - ${nameMapping.model}`);

      // 继续解析颜色、内存和价格
      let color = '';
      let memory = '';
      let price = null;

      // 提取价格
      const priceMatch = str.match(/[￥¥](\d+\.?\d*)/);
      if (priceMatch) {
        price = parseFloat(priceMatch[1]);
      } else {
        const priceMatch2 = str.match(/(\d+\.?\d*)\s*元/);
        if (priceMatch2) {
          price = parseFloat(priceMatch2[1]);
        }
      }

      // 提取颜色 - 扩展颜色模式以支持所有变体
      const colorPatterns = ['深空灰色', '深空灰', '午夜色', '银灰色', '黑色', '白色', '蓝色', '红色', '绿色', '黄色', '紫色', '粉色', '金色', '银色', '灰色', '星光色', '橙色', '星宇橙色', '原色', '原色钛金属', '深蓝色', '青雾蓝色', '水蓝色', '浅紫色', '曙光紫', '流金白', '云白色', '云雾白', '雪松白', '丹宁色', '星岩黑', '子夜黑', '天青蓝', '钛金色', '深黑色', '沙漠色钛金属', '青柠绿', '烟霞紫', '茶色', '深青色', '鼠尾草绿色', '玫瑰金'];
      for (const colorPattern of colorPatterns) {
        if (str.includes(colorPattern)) {
          color = colorPattern;
          break;
        }
      }

      memory = this.extractMemoryFromText(str);

      return {
        brand: nameMapping.brand,
        model: nameMapping.model,
        external_model: nameMapping.external_model,
        color: color,
        memory: memory,
        price: price,
        isLocal: this.isSameCityProduct(str),
        modelCode: nameMapping.external_model
      };
    }

    // 🔥 第二步：静态映射失败时，在数据库中通过关键字智能搜索
    const dbMatch = await this.findProductByKeywords(str);
    if (dbMatch) {
      log.debug(`    🗄️ 使用数据库匹配: "${str}" -> ${dbMatch.brand} - ${dbMatch.model}`);

      let color = '';
      let memory = '';
      let price = null;

      // 提取价格
      const priceMatch = str.match(/[￥¥](\d+\.?\d*)/);
      if (priceMatch) {
        price = parseFloat(priceMatch[1]);
      } else {
        const priceMatch2 = str.match(/(\d+\.?\d*)\s*元/);
        if (priceMatch2) {
          price = parseFloat(priceMatch2[1]);
        }
      }

      // 提取颜色 - 扩展颜色模式以支持所有变体
      const colorPatterns = ['深空灰色', '深空灰', '午夜色', '银灰色', '黑色', '白色', '蓝色', '红色', '绿色', '黄色', '紫色', '粉色', '金色', '银色', '灰色', '星光色', '橙色', '星宇橙色', '原色', '原色钛金属', '深蓝色', '青雾蓝色', '水蓝色', '浅紫色', '曙光紫', '流金白', '云白色', '云雾白', '雪松白', '丹宁色', '星岩黑', '子夜黑', '天青蓝', '钛金色', '深黑色', '沙漠色钛金属', '青柠绿', '烟霞紫', '茶色', '深青色', '鼠尾草绿色', '玫瑰金'];
      for (const colorPattern of colorPatterns) {
        if (str.includes(colorPattern)) {
          color = colorPattern;
          break;
        }
      }

      memory = this.extractMemoryFromText(str);

      return {
        brand: dbMatch.brand,
        model: dbMatch.model,
        external_model: dbMatch.external_model,
        color: color,
        memory: memory,
        price: price,
        isLocal: this.isSameCityProduct(str),
        modelCode: dbMatch.external_model
      };
    }

    log.debug(`    ⚠️ 无法解析产品字符串: "${str}"`);
    return null;
  }

  /**
   * 解析价格字符串
   */
  parsePrice(priceStr) {
    if (!priceStr) return null;
    const cleaned = String(priceStr).replace(/[^\d.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  async findTemplateMarkup(brandId, modelId, colorId, memoryId = null) {
    if (!brandId || !modelId) return null;

    const exactMemoryMatch = memoryId !== null && memoryId !== undefined;
    const templateQuery = `
      SELECT id, price_markup, price_markup_type
      FROM H5_newtemplates
      WHERE brand_id = ?
        AND model_id = ?
        AND (color_id = ? OR (color_id IS NULL AND ? IS NULL))
        AND is_active = 1
        AND (
          (
            ? IS NOT NULL
            AND memory_id = ?
          )
          OR (
            ? IS NOT NULL
            AND memory_id IS NULL
            AND memory_ids IS NOT NULL
            AND JSON_CONTAINS(memory_ids, CAST(? AS JSON), '$')
          )
          OR (
            memory_id IS NULL
            AND (memory_ids IS NULL OR JSON_LENGTH(memory_ids) = 0)
          )
        )
      ORDER BY
        CASE WHEN ? IS NOT NULL AND memory_id = ? THEN 3 ELSE 0 END DESC,
        CASE WHEN ? IS NOT NULL AND memory_ids IS NOT NULL AND JSON_CONTAINS(memory_ids, CAST(? AS JSON), '$') THEN 2 ELSE 0 END DESC,
        id DESC
      LIMIT 1
    `;

    const memoryJsonValue = exactMemoryMatch ? String(memoryId) : null;
    const [templateRows] = await this.db.query(templateQuery, [
      brandId,
      modelId,
      colorId,
      colorId,
      exactMemoryMatch ? memoryId : null,
      exactMemoryMatch ? memoryId : null,
      exactMemoryMatch ? memoryId : null,
      memoryJsonValue,
      exactMemoryMatch ? memoryId : null,
      exactMemoryMatch ? memoryId : null,
      exactMemoryMatch ? memoryId : null,
      memoryJsonValue
    ]);

    return templateRows && templateRows.length > 0 ? templateRows[0] : null;
  }

  getDefaultGlobalMarkupConfig() {
    return {
      mode: 'fixed',
      lowFixed: 250,
      highFixed: 200,
      lowPercent: 8.0,
      highPercent: 3.0,
      threshold: 6000,
      enabled: true
    };
  }

  async getGlobalMarkupConfig() {
    const defaultConfig = this.getDefaultGlobalMarkupConfig();

    try {
      const setting = await SystemSettingsService.getSettingByKey('price_markup_config');
      const config = setting?.value;
      if (!config || typeof config !== 'object') {
        return defaultConfig;
      }

      return {
        mode: config.mode === 'percentage' ? 'percentage' : 'fixed',
        lowFixed: Number(config.lowFixed ?? defaultConfig.lowFixed),
        highFixed: Number(config.highFixed ?? defaultConfig.highFixed),
        lowPercent: Number(config.lowPercent ?? defaultConfig.lowPercent),
        highPercent: Number(config.highPercent ?? defaultConfig.highPercent),
        threshold: Number(config.threshold ?? defaultConfig.threshold),
        enabled: typeof config.enabled === 'boolean' ? config.enabled : defaultConfig.enabled
      };
    } catch (error) {
      log.error('获取全局加价配置失败，改用默认配置:', error.message);
      return defaultConfig;
    }
  }

  async calculateRetailPriceByGlobalConfig(wholesalePrice) {
    const wholesalePriceNum = parseFloat(wholesalePrice);
    if (!wholesalePriceNum || wholesalePriceNum <= 0) return null;

    const config = await this.getGlobalMarkupConfig();
    if (!config.enabled) {
      return Math.round(wholesalePriceNum * 100) / 100;
    }

    const isLowTier = wholesalePriceNum < Number(config.threshold || 0);
    let retailPrice = wholesalePriceNum;

    if (config.mode === 'percentage') {
      const markupPercent = isLowTier ? Number(config.lowPercent || 0) : Number(config.highPercent || 0);
      retailPrice = wholesalePriceNum * (1 + markupPercent / 100);
    } else {
      const markupAmount = isLowTier ? Number(config.lowFixed || 0) : Number(config.highFixed || 0);
      retailPrice = wholesalePriceNum + markupAmount;
    }

    return Math.round(retailPrice * 100) / 100;
  }

  async calculateRetailPriceByTemplate(brandId, modelId, colorId, memoryId, wholesalePrice) {
    const wholesalePriceNum = parseFloat(wholesalePrice);
    if (!wholesalePriceNum || wholesalePriceNum <= 0) return null;

    const template = await this.findTemplateMarkup(brandId, modelId, colorId, memoryId);
    if (!template) return null;

    const markup = parseFloat(template.price_markup) || 0;
    if (markup <= 0) return null;

    let retailPrice = 0;
    if (template.price_markup_type === 'percentage') {
      retailPrice = wholesalePriceNum * (1 + markup / 100);
    } else {
      retailPrice = wholesalePriceNum + markup;
    }

    return Math.round(retailPrice * 100) / 100;
  }

  async calculateRetailPrice(brandId, modelId, colorId, memoryId, wholesalePrice) {
    const retailPriceByTemplate = await this.calculateRetailPriceByTemplate(
      brandId,
      modelId,
      colorId,
      memoryId,
      wholesalePrice
    );

    if (retailPriceByTemplate !== null) {
      return {
        retailPrice: retailPriceByTemplate,
        source: 'template',
        sourceLabel: '模板'
      };
    }

    const retailPriceByGlobalConfig = await this.calculateRetailPriceByGlobalConfig(wholesalePrice);
    if (retailPriceByGlobalConfig !== null) {
      return {
        retailPrice: retailPriceByGlobalConfig,
        source: 'global_config',
        sourceLabel: '全局加价配置'
      };
    }

    return {
      retailPrice: null,
      source: 'none',
      sourceLabel: '未命中'
    };
  }

  // ==================== 日志管理 ====================

  /**
   * 创建同步日志
   */
  async createSyncLog(configId, syncType, userId) {
    try {
      if (!this.db) {
        log.error('数据库未初始化，无法创建同步日志');
        return null;
      }

      const beijingTime = this.getBeijingTime();

      const query = `
        INSERT INTO price_sync_log (config_id, sync_type, status, start_time, created_by)
        VALUES (?, ?, 'running', ?, ?)
      `;
      const [result] = await this.db.query(query, [configId, syncType, beijingTime, userId]);
      return result.insertId;
    } catch (error) {
      log.error('创建同步日志失败:', error);
      return null;
    }
  }

  /**
   * 更新同步日志
   */
  async updateSyncLog(logId, data) {
    try {
      // 如果有 end_time，使用北京时间
      if (data.end_time) {
        data.end_time = this.getBeijingTime();
      }

      const updates = [];
      const values = [];

      Object.keys(data).forEach(key => {
        updates.push(`${key} = ?`);
        values.push(data[key]);
      });

      values.push(logId);

      const query = `UPDATE price_sync_log SET ${updates.join(', ')} WHERE id = ?`;
      await this.db.query(query, values);
    } catch (error) {
      log.error('更新同步日志失败:', error);
    }
  }

  /**
   * 获取同步日志列表
   */
  async getSyncLogs(page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      const query = `
        SELECT 
          l.*,
          c.config_name,
          TIMESTAMPDIFF(SECOND, l.start_time, l.end_time) as duration
        FROM price_sync_log l
        LEFT JOIN price_sync_config c ON l.config_id = c.id
        ORDER BY l.start_time DESC
        LIMIT ? OFFSET ?
      `;
      const [rows] = await this.db.query(query, [parseInt(limit), parseInt(offset)]);

      const [countResult] = await this.db.query('SELECT COUNT(*) as total FROM price_sync_log');
      const total = parseInt(countResult[0].total) || 0;

      return this.createSuccessResponse('获取成功', {
        list: rows,
        total,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    } catch (error) {
      log.error('获取同步日志失败:', error);
      return this.createErrorResponse('获取日志失败');
    }
  }

  // ==================== 价格历史 ====================

  /**
   * 记录价格历史
   */
  async recordPriceHistory(priceListId, prices, changeType, changeReason) {
    try {
      const recordedAt = this.getBeijingTime();
      const normalizePriceValue = (price) => {
        if (price === null || price === undefined || price === '') return null;
        const num = parseFloat(price);
        return Number.isNaN(num) ? null : num;
      };
      const normalizedPrices = {
        retail_price: normalizePriceValue(prices?.retail_price),
        wholesale_price: normalizePriceValue(prices?.wholesale_price),
        cost_price: normalizePriceValue(prices?.cost_price)
      };

      // 🔥 检查是否需要记录：查询最后一次价格记录
      const [lastRecords] = await this.db.query(`
        SELECT retail_price, wholesale_price, cost_price
        FROM price_history
        WHERE price_list_id = ?
        ORDER BY recorded_at DESC
        LIMIT 1
      `, [priceListId]);

      // 如果存在上次记录，比较价格是否相同
      if (lastRecords.length > 0) {
        const lastRecord = lastRecords[0];

        // 比较三个价格字段
        const pricesSame = (
          normalizePriceValue(lastRecord.retail_price) === normalizedPrices.retail_price &&
          normalizePriceValue(lastRecord.wholesale_price) === normalizedPrices.wholesale_price &&
          normalizePriceValue(lastRecord.cost_price) === normalizedPrices.cost_price
        );

        if (pricesSame) {
          log.debug(`  ⏭️  价格与上次记录相同，跳过历史记录 (零售:${normalizedPrices.retail_price}, 批发:${normalizedPrices.wholesale_price}, 进货:${normalizedPrices.cost_price})`);
          return; // 价格相同，不记录
        }
      }

      const query = `
        INSERT INTO price_history
        (price_list_id, retail_price, wholesale_price, cost_price, change_type, change_reason, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      await this.db.query(query, [
        priceListId,
        normalizedPrices.retail_price,
        normalizedPrices.wholesale_price,
        normalizedPrices.cost_price,
        changeType,
        changeReason,
        recordedAt
      ]);
    } catch (error) {
      log.error('记录价格历史失败:', error);
    }
  }

  /**
   * 获取价格历史
   */
  async getPriceHistory(priceListId, limit = 50) {
    try {
      const query = `
        SELECT * FROM price_history
        WHERE price_list_id = ?
        ORDER BY recorded_at DESC
        LIMIT ?
      `;
      const [rows] = await this.db.query(query, [priceListId, limit]);

      return this.createSuccessResponse('获取成功', rows);
    } catch (error) {
      log.error('获取价格历史失败:', error);
      return this.createErrorResponse('获取历史失败');
    }
  }

  // ==================== 工具方法 ====================

  /**
   * 加密密码
   */
  encryptPassword(password) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync('tf2025-price-sync', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * 解密密码
   * 如果解密失败或格式无法识别，返回占位符而不是原始值
   */
  decryptPassword(encryptedPassword) {
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync('tf2025-price-sync', 'salt', 32);

      // 检查是否是加密格式（包含冒号分隔符）
      if (!encryptedPassword || !encryptedPassword.includes(':')) {
        log.debug('⚠️ 密码不是加密格式（缺少冒号分隔符），返回占位符');
        return '••••••••';
      }

      const parts = encryptedPassword.split(':');
      if (parts.length !== 2) {
        log.debug('⚠️ 密码格式不正确（不是 iv:encrypted 格式），返回占位符');
        return '••••••••';
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      // 验证 IV 长度（应该是 16 字节 = 32 个 hex 字符）
      if (iv.length !== 16) {
        log.debug('⚠️ IV 长度不正确（应该是16字节），返回占位符');
        return '••••••••';
      }

      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      log.debug('✅ 密码解密成功');
      return decrypted;
    } catch (error) {
      log.error('❌ 解密密码失败:', error.message);
      // 解密失败时返回占位符，不返回原始加密数据
      return '••••••••';
    }
  }

  /**
   * 解析产品字符串（格式：品牌-型号-网络-内存-颜色）
   * 示例：红米15R-5G-6GB+128GB-青柠绿
   *       苹果-iPhone 17 Pro Max-5G-256GB-白色
   */
  parseProductString(productStr, inventorySet, inventoryMap) {
    if (!productStr || productStr.includes('￥') || /^[\d.]+$/.test(productStr)) {
      return null;
    }

    // 清理字符串
    let str = productStr.trim();

    // 提取价格（如果存在）
    let retailPrice = null;
    const priceMatch = str.match(/￥(\d+\.?\d*)/);
    if (priceMatch) {
      retailPrice = parseFloat(priceMatch[1]);
      str = str.replace(/￥[\d.]+/, '').trim();
    }

    // 按 - 分割
    const parts = str.split('-').filter(p => p.trim());

    if (parts.length < 2) {
      return null;
    }

    let brand = '';
    let model = '';
    let color = '';
    let memory = '';

    // 常见品牌列表（苹果放在前面）
    const knownBrands = ['苹果', 'iPhone', '华为', '小米', '三星', 'OPPO', 'VIVO', '红米', '荣耀', '真我', '一加', '魅族', 'realme'];

    // 第一部分通常是品牌，或者品牌+型号
    const firstPart = parts[0].trim();

    // 查找品牌
    for (const knownBrand of knownBrands) {
      if (firstPart.toLowerCase().startsWith(knownBrand.toLowerCase())) {
        brand = knownBrand;
        // 特殊处理苹果：iPhone后面直接是型号
        if (brand === 'iPhone') {
          brand = '苹果';
          model = firstPart.substring(6).trim(); // 去掉 "iPhone"
        } else if (brand === '苹果') {
          // 如果是"苹果"，型号是第一部分减去品牌后的内容
          model = firstPart.substring(2).trim();
        } else {
          // 其他品牌
          model = firstPart.substring(knownBrand.length).trim();
        }
        break;
      }
    }

    // 如果没有找到品牌，整个第一部分作为品牌，第二部分作为型号
    if (!brand) {
      brand = parts[0].trim();
      if (parts.length > 1) {
        model = parts[1].trim();
      }
    }

    // 遍历剩余部分查找内存和颜色
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i].trim();

      // 检查是否是内存（包含 GB、TB、MB 或 +）
      if (part.match(/\d+GB|\d+TB|\d+MB|.*\+.*/)) {
        if (!memory) {
          memory = part.replace(/\+/g, ' ');
        }
        continue;
      }

      // 检查是否是网络（5G、4G）- 但要小心不要把 iPhone 里的 5G 当网络
      if ((part === '5G' || part === '4G') && !model.includes('5G') && !model.includes('4G')) {
        continue;
      }

      // 检查是否是颜色（中文）
      const colorPatterns = ['黑色', '白色', '蓝色', '红色', '绿色', '黄色', '紫色', '粉色', '金色', '银色', '灰色', '青色', '橙色', '茶色', '青柠绿', '星光色', '星辉白', '子夜黑', '天青蓝', '雪松白', '烟霞紫', '流金白', '云白色', '丹宁色', '水蓝色', '浅紫色', '曙光紫', '星岩黑', '云雾白', '钛金色', '原色', '深黑色'];
      for (const colorPattern of colorPatterns) {
        if (part.includes(colorPattern)) {
          color = colorPattern;
          break;
        }
      }

      // 如果还没有型号，且这部分不是颜色、内存、网络，可能是型号的一部分
      if (!model && !memory && !color && part !== '5G' && part !== '4G') {
        model = part;
      }
    }

    // 标准化
    brand = brand.replace(/iPhone/gi, '苹果').trim();

    // 型号标准化：如果是纯数字（如 "17"），添加 "iphone" 前缀
    model = model.trim();
    if (/^\d+$/.test(model)) {
      model = 'iphone' + model;
    }

    color = color.trim();
    memory = memory.trim();

    log.debug(`    解析: ${productStr} -> 品牌:${brand}, 型号:${model}, 颜色:${color}, 内存:${memory}, 价格:${retailPrice}`);

    // 检查是否在库存中
    const brandModelKey = `${brand}-${model}`.toLowerCase().replace(/\s+/g, '');
    let isInInventory = inventoryMap.has(brandModelKey);

    // 如果没有精确匹配，尝试模糊匹配
    if (!isInInventory) {
      for (const [inventoryKey, variants] of inventoryMap.entries()) {
        // 检查品牌是否相同
        if (inventoryKey.startsWith(brand.toLowerCase())) {
          // 尝试多种匹配策略
          const inventoryModel = inventoryKey.substring(brand.length + 1);

          // 策略1: 型号完全匹配
          if (inventoryModel === model.toLowerCase().replace(/\s+/g, '')) {
            isInInventory = true;
            log.debug(`      ✓ 精确匹配: ${inventoryKey}`);
            break;
          }

          // 策略2: 型号互相包含（例如 "15R" vs "Note 15R"）
          const modelNormalized = model.toLowerCase().replace(/\s+/g, '');
          const inventoryModelNormalized = inventoryModel.replace(/\s+/g, '');
          if (modelNormalized.includes(inventoryModelNormalized) || inventoryModelNormalized.includes(modelNormalized)) {
            isInInventory = true;
            log.debug(`      ✓ 模糊匹配: ${brandModelKey} -> ${inventoryKey}`);
            break;
          }
        }
      }
    }

    if (isInInventory) {
      return {
        brand_name: brand,
        model_number: model,
        color_name: color,
        memory: memory,
        retail_price: retailPrice,
        wholesale_price: null,
        cost_price: null,
        stock_quantity: 0,
        status: 1,
        remark: '从网页同步'
      };
    }

    log.debug(`      ✗ 不在库存中 (品牌-型号key: ${brandModelKey})`);
    return null;
  }
}

module.exports = new PriceListService();
