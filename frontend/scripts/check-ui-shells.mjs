import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const sourceRoot = join(root, 'src')
const mainSource = readFileSync(join(root, 'src/main.ts'), 'utf8')
const stylesSource = readFileSync(join(root, 'src/styles.scss'), 'utf8')
const paginationSource = readFileSync(join(root, 'src/components/Pagination.vue'), 'utf8')
const searchSource = readFileSync(join(root, 'src/components/search/UnifiedSearchPanel.vue'), 'utf8')
const dialogStyleSource = readFileSync(join(root, 'src/styles/components/_dialog.scss'), 'utf8')
const dialogActionsSource = readFileSync(join(root, 'src/styles/components/_dialog-actions.scss'), 'utf8')
const paginationStyleSource = readFileSync(join(root, 'src/styles/components/_pagination.scss'), 'utf8')

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
const requireToken = (source, token, file, message) => {
  if (!source.includes(token)) findings.push(`${file} ${message}`)
}

requireToken(mainSource, "import './styles/components/_dialog.scss'", 'src/main.ts', '必须全局加载统一 Dialog 样式')
requireToken(mainSource, "import './styles/components/_dialog-actions.scss'", 'src/main.ts', '必须全局加载统一 Dialog footer 样式')
requireToken(stylesSource, "@use './styles/components/_pagination.scss' as *;", 'src/styles.scss', '必须全局加载统一分页样式')
requireToken(paginationSource, 'class="tf-pagination"', 'src/components/Pagination.vue', '公共分页组件必须保留 tf-pagination 根节点')
requireToken(searchSource, 'class="unified-search-panel"', 'src/components/search/UnifiedSearchPanel.vue', '公共搜索组件必须保留 unified-search-panel 根节点')
requireToken(dialogStyleSource, '--tf-dialog-body-padding-inline', 'src/styles/components/_dialog.scss', 'Dialog 正文间距必须由公共变量控制')
requireToken(dialogActionsSource, '.tf-dialog-actions', 'src/styles/components/_dialog-actions.scss', 'Dialog footer 必须提供 tf-dialog-actions 公共布局')
requireToken(paginationStyleSource, '.pagination-wrapper', 'src/styles/components/_pagination.scss', '分页外层兼容布局必须由公共样式控制')

for (const file of walk(sourceRoot)) {
  const source = readFileSync(file, 'utf8')
  const relativeFile = relative(root, file)
  const isPublicImplementation = [
    'src/components/Pagination.vue',
    'src/components/search/UnifiedSearchPanel.vue'
  ].includes(relativeFile)

  if (!relativeFile.endsWith('components/Pagination.vue')) {
    for (const match of source.matchAll(/<el-pagination\b/gi)) {
      findings.push(`${relativeFile}:${lineNumber(source, match.index)} 页面不得直接使用 el-pagination，必须使用公共 Pagination 组件`)
    }
  }

  for (const footer of source.matchAll(/<template\s+#footer\b[^>]*>([\s\S]*?)<\/template>/gi)) {
    if (!/<el-button\b/i.test(footer[1])) continue
    if (/^\s*<el-button\b/i.test(footer[1])) continue
    if (/class=["'][^"']*(?:\btf-dialog-actions\b|\b[\w-]*(?:dialog|modal)-footer\b|\bfooter-actions\b|\bdefault-footer\b|\bconfirm-footer\b)[^"']*["']/i.test(footer[1])) continue
    findings.push(`${relativeFile}:${lineNumber(source, footer.index)} 弹窗 footer 按钮必须放入 tf-dialog-actions；历史 *-dialog-footer/*-modal-footer 仅作兼容`)
  }

  if (relativeFile.startsWith('src/views/') && !relativeFile.startsWith('src/views/H5-') && /<PageHeader\b/i.test(source)) {
    if (!/class=["'][^"']*\badmin-page\b/i.test(source)) {
      findings.push(`${relativeFile}:1 使用 PageHeader 的后台页面根节点必须接入 admin-page`)
    }
    if (!/class=["'][^"']*\badmin-page-content\b/i.test(source)) {
      findings.push(`${relativeFile}:1 使用 PageHeader 的后台页面必须提供 admin-page-content 内容容器`)
    }
  }

  for (const style of source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    if (isPublicImplementation) continue
    const styleSource = style[1]
    const forbiddenPublicSelector = /\.(?:unified-search-panel(?:__[\w-]+)?|tf-pagination(?:__[\w-]+)?|el-pagination|tf-dialog-actions)\b/g
    for (const match of styleSource.matchAll(forbiddenPublicSelector)) {
      const absoluteIndex = style.index + style[0].indexOf(styleSource) + match.index
      findings.push(`${relativeFile}:${lineNumber(source, absoluteIndex)} 页面不得覆盖公共 UI 结构 ${match[0]}，请修改对应全局实现`)
    }
  }
}

if (findings.length) {
  console.error(`统一 UI 结构审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('统一 UI 结构审计通过：Dialog、搜索、分页和后台页面结构均接入公共方案。')
