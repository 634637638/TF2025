const test = require('node:test')
const assert = require('node:assert/strict')
const { parseDeprecatedLogLine, parseCompatibilityLogLine, summarizeLogFiles } = require('../scripts/audit-deprecated-routes')

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

test('compatibility route audit extracts compatibility IDs from production info logs', () => {
  const line = JSON.stringify({
    level: 'info',
    message: `兼容接口访问 ${JSON.stringify({
      compatibility_id: 'legacy-reference-options',
      method: 'GET',
      path: '/api/shop/base-data/models',
      user_id: 42
    })}`
  })

  assert.deepEqual(parseCompatibilityLogLine(line), { compatibility_id: 'legacy-reference-options' })
  assert.equal(parseCompatibilityLogLine(JSON.stringify({ level: 'debug', message: '兼容接口访问 {}' })), null)
})

test('combined audit summarizes deprecated and compatibility events separately', () => {
  const files = ['/logs/combined-2026-10-01.log']
  const originalReadFileSync = require('node:fs').readFileSync
  require('node:fs').readFileSync = () => [
    JSON.stringify({ level: 'warn', message: `兼容接口仍被调用 ${JSON.stringify({ migration_id: 'old-route' })}` }),
    JSON.stringify({ level: 'info', message: `兼容接口访问 ${JSON.stringify({ compatibility_id: 'still-supported' })}` })
  ].join('\n')
  try {
    const summary = summarizeLogFiles(files)
    assert.deepEqual(summary.counts, [['old-route', 1]])
    assert.deepEqual(summary.compatibilityCounts, [['still-supported', 1]])
  } finally {
    require('node:fs').readFileSync = originalReadFileSync
  }
})
