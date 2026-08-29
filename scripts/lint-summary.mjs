import { ESLint } from 'eslint'

const eslint = new ESLint()
const files = await eslint.lintFiles(['frontend/src', 'backend/src'])
const counts = new Map()
let errors = 0
let warnings = 0

for (const file of files) {
  for (const message of file.messages) {
    const severity = message.severity === 2 ? 'error' : 'warning'
    counts.set(`${severity}:${message.ruleId}`, (counts.get(`${severity}:${message.ruleId}`) || 0) + 1)
    if (severity === 'error') errors += 1
    else warnings += 1
  }
}

console.log(`ESLint: ${errors} errors, ${warnings} warnings`)
for (const [key, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`${String(count).padStart(6)} ${key}`)
}

process.exitCode = errors > 0 ? 1 : 0
