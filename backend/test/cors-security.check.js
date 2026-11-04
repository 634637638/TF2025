'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const source = fs.readFileSync(path.resolve(__dirname, '../src/middleware/cors.js'), 'utf8')

test('生产 CORS 拒绝通配来源与凭据组合并暴露 request ID', () => {
  assert.match(source, /isProduction && allowedOrigins\.includes\('\*'\)/)
  assert.match(source, /生产环境 ALLOWED_ORIGINS 不能包含 \*/)
  assert.match(source, /credentials: true/)
  assert.match(source, /'X-Request-ID'/)
})

test('无 Origin 请求保留服务端调用能力且认证仍由路由负责', () => {
  assert.match(source, /if \(!origin\) \{[\s\S]*callback\(null, true\)/)
  assert.doesNotMatch(source, /credentials:\s*true[\s\S]*origin:\s*['"]\*['"]/)
})
