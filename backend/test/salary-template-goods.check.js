'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Service = require('../src/services/salary-template.service').constructor
const Controller = require('../src/controllers/salary-template.controller').constructor
const Repository = require('../src/repositories/salary-template.repository')

const rule = (patch = {}) => ({ enabled: true, type: 'fixed', fixed_amount: 2.5, percentage: 10, ...patch })
const response = () => ({ status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
const masking = (hiddenFields = []) => ({
  async getUserFieldPermissions(_id, module, options) {
    assert.equal(module, 'salary_salarytemplatesview'); assert.equal(options.strict, true)
    return { hiddenFields }
  },
  filterSensitiveFields(rows) { return rows }
})

test('工资模板只读字段不可写入，商品规则、底薪、嵌套涨薪及设为默认均在业务前拒绝', async () => {
  const readonlyFields = ['template.goods_commission_rule', 'template.base_salary', 'template.auto_raise_amount', 'template.is_default']
  const controller = new Controller({ masking: {
    async getUserFieldPermissions() { return { hiddenFields: [], readonlyFields } },
    filterSensitiveFields: rows => rows
  }, service: {
    async createTemplate() { assert.fail('不可新增受限字段') },
    async updateTemplate() { assert.fail('不可更新受限字段') },
    async setAsDefault() { assert.fail('不可设置只读默认状态') }
  } })
  for (const body of [{ goods_commission_rule: rule() }, { goods_commission_rule: null },
    { base_salary: 0 }, { auto_raise_rule: JSON.stringify({ amount: 10 }) }, { auto_raise_rule: null }, { auto_raise_rule: { amount: 10 } }]) {
    for (const method of ['createTemplate', 'updateTemplate']) {
      const res = response()
      await controller[method]({ user: { id: 7 }, params: { id: 4 }, body }, res)
      assert.equal(res.statusCode, 403)
      assert.equal(res.body.code, 'FIELD_PERMISSION_DENIED')
    }
  }
  const res = response()
  await controller.setAsDefault({ user: { id: 7 }, params: { id: 4 } }, res)
  assert.equal(res.statusCode, 403)
})

test('工资模板列表/详情/默认及保存响应统一返回商品规则对象，保留关闭和零值', async () => {
  const raw = { id: 4, name: '模板甲', goods_commission_rule: JSON.stringify(rule({ enabled: false, fixed_amount: 0 })) }
  const repository = {
    async getTemplatesWithPagination() { return { records: [raw, { id: 5 }], pagination: { total: 2 } } },
    async getTemplateById() { return raw }, async getDefaultTemplate() { return raw },
    async createTemplate(data) { return { id: 6, data: { id: 6, ...data, goods_commission_rule: JSON.stringify(data.goods_commission_rule) } } },
    async updateTemplate(id, data) { return { affectedRows: 1, data: { id, ...data, goods_commission_rule: JSON.stringify(data.goods_commission_rule) } } }
  }
  const service = new Service({ repository })
  const list = await service.getTemplates({}, {})
  assert.equal(list.pagination.total, 2)
  assert.deepEqual(list.records[0].goods_commission_rule, rule({ enabled: false, fixed_amount: 0 }))
  assert.equal(list.records[1].goods_commission_rule, null)
  for (const result of [await service.getTemplateById('4'), await service.getDefaultTemplate(),
    (await service.createTemplate({ name: '新增', goods_commission_rule: rule({ enabled: false, fixed_amount: 0 }) })).data,
    (await service.updateTemplate('4', { goods_commission_rule: rule({ enabled: false, fixed_amount: 0 }) })).data]) {
    assert.deepEqual(result.goods_commission_rule, rule({ enabled: false, fixed_amount: 0 }))
  }
  assert.equal(typeof raw.goods_commission_rule, 'string')
})

test('商品规则请求独立校验完整对象、数值及精度，非法规则和额外字段不进入仓储', async () => {
  let writes = 0
  const service = new Service({ repository: { async createTemplate() { writes++; return {} }, async updateTemplate() { writes++; return {} } } })
  for (const value of [undefined, false, [], {}, JSON.stringify(rule()), rule({ enabled: 1 }), rule({ type: 'phone' }),
    rule({ fixed_amount: '2.5' }), rule({ percentage: '10' }), rule({ fixed_amount: true }), rule({ fixed_amount: Infinity }),
    rule({ fixed_amount: -1 }), rule({ fixed_amount: 1.001 }), rule({ fixed_amount: 100000000 }),
    rule({ percentage: -0.01 }), rule({ percentage: 100.01 }), rule({ percentage: 1.001 }), rule({ unexpected: 1 })]) {
    await assert.rejects(service.createTemplate({ name: '非法', goods_commission_rule: value }), { statusCode: 400 })
    await assert.rejects(service.updateTemplate('4', { goods_commission_rule: value }), { statusCode: 400 })
  }
  for (const value of [null, [], {}, { id: 2 }, { 'name = 0': 'x' }, { commission_detail: 'x' }]) {
    await assert.rejects(service.updateTemplate('4', value), { statusCode: 400 })
  }
  for (const id of ['4 OR 1', '1.1', false, 0]) await assert.rejects(service.updateTemplate(id, { name: '甲' }), { statusCode: 400 })
  assert.equal(writes, 0)
})

test('省略商品规则不覆盖已有配置，显式null才清除；原手机字段保持独立', async () => {
  const calls = []
  const service = new Service({ repository: { async updateTemplate(id, data) { calls.push({ id, data }); return { data } } } })
  await service.updateTemplate('4', { commission_new_fixed: 20, commission_percentage: 15 })
  await service.updateTemplate(4, { goods_commission_rule: null })
  await service.updateTemplate(4, { goods_commission_rule: rule({ type: 'percentage', percentage: 100, fixed_amount: 0 }) })
  assert.deepEqual(calls[0], { id: 4, data: { commission_new_fixed: 20, commission_percentage: 15 } })
  assert.deepEqual(calls[1].data, { goods_commission_rule: null })
  assert.equal(calls[2].data.goods_commission_rule.percentage, 100)
})

test('仓储参数化保存JSON；未升级只读返回空规则，显式写规则返回409且无DDL', async () => {
  let ready = true
  const statements = []
  const repository = new Repository({ columnExists: async () => ready })
  repository.getConnection = () => ({
    async query(sql, params) {
      statements.push({ sql, params })
      if (sql.startsWith('SELECT')) return [[{ id: 4, name: '原模板', goods_commission_rule: null }]]
      return [{ affectedRows: 1, insertId: 6 }]
    }
  })
  const service = new Service({ repository })
  const result = await service.createTemplate({ name: '模板甲', goods_commission_rule: rule() })
  assert.deepEqual(result.data.goods_commission_rule, rule())
  assert.match(statements[0].sql, /goods_commission_rule/)
  assert.equal(statements[0].params[1], JSON.stringify(rule()))
  await service.updateTemplate('4', { goods_commission_rule: rule({ type: 'percentage' }) })
  assert.deepEqual(statements[1].params, [JSON.stringify(rule({ type: 'percentage' })), 4])
  ready = false; statements.length = 0
  assert.equal((await service.getTemplateById(4)).goods_commission_rule, null)
  assert.match(statements[0].sql, /NULL AS goods_commission_rule/)
  await assert.rejects(service.updateTemplate(4, { goods_commission_rule: rule() }), { statusCode: 409, code: 'SALARY_GOODS_RULE_NOT_READY' })
  assert.equal(statements.length, 1)
  await service.updateTemplate(4, { name: '仅改名称' })
  assert.deepEqual(statements[1].params, ['仅改名称', 4])
  assert.ok(statements.every(({ sql }) => !/ALTER|CREATE TABLE|DROP/.test(sql)))
})

test('字段隐藏时列表/详情/保存嵌套响应全部遮蔽，null和关闭规则亦不可越权提交', async () => {
  let writes = 0
  const row = { id: 4, goods_commission_rule: rule() }
  const controller = new Controller({ masking: masking(['template.goods_commission_rule']), service: {
    async getTemplates() { return { records: [row], pagination: { total: 1 } } },
    async getTemplateById() { return row },
    async updateTemplate() { writes++; return { data: row } }
  } })
  const request = { user: { id: 7 }, params: { id: '4' }, query: {}, body: { name: '甲' } }
  const list = response(); await controller.getTemplates(request, list)
  assert.equal(list.body.data.records[0].goods_commission_rule, null)
  const detail = response(); await controller.getTemplateById(request, detail)
  assert.equal(detail.body.data.goods_commission_rule, null)
  for (const value of [null, rule({ enabled: false }), rule()]) {
    const res = response()
    await controller.updateTemplate({ ...request, body: { goods_commission_rule: value } }, res)
    assert.equal(res.statusCode, 403); assert.equal(res.body.code, 'FIELD_PERMISSION_DENIED')
  }
  assert.equal(writes, 0)
  const updated = response(); await controller.updateTemplate(request, updated)
  assert.equal(writes, 1); assert.equal(updated.body.data.data.goods_commission_rule, null)
  assert.deepEqual(row.goods_commission_rule, rule())
})

test('字段权限读取故障先拒绝写入；业务错误保留状态，内部故障不泄漏SQL', async () => {
  let writes = 0
  const req = { user: { id: 7 }, params: { id: '4' }, body: { goods_commission_rule: rule() } }
  const blocked = new Controller({ masking: { ...masking(), async getUserFieldPermissions() { throw new Error('permission unavailable') } },
    service: { async updateTemplate() { writes++ } } })
  const failed = response(); await blocked.updateTemplate(req, failed)
  assert.equal(failed.statusCode, 500); assert.equal(writes, 0)
  for (const status of [400, 404, 409, 500]) {
    const controller = new Controller({ masking: masking(), service: { async updateTemplate() {
      throw Object.assign(new Error(status === 500 ? 'SQL internal exception' : '业务冲突'), { statusCode: status, code: 'CONFLICT' })
    } } })
    const res = response(); await controller.updateTemplate(req, res)
    assert.equal(res.statusCode, status)
    assert.equal(res.body.message, status === 500 ? '服务器内部错误，请稍后重试' : '业务冲突')
  }
})

test('激活模板公共选项仍只投影原字段；规则管理路由保留统一动作鉴权', async () => {
  const repository = new Repository()
  repository.executeQuery = async sql => {
    assert.match(sql, /SELECT id, name, base_salary/)
    assert.doesNotMatch(sql, /goods_commission_rule|SELECT \*/)
    return [{ id: 4, name: '可选模板', base_salary: 2500 }]
  }
  assert.deepEqual(await repository.getActiveTemplates(), [{ id: 4, name: '可选模板', base_salary: 2500 }])
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/salary-templates.js'), 'utf8')
  assert.match(route, /router\.use\(unifiedAuth\)/)
  for (const [method, routePath, action] of [['get', '/', 'view'], ['get', '/:id', 'view'], ['post', '/', 'create'], ['put', '/:id', 'edit']]) {
    assert.ok(route.includes(`router.${method}('${routePath}', requirePermission('salary-templates:${action}')`))
  }
})
