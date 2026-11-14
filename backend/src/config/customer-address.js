'use strict'

const contract = require('../contracts/regions.openapi.json')
const LEVELS = Object.keys(contract.components.schemas.RegionSelection.properties)
const NEW_LEVELS = LEVELS.slice(2)
const COLUMNS = Object.freeze({
  district: 'VARCHAR(100) NULL', town: 'VARCHAR(100) NULL', village: 'VARCHAR(100) NULL',
  region_version: 'VARCHAR(10) NULL', legacy_address: 'VARCHAR(255) NULL'
})

module.exports = { LEVELS, NEW_LEVELS, COLUMNS }
