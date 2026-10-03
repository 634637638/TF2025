#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const sourceRoot = join(root, 'src')
const findings = []

function walk(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filePath = join(directory, entry.name)
    if (entry.isDirectory()) walk(filePath, files)
    else if (['.vue', '.scss', '.css'].includes(extname(filePath))) files.push(filePath)
  }
  return files
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length
}

function extractStyleSources(filePath, source) {
  if (filePath.endsWith('.vue')) {
    return [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match => ({
      source: match[1],
      offset: match.index + match[0].indexOf(match[1])
    }))
  }
  return [{ source, offset: 0 }]
}

// Return CSS blocks while preserving their selector and source position. This
// intentionally checks only declarations owned by the current block, so a
// nested button rule cannot be mistaken for the footer container itself.
function blocks(source) {
  const result = []
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== '{') continue
    let selectorStart = index - 1
    while (selectorStart >= 0 && !/[}\n]/.test(source[selectorStart])) selectorStart -= 1
    const selector = source.slice(selectorStart + 1, index).trim()
    let depth = 1
    let end = index + 1
    for (; end < source.length && depth > 0; end += 1) {
      if (source[end] === '{') depth += 1
      else if (source[end] === '}') depth -= 1
    }
    if (depth === 0) result.push({ selector, body: source.slice(index + 1, end - 1), index })
  }
  return result
}

function directDeclarations(body) {
  let depth = 0
  let result = ''
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index]
    if (character === '{') {
      depth += 1
      continue
    }
    if (character === '}') {
      depth = Math.max(0, depth - 1)
      continue
    }
    if (depth === 0) result += character
  }
  return result
}

const publicFiles = new Set([
  'src/components/MobileDialog.vue',
  'src/styles/components/_dialog.scss',
  'src/styles/components/_dialog-actions.scss'
])

for (const filePath of walk(sourceRoot)) {
  const relativeFile = relative(root, filePath).split('\\').join('/')
  if (publicFiles.has(relativeFile)) continue
  const source = readFileSync(filePath, 'utf8')

  for (const style of extractStyleSources(filePath, source)) {
    for (const block of blocks(style.source)) {
      const selector = block.selector
      if (!/(?:footer|dialog-actions)/i.test(selector)) continue
      if (/drawer/i.test(selector)) continue
      // Summary/footer content is allowed to size its informational text. The
      // shared action container below it still owns the buttons.
      if (/permission-summary-footer|insight-card__footer|context-footer|card-footer|permission-page-footer/i.test(selector)) continue
      const declarations = directDeclarations(block.body).replace(/\/\*[\s\S]*?\*\//g, '')
      const forbidden = [
        [/display\s*:\s*grid\b/i, '不得用 grid 替代公共 footer 布局'],
        [/grid-template-columns\s*:/i, '不得在 footer 中自行等分按钮列'],
        [/flex-direction\s*:\s*column\b/i, '手机 footer 按钮不得改为纵向排列'],
        [/(?:^|[;\s])(width|min-width|max-width|height|min-height|max-height)\s*:/i, '不得在 footer 中固定按钮区域尺寸']
      ]
      for (const [pattern, message] of forbidden) {
        if (pattern.test(declarations)) {
          findings.push(`${relativeFile}:${lineNumber(source, style.offset + block.index)} ${message}（${selector}）`)
        }
      }
    }
  }
}

if (findings.length) {
  console.error(`Dialog footer 统一审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('Dialog footer 统一审计通过：未发现页面级 grid、纵向排列或固定尺寸覆盖。')
