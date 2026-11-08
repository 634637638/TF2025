'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const MenuModuleLinkController = require('../src/controllers/menu-module-link.controller')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('menu-link routes keep admin authorization and delegate to the controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/module-management.js'), 'utf8')
  for (const [method, routePath, methodName] of [
    ['get', '/menu-link/stats', 'getLinkStats'],
    ['get', '/menu-link/unlinked', 'getUnlinkedMenus'],
    ['post', '/menu-link/sync', 'syncAll'],
    ['post', '/menu-link/link', 'linkMenu']
  ]) {
    assert.match(route, new RegExp(`router\\.${method}\\('${routePath.replaceAll('/', '\\/')}', requirePermission\\('permissions:admin'\\), menuModuleLinkController\\.${methodName}\\.bind\\(menuModuleLinkController\\)\\)`))
  }
})

test('menu-link controller delegates success responses and validates explicit link inputs', async () => {
  const calls = []
  const controller = new MenuModuleLinkController({
    service: {
      async getLinkStats() { calls.push('stats'); return { success: true, data: { total_menus: 3 } } },
      async getUnlinkedMenus() { calls.push('unlinked'); return { success: true, data: { total: 1, menus: [] } } },
      async syncAllMenusToModules() { calls.push('sync'); return { success: true, linked: 2 } },
      async linkMenuToModule(...args) { calls.push(args); return { success: true, menu_id: args[0], module_key: args[1] } }
    }
  })
  const stats = response()
  const unlinked = response()
  const sync = response()
  const missing = response()
  const linked = response()

  await controller.getLinkStats({}, stats)
  await controller.getUnlinkedMenus({}, unlinked)
  await controller.syncAll({}, sync)
  await controller.linkMenu({ body: {} }, missing)
  await controller.linkMenu({ body: { menu_id: 5, module_key: 'sales_salesview' } }, linked)

  assert.deepEqual(calls, ['stats', 'unlinked', 'sync', [5, 'sales_salesview']])
  assert.deepEqual(stats.body, { success: true, data: { total_menus: 3 } })
  assert.deepEqual(unlinked.body, { success: true, data: { total: 1, menus: [] } })
  assert.deepEqual(sync.body, { success: true, linked: 2 })
  assert.equal(missing.statusCode, 400)
  assert.deepEqual(missing.body, { success: false, message: '菜单ID和模块标识不能为空' })
  assert.deepEqual(linked.body, { success: true, menu_id: 5, module_key: 'sales_salesview' })
})

test('menu-link controller keeps endpoint-specific server error messages', async () => {
  const controller = new MenuModuleLinkController({
    service: {
      async getLinkStats() { throw new Error('database') },
      async getUnlinkedMenus() { throw new Error('database') },
      async syncAllMenusToModules() { throw new Error('database') },
      async linkMenuToModule() { throw new Error('database') }
    },
    logger: { error() {} }
  })
  for (const [method, req, message] of [
    ['getLinkStats', {}, '获取关联统计失败: database'],
    ['getUnlinkedMenus', {}, '获取未关联菜单失败: database'],
    ['syncAll', {}, '同步失败: database'],
    ['linkMenu', { body: { menu_id: 2, module_key: 'key' } }, '关联失败: database']
  ]) {
    const result = response()
    await controller[method](req, result)
    assert.equal(result.statusCode, 500)
    assert.equal(result.body.message, message)
  }
})
