const csrfTokenService = require('../services/csrf-token.service')
const log = require('../utils/log')

class CsrfController {
  constructor(service = csrfTokenService) {
    this.service = service
  }

  async generateToken(req, res) {
    try {
      const { token, tokenId, isTemporary } = await this.service.issueToken(req)
      res.setHeader('X-CSRF-Token', token)
      res.setHeader('X-CSRF-Token-Id', tokenId)
      return res.json({
        success: true,
        message: isTemporary ? '临时 CSRF Token 生成成功' : 'CSRF Token 生成成功',
        data: {
          csrfToken: token,
          tokenId,
          expiresIn: this.service.CSRF_CONFIG?.TOKEN_EXPIRY || 3600,
          isTemporary
        }
      })
    } catch (error) {
      log.error('生成 CSRF Token 失败:', error)
      return res.status(500).json({
        success: false,
        message: '生成 CSRF Token 失败',
        error: error.message
      })
    }
  }

  async verifyToken(req, res) {
    try {
      const { token } = req.body
      if (!token) {
        return res.status(400).json({ success: false, message: '缺少 CSRF Token' })
      }

      const isValid = await this.service.verifyRequestToken(req, token)
      if (!isValid) {
        return res.status(403).json({
          success: false,
          message: 'CSRF Token 无效或已过期'
        })
      }

      return res.json({ success: true, message: 'CSRF Token 验证成功' })
    } catch (error) {
      log.error('验证 CSRF Token 失败:', error)
      return res.status(500).json({
        success: false,
        message: '验证 CSRF Token 失败',
        error: error.message
      })
    }
  }
}

module.exports = CsrfController
