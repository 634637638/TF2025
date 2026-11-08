'use strict'

const { withConnection } = require('../core/db/connection')

const { getDatabase } = require('../config/database')

const ANNOUNCEMENT_COLUMNS = 'id, title, content, is_published, is_pinned, published_at, expires_at, created_at, updated_at'

class SiteAnnouncementRepository {
  constructor(database = getDatabase) {
    this.database = database
  }

  async listPublished() {
    const [rows] = await this.database().execute(
      `SELECT ${ANNOUNCEMENT_COLUMNS}
       FROM site_announcements
       WHERE is_published = 1
         AND (expires_at IS NULL OR expires_at > DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))
       ORDER BY is_pinned DESC, published_at DESC, id DESC LIMIT 20`
    )
    return rows
  }

  async listAdmin() {
    const [rows] = await this.database().execute(
      `SELECT ${ANNOUNCEMENT_COLUMNS}
       FROM site_announcements ORDER BY updated_at DESC, id DESC LIMIT 100`
    )
    return rows
  }

  async create(announcement) {
    return withConnection(this.database(), async connection => {
      try {
        await connection.beginTransaction()
        if (announcement.isPinned) await connection.execute('UPDATE site_announcements SET is_pinned = 0')
        const [result] = await connection.execute(
          `INSERT INTO site_announcements (title, content, is_published, is_pinned, published_at, expires_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, IF(? = 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), NULL), ?,
                   DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))`,
          [announcement.title, announcement.content, announcement.isPublished ? 1 : 0, announcement.isPinned ? 1 : 0, announcement.isPublished ? 1 : 0, announcement.expiresAt]
        )
        const [rows] = await connection.execute(
          `SELECT ${ANNOUNCEMENT_COLUMNS} FROM site_announcements WHERE id = ?`,
          [result.insertId]
        )
        await connection.commit()
        return rows[0]
      } catch (error) {
        await connection.rollback()
        throw error
      }

    })
  }

  async update(id, announcement) {
    return withConnection(this.database(), async connection => {
      try {
        await connection.beginTransaction()
        const [existingRows] = await connection.execute(
          'SELECT id FROM site_announcements WHERE id = ? FOR UPDATE',
          [id]
        )
        if (!existingRows.length) {
          await connection.rollback()
          return null
        }
        if (announcement.isPinned) {
          await connection.execute('UPDATE site_announcements SET is_pinned = 0 WHERE id <> ?', [id])
        }
        await connection.execute(
          `UPDATE site_announcements
           SET title = ?, content = ?, is_published = ?, is_pinned = ?,
               published_at = IF(? = 1, COALESCE(published_at, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)), NULL),
               expires_at = ?, updated_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)
           WHERE id = ?`,
          [announcement.title, announcement.content, announcement.isPublished ? 1 : 0, announcement.isPinned ? 1 : 0, announcement.isPublished ? 1 : 0, announcement.expiresAt, id]
        )
        const [rows] = await connection.execute(
          `SELECT ${ANNOUNCEMENT_COLUMNS} FROM site_announcements WHERE id = ?`,
          [id]
        )
        await connection.commit()
        return rows[0]
      } catch (error) {
        await connection.rollback()
        throw error
      }

    })
  }

  async delete(id) {
    const [result] = await this.database().execute(
      'DELETE FROM site_announcements WHERE id = ?',
      [id]
    )
    return result.affectedRows > 0
  }
}

module.exports = SiteAnnouncementRepository
