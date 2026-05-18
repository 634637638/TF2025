const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const ApiResponse = require('../utils/response');
const AccessoryService = require('../services/accessory.service');
const log = require('../utils/log');
const { getUploadSubdir, getUploadUrl } = require('../utils/upload-paths');

const accessoryService = new AccessoryService();

// 配置图片上传存储
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = getUploadSubdir('accessories');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'accessory-' + uniqueSuffix + ext);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('只允许上传图片文件（JPEG, JPG, PNG, GIF, WEBP）'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  }
});

// ============================
// 图片上传接口
// ============================

/**
 * 上传配件图片
 * POST /api/accessories/upload
 */
router.post('/upload', unifiedAuth, requirePermission('accessories:create'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return ApiResponse.error(res, '没有上传文件', 400);
    }

    // 返回文件访问URL
    const fileUrl = getUploadUrl('accessories', req.file.filename);

    ApiResponse.success(res, {
      url: fileUrl,
      filename: req.file.filename,
      size: req.file.size
    }, '上传成功');
  } catch (error) {
    log.error('上传配件图片失败:', error);
    ApiResponse.error(res, error.message || '上传失败', 500);
  }
});

// ============================
// 配件管理接口
// ============================

/**
 * 获取配件列表
 * GET /api/accessories
 * 查询参数:
 * - page: 页码
 * - pageSize: 每页数量
 * - category: 分类
 * - brandId: 品牌ID
 * - modelId: 型号ID
 * - supplierId: 供应商ID
 * - status: 状态
 * - search: 搜索关键词
 */
router.get('/', unifiedAuth, requirePermission('accessories:view'), async (req, res) => {
  try {
    const params = {
      page: req.query.page,
      pageSize: req.query.pageSize,
      category: req.query.category,
      brandId: req.query.brandId,
      modelId: req.query.modelId,
      supplierId: req.query.supplierId,
      status: req.query.status !== undefined ? req.query.status : 1,
      search: req.query.search
    };

    const result = await accessoryService.getAccessories(params);

    if (result.success) {
      ApiResponse.success(res, result.data);
    } else {
      ApiResponse.error(res, result.message, 400);
    }
  } catch (error) {
    log.error('获取配件列表失败:', error);
    ApiResponse.error(res, '获取配件列表失败', 500);
  }
});

/**
 * 根据条形码获取配件（必须放在 /:id 之前）
 * GET /api/accessories/barcode/:barcode
 */
router.get('/barcode/:barcode', unifiedAuth, requirePermission('accessories:view'), async (req, res) => {
  try {
    const { barcode } = req.params;
    const result = await accessoryService.getAccessoryByBarcode(barcode);

    if (result.success) {
      ApiResponse.success(res, result.data);
    } else {
      ApiResponse.error(res, result.message, 404);
    }
  } catch (error) {
    log.error('根据条形码获取配件失败:', error);
    ApiResponse.error(res, '根据条形码获取配件失败', 500);
  }
});

/**
 * 获取配件详情
 * GET /api/accessories/:id
 */
router.get('/:id', unifiedAuth, requirePermission('accessories:view'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await accessoryService.getAccessoryDetail(id);

    if (result.success) {
      ApiResponse.success(res, result.data);
    } else {
      ApiResponse.error(res, result.message, 404);
    }
  } catch (error) {
    log.error('获取配件详情失败:', error);
    ApiResponse.error(res, '获取配件详情失败', 500);
  }
});

/**
 * 创建配件
 * POST /api/accessories
 */
router.post('/', unifiedAuth, requirePermission('accessories:create'), async (req, res) => {
  try {
    const result = await accessoryService.createAccessory(req.body);

    if (result.success) {
      ApiResponse.success(res, result.data, result.message);
    } else {
      ApiResponse.error(res, result.message, 400);
    }
  } catch (error) {
    log.error('创建配件失败:', error);
    ApiResponse.error(res, '创建配件失败', 500);
  }
});

/**
 * 更新配件
 * PUT /api/accessories/:id
 */
router.put('/:id', unifiedAuth, requirePermission('accessories:edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await accessoryService.updateAccessory(id, req.body);

    if (result.success) {
      ApiResponse.success(res, result.data, result.message);
    } else {
      ApiResponse.error(res, result.message, 400);
    }
  } catch (error) {
    log.error('更新配件失败:', error);
    ApiResponse.error(res, '更新配件失败', 500);
  }
});

/**
 * 删除配件
 * DELETE /api/accessories/:id
 */
router.delete('/:id', unifiedAuth, requirePermission('accessories:delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await accessoryService.deleteAccessory(id);

    if (result.success) {
      ApiResponse.success(res, null, result.message);
    } else {
      ApiResponse.error(res, result.message, 400);
    }
  } catch (error) {
    log.error('删除配件失败:', error);
    ApiResponse.error(res, '删除配件失败', 500);
  }
});

// ============================
// 配件入库接口
// ============================

/**
 * 配件入库
 * POST /api/accessories/stock-in
 * 请求体:
 * {
 *   barcode: string,              // 条形码（可选）
 *   accessory_id: number,         // 配件ID（可选）
 *   name: string,                 // 配件名称（新配件时必填）
 *   category: string,             // 分类
 *   brand_id: number,             // 品牌ID
 *   model_id: number,             // 型号ID
 *   color_id: number,             // 颜色ID
 *   supplier_id: number,          // 供应商ID（必填）
 *   purchase_price: number,       // 进价
 *   selling_price: number,        // 售价
 *   unit: string,                 // 单位
 *   total_quantity: number,       // 入库总数量（必填）
 *   distribution: Array,          // 门店分配（必填）
 *   store_id: number,             // 操作门店ID
 *   operator_id: number,          // 操作员ID
 *   operator_name: string,        // 操作员姓名
 *   remarks: string               // 备注
 * }
 */
router.post('/stock-in', unifiedAuth, requirePermission('accessories:create'), async (req, res) => {
  try {
    const data = {
      ...req.body,
      operator_id: req.user.id,
      operator_name: req.user.name || req.user.username
    };

    const result = await accessoryService.stockIn(data);

    if (result.success) {
      ApiResponse.success(res, result.data, result.message);
    } else {
      ApiResponse.error(res, result.message, 400);
    }
  } catch (error) {
    log.error('配件入库失败:', error);
    ApiResponse.error(res, '配件入库失败', 500);
  }
});

/**
 * 获取入库记录列表
 * GET /api/accessories/stock-in/records
 * 查询参数:
 * - accessoryId: 配件ID
 * - supplierId: 供应商ID
 * - storeId: 门店ID
 * - startDate: 开始日期
 * - endDate: 结束日期
 * - page: 页码
 * - pageSize: 每页数量
 */
router.get('/stock-in/records', unifiedAuth, requirePermission('accessories:view'), async (req, res) => {
  try {
    const params = {
      accessoryId: req.query.accessoryId,
      supplierId: req.query.supplierId,
      storeId: req.query.storeId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: req.query.page,
      pageSize: req.query.pageSize
    };

    const result = await accessoryService.getStockInRecords(params);

    if (result.success) {
      ApiResponse.success(res, result.data);
    } else {
      ApiResponse.error(res, result.message, 400);
    }
  } catch (error) {
    log.error('获取入库记录失败:', error);
    ApiResponse.error(res, '获取入库记录失败', 500);
  }
});

// ============================
// 配件库存接口
// ============================

/**
 * 获取配件库存（按门店）
 * GET /api/accessories/:id/stock
 */
router.get('/:id/stock', unifiedAuth, requirePermission('accessories:view'), async (req, res) => {
  try {
    const { id } = req.params;
    const stock = await accessoryService.accessoryRepository.getAccessoryStock(id);

    ApiResponse.success(res, stock);
  } catch (error) {
    log.error('获取配件库存失败:', error);
    ApiResponse.error(res, '获取配件库存失败', 500);
  }
});

/**
 * 获取库存列表
 * GET /api/accessories/stock/list
 * 查询参数:
 * - storeId: 门店ID
 * - lowStockOnly: 仅低库存
 * - page: 页码
 * - pageSize: 每页数量
 */
router.get('/stock/list', unifiedAuth, requirePermission('accessories:view'), async (req, res) => {
  try {
    const params = {
      storeId: req.query.storeId,
      lowStockOnly: req.query.lowStockOnly === 'true',
      page: req.query.page,
      pageSize: req.query.pageSize
    };

    const result = await accessoryService.getStockList(params);

    if (result.success) {
      ApiResponse.success(res, result.data);
    } else {
      ApiResponse.error(res, result.message, 400);
    }
  } catch (error) {
    log.error('获取库存列表失败:', error);
    ApiResponse.error(res, '获取库存列表失败', 500);
  }
});

/**
 * 获取库存预警
 * GET /api/accessories/stock/warnings
 * 查询参数:
 * - threshold: 预警阈值（默认5）
 */
router.get('/stock/warnings', unifiedAuth, requirePermission('accessories:view'), async (req, res) => {
  try {
    const threshold = req.query.threshold || 5;
    const result = await accessoryService.getLowStockWarnings(threshold);

    if (result.success) {
      ApiResponse.success(res, result.data);
    } else {
      ApiResponse.error(res, result.message, 400);
    }
  } catch (error) {
    log.error('获取库存预警失败:', error);
    ApiResponse.error(res, '获取库存预警失败', 500);
  }
});

// ============================
// 配件销售接口
// ============================

/**
 * 配件销售
 * POST /api/accessories/sell
 * 请求体:
 * {
 *   accessory_id: number,         // 配件ID（必填）
 *   store_id: number,             // 门店ID（必填）
 *   customer_id: number,          // 客户ID（可选）
 *   customer_name: string,        // 客户姓名
 *   customer_phone: string,       // 客户电话
 *   quantity: number,             // 销售数量（必填）
 *   unit_price: number,           // 单价（必填）
 *   remarks: string,              // 备注
 *   operator_id: number,          // 操作员ID
 *   operator_name: string         // 操作员姓名
 * }
 */
router.post('/sell', unifiedAuth, requirePermission('accessories:create'), async (req, res) => {
  try {
    const data = {
      ...req.body,
      operator_id: req.user.id,
      operator_name: req.user.name || req.user.username
    };

    const result = await accessoryService.sell(data);

    if (result.success) {
      ApiResponse.success(res, result.data, result.message);
    } else {
      ApiResponse.error(res, result.message, 400);
    }
  } catch (error) {
    log.error('配件销售失败:', error);
    ApiResponse.error(res, '配件销售失败', 500);
  }
});

// ============================
// 统计接口
// ============================

/**
 * 获取分类统计
 * GET /api/accessories/stats/category
 */
router.get('/stats/category', unifiedAuth, requirePermission('accessories:view'), async (req, res) => {
  try {
    const result = await accessoryService.getCategoryStats();

    if (result.success) {
      ApiResponse.success(res, result.data);
    } else {
      ApiResponse.error(res, result.message, 400);
    }
  } catch (error) {
    log.error('获取分类统计失败:', error);
    ApiResponse.error(res, '获取分类统计失败', 500);
  }
});

module.exports = router;
