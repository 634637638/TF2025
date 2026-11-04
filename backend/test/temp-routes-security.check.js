const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/index.js'), 'utf8')

test('开发临时接口保持双重环境门控并记录启用状态', () => {
  assert.match(
    routeSource,
    /process\.env\.NODE_ENV === 'development' && process\.env\.ENABLE_DEV_TEMP_ROUTES === 'true'/
  )
  assert.match(routeSource, /log\.warn\('开发临时接口已启用'/)
})

test('开发临时接口要求管理员权限并记录每次访问', () => {
  assert.match(routeSource, /const auditDevTempRoute = action =>/)
  assert.match(routeSource, /request_id: req\.requestId \|\| null/)
  assert.match(
    routeSource,
    /router\.post\('\/temp\/make-admin', unifiedAuth, requirePermission\('permissions:admin'\), auditDevTempRoute\('make_admin'\)/
  )
  assert.match(
    routeSource,
    /router\.post\('\/temp\/migrate-home-sections', unifiedAuth, requirePermission\('permissions:admin'\), auditDevTempRoute\('migrate_home_sections'\)/
  )
})

test('开发迁移接口不向响应回显内部错误', () => {
  assert.doesNotMatch(routeSource, /message: error\.message/)
  assert.match(routeSource, /message: '迁移失败'/)
})
