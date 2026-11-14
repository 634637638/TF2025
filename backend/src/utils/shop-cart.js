'use strict'

const { parseInput } = require('../middleware/validation')

const normalizeCartId = value => {
  const cartId = typeof value === 'string' ? value.trim() : ''
  return /^cart_[a-f0-9]{32}$/.test(cartId) ? cartId : ''
}

function parseCartItemInput(cartId, id, quantity) {
  const normalizedCartId = normalizeCartId(cartId)
  if (!normalizedCartId) throw Object.assign(new Error('购物车标识无效'), { statusCode: 400, code: 'VALIDATION_ERROR' })
  return {
    cartId: normalizedCartId,
    ...parseInput({ id, quantity }, {
      id: { type: 'id', required: true, label: '购物车商品ID' },
      quantity: { type: 'number', integer: true, required: true, min: 1, max: 1, label: '商品数量' }
    })
  }
}

module.exports = { normalizeCartId, parseCartItemInput }
