const test = require('node:test')
const assert = require('node:assert/strict')
const { assertNotLoggedOutOnAllDevices } = require('../src/middleware/jwt-blacklist')

function databaseReturning(loggedOutAt) {
  return {
    async execute(sql, params) {
      assert.match(sql, /FROM jwt_blacklist/)
      assert.match(sql, /reason = 'logout_all'/)
      assert.deepEqual(params, [42])
      return [[{ logged_out_at: loggedOutAt }]]
    }
  }
}

test('all-device logout rejects access and refresh tokens issued before the cutoff', async () => {
  const db = databaseReturning(1_800_000_000)

  await assert.rejects(
    assertNotLoggedOutOnAllDevices({ sub: 42, iat: 1_799_999_999 }, db),
    /Token已被吊销/
  )
  await assert.rejects(
    assertNotLoggedOutOnAllDevices({ sub: 42, iat: 1_800_000_000 }, db),
    /Token已被吊销/
  )
})

test('tokens issued after all-device logout remain valid', async () => {
  await assert.doesNotReject(
    assertNotLoggedOutOnAllDevices(
      { sub: 42, iat: 1_800_000_001 },
      databaseReturning(1_800_000_000)
    )
  )
})

test('session state lookup failures fail closed', async () => {
  const db = {
    async execute() {
      throw new Error('database unavailable')
    }
  }

  await assert.rejects(
    assertNotLoggedOutOnAllDevices({ sub: 42, iat: 1_800_000_001 }, db),
    /无法验证用户会话状态/
  )
})
