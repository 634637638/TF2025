'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const express = require('express')
const accessoryRoutes = require('../src/routes/accessories')
const salesRoutes = require('../src/routes/sales')

test('配件不再暴露脱离共同订单的销售和赠送写入口', () => {
  for (const pathname of ['/sell', '/gift']) {
    assert.equal(accessoryRoutes.stack.some(layer => layer.route?.path === pathname && layer.route.methods.post), false,
      `${pathname}会绕开整单收款、积分及售后凭据`)
  }
  assert.ok(salesRoutes.stack.some(layer => layer.route?.path === '/checkout' && layer.route.methods.post))
  assert.ok(accessoryRoutes.stack.some(layer => layer.route?.path === '/stock-in' && layer.route.methods.post))
  assert.ok(accessoryRoutes.stack.some(layer => layer.route?.path === '/transfer' && layer.route.methods.post))
})

test('旧配件销售路径真实HTTP返回404，共同结算仍经过统一认证', async t => {
  const app = express()
  app.use('/api/accessories', accessoryRoutes)
  app.use('/api/sales', salesRoutes)
  app.use((_req, res) => res.status(404).json({ success: false }))
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())))
  const post = pathname => new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port: server.address().port, path: pathname, method: 'POST', agent: false }, response => {
      response.resume()
      response.once('end', () => resolve(response.statusCode))
    })
    request.once('error', reject)
    request.end()
  })
  assert.deepEqual(await Promise.all(['/api/accessories/sell', '/api/accessories/gift', '/api/sales/checkout'].map(post)), [404, 404, 401])
})
