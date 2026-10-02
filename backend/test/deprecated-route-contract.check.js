const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const deprecatedRoute = require('../src/middleware/deprecated-route')

test('deprecated route middleware exposes migration headers and continues', () => {
  const headers = {}
  let nextCalled = false
  deprecatedRoute({
    replacement: '/api/example/canonical',
    migrationId: 'example-migration'
  })({
    method: 'GET',
    originalUrl: '/api/example/legacy',
    user: { id: 7 }
  }, {
    setHeader(name, value) {
      headers[name] = value
    }
  }, () => {
    nextCalled = true
  })

  assert.equal(headers.Deprecation, 'true')
  assert.equal(headers['X-Deprecated-Endpoint'], 'true')
  assert.equal(headers.Link, '</api/example/canonical>; rel="successor-version"')
  assert.equal(nextCalled, true)
})

test('弃用路由的替代链接会使用实际路径参数', () => {
  const headers = {}
  deprecatedRoute({ replacement: '/api/models?all=true&brand_id=:brandId', migrationId: 'brand-models-migration' })({
    method: 'GET',
    originalUrl: '/api/brands/品牌一/models',
    params: { brandId: '品牌一' },
    user: { id: 7 }
  }, {
    setHeader(name, value) {
      headers[name] = value
    }
  }, () => {})

  assert.equal(headers.Link, '</api/models?all=true&brand_id=%E5%93%81%E7%89%8C%E4%B8%80>; rel="successor-version"')
})

test('本人考勤和工资入口共享主列表入口，旧地址只保留兼容观察期', () => {
  const root = path.resolve(__dirname, '..', '..')
  const attendanceRoute = fs.readFileSync(path.join(root, 'backend/src/routes/attendance.js'), 'utf8')
  const salaryRoute = fs.readFileSync(path.join(root, 'backend/src/routes/salary-records.js'), 'utf8')
  const attendanceApi = fs.readFileSync(path.join(root, 'frontend/src/api/attendance.ts'), 'utf8')
  const salaryApi = fs.readFileSync(path.join(root, 'frontend/src/api/salary.ts'), 'utf8')

  assert.match(attendanceRoute, /migrationId:\s*'attendance-my-to-list'/)
  assert.match(salaryRoute, /migrationId:\s*'salary-records-my-to-list'/)
  assert.match(salaryRoute, /requireAnyPermission\(\['salary-records:view',\s*'salary-records:view:own'\]\)/)
  assert.match(attendanceApi, /getMyAttendanceRecords[\s\S]*unifiedApi\.get<AttendanceListResult>\('\/attendance'/)
  assert.match(salaryApi, /getMySalaryRecords[\s\S]*unifiedApi\.get\('\/salary-records'/)
  assert.doesNotMatch(attendanceApi, /unifiedApi\.get<AttendanceListResult>\('\/attendance\/my'/)
  assert.doesNotMatch(salaryApi, /unifiedApi\.get\('\/salary-records\/my'/)
})

test('历史库存占位入口统一进入弃用观察期', () => {
  const root = path.resolve(__dirname, '..', '..')
  const inventoryRoute = fs.readFileSync(path.join(root, 'backend/src/routes/inventory.js'), 'utf8')
  for (const migrationId of [
    'inventory-movements-unimplemented',
    'inventory-item-stock-in-to-stock-in',
    'inventory-item-stock-out-unimplemented',
    'inventory-item-reserve-unimplemented',
    'inventory-item-unreserve-unimplemented',
    'inventory-item-adjust-unimplemented',
    'inventory-stock-in-to-stock-in'
  ]) {
    assert.match(inventoryRoute, new RegExp(`migrationId: '${migrationId}'`))
  }
})
