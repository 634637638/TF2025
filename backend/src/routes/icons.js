/**
 * 图标管理路由
 * 从数据库的 icons 表中读取 Font Awesome 图标数据
 * 同时支持从 Iconify API 进行在线搜索
 */
const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const IconController = require('../controllers/icon.controller')
const { PAGINATION, TIMEOUTS } = require('../config/constants')
const { iconifyRateLimit } = require('../middleware/rate-limit')
const iconifyJsonCache = new Map()
const ICONIFY_CACHE_TTL_MS = 5 * 60 * 1000
const ICONIFY_CACHE_MAX = 100

const fetchIconifyJson = async url => {
  const cached = iconifyJsonCache.get(url)
  if (cached && cached.expiresAt > Date.now()) return cached.promise
  if (cached) iconifyJsonCache.delete(url)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUTS.ICON_FETCH)
  timer.unref?.()
  const promise = fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: controller.signal
  }).then(async response => {
    if (!response.ok) throw new Error(`Iconify API 请求失败: ${response.status}`)
    return response.json()
  }).finally(() => clearTimeout(timer))

  iconifyJsonCache.set(url, { promise, expiresAt: Date.now() + ICONIFY_CACHE_TTL_MS })
  promise.catch(() => iconifyJsonCache.delete(url))
  while (iconifyJsonCache.size > ICONIFY_CACHE_MAX) {
    iconifyJsonCache.delete(iconifyJsonCache.keys().next().value)
  }
  return promise
}

const iconController = new IconController({
  fetchIconifyJson,
  translateKeywords,
  defaultSearchLimit: PAGINATION.DEFAULT_LIMIT
})

// ==================== 本地数据库功能 ====================

// 获取所有图标（从数据库）
router.get('/', iconController.list.bind(iconController))

// 按 class 精确获取单个图标，供编辑已有菜单时按需加载。
router.get('/by-class', iconController.byClass.bind(iconController))

// 获取所有分类（从数据库）
router.get('/categories', iconController.categories.bind(iconController))

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
  '员工': 'employee',
  '供应商': 'supplier',
  '设置': 'settings',
  '配置': 'settings',
  '系统': 'system',
  '权限': 'permission',
  '角色': 'role',
  '管理员': 'admin',
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
  '产品': 'product',
  '销售': ['sales', 'sell', 'cart', 'cash', 'receipt'],
  '收银': ['cashier', 'cash', 'payment'],
  '付款': ['payment', 'pay', 'wallet', 'credit-card'],
  '支付': ['payment', 'pay', 'wallet', 'credit-card'],
  '账单': ['bill', 'invoice', 'receipt'],
  '利润': ['profit', 'chart', 'trending-up'],
  '价格': ['price', 'tag', 'money'],
  '价目表': ['price', 'list', 'tag'],
  '库存': 'inventory',
  '入库': ['stock', 'box', 'download', 'archive'],
  '出库': ['stock', 'box', 'upload', 'truck'],
  '调拨': ['transfer', 'exchange', 'truck'],
  '仓库': 'warehouse',
  '维修': ['repair', 'wrench', 'tool'],
  '补贴': ['subsidy', 'money', 'gift'],
  '工资': ['salary', 'money', 'wallet'],
  '考勤': ['attendance', 'calendar', 'clock'],
  '横幅': ['banner', 'image'],
  '轮播': ['carousel', 'image'],
  '盒子': 'box',
  '包裹': 'package',
  '卡车': 'truck',
  '运输': 'shipping',
  '送货': 'delivery',
  '扳手': 'wrench',
  '工具': ['tool', 'wrench'],
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
  '手机': ['mobile', 'phone'],
  '搜索': 'search',
  '查找': 'search',
  '筛选': 'filter',
  '排序': 'sort',
  '刷新': ['refresh', 'sync'],
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
}

/**
 * 将中文关键词转换为英文搜索词
 */
function translateKeywords(query) {
  const rawQuery = String(query || '').trim()
  const candidates = new Set()
  const addCandidates = (value) => {
    const values = Array.isArray(value) ? value : [value]
    values
      .map(item => String(item || '').trim())
      .filter(Boolean)
      .forEach(item => candidates.add(item))
  }

  if (!rawQuery) {
    return []
  }

  if (iconKeywordMap[rawQuery]) {
    addCandidates(iconKeywordMap[rawQuery])
  }

  for (const [chinese, english] of Object.entries(iconKeywordMap)) {
    if (rawQuery.includes(chinese)) {
      const englishWords = Array.isArray(english) ? english : [english]
      englishWords.forEach(word => {
        const translated = rawQuery.replace(chinese, word)
        addCandidates(translated)
      })
    }
  }

  addCandidates(rawQuery)

  return [...candidates].slice(0, 8)
}

/**
 * 从 Iconify API 搜索图标（在线搜索）
 * GET /api/icons/search/online?query=home&limit=50
 */
router.get('/search/online', unifiedAuth, requirePermission('menus:view'), iconifyRateLimit, iconController.searchOnline.bind(iconController))

/**
 * 获取 Iconify 图标集合列表
 * GET /api/icons/collections
 */
router.get('/collections', unifiedAuth, requirePermission('menus:view'), iconifyRateLimit, iconController.collections.bind(iconController))

/**
 * 获取特定集合的图标
 * GET /api/icons/collection/:prefix
 */
router.get('/collection/:prefix', unifiedAuth, requirePermission('menus:view'), iconifyRateLimit, iconController.collection.bind(iconController))

/**
 * 缓存在线选择的图标到本地图标库
 * POST /api/icons/cache
 */
router.post('/cache', unifiedAuth, requirePermission('menus:view'), iconController.cache.bind(iconController))

/**
 * 清理无效图标。
 * 不会删除正在被菜单使用的图标，避免菜单配置丢失。
 * POST /api/icons/cleanup
 */
router.post('/cleanup', unifiedAuth, requirePermission('menus:edit'), iconController.cleanup.bind(iconController))

/**
 * 删除本地图标。
 * DELETE /api/icons/:id
 */
router.delete('/:id', unifiedAuth, requirePermission('menus:edit'), iconController.remove.bind(iconController))

// ==================== 根据ID获取单个图标（必须在最后） ====================

// 根据ID获取单个图标
router.get('/:id', iconController.getById.bind(iconController))

module.exports = router
