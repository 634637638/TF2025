const express = require('express');
const router = express.Router();
const SalaryTemplateController = require('../controllers/salary-template.controller');
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');

// 工资模板相关路由（需要认证）
router.use(unifiedAuth);

// 获取工资模板列表
router.get('/', requirePermission('salary-templates:view'),
  SalaryTemplateController.getTemplates.bind(SalaryTemplateController)
);

// 获取激活的模板列表 - 所有认证用户都可以访问
router.get('/active',
  SalaryTemplateController.getActiveTemplates.bind(SalaryTemplateController)
);

// 获取工资模板详情
router.get('/:id', requirePermission('salary-templates:view'),
  SalaryTemplateController.getTemplateById.bind(SalaryTemplateController)
);

// 创建工资模板
router.post('/', requirePermission('salary-templates:create'),
  SalaryTemplateController.createTemplate.bind(SalaryTemplateController)
);

// 更新工资模板
router.put('/:id', requirePermission('salary-templates:edit'),
  SalaryTemplateController.updateTemplate.bind(SalaryTemplateController)
);

// 删除工资模板
router.delete('/:id', requirePermission('salary-templates:delete'),
  SalaryTemplateController.deleteTemplate.bind(SalaryTemplateController)
);

// 设为默认模板
router.post('/:id/set-default', requirePermission('salary-templates:edit'),
  SalaryTemplateController.setAsDefault.bind(SalaryTemplateController)
);

// 设置员工工资模板
router.put('/employees/:userId/template', requirePermission('salary-templates:edit'),
  SalaryTemplateController.setEmployeeTemplate.bind(SalaryTemplateController)
);

module.exports = router;
