const { getDatabase } = require('../config/database')

let ensurePromise = null

async function runEnsureReminderSchema() {
  const db = getDatabase()
  if (!db) throw new Error('数据库连接池为空')

  await db.query(`
    CREATE TABLE IF NOT EXISTS reminder_types (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      default_remind_days INT NOT NULL DEFAULT 7,
      color VARCHAR(20) NOT NULL DEFAULT '#409EFF',
      icon VARCHAR(80) NOT NULL DEFAULT 'fas fa-bell',
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_reminder_type_active (is_active, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS reminders (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      type_id INT UNSIGNED NULL,
      title VARCHAR(200) NOT NULL,
      content TEXT NULL,
      priority ENUM('low', 'normal', 'high', 'urgent') NOT NULL DEFAULT 'normal',
      target_mode ENUM('specific', 'all') NOT NULL DEFAULT 'specific',
      target_user_ids JSON NOT NULL,
      repeat_rule JSON NOT NULL,
      start_at DATETIME NOT NULL,
      remind_before_days INT NOT NULL DEFAULT 7,
      status ENUM('active', 'paused', 'archived') NOT NULL DEFAULT 'active',
      created_by INT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_reminder_status (status),
      KEY idx_reminder_creator (created_by),
      KEY idx_reminder_type (type_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS reminder_records (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      reminder_id BIGINT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      scheduled_at DATETIME NOT NULL,
      remind_at DATETIME NOT NULL,
      status ENUM('pending', 'read', 'snoozed', 'ignored', 'completed') NOT NULL DEFAULT 'pending',
      action_at DATETIME NULL,
      snoozed_until DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_reminder_record (reminder_id, user_id, scheduled_at),
      KEY idx_reminder_record_user (user_id, status, remind_at),
      KEY idx_reminder_record_reminder (reminder_id, scheduled_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await db.query(`
    INSERT INTO reminder_types (name, default_remind_days, color, icon, sort_order)
    SELECT '日常维护', 7, '#409EFF', 'fas fa-screwdriver-wrench', 10
    WHERE NOT EXISTS (SELECT 1 FROM reminder_types)
  `)
}

async function ensureReminderSchema() {
  if (!ensurePromise) {
    ensurePromise = runEnsureReminderSchema().catch(error => {
      ensurePromise = null
      throw error
    })
  }
  return ensurePromise
}

module.exports = { ensureReminderSchema }
