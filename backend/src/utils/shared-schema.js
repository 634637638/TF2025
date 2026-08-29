const { getDatabase } = require('../config/database')

let ensurePromise = null

async function runEnsureSharedSchema() {
  const db = getDatabase()
  await db.query(`
    CREATE TABLE IF NOT EXISTS shared_posts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      title VARCHAR(200) NOT NULL,
      content MEDIUMTEXT NOT NULL,
      attachments JSON NULL,
      category VARCHAR(60) NOT NULL DEFAULT '未分类',
      visibility ENUM('public', 'private') NOT NULL DEFAULT 'public',
      is_pinned TINYINT(1) NOT NULL DEFAULT 0,
      author_id INT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_shared_posts_feed (visibility, is_pinned, created_at),
      KEY idx_shared_posts_category (category),
      KEY idx_shared_posts_author (author_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const [columns] = await db.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shared_posts'
      AND COLUMN_NAME IN ('category', 'visibility')
  `)
  const columnNames = new Set(columns.map(column => column.COLUMN_NAME))
  if (!columnNames.has('category')) {
    await db.query("ALTER TABLE shared_posts ADD COLUMN category VARCHAR(60) NOT NULL DEFAULT '未分类' AFTER attachments")
    await db.query('ALTER TABLE shared_posts ADD KEY idx_shared_posts_category (category)')
  }
  if (!columnNames.has('visibility')) {
    await db.query("ALTER TABLE shared_posts ADD COLUMN visibility ENUM('public', 'private') NOT NULL DEFAULT 'public' AFTER category")
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS shared_categories (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(60) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      UNIQUE KEY uk_shared_categories_name (name),
      KEY idx_shared_categories_sort (sort_order, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  const defaultCategories = ['未分类', '问题处理', '操作教程', '产品知识', '销售经验', '售后服务']
  const [categoryCountRows] = await db.query('SELECT COUNT(*) total FROM shared_categories')
  if (Number(categoryCountRows[0]?.total || 0) === 0) {
    for (const [index, name] of defaultCategories.entries()) {
      await db.query(
        'INSERT INTO shared_categories (name, sort_order) VALUES (?, ?)',
        [name, index * 10]
      )
    }
  }
  await db.query(`
    INSERT IGNORE INTO shared_categories (name, sort_order)
    SELECT DISTINCT category, 1000
    FROM shared_posts
    WHERE category IS NOT NULL AND TRIM(category) <> ''
  `)

  await db.query(
    'INSERT INTO modules (`key`, name, route_path, description, category, sort_order, icon, is_active, original_name) ' +
    "SELECT 'shared_sharedview', '经验分享', '/shared/SharedView', '经验分享与公共文档模块', 'system', 0, 'fas fa-lightbulb', 1, '经验分享' " +
    "WHERE NOT EXISTS (SELECT 1 FROM modules WHERE `key`='shared_sharedview')"
  )
  await db.query(
    "UPDATE modules SET name='经验分享', route_path='/shared/SharedView', description='经验分享与公共文档模块', " +
    "category='system', icon='fas fa-lightbulb', is_active=1 WHERE `key`='shared_sharedview' AND is_custom_name=0"
  )
  await db.query(
    "UPDATE menus m JOIN modules mo ON mo.`key`='shared_sharedview' " +
    "SET m.module_id=mo.id, m.module_key=mo.`key` WHERE m.url='/shared'"
  )
}

async function ensureSharedSchema() {
  if (!ensurePromise) {
    ensurePromise = runEnsureSharedSchema().catch(error => {
      ensurePromise = null
      throw error
    })
  }
  return ensurePromise
}

module.exports = { ensureSharedSchema }
