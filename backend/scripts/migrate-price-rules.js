'use strict'

process.env.SCHEMA_MIGRATION_MODE = 'true'

const { connectToDatabase, getDatabase, closeDatabase } = require('../src/config/database')
const { migratePriceRuleSchema } = require('../src/utils/price-rule-schema')

async function main() {
  const connected = await connectToDatabase()
  if (!connected) throw new Error('数据库连接失败，无法迁移报价规格规则')
  console.log(JSON.stringify(await migratePriceRuleSchema(getDatabase(), { apply: process.argv.includes('--apply') }), null, 2))
}

main().catch(error => {
  console.error('报价规格规则迁移失败:', error.message)
  process.exitCode = 1
}).finally(async () => {
  await closeDatabase()
})
