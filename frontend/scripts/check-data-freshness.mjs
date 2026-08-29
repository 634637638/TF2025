import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const root = new URL('../', import.meta.url)
const sourceRoot = new URL('./src/', root)
const unifiedApiPath = new URL('./src/utils/unified-api.ts', root)
const pageCachePath = new URL('./src/composables/usePageCache.ts', root)
const sourceExtensions = new Set(['.ts', '.vue'])
const directAxiosMutation = /\baxios\s*\.\s*(post|put|patch|delete)\s*\(/g
const violations = []

// 业务页面不得在接口失败时展示伪造的商品、统计或分析数据。
const businessFiles = [
  'src/components/InventoryResultDialog.vue',
  'src/views/repairs/RepairsView.vue',
  'src/views/brands/BrandsView.vue',
  'src/views/colors/ColorsView.vue',
  'src/views/memories/MemoriesView.vue',
  'src/views/analytics/page/CustomerAnalytics.vue',
  'src/views/analytics/page/EmployeeAnalytics.vue',
  'src/views/analytics/page/ProfitAnalytics.vue',
  'src/views/price-list/page/PublicPriceQuery.vue',
  'src/views/price-list/page/SalesPriceDisplay.vue',
  'src/components/query/SalesReceipt.vue'
]
const forbiddenBusinessFallbacks = [
  /模拟数据/,
  /mockData/,
  /总店['"`]\s*[,}]/,
  /腾飞数码/,
  /132-0790-3333/
]
for (const relativePath of businessFiles) {
  const path = new URL(`./${relativePath}`, root)
  const source = readFileSync(path, 'utf8')
  const patterns = relativePath.includes('price-list/page/')
    ? forbiddenBusinessFallbacks
    : [/Math\.random\s*\(/, ...forbiddenBusinessFallbacks]
  for (const pattern of patterns) {
    if (pattern.test(source)) {
      violations.push(`${relativePath} contains prohibited business fallback: ${pattern}`)
    }
  }
}

const walk = directory => {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name)
    const stats = statSync(path)

    if (stats.isDirectory()) {
      walk(path)
      continue
    }

    if (!sourceExtensions.has(extname(path)) || path.endsWith('utils/unified-api.ts')) continue

    const source = readFileSync(path, 'utf8')
    for (const match of source.matchAll(directAxiosMutation)) {
      const line = source.slice(0, match.index).split('\n').length
      violations.push(`${relative(new URL('.', root).pathname, path)}:${line} direct axios ${match[1]} request`)
    }
  }
}

walk(sourceRoot.pathname)

const unifiedApiSource = readFileSync(unifiedApiPath, 'utf8')
const requiredGuards = [
  'private cacheGeneration = 0',
  'this.invalidateReadCache()',
  'metadata?.cacheGeneration === this.cacheGeneration'
]

for (const guard of requiredGuards) {
  if (!unifiedApiSource.includes(guard)) {
    violations.push(`src/utils/unified-api.ts missing freshness guard: ${guard}`)
  }
}

const pageCacheSource = readFileSync(pageCachePath, 'utf8')
if (!pageCacheSource.includes('requestGeneration === cacheGeneration')) {
  violations.push('src/composables/usePageCache.ts missing stale response generation guard')
}

if (!unifiedApiSource.includes('clearPageCache()')) {
  violations.push('src/utils/unified-api.ts does not invalidate page cache after mutations')
}

if (violations.length) {
  console.error('Data freshness check failed:')
  violations.forEach(violation => console.error(`- ${violation}`))
  process.exit(1)
}

console.log('Data freshness patterns are valid.')
