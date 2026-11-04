'use strict'

const { isSuperAdmin } = require('../middleware/unified-auth')

class StoreScopeError extends Error {
  constructor(message, statusCode = 403, code = 'STORE_SCOPE_DENIED') {
    super(message)
    this.name = 'StoreScopeError'
    this.statusCode = statusCode
    this.code = code
  }
}

const parseStoreId = (value) => {
  const rawValue = Array.isArray(value) ? value[0] : value
  if (rawValue === undefined || rawValue === null || rawValue === '') return null

  const storeId = Number(rawValue)
  return Number.isInteger(storeId) && storeId > 0 ? storeId : undefined
}

const getUserStoreIds = (user) => {
  const values = [
    ...(Array.isArray(user?.store_ids) ? user.store_ids : []),
    user?.store_id
  ]

  return [...new Set(values
    .map(Number)
    .filter(storeId => Number.isInteger(storeId) && storeId > 0))]
}

const resolveStoreScope = (user, requestedStoreValue) => {
  const requestedStoreId = parseStoreId(requestedStoreValue)
  if (requestedStoreId === undefined) {
    throw new StoreScopeError('store_id 参数无效', 400, 'INVALID_STORE_ID')
  }

  if (isSuperAdmin(user)) {
    return {
      allStores: requestedStoreId === null,
      requestedStoreId,
      storeIds: requestedStoreId === null ? [] : [requestedStoreId]
    }
  }

  const userStoreIds = getUserStoreIds(user)
  if (requestedStoreId !== null && !userStoreIds.includes(requestedStoreId)) {
    throw new StoreScopeError('无权访问该门店数据')
  }

  return {
    allStores: false,
    requestedStoreId,
    storeIds: requestedStoreId === null ? userStoreIds : [requestedStoreId]
  }
}

const assertStoreInScope = (scope, storeId) => {
  const normalizedStoreId = parseStoreId(storeId)
  if (normalizedStoreId === undefined || normalizedStoreId === null) {
    throw new StoreScopeError('store_id 参数无效', 400, 'INVALID_STORE_ID')
  }

  if (!scope?.allStores && !scope?.storeIds?.includes(normalizedStoreId)) {
    throw new StoreScopeError('无权访问该门店数据')
  }

  return normalizedStoreId
}

const appendStoreScopeCondition = (scope, column, conditions, params) => {
  if (scope?.allStores) return

  const storeIds = Array.isArray(scope?.storeIds) ? scope.storeIds : []
  if (storeIds.length === 0) {
    conditions.push('1 = 0')
    return
  }

  conditions.push(`${column} IN (${storeIds.map(() => '?').join(', ')})`)
  params.push(...storeIds)
}

const isStoreScopeError = error => error instanceof StoreScopeError

module.exports = {
  StoreScopeError,
  appendStoreScopeCondition,
  assertStoreInScope,
  getUserStoreIds,
  isStoreScopeError,
  parseStoreId,
  resolveStoreScope
}
