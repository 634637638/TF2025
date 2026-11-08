/**
 * 预定管理路由
 * 提供预定单的增删改查、匹配、交付等功能
 * 使用统一的基础数据 ID 和金额字段
 */
const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const { ensurePreorderSchema } = require('../utils/preorder-schema')
const dataMaskingService = require('../services/data-masking.service')

const PREORDER_FIELD_MODULE_KEY = 'preorders_preordersview'
const hasPreorderAction = (req, action) => {
  const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : []
  return permissions.includes(`${PREORDER_FIELD_MODULE_KEY}:${action}`) ||
    permissions.includes(`preorders:${action}`)
}
const getPreorderResponseFieldPermissions = async (req) => {
  const permissions = await dataMaskingService.getUserFieldPermissions(
    req.user.id,
    PREORDER_FIELD_MODULE_KEY
  )
  const hiddenFields = new Set(permissions.hiddenFields || [])

  if (['match', 'deliver', 'cancel', 'edit'].some(action => hasPreorderAction(req, action))) {
    hiddenFields.delete('status_info.status')
  }
  if (hasPreorderAction(req, 'deliver')) {
    [
      'product_info.imei',
      'customer_info.customer_name',
      'customer_info.customer_phone',
      'price_info.total_price',
      'price_info.deposit_amount'
    ].forEach(field => hiddenFields.delete(field))
  }

  return { ...permissions, hiddenFields: Array.from(hiddenFields) }
}
const maskPreorderItem = async (item, req) => {
  const permissions = await getPreorderResponseFieldPermissions(req)
  return dataMaskingService.filterSensitiveFields([item], permissions)[0]
}
const maskPreorderList = async (items, req) => {
  const permissions = await getPreorderResponseFieldPermissions(req)
  return dataMaskingService.filterSensitiveFields(items, permissions)
}
const getPreorderHiddenFields = async (req) => {
  const permissions = await dataMaskingService.getUserFieldPermissions(
    req.user.id,
    PREORDER_FIELD_MODULE_KEY
  )
  return new Set(permissions.hiddenFields || [])
}

const PreorderReadController = require('../controllers/preorder-read.controller')
const PreorderMutationController = require('../controllers/preorder-mutation.controller')
const preorderReadController = new PreorderReadController({
  maskStats: maskPreorderItem,
  maskList: maskPreorderList
})
const preorderMutationController = new PreorderMutationController({ maskItem: maskPreorderItem })

const PREORDER_WRITE_FIELD_IDS = {
  created_by: 'operator_info.operator_name',
  customer_id: 'customer_info.customer_name',
  store_id: 'store_info.store_name',
  brand_id: 'product_info.brand_name',
  model_id: 'product_info.model_name',
  color_id: 'product_info.color_name',
  memory_id: 'product_info.memory_size',
  is_new: 'product_info.is_new',
  total_price: 'price_info.total_price',
  actual_price: 'price_info.actual_price',
  deposit_amount: 'price_info.deposit_amount',
  expected_arrival: 'time_info.expected_arrival',
  arrival_date: 'time_info.expected_arrival',
  actual_model: 'product_info.model_name',
  remarks: 'other_info.remarks'
}

const rejectHiddenPreorderWriteFields = async (req, res, next) => {
  try {
    const hiddenFields = await getPreorderHiddenFields(req)
    const deniedEntry = Object.entries(PREORDER_WRITE_FIELD_IDS).find(([bodyField, fieldId]) => (
      req.body?.[bodyField] !== undefined && hiddenFields.has(fieldId)
    ))

    if (!deniedEntry) {
      return next()
    }

    return res.status(403).json({
      success: false,
      message: '不能修改已隐藏的字段',
      code: 'FIELD_PERMISSION_DENIED',
      field: deniedEntry[1]
    })
  } catch (error) {
    return next(error)
  }
}

router.use(async (_req, res, next) => {
  try {
    await ensurePreorderSchema()
    next()
  } catch (error) {
    log.error('预定字段迁移失败:', error)
    ApiResponse.serverError(res, '预定数据结构未就绪')
  }
})

/**
 * 获取预定单列表
 * GET /api/preorders
 */
router.get('/', unifiedAuth, requirePermission('preorders:view'), preorderReadController.list.bind(preorderReadController))

/**
 * 获取预定单统计信息
 * GET /api/preorders/stats
 */
router.get('/stats', unifiedAuth, requirePermission('preorders:view'), preorderReadController.stats.bind(preorderReadController))

/**
 * 获取新建/编辑预订单所需的基础选项。
 * 预订单不应依赖库存或店铺管理页面权限才能填写商品信息。
 * GET /api/preorders/options
 */
router.get('/options', unifiedAuth, requireAnyPermission(['preorders:view', 'preorders:create']), preorderReadController.options.bind(preorderReadController))

/**
 * 查找待匹配的预定单（用于入库时自动匹配）
 * GET /api/preorders/matchable
 * 参数: brand_id, model_id, color_id, memory_id
 */
router.get('/matchable', unifiedAuth, requirePermission('preorders:match'), preorderReadController.matchable.bind(preorderReadController))

/**
 * 获取某待匹配预定单可选的在库设备
 * GET /api/preorders/:id/matchable-phones
 */
router.get('/:id/matchable-phones', unifiedAuth, requirePermission('preorders:match'), preorderReadController.matchablePhones.bind(preorderReadController))

/**
 * 获取单个预定单详情
 * GET /api/preorders/:id
 */
router.get('/:id', unifiedAuth, requirePermission('preorders:view'), preorderReadController.getById.bind(preorderReadController))

/**
 * 创建预定单
 * POST /api/preorders
 */
router.post('/', unifiedAuth, requirePermission('preorders:create'), rejectHiddenPreorderWriteFields, preorderMutationController.create.bind(preorderMutationController))

/**
 * 匹配预定单（将手机分配给预定单；已匹配且未交付时可更换设备）
 * PUT /api/preorders/:id/match
 */
router.put('/:id/match', unifiedAuth, requirePermission('preorders:match'), rejectHiddenPreorderWriteFields, preorderMutationController.match.bind(preorderMutationController))

/**
 * 完成交付（标记为已交付）
 * PUT /api/preorders/:id/deliver
 *
 * 预定交付必须通过销售页面完成。销售接口会在同一事务中创建销售记录、
 * 更新设备状态、写入销售时间并完成预定单；保留这个地址仅用于给旧客户端
 * 返回明确提示，不能让旧流程绕过销售记录直接改库存状态。
 */
router.put('/:id/deliver', unifiedAuth, requirePermission('preorders:deliver'), rejectHiddenPreorderWriteFields, preorderMutationController.deliver.bind(preorderMutationController))

/**
 * 取消预定单
 * PUT /api/preorders/:id/cancel
 */
router.put('/:id/cancel', unifiedAuth, requirePermission('preorders:cancel'), preorderMutationController.cancel.bind(preorderMutationController))

/**
 * 更新预定单
 * PUT /api/preorders/:id
 */
router.put('/:id', unifiedAuth, requirePermission('preorders:edit'), rejectHiddenPreorderWriteFields, preorderMutationController.update.bind(preorderMutationController))

/**
 * 恢复已取消的预定单
 * PUT /api/preorders/:id/restore
 */
router.put('/:id/restore', unifiedAuth, requirePermission('preorders:edit'), preorderMutationController.restore.bind(preorderMutationController))

/**
 * 删除预定单
 * DELETE /api/preorders/:id
 */
router.delete('/:id', unifiedAuth, requirePermission('preorders:delete'), preorderMutationController.remove.bind(preorderMutationController))

module.exports = router
