'use strict'

/** @typedef {{ id: number, username?: string, name?: string }} Actor */

function getActorId(actor) {
  const value = actor?.id ?? actor?.userId ?? actor?.sub
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

module.exports = { getActorId }
