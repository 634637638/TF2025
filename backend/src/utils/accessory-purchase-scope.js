'use strict'

const { appendStoreScopeCondition } = require('./store-scope')

/** 原采购整单金额要求原入库店及全部历史分配店获授权；当前库存位置不能授予原单权限。 */
function appendPurchaseStoreScope(scope, alias, conditions, params) {
  if (!['si', 'asi'].includes(alias)) throw new Error('不支持的原采购别名')
  appendStoreScopeCondition(scope, `${alias}.store_id`, conditions, params)
  if (!scope.allStores && scope.storeIds.length) {
    const count = scope.storeIds.map(() => `JSON_CONTAINS(${alias}.distribution, JSON_OBJECT('store_id', ?))`).join(' + ')
    conditions.push(`(${alias}.distribution IS NULL OR ${alias}.distribution = '' OR
      CASE WHEN JSON_VALID(${alias}.distribution) THEN
        JSON_TYPE(${alias}.distribution) = 'ARRAY' AND JSON_LENGTH(${alias}.distribution) = (${count})
      ELSE FALSE END)`)
    params.push(...scope.storeIds)
  }
}

module.exports = { appendPurchaseStoreScope }
