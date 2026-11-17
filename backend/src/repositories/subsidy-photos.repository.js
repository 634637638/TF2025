'use strict'

const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')

class SubsidyPhotosRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async withConnection(operation) {
    return withConnection(this.getDb, operation)
  }

  async getPhotosForUpdate(connection, recordId) {
    const [records] = await connection.execute(
      'SELECT store_id, subsidy_photos FROM national_subsidies WHERE id = ? FOR UPDATE',
      [recordId]
    )
    return records[0] || null
  }

  async hasOtherPhotoReference(connection, relativePath, recordId) {
    const [references] = await connection.execute(
      'SELECT id FROM national_subsidies WHERE id <> ? AND subsidy_photos LIKE ? LIMIT 1',
      [recordId, `%${relativePath}%`]
    )
    return references.length > 0
  }

  async updatePhotos(connection, recordId, photos) {
    await connection.execute(
      'UPDATE national_subsidies SET subsidy_photos = ? WHERE id = ?',
      [JSON.stringify(photos), recordId]
    )
  }

  async getPhotos(recordId) {
    const [records] = await this.getDb().execute(
      'SELECT store_id, subsidy_photos FROM national_subsidies WHERE id = ?',
      [recordId]
    )
    return records[0] || null
  }

  async findPhotoReferences(relativePath) {
    const [records] = await this.getDb().execute(
      'SELECT store_id, subsidy_photos FROM national_subsidies WHERE subsidy_photos LIKE ?',
      [`%${relativePath}%`]
    )
    return records
  }

  async hasPhotoReference(relativePath) {
    const [references] = await this.getDb().execute(
      'SELECT id FROM national_subsidies WHERE subsidy_photos LIKE ? LIMIT 1',
      [`%${relativePath}%`]
    )
    return references.length > 0
  }

  async findRecordForDelete(recordId, executor = this.getDb()) {
    const [records] = await executor.execute(
      'SELECT id, store_id, subsidy_photos FROM national_subsidies WHERE id = ? FOR UPDATE',
      [recordId]
    )
    return records[0] || null
  }

  async deleteRecord(recordId, executor = this.getDb()) {
    const [result] = await executor.execute(
      'DELETE FROM national_subsidies WHERE id = ?',
      [recordId]
    )
    return result.affectedRows > 0
  }
}

module.exports = SubsidyPhotosRepository
