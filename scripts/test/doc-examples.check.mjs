import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { compileExamples, parseExamples } from '../lib/doc-examples.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const example = (code, language = 'ts', document = 'fixture.md') => ({ code, language, document, line: 10 })
const temporaryDirectories = () => {
  const root = path.join(repoRoot, 'frontend/node_modules/.cache')
  return fs.existsSync(root) ? fs.readdirSync(root).filter(name => name.startsWith('doc-examples-')).sort() : []
}

test('只选择显式标记的示例，正确处理嵌套短围栏及源码行号', () => {
  const source = '# 示例\n```ts\nconst ignored = 1\n```\n~~~~vue check\n<template><div /></template>\n```\n~~~~\n```ts check\nexport const value = 1\n```'
  const parsed = parseExamples(source, 'guide.md')
  assert.equal(parsed.length, 2)
  assert.equal(parsed[0].line, 6)
  assert.match(parsed[0].code, /```/)
  assert.equal(parsed[1].language, 'ts')
  assert.equal(parsed[1].line, 10)
})

test('未闭合的受检示例必须失败，不能静默忽略', () => {
  assert.throws(() => parseExamples('```ts check\nconst value = 1', 'guide.md'), /guide.md:1.*未闭合/)
})

test('真实 TS/Vue 示例使用项目导出编译，并清理临时文件', () => {
  const before = temporaryDirectories()
  const result = compileExamples(repoRoot, [
    example("import type { ApiResponse, Store } from '@/types'\nexport const response: ApiResponse<Store[]> = { success: true, message: '', data: [] }"),
    example('<script setup lang="ts">\nconst label: string = "品牌"\n</script>\n<template><el-button>{{ label }}</el-button></template>', 'vue')
  ])
  assert.equal(result.success, true, result.diagnostics)
  assert.deepEqual(temporaryDirectories(), before)
})

test('类型错误、模板参数错误和不存在的导出都失败，定位回文档并清理', () => {
  const before = temporaryDirectories()
  const result = compileExamples(repoRoot, [
    example('export const value: number = "invalid"', 'ts', 'invalid-type.md'),
    example("import { missingDocumentationExport } from '@/utils/time'\nexport { missingDocumentationExport }", 'ts', 'invalid-import.md'),
    example('<script setup lang="ts">\nconst count: number = 1\n</script>\n<template><el-button :loading="count" /></template>', 'vue', 'invalid-template.md')
  ])
  assert.equal(result.success, false)
  for (const document of ['invalid-type.md', 'invalid-import.md', 'invalid-template.md']) assert.ok(result.diagnostics.includes(`${document}:`), result.diagnostics)
  assert.match(result.diagnostics, /invalid-type\.md:10:/)
  assert.deepEqual(temporaryDirectories(), before)
})
