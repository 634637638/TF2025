const DebugPermissionsService = require('../services/debug-permissions.service')
const log = require('../utils/log')

class DebugPermissionsController {
  constructor({ service = new DebugPermissionsService() } = {}) {
    this.service = service
  }

  async getCurrentUser(req, res) {
    try {
      const data = await this.service.getCurrentUser(req.user.id)

      return res.json({
        success: true,
        data
      })
    } catch (error) {
      log.error('调试权限信息失败:', error)
      return res.status(500).json({
        success: false,
        message: '调试权限信息失败: ' + error.message
      })
    }
  }

  async getRolePermissions(req, res) {
    try {
      const data = await this.service.getRolePermissions(req.params.roleId)
      if (!data.role) {
        return res.status(404).json({ success: false, message: '角色不存在' })
      }

      return res.json({
        success: true,
        data
      })
    } catch (error) {
      log.error('调试角色权限失败:', error)
      return res.status(500).json({
        success: false,
        message: '调试角色权限失败: ' + error.message
      })
    }
  }
}

module.exports = DebugPermissionsController
