'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const Service = require('../src/services/dashboard-shortcuts.service')
const Controller = require('../src/controllers/dashboard-shortcuts.controller')
const Repository = require('../src/repositories/system-settings.repository')
const config = require('../src/config/dashboard-shortcuts.json')
const masking = require('../src/services/data-masking.service')
const FieldAccessService = require('../src/services/field-access.service')
const FieldRepository = require('../src/repositories/user-field-permissions.repository')

const input = { label: '商品销售', kind: 'action', target: 'goods-sale', icon: 'fas fa-shopping-cart', sortOrder: 2, enabled: true }
const schema = { getTableMeta: async () => ({ isKeyValueTable: true, availableColumns: new Set(['key_name', 'value', 'type']) }) }
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
function fixture() {
  let value = null
  let writes = 0
  const service = new Service({ schema, repository: {
    getSettingByKey: async () => value === null ? null : { value: JSON.stringify(value) },
    mutateJsonSetting: async (_key, initial, mutate) => { const updated = mutate(value ?? initial); value = updated; writes++; return updated }
  } })
  return { service, writes: () => writes, setValue: next => { value = next } }
}

test('全部登记功能均可保存并保留唯一目标，参数只来自受控登记，不接受客户端追加', async () => {
  const f = fixture()
  for (const action of config.actions) {
    const body = { ...input, target: action.id }
    assert.deepEqual(f.service.normalize(body), body)
    assert.match(action.path, /^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/)
    if (action.query.shortcut) assert.equal(action.query.shortcut, action.id)
    await assert.rejects(f.service.change(null, { ...body, query: action.query }), { statusCode: 400 })
  }
  assert.equal(new Set(config.actions.map(action => action.id)).size, config.actions.length)
  assert.equal(f.writes(), 0)
})

test('缺少配置时只读返回空列表，新增/编辑/停用/删除按同一键保存且保留其他条目', async () => {
  const f = fixture()
  assert.deepEqual(await f.service.list(), [])
  assert.equal(f.writes(), 0)
  let items = await f.service.change(null, input)
  const id = items[0].id
  assert.match(id, /^[a-f0-9-]{36}$/)
  items = await f.service.change(null, { ...input, label: ' 手机库存 ', kind: 'page', target: '/inventory', sortOrder: 1 })
  assert.equal(items[0].label, '手机库存')
  const other = items[0]
  items = await f.service.change(id, { ...input, label: '收银', enabled: false })
  assert.equal(items[1].label, '收银')
  assert.deepEqual(await f.service.list(), [other])
  assert.equal((await f.service.list(true)).length, 2)
  assert.deepEqual(await f.service.change(id, null, true), [other])
  await assert.rejects(f.service.change(id, input), { statusCode: 404 })
})

test('服务端拒绝非法目标、未登记功能、注入、越界字段，不把非法内容写入配置', async () => {
  const f = fixture()
  for (const body of [null, [], {}, { ...input, label: ' ' }, { ...input, label: '字'.repeat(41) },
    { ...input, enabled: 'true' }, { ...input, sortOrder: NaN }, { ...input, sortOrder: -1 }, { ...input, sortOrder: 1.5 },
    { ...input, icon: '<img onerror=alert(1)>' }, { ...input, id: 'forged' }, { ...input, target: 'unknown-action' },
    ...['https://example.com', '//example.com', '/query?openSale=true', '/query#run', '/query\\evil', '/query\n', '/a/../query', '/login?redirect=evil'].map(target => ({ ...input, kind: 'page', target }))]) {
    await assert.rejects(f.service.change(null, body), { statusCode: 400 })
  }
  assert.equal(f.writes(), 0)
})

test('不支持的旧表结构及损坏配置均拒绝写入，不自动创建表列或重置原配置', async () => {
  const f = fixture()
  f.service.schema = { getTableMeta: async () => ({ isKeyValueTable: false, availableColumns: new Set() }) }
  await assert.rejects(f.service.list(), { statusCode: 409 })
  await assert.rejects(f.service.change(null, input), { statusCode: 409 })
  f.service.schema = schema
  f.setValue({ invalid: true })
  await assert.rejects(f.service.change(null, input), { statusCode: 409 })
  assert.equal(f.writes(), 0)
})

test('JSON配置更新在同一连接事务内创建占位、锁行、保存并提交，异常回滚释放连接', async () => {
  for (const fail of [false, true]) {
    const calls = []
    const connection = {
      beginTransaction: async () => calls.push('begin'),
      execute: async (sql, params) => { calls.push({ sql, params }); return sql.startsWith('SELECT') ? [[{ value: '[1]' }]] : [{}] },
      commit: async () => calls.push('commit'), rollback: async () => calls.push('rollback')
    }
    const repository = new Repository()
    repository.withConnection = async operation => { try { return await operation(connection) } finally { calls.push('release') } }
    const result = repository.mutateJsonSetting('safe-key', [], value => {
      assert.deepEqual(value, [1])
      if (fail) throw new Error('invalid content')
      return [...value, 2]
    })
    if (fail) await assert.rejects(result, /invalid content/)
    else assert.deepEqual(await result, [1, 2])
    assert.match(calls[2].sql, /WHERE key_name = \? FOR UPDATE/)
    assert.deepEqual(calls.slice(-2), [fail ? 'rollback' : 'commit', 'release'])
    assert.equal(calls.some(call => typeof call === 'object' && /CREATE|ALTER|DROP/.test(call.sql)), false)
  }
})

test('管理接口遵守站点信息字段隐藏和只读；首页读取不要求系统管理字段权限', async () => {
  let reads = 0, writes = 0
  const service = { list: async () => { reads++; return [] }, change: async () => { writes++; return [] } }
  for (const permissions of [{ hiddenFields: ['settings.site_info'] }, { hiddenFields: [], readonlyFields: ['settings.site_info'] }]) {
    const controller = new Controller({ service, access: { getPermissions: async () => permissions } })
    const req = { user: { id: 7 }, body: input, params: { id: 'x' } }
    const home = response(); await controller.list(req, home); assert.equal(home.statusCode, 200)
    const admin = response(); await controller.listAdmin(req, admin)
    assert.equal(admin.statusCode, permissions.hiddenFields.length ? 403 : 200)
    for (const method of ['create', 'update', 'remove']) {
      const res = response(); await controller[method](req, res); assert.equal(res.statusCode, 403)
    }
  }
  assert.equal(writes, 0)
  assert.equal(reads, 3)
})

test('实际路由使用统一登录和精确动作权限，查看不能编辑，编辑不能删除', async () => {
  const router = require('../src/routes/system')
  for (const [method, path, permission] of [
    ['get', '/dashboard-shortcuts', 'dashboard_dashboardview:view'],
    ['get', '/dashboard-shortcuts/admin', 'system_systemview:view'],
    ['post', '/dashboard-shortcuts', 'system_systemview:edit'],
    ['put', '/dashboard-shortcuts/:id', 'system_systemview:edit'],
    ['delete', '/dashboard-shortcuts/:id', 'system_systemview:delete']
  ]) {
    const layer = router.stack.find(item => item.route?.path === path && item.route.methods[method])
    assert.equal(layer.route.stack.length, 3)
    for (const user of [undefined, { id: 7, permissions: ['query:view'] }, { id: 7, permissions: [permission] }]) {
      const res = response(); let allowed = false
      await layer.route.stack[1].handle({ user }, res, () => { allowed = true })
      assert.equal(allowed, !!user?.permissions.includes(permission))
      assert.equal(res.statusCode, !user ? 401 : allowed ? 200 : 403)
    }
  }
})

test('真实严格字段链路兼容SQL NULL单字段记录，保存快捷方式仍遵守隐藏、只读和损坏配置拒绝', async () => {
  const stored = { role_id: 2, module_key: 'system_systemview', field_config: null, field_config_is_null: 1,
    field_key: 'settings.id', can_view: 1, can_edit: 0, is_hidden: 0, permission_level: 'READ_ONLY' }
  for (const [row, expected] of [
    [stored, 200],
    [{ ...stored, permission_level: 'FULL', can_edit: 1 }, 200],
    [{ ...stored, field_key: 'settings.site_info' }, 403],
    [{ ...stored, field_key: 'settings.site_info', permission_level: 'HIDDEN', is_hidden: 1 }, 403],
    [{ ...stored, field_config: 'null', field_config_is_null: 0 }, 500],
    [{ ...stored, field_config: '{private-broken-config', field_config_is_null: 0 }, 500],
    [{ ...stored, field_key: undefined }, 500],
    [{ ...stored, field_config: null, field_config_is_null: 0 }, 500]
  ]) {
    const f = fixture(), reads = [], logs = []
    const logger = { error(...args) { logs.push(args) }, warn(...args) { logs.push(args) } }
    const source = new masking.constructor({ logger,
      getActiveRoles: async (userId, database) => (await database.execute('SELECT role_id FROM user_roles WHERE user_id = ?', [userId]))[0],
      fieldRepository: new FieldRepository({ columnExists: async () => true }),
      database: () => ({ async execute(sql, params) {
        reads.push({ sql, params })
        return sql.includes('FROM user_roles') ? [[{ role_id: 2 }]] : [[row]]
      } })
    })
    const controller = new Controller({ service: f.service, logger,
      access: new FieldAccessService({ moduleKey: 'system_systemview', strict: true, masking: source }) })
    const res = response()
    await controller.create({ user: { id: 7 }, body: input }, res)
    assert.equal(res.statusCode, expected)
    assert.equal(f.writes(), expected === 200 ? 1 : 0)
    assert.deepEqual(reads[1].params, [2, 'system_systemview'])
    assert.match(reads[1].sql, /field_config IS NULL AS field_config_is_null/)
    assert.match(reads[1].sql, /can_view, can_edit, is_hidden, permission_level/)
    if (expected === 200) assert.equal((await f.service.list(true))[0].label, input.label)
    else assert.equal(res.body.data, undefined)
    const logText = logs.flat().map(item => item instanceof Error ? item.message : JSON.stringify(item)).join('\n')
    assert.doesNotMatch(logText + JSON.stringify(res.body), /private-broken-config/)
  }
})
