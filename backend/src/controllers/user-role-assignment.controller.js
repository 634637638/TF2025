'use strict'

const log = require('../utils/log')
const UserRoleAssignmentService = require('../services/user-role-assignment.service')

class UserRoleAssignmentController {
  constructor({ service = new UserRoleAssignmentService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async assign(req, res) {
    const userId = Number(req.params.id)
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: '用户ID无效' })
    }
    const roleIds = req.body?.role_ids
    if (!Array.isArray(roleIds)) {
      return res.status(400).json({ success: false, message: '角色ID列表必须是数组' })
    }
    const normalizedRoleIds = [...new Set(roleIds.map(roleId => Number(roleId)))]
    if (normalizedRoleIds.some(roleId => !Number.isSafeInteger(roleId) || roleId <= 0)) {
      return res.status(400).json({ success: false, message: '角色ID列表包含无效值' })
    }

    try {
      const result = await this.service.assign({
        userId,
        roleIds: normalizedRoleIds,
        requestContext: req
      })
      if (result.status === 'not_found') {
        return res.status(404).json({ success: false, message: '用户不存在' })
      }
      if (result.status === 'invalid_roles') {
        return res.status(400).json({ success: false, message: '部分角色ID无效' })
      }
      return res.json({ success: true, message: '用户角色分配成功' })
    } catch (error) {
      if (error.code === 'INVALID_ROLE_LIST' || error.code === 'INVALID_ROLE_ID') {
        return res.status(400).json({ success: false, message: error.message })
      }
      this.logger.error('分配用户角色失败:', error)
      return res.status(500).json({ success: false, message: '分配用户角色失败' })
    }
  }
}

module.exports = UserRoleAssignmentController
