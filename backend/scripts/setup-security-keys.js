'use strict'

const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const dotenv = require('dotenv')

const applyChanges = process.argv.includes('--apply')
const envFileArg = process.argv.find(argument => argument.startsWith('--env-file='))
const envFile = path.resolve(
  process.cwd(),
  envFileArg ? envFileArg.slice('--env-file='.length) : '.env'
)

const ENV_COMMENTS = Object.freeze({
  MAX_FILE_SIZE: '上传文件大小上限（字节）；修改后重启后端生效。',
  JWT_SECRET: '访问令牌当前签名密钥；使用 rotate:signing-key --scope=jwt-access 平滑轮换，禁止直接覆盖。',
  JWT_PREVIOUS_SECRET: '访问令牌上一密钥，仅用于兼容旧 Token；保留最长 30 天后清空并重启后端。',
  JWT_REFRESH_SECRET: '刷新令牌当前签名密钥；使用 rotate:signing-key --scope=jwt-refresh 平滑轮换。',
  JWT_REFRESH_PREVIOUS_SECRET: '刷新令牌上一密钥，仅验证旧 Token；保留默认 30 天后清空并重启后端。',
  FILE_ACCESS_SIGNING_KEY: '私有文件与分享附件当前签名密钥；使用 --scope=file-access 平滑轮换。',
  FILE_ACCESS_PREVIOUS_SIGNING_KEY: '文件签名上一密钥，仅兼容旧链接；至少保留 10 分钟后清空。',
  ORDER_ACCESS_SIGNING_KEY: '访客订单访问凭证当前签名密钥；使用 --scope=order-access 平滑轮换。',
  ORDER_ACCESS_PREVIOUS_SIGNING_KEY: '订单访问上一密钥，仅兼容旧凭证；至少保留 24 小时后清空。',
  INVENTORY_QUERY_SIGNING_KEY: '库存查询临时凭证当前签名密钥；使用 --scope=inventory-query 平滑轮换。',
  INVENTORY_QUERY_PREVIOUS_SIGNING_KEY: '库存查询上一密钥，仅兼容旧凭证；至少保留 10 分钟后清空。',
  CONFIG_ENCRYPTION_KEY: '支付配置当前加密密钥；禁止直接覆盖，轮换后必须执行 migrate:config-encryption-key。',
  CONFIG_ENCRYPTION_PREVIOUS_KEY: '支付配置上一加密密钥，仅用于迁移期读取和回滚；迁移验证完成后再清空。',
  PRICE_SYNC_ENCRYPTION_KEY: '价格同步密码加密密钥；禁止直接覆盖，必须使用 rotate:price-sync-encryption-key。',
  SESSION_SECRET: '预留服务端 Session 密钥；当前未启用 express-session，修改后仍需重启后端。'
})

function generateSecret() {
  return crypto.randomBytes(64).toString('hex')
}

function upsertEnvValue(content, name, value) {
  const linePattern = new RegExp(`^${name}=.*$`, 'm')
  if (linePattern.test(content)) return content.replace(linePattern, `${name}=${value}`)
  const separator = content.endsWith('\n') || content.length === 0 ? '' : '\n'
  return `${content}${separator}${name}=${value}\n`
}

function ensureEnvComment(content, name, comment) {
  const marker = `# [TF2025:${name}] ${comment}`
  const markerPattern = new RegExp(`^# \\[TF2025:${name}\\].*\\r?\\n`, 'gm')
  const withoutOldMarker = content.replace(markerPattern, '')
  const linePattern = new RegExp(`^${name}=.*$`, 'm')
  if (!linePattern.test(withoutOldMarker)) return withoutOldMarker
  return withoutOldMarker.replace(linePattern, `${marker}\n$&`)
}

if (!fs.existsSync(envFile)) throw new Error(`环境文件不存在: ${envFile}`)

const originalContent = fs.readFileSync(envFile, 'utf8')
const parsed = dotenv.parse(originalContent)
const jwtSecret = String(parsed.JWT_SECRET || '').trim()
if (jwtSecret.length < 32) throw new Error('JWT_SECRET 必须先配置为至少 32 个字符')

const additions = new Map()
const addKeyPair = (currentName, previousName) => {
  const hasCurrent = Boolean(String(parsed[currentName] || '').trim())
  if (hasCurrent) return

  additions.set(currentName, generateSecret())
  if (!String(parsed[previousName] || '').trim()) additions.set(previousName, jwtSecret)
}

addKeyPair('JWT_REFRESH_SECRET', 'JWT_REFRESH_PREVIOUS_SECRET')
addKeyPair('FILE_ACCESS_SIGNING_KEY', 'FILE_ACCESS_PREVIOUS_SIGNING_KEY')
addKeyPair('ORDER_ACCESS_SIGNING_KEY', 'ORDER_ACCESS_PREVIOUS_SIGNING_KEY')
addKeyPair('INVENTORY_QUERY_SIGNING_KEY', 'INVENTORY_QUERY_PREVIOUS_SIGNING_KEY')
addKeyPair('CONFIG_ENCRYPTION_KEY', 'CONFIG_ENCRYPTION_PREVIOUS_KEY')

if (!applyChanges) {
  const commentsNeeded = Object.keys(ENV_COMMENTS).filter(name => {
    const hasValue = new RegExp(`^${name}=`, 'm').test(originalContent) || additions.has(name)
    return hasValue && !originalContent.includes(`# [TF2025:${name}]`)
  })
  console.log(JSON.stringify({
    status: additions.size > 0 || commentsNeeded.length > 0 ? 'dry_run' : 'already_ready',
    envFile,
    missing: [...additions.keys()],
    commentsNeeded,
    instruction: additions.size > 0 || commentsNeeded.length > 0
      ? '追加 --apply 后补齐缺失密钥和逐项用途注释；不会输出密钥值'
      : null
  }, null, 2))
  process.exit(0)
}

let nextContent = originalContent
for (const [name, value] of additions) nextContent = upsertEnvValue(nextContent, name, value)
for (const [name, comment] of Object.entries(ENV_COMMENTS)) {
  nextContent = ensureEnvComment(nextContent, name, comment)
}

fs.writeFileSync(envFile, nextContent, { encoding: 'utf8', mode: 0o600 })
fs.chmodSync(envFile, 0o600)

console.log(JSON.stringify({
  status: 'applied',
  envFile,
  added: [...additions.keys()],
  commentsUpdated: Object.keys(ENV_COMMENTS).filter(name => new RegExp(`^${name}=`, 'm').test(nextContent)),
  secretValuesPrinted: false
}, null, 2))
