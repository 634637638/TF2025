'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { getActorId } = require('../src/types/actor')
const BaseService = require('../src/core/base/base.service')

test('actor identity resolves supported authenticated user identifiers to one positive safe integer', () => {
  assert.equal(getActorId({ id: 7, userId: 8, sub: 9 }), 7)
  assert.equal(getActorId({ userId: '8' }), 8)
  assert.equal(getActorId({ sub: '9' }), 9)
  assert.equal(getActorId({ id: 0 }), null)
  assert.equal(getActorId({ id: Number.MAX_SAFE_INTEGER + 1 }), null)
  assert.equal(getActorId(null), null)
})

test('base service requires a valid actor and creates standard service errors', () => {
  const service = new BaseService()
  assert.equal(service.getActorId({ userId: 7 }), 7)
  assert.throws(() => service.getActorId({}), error => error.statusCode === 401 && error.code === 'INVALID_ACTOR')
  const error = service.createError('invalid input', 400, 'BAD_REQUEST')
  assert.equal(error.message, 'invalid input')
  assert.equal(error.statusCode, 400)
  assert.equal(error.code, 'BAD_REQUEST')
})
