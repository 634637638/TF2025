'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('template media uploads stay staged until explicit save and are owner-scoped on discard', () => {
  const service = read('src/services/shop.service.js')
  const routes = read('src/routes/shop.js')
  const frontend = fs.readFileSync(path.join(root, '../frontend/src/views/H5-admin/page/templates.vue'), 'utf8')

  const uploadStart = service.indexOf('async uploadTemplateImage(')
  const uploadEnd = service.indexOf('normalizeTemplateMediaDraftEntries(', uploadStart)
  const upload = service.slice(uploadStart, uploadEnd)
  assert.match(upload, /stageShopTemplateUpload/)
  assert.match(upload, /INSERT INTO h5_template_media_drafts/)
  assert.doesNotMatch(upload, /INSERT INTO h5_newimages/)

  assert.match(service, /async commitTemplateImageUploads\(entries, userId\)/)
  assert.match(service, /INSERT INTO h5_newimages/)
  assert.match(service, /uploaded_by = \? AND id IN \(\?\)/)
  assert.match(routes, /router\.post\('\/templates\/media\/commit-drafts'/)
  assert.match(routes, /router\.post\('\/templates\/media\/discard-drafts'/)
  assert.match(frontend, /await cleanupPendingMediaUploads\(\)[\s\S]*showDialog\.value = false/)
  assert.match(frontend, /await commitTemplateImageUploads\(mediaCommitEntries\)/)
})

test('template media schema migration adds video support and expires abandoned drafts', () => {
  const schema = read('src/utils/shop-template-media-schema.js')
  const migration = read('scripts/migrate-shop-template-media.js')
  const packageJson = JSON.parse(read('package.json'))

  assert.match(schema, /h5_newimages MODIFY COLUMN image_type ENUM/)
  assert.match(schema, /CREATE TABLE IF NOT EXISTS h5_template_media_drafts/)
  assert.match(schema, /INTERVAL 24 HOUR/)
  assert.match(migration, /migrateShopTemplateMediaSchema/)
  assert.equal(packageJson.scripts['migrate:shop-template-media'], 'node scripts/migrate-shop-template-media.js')
})
