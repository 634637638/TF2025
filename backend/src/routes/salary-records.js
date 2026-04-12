const express = require('express');
const router = express.Router();
const SalaryRecordController = require('../controllers/salary-record.controller');
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');

// 工资记录相关路由（需要认证）
router.use(unifiedAuth);

// 获取工资记录列表
// 统一主端点：管理员返回全部，普通用户只返回自己的记录
router.get('/', requirePermission('salary-records:view'),
  SalaryRecordController.getSalaryRecords.bind(SalaryRecordController)
);

// 获取个人工资记录
// 兼容旧端点，内部已复用统一主端点逻辑
router.get('/my', requirePermission('salary-records:view:own'),
  SalaryRecordController.getMySalaryRecords.bind(SalaryRecordController)
);

// 获取工资统计（必须放在 /:id 之前）
router.get('/stats/summary', requirePermission('salary-records:view'),
  SalaryRecordController.getSalaryStats.bind(SalaryRecordController)
);

// 批量获取员工销售数据（必须放在 /:id 之前）
router.get('/sales-data', requirePermission('salary-records:view:all'),
  SalaryRecordController.getEmployeesSalesData.bind(SalaryRecordController)
);

// 获取单个员工的销售明细列表（必须放在 /:id 之前）
// 允许员工查看自己的销售明细，需要额外的权限检查在controller中处理
router.get('/sales-details',
  requirePermission('salary-records:view'),
  SalaryRecordController.getEmployeeSalesDetails.bind(SalaryRecordController)
);

// 获取工资记录详情
router.get('/:id', requirePermission('salary-records:view'),
  SalaryRecordController.getSalaryRecordById.bind(SalaryRecordController)
);

// 创建工资记录
router.post('/', requirePermission('salary-records:create'),
  SalaryRecordController.createSalaryRecord.bind(SalaryRecordController)
);

// 更新工资记录
router.put('/:id', requirePermission('salary-records:edit'),
  SalaryRecordController.updateSalaryRecord.bind(SalaryRecordController)
);

// 删除工资记录
router.delete('/:id', requirePermission('salary-records:delete'),
  SalaryRecordController.deleteSalaryRecord.bind(SalaryRecordController)
);

// 计算工资
router.post('/calculate', requirePermission('salary-records:edit'),
  SalaryRecordController.calculateSalary.bind(SalaryRecordController)
);

// 保存计算的工资
router.post('/save', requirePermission('salary-records:create'),
  SalaryRecordController.saveCalculatedSalary.bind(SalaryRecordController)
);

// 批量计算工资
router.post('/batch-calculate', requirePermission('salary-records:edit'),
  SalaryRecordController.batchCalculateSalaries.bind(SalaryRecordController)
);

// 批量重算某月工资
router.post('/recalculate-month', requirePermission('salary-records:edit'),
  SalaryRecordController.bulkRecalculateByPeriod.bind(SalaryRecordController)
);

// 审批工资记录
router.post('/:id/approve', requirePermission('salary-records:approve'),
  SalaryRecordController.approveSalaryRecord.bind(SalaryRecordController)
);

// 标记工资为已发放
router.post('/:id/pay', requirePermission('salary-records:edit'),
  SalaryRecordController.markAsPaid.bind(SalaryRecordController)
);

module.exports = router;
