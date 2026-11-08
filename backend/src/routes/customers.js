const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission, getUserPermissions } = require('../middleware/unified-auth')
const log = require('../utils/log')
const CustomerController = require('../controllers/customer.controller')
const customerController = new CustomerController()

const LEGACY_PERMISSION_CANONICAL_MAP = {
  'customers_customersview:create': 'customers:create',
  'inventory_inventoryview:edit': 'inventory:edit',
  'query_queryview:edit': 'query:edit',
  'sales_salesview:create': 'sales:create',
  'sales_salesview:view': 'sales:view',
  'sales_salesview:edit': 'sales:edit',
  'sales_phonesaleview:create': 'sales:create',
  'sales_phonesaleview:view': 'sales:view',
  'sales_phonesaleview:edit': 'sales:edit',
  'sales_editphoneview:edit': 'sales-editphoneview:edit'
}

const CUSTOMER_CREATE_BYPASS_PERMISSIONS = new Set([
  'sales:create',
  'sales:view',
  'sales:edit',
  'sales-editphoneview:edit',
  'query:edit',
  'inventory:edit'
])

const toCanonicalPermission = (permission = '') => LEGACY_PERMISSION_CANONICAL_MAP[permission] || permission

const normalizePermissionEntries = (permissions = []) => permissions.map((perm) => {
  if (typeof perm === 'string') {
    return toCanonicalPermission(perm)
  }

  if (perm && perm.module_key && perm.permission_type) {
    return toCanonicalPermission(`${perm.module_key}:${perm.permission_type}`)
  }

  return ''
}).filter(Boolean)

const requireCustomerCreatePermissionForBusinessFlow = async (req, res, next) => {
  try {
    const cachedPermissions = Array.isArray(req.user?.permissions) ? req.user.permissions : []
    const dbPermissions = cachedPermissions.length > 0 ? [] : await getUserPermissions(req.user.id)
    const normalizedCachedPermissions = normalizePermissionEntries(cachedPermissions)
    const normalizedPermissions = new Set([
      ...normalizedCachedPermissions,
      ...normalizePermissionEntries(dbPermissions)
    ])

    if (normalizedPermissions.has('customers:create')) {
      return next()
    }

    const hasBusinessBypassPermission = Array.from(normalizedPermissions)
      .some((permission) => CUSTOMER_CREATE_BYPASS_PERMISSIONS.has(permission))

    if (hasBusinessBypassPermission) {
      return next()
    }

    return requirePermission('customers:create')(req, res, next)
  } catch (error) {
    log.error('客户创建权限检查失败:', error)
    return res.status(500).json({
      success: false,
      message: '权限检查失败',
      code: 'PERMISSION_CHECK_FAILED'
    })
  }
}


// 搜索客户（用于模糊搜索）
router.get('/search', unifiedAuth, requirePermission('customers:view'), customerController.search.bind(customerController))

// 获取客户列表
router.get('/', unifiedAuth, requirePermission('customers:view'), customerController.list.bind(customerController))

// 获取客户统计信息
router.get('/stats', unifiedAuth, requirePermission('customers:view'), customerController.getStatistics.bind(customerController))

// 获取客户统计信息（详细版本）
router.get('/stats/overview', unifiedAuth, requirePermission('customers:view'), customerController.getStatisticsOverview.bind(customerController))

// 获取客户积分自动累计设置
router.get('/points-config', unifiedAuth, requirePermission('customers:view'), customerController.getPointsConfig.bind(customerController))

// 保存客户积分自动累计设置
router.put('/points-config', unifiedAuth, requirePermission('customers:manage'), customerController.savePointsConfig.bind(customerController))

// 获取单个客户详情
router.get('/:id', unifiedAuth, requirePermission('customers:view'), customerController.getById.bind(customerController))

// 创建客户
router.post('/', unifiedAuth, requireCustomerCreatePermissionForBusinessFlow, customerController.create.bind(customerController))

// 更新客户信息
router.put('/:id', unifiedAuth, requirePermission('customers:edit'), customerController.update.bind(customerController))

// 删除客户
router.delete('/:id', unifiedAuth, requirePermission('customers:delete'), customerController.remove.bind(customerController))

// 获取客户消费记录（手机购买记录）
router.get('/:id/purchases', unifiedAuth, requirePermission('customers:view'), customerController.getPurchases.bind(customerController))

// 消费记录必须通过真实销售事务创建，禁止从客户接口伪造消费流水。
router.post('/:id/purchases', unifiedAuth, requirePermission('customers:edit'), customerController.rejectPurchaseCreation.bind(customerController))

// 更新VIP等级
router.patch('/:id/vip-level', unifiedAuth, requirePermission('customers:manage'), customerController.updateVipLevel.bind(customerController))

module.exports = router
