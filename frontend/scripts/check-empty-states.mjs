import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const sourceRoot = join(root, 'src')
const publicComponent = join(sourceRoot, 'components/DataEmptyState.vue')
const findings = []
const privateEmptyStateClass = /^(?:(?:[\w-]+-)?empty-(?:state|content|cell-content|results?|container|panel|block|section|view|area|wrapper|list|message|data)(?:[-_]|$)|[\w-]+-empty-state(?:[-_]|$)|no-results?(?:[-_]|$))/i
const allowedPrivateEmptyStyles = new Map([
  ['assignment-empty-selection', '权限分配中的未选择对象引导，不表示查询结果为空']
])

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path, files)
    else if (['.vue', '.css', '.scss'].includes(extname(path))) files.push(path)
  }
  return files
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length
}

if (!readFileSync(publicComponent, 'utf8').includes('<el-empty')) {
  findings.push('src/components/DataEmptyState.vue 必须作为全站唯一的 Element Plus 空状态封装入口')
}

for (const file of walk(sourceRoot)) {
  const source = readFileSync(file, 'utf8')
  const relativeFile = relative(root, file)

  if (file.endsWith('.vue')) {
    if (file !== publicComponent) {
      for (const match of source.matchAll(/<el-empty\b/gi)) {
        findings.push(`${relativeFile}:${lineNumber(source, match.index)} 禁止直接使用 el-empty，请改用公共 DataEmptyState`)
      }

      for (const match of source.matchAll(/\bclass=["']([^"']*)["']/gi)) {
        for (const className of match[1].split(/\s+/)) {
          if (privateEmptyStateClass.test(className)) {
            findings.push(`${relativeFile}:${lineNumber(source, match.index)} 禁止新增页面私有空状态结构 .${className}，请改用公共 DataEmptyState`)
          }
        }
      }
    }

    const styleBlocks = [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    if (file !== publicComponent) {
      for (const block of styleBlocks) {
        const css = block[1].replace(/\/\*[\s\S]*?\*\//g, '')
        for (const match of css.matchAll(/\.([_a-zA-Z][\w-]*)/g)) {
          const className = match[1]
          if (privateEmptyStateClass.test(className) && !allowedPrivateEmptyStyles.has(className)) {
            const sourceIndex = block.index + block[0].indexOf(block[1]) + match.index
            findings.push(`${relativeFile}:${lineNumber(source, sourceIndex)} 禁止新增私有空状态样式 .${className}，请删除遗留规则或使用 DataEmptyState`)
          }
        }
      }
    }
  } else {
    const css = source.replace(/\/\*[\s\S]*?\*\//g, '')
    for (const match of css.matchAll(/\.([_a-zA-Z][\w-]*)/g)) {
      const className = match[1]
      if (privateEmptyStateClass.test(className) && !allowedPrivateEmptyStyles.has(className)) {
        findings.push(`${relativeFile}:${lineNumber(source, match.index)} 禁止新增私有空状态样式 .${className}，请删除遗留规则或使用 DataEmptyState`)
      }
    }
  }

  for (const match of source.matchAll(/<DataEmptyState\b[^>]*\bstate=["']error["'][^>]*>/gi)) {
    if (!/\baction-text=|@action=/.test(match[0])) {
      findings.push(`${relativeFile}:${lineNumber(source, match.index)} 错误空状态必须提供重试操作`)
    }
  }

  for (const match of source.matchAll(/<template\s+#empty\b[^>]*>([\s\S]*?)<\/template>/gi)) {
    if (/暂无数据|没有数据|无数据/.test(match[1]) && !/<DataEmptyState\b/.test(match[1])) {
      findings.push(`${relativeFile}:${lineNumber(source, match.index)} 表格空插槽不得手写空状态，请使用 DataEmptyState`)
    }
  }
}

for (const component of ['components/PaginatedTable.vue', 'components/MobileTable.vue']) {
  const path = join(sourceRoot, component)
  const source = readFileSync(path, 'utf8')
  if (!/<DataEmptyState\b/.test(source)) {
    findings.push(`src/${component} 必须接入公共 DataEmptyState`)
  }
}

if (findings.length) {
  console.error(`空状态统一审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('空状态统一审计通过：业务页面均使用公共 DataEmptyState。')
