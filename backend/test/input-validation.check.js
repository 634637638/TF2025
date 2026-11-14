const test = require('node:test')
const assert = require('node:assert/strict')
const { validationRules: rules, validateBody, validateQuery, validateParams, validate, parseInput } = require('../src/middleware/validation')
const { normalizePhone, isMobilePhone } = require('../src/utils/input-values')

test('service 公共解析保留缺省、未知字段和原文，非法对象及字段原子拒绝', () => {
  const schema = { amount: { type: 'money', required: true, min: 0 }, name: { type: 'personName', maxLength: 50 } }
  for (const value of [null, undefined, [], true, 'input']) assert.throws(() => parseInput(value, schema), { statusCode: 400 })
  const body = { amount: '12.02', name: "阿不都·O'Connor", protected_field: false }
  assert.deepEqual(parseInput(body, schema), { ...body, amount: 12.02 })
  assert.equal(body.amount, '12.02')
  assert.deepEqual(parseInput({ amount: '0' }, schema), { amount: 0 })
  assert.throws(() => parseInput({}, schema), { statusCode: 400 })
  assert.deepEqual(parseInput({}, schema, { partial: true }), {})
  assert.deepEqual(parseInput({ optional_id: null }, { optional_id: { type: 'id' } }), { optional_id: null })
  for (const amount of ['12abc', '1e3', '0x10', '1.001', false, [], {}, NaN, Infinity, -1]) {
    assert.throws(() => parseInput({ amount }, schema), { statusCode: 400, code: 'VALIDATION_ERROR' })
  }
  for (const name of ['123!', '张\n三', '张'.repeat(51), false, [], {}]) {
    assert.throws(() => parseInput({ amount: 0, name }, schema), { statusCode: 400 })
  }
  assert.equal(rules.money('').value, null)
  assert.equal(rules.money('1.001').valid, false)
  assert.equal(rules.money('-1.01', { min: -2 }).value, -1.01)
  assert.equal(rules.personName('', { required: true }).valid, false)
  for (const value of [true, 1, '1']) assert.equal(rules.boolean(value).value, true)
  for (const value of [false, 0, '0']) assert.equal(rules.boolean(value).value, false)
  for (const value of ['true', 'false', [], {}, 2, '1abc']) assert.equal(rules.boolean(value).valid, false)
})

test('公共数字完整格式、类型、安全整数及空值', () => {
  for (const value of ['12abc', '12元', '1e3', '0x10', 'NaN', 'Infinity', '12\n', ' ', true, false, [], [12], {}, Infinity, NaN]) {
    assert.equal(rules.number(value).valid, false, String(value))
  }
  for (const value of [0, -2, '12.02', '.02', '-0.02']) assert.equal(rules.number(value).valid, true)
  assert.deepEqual(rules.number(''), { valid: true, value: null })
  assert.equal(rules.number('', { required: true }).valid, false)
  assert.equal(rules.number('9007199254740992', { integer: true }).valid, false)
  assert.equal(rules.number('12.0', { integer: true }).valid, false)
  assert.equal(rules.number('11', { max: 10 }).valid, false)
  assert.equal(rules.id(undefined, { required: false }).valid, true)
  assert.equal(rules.id('1abc').valid, false)
  assert.equal(rules.id('1').value, 1)
})

test('手机号只允许明示格式，非法字符、超长与类型不能洗白', () => {
  for (const value of ['13800138000', '+86 138-0013-8000', '0086 13800138000', '8613800138000']) {
    assert.equal(normalizePhone(value), '13800138000')
    assert.equal(rules.phone(value).valid, true)
  }
  for (const value of ['138a00138000', '138中00138000', '138001380001', '13800138000\n', '１３８００１３８０００', 13800138000, ['13800138000']]) {
    assert.equal(isMobilePhone(value), false)
    assert.equal(rules.phone(value).valid, false)
  }
})

test('单行文本、必填空白、合法标点与密码原值', () => {
  for (const value of ['   ', '\n', {}, [], true]) assert.equal(rules.string(value, { required: true }).valid, false)
  for (const value of ['张\n三', 'a\tb', 'a\u0000b']) assert.equal(rules.string(value).valid, false)
  assert.equal(rules.string('备注\n第二行', { multiline: true }).valid, true)
  assert.equal(rules.string('a\u0000b', { multiline: true }).valid, false)
  const password = "  A<&'\"123  "
  assert.equal(rules.string(password, { required: true }).value, password)
  assert.equal(rules.string("阿不都·O'Connor").value, "阿不都·O'Connor")
  assert.equal(rules.string('太长', { maxLength: 1 }).valid, false)
})

const response = () => ({ status(code) { this.code = code; return this }, json(data) { this.data = data; return this } })
for (const [part, factory] of [['body', validateBody], ['query', validateQuery], ['params', validateParams]]) {
  test(`${part} 非法内容在 next 前拒绝；正常值转换且保留空值`, () => {
    const req = { [part]: { quantity: '1e3' } }, res = response()
    let calls = 0
    const middleware = factory({ quantity: { type: 'number' }, optional: { type: 'number' } })
    middleware(req, res, () => { calls++ })
    assert.equal(calls, 0)
    assert.equal(res.code, 400)
    assert.equal(req[part].quantity, '1e3')
    req[part].quantity = '12.02'
    middleware(req, res, () => { calls++ })
    assert.equal(calls, 1)
    assert.deepEqual(req[part], { quantity: 12.02, optional: null })
  })
}
test('组合中间件原子应用已校验值，嵌套对象和数组拒绝非法字段', () => {
  const req = { body: { amount: '12.02' }, query: { page: '1abc' } }, res = response()
  validate({ body: { amount: { type: 'number' } }, query: { page: { type: 'id' } } })(req, res, () => assert.fail('非法请求不能继续'))
  assert.equal(req.body.amount, '12.02')
  assert.equal(res.code, 400)
  assert.equal(rules.object({ nested: { amount: '1e3' } }, { nested: { type: { amount: { type: 'number' } } } }).valid, false)
  assert.equal(rules.array(['12', '12abc'], { itemType: 'number' }).valid, false)
})

test('H5 登录注册绕过页面的非法输入不进入业务服务，合法密码原样传递', async () => {
  const Controller = require('../src/controllers/shop-public-auth.controller')
  const calls = []
  const controller = new Controller({ service: {
    async registerCustomer(input) { calls.push(input); return { token: 'mock-session', user: {} } },
    async loginCustomer(input) { calls.push(input); return { token: 'mock-session', user: {} } }
  } })
  for (const fields of [{ phone: ['13800138000'] }, { phone: 13800138000 }, { phone: '138a00138000' }, { phone: '138001380001' }, { password: ['abcdef'] }]) {
    for (const method of ['register', 'login']) {
      const res = response()
      await controller[method]({ body: { name: '张三', phone: '13800138000', password: 'abcdef', ...fields } }, res)
      assert.equal(res.code, 400)
    }
  }
  for (const name of ['张\n三', '张'.repeat(51), ['张三'], '  ', '123!']) {
    const res = response()
    await controller.register({ body: { name, phone: '13800138000', password: 'abcdef' } }, res)
    assert.equal(res.code, 400)
  }
  assert.equal(calls.length, 0)
  const password = "  A<&'123  "
  await controller.register({ body: { name: "阿不都·O'Connor", phone: '+86 138-0013-8000', password } }, response())
  await controller.login({ body: { phone: '0086 13800138000', password } }, response())
  assert.deepEqual(calls, [{ name: "阿不都·O'Connor", phone: '13800138000', password }, { phone: '13800138000', password }])
})

test('H5 手机号查单拒绝混输与超长身份，不查询订单', async () => {
  const Controller = require('../src/controllers/shop-public-catalog.controller')
  const controller = new Controller({ service: { async getOrdersByPhone() { assert.fail('非法身份不能查询') } } })
  for (const phone of ['138a00138000', '138001380001', ['13800138000'], '13800138000\n']) {
    const res = response()
    await controller.getOrdersByPhone({ params: { customer_phone: phone }, query: { customer_name: '张三' } }, res)
    assert.equal(res.code, 400)
  }
})

test('客户资料非法姓名、手机号、ID、余额在写入前拒绝；积分流程不被调用', async () => {
  const Service = require('../src/services/customer-management.service')
  let writes = 0
  const service = new Service({ repository: {
    async findCustomerById() { return { id: 1, name: '张三', phone: '13800138000' } },
    async findByPhone() { return null },
    async createCustomerProfile() { writes++ },
    async update() { writes++ }
  } })
  for (const body of [{ name: '张\n三' }, { name: '张'.repeat(51) }, { name: '   ' }, { phone: '' }, { phone: 13800138000 }, { phone: '138a00138000' }, { balance: '12abc' }, { balance: '1e3' }, { balance: false }, { balance: Infinity }, { balance: '1.234' }]) {
    await assert.rejects(service.update({ id: '1' }, body), { statusCode: 400 })
  }
  for (const body of [{ name: '张\n三', phone: '13800138000' }, { name: '张三', phone: '138001380001' }]) await assert.rejects(service.create(body), { statusCode: 400 })
  await assert.rejects(service.update({ id: '1abc' }, {}), { statusCode: 400 })
  assert.equal(writes, 0)
})


test('安全工具同名金额入口也拒绝部分解析与类型伪装', () => {
  const { isValidAmount } = require('../src/utils/security-enhanced')
  for (const value of ['12abc', '12元', '1e3', '0x10', 'Infinity', '12\n', [], true, Infinity, NaN]) assert.equal(isValidAmount(value), false)
  for (const value of [0, '12.02', '999999999.99']) assert.equal(isValidAmount(value), true)
})
