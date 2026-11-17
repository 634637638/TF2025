'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { hasGoodsPermission } = require('../src/utils/goods-permission')
const { requirePermission } = require('../src/middleware/unified-auth')

// 使用真实统一鉴权解析完整模块键；隔离测试不查询真实角色数据库。
const check = async (user, permission) => {
  let allowed = false
  const response = { status() { return this }, json() { return this } }
  await requirePermission(permission)({ user }, response, () => { allowed = true })
  return allowed
}

const actor = actions => ({ id: 7, permissions: actions.map(action => `query_queryview:${action}`) })

test('商品查询、销售和赠送按真实角色权限独立授权，不开放商品管理或管理员权限', async () => {
  for (const [actions, expected] of [
    [['view', 'goods-view'], [true, false, false]],
    [['view', 'goods-view', 'goods-sell'], [true, true, false]],
    [['view', 'goods-view', 'goods-gift'], [true, false, true]],
    [['view', 'goods-view', 'goods-sell', 'goods-gift'], [true, true, true]],
    [['view', 'goods-sell', 'goods-gift'], [false, false, false]],
    [['goods-view', 'goods-sell', 'goods-gift'], [false, false, false]],
    [['view', 'film'], [false, false, false]]
  ]) {
    const user = actor(actions)
    assert.deepEqual(await Promise.all(['view', 'create', 'gift'].map(action => hasGoodsPermission(user, action, check))), expected, actions.join(','))
    for (const permission of ['accessories:view', 'accessories:create', 'accessories:edit', 'accessories:gift', 'permissions:admin']) {
      assert.equal(await check(user, permission), false, permission)
    }
    assert.equal(await hasGoodsPermission(user, 'delete', check), false)
  }
})

test('原商品管理动作保持独立，不反向授予综合查询入口或动作', async () => {
  for (const action of ['view', 'sell', 'gift']) {
    const user = { id: 7, permissions: ['accessories_accessoriesview:view', `accessories_accessoriesview:${action}`] }
    assert.equal(await hasGoodsPermission(user, action === 'sell' ? 'create' : action, check), true)
    for (const permission of ['query:goods-view', 'query:goods-sell', 'query:goods-gift']) {
      assert.equal(await check(user, permission), false)
    }
  }
})

// 保留交易动作不能绕过已撤销的母页面查看权限。
test('商品管理只有销售或赠送动作时，不能查看或执行商品业务', async () => {
  const user = { id: 7, permissions: ['accessories_accessoriesview:sell', 'accessories_accessoriesview:gift'] }
  assert.deepEqual(await Promise.all(['view', 'create', 'gift'].map(action => hasGoodsPermission(user, action, check))), [false, false, false])
})
