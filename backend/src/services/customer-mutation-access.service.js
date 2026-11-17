'use strict'

const { hasUnifiedPermission } = require('../middleware/unified-auth')

/** 客户档案写入使用独立客户动作，业务页面权限只允许关联已有客户。 */
class CustomerMutationAccessService {
  constructor({ permissionCheck = hasUnifiedPermission } = {}) {
    this.permissionCheck = permissionCheck
  }

  async require(actor, action) {
    if (actor && await this.permissionCheck(actor, `customers:${action}`)) return
    throw Object.assign(new Error(action === 'create' ? '缺少新增客户权限，请选择已有客户或联系管理员授权' : '缺少编辑客户权限，不能修改客户档案'), {
      status: 403, statusCode: 403, code: 'INSUFFICIENT_PERMISSIONS'
    })
  }
}

module.exports = CustomerMutationAccessService
