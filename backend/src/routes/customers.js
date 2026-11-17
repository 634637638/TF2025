const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const CustomerController = require('../controllers/customer.controller')
const customerController = new CustomerController()
const createFieldAccessMiddleware = require('../middleware/field-access')
const { service: customerFields, fieldMap: addressFieldMap } = require('../services/customer-field-access.service')
const protectCustomerAddress = createFieldAccessMiddleware(customerFields).protectFields(addressFieldMap)

// 搜索客户（用于模糊搜索）
router.get('/search', unifiedAuth, requirePermission('customers:view'), customerController.search.bind(customerController))

// 获取客户列表
router.get('/', unifiedAuth, requirePermission('customers:view'), protectCustomerAddress, customerController.list.bind(customerController))

// 获取客户统计信息
router.get('/stats', unifiedAuth, requirePermission('customers:view'), customerController.getStatistics.bind(customerController))

// 获取客户统计信息（详细版本）
router.get('/stats/overview', unifiedAuth, requirePermission('customers:view'), customerController.getStatisticsOverview.bind(customerController))

// 获取客户积分自动累计设置
router.get('/points-config', unifiedAuth, requirePermission('customers:view'), customerController.getPointsConfig.bind(customerController))

// 积分规则的商品最小选项，沿用客户查看权限
router.get('/points-products', unifiedAuth, requirePermission('customers:view'), customerController.getPointsProducts.bind(customerController))

// 保存客户积分自动累计设置
router.put('/points-config', unifiedAuth, requirePermission('customers:manage'), customerController.savePointsConfig.bind(customerController))

router.get('/address-capabilities', unifiedAuth, requirePermission('customers:view'), customerController.getAddressCapabilities.bind(customerController))

router.get('/export', unifiedAuth, requirePermission('customers:export'), protectCustomerAddress, customerController.export.bind(customerController))

// 获取单个客户详情
router.get('/:id', unifiedAuth, requirePermission('customers:view'), protectCustomerAddress, customerController.getById.bind(customerController))

// 创建客户
router.post('/', unifiedAuth, requirePermission('customers:create'), protectCustomerAddress, customerController.create.bind(customerController))

// 更新客户信息
router.put('/:id', unifiedAuth, requirePermission('customers:edit'), protectCustomerAddress, customerController.update.bind(customerController))

// 删除客户
router.delete('/:id', unifiedAuth, requirePermission('customers:delete'), customerController.remove.bind(customerController))

// 获取客户消费记录（手机购买记录）
router.get('/:id/purchases', unifiedAuth, requirePermission('customers:view'), customerController.getPurchases.bind(customerController))

// 客户积分/余额明细及受控账户调整
router.get('/:id/account-ledger', unifiedAuth, requirePermission('customers:view'), customerController.getAccountLedger.bind(customerController))
router.post('/:id/account-adjustments', unifiedAuth, requirePermission('customers:manage'), customerController.adjustAccount.bind(customerController))

// 消费记录必须通过真实销售事务创建，禁止从客户接口伪造消费流水。
router.post('/:id/purchases', unifiedAuth, requirePermission('customers:edit'), customerController.rejectPurchaseCreation.bind(customerController))

// 更新VIP等级
router.patch('/:id/vip-level', unifiedAuth, requirePermission('customers:manage'), customerController.updateVipLevel.bind(customerController))

module.exports = router
