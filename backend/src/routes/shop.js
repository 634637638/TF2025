/**
 * H5商城管理路由 - 员工端（需要权限）
 * 功能：商城配置管理、轮播图管理、商品图片管理
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { unifiedAuth, requirePermission, requireAnyPermission, requireAdmin } = require('../middleware/unified-auth');
const ApiResponse = require('../utils/response');
const ShopService = require('../services/shop.service');
const log = require('../utils/log');

const shopService = new ShopService();

const H5_CONFIG_VIEW_PERMISSIONS = ['h5-config:view', 'h5-admin:view'];
const H5_CONFIG_EDIT_PERMISSIONS = ['h5-config:edit', 'h5-admin:edit'];
const H5_BANNER_VIEW_PERMISSIONS = ['h5-banners:view', 'h5-admin:view'];
const H5_BANNER_CREATE_PERMISSIONS = ['h5-banners:create', 'h5-admin:create'];
const H5_BANNER_EDIT_PERMISSIONS = ['h5-banners:edit', 'h5-admin:edit'];
const H5_BANNER_DELETE_PERMISSIONS = ['h5-banners:delete', 'h5-admin:delete'];
const H5_TEMPLATE_VIEW_PERMISSIONS = [
  'h5-templates:view',
  'h5-admin:view',
  'inventory:view',
  'query:view'
];
const H5_TEMPLATE_CREATE_PERMISSIONS = [
  'h5-templates:create',
  'h5-admin:create',
  'inventory:create',
  'inventory:edit'
];
const H5_TEMPLATE_EDIT_PERMISSIONS = [
  'h5-templates:edit',
  'h5-admin:edit',
  'inventory:edit'
];
const H5_TEMPLATE_DELETE_PERMISSIONS = [
  'h5-templates:delete',
  'h5-admin:delete',
  'inventory:delete',
  'inventory:edit'
];
const H5_ORDER_VIEW_PERMISSIONS = [
  'h5-orders:view',
  'h5-admin:view',
  'sales:view'
];
const H5_ORDER_EDIT_PERMISSIONS = [
  'h5-orders:edit',
  'h5-admin:edit',
  'sales:edit'
];
const H5_ASSET_EDIT_PERMISSIONS = [
  ...new Set([
    ...H5_CONFIG_EDIT_PERMISSIONS,
    ...H5_BANNER_CREATE_PERMISSIONS,
    ...H5_BANNER_EDIT_PERMISSIONS
  ])
];

// ============================================================================
// 图片上传配置
// ============================================================================

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // 使用相对于后端目录的 uploads 路径（shop 目录用于商城配置图片）
    const uploadDir = path.join(__dirname, '../../uploads/shop');
    log.debug('[Multer] 上传目录:', uploadDir);
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      log.error('[Multer] 创建上传目录失败:', error);
      cb(error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'shop-' + uniqueSuffix + ext);
  }
});

const createFileFilter = ({ allowedTypes, allowedExtensions, label, allowMimePrefixes = [] }) => {
  return (req, file, cb) => {
    log.debug(`[${label}] 检测到的文件信息:`);
    log.debug('  - MIME类型:', file.mimetype);
    log.debug('  - 原始文件名:', file.originalname);

    const ext = path.extname(file.originalname).toLowerCase();
    const isAllowedExt = allowedExtensions.includes(ext);
    const isAllowedMime = allowedTypes.includes(file.mimetype);
    const matchesMimePrefix = !file.mimetype || allowMimePrefixes.some(prefix => file.mimetype.startsWith(prefix));

    log.debug('  - 文件扩展名:', ext);
    log.debug('  - MIME类型通过:', isAllowedMime);
    log.debug('  - 扩展名通过:', isAllowedExt);

    if (isAllowedExt && matchesMimePrefix) {
      log.debug(`[${label}] ✅ 文件类型验证通过（基于扩展名）`);
      cb(null, true);
      return;
    }

    if (isAllowedMime) {
      log.debug(`[${label}] ✅ 文件类型验证通过（基于MIME类型）`);
      cb(null, true);
      return;
    }

    log.debug(`[${label}] ❌ 文件类型被拒绝:`, file.mimetype, '扩展名:', ext);
    cb(new Error(`只支持上传${label}`), false);
  };
};

const imageFileFilter = createFileFilter({
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  label: '图片文件（jpeg, png, gif, webp）',
  allowMimePrefixes: ['image/']
});

const templateMediaFileFilter = createFileFilter({
  allowedTypes: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime'
  ],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.ogg', '.mov'],
  label: '图片或视频文件（jpg, png, gif, webp, mp4, webm, ogg, mov）',
  allowMimePrefixes: ['image/', 'video/']
});

const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  }
});

const templateMediaUpload = multer({
  storage,
  fileFilter: templateMediaFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

// Multer 错误处理中间件
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    log.error('[Multer Error]', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return ApiResponse.error(res, '文件大小超过限制', 400);
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return ApiResponse.error(res, '上传字段名称错误', 400);
    }
    return ApiResponse.error(res, `上传失败: ${err.message}`, 400);
  }
  if (err) {
    log.error('[Upload Error]', err.message);
    return ApiResponse.error(res, err.message || '上传失败', 400);
  }
  next();
};

// ============================================================================
// 图片上传 API
// ============================================================================

// ============================================================================
// 图片上传 API
// ============================================================================

/**
 * 上传商城图片（配置、轮播图等）- 支持多图上传
 * POST /api/shop/upload/image
 * 权限：h5-config:edit / h5-banners:create/edit
 */
router.post('/upload/image',
  unifiedAuth,
  requireAnyPermission(H5_ASSET_EDIT_PERMISSIONS),
  (req, res, next) => {
    upload.array('files', 10)(req, res, next);
  },
  handleMulterError,
  async (req, res) => {
    try {
      const files = req.files;

      if (!files || files.length === 0) {
        return ApiResponse.error(res, '没有上传文件', 400);
      }

      // 生成文件访问URL数组（返回相对路径，由前端负责拼接完整URL）
      const uploadedFiles = files.map(file => ({
        url: `/uploads/shop/${file.filename}`,
        filename: file.filename,
        originalname: file.originalname,
        size: file.size
      }));

      ApiResponse.success(res, {
        files: uploadedFiles,
        count: uploadedFiles.length
      }, `成功上传 ${uploadedFiles.length} 张图片`);
    } catch (error) {
      log.error('上传图片失败:', error);
      ApiResponse.error(res, error.message || '上传失败', 500);
    }
  }
);

/**
 * 删除商城图片文件
 * POST /api/shop/delete-image
 * 权限：h5-config:edit / h5-banners:create/edit
 */
router.post('/delete-image',
  unifiedAuth,
  requireAnyPermission(H5_ASSET_EDIT_PERMISSIONS),
  async (req, res) => {
    try {
      const { image_url } = req.body;

      if (!image_url) {
        return ApiResponse.error(res, '缺少图片URL', 400);
      }

      // 删除物理文件
      if (image_url) {
        try {
          const fs = require('fs').promises;
          const path = require('path');

          // 图片 URL 格式：/uploads/shop/xxx.jpg
          // 根据环境获取正确的上传目录
          const IS_PRODUCTION = process.env.NODE_ENV === 'production';
          const baseUploadPath = IS_PRODUCTION
            ? (process.env.UPLOAD_PATH || '/www/wwwroot/v6.cn9527.cn/backend/uploads')
            : path.join(__dirname, '../../uploads');

          // 去掉开头的 /uploads/ 然后构建完整路径
          const relativePath = image_url.startsWith('/uploads/')
            ? image_url.substring('/uploads/'.length)
            : image_url;
          const filePath = path.join(baseUploadPath, relativePath);

          // 检查文件是否存在并删除
          await fs.unlink(filePath);
          log.debug('✅ 已删除商城图片文件:', filePath);
        } catch (error) {
          // 文件不存在或删除失败，静默处理
          log.warn('⚠️ 删除商城图片文件失败:', error.message);
        }
      }

      ApiResponse.success(res, null, '删除成功');
    } catch (error) {
      log.error('删除图片失败:', error);
      ApiResponse.error(res, error.message || '删除失败', 500);
    }
  }
);

// ============================================================================
// 商城配置管理 API
// ============================================================================

/**
 * 获取所有商城配置
 * GET /api/shop/config
 * 权限：h5-admin:view
 */
router.get('/config',
  unifiedAuth,
  requireAnyPermission(H5_CONFIG_VIEW_PERMISSIONS),
  async (req, res) => {
    try {
      const configs = await shopService.getAllConfigs();
      ApiResponse.success(res, configs, '获取配置成功');
    } catch (error) {
      log.error('获取商城配置失败:', error);
      ApiResponse.error(res, error.message || '获取配置失败', 500);
    }
  }
);

/**
 * 获取指定分类的配置
 * GET /api/shop/config/category/:category
 * 权限：h5-admin:view
 */
router.get('/config/category/:category',
  unifiedAuth,
  requireAnyPermission(H5_CONFIG_VIEW_PERMISSIONS),
  async (req, res) => {
    try {
      const { category } = req.params;
      const configs = await shopService.getConfigsByCategory(category);
      ApiResponse.success(res, configs, '获取配置成功');
    } catch (error) {
      log.error('获取商城配置失败:', error);
      ApiResponse.error(res, error.message || '获取配置失败', 500);
    }
  }
);

/**
 * 更新单个配置
 * PUT /api/shop/config/:key
 * 权限：h5-admin:edit
 */
router.put('/config/:key',
  unifiedAuth,
  requireAnyPermission(H5_CONFIG_EDIT_PERMISSIONS),
  async (req, res) => {
    try {
      const { key } = req.params;
      const { value } = req.body;

      await shopService.updateConfig(key, value);
      ApiResponse.success(res, null, '更新配置成功');
    } catch (error) {
      log.error('更新商城配置失败:', error);
      ApiResponse.error(res, error.message || '更新配置失败', 500);
    }
  }
);

/**
 * 批量更新配置
 * POST /api/shop/config/batch
 * 权限：h5-admin:edit
 */
router.post('/config/batch',
  unifiedAuth,
  requireAnyPermission(H5_CONFIG_EDIT_PERMISSIONS),
  async (req, res) => {
    try {
      const { configs } = req.body; // 格式: [{ key: 'shop_name', value: '新名称' }, ...]

      await shopService.batchUpdateConfigs(configs);
      ApiResponse.success(res, null, '批量更新配置成功');
    } catch (error) {
      log.error('批量更新商城配置失败:', error);
      ApiResponse.error(res, error.message || '批量更新配置失败', 500);
    }
  }
);

// ============================================================================
// 轮播图管理 API
// ============================================================================

/**
 * 获取所有轮播图
 * GET /api/shop/banners
 * 权限：shop:banners:view
 */
router.get('/banners',
  unifiedAuth,
  requireAnyPermission(H5_BANNER_VIEW_PERMISSIONS),
  async (req, res) => {
    try {
      const banners = await shopService.getAllBanners();
      ApiResponse.success(res, banners, '获取轮播图成功');
    } catch (error) {
      log.error('获取轮播图失败:', error);
      ApiResponse.error(res, error.message || '获取轮播图失败', 500);
    }
  }
);

/**
 * 创建轮播图
 * POST /api/shop/banners
 * 权限：shop:banners:create
 */
router.post('/banners',
  unifiedAuth,
  requireAnyPermission(H5_BANNER_CREATE_PERMISSIONS),
  async (req, res) => {
    try {
      const bannerData = req.body;
      const banner = await shopService.createBanner(bannerData);
      ApiResponse.created(res, '创建轮播图成功', banner);
    } catch (error) {
      log.error('创建轮播图失败:', error);
      ApiResponse.error(res, error.message || '创建轮播图失败', 500);
    }
  }
);

/**
 * 更新轮播图
 * PUT /api/shop/banners/:id
 * 权限：shop:banners:edit
 */
router.put('/banners/:id',
  unifiedAuth,
  requireAnyPermission(H5_BANNER_EDIT_PERMISSIONS),
  async (req, res) => {
    try {
      const { id } = req.params;
      const bannerData = req.body;

      await shopService.updateBanner(id, bannerData);
      ApiResponse.success(res, null, '更新轮播图成功');
    } catch (error) {
      log.error('更新轮播图失败:', error);
      ApiResponse.error(res, error.message || '更新轮播图失败', 500);
    }
  }
);

/**
 * 删除轮播图
 * DELETE /api/shop/banners/:id
 * 权限：shop:banners:delete
 */
router.delete('/banners/:id',
  unifiedAuth,
  requireAnyPermission(H5_BANNER_DELETE_PERMISSIONS),
  async (req, res) => {
    try {
      const { id } = req.params;
      await shopService.deleteBanner(id);
      ApiResponse.success(res, null, '删除轮播图成功');
    } catch (error) {
      log.error('删除轮播图失败:', error);
      ApiResponse.error(res, error.message || '删除轮播图失败', 500);
    }
  }
);

/**
 * 批量更新轮播图排序
 * PUT /api/shop/banners/reorder
 * 权限：shop:banners:edit
 */
router.put('/banners/reorder',
  unifiedAuth,
  requireAnyPermission(H5_BANNER_EDIT_PERMISSIONS),
  async (req, res) => {
    try {
      const { orders } = req.body; // 格式: [{ id: 1, sort_order: 1 }, ...]

      await shopService.reorderBanners(orders);
      ApiResponse.success(res, null, '更新排序成功');
    } catch (error) {
      log.error('更新轮播图排序失败:', error);
      ApiResponse.error(res, error.message || '更新排序失败', 500);
    }
  }
);

// ============================================================================
// 商品图片管理 API
// ============================================================================

/**
 * 获取商品图片列表
 * GET /api/shop/phones/:id/images
 * 权限：inventory:view
 */
router.get('/phones/:id/images',
  unifiedAuth,
  requirePermission('inventory:view'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const images = await shopService.getPhoneImages(id);
      ApiResponse.success(res, images, '获取图片成功');
    } catch (error) {
      log.error('获取商品图片失败:', error);
      ApiResponse.error(res, error.message || '获取图片失败', 500);
    }
  }
);

/**
 * 设置主图
 * PUT /api/shop/images/:id/primary
 * 权限：inventory:edit
 */
router.put('/images/:id/primary',
  unifiedAuth,
  requirePermission('inventory:edit'),
  async (req, res) => {
    try {
      const { id } = req.params;
      await shopService.setPrimaryImage(id);
      ApiResponse.success(res, null, '设置主图成功');
    } catch (error) {
      log.error('设置主图失败:', error);
      ApiResponse.error(res, error.message || '设置主图失败', 500);
    }
  }
);

/**
 * 删除商品图片
 * DELETE /api/shop/images/:id
 * 权限：inventory:edit
 */
router.delete('/images/:id',
  unifiedAuth,
  requirePermission('inventory:edit'),
  async (req, res) => {
    try {
      const { id } = req.params;
      await shopService.deleteImage(id);
      ApiResponse.success(res, null, '删除图片成功');
    } catch (error) {
      log.error('删除图片失败:', error);
      ApiResponse.error(res, error.message || '删除图片失败', 500);
    }
  }
);

// ============================================================================
// 订单管理 API（员工端）
// ============================================================================

/**
 * 获取订单列表
 * GET /api/shop/orders
 * 权限：sales:view
 */
router.get('/orders',
  unifiedAuth,
  requireAnyPermission(H5_ORDER_VIEW_PERMISSIONS),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        startDate,
        endDate,
        search
      } = req.query;

      const result = await shopService.getOrders({
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        startDate,
        endDate,
        search
      });

      ApiResponse.paginated(res, result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total
      }, '获取订单成功');
    } catch (error) {
      log.error('获取订单列表失败:', error);
      ApiResponse.error(res, error.message || '获取订单列表失败', 500);
    }
  }
);

/**
 * 获取订单详情
 * GET /api/shop/orders/:id
 * 权限：sales:view
 */
router.get('/orders/:id',
  unifiedAuth,
  requireAnyPermission(H5_ORDER_VIEW_PERMISSIONS),
  async (req, res) => {
    try {
      const { id } = req.params;
      const order = await shopService.getOrderDetail(id);
      ApiResponse.success(res, order, '获取订单详情成功');
    } catch (error) {
      log.error('获取订单详情失败:', error);
      ApiResponse.error(res, error.message || '获取订单详情失败', 500);
    }
  }
);

/**
 * 更新订单状态
 * PUT /api/shop/orders/:id/status
 * 权限：sales:edit
 */
router.put('/orders/:id/status',
  unifiedAuth,
  requireAnyPermission(H5_ORDER_EDIT_PERMISSIONS),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user.id;

      await shopService.updateOrderStatus(id, status, userId);
      ApiResponse.success(res, null, '更新订单状态成功');
    } catch (error) {
      log.error('更新订单状态失败:', error);
      ApiResponse.error(res, error.message || '更新订单状态失败', 500);
    }
  }
);

// ============================================================================
// 数据迁移 API
// ============================================================================

/**
 * 执行成色字段迁移
 * POST /api/shop/migrate/condition-grade
 */
router.post('/migrate/condition-grade',
  unifiedAuth,
  requireAdmin,
  async (req, res) => {
    try {
      await shopService.migrateConditionGrade();
      ApiResponse.success(res, null, '成色字段迁移成功');
    } catch (error) {
      log.error('成色字段迁移失败:', error);
      ApiResponse.error(res, error.message || '迁移失败', 500);
    }
  }
);

router.post('/migrate/sale-price',
  unifiedAuth,
  async (req, res) => {
    try {
      await shopService.migrateSalePrice();
      ApiResponse.success(res, null, '销售价格字段迁移成功');
    } catch (error) {
      log.error('销售价格字段迁移失败:', error);
      ApiResponse.error(res, error.message || '迁移失败', 500);
    }
  }
);

// ============================================================================
// 全新机商品模板管理
// ============================================================================

/**
 * 获取商品模板列表
 * GET /api/shop/templates
 */
router.get('/templates',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_VIEW_PERMISSIONS),
  async (req, res) => {
    try {
      const templates = await shopService.getTemplates();
      log.debug('[获取模板列表] 返回数量:', templates.length);
      log.debug('[获取模板列表] 模板数据:', templates.map(t => ({
        id: t.id,
        name: t.template_name || `${t.brand_name} ${t.model_name} ${t.color_name}`,
        is_active: t.is_active,
        is_active_type: typeof t.is_active
      })));
      ApiResponse.success(res, templates, '获取模板列表成功');
    } catch (error) {
      log.error('获取模板列表失败:', error);
      ApiResponse.error(res, error.message || '获取失败', 500);
    }
  }
);

/**
 * 批量更新模板排序
 * PUT /api/shop/templates/reorder
 * 注意：必须在 /templates/:id 之前定义，否则会被 :id 匹配
 */
router.put('/templates/reorder',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_EDIT_PERMISSIONS),
  async (req, res) => {
    try {
      const { orders } = req.body;

      if (!Array.isArray(orders) || orders.length === 0) {
        return ApiResponse.error(res, '排序数据不能为空', 400);
      }

      log.debug('[模板排序] 更新排序:', orders);

      await shopService.reorderTemplates(orders);
      ApiResponse.success(res, null, '排序更新成功');
    } catch (error) {
      log.error('更新排序失败:', error);
      ApiResponse.error(res, error.message || '更新失败', 500);
    }
  }
);

/**
 * 获取商品模板详情
 * GET /api/shop/templates/:id
 */
router.get('/templates/:id',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_VIEW_PERMISSIONS),
  async (req, res) => {
    try {
      const template = await shopService.getTemplateById(req.params.id);
      if (!template) {
        return ApiResponse.error(res, '模板不存在', 404);
      }
      ApiResponse.success(res, template, '获取模板详情成功');
    } catch (error) {
      log.error('获取模板详情失败:', error);
      ApiResponse.error(res, error.message || '获取失败', 500);
    }
  }
);

/**
 * 创建商品模板
 * POST /api/shop/templates
 */
router.post('/templates',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_CREATE_PERMISSIONS),
  async (req, res) => {
    try {
      log.debug('[创建模板] 请求体:', req.body);
      const template = await shopService.createTemplate(req.body);
      log.debug('[创建模板] 服务返回:', template);
      ApiResponse.success(res, template, '创建模板成功');
    } catch (error) {
      log.error('创建模板失败:', error);
      ApiResponse.error(res, error.message || '创建失败', 500);
    }
  }
);

/**
 * 更新商品模板
 * PUT /api/shop/templates/:id
 */
router.put('/templates/:id',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_EDIT_PERMISSIONS),
  async (req, res) => {
    try {
      log.debug('[更新模板] 模板ID:', req.params.id);
      log.debug('[更新模板] 请求体:', req.body);
      log.debug('[更新模板] 请求体字段:', Object.keys(req.body));
      const template = await shopService.updateTemplate(req.params.id, req.body);
      ApiResponse.success(res, template, '更新模板成功');
    } catch (error) {
      log.error('更新模板失败:', error);
      ApiResponse.error(res, error.message || '更新失败', 500);
    }
  }
);

/**
 * 删除商品模板
 * DELETE /api/shop/templates/:id
 */
router.delete('/templates/:id',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_DELETE_PERMISSIONS),
  async (req, res) => {
    try {
      await shopService.deleteTemplate(req.params.id);
      ApiResponse.success(res, null, '删除模板成功');
    } catch (error) {
      log.error('删除模板失败:', error);
      ApiResponse.error(res, error.message || '删除失败', 500);
    }
  }
);

/**
 * 上传模板图片
 * POST /api/shop/templates/:id/images
 */
router.post('/templates/:id/images',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_EDIT_PERMISSIONS),
  (req, res, next) => {
    templateMediaUpload.single('image')(req, res, next);
  },
  handleMulterError,
  async (req, res) => {
    try {
      log.debug('[上传模板图片] 模板ID:', req.params.id);
      log.debug('[上传模板图片] 用户ID:', req.user?.id);
      log.debug('[上传模板图片] 文件信息:', req.file ? {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      } : '无文件');

      if (!req.file) {
        log.error('[上传模板图片] 错误: 没有接收到文件');
        return ApiResponse.error(res, '没有上传文件', 400);
      }

      const image = await shopService.uploadTemplateImage(req.params.id, req.file, req.user?.id);
      log.debug('[上传模板图片] 服务返回:', image);
      ApiResponse.success(res, image, '上传图片成功');
    } catch (error) {
      log.error('上传图片失败:', error);
      ApiResponse.error(res, error.message || '上传失败', 500);
    }
  }
);

/**
 * 删除模板图片
 * DELETE /api/shop/templates/:id/images/:imageId
 */
router.delete('/templates/:id/images/:imageId',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_EDIT_PERMISSIONS),
  async (req, res) => {
    try {
      await shopService.deleteTemplateImage(req.params.id, req.params.imageId);
      ApiResponse.success(res, null, '删除图片成功');
    } catch (error) {
      log.error('删除图片失败:', error);
      ApiResponse.error(res, error.message || '删除失败', 500);
    }
  }
);

/**
 * 设置主图
 * PUT /api/shop/templates/:id/images/:imageId/primary
 */
router.put('/templates/:id/images/:imageId/primary',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_EDIT_PERMISSIONS),
  async (req, res) => {
    try {
      await shopService.setPrimaryTemplateImage(req.params.id, req.params.imageId);
      ApiResponse.success(res, null, '设置主图成功');
    } catch (error) {
      log.error('设置主图失败:', error);
      ApiResponse.error(res, error.message || '设置失败', 500);
    }
  }
);

/**
 * 批量更新模板图片排序
 * PUT /api/shop/templates/:id/images/reorder
 */
router.put('/templates/:id/images/reorder',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_EDIT_PERMISSIONS),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { orders } = req.body;

      if (!Array.isArray(orders)) {
        return ApiResponse.error(res, '排序数据格式错误', 400);
      }

      await shopService.reorderTemplateImages(id, orders);
      ApiResponse.success(res, null, '图片排序更新成功');
    } catch (error) {
      log.error('更新图片排序失败:', error);
      ApiResponse.error(res, error.message || '更新排序失败', 500);
    }
  }
);

// ============================================================================
// 基础数据API（用于模板管理）
// ============================================================================

/**
 * 获取所有品牌（用于模板管理）
 */
router.get('/base-data/brands',
  unifiedAuth,
  requirePermission('inventory:view'),
  async (req, res) => {
    try {
      const db = require('../config/database');
      const pool = db.getDatabase();
      const [brands] = await pool.query(
        'SELECT id, name, sort_order FROM brands ORDER BY sort_order ASC, name ASC'
      );
      ApiResponse.success(res, brands, '获取品牌列表成功');
    } catch (error) {
      log.error('获取品牌失败:', error);
      ApiResponse.error(res, error.message || '获取品牌失败', 500);
    }
  }
);

/**
 * 获取所有型号（用于模板管理）
 */
router.get('/base-data/models',
  unifiedAuth,
  requirePermission('inventory:view'),
  async (req, res) => {
    try {
      const db = require('../config/database');
      const pool = db.getDatabase();
      const { brand_id } = req.query;

      let query = 'SELECT id, name, brand_id, sort_order FROM models';
      const params = [];

      if (brand_id) {
        query += ' WHERE brand_id = ?';
        params.push(brand_id);
      }

      query += ' ORDER BY sort_order ASC, name ASC';

      const [models] = await pool.query(query, params);
      ApiResponse.success(res, models, '获取型号列表成功');
    } catch (error) {
      log.error('获取型号失败:', error);
      ApiResponse.error(res, error.message || '获取型号失败', 500);
    }
  }
);

/**
 * 获取所有颜色（用于模板管理）
 */
router.get('/base-data/colors',
  unifiedAuth,
  requirePermission('inventory:view'),
  async (req, res) => {
    try {
      const db = require('../config/database');
      const pool = db.getDatabase();
      const [colors] = await pool.query(
        'SELECT id, name, sort_order FROM colors ORDER BY sort_order ASC, name ASC'
      );
      ApiResponse.success(res, colors, '获取颜色列表成功');
    } catch (error) {
      log.error('获取颜色失败:', error);
      ApiResponse.error(res, error.message || '获取颜色失败', 500);
    }
  }
);

/**
 * 获取所有内存
 */
router.get('/base-data/memories', unifiedAuth, requirePermission('inventory:view'),
    async (req, res) => {
      try {
        const db = require('../config/database');
        const pool = db.getDatabase();

        const [memories] = await pool.query(
          'SELECT id, size, sort_order FROM memories ORDER BY sort_order ASC, size ASC'
        );

        ApiResponse.success(res, memories, '获取内存列表成功');
      } catch (error) {
        log.error('获取内存失败:', error);
        ApiResponse.error(res, error.message || '获取内存失败', 500);
      }
  }
);

/**
 * 上传手机图片（简化版，用于综合查询）
 * POST /api/shop/upload-phone-image
 */
shopImageUpload = upload;
router.post('/upload-phone-image',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_CREATE_PERMISSIONS),
  shopImageUpload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return ApiResponse.error(res, '没有上传文件', 400);
      }

      const { phone_id } = req.body;
      if (!phone_id) {
        return ApiResponse.error(res, '缺少手机ID', 400);
      }

      const uploadedBy = req.user ? req.user.id : 0;
      const fileUrl = `/uploads/phones/${req.file.filename}`;

      // 使用 ShopService 添加单张图片
      await shopService.addPhoneImage(phone_id, fileUrl, 'inventory', uploadedBy);

      ApiResponse.success(res, {
        url: fileUrl,
        filename: req.file.filename
      }, '图片上传成功');
    } catch (error) {
      log.error('上传图片失败:', error);
      ApiResponse.error(res, error.message || '上传失败', 500);
    }
  }
);

/**
 * 获取已售商品列表（带图片的二手机）
 * GET /api/shop/sold-products
 */
router.get('/sold-products',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_VIEW_PERMISSIONS),
  async (req, res) => {
    try {
      const db = require('../config/database');
      const pool = db.getDatabase();

      // 查询已售出且有图片的二手机
      const [products] = await pool.query(`
        SELECT
          p.id,
          p.imei,
          COALESCE(b.name, '未知品牌') AS brand,
          COALESCE(m.name, '未知型号') AS model,
          COALESCE(c.name, '未知颜色') AS color,
          COALESCE(mem.size, '') AS memory,
          p.salestime AS sale_date,
          COUNT(hi.id) AS image_count
        FROM phones p
        INNER JOIN H5_images hi ON p.id = hi.phone_id
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN models m ON p.model_id = m.id
        LEFT JOIN colors c ON p.color_id = c.id
        LEFT JOIN memories mem ON p.memory_id = mem.id
        WHERE p.status = 'sold' AND p.is_new = 0
        GROUP BY p.id
        HAVING image_count > 0
        ORDER BY p.salestime DESC
      `);

      // HTML 转义函数，防止 XSS 攻击
      const escapeHtml = (str) => {
        if (!str || typeof str !== 'string') return str
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;')
      }

      // 清理返回的数据
      const cleanProducts = products.map(product => ({
        ...product,
        brand: escapeHtml(product.brand),
        model: escapeHtml(product.model),
        color: escapeHtml(product.color),
        memory: escapeHtml(product.memory),
        imei: escapeHtml(product.imei)
      }))

      ApiResponse.success(res, cleanProducts, '获取已售商品列表成功');
    } catch (error) {
      log.error('获取已售商品列表失败:', error);
      ApiResponse.error(res, error.message || '获取已售商品列表失败', 500);
    }
  }
);

/**
 * 获取商品图片列表
 * GET /api/shop/products/:id/images
 */
router.get('/products/:id/images',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_VIEW_PERMISSIONS),
  async (req, res) => {
    try {
      const { id } = req.params;
      const db = require('../config/database');
      const pool = db.getDatabase();

      const [images] = await pool.query(
        'SELECT * FROM H5_images WHERE phone_id = ? ORDER BY is_primary DESC, sort_order ASC',
        [id]
      );

      ApiResponse.success(res, images, '获取图片列表成功');
    } catch (error) {
      log.error('获取图片列表失败:', error);
      ApiResponse.error(res, error.message || '获取图片列表失败', 500);
    }
  }
);

/**
 * 重排序商品图片
 * PUT /api/shop/products/:id/images/reorder
 */
router.put('/products/:id/images/reorder',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_EDIT_PERMISSIONS),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { imageIds } = req.body;

      if (!Array.isArray(imageIds) || imageIds.length === 0) {
        return ApiResponse.error(res, '图片ID列表不能为空', 400);
      }

      // 更新每张图片的排序值
      for (let i = 0; i < imageIds.length; i++) {
        await db.getDatabase().query(
          'UPDATE H5_images SET sort_order = ? WHERE id = ? AND phone_id = ?',
          [i, imageIds[i], id]
        );
      }

      ApiResponse.success(res, null, '排序保存成功');
    } catch (error) {
      log.error('保存图片排序失败:', error);
      ApiResponse.error(res, error.message || '保存排序失败', 500);
    }
  }
);

/**
 * 删除商品所有图片
 * DELETE /api/shop/products/:id/images
 */
router.delete('/products/:id/images',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_DELETE_PERMISSIONS),
  async (req, res) => {
    try {
      const { id } = req.params;
      const db = require('../config/database');
      const pool = db.getDatabase();

      // 获取所有图片URL
      const [images] = await pool.query(
        'SELECT image_url FROM H5_images WHERE phone_id = ?',
        [id]
      );

      // 删除物理文件
      for (const image of images) {
        if (image.image_url) {
          try {
            // 确定上传目录路径
            const uploadDir = process.env.NODE_ENV === 'production'
              ? (process.env.UPLOAD_PATH || '/www/wwwroot/v6.cn9527.cn/backend/uploads')
              : path.join(__dirname, '../../uploads');

            // 图片 URL 格式：/uploads/phones/phone-xxx.jpg
            const relativePath = image.image_url.startsWith('/uploads/')
              ? image.image_url.substring('/uploads/'.length)
              : (image.image_url.startsWith('/') ? image.image_url.substring(1) : image.image_url);

            const filePath = path.join(uploadDir, relativePath);

            // 安全检查
            const normalizedFilePath = path.normalize(filePath);
            const normalizedUploadDir = path.normalize(uploadDir);

            if (normalizedFilePath.startsWith(normalizedUploadDir)) {
              await fs.unlink(filePath);
              log.debug('✅ 已删除图片文件:', filePath);
            }
          } catch (error) {
            log.warn('⚠️ 删除图片文件失败:', error.message);
          }
        }
      }

      // 删除数据库记录
      await pool.query('DELETE FROM H5_images WHERE phone_id = ?', [id]);

      ApiResponse.success(res, null, '删除图片成功');
    } catch (error) {
      log.error('删除图片失败:', error);
      ApiResponse.error(res, error.message || '删除图片失败', 500);
    }
  }
);

module.exports = router;
