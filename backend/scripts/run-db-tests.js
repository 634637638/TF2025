const path = require('node:path')
const fs = require('node:fs')
const { spawnSync } = require('node:child_process')
const { parseArgs } = require('node:util')
const { configureDatabaseTestEnvironment } = require('../test/helpers/database-test-env')

try {
  const { values } = parseArgs({ options: {
    live: { type: 'boolean' },
    all: { type: 'boolean' },
    'backup-confirmed': { type: 'boolean' },
    host: { type: 'string' },
    port: { type: 'string' },
    database: { type: 'string' }
  } })
  if (values.live) {
    if (!values['backup-confirmed'] || !values.host || !values.port || !values.database) {
      throw new Error('业务库测试需要 --backup-confirmed、--host、--port 和 --database 明确指定目标')
    }
    // 复用当前业务环境加载入口；不会将凭据写入命令行或测试配置文件。
    require('../src/config')
    Object.assign(process.env, {
      DB_TEST_MODE: 'live',
      DB_TEST_BACKUP_CONFIRMED: 'true',
      DB_TEST_EXPECTED_HOST: values.host,
      DB_TEST_EXPECTED_PORT: values.port,
      DB_TEST_EXPECTED_NAME: values.database
    })
  } else if (process.env.DB_TEST_MODE === 'live') {
    throw new Error('业务库测试必须通过 --live 显式启动')
  }
  process.env.RUN_DB_TESTS = 'true'
  configureDatabaseTestEnvironment()
  const testFiles = values.all
    ? fs.readdirSync(path.resolve(__dirname, '../test'), { recursive: true })
      .filter(file => file.endsWith('.check.js')).sort().map(file => path.join('test', file))
    : ['test/database-regression.check.js']
  const result = spawnSync(process.execPath, ['--test', ...testFiles], {
    cwd: path.resolve(__dirname, '..'),
    env: process.env,
    stdio: 'inherit'
  })
  if (result.error) throw result.error
  process.exitCode = result.status === null ? 1 : result.status
} catch (error) {
  // 不输出配置内容、完整错误对象或数据库凭证。
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}
