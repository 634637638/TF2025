'use strict'

const { connectToDatabase, closeDatabase } = require('../src/config/database')
const { ensurePriceSourceSchema } = require('../src/utils/price-source-schema')
const log = require('../src/utils/log')

async function main() {
  const connected = await connectToDatabase()
  if (!connected) throw new Error('数据库连接失败，无法迁移报价采集来源结构')
  await ensurePriceSourceSchema()
  log.success('报价采集来源结构迁移完成')
}

main()
  .catch(error => {
    log.error('报价采集来源结构迁移失败:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await closeDatabase()
  })
