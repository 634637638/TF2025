'use strict'

const { getDatabase } = require('../config/database')

class RentalFileRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async findContractFile(rentalId, fileId) {
    const [rows] = await this.getDb().execute(
      `SELECT f.file_url, f.file_name, COALESCE(s.store_id,p.store_id) AS store_id
       FROM rental_contract_files f JOIN rentals r ON r.id=f.rental_id
       JOIN phones p ON p.id=r.phone_id LEFT JOIN sales s ON s.id=r.sale_id
       WHERE f.id=? AND f.rental_id=?`,
      [fileId, rentalId]
    )
    return rows[0] || null
  }

  async deleteContractFile(connection, rentalId, fileId) {
    const [rows] = await connection.execute(
      'SELECT id,file_url FROM rental_contract_files WHERE id=? AND rental_id=?',
      [fileId, rentalId]
    )
    if (!rows.length) return null
    await connection.execute('DELETE FROM rental_contract_files WHERE id=?', [rows[0].id])
    return rows[0]
  }

  async findRentalForUpdate(connection, rentalId) {
    const [rows] = await connection.execute(`SELECT r.id,r.status,COALESCE(s.store_id,p.store_id) AS store_id
       FROM rentals r JOIN phones p ON p.id=r.phone_id
       LEFT JOIN sales s ON s.id=r.sale_id WHERE r.id=? FOR UPDATE`, [rentalId])
    return rows[0] || null
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
