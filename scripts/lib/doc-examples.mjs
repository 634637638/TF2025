import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

/** 仅编译显式标记的完整示例，不执行代码、请求或数据库操作。 */
export function parseExamples(source, document) {
  const lines = source.split(/\r?\n/)
  const examples = []
  let fence
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (fence) {
      const close = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/)
      if (close && close[1][0] === fence.marker[0] && close[1].length >= fence.marker.length) {
        if (fence.checked) examples.push({ document, line: fence.line, language: fence.language, code: fence.code.join('\n') })
        fence = undefined
      } else {
        fence.code.push(line)
      }
      continue
    }
    const open = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
    if (!open) continue
    const info = open[2].trim()
    const checked = /^(ts|vue)\s+check$/.test(info)
    fence = { marker: open[1], language: info.split(/\s+/)[0], checked, line: index + 2, code: [] }
  }
  if (fence?.checked) throw new Error(`${document}:${fence.line - 1} 编译示例围栏未闭合`)
  return examples
}

export function collectExamples(repoRoot) {
  const files = ['AGENTS.md', 'CLAUDE.md'].map(name => path.join(repoRoot, name))
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(fullPath)
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push(fullPath)
    }
  }
  walk(path.join(repoRoot, 'docs'))
  return files.flatMap(file => parseExamples(fs.readFileSync(file, 'utf8'), path.relative(repoRoot, file)))
}

export function compileExamples(repoRoot, examples) {
  if (!examples.length) throw new Error('没有可编译示例')
  const frontendRoot = path.join(repoRoot, 'frontend')
  const compiler = path.join(frontendRoot, 'node_modules/vue-tsc/bin/vue-tsc.js')
  if (!fs.existsSync(compiler)) throw new Error('缺少 vue-tsc，请先安装 frontend 依赖')
  const cacheRoot = path.join(frontendRoot, 'node_modules/.cache')
  fs.mkdirSync(cacheRoot, { recursive: true })
  const temporaryDirectory = fs.mkdtempSync(path.join(cacheRoot, 'doc-examples-'))
  try {
    const generated = examples.map((example, index) => {
      const file = path.join(temporaryDirectory, `example-${index}.${example.language}`)
      fs.writeFileSync(file, `${example.code}\n${example.language === 'ts' ? 'export {}\n' : ''}`)
      return { ...example, file }
    })
    fs.writeFileSync(path.join(temporaryDirectory, 'tsconfig.json'), JSON.stringify({
      extends: path.join(frontendRoot, 'tsconfig.json'),
      include: [...generated.map(example => example.file), path.join(frontendRoot, 'env.d.ts'), path.join(frontendRoot, 'src/**/*.d.ts')],
      // 继承项目实际 TS/Vue 选项，不借文档检查改变整套应用的编译策略。
      exclude: []
    }, null, 2))
    const result = spawnSync(process.execPath, [compiler, '--project', path.join(temporaryDirectory, 'tsconfig.json'), '--noEmit', '--pretty', 'false'], {
      cwd: frontendRoot,
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024
    })
    let diagnostics = `${result.stdout ?? ''}${result.stderr ?? ''}`
    // 将临时文件定位还原为规范路径和 Markdown 行号。
    for (const example of generated) {
      for (const alias of [example.file, path.relative(frontendRoot, example.file)]) {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        diagnostics = diagnostics.replace(new RegExp(`${escaped}\\((\\d+),(\\d+)\\)`, 'g'), (_, line, column) => `${example.document}:${example.line + Number(line) - 1}:${column}`)
      }
    }
    if (result.error) diagnostics += `\n${result.error.message}`
    return { success: result.status === 0 && !result.error, diagnostics: diagnostics.trim(), count: examples.length }
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}
