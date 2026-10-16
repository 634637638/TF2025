'use strict'

const { getDatabase } = require('../config/database')

let ensurePromise = null

async function hasColumn(db, table, column) {
  const [rows] = await db.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column])
  return rows.length > 0
}

async function migrateLegacyGuidePermissionKey(db) {
  const legacyKey = 'guide_guideview'
  const canonicalKey = 'guide_guidemanagementview'

  // 合并旧版本可能已经生成的模块、菜单和角色权限，避免权限管理页出现两套导航模块。
  await db.query(
    'DELETE old_rp FROM role_permissions old_rp ' +
    'JOIN role_permissions new_rp ON new_rp.role_id=old_rp.role_id ' +
    'AND new_rp.permission_type=old_rp.permission_type ' +
    'AND new_rp.module_key=? WHERE old_rp.module_key=?',
    [canonicalKey, legacyKey]
  )
  await db.query('UPDATE role_permissions SET module_key=? WHERE module_key=?', [canonicalKey, legacyKey])
  await db.query(
    'UPDATE menus m JOIN modules mo ON mo.`key`=? ' +
    'SET m.module_id=mo.id, m.module_key=mo.`key` WHERE m.module_key=?',
    [canonicalKey, legacyKey]
  )
  await db.query('DELETE FROM modules WHERE `key`=?', [legacyKey])
}

async function ensureGuideSchema() {
  if (ensurePromise) return ensurePromise

  ensurePromise = (async () => {
    const db = getDatabase()

    await db.query(`
      CREATE TABLE IF NOT EXISTS guide_announcements (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        title VARCHAR(120) NOT NULL,
        content VARCHAR(500) NULL,
        link_url VARCHAR(500) NULL,
        is_pinned TINYINT(1) NOT NULL DEFAULT 0,
        is_enabled TINYINT(1) NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 0,
        starts_at DATETIME NULL,
        ends_at DATETIME NULL,
        created_by INT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_guide_announcements_active (is_enabled, sort_order, starts_at, ends_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    if (!(await hasColumn(db, 'guide_announcements', 'is_pinned'))) {
      await db.query('ALTER TABLE guide_announcements ADD COLUMN is_pinned TINYINT(1) NOT NULL DEFAULT 0 AFTER link_url')
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS guide_categories (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        parent_id INT UNSIGNED NULL,
        name VARCHAR(80) NOT NULL,
        description VARCHAR(255) NULL,
        icon VARCHAR(120) NULL,
        sort_order INT NOT NULL DEFAULT 0,
        is_enabled TINYINT(1) NOT NULL DEFAULT 1,
        access_mode ENUM('public', 'password') NOT NULL DEFAULT 'public',
        password_hash VARCHAR(255) NULL,
        password_policy ENUM('once', 'day', 'days', 'month', 'quarter', 'year', 'permanent') NULL,
        password_expires_days INT UNSIGNED NULL,
        password_used_at DATETIME NULL,
        created_by INT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_guide_categories_name (name),
        KEY idx_guide_categories_active (is_enabled, sort_order),
        KEY idx_guide_categories_parent (parent_id),
        CONSTRAINT fk_guide_categories_parent FOREIGN KEY (parent_id)
          REFERENCES guide_categories(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    if (!(await hasColumn(db, 'guide_categories', 'parent_id'))) {
      await db.query('ALTER TABLE guide_categories ADD COLUMN parent_id INT UNSIGNED NULL AFTER id')
    }
    const [categoryParentIndexes] = await db.query("SHOW INDEX FROM guide_categories WHERE Key_name = 'idx_guide_categories_parent'")
    if (!categoryParentIndexes.length) {
      await db.query('ALTER TABLE guide_categories ADD KEY idx_guide_categories_parent (parent_id)')
    }
    const [categoryParentConstraints] = await db.query(
      "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'guide_categories' AND CONSTRAINT_NAME = 'fk_guide_categories_parent'"
    )
    if (!categoryParentConstraints.length) {
      await db.query(
        'ALTER TABLE guide_categories ADD CONSTRAINT fk_guide_categories_parent FOREIGN KEY (parent_id) ' +
        'REFERENCES guide_categories(id) ON DELETE CASCADE'
      )
    }

    if (!(await hasColumn(db, 'guide_categories', 'password_used_at'))) {
      await db.query('ALTER TABLE guide_categories ADD COLUMN password_used_at DATETIME NULL AFTER password_expires_days')
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS guide_links (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        category_id INT UNSIGNED NOT NULL,
        title VARCHAR(120) NOT NULL,
        description VARCHAR(255) NULL,
        url VARCHAR(500) NULL,
        link_type ENUM('url', 'file') NOT NULL DEFAULT 'url',
        icon VARCHAR(500) NULL,
        file_url VARCHAR(500) NULL,
        file_name VARCHAR(255) NULL,
        file_mime VARCHAR(150) NULL,
        is_enabled TINYINT(1) NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 0,
        created_by INT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_guide_links_category (category_id, is_enabled, sort_order),
        CONSTRAINT fk_guide_links_category FOREIGN KEY (category_id)
          REFERENCES guide_categories(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    if (!(await hasColumn(db, 'guide_links', 'file_url'))) {
      await db.query('ALTER TABLE guide_links ADD COLUMN file_url VARCHAR(500) NULL AFTER icon')
    }
    if (!(await hasColumn(db, 'guide_links', 'file_name'))) {
      await db.query('ALTER TABLE guide_links ADD COLUMN file_name VARCHAR(255) NULL AFTER file_url')
    }
    if (!(await hasColumn(db, 'guide_links', 'file_mime'))) {
      await db.query('ALTER TABLE guide_links ADD COLUMN file_mime VARCHAR(150) NULL AFTER file_name')
    }
    await db.query("UPDATE guide_links SET file_mime=CASE LOWER(SUBSTRING_INDEX(file_url, '.', -1)) WHEN 'jpg' THEN 'image/jpeg' WHEN 'jpeg' THEN 'image/jpeg' WHEN 'png' THEN 'image/png' WHEN 'gif' THEN 'image/gif' WHEN 'webp' THEN 'image/webp' WHEN 'bmp' THEN 'image/bmp' WHEN 'avif' THEN 'image/avif' WHEN 'pdf' THEN 'application/pdf' WHEN 'txt' THEN 'text/plain' WHEN 'csv' THEN 'text/csv' WHEN 'zip' THEN 'application/zip' WHEN 'rar' THEN 'application/vnd.rar' WHEN '7z' THEN 'application/x-7z-compressed' ELSE 'application/octet-stream' END WHERE link_type='file' AND file_url IS NOT NULL AND (file_mime IS NULL OR file_mime='')")
    const [linkTypeColumns] = await db.query("SHOW COLUMNS FROM guide_links LIKE 'link_type'")
    if (linkTypeColumns[0]?.Type?.includes('qrcode')) {
      await db.query("ALTER TABLE guide_links MODIFY link_type ENUM('url', 'qrcode', 'file') NOT NULL DEFAULT 'url'")
      if (await hasColumn(db, 'guide_links', 'qrcode_url')) {
        await db.query("UPDATE guide_links SET file_url=COALESCE(NULLIF(file_url, ''), qrcode_url), link_type='file' WHERE link_type='qrcode'")
        await db.query("UPDATE guide_links SET file_name=SUBSTRING_INDEX(qrcode_url, '/', -1) WHERE file_name IS NULL AND qrcode_url IS NOT NULL")
      } else {
        await db.query("UPDATE guide_links SET link_type='file' WHERE link_type='qrcode'")
      }
      await db.query("ALTER TABLE guide_links MODIFY link_type ENUM('url', 'file') NOT NULL DEFAULT 'url'")
    }
    if (await hasColumn(db, 'guide_links', 'qrcode_url')) {
      await db.query('UPDATE guide_links SET file_url=COALESCE(NULLIF(file_url, \'\'), qrcode_url) WHERE qrcode_url IS NOT NULL')
      await db.query('ALTER TABLE guide_links DROP COLUMN qrcode_url')
    }

    const [parentConstraints] = await db.query(
      "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'guide_links' AND CONSTRAINT_NAME = 'fk_guide_links_parent'"
    )
    if (parentConstraints.length) {
      await db.query('ALTER TABLE guide_links DROP FOREIGN KEY fk_guide_links_parent')
    }
    if (await hasColumn(db, 'guide_links', 'parent_id')) {
      const [parentIndexes] = await db.query("SHOW INDEX FROM guide_links WHERE Key_name = 'idx_guide_links_parent'")
      if (parentIndexes.length) await db.query('ALTER TABLE guide_links DROP INDEX idx_guide_links_parent')
      // 旧版把连接嵌套在另一个可点击连接下；父级关系已不再作为分类模型，删除字段但保留所有连接记录。
      await db.query('ALTER TABLE guide_links DROP COLUMN parent_id')
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS guide_access_tokens (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        token_hash CHAR(64) NOT NULL,
        category_id INT UNSIGNED NOT NULL,
        expires_at DATETIME NULL,
        remaining_uses INT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_guide_access_tokens_hash (token_hash),
        KEY idx_guide_access_tokens_category (category_id, expires_at),
        CONSTRAINT fk_guide_access_tokens_category FOREIGN KEY (category_id)
          REFERENCES guide_categories(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // 让权限管理页在首次启动后即可发现导航管理模块；菜单仍由菜单管理按现有流程创建。
    await db.query(
      'INSERT INTO modules (`key`, name, route_path, description, category, sort_order, icon, is_active, original_name) ' +
      "SELECT 'guide_guidemanagementview', '导航管理', '/guide', '维护公开导航站公告、分类、网址和文件', 'system', 0, 'fas fa-compass', 1, '导航管理' " +
      "WHERE NOT EXISTS (SELECT 1 FROM modules WHERE `key`='guide_guidemanagementview')"
    )
    await db.query(
      "UPDATE modules SET name='导航管理', route_path='/guide', description='维护公开导航站公告、分类、网址和文件', category='system', icon='fas fa-compass', is_active=1 WHERE `key`='guide_guidemanagementview' AND is_custom_name=0"
    )
    await migrateLegacyGuidePermissionKey(db)
    await db.query(
      'INSERT INTO menus (parent_id, name, url, icon, sort_order, menu_type, target, remarks, is_active, module_id, module_key) ' +
      "SELECT 0, '导航管理', '/guide', 'fas fa-compass', 0, 'menu', '_self', '公开导航站后台管理', 1, mo.id, mo.`key` FROM modules mo " +
      "WHERE mo.`key`='guide_guidemanagementview' AND NOT EXISTS (SELECT 1 FROM menus WHERE url='/guide')"
    )
    await db.query(
      "UPDATE menus m JOIN modules mo ON mo.`key`='guide_guidemanagementview' SET m.module_id=mo.id, m.module_key=mo.`key` WHERE m.url='/guide'"
    )
  })().catch(error => {
    ensurePromise = null
    throw error
  })

  return ensurePromise
}

module.exports = { ensureGuideSchema }
