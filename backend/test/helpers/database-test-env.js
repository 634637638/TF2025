const fs = require('node:fs')
const path = require('node:path')
const { parse } = require('dotenv')

/** 默认隔离测试必须先校验配置；业务库仅接受显式授权目标，不能自动回退。 */
function configureDatabaseTestEnvironment(env = process.env) {
  if (env.RUN_DB_TESTS !== 'true') return false
  if (env.DB_TEST_MODE === 'live') {
    assertLiveDatabaseAuthorization(env)
    return true
  }
  if (env.DB_TEST_MODE && env.DB_TEST_MODE !== 'isolated') throw new Error('未知数据库测试模式')
  const file = path.resolve(env.TEST_DB_ENV_FILE || path.join(__dirname, '../../.env.test'))
  if (env.TEST_DB_ENV_FILE && !fs.existsSync(file)) throw new Error('TEST_DB_ENV_FILE 指定的测试配置文件不存在')
  const values = { ...(fs.existsSync(file) ? parse(fs.readFileSync(file)) : {}), ...env }
  const required = ['HOST', 'USER', 'PASSWORD', 'NAME']
  const missing = required.filter(key => !values[`TEST_DB_${key}`])
  if (missing.length) throw new Error(`数据库测试缺少专用配置：${missing.map(key => `TEST_DB_${key}`).join(', ')}；禁止回退业务库`)
  if (!/^[a-zA-Z][a-zA-Z0-9_]*_test$/.test(values.TEST_DB_NAME)) {
    throw new Error('TEST_DB_NAME 必须是以 _test 结尾的独立测试库；禁止使用业务库')
  }
  if (env.NODE_ENV === 'production') throw new Error('禁止在 NODE_ENV=production 下执行数据库写测试')
  const port = Number(values.TEST_DB_PORT || '3306')
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('TEST_DB_PORT 无效')
  for (const key of required) env[`DB_${key}`] = values[`TEST_DB_${key}`]
  env.DB_PORT = String(port)
  env.NODE_ENV = 'test'
  // 显式设置路径，即便文件不存在也不会触发配置模块的 .env/.env.production 回退。
  env.ENV_FILE = file
  return true
}

function assertLiveDatabaseAuthorization(env) {
  if (env.DB_TEST_BACKUP_CONFIRMED !== 'true') throw new Error('业务库测试必须明确确认备份已完成')
  for (const key of ['HOST', 'PORT', 'NAME']) {
    if (!env[`DB_TEST_EXPECTED_${key}`]) throw new Error(`业务库测试必须明确指定目标 ${key}`)
  }
  if (!/^[1-9]\d{0,4}$/.test(env.DB_TEST_EXPECTED_PORT) || Number(env.DB_TEST_EXPECTED_PORT) > 65535) {
    throw new Error('业务库授权目标端口无效')
  }
  if (!env.DB_HOST || !env.DB_USER || !env.DB_PASSWORD || !env.DB_NAME) throw new Error('业务库连接配置不完整')
  if (env.DB_HOST !== env.DB_TEST_EXPECTED_HOST ||
      String(env.DB_PORT || '3306') !== env.DB_TEST_EXPECTED_PORT ||
      env.DB_NAME !== env.DB_TEST_EXPECTED_NAME) {
    throw new Error('业务库配置与明确授权的目标不一致，停止数据库测试')
  }
}

async function assertDatabaseTestTarget(pool, expectedName, env = process.env) {
  const live = env.DB_TEST_MODE === 'live'
  if (live) {
    assertLiveDatabaseAuthorization(env)
    if (expectedName !== env.DB_TEST_EXPECTED_NAME) throw new Error('业务库目标与授权名称不一致')
  } else if (!/^[a-zA-Z][a-zA-Z0-9_]*_test$/.test(expectedName)) {
    throw new Error('实际连接库与独立测试库配置不一致，停止数据库测试')
  }
  const [[target]] = await pool.query('SELECT DATABASE() AS database_name, @@lower_case_table_names AS lower_case_table_names')
  // 仅当服务器本身折叠库名大小写时归一化，不能放宽大小写敏感服务器的目标校验。
  const normalize = name => Number(target?.lower_case_table_names) > 0 ? String(name).toLowerCase() : name
  if (normalize(target?.database_name) !== normalize(expectedName)) {
    throw new Error('实际连接库与明确指定的目标不一致，停止数据库测试')
  }
}

module.exports = { configureDatabaseTestEnvironment, assertDatabaseTestTarget }
