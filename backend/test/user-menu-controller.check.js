'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const UserMenuController = require('../src/controllers/user-menu.controller')
const UserMenuService = require('../src/services/user-menu.service')
const UserMenuRepository = require('../src/repositories/user-menu.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('user menu route delegates to controller without adding middleware', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
  assert.match(route, /router\.get\('\/user-menu', userMenuController\.getUserMenu\.bind\(userMenuController\)\)/)
})

test('user menu controller keeps missing identity, success and failure responses', async () => {
  const controller = new UserMenuController({
    service: { async getUserMenu(userId) { assert.equal(userId, 7); return [{ id: 1 }] } },
    logger: { error() {} }
  })
  const missing = response()
  const success = response()
  await controller.getUserMenu({ user: null }, missing)
  await controller.getUserMenu({ user: { id: 7 } }, success)

  assert.equal(missing.statusCode, 401)
  assert.deepEqual(missing.body, { success: false, message: '用户未认证' })
  assert.deepEqual(success.body, {
    success: true, message: '获取用户菜单权限成功', data: { menuPermissions: [{ id: 1 }] }
  })

  const failure = response()
  await new UserMenuController({ service: { async getUserMenu() { throw new Error('query failed') } }, logger: { error() {} } })
    .getUserMenu({ user: { userId: 7 } }, failure)
  assert.equal(failure.statusCode, 500)
  assert.equal(failure.body.message, '获取用户菜单权限失败: query failed')
})

test('user menu service preserves public menus and visible descendants while filtering inaccessible branches', async () => {
  let released = false
  let visibilityCall
  const service = new UserMenuService({
    database: () => ({ getConnection: async () => ({ release() { released = true } }) }),
    repository: {
      async getActiveMenus() {
        return [
          { id: 1, name: '公开', url: '/public', parent_id: 0, sort_order: 1 },
          { id: 2, name: '隐藏父级', url: '/hidden', parent_id: 0, module_key: 'hidden', sort_order: 2 },
          { id: 3, name: '可见子级', url: '/visible', parent_id: 2, module_id: 30, sort_order: 1 },
          { id: 4, name: '不可见', url: '/private', parent_id: 0, module_key: 'private', sort_order: 3 }
        ]
      },
      async getActiveModules() { return [{ id: 30, key: 'visible' }] }
    },
    async getVisibility(userId, connection) {
      visibilityCall = [userId, connection]
      return { visible: true, hidden: false, private: false }
    }
  })

  const result = await service.getUserMenu(7)
  assert.equal(released, true)
  assert.equal(visibilityCall[0], 7)
  assert.deepEqual(result, [
    {
      id: 1, name: '公开', url: '/public', icon: 'el-icon-menu', icon_svg: null,
      icon_source: null, icon_is_valid: undefined, parent_id: 0, children: []
    },
    {
      id: 2, name: '隐藏父级', url: '/hidden', icon: 'el-icon-menu', icon_svg: null,
      icon_source: null, icon_is_valid: undefined, parent_id: 0, children: [{
        id: 3, name: '可见子级', url: '/visible', icon: 'el-icon-menu', icon_svg: null,
        icon_source: null, icon_is_valid: undefined, parent_id: 2, children: []
      }]
    }
  ])
})

test('user menu repository uses schema-backed icon join and active menu/module queries', async () => {
  const calls = []
  const connection = {
    async execute(sql) {
      calls.push(sql)
      if (/SHOW COLUMNS FROM icons/.test(sql)) return [[], []]
      if (/FROM menus m/.test(sql)) return [[{ id: 1 }]]
      if (/FROM modules/.test(sql)) return [[{ id: 2, key: 'test' }]]
      return [[], []]
    }
  }
  const repository = new UserMenuRepository()

  const menus = await repository.getActiveMenus(connection)
  const modules = await repository.getActiveModules(connection)

  assert.deepEqual(menus, [{ id: 1 }])
  assert.deepEqual(modules, [{ id: 2, key: 'test' }])
  assert.match(calls.find(sql => /FROM menus m/.test(sql)), /WHERE m\.is_active = 1/)
  assert.match(calls.find(sql => /FROM modules/.test(sql)), /WHERE is_active = 1/)
})
