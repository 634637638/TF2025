'use strict'

const fs = require('fs').promises
const { getDatabase } = require('../config/database')
const { getRelativeUploadPathFromUrl, getUploadPathFromUrl } = require('./upload-paths')

let schemaPromise = null

async function ensureShopTemplateMediaSchema() {
  if (schemaPromise) return schemaPromise

  schemaPromise = (async () => {
    const database = getDatabase()
    const [columns] = await database.query("SHOW FULL COLUMNS FROM h5_newimages LIKE 'image_type'")
    const column = columns[0]
    if (!column || !String(column.Type).startsWith('enum(')) {
      throw new Error('h5_newimages.image_type 缺少预期的 ENUM 列')
    }

    const values = [...String(column.Type).matchAll(/'((?:[^'\\]|\\.)*)'/g)]
      .map(match => match[1].replace(/\\'/g, "'"))
    const [draftTables] = await database.query("SHOW TABLES LIKE 'h5_template_media_drafts'")
    if (!values.includes('video') || draftTables.length === 0) {
      throw new Error('商城模板媒体结构未迁移，请运行 npm run migrate:shop-template-media')
    }
  })().catch(error => {
    schemaPromise = null
    throw error
  })

  return schemaPromise
}

async function migrateShopTemplateMediaSchema(database = getDatabase()) {
  const [columns] = await database.query("SHOW FULL COLUMNS FROM h5_newimages LIKE 'image_type'")
  const column = columns[0]
  if (!column || !String(column.Type).startsWith('enum(')) {
    throw new Error('h5_newimages.image_type 缺少预期的 ENUM 列')
  }

  const values = [...String(column.Type).matchAll(/'((?:[^'\\]|\\.)*)'/g)]
    .map(match => match[1].replace(/\\'/g, "'"))
  if (!values.includes('video')) {
    const enumValues = [...values, 'video']
      .map(value => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`)
      .join(',')
    const nullability = column.Null === 'YES' ? 'NULL' : 'NOT NULL'
    const defaultValue = column.Default === null
      ? ''
      : `DEFAULT '${String(column.Default).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
    const collation = column.Collation ? `COLLATE ${column.Collation}` : ''
    const comment = column.Comment
      ? `COMMENT '${String(column.Comment).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
      : ''

    await database.query(
      `ALTER TABLE h5_newimages MODIFY COLUMN image_type ENUM(${enumValues}) ${collation} ${nullability} ${defaultValue} ${comment}`
    )
  }

  await database.query(`CREATE TABLE IF NOT EXISTS h5_template_media_drafts (
    id INT NOT NULL AUTO_INCREMENT,
    template_id INT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    image_type ENUM('other','video') NOT NULL,
    uploaded_by INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_template_media_drafts_owner (template_id, uploaded_by),
    KEY idx_template_media_drafts_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
}

async function cleanupExpiredShopTemplateMediaDrafts() {
  await ensureShopTemplateMediaSchema()
  const database = getDatabase()
  const [drafts] = await database.query(`
    SELECT id, image_url
    FROM h5_template_media_drafts
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
  `)
  if (drafts.length === 0) return 0

  for (const draft of drafts) {
    const relativePath = getRelativeUploadPathFromUrl(draft.image_url)
    if (!relativePath.startsWith('shop/template-staging/')) continue
    await fs.unlink(getUploadPathFromUrl(draft.image_url)).catch(error => {
      if (error.code !== 'ENOENT') throw error
    })
  }
  await database.query('DELETE FROM h5_template_media_drafts WHERE id IN (?)', [drafts.map(draft => draft.id)])
  return drafts.length
}

module.exports = {
  ensureShopTemplateMediaSchema,
  migrateShopTemplateMediaSchema,
  cleanupExpiredShopTemplateMediaDrafts
}
