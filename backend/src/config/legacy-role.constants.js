'use strict'

const LEGACY_USER_ROLE_CODES = Object.freeze(['employee', 'admin', 'manager'])
const LEGACY_USER_ROLE_SQL_LIST = LEGACY_USER_ROLE_CODES.map(roleCode => `'${roleCode}'`).join(', ')

module.exports = { LEGACY_USER_ROLE_CODES, LEGACY_USER_ROLE_SQL_LIST }
