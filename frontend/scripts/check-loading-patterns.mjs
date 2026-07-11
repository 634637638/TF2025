import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url))
const elementButtonPattern = /<el-button\b(?:(?!<el-button\b|<\/el-button>)[\s\S])*?<\/el-button>/gi
const duplicateSpinnerPattern = /<InlineLoading\b|fa-spinner|\bis-loading\b/i

const collectVueFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectVueFiles(path)
    return extname(entry.name) === '.vue' ? [path] : []
  }))
  return files.flat()
}

const getLineNumber = (source, index) => source.slice(0, index).split('\n').length
const files = await collectVueFiles(sourceRoot)
const violations = []

for (const file of files) {
  const source = await readFile(file, 'utf8')
  for (const match of source.matchAll(elementButtonPattern)) {
    const button = match[0]
    if (!/:loading\s*=/.test(button) || !duplicateSpinnerPattern.test(button)) continue
    violations.push(`${relative(sourceRoot, file)}:${getLineNumber(source, match.index)}`)
  }
}

if (violations.length > 0) {
  console.error('发现 el-button 同时使用内置 loading 与第二套 spinner：')
  violations.forEach((violation) => console.error(`- ${violation}`))
  process.exit(1)
}

console.log('Loading 检查通过：未发现 Element Plus 按钮双动画。')
