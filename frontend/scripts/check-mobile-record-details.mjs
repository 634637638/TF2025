import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { inspectMobileRecordDetails } from './lib/mobile-record-detail-contract.mjs'

const root = resolve(import.meta.dirname, '..')
const purposes = JSON.parse(readFileSync(join(import.meta.dirname, 'mobile-table-purposes.json'), 'utf8'))
const files = [], findings = [], entries = [], cards = []
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name)
    if (entry.isDirectory()) walk(file)
    else if (file.endsWith('.vue')) files.push(file)
  }
}
walk(join(root, 'src/views'))
walk(join(root, 'src/components'))
for (const file of files) {
  const path = relative(root, file)
  const result = inspectMobileRecordDetails(readFileSync(file, 'utf8'), path, purposes[path] || [])
  findings.push(...result.findings.map(item => `${path}:${item.line} ${item.message}`))
  entries.push(...result.tables.map(item => ({ file: path, ...item })))
  cards.push(...result.cards.map(item => ({ file: path, ...item })))
}
for (const [file, items] of Object.entries(purposes)) {
  for (const item of items) {
    if (!['data-entry', 'related-details', 'selection'].includes(item.purpose) || !item.reason?.trim()) findings.push(`${file} 必须登记明确表格用途和理由`)
    if (!entries.some(entry => entry.file === file && entry.data === item.data)) findings.push(`${file} 存在失效用途登记 ${item.data}`)
  }
}
if (process.argv.includes('--json')) console.log(JSON.stringify({ findings, tables: entries, cards }, null, 2))
else if (findings.length) console.error(`手机记录详情审计失败：\n${findings.join('\n')}`)
else console.log(`手机记录详情审计通过：${entries.length} 张表（含公共组件和弹窗），${entries.filter(item => item.publicDetail).length} 个表格公共双击入口、${cards.length} 个卡片记录模板；其他表逐实例按关联明细、输入/选择或仅PC用途核对。静态接入不等于浏览器验收。`)
if (findings.length) process.exitCode = 1
