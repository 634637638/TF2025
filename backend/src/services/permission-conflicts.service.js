'use strict'

const { getDatabase } = require('../config/database')
const { hasColumn } = require('./schema-inspector.service')
const { withConnection } = require('../core/db/connection')
const PermissionConflictsRepository = require('../repositories/permission-conflicts.repository')

class PermissionConflictsService {
  constructor({ repository = new PermissionConflictsRepository(), columnExists = hasColumn, database = getDatabase } = {}) {
    this.repository = repository
    this.columnExists = columnExists
    this.database = database
  }

  async check() {
    const supportsModuleIsActive = await this.columnExists('modules', 'is_active', this.database())
    const { duplicates, orphaned } = await this.repository.getConflicts({ supportsModuleIsActive })
    const orphanedModules = orphaned.map(row => row.module_key)
    return {
      duplicates,
      orphaned_modules: orphanedModules,
      has_conflicts: duplicates.length > 0 || orphanedModules.length > 0
    }
  }

  async cleanup() {
    return withConnection(this.database, async connection => {
      const supportsModuleIsActive = await this.columnExists('modules', 'is_active', connection)
      let transactionStarted = false
      try {
        await connection.beginTransaction()
        transactionStarted = true

        const duplicates = await this.repository.getDuplicatesForCleanup(connection)
        let cleanedDuplicates = 0
        for (const duplicate of duplicates) {
          await this.repository.deleteDuplicatePermissions(connection, duplicate)
          cleanedDuplicates += duplicate.count - 1
        }
        const cleanedOrphaned = await this.repository.deleteOrphanedPermissions(connection, supportsModuleIsActive)

        await connection.commit()
        transactionStarted = false
        return {
          cleaned_duplicates: cleanedDuplicates,
          cleaned_orphaned: cleanedOrphaned
        }
      } catch (error) {
        if (transactionStarted) await connection.rollback()
        throw error
      }
    })
  }
}

module.exports = PermissionConflictsService
