'use strict'

const path = require('node:path')

const isMigrationEntrypoint = (entrypoint) => {
  if (!entrypoint) return false
  const scriptsRoot = path.resolve(__dirname, '../../scripts')
  const resolvedEntrypoint = path.resolve(entrypoint)
  return resolvedEntrypoint.startsWith(`${scriptsRoot}${path.sep}`) &&
    /^migrate-[a-z0-9-]+\.js$/i.test(path.basename(resolvedEntrypoint))
}

const isSchemaChangeAllowed = ({ nodeEnv, migrationMode, entrypoint }) => (
  nodeEnv !== 'production' || (
    migrationMode === 'true' && isMigrationEntrypoint(entrypoint)
  )
)

const schemaChangesAllowed = () => isSchemaChangeAllowed({
  nodeEnv: process.env.NODE_ENV,
  migrationMode: process.env.SCHEMA_MIGRATION_MODE,
  entrypoint: process.argv[1]
})

module.exports = { isMigrationEntrypoint, isSchemaChangeAllowed, schemaChangesAllowed }
