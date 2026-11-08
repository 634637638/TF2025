const test = require('node:test')
const assert = require('node:assert/strict')

const createResponse = () => ({
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})

test('菜单自动绑定由受权限保护的 route 委托给 controller', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/menus.js'), 'utf8')

  assert.match(route, /router\.post\('\/auto-bind-modules', unifiedAuth, requirePermission\('menus:edit'\), menuController\.autoBindModules\.bind\(menuController\)\)/)
  assert.doesNotMatch(route, /router\.post\('\/auto-bind-modules'[^\n]*async\s*\(/)
})

test('菜单 route 全部直接绑定 controller 方法并保留原权限', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/menus.js'), 'utf8')
  const methods = [
    'getMenuList', 'getParentMenuOptions', 'getMenuStats', 'exportMenus', 'getMenuById',
    'createMenu', 'importMenus', 'copyMenu', 'updateMenu', 'deleteMenu', 'updateMenuStatus', 'updateMenuSort'
  ]

  for (const method of methods) {
    assert.match(route, new RegExp(`menuController\\.${method}\\.bind\\(menuController\\)`))
  }
  assert.match(route, /requirePermission\('menus:export'\)/)
  assert.match(route, /upload\.single\('file'\), menuController\.importMenus\.bind\(menuController\)/)
  assert.doesNotMatch(route, /router\.(?:get|post|put|patch|delete)\([^\n]*\(req,\s*res\)\s*=>/)
})

test('菜单自动绑定 controller 保留单条、批量和不存在菜单响应', async (t) => {
  const controller = require('../src/controllers/menu.controller')
  const binder = require('../src/services/menu-module-auto-binder.service')
  const singleArgs = []
  t.mock.method(binder, 'bindModuleForMenuId', async (...args) => {
    singleArgs.push(args)
    if (args[0] === 404) return { notFound: true }
    return { success: true, module_key: 'salary_salaryview' }
  })
  t.mock.method(binder, 'batchFixMenuModuleBindings', async () => ({
    success: true,
    data: { total: 1, success: 1, failed: 0, results: [] }
  }))

  const singleResponse = createResponse()
  await controller.autoBindModules({ body: { single: true, menuId: 12 } }, singleResponse)
  assert.deepEqual(singleArgs, [[12]])
  assert.deepEqual(singleResponse.body, { success: true, module_key: 'salary_salaryview' })

  const batchResponse = createResponse()
  await controller.autoBindModules({ body: {} }, batchResponse)
  assert.equal(batchResponse.body.data.total, 1)

  const missingResponse = createResponse()
  await controller.autoBindModules({ body: { single: true, menuId: 404 } }, missingResponse)
  assert.equal(missingResponse.statusCode, 404)
  assert.deepEqual(missingResponse.body, { success: false, message: '菜单不存在' })
})
