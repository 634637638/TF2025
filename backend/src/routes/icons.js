/**
 * 图标管理路由
 * 从数据库的 icons 表中读取 Font Awesome 图标数据
 * 同时支持从 Iconify API 进行在线搜索
 */
const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const log = require('../utils/log');

// ==================== 本地数据库功能 ====================

// 获取所有图标（从数据库）
router.get('/', async (req, res) => {
  try {
    const { limit = 500, category, search } = req.query;

    const pool = getDatabase();

    // 构建查询条件
    let whereClause = 'WHERE 1=1';
    const params = [];

    // 按分类筛选
    if (category) {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    // 按搜索关键词筛选
    if (search) {
      whereClause += ' AND (name LIKE ? OR class LIKE ? OR category LIKE ? OR description LIKE ? OR tags LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // 查询图标数据
    const query = `
      SELECT
        id,
        class,
        name,
        category,
        description,
        tags,
        created_at
      FROM icons
      ${whereClause}
      ORDER BY category, name
      LIMIT ?
    `;

    params.push(parseInt(limit));

    // 使用 pool.format 来处理参数，避免参数问题
    const formattedQuery = pool.format(query, params);
    const [icons] = await pool.execute(formattedQuery);

    res.json({
      success: true,
      message: '图标数据获取成功',
      data: icons,
      total: icons.length
    });
  } catch (error) {
    log.error('获取图标数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取图标数据失败',
      error: error.message
    });
  }
});

// 获取所有分类（从数据库）
router.get('/categories', async (req, res) => {
  try {
    const pool = getDatabase();

    const query = `
      SELECT DISTINCT category
      FROM icons
      WHERE category IS NOT NULL AND category != ''
      ORDER BY category
    `;

    const [categories] = await pool.execute(query, []);

    // 提取分类名称数组
    const categoryList = categories.map(c => c.category);

    res.json({
      success: true,
      message: '分类数据获取成功',
      data: categoryList,
      total: categoryList.length
    });
  } catch (error) {
    log.error('获取分类数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分类数据失败',
      error: error.message
    });
  }
});

// ==================== 在线搜索功能 ====================
// 注意：这些特殊路由必须在 /:id 之前定义，否则会被 /:id 匹配

/**
 * 中文到英文的图标关键词映射
 */
const iconKeywordMap = {
  '首页': 'home',
  '主页': 'home',
  '用户': 'user',
  '客户': 'user',
  '设置': 'settings',
  '配置': 'settings',
  '系统': 'system',
  '仪表盘': 'dashboard',
  '菜单': 'menu',
  '列表': 'list',
  '表格': 'table',
  '图表': 'chart',
  '统计': 'chart',
  '分析': 'analytics',
  '报表': 'report',
  '数据': 'data',
  '数据库': 'database',
  '服务器': 'server',
  '云': 'cloud',
  '网络': 'network',
  '购物车': 'cart',
  '商店': 'store',
  '商城': 'store',
  '订单': 'order',
  '商品': 'product',
  '库存': 'inventory',
  '仓库': 'warehouse',
  '盒子': 'box',
  '包裹': 'package',
  '卡车': 'truck',
  '运输': 'shipping',
  '送货': 'delivery',
  '扳手': 'wrench',
  '工具': 'tool',
  '编辑': 'edit',
  '修改': 'edit',
  '删除': 'delete',
  '垃圾桶': 'trash',
  '移除': 'remove',
  '保存': 'save',
  '下载': 'download',
  '上传': 'upload',
  '打印': 'print',
  '导出': 'export',
  '导入': 'import',
  '文件': 'file',
  '文档': 'document',
  '图片': 'image',
  '照片': 'photo',
  '视频': 'video',
  '音乐': 'music',
  '铃铛': 'bell',
  '通知': 'notification',
  '消息': 'message',
  '邮件': 'email',
  '信封': 'envelope',
  '电话': 'phone',
  '手机': 'mobile',
  '搜索': 'search',
  '查找': 'search',
  '筛选': 'filter',
  '排序': 'sort',
  '刷新': 'refresh',
  '同步': 'sync',
  '锁': 'lock',
  '钥匙': 'key',
  '密码': 'password',
  '安全': 'security',
  '盾牌': 'shield',
  '眼睛': 'eye',
  '查看': 'view',
  '隐藏': 'hide',
  '加号': 'plus',
  '添加': 'add',
  '减号': 'minus',
  '关闭': 'close',
  '对号': 'check',
  '正确': 'check',
  '错误': 'error',
  '警告': 'warning',
  '信息': 'info',
  '帮助': 'help',
  '问题': 'question',
  '星星': 'star',
  '收藏': 'favorite',
  '喜欢': 'heart',
  '书签': 'bookmark',
  '标签': 'tag',
  '日历': 'calendar',
  '时钟': 'clock',
  '时间': 'time',
  '地图': 'map',
  '位置': 'location',
  '全球': 'globe',
  '网页': 'web',
  '链接': 'link',
  '代码': 'code',
  '编程': 'code',
  '终端': 'terminal',
  '命令行': 'terminal',
  '电源': 'power',
  '登出': 'logout',
  '登录': 'login',
  '注册': 'register',
  '签名': 'signature',
  '笔': 'pencil',
  '写字': 'edit',
  '剪切': 'cut',
  '复制': 'copy',
  '粘贴': 'paste',
  '撤销': 'undo',
  '重做': 'redo',
  '放大': 'zoom-in',
  '缩小': 'zoom-out',
  '全屏': 'fullscreen',
  '退出全屏': 'exit-fullscreen',
  '首页': 'home',
  '尾页': 'end',
  '上一页': 'prev',
  '下一页': 'next',
  '箭头': 'arrow',
  '向左': 'left',
  '向右': 'right',
  '向上': 'up',
  '向下': 'down',
  '双箭头': 'chevron',
  '折叠': 'collapse',
  '展开': 'expand',
  '汉堡': 'bars',
  '更多': 'more',
  '省略号': 'ellipsis',
  '点': 'circle',
  '圆圈': 'circle',
  '方形': 'square',
  '圆形': 'circle',
  '三角形': 'triangle',
  '菱形': 'diamond'
};

/**
 * 将中文关键词转换为英文搜索词
 */
function translateKeywords(query) {
  // 检查是否直接匹配中文关键词
  if (iconKeywordMap[query]) {
    return iconKeywordMap[query];
  }

  // 检查是否包含中文关键词
  for (const [chinese, english] of Object.entries(iconKeywordMap)) {
    if (query.includes(chinese)) {
      // 替换中文关键词为英文
      return query.replace(chinese, english);
    }
  }

  return query;
}

/**
 * 从 Iconify API 搜索图标（在线搜索）
 * GET /api/icons/search/online?query=home&limit=50
 */
router.get('/search/online', async (req, res) => {
  try {
    const { query, limit = 10000, prefix = '' } = req.query;

    if (!query || query.trim() === '') {
      return res.json({
        success: true,
        data: [],
        total: 0,
        message: '请提供搜索关键词',
        source: 'online'
      });
    }

    // 翻译中文关键词为英文
    const translatedQuery = translateKeywords(query.trim());
    // 构建 Iconify API 请求 URL
    let apiUrl = `https://api.iconify.design/search?query=${encodeURIComponent(translatedQuery)}&limit=${limit}`;

    // 如果指定了前缀（图标集合），只在该集合中搜索
    if (prefix) {
      apiUrl += `&prefix=${prefix}`;
    }

    // 调用 Iconify API
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      timeout: 10000 // 10秒超时
    });

    if (!response.ok) {
      throw new Error(`Iconify API 请求失败: ${response.status}`);
    }

    const iconifyData = await response.json();

    // 检查是否有结果
    if (!iconifyData.icons || iconifyData.icons.length === 0) {
      return res.json({
        success: true,
        data: [],
        total: 0,
        message: '未找到匹配的图标',
        source: 'online'
      });
    }

    // 转换为前端需要的格式
    const icons = iconifyData.icons.map((iconName, index) => {
      const parts = iconName.split(':');
      const iconPrefix = parts[0];
      const iconSimpleName = parts[1] || iconName;

      return {
        id: `online-${index}`,
        class: `iconify ${iconName}`,
        name: iconSimpleName.replace(/-/g, ' '),
        category: iconPrefix,
        description: `${iconPrefix} 图标`,
        tags: iconPrefix,
        source: 'online',
        iconifyName: iconName
      };
    });

    // 添加集合信息（如果有）
    const collections = iconifyData.collections || {};
    const collectionList = Object.keys(collections).map(key => ({
      prefix: key,
      name: collections[key].name,
      total: collections[key].total || 0
    }));

    res.json({
      success: true,
      data: icons,
      total: icons.length,
      message: `从在线 API 搜索到 ${icons.length} 个图标`,
      source: 'online',
      collections: collectionList.length > 0 ? collectionList : undefined
    });

  } catch (error) {
    log.error('❌ 在线搜索失败:', error);
    res.status(500).json({
      success: false,
      message: '在线搜索失败',
      error: error.message,
      source: 'online'
    });
  }
});

/**
 * 获取 Iconify 图标集合列表
 * GET /api/icons/collections
 */
router.get('/collections', async (req, res) => {
  try {
    // 调用 Iconify API
    const response = await fetch('https://api.iconify.design/collections', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      timeout: 15000 // 15秒超时
    });

    if (!response.ok) {
      throw new Error(`Iconify API 请求失败: ${response.status}`);
    }

    const collections = await response.json();

    // 转换格式
    const collectionList = Object.entries(collections).map(([id, info]) => ({
      prefix: id,
      name: info.name,
      total: info.total || 0,
      author: info.author || 'Unknown',
      samples: info.samples || [],
      license: info.license || 'unknown'
    }));

    // 按图标数量排序
    collectionList.sort((a, b) => b.total - a.total);

    res.json({
      success: true,
      data: collectionList,
      total: collectionList.length,
      message: `获取到 ${collectionList.length} 个图标集合`
    });

  } catch (error) {
    log.error('❌ 获取集合列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取集合列表失败',
      error: error.message
    });
  }
});

/**
 * 获取特定集合的图标
 * GET /api/icons/collection/:prefix
 */
router.get('/collection/:prefix', async (req, res) => {
  try {
    const { prefix } = req.params;
    const { limit = 500 } = req.query;

    // 调用 Iconify API
    const response = await fetch(`https://api.iconify.design/collection?prefix=${prefix}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      timeout: 15000
    });

    if (!response.ok) {
      throw new Error(`Iconify API 请求失败: ${response.status}`);
    }

    const collectionData = await response.json();

    // 转换为前端格式
    const icons = (collectionData.icons || []).slice(0, parseInt(limit)).map((iconName, index) => ({
      id: `${prefix}-${index}`,
      class: `iconify ${prefix}:${iconName}`,
      name: iconName.replace(/-/g, ' '),
      category: prefix,
      description: `${prefix} 图标`,
      tags: prefix,
      source: 'online',
      iconifyName: `${prefix}:${iconName}`
    }));

    res.json({
      success: true,
      data: icons,
      total: icons.length,
      collection: {
        prefix: prefix,
        name: collectionData.name || prefix,
        total: collectionData.total || icons.length
      },
      message: `获取到 ${icons.length} 个图标`
    });

  } catch (error) {
    log.error('❌ 获取集合图标失败:', error);
    res.status(500).json({
      success: false,
      message: '获取集合图标失败',
      error: error.message
    });
  }
});

/**
 * 缓存在线选择的图标到本地图标库
 * POST /api/icons/cache
 */
router.post('/cache', unifiedAuth, requirePermission('menus:view'), async (req, res) => {
  try {
    const pool = getDatabase();
    const {
      class: iconClass,
      name,
      category,
      description,
      tags
    } = req.body || {};

    const normalizedClass = String(iconClass || '').trim();
    const normalizedName = String(name || '').trim();
    const normalizedCategory = String(category || '').trim();
    const normalizedDescription = description ? String(description).trim() : null;
    const normalizedTags = tags ? String(tags).trim() : null;

    if (!normalizedClass) {
      return res.status(400).json({
        success: false,
        message: '图标 class 不能为空'
      });
    }

    if (!normalizedName) {
      return res.status(400).json({
        success: false,
        message: '图标名称不能为空'
      });
    }

    if (!normalizedCategory) {
      return res.status(400).json({
        success: false,
        message: '图标分类不能为空'
      });
    }

    if (normalizedClass.length > 100) {
      return res.status(400).json({
        success: false,
        message: '图标 class 长度不能超过 100'
      });
    }

    if (normalizedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: '图标名称长度不能超过 100'
      });
    }

    if (normalizedCategory.length > 50) {
      return res.status(400).json({
        success: false,
        message: '图标分类长度不能超过 50'
      });
    }

    if (normalizedTags && normalizedTags.length > 500) {
      return res.status(400).json({
        success: false,
        message: '图标标签长度不能超过 500'
      });
    }

    const upsertQuery = `
      INSERT INTO icons (
        class,
        name,
        category,
        description,
        tags
      ) VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        category = VALUES(category),
        description = VALUES(description),
        tags = VALUES(tags),
        updated_at = CURRENT_TIMESTAMP
    `;

    await pool.execute(upsertQuery, [
      normalizedClass,
      normalizedName,
      normalizedCategory,
      normalizedDescription,
      normalizedTags
    ]);

    const [rows] = await pool.execute(
      `SELECT id, class, name, category, description, tags, created_at
       FROM icons
       WHERE class = ?
       LIMIT 1`,
      [normalizedClass]
    );

    res.json({
      success: true,
      message: '图标已同步到本地图标库',
      data: rows[0] || {
        class: normalizedClass,
        name: normalizedName,
        category: normalizedCategory,
        description: normalizedDescription,
        tags: normalizedTags
      }
    });
  } catch (error) {
    log.error('缓存图标到本地数据库失败:', error);
    res.status(500).json({
      success: false,
      message: '缓存图标失败',
      error: error.message
    });
  }
});

// ==================== 根据ID获取单个图标（必须在最后） ====================

// 根据ID获取单个图标
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getDatabase();

    const query = `
      SELECT
        id,
        class,
        name,
        category,
        description,
        tags,
        created_at
      FROM icons
      WHERE id = ?
    `;

    const [icons] = await pool.execute(query, [id]);

    if (icons.length === 0) {
      return res.status(404).json({
        success: false,
        message: '图标不存在'
      });
    }

    res.json({
      success: true,
      message: '图标获取成功',
      data: icons[0]
    });
  } catch (error) {
    log.error('获取图标失败:', error);
    res.status(500).json({
      success: false,
      message: '获取图标失败',
      error: error.message
    });
  }
});

module.exports = router;
