const test = require('node:test')
const assert = require('node:assert/strict')
const { parseDeprecatedLogLine } = require('../scripts/audit-deprecated-routes')

test('deprecated route audit extracts migration ID without exposing request details', () => {
  const line = JSON.stringify({
    level: 'warn',
    message: `兼容接口仍被调用 ${JSON.stringify({
      migration_id: 'legacy-to-canonical',
      method: 'GET',
      path: '/api/legacy?private=value',
      user_id: 42
    })}`
  })

  assert.deepEqual(parseDeprecatedLogLine(line), { migration_id: 'legacy-to-canonical' })
})

test('deprecated route audit ignores unrelated or malformed log lines', () => {
  assert.equal(parseDeprecatedLogLine('{not-json'), null)
  assert.equal(parseDeprecatedLogLine(JSON.stringify({ level: 'info', message: 'normal request' })), null)
  assert.equal(parseDeprecatedLogLine(JSON.stringify({
    level: 'warn',
    message: '兼容接口仍被调用 {invalid-json}'
  })), null)
  assert.equal(parseDeprecatedLogLine(JSON.stringify({
    level: 'warn',
    message: `兼容接口仍被调用 ${JSON.stringify({ migration_id: 'example-migration' })}`
  })), null)
})
