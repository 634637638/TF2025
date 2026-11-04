import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.resolve(scriptDir, '..')
const read = relativePath => fs.readFileSync(path.join(frontendDir, relativePath), 'utf8')

const loggerSource = read('src/utils/error-logger.ts')
const dashboardSource = read('src/components/ErrorManagement/ErrorDashboardSimple.vue')

const failures = []
const requirePattern = (source, pattern, message) => {
  if (!pattern.test(source)) failures.push(message)
}

requirePattern(loggerSource, /public removeError\(errorId: string\): boolean/, '全局错误日志缺少单条删除方法')
requirePattern(loggerSource, /return this\.logs\.delete\(errorId\)/, '单条删除没有操作权威日志集合')
requirePattern(loggerSource, /const removeError = \(errorId: string\) =>/, '错误日志 Composable 未导出响应式删除入口')
requirePattern(loggerSource, /logs\.value = globalErrorLogger\.getLogs\(\)/, '删除后没有刷新响应式日志列表')
requirePattern(dashboardSource, /removeError: removeErrorLog/, '错误管理页面未接入公共单条删除入口')
requirePattern(dashboardSource, /if \(!removeErrorLog\(errorId\)\)/, '错误管理页面仍未执行真实删除')

if (/TODO:\s*实现删除功能/.test(dashboardSource)) {
  failures.push('错误管理页面仍存在假删除实现')
}

if (failures.length) {
  console.error('错误管理契约检查失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('错误管理契约检查通过：单条删除使用全局日志入口并刷新响应式列表。')
