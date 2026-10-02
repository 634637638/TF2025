import fs from 'node:fs'
import path from 'node:path'

const sourceRoot = path.resolve(import.meta.dirname, '../src')
const telemetryPath = path.join(sourceRoot, 'services/telemetry.ts')
const telemetry = fs.readFileSync(telemetryPath, 'utf8')
const findings = []

for (const fragment of ['SENSITIVE_PROPERTY', 'EVENT_NAME', 'trackPageVisit', 'trackEvent', "typeof window === 'undefined'"]) {
  if (!telemetry.includes(fragment)) findings.push(`telemetry.ts 缺少统一采集或隐私保护：${fragment}`)
}

const guards = fs.readFileSync(path.join(sourceRoot, 'router/guards.ts'), 'utf8')
if (!guards.includes("from '@/services/telemetry'")) findings.push('路由访问统计必须调用统一 telemetry 服务')
if (guards.includes('analytics?.trackPageVisit')) findings.push('路由守卫仍直接调用 window analytics，需走统一 telemetry')

if (findings.length) {
  console.error(`埋点规范审计失败，共 ${findings.length} 项：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('埋点规范审计通过：路由访问统计使用共享服务，事件键名和敏感属性过滤已启用。')
