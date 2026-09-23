'use strict'

const {
  connectToDatabase,
  closeDatabase,
  getDatabase
} = require('../src/config/database')
const {
  migrateShopTemplateMediaSchema,
  ensureShopTemplateMediaSchema
} = require('../src/utils/shop-template-media-schema')
const log = require('../src/utils/log')

async function main() {
  const connected = await connectToDatabase()
  if (!connected) throw new Error('数据库连接失败，无法迁移商城模板媒体结构')

  await migrateShopTemplateMediaSchema(getDatabase())
  await ensureShopTemplateMediaSchema()
  log.success('商城模板媒体结构迁移完成')
}

main()
  .catch(error => {
    log.error('商城模板媒体结构迁移失败:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await closeDatabase()
  })
