import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const viewsRoot = join(root, 'src/views')
const adminLayoutSource = readFileSync(join(root, 'src/styles/admin-layout.css'), 'utf8')

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path, files)
    else if (extname(path) === '.vue') files.push(path)
  }
  return files
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length
}

const findings = []

if (!/\.admin-page\s+\.data-table\.el-table\.compact-fit-table[\s\S]*?min-width:\s*100%\s*!important/i.test(adminLayoutSource)) {
  findings.push('src/styles/admin-layout.css compact-fit-table 必须在公共样式中覆盖为 min-width: 100%，禁止继承 1200px 形成外层横向滚动')
}

for (const file of walk(viewsRoot)) {
  const source = readFileSync(file, 'utf8')
  const relativeFile = relative(root, file)
  const usesCompactFitTable = /<el-table(?=\s|>)[^>]*\bclass=["'][^"']*\bcompact-fit-table\b/i.test(source)

  for (const style of source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const styleSource = style[1]
    for (const rule of styleSource.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (usesCompactFitTable && /\.table-responsive\b/.test(rule[1])) {
        const line = lineNumber(source, style.index + rule.index)
        findings.push(`${relativeFile}:${line} compact-fit-table 页面不得覆盖公共 .table-responsive，横向移动只能由 Element 内部滚动层负责`)
      }
      if (!/\.actions-column\b/.test(rule[1])) continue
      const line = lineNumber(source, style.index + rule.index)
      findings.push(`${relativeFile}:${line} 业务页面不得覆盖公共 .actions-column，列布局只能由全局表格样式控制`)
    }
  }

  for (const match of source.matchAll(/<el-table(?=\s|>)[^>]*>/gi)) {
    const tag = match[0]
    const line = lineNumber(source, match.index)
    if (!/\bclass=["'][^"']*\b(?:data-table|admin-data-table)\b/i.test(tag)) {
      findings.push(`${relativeFile}:${line} Element 表格必须接入公共 data-table/admin-data-table 样式`)
    }

    if (/\bclass=["'][^"']*\bcompact-fit-table\b/i.test(tag)) {
      const tableEnd = source.indexOf('</el-table>', match.index)
      const tableSource = tableEnd === -1 ? tag : source.slice(match.index, tableEnd)
      const columns = [...tableSource.matchAll(/<el-table-column\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)].map(column => column[0])

      if (!/:fit=["']true["']/i.test(tag)) {
        findings.push(`${relativeFile}:${line} compact-fit-table 必须使用 :fit="true"，由普通列按最小宽度共同分配剩余空间`)
      }

      let hasAdaptiveContentColumn = false
      for (const column of columns) {
        const isSpecialColumn = /\b(?:type=["'](?:selection|expand|index)["']|label=["']操作["'])/i.test(column)
        if (!isSpecialColumn && /\b:?min-width=/i.test(column)) hasAdaptiveContentColumn = true
      }

      if (!hasAdaptiveContentColumn) {
        findings.push(`${relativeFile}:${line} compact-fit-table 至少一个普通字段必须使用 min-width，确保整表铺满且剩余空间由字段共同分配`)
      }
    }
  }

  for (const match of source.matchAll(/<el-table-column\b[^>]*\bshow-overflow-tooltip\b[^>]*>/gi)) {
    const tag = match[0]
    const line = lineNumber(source, match.index)
    if (!/\bclass-name=["'][^"']*\bellipsis-text-column\b/i.test(tag)) {
      findings.push(`${relativeFile}:${line} 普通字段不得用 show-overflow-tooltip 截断；请使用 complete-text-column 或 wrapped-text-column 完整展示`)
    }
  }

  for (const match of source.matchAll(/<el-table-column\b[^>]*\blabel=["']操作["'][^>]*>/gi)) {
    const tag = match[0]
    const line = lineNumber(source, match.index)
    const compact = /\bclass-name=["'][^"']*\bcompact-action-column\b/i.test(tag)
    const dynamicWidth = /:width=["'](?:[^"']*ActionColumnWidth|[^"']*\$?get(?:Adaptive)?ActionColumnMin?Width\s*\()[^"']*["']/i.test(tag)
    const columnEnd = source.indexOf('</el-table-column>', match.index)
    const columnSource = columnEnd === -1 ? tag : source.slice(match.index, columnEnd)

    if (/@click(?!\.stop)(?:\.[\w-]+)*=/i.test(columnSource)) {
      findings.push(`${relativeFile}:${line} 操作按钮必须使用 @click.stop，避免触发行点击或手机连续点击展开`)
    }

    if (compact) continue

    if (!/\bclass=["'][^"']*\b(?:action-buttons|table-actions|tf-table-actions)\b/i.test(columnSource)) {
      findings.push(`${relativeFile}:${line} 主列表操作按钮必须放入公共 action-buttons/table-actions 容器`)
    }
    let hasLongStaticButtonLabel = false
    for (const button of columnSource.matchAll(/<el-button\b[^>]*>([\s\S]*?)<\/el-button>/gi)) {
      const visibleText = button[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\{\{[\s\S]*?\}\}/g, '动态文字')
        .replace(/\s+/g, '')
      if (!visibleText) {
        findings.push(`${relativeFile}:${line} PC 主列表操作按钮必须显示中文文字；纯图标仅允许 compact-action-column`)
      }

      const staticText = button[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\{\{[\s\S]*?\}\}/g, ' ')
        .replace(/\s+/g, '')
      if (/[\u3400-\u9fff]{3,}/u.test(staticText)) hasLongStaticButtonLabel = true
    }

    if (!/\bclass-name=["'][^"']*\bactions-column\b/i.test(tag)) {
      findings.push(`${relativeFile}:${line} 主列表操作列必须使用 class-name="actions-column"`)
    }
    if (!dynamicWidth) {
      findings.push(`${relativeFile}:${line} 主列表操作列必须用公共宽度函数，或绑定名称以 ActionColumnWidth 结尾的响应式结果`)
    }
    if (hasLongStaticButtonLabel && /\$getActionColumnWidth\(\s*(?!\[)/i.test(tag)) {
      findings.push(`${relativeFile}:${line} 三字以上操作按钮必须向 $getActionColumnWidth 传入文字数组，不能只按按钮数量计算`)
    }
    if (/\bfixed(?:=["'][^"']*["'])?/i.test(tag)) {
      findings.push(`${relativeFile}:${line} 操作列不得 fixed，必须和表头内容处于同一同步滚动层`)
    }
    if (/\b(?:min-width|width)=["']\d+/i.test(tag)) {
      findings.push(`${relativeFile}:${line} 操作列不得写死数字 width/min-width`)
    }
  }
}

if (findings.length) {
  console.error(`表格布局统一审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('表格布局统一审计通过：表格已接入公共样式，内容完整展示，操作列使用公共自适应规则。')
