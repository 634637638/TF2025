import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectExamples, compileExamples } from './lib/doc-examples.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const required = [
  'docs/guides/api-standards.md',
  'docs/guides/typescript-standards.md',
  'docs/frontend/page-structure-standards.md',
  'docs/frontend/time-standards.md'
]

try {
  const examples = collectExamples(repoRoot)
  for (const document of required) {
    if (!examples.some(example => example.document === document)) throw new Error(`${document} 缺少必须保留的 ts check / vue check 示例`)
  }
  const result = compileExamples(repoRoot, examples)
  if (!result.success) throw new Error(result.diagnostics || '编译器未成功完成')
  console.log(`文档示例编译通过：${result.count} 个已标记 TS/Vue 示例；未执行代码，不覆盖未标记历史片段。`)
} catch (error) {
  console.error('文档示例检查失败：', error.message)
  process.exitCode = 1
}
