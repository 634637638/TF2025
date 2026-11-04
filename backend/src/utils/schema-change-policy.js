'use strict'

const schemaChangesAllowed = () => (
  process.env.NODE_ENV !== 'production' || process.env.SCHEMA_MIGRATION_MODE === 'true'
)

module.exports = { schemaChangesAllowed }
