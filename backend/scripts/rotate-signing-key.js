'use strict'

const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const dotenv = require('dotenv')

const SCOPES = Object.freeze({
  'jwt-access': {
    current: 'JWT_SECRET',
    previous: 'JWT_PREVIOUS_SECRET',
    compatibilityWindow: '至少保留最长访问令牌有效期（当前最长 30 天）'
  },
  'jwt-refresh': {
    current: 'JWT_REFRESH_SECRET',
    previous: 'JWT_REFRESH_PREVIOUS_SECRET',
    compatibilityWindow: '至少保留刷新令牌有效期（默认 30 天）'
  },
  'file-access': {
    current: 'FILE_ACCESS_SIGNING_KEY',
    previous: 'FILE_ACCESS_PREVIOUS_SIGNING_KEY',
    compatibilityWindow: '至少保留 10 分钟'
  },
  'order-access': {
    current: 'ORDER_ACCESS_SIGNING_KEY',
    previous: 'ORDER_ACCESS_PREVIOUS_SIGNING_KEY',
    compatibilityWindow: '至少保留 24 小时'
  },
  'inventory-query': {
    current: 'INVENTORY_QUERY_SIGNING_KEY',
    previous: 'INVENTORY_QUERY_PREVIOUS_SIGNING_KEY',
    compatibilityWindow: '至少保留 10 分钟'
  }
})

const applyChanges = process.argv.includes('--apply')
const scopeArg = process.argv.find(argument => argument.startsWith('--scope='))
const scopeName = scopeArg?.slice('--scope='.length)
const scope = SCOPES[scopeName]
const envFileArg = process.argv.find(argument => argument.startsWith('--env-file='))
const envFile = path.resolve(process.cwd(), envFileArg ? envFileArg.slice('--env-file='.length) : '.env')

if (!scope) throw new Error(`必须使用 --scope 指定用途: ${Object.keys(SCOPES).join(', ')}`)
if (!fs.existsSync(envFile)) throw new Error(`环境文件不存在: ${envFile}`)

const originalContent = fs.readFileSync(envFile, 'utf8')
const parsed = dotenv.parse(originalContent)
const currentValue = String(parsed[scope.current] || '').trim()
if (currentValue.length < 32) throw new Error(`${scope.current} 必须至少 32 个字符`)

if (!applyChanges) {
  console.log(JSON.stringify({
    status: 'dry_run',
    scope: scopeName,
    currentVariable: scope.current,
    previousVariable: scope.previous,
    compatibilityWindow: scope.compatibilityWindow,
    instruction: '追加 --apply 后把当前密钥移入 previous 并生成新 current；不会输出密钥值'
  }, null, 2))
  process.exit(0)
}

function upsertEnvValue(content, name, value) {
  const linePattern = new RegExp(`^${name}=.*$`, 'm')
  if (linePattern.test(content)) return content.replace(linePattern, `${name}=${value}`)
  const separator = content.endsWith('\n') || content.length === 0 ? '' : '\n'
  return `${content}${separator}${name}=${value}\n`
}

let nextContent = upsertEnvValue(originalContent, scope.previous, currentValue)
nextContent = upsertEnvValue(nextContent, scope.current, crypto.randomBytes(64).toString('hex'))
fs.writeFileSync(envFile, nextContent, { encoding: 'utf8', mode: 0o600 })
fs.chmodSync(envFile, 0o600)

console.log(JSON.stringify({
  status: 'rotated',
  scope: scopeName,
  envFile,
  compatibilityWindow: scope.compatibilityWindow,
  instruction: '重启后端后新凭证使用 current；达到兼容窗口后清空 previous 并再次重启',
  secretValuesPrinted: false
}, null, 2))
