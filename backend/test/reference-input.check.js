const test = require('node:test')
const assert = require('node:assert/strict')
const { parseReferenceInput, parseReferenceId, parseReferenceOrder } = require('../src/utils/reference-options')

const invalidIntegers = ['12abc', '12元', '1e3', '0x10', '1.1', ' ', '12\n', true, false, [], {}, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]
const response = () => ({ status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })

test('公共基础资料转换合法整数并保留零，拒绝非法状态、排序、ID与文本', () => {
  assert.deepEqual(parseReferenceInput({ name: ' 中文 / Model ', status: '0', sort_order: '0' }), { name: ' 中文 / Model ', status: 0, sort_order: 0 })
  assert.deepEqual(parseReferenceInput({}), {})
  assert.equal(parseReferenceId('12'), 12)
  for (const value of [...invalidIntegers, 0, -1, null, '']) assert.throws(() => parseReferenceId(value), { statusCode: 400 })
  for (const value of [...invalidIntegers, -1, null, '', 2147483648]) assert.throws(() => parseReferenceInput({ sort_order: value }), { statusCode: 400 })
  for (const value of [...invalidIntegers, -1, 2, null, '']) assert.throws(() => parseReferenceInput({ status: value }), { statusCode: 400 })
  for (const value of ['', ' ', 'a\nb', 'a\u0000b', '名'.repeat(101), {}, [], true, null]) assert.throws(() => parseReferenceInput({ name: value }), { statusCode: 400 })
  assert.deepEqual(parseReferenceOrder([{ id: '1', sort_order: '0' }]), [{ id: 1, sort_order: 0 }])
  for (const items of [null, [], {}, [{ id: 1 }], [{ sort_order: 1 }], [{ id: 1, sort_order: 0 }, { id: '1', sort_order: 1 }]]) assert.throws(() => parseReferenceOrder(items), { statusCode: 400 })
})

for (const domain of ['color', 'memory', 'model', 'store', 'supplier', 'brand']) {
  test(`${domain} 非法新增、编辑、排序及ID均返回400，零仓储/连接/缓存副作用`, async t => {
    t.mock.method(require('../src/utils/log'), 'error', () => {})
    let sideEffects = 0
    const repository = new Proxy({}, { get: () => async () => { sideEffects++; assert.fail('非法输入不应进入仓储') } })
    const options = { repository, connected: () => true, databaseConnected: () => true, isDatabaseConnected: () => true, invalidateCache: () => { sideEffects++ } }
    const Controller = require(`../src/controllers/${domain}.controller`)
    let controller
    if (domain === 'brand') {
      const Service = require('../src/services/brand-management.service')
      controller = new Controller({ service: new Service(options), clearCache: () => { sideEffects++ } })
    } else controller = new Controller(options)
    const validBody = domain === 'memory' ? { size: '128GB' } : domain === 'model' ? { name: 'Model', brand_id: 1 } : { name: '名称' }
    const labelField = domain === 'memory' ? 'size' : 'name'
    for (const body of [null, [], { ...validBody, [labelField]: ' ' }, { ...validBody, [labelField]: ['名称'] }, ...[...invalidIntegers, null, '', -1].map(sort_order => ({ ...validBody, sort_order })), { ...validBody, status: 2 }]) {
      for (const method of ['create', 'update']) {
        const res = response()
        await controller[method]({ body, params: { id: '1' }, user: { id: 1 } }, res)
        assert.equal(res.statusCode, 400, `${method}: ${JSON.stringify(body)}`)
      }
    }
    for (const invalidItem of [{ id: 2 }, { sort_order: 2 }, { id: '2abc', sort_order: 1 }, { id: 2, sort_order: 1.1 }, null]) {
      const res = response()
      await controller.reorder({ body: { items: [{ id: 1, sort_order: 0 }, invalidItem] } }, res)
      assert.equal(res.statusCode, 400)
    }
    for (const id of [...invalidIntegers, 0, null, '']) {
      const res = response()
      await controller.update({ params: { id }, body: validBody, user: { id: 1 } }, res)
      assert.equal(res.statusCode, 400)
    }
    assert.equal(sideEffects, 0)
  })
}
