const crypto = require('crypto')
const { getDatabase, isConnected } = require('../config/database')
const { verifyToken } = require('../middleware/jwt-blacklist')
const log = require('../utils/log')

const CSRF_CONFIG = {
  TOKEN_LENGTH: 32,
  TOKEN_EXPIRY: 3600,
  TOKEN_TTL: 3600000,
  MAX_TOKENS_PER_USER: 10,
  ENABLE_PERSISTENCE: true,
  ENABLE_RATE_LIMIT: true,
  CLEANUP_INTERVAL: 30 * 60 * 1000
}

class CsrfTokenService {
  constructor({ getDatabaseConnection = getDatabase, checkDatabaseConnection = isConnected } = {}) {
    this.getDatabaseConnection = getDatabaseConnection
    this.checkDatabaseConnection = checkDatabaseConnection
    this.csrfTokens = new Map()
  }

  getBearerToken(req) {
    const authHeader = req.headers.authorization || ''
    if (!authHeader.startsWith('Bearer ')) return ''
    return authHeader.slice(7).trim()
  }

  async resolveCSRFUserId(req) {
    if (req.user && req.user.id) return req.user.id

    const token = this.getBearerToken(req)
    if (!token) return null

    try {
      const decoded = await verifyToken(token, 'access')
      return decoded?.sub || decoded?.id || null
    } catch (error) {
      log.warn('CSRF 用户解析失败:', error.message)
      return null
    }
  }

  generateSecureCSRFToken() {
    return crypto.randomBytes(CSRF_CONFIG.TOKEN_LENGTH).toString('hex')
  }

  generateTokenId() {
    return 'csrf_' + crypto.randomBytes(16).toString('hex') + '_' + Date.now()
  }

  async storeCSRFToken(userId, tokenId, token) {
    const expiresAt = Date.now() + CSRF_CONFIG.TOKEN_TTL
    if (CSRF_CONFIG.ENABLE_PERSISTENCE) {
      const database = this.getDatabaseConnection()
      await database.execute(
        `INSERT INTO csrf_tokens (token_id, user_id, token, created_at, expires_at)
         VALUES (?, ?, ?, NOW(), FROM_UNIXTIME(?))`,
        [tokenId, userId, token, expiresAt / 1000]
      )
    }

    this.csrfTokens.set(tokenId, {
      userId,
      token,
      createdAt: Date.now(),
      expiresAt
    })
  }

  async cleanupExpiredTokens(userId) {
    const now = Date.now()
    for (const [tokenId, data] of this.csrfTokens.entries()) {
      if (data.userId === userId && now > data.expiresAt) {
        this.csrfTokens.delete(tokenId)
      }
    }

    const userTokens = []
    for (const [tokenId, data] of this.csrfTokens.entries()) {
      if (data.userId === userId && now <= data.expiresAt) {
        userTokens.push({ tokenId, createdAt: data.createdAt })
      }
    }

    if (userTokens.length > CSRF_CONFIG.MAX_TOKENS_PER_USER) {
      userTokens.sort((a, b) => a.createdAt - b.createdAt)
      const toDelete = userTokens.slice(0, userTokens.length - CSRF_CONFIG.MAX_TOKENS_PER_USER)

      for (const item of toDelete) {
        this.csrfTokens.delete(item.tokenId)
        if (CSRF_CONFIG.ENABLE_PERSISTENCE) {
          try {
            const database = this.getDatabaseConnection()
            await database.execute('DELETE FROM csrf_tokens WHERE token_id = ?', [item.tokenId])
          } catch (error) {
            log.error('删除过期 CSRF Token 失败:', error)
          }
        }
      }
    }
  }

  async verifyCSRFToken(userId, token) {
    const now = Date.now()
    for (const [, data] of this.csrfTokens.entries()) {
      if (data.userId === userId && data.token === token && now <= data.expiresAt) {
        return true
      }
    }

    if (CSRF_CONFIG.ENABLE_PERSISTENCE) {
      try {
        const database = this.getDatabaseConnection()
        const [rows] = await database.execute(
          `SELECT token_id FROM csrf_tokens
           WHERE user_id = ? AND token = ? AND expires_at > NOW()
           LIMIT 1`,
          [userId, token]
        )

        if (rows.length > 0) {
          const tokenId = rows[0].token_id
          this.csrfTokens.set(tokenId, {
            userId,
            token,
            createdAt: Date.now(),
            expiresAt: now + CSRF_CONFIG.TOKEN_TTL
          })
          return true
        }
      } catch (error) {
        log.error('从数据库验证 CSRF Token 失败:', error)
        throw error
      }
    }

    return false
  }

  async issueToken(req) {
    let userId = await this.resolveCSRFUserId(req)
    let isTemporary = false
    if (!userId) {
      const sessionId = req.sessionID || req.ip || 'anonymous_' + Date.now()
      userId = 'temp_' + sessionId
      isTemporary = true
    }

    await this.cleanupExpiredTokens(userId)
    const token = this.generateSecureCSRFToken()
    const tokenId = this.generateTokenId()
    await this.storeCSRFToken(userId, tokenId, token)
    return { token, tokenId, isTemporary }
  }

  async verifyRequestToken(req, token) {
    let userId = await this.resolveCSRFUserId(req)
    if (!userId) {
      const sessionId = req.sessionID || req.ip || 'anonymous_' + Date.now()
      userId = 'temp_' + sessionId
    }
    return this.verifyCSRFToken(userId, token)
  }

  async cleanupAllExpiredTokens() {
    if (!this.checkDatabaseConnection()) {
      log.debug('数据库尚未连接，跳过本轮 CSRF Token 清理')
      return
    }

    try {
      const database = this.getDatabaseConnection()
      const [result] = await database.execute('DELETE FROM csrf_tokens WHERE expires_at < NOW()')
      if (result.affectedRows > 0) {
        log.debug(`清理了 ${result.affectedRows} 个过期的 CSRF Token`)
      }
    } catch (error) {
      log.error('清理过期 CSRF Token 失败:', error)
    }
  }
}

const csrfTokenService = new CsrfTokenService()

module.exports = csrfTokenService
module.exports.CsrfTokenService = CsrfTokenService
module.exports.CSRF_CONFIG = CSRF_CONFIG
