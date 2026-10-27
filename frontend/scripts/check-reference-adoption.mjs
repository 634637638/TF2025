import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const sourceRoot = path.resolve(scriptDir, '../src')
const allowedFiles = new Set([
  path.resolve(sourceRoot, 'services/customer-options.ts'),
  path.resolve(sourceRoot, 'services/reference-options.ts')
])

const forbiddenPatterns = [
  /(?:unifiedApi|api|repairsApi)\.get\(\s*[`'\"]\/sales\/customers(?:[?`'\"])/,
  /(?:unifiedApi|api|repairsApi)\.get\(\s*[`'\"]\/rentals\/customers(?:[?`'\"])/,
  /(?:unifiedApi|api|repairsApi)\.get\(\s*[`'\"]\/repairs\/customers\/search(?:[?`'\"])/,
  /(?:unifiedApi|api)\.get\(\s*[`'\"]\/query\/options(?:[?`'\"])/,
  /(?:unifiedApi|api)\.get\(\s*[`'\"]\/options\/phone-options(?:[?`'\"])/,
  /(?:unifiedApi|api)\.get\(\s*[`'\"]\/shop\/base-data\/(?:brands|models|colors|memories)(?:[?`'\"])/
]

const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const fullPath = path.join(directory, entry.name)
  if (entry.isDirectory()) return walk(fullPath)
  return /\.(?:ts|vue)$/.test(entry.name) ? [fullPath] : []
})

const violations = []
for (const filePath of walk(sourceRoot)) {
  if (allowedFiles.has(filePath)) continue
  const contents = fs.readFileSync(filePath, 'utf8')
  contents.split(/\r?\n/).forEach((line, index) => {
    if (forbiddenPatterns.some(pattern => pattern.test(line))) {
      violations.push(`${path.relative(path.resolve(sourceRoot, '..'), filePath)}:${index + 1}`)
    }
  })
}

if (violations.length > 0) {
  console.error('公共检索入口审计失败：以下页面绕过公共服务：')
  violations.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

const customerService = fs.readFileSync(path.resolve(sourceRoot, 'services/customer-options.ts'), 'utf8')
const referenceService = fs.readFileSync(path.resolve(sourceRoot, 'services/reference-options.ts'), 'utf8')
for (const token of ['searchCustomerOptions', 'CustomerSearchContext']) {
  if (!customerService.includes(token)) throw new Error(`客户公共检索服务缺少 ${token}`)
}
for (const token of ['getCachedStores', 'getCachedSuppliers', 'getModels', 'getTemplateBrands', 'sortResponseRecords', 'sortOptionGroups', 'sortOptionsByOrder']) {
  if (!referenceService.includes(token)) throw new Error(`基础选项公共服务缺少 ${token}`)
}
const requiredSortedExports = [
  ['供应商', /export const getCachedSuppliers\s*=\s*\(\)\s*=>\s*sortResponseRecords\([\s\S]*?\/suppliers\?all=true/],
  ['门店', /export const getCachedStores[\s\S]*?return sortResponseRecords\(cachedGet/],
  ['品牌', /export const getCachedBrands\s*=\s*\(\)\s*=>\s*sortResponseRecords\(/],
  ['型号', /return sortResponseRecords\(cachedGet<ReferenceRecord\[]>\(url, url\)\)/],
  ['颜色', /export const getCachedColors\s*=\s*\(\)\s*=>\s*sortResponseRecords\(/],
  ['内存', /export const getCachedMemories\s*=\s*\(\)\s*=>\s*sortResponseRecords\(/],
  ['组合查询选项', /export const getCachedQueryOptions[\s\S]*?sortOptionGroups\(response\.data\)/],
  ['手机选项', /export const getCachedPhoneOptions[\s\S]*?sortOptionGroups\(response\.data\)/],
  ['员工检索', /export const searchEmployees[\s\S]*?sortOptionsByOrder\(response\.data\.employees\)/],
  ['操作员检索', /export const searchOperators\s*=\s*\(params: ReferenceSearchParams = \{\}\)\s*=>\s*sortResponseRecords/]
]
for (const [label, pattern] of requiredSortedExports) {
  if (!pattern.test(referenceService)) throw new Error(`${label}基础检索选项未在公共服务层执行 sort_order 排序`)
}

console.log('公共检索入口审计通过：客户和基础选项请求均通过统一服务。')
