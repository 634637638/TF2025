// 未用变量安全分类器：读取 ESLint JSON 结果，对每条未用变量
// 在所属文件全文中检索其他引用，区分"真未用（可处理）"与"疑似仍在用（需人工）"。
// 用法: node scripts/unused-classify.mjs /tmp/unused-full.json > /tmp/unused-classified.json
import fs from 'node:fs'

const input = process.argv[2]
const data = JSON.parse(fs.readFileSync(input, 'utf8'))

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const results = []
for (const file of data) {
  const messages = file.messages.filter(
    (m) => m.ruleId === 'no-unused-vars' || m.ruleId === '@typescript-eslint/no-unused-vars'
  )
  if (!messages.length) continue
  const source = fs.readFileSync(file.filePath, 'utf8')
  const lines = source.split('\n')
  for (const m of messages) {
    const name = (m.message.match(/^'([^']+)'/) || [])[1]
    if (!name) continue
    // 在除定义行外的位置查找该标识符的其他出现
    const re = new RegExp(`\\b${escapeRe(name)}\\b`, 'g')
    let otherUses = 0
    lines.forEach((line, idx) => {
      if (idx + 1 === m.line) return
      if (re.test(line)) {
        otherUses++
        re.lastIndex = 0
      }
    })
    const isArg = /args/.test(m.message) && /is defined but never used/.test(m.message)
    results.push({
      file: file.filePath,
      line: m.line,
      column: m.column,
      name,
      isArg,
      otherUses,
      verdict: otherUses === 0 ? 'SAFE' : 'REVIEW'
    })
  }
}

const safe = results.filter((r) => r.verdict === 'SAFE')
const review = results.filter((r) => r.verdict === 'REVIEW')
console.error(`总计 ${results.length} 条 | 真未用(可自动处理) ${safe.length} | 疑似仍在用(需人工) ${review.length}`)
fs.writeFileSync('/tmp/unused-classified.json', JSON.stringify(results, null, 2))
console.error('已写入 /tmp/unused-classified.json')
