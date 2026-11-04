import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanDocumentationConflicts } from './lib/doc-standards-conflicts.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const issues = scanDocumentationConflicts(repoRoot)

if (issues.length > 0) {
  console.error(`规范冲突检查失败：发现 ${issues.length} 项。`)
  for (const issue of issues) {
    console.error(`${issue.file}:${issue.line} [${issue.rule}] ${issue.message}`)
  }
  process.exitCode = 1
} else {
  console.log('规范冲突检查通过：权威入口、文档生命周期、兼容接口归档、测试命令、日志示例、生产密钥模板和基础设施地址未发现已登记冲突。')
}
