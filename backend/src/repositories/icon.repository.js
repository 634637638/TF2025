'use strict'

class IconRepository {
  async upsert(pool, icon) {
    await pool.execute(`
      INSERT INTO icons (
        class, name, category, description, tags, svg, iconify_name, source, is_valid, last_checked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        category = VALUES(category),
        description = VALUES(description),
        tags = VALUES(tags),
        svg = VALUES(svg),
        iconify_name = VALUES(iconify_name),
        source = VALUES(source),
        is_valid = VALUES(is_valid),
        last_checked_at = NOW(),
        updated_at = CURRENT_TIMESTAMP
    `, [
      icon.class, icon.name, icon.category, icon.description, icon.tags, icon.svg,
      icon.iconifyName, icon.source, icon.isValid
    ])
  }

  async findByClass(pool, iconClass) {
    const [rows] = await pool.execute(
      `SELECT id, class, name, category, description, tags, svg, iconify_name, source, is_valid, last_checked_at, created_at
       FROM icons WHERE class = ? LIMIT 1`,
      [iconClass]
    )
    return rows[0]
  }

  async cleanup(pool) {
    const [result] = await pool.execute(`
      DELETE i FROM icons i
      LEFT JOIN menus m ON m.icon COLLATE utf8mb4_unicode_ci = i.class COLLATE utf8mb4_unicode_ci
      WHERE m.id IS NULL
        AND (i.is_valid = 0 OR (i.source = 'iconify' AND (i.svg IS NULL OR i.svg = '')))
    `)
    return result.affectedRows || 0
  }

  async findById(pool, id) {
    const [rows] = await pool.execute(
      'SELECT id, class, name FROM icons WHERE id = ? LIMIT 1',
      [id]
    )
    return rows[0]
  }

  async countMenuUses(pool, iconClass) {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as total FROM menus WHERE icon COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci',
      [iconClass]
    )
    return Number(rows[0]?.total || 0)
  }

  async deleteById(pool, id) {
    await pool.execute('DELETE FROM icons WHERE id = ?', [id])
  }
}

module.exports = IconRepository
