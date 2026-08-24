import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const sourceRoot = join(root, 'src')
const globalTabStylePath = join(sourceRoot, 'styles/components/_tabs.scss')

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
const globalTabStyle = readFileSync(globalTabStylePath, 'utf8')
const requiredGlobalTokens = [
  '--tf-tab-bg:',
  '--tf-tab-border:',
  '--tf-tab-hover-border:',
  '--tf-tab-active-border:',
  '--tf-tab-scroll-control-size:',
  '--tf-tab-scroll-control-bg:',
  '--tf-tab-scroll-control-border:'
]

for (const token of requiredGlobalTokens) {
  if (!globalTabStyle.includes(token)) {
    findings.push(`src/styles/components/_tabs.scss:1 全局 TAB 缺少状态令牌 ${token}`)
  }
}

if (!/\.tf-page-tabs\.tab-navigation\s+\.el-button\s*\{[\s\S]*?border:\s*1px\s+solid\s+var\(--tf-tab-border\)\s*!important/.test(globalTabStyle)) {
  findings.push('src/styles/components/_tabs.scss:1 按钮型 TAB 未使用全局独立边框')
}

if (!/\.tf-page-tabs\.el-tabs[\s\S]*?\.el-tabs__item\s*\{[\s\S]*?border:\s*1px\s+solid\s+var\(--tf-tab-border\)\s*!important/.test(globalTabStyle)) {
  findings.push('src/styles/components/_tabs.scss:1 Element Plus TAB 未使用全局独立边框')
}

if (!/\.el-tabs__nav-prev,[\s\S]*?\.el-tabs__nav-next\s*\{[\s\S]*?border:\s*1px\s+solid\s+var\(--tf-tab-scroll-control-border\)/.test(globalTabStyle)) {
  findings.push('src/styles/components/_tabs.scss:1 TAB 溢出导航按钮未使用全局独立边框')
}

for (const file of walk(sourceRoot)) {
  const source = readFileSync(file, 'utf8')
  const relativeFile = relative(root, file)
  const usesPageTabs = /\btf-page-tabs\b/i.test(source)

  for (const match of source.matchAll(/<el-tabs\b[\s\S]*?>/gi)) {
    if (!/\bclass\s*=\s*["'][^"']*\btf-page-tabs\b[^"']*["']/i.test(match[0])) {
      findings.push(`${relativeFile}:${lineNumber(source, match.index)} el-tabs 必须接入 tf-page-tabs`)
    }
  }

  for (const match of source.matchAll(/<el-tab-pane\b[\s\S]*?>/gi)) {
    if (!/\bclass\s*=\s*["'][^"']*\btf-tab-panel\b[^"']*["']/i.test(match[0])) {
      findings.push(`${relativeFile}:${lineNumber(source, match.index)} el-tab-pane 必须接入 tf-tab-panel`)
    }
  }

  for (const match of source.matchAll(/class\s*=\s*["'][^"']*\btab-navigation\b[^"']*["']/gi)) {
    if (!/\btf-page-tabs\b/i.test(match[0])) {
      findings.push(`${relativeFile}:${lineNumber(source, match.index)} tab-navigation 必须接入 tf-page-tabs`)
    }
  }

  if (/class\s*=\s*["'][^"']*\btab-navigation\b[^"']*\btf-page-tabs\b[^"']*["']/i.test(source) &&
      !/class\s*=\s*["'][^"']*\btf-tab-content\b[^"']*["']/i.test(source)) {
    findings.push(`${relativeFile}:1 按钮型页面 TAB 必须提供 tf-tab-content 内容容器`)
  }

  if (usesPageTabs) {
    for (const match of source.matchAll(/class\s*=\s*["'][^"']*\btab-content\b[^"']*["']/gi)) {
      if (!/\btf-tab-content\b/i.test(match[0])) {
        findings.push(`${relativeFile}:${lineNumber(source, match.index)} tab-content 必须接入 tf-tab-content`)
      }
    }

    for (const match of source.matchAll(/class\s*=\s*["'][^"']*\btab-panel\b[^"']*["']/gi)) {
      if (!/\btf-tab-panel\b/i.test(match[0])) {
        findings.push(`${relativeFile}:${lineNumber(source, match.index)} tab-panel 必须接入 tf-tab-panel`)
      }
    }
  }

  for (const styleMatch of source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const styleSource = styleMatch[1]
    const forbiddenPattern = /\.(?:tab-navigation|tab-content|tab-panel|tab-label|tf-page-tabs|tf-tab-content|tf-tab-panel)\b|\.el-tabs__(?:header|content|item|nav-wrap|nav-scroll|nav|active-bar)\b/g
    for (const match of styleSource.matchAll(forbiddenPattern)) {
      const absoluteIndex = styleMatch.index + styleMatch[0].indexOf(styleSource) + match.index
      findings.push(`${relativeFile}:${lineNumber(source, absoluteIndex)} 页面不得覆盖全局 TAB 视觉样式 (${match[0]})`)
    }
  }
}

if (findings.length) {
  console.error(`TAB 统一审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('TAB 统一审计通过：所有标签导航和内容容器均使用全局样式。')
