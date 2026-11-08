'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { withConnection } = require('../src/core/db/connection')

test('withConnection releases the acquired connection after successful work', async () => {
  const events = []
  const connection = { release() { events.push('release') } }
  const result = await withConnection(async () => ({
    async getConnection() { events.push('acquire'); return connection }
  }), async received => {
    assert.equal(received, connection)
    events.push('work')
    return 'done'
  })

  assert.equal(result, 'done')
  assert.deepEqual(events, ['acquire', 'work', 'release'])
})

test('withConnection releases the acquired connection when work fails', async () => {
  const events = []
  const failure = new Error('query failed')
  const connection = { release() { events.push('release') } }
  await assert.rejects(withConnection({
    async getConnection() { return connection }
  }, async () => {
    events.push('work')
    throw failure
  }), error => error === failure)

  assert.deepEqual(events, ['work', 'release'])
})
