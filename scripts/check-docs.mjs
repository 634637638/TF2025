import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docsRoot = path.join(repoRoot, 'docs')
const markdownFiles = []

const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      walk(entryPath)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      markdownFiles.push(entryPath)
    }
  }
}

const stripCode = (source) => {
  const lines = source.split(/\r?\n/)
  const visibleLines = []
  let fence = null

  for (const line of lines) {
    const marker = line.match(/^\s*(```+|~~~+)/)?.[1]
    if (marker) {
      if (!fence) {
        fence = marker[0]
      } else if (marker[0] === fence) {
        fence = null
      }
      visibleLines.push('')
      continue
    }

    visibleLines.push(fence ? '' : line.replace(/`[^`]*`/g, ''))
  }

  return visibleLines.join('\n')
}

walk(docsRoot)
const brokenLinks = []
const documentationGraph = new Map()

for (const markdownFile of markdownFiles) {
  const source = stripCode(fs.readFileSync(markdownFile, 'utf8'))
  const links = source.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g)
  const linkedMarkdown = []

  for (const link of links) {
    const rawTarget = link[1].replace(/^<|>$/g, '')
    if (!rawTarget || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(rawTarget)) {
      continue
    }

    let targetPath = decodeURIComponent(rawTarget.split(/[?#]/, 1)[0])
    if (!targetPath) {
      continue
    }
    if (targetPath.startsWith('/docs/')) {
      targetPath = targetPath.slice(1)
    } else if (targetPath.startsWith('/')) {
      targetPath = targetPath.slice(1)
    }

    const resolvedPath = path.resolve(
      targetPath.startsWith('docs/')
        ? repoRoot
        : path.dirname(markdownFile),
      targetPath
    )

    if (!resolvedPath.startsWith(`${repoRoot}${path.sep}`) || !fs.existsSync(resolvedPath)) {
      const line = source.slice(0, link.index).split('\n').length
      brokenLinks.push(`${path.relative(repoRoot, markdownFile)}:${line} -> ${rawTarget}`)
    } else if (resolvedPath.endsWith('.md')) {
      linkedMarkdown.push(resolvedPath)
    }
  }

  documentationGraph.set(markdownFile, linkedMarkdown)
}

const entryPoint = path.join(docsRoot, '00-INDEX.md')
const reachableDocuments = new Set()
const pendingDocuments = [entryPoint]

while (pendingDocuments.length > 0) {
  const document = pendingDocuments.pop()
  if (reachableDocuments.has(document)) continue
  reachableDocuments.add(document)
  pendingDocuments.push(...(documentationGraph.get(document) || []))
}

const orphanDocuments = markdownFiles
  .filter(document => !reachableDocuments.has(document))
  .map(document => path.relative(repoRoot, document))
  .sort()

if (brokenLinks.length > 0 || orphanDocuments.length > 0) {
  if (brokenLinks.length > 0) {
    console.error(`文档链接检查失败：${brokenLinks.length} 个本地链接不存在。`)
    console.error(brokenLinks.join('\n'))
  }
  if (orphanDocuments.length > 0) {
    console.error(`文档导航检查失败：${orphanDocuments.length} 份 Markdown 无法从 docs/00-INDEX.md 到达。`)
    console.error(orphanDocuments.join('\n'))
  }
  process.exitCode = 1
} else {
  console.log(`文档链接与导航检查通过：已检查 ${markdownFiles.length} 份 Markdown 文档，均可从 docs/00-INDEX.md 到达。`)
}
