import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const frontendRoot = resolve(import.meta.dirname, '..')
const projectRoot = resolve(frontendRoot, '..')
const sourceRoot = resolve(frontendRoot, 'src')
const configPath = resolve(projectRoot, 'frontend/scripts/runtime-pattern-audit.json')
const findings = []

const walk = (directory) => readdirSync(directory).flatMap((name) => {
  const path = resolve(directory, name)
  return statSync(path).isDirectory() ? walk(path) : /\.(?:vue|ts)$/.test(path) ? [path] : []
})

if (!existsSync(configPath)) {
  console.error('运行时模式审计失败：缺少 frontend/scripts/runtime-pattern-audit.json')
  process.exit(1)
}

const config = JSON.parse(readFileSync(configPath, 'utf8'))
const allowedVHtmlProducers = new Set(config.allowedVHtmlProducers || [])
const permanentIntervals = new Set(config.permanentIntervalFiles || [])
const sourceFiles = walk(sourceRoot)
const marketingContextService = readFileSync(resolve(sourceRoot, 'services/marketing-context.ts'), 'utf8')
const unifiedApiSource = readFileSync(resolve(sourceRoot, 'utils/unified-api.ts'), 'utf8')
const apiResponseSource = readFileSync(resolve(sourceRoot, 'utils/api-response.ts'), 'utf8')
const messageBoxSource = readFileSync(resolve(sourceRoot, 'utils/message-box.ts'), 'utf8')

for (const file of sourceFiles) {
  const source = readFileSync(file, 'utf8')
  const fileName = relative(projectRoot, file)

  for (const match of source.matchAll(/v-html\s*=\s*"([^"]+)"/g)) {
    const expression = match[1].trim()
    const producer = expression.match(/^([A-Za-z_$][\w$]*)/)?.[1]
    if (!producer || !allowedVHtmlProducers.has(producer)) {
      findings.push(`${fileName}: v-html 来源 ${expression} 未登记净化函数`)
    }
  }

  if (source.includes('setInterval')) {
    const hasCleanup = /clearInterval\s*\(|onUnmounted\s*\(|onScopeDispose\s*\(/.test(source)
    if (!hasCleanup && !permanentIntervals.has(fileName)) {
      findings.push(`${fileName}: setInterval 缺少 clearInterval 或生命周期清理`)
    }
  }
}

for (const producer of allowedVHtmlProducers) {
  if (!sourceFiles.some(file => readFileSync(file, 'utf8').includes(`v-html="${producer}`))) {
    findings.push(`已登记的 v-html 净化来源未被使用：${producer}`)
  }
}

for (const fileName of permanentIntervals) {
  const path = resolve(projectRoot, fileName)
  if (!existsSync(path) || !readFileSync(path, 'utf8').includes('setInterval')) {
    findings.push(`永久定时器登记无效：${fileName}`)
  }
}

for (const page of [
  'views/marketing/MarketingView.vue',
  'views/marketing/MarketingManagementView.vue'
]) {
  const source = readFileSync(resolve(sourceRoot, page), 'utf8')
  if (/open-meteo\.com|navigator\.geolocation/.test(source)) {
    findings.push(`${page}: 营销定位和天气请求必须使用 services/marketing-context.ts`)
  }
  if (!source.includes('loadMarketingAutoContext')) {
    findings.push(`${page}: 未接入统一营销上下文服务`)
  }
}

if (!/AbortController/.test(marketingContextService) || !/response\.ok/.test(marketingContextService)) {
  findings.push('services/marketing-context.ts 缺少外部请求超时取消或 HTTP 状态校验')
}

for (const page of [
  'views/reminders/ReminderView.vue',
  'types/reminder.ts',
  'views/shared/SharedView.vue',
  'types/shared.ts'
]) {
  const source = readFileSync(resolve(sourceRoot, page), 'utf8')
  if (/:\s*any\b|\bas\s+any\b|<any>|\bany\[\]/.test(source)) {
    findings.push(`${page}: 已完成强类型治理，禁止重新引入显式 any`)
  }
  if (/interface\s+RequestErrorLike|const\s+getRequestErrorMessage\s*=|const\s+isDialogCanceled\s*=/.test(source)) {
    findings.push(`${page}: 请求错误解析和确认框取消判断必须复用全局工具`)
  }
}

if (!/ApiResponse<T\s*=\s*DynamicResponse,\s*TSummary/.test(unifiedApiSource)) {
  findings.push('utils/unified-api.ts: 统一 API 响应必须保留 summary 泛型，禁止页面使用 any 读取统计数据')
}

if (!/export function getRequestErrorMessage/.test(apiResponseSource)) {
  findings.push('utils/api-response.ts: 缺少统一请求错误消息解析入口')
}

if (!/export const isMessageBoxCanceled/.test(messageBoxSource)) {
  findings.push('utils/message-box.ts: 缺少统一确认框取消判断入口')
}

if (findings.length) {
  console.error(`运行时模式审计失败，共 ${new Set(findings).size} 处：`)
  for (const finding of new Set(findings)) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`运行时模式审计通过：已检查 ${sourceFiles.length} 个 Vue/TypeScript 文件。`)
