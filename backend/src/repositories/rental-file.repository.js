'use strict'

const { getDatabase } = require('../config/database')

class RentalFileRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async findContractFile(rentalId, fileId) {
    const [rows] = await this.getDb().execute(
      'SELECT file_url,file_name FROM rental_contract_files WHERE id=? AND rental_id=?',
      [fileId, rentalId]
    )
    return rows[0] || null
  }

  async deleteContractFile(rentalId, fileId) {
    const database = this.getDb()
    const [rows] = await database.execute(
      'SELECT id,file_url FROM rental_contract_files WHERE id=? AND rental_id=?',
      [fileId, rentalId]
    )
    if (!rows.length) return null
    await database.execute('DELETE FROM rental_contract_files WHERE id=?', [rows[0].id])
    return rows[0]
  }

  async rentalExists(rentalId) {
    const [rows] = await this.getDb().execute('SELECT id FROM rentals WHERE id=?', [rentalId])
    return rows.length > 0
  }

  async insertContractFiles(connection, rentalId, actorId, files) {
    const uploaded = []
    for (const file of files) {
      const [result] = await connection.execute(
        'INSERT INTO rental_contract_files (rental_id,file_url,file_name,uploaded_by) VALUES (?,?,?,?)',
        [rentalId, file.fileUrl, file.fileName, actorId]
      )
      uploaded.push({ id: result.insertId })
    }
    return uploaded
  }
}

module.exports = RentalFileRepository
