import fs from 'node:fs'
import path from 'node:path'

const navigationDocuments = [
  'docs/frontend/notification-guide.md',
  'docs/frontend/modal-development-guide.md',
  'docs/frontend/mobile-component-examples.md',
  'docs/frontend/PERFORMANCE_OPTIMIZATION.md',
  'docs/examples/modal-examples.md',
  'docs/examples/component-usage-examples.md'
]

const authoritativeCodeDocuments = [
  'docs/guides/error-handling-standards.md',
  'docs/frontend/crud-standards.md',
  'docs/frontend/notification-standards.md'
]

const infrastructureDocuments = [
  'docs/deployment/INDEX.md',
  'docs/backend/database-testing.md'
]

const currentDebtDocument = 'docs/development/TECHNICAL_DEBT_PROGRESS.md'
const historicalSnapshotMarker = '文档类型：历史审计快照'
const archivedDocumentMarker = '文档类型：归档资料'
const currentDebtLink = 'TECHNICAL_DEBT_PROGRESS.md'

const walkMarkdown = (directory, output = []) => {
  if (!fs.existsSync(directory)) return output
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) walkMarkdown(entryPath, output)
    else if (entry.isFile() && entry.name.endsWith('.md')) output.push(entryPath)
  }
  return output
}

const addMatches = (issues, repoRoot, relativePath, pattern, rule, message, allowLine = () => false) => {
  const absolutePath = path.join(repoRoot, relativePath)
  if (!fs.existsSync(absolutePath)) return
  const lines = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/)
  lines.forEach((line, index) => {
    pattern.lastIndex = 0
    if (pattern.test(line) && !allowLine(line)) {
      issues.push({ rule, file: relativePath, line: index + 1, message })
    }
  })
}

export function scanDocumentationConflicts(repoRoot) {
  const issues = []
  const docsRoot = path.join(repoRoot, 'docs')
  const markdownFiles = walkMarkdown(docsRoot)

  for (const absolutePath of markdownFiles) {
    const relativePath = path.relative(repoRoot, absolutePath).split(path.sep).join('/')
    if (
      relativePath.startsWith('docs/archive/') ||
      relativePath.startsWith('docs/development/') ||
      relativePath === 'docs/CHANGELOG.md'
    ) continue

    addMatches(
      issues,
      repoRoot,
      relativePath,
      /RUN_DB_TESTS=true\s+npm(?:\s+--prefix\s+backend)?\s+test/,
      'legacy-database-test-entry',
      '现行文档不得恢复旧 RUN_DB_TESTS=true npm test 入口；统一链接 backend/database-testing.md。'
    )
  }

  for (const absolutePath of markdownFiles) {
    const relativePath = path.relative(repoRoot, absolutePath).split(path.sep).join('/')
    const source = fs.readFileSync(absolutePath, 'utf8')
    const lines = source.split(/\r?\n/)

    if (relativePath.startsWith('docs/development/')) {
      const basename = path.basename(relativePath)
      const isDatedSnapshot = /20\d{2}-\d{2}-\d{2}/.test(basename)

      if (isDatedSnapshot && !source.includes(historicalSnapshotMarker)) {
        issues.push({
          rule: 'historical-snapshot-marker',
          file: relativePath,
          line: 1,
          message: '带日期的开发审计或分析记录必须声明“文档类型：历史审计快照”。'
        })
      }

      if (isDatedSnapshot && !source.includes(currentDebtLink)) {
        issues.push({
          rule: 'historical-current-ledger-link',
          file: relativePath,
          line: 1,
          message: '历史审计快照必须链接全局技术债务进度，不能维护独立当前待办。'
        })
      }

      if (relativePath !== currentDebtDocument) {
        lines.forEach((line, index) => {
          if (/^#{1,6}\s+(?:当前待完善清单|当前待修复(?:清单)?|当前待处理(?:清单)?|剩余治理顺序|剩余边界|持续技术债务)(?:\s|（|$)/.test(line)) {
            issues.push({
              rule: 'duplicate-current-backlog',
              file: relativePath,
              line: index + 1,
              message: '只有全局技术债务进度可以维护当前待办；历史标题应改为“当时状态”并链接唯一台账。'
            })
          }
        })
      }
    }

    if (relativePath.startsWith('docs/archive/development/') && path.basename(relativePath) !== 'INDEX.md') {
      if (!source.includes(archivedDocumentMarker) || !source.includes('替代入口：')) {
        issues.push({
          rule: 'archive-lifecycle-metadata',
          file: relativePath,
          line: 1,
          message: '开发归档必须声明“文档类型：归档资料”并提供“替代入口”。'
        })
      }
    }
  }

  for (const relativePath of authoritativeCodeDocuments) {
    addMatches(
      issues,
      repoRoot,
      relativePath,
      /\bconsole\.(?:log|info|warn|error|debug)\s*\(/,
      'direct-console-in-authority',
      '权威规范的推荐代码不得直接使用 console.*；反例必须在同一行明确标注“禁止/反例/旧代码/❌”。',
      line => /禁止|反例|旧代码|❌/.test(line)
    )
  }

  addMatches(
    issues,
    repoRoot,
    'docs/deployment/CLOUD_DEPLOYMENT_GUIDE.md',
    /^\s*(?:DB_PASSWORD|JWT_SECRET|JWT_REFRESH_SECRET|CONFIG_ENCRYPTION_KEY|PRICE_SYNC_ENCRYPTION_KEY|FILE_ACCESS_SIGNING_KEY|ORDER_ACCESS_SIGNING_KEY|INVENTORY_QUERY_SIGNING_KEY)\s*=/,
    'duplicate-production-secret-template',
    '部署指南不得维护第二份生产密钥变量模板；变量清单只引用 backend/.env.example 和环境密钥规范。'
  )

  for (const relativePath of infrastructureDocuments) {
    addMatches(
      issues,
      repoRoot,
      relativePath,
      /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?\b|\bv4\.[A-Za-z0-9.-]+(?::\d+)?\b/,
      'tracked-infrastructure-address',
      '权威仓库文档不得保存真实内网、P2P 或 DDNS 地址；使用占位符或服务器私有运维记录。'
    )
  }

  addMatches(
    issues,
    repoRoot,
    'docs/frontend/notification-standards.md',
    /useNotification\.ts.*(?:已删除|已废弃)|(?:已删除|已废弃).*useNotification\.ts/,
    'notification-authority-self-conflict',
    'useNotification.ts 是当前唯一公共入口，不得同时描述为已删除或已废弃。'
  )

  for (const relativePath of navigationDocuments) {
    const absolutePath = path.join(repoRoot, relativePath)
    if (!fs.existsSync(absolutePath)) continue
    const source = fs.readFileSync(absolutePath, 'utf8')
    if (!source.includes('文档类型：迁移导航') || !source.includes('唯一权威：')) {
      issues.push({
        rule: 'duplicate-guide-must-stay-navigation',
        file: relativePath,
        line: 1,
        message: '旧指南必须保持迁移导航并指向唯一权威，不得重新扩展为第二套实现正文。'
      })
    }
  }

  return issues.sort((left, right) =>
    left.file.localeCompare(right.file) || left.line - right.line || left.rule.localeCompare(right.rule)
  )
}
