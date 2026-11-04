'use strict'

const crypto = require('node:crypto')

function createCustomerToken() {
  return crypto.randomBytes(32).toString('base64url')
}

function hashCustomerToken(token) {
  const normalizedToken = String(token || '').trim()
  if (!normalizedToken) throw new Error('客户 Token 不能为空')
  return crypto.createHash('sha256').update(normalizedToken, 'utf8').digest('hex')
}

function extractBearerToken(authorizationHeader) {
  const header = String(authorizationHeader || '').trim()
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : ''
}

async function assertCustomerTokenSchema(database) {
  const [columns] = await database.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'customer_tokens'
       AND COLUMN_NAME IN ('token', 'token_hash')`
  )
  const [indexes] = await database.query(
    `SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'customer_tokens'
       AND COLUMN_NAME = 'token_hash'`
  )

  const tokenColumn = columns.find(column => column.COLUMN_NAME === 'token')
  const tokenHashColumn = columns.find(column => column.COLUMN_NAME === 'token_hash')
  const uniqueHashIndex = indexes.some(index => Number(index.NON_UNIQUE) === 0)
  const validHashType = /^char\(64\)$/i.test(String(tokenHashColumn?.COLUMN_TYPE || ''))

  if (!tokenColumn || tokenColumn.IS_NULLABLE !== 'YES' || !tokenHashColumn || !validHashType || !uniqueHashIndex) {
    const error = new Error('customer_tokens 摘要结构未就绪，请先执行 npm run migrate:customer-token-hashes -- --apply')
    error.code = 'CUSTOMER_TOKEN_SCHEMA_REQUIRED'
    error.fatalStartup = true
    throw error
  }

  return true
}

module.exports = {
  assertCustomerTokenSchema,
  createCustomerToken,
  extractBearerToken,
  hashCustomerToken
}
