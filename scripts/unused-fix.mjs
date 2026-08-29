// 未用变量 AST 修复器（第一批：参数改名 + 纯函数/字面量声明删除）
// 策略（保守）：
//   1. 函数参数未用 → 重命名为 _name（配置已豁免 ^_）
//   2. 未用声明且 init 为字面量/箭头函数/函数表达式/模板字符串 → 删除整条语句
//   3. 其他（调用、复杂表达式等）一律跳过，留待人工判断
// 依赖 eslint 报告行号定位，处理前逐行重新校验（防止并行编辑导致行漂移）。
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { parse } from 'vue-eslint-parser'

const require = createRequire(import.meta.url)
const tsParser = require('@typescript-eslint/parser')

const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))

const stats = { argRenamed: 0, stmtRemoved: 0, skipped: 0, filesTouched: 0 }

function parseScript(source) {
  const parserOptions = {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parser: tsParser,
    loc: true,
    range: true
  }
  return parse(source, parserOptions)
}

// 深度遍历收集所有节点
function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return
  visit(node)
  for (const key of Object.keys(node)) {
    if (key === 'parent') continue
    const value = node[key]
    if (Array.isArray(value)) {
      for (const child of value) walk(child, visit)
    } else if (value && typeof value.type === 'string') {
      walk(value, visit)
    }
  }
}

function isRemovableInit(init) {
  if (!init) return true
  switch (init.type) {
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
    case 'Literal':
    case 'TemplateLiteral':
    case 'ArrayExpression':
    case 'ObjectExpression':
      return true
    default:
      return false
  }
}

for (const file of report) {
  const messages = file.messages.filter(
    (m) => (m.ruleId === 'no-unused-vars' || m.ruleId === '@typescript-eslint/no-unused-vars')
  )
  if (!messages.length) continue

  const filePath = file.filePath
  const source = fs.readFileSync(filePath, 'utf8')
  const lines = source.split('\n')

  let ast
  try {
    ast = parseScript(source)
  } catch (err) {
    console.error(`解析失败 ${filePath}: ${err.message}`)
    stats.skipped += messages.length
    continue
  }

  const nodes = []
  walk(ast, (n) => nodes.push(n))

  // 收集本文件的编辑操作（按 range 排序，倒序应用）
  const edits = [] // { range: [start, end], replacement: string }

  for (const m of messages) {
    const name = (m.message.match(/^'([^']+)'/) || [])[1]
    if (!name) { stats.skipped++; continue }
    const lineText = lines[m.line - 1] || ''
    // 行漂移校验：定义行必须仍包含该标识符
    if (!new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lineText)) {
      stats.skipped++
      continue
    }

    // 查找与该位置匹配的节点
    const atLine = nodes.filter((n) => n.loc && n.loc.start.line === m.line)

    // 情况 1：函数参数
    const param = atLine.find((n) => {
      if (n.type !== 'Identifier') return false
      if (n.name !== name) return false
      const p = findParent(nodes, n)
      return p && (p.type === 'FunctionDeclaration' || p.type === 'FunctionExpression' ||
        p.type === 'ArrowFunctionExpression') && p.params.includes(n)
    })
    if (param) {
      edits.push({ range: param.range, replacement: `_${name}` })
      stats.argRenamed++
      continue
    }

    // 情况 2：变量声明（const x = ...）
    const decl = atLine.find((n) => n.type === 'VariableDeclarator' &&
      n.id && n.id.type === 'Identifier' && n.id.name === name)
    if (decl) {
      const declStmt = findAncestor(nodes, decl, 'VariableDeclaration')
      if (!declStmt) { stats.skipped++; continue }
      if (declStmt.declarations.length !== 1) { stats.skipped++; continue } // 多变量声明留人工
      const destructured = /is assigned but never used/.test(m.message)
      if (destructured) { stats.skipped++; continue } // 解构留人工
      if (!isRemovableInit(decl.init)) { stats.skipped++; continue } // 有副作用嫌疑留人工
      // 检查是否 export 导出
      const exportNode = findAncestor(nodes, declStmt, 'ExportNamedDeclaration')
      if (exportNode) { stats.skipped++; continue }
      // 删除整行（含换行）
      const start = declStmt.range[0]
      let end = declStmt.range[1]
      if (source[end] === '\n') end += 1
      edits.push({ range: [start, end], replacement: '' })
      stats.stmtRemoved++
      continue
    }

    // 情况 3：函数声明（function foo() {}）
    const funcDecl = atLine.find((n) => n.type === 'FunctionDeclaration' && n.id && n.id.name === name)
    if (funcDecl) {
      const start = funcDecl.range[0]
      let end = funcDecl.range[1]
      if (source[end] === '\n') end += 1
      edits.push({ range: [start, end], replacement: '' })
      stats.stmtRemoved++
      continue
    }

    // 情况 4：catch 子句参数 → 改为 _（保留参数位置，避免语法差异）
    const catchClause = atLine.find((n) => n.type === 'CatchClause')
    if (catchClause && catchClause.param && catchClause.param.name === name) {
      edits.push({ range: catchClause.param.range, replacement: `_${name}` })
      stats.argRenamed++
      continue
    }

    stats.skipped++
  }

  if (!edits.length) continue

  // 倒序应用编辑
  edits.sort((a, b) => a.range[0] - b.range[0])
  let output = source
  for (let i = edits.length - 1; i >= 0; i--) {
    const { range, replacement } = edits[i]
    output = output.slice(0, range[0]) + replacement + output.slice(range[1])
  }
  fs.writeFileSync(filePath, output)
  stats.filesTouched++
}

function findParent(nodes, child) {
  for (const n of nodes) {
    for (const key of Object.keys(n)) {
      if (key === 'parent') continue
      const v = n[key]
      if (v === child) return n
      if (Array.isArray(v) && v.includes(child)) return n
    }
  }
  return null
}

function findAncestor(nodes, node, type) {
  let current = node
  let guard = 0
  while (guard++ < 50) {
    const parent = findParent(nodes, current)
    if (!parent) return null
    if (parent.type === type) return parent
    current = parent
  }
  return null
}

console.error(JSON.stringify(stats, null, 2))
