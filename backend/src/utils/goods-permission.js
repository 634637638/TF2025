'use strict'

const { hasUnifiedPermission } = require('../middleware/unified-auth')

/** 商品业务能力可来自商品管理或综合查询，但不会反向授予另一页面权限。 */
const hasGoodsPermission = async (actor, action, check = hasUnifiedPermission) => {
  const queryAction = { view: 'goods-view', create: 'goods-sell', gift: 'goods-gift' }[action]
  if (!queryAction) return false
  if (await check(actor, 'accessories:view') &&
    (action === 'view' || await check(actor, `accessories:${action === 'create' ? 'sell' : action}`))) return true
  if (!await check(actor, 'query:view') || !await check(actor, 'query:goods-view')) return false
  return action === 'view' || await check(actor, `query:${queryAction}`)
}

module.exports = { hasGoodsPermission }
