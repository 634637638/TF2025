'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const { request } = require('node:http')
const router = require('../src/routes/regions')
const contract = require('../src/contracts/regions.openapi.json')
const RegionService = require('../src/services/region.service')

function validate(value, schema) {
  if (schema.$ref) return validate(value, contract.components.schemas[schema.$ref.split('/').at(-1)])
  if (schema.const !== undefined) assert.equal(value, schema.const)
  if (schema.type === 'object') {
    assert.ok(value && typeof value === 'object' && !Array.isArray(value))
    for (const key of schema.required || []) assert.ok(Object.hasOwn(value, key), `缺少 ${key}`)
    for (const [key, entry] of Object.entries(value)) {
      if (schema.additionalProperties === false) assert.ok(Object.hasOwn(schema.properties, key), `额外字段 ${key}`)
      if (schema.properties[key]) validate(entry, schema.properties[key])
    }
  } else if (schema.type === 'array') {
    assert.ok(Array.isArray(value)); value.forEach(item => validate(item, schema.items))
  } else {
    assert.equal(typeof value, schema.type)
    if (schema.pattern) assert.match(value, new RegExp(schema.pattern))
    if (schema.maxLength) assert.ok(value.length <= schema.maxLength)
    if (schema.minLength) assert.ok(value.length >= schema.minLength)
    if (schema.format === 'date-time' || schema.format === 'date') assert.ok(Number.isFinite(Date.parse(value)))
  }
}

test('地区真实HTTP响应符合唯一OpenAPI：五级、参数错误、未登录与覆盖边界', async t => {
  const layer = router.stack.find(item => item.route).route.stack[0]
  t.mock.method(layer, 'handle', (req, res, next) => req.headers['x-test-login'] === '1' ? next() : res.status(401).json({ success: false, message: '请登录' }))
  const app = express(); app.use('/api/regions', router)
  const server = await new Promise(resolve => { const host = app.listen(0, '127.0.0.1', () => resolve(host)) })
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())))
  const get = (query = '', login = true) => new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: server.address().port, path: `/api/regions${query}`, agent: false,
      headers: { 'x-test-login': login ? '1' : '0' } }, res => {
      let text = ''; res.on('data', chunk => { text += chunk }); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) }))
    }); req.on('error', reject); req.end()
  })
  const cases = [['', true, 200], ['?parent=11', true, 200], ['?parent=1101', true, 200],
    ['?parent=110101', true, 200], ['?parent=110101001', true, 200], ['?parent=81', true, 404],
    ['?parent=110199', true, 404], ['?parent=../', true, 400], ['?parent=11&parent=12', true, 400], ['', false, 401]]
  for (const [query, login, status] of cases) {
    const actual = await get(query, login)
    assert.equal(actual.status, status)
    validate(actual.body, contract.paths['/regions'].get.responses[status].content['application/json'].schema)
  }
  t.mock.method(RegionService.prototype, 'children', async () => { throw new Error('内部路径不能外露') })
  const unavailable = await get()
  assert.equal(unavailable.status, 500)
  validate(unavailable.body, contract.components.schemas.ErrorResponse)
  assert.equal(JSON.stringify(unavailable.body).includes('内部路径'), false)
})
