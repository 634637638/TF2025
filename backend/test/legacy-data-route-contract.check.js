const test = require('node:test')
const assert = require('node:assert/strict')
const { execFile } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { promisify } = require('node:util')

const root = path.resolve(__dirname, '..', '..')
const execFileAsync = promisify(execFile)

test('遗留 /api/data 通用 CRUD 不再注册', () => {
  const routeIndex = fs.readFileSync(path.join(root, 'backend/src/routes/index.js'), 'utf8')
  const legacyRoutePath = path.join(root, 'backend/src/routes/data.js')

  assert.equal(fs.existsSync(legacyRoutePath), false)
  assert.doesNotMatch(routeIndex, /require\(['"]\.\/data['"]\)/)
  assert.doesNotMatch(routeIndex, /router\.use\(['"]\/data['"]/)
  assert.match(routeIndex, /router\.use\(['"]\/data-check['"]/)
  assert.match(routeIndex, /router\.use\(['"]\/data-import['"]/)
})

test('data-check routes directly bind controller methods and preserve inherited auth plus per-operation permissions', () => {
  const route = fs.readFileSync(path.join(root, 'backend/src/routes/data-check.js'), 'utf8')
  const methods = [
    'checkBrands', 'checkModels', 'checkColors', 'checkMemories', 'checkSuppliers', 'checkStores',
    'checkCustomers', 'checkUsers', 'checkAll', 'mergeDuplicates', 'batchMergeMultipleGroups',
    'batchDeleteDuplicates', 'editData', 'deleteData', 'getStatistics', 'cleanupData', 'getAllData'
  ]

  assert.match(route, /router\.use\(unifiedAuth\)/)
  for (const method of methods) {
    assert.match(route, new RegExp(`dataCheckController\\.${method}\\.bind\\(dataCheckController\\)`))
  }
  assert.match(route, /requirePermission\('data-check:view'\)/)
  assert.match(route, /requirePermission\('data-check:edit'\)/)
  assert.match(route, /requirePermission\('data-check:delete'\)/)
  assert.doesNotMatch(route, /router\.(?:get|post|put|patch|delete)\([^\n]*\(req,\s*res\)\s*=>/)
})

test('遗留 /api/data 返回 404，数据检查和导入接口仍正常挂载', async () => {
  const childScript = String.raw`
    const express = require('./backend/node_modules/express')
    const http = require('node:http')
    const routes = require('./backend/src/routes')
    const app = express()
    app.use('/api', routes)
    app.use((req, res) => res.status(404).json({ success: false, message: '接口不存在' }))

    const request = (port, requestPath) => new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port, path: requestPath }, response => {
        let body = ''
        response.on('data', chunk => { body += chunk })
        response.on('end', () => resolve({ body, status: response.statusCode }))
      }).on('error', reject)
    })

    const server = app.listen(0, '127.0.0.1', async () => {
      try {
        const port = server.address().port
        const results = await Promise.all([
          request(port, '/api/data'),
          request(port, '/api/data-check/check/brands'),
          request(port, '/api/data-import/history')
        ])
        process.stdout.write('HTTP_CONTRACT:' + JSON.stringify(results) + '\n')
        server.close(() => process.exit(0))
      } catch (error) {
        console.error(error)
        server.close(() => process.exit(1))
      }
    })
  `

  const { stdout } = await execFileAsync(process.execPath, ['-e', childScript], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'test' },
    timeout: 15000,
    maxBuffer: 1024 * 1024
  })
  const serialized = stdout.match(/HTTP_CONTRACT:(\[[^\n]+\])/)?.[1]
  assert.ok(serialized, '未获得 HTTP 契约测试结果')

  const [legacyData, dataCheck, dataImport] = JSON.parse(serialized)
  assert.equal(legacyData.status, 404)
  assert.match(legacyData.body, /接口不存在/)
  assert.equal(dataCheck.status, 401)
  assert.equal(dataImport.status, 401)
  assert.doesNotMatch(dataCheck.body, /接口不存在/)
  assert.doesNotMatch(dataImport.body, /接口不存在/)
})
