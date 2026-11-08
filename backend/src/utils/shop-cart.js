'use strict'

const normalizeCartId = value => {
  const cartId = String(value || '').trim()
  return /^cart_[a-f0-9]{32}$/.test(cartId) ? cartId : ''
}

module.exports = { normalizeCartId }
