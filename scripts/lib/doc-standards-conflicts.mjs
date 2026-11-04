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
const compatibilityManifestPath = 'docs/archive/compatibility-routes/route-retirement-manifest.json'
const compatibilityArchiveDocuments = [
  'docs/archive/compatibility-routes/INDEX.md',
  'docs/archive/compatibility-routes/SOURCE_BASELINE.md',
  'docs/archive/compatibility-routes/batch-01-inventory-410.md',
  'docs/archive/compatibility-routes/batch-02-canonical-replacements.md',
  'docs/archive/compatibility-routes/batch-03-compatibility-adapters.md',
  'docs/archive/compatibility-routes/batch-04-shop-media.md'
]

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

const sortedUnique = values => [...new Set(values)].sort()

const sameStringSet = (left, right) => (
  JSON.stringify(sortedUnique(left)) === JSON.stringify(sortedUnique(right))
)

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

  const absoluteManifestPath = path.join(repoRoot, compatibilityManifestPath)
  if (fs.existsSync(absoluteManifestPath)) {
    let manifest
    try {
      manifest = JSON.parse(fs.readFileSync(absoluteManifestPath, 'utf8'))
    } catch (error) {
      issues.push({
        rule: 'compatibility-manifest-json',
        file: compatibilityManifestPath,
        line: 1,
        message: `兼容接口归档清单不是有效 JSON：${error.message}`
      })
    }

    if (manifest) {
      const entries = Array.isArray(manifest.entries) ? manifest.entries : []
      const migrationIds = entries.map(entry => entry?.migration_id).filter(Boolean)
      const compatibilityIds = entries.map(entry => entry?.compatibility_id).filter(Boolean)
      const duplicateMigrationIds = migrationIds.filter((id, index) => migrationIds.indexOf(id) !== index)
      const duplicateCompatibilityIds = compatibilityIds.filter((id, index) => compatibilityIds.indexOf(id) !== index)

      if (entries.length === 0 || entries.some(entry => (
        !entry?.migration_id || !entry?.method || !entry?.path || !entry?.source || !entry?.batch || !entry?.status
      ))) {
        issues.push({
          rule: 'compatibility-manifest-shape',
          file: compatibilityManifestPath,
          line: 1,
          message: '每个兼容接口归档条目必须包含 migration_id、method、path、source、batch 和 status。'
        })
      }

      if (duplicateMigrationIds.length > 0 || duplicateCompatibilityIds.length > 0) {
        issues.push({
          rule: 'compatibility-manifest-duplicate-id',
          file: compatibilityManifestPath,
          line: 1,
          message: '兼容接口归档清单存在重复 migration_id 或 compatibility_id。'
        })
      }

      const summary = manifest.summary || {}
      if (
        summary.deprecated_routes !== entries.length ||
        summary.compatibility_routes !== compatibilityIds.length ||
        summary.deprecated_only_routes !== entries.length - compatibilityIds.length
      ) {
        issues.push({
          rule: 'compatibility-manifest-count',
          file: compatibilityManifestPath,
          line: 1,
          message: '兼容接口归档汇总数量与实际条目不一致。'
        })
      }

      const routeRoot = path.join(repoRoot, 'backend/src/routes')
      if (fs.existsSync(routeRoot)) {
        const routeSource = fs.readdirSync(routeRoot, { withFileTypes: true })
          .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
          .map(entry => fs.readFileSync(path.join(routeRoot, entry.name), 'utf8'))
          .join('\n')
        const codeMigrationIds = [...routeSource.matchAll(/migrationId:\s*['"]([^'"]+)['"]/g)].map(match => match[1])
        const codeCompatibilityIds = [...routeSource.matchAll(/compatibilityId:\s*['"]([^'"]+)['"]/g)].map(match => match[1])

        if (!sameStringSet(migrationIds, codeMigrationIds) || !sameStringSet(compatibilityIds, codeCompatibilityIds)) {
          issues.push({
            rule: 'compatibility-manifest-code-drift',
            file: compatibilityManifestPath,
            line: 1,
            message: '归档清单中的 migration_id/compatibility_id 与 backend/src/routes 当前代码不一致。'
          })
        }
      }

      for (const entry of entries) {
        if (entry?.source && !fs.existsSync(path.join(repoRoot, entry.source))) {
          issues.push({
            rule: 'compatibility-manifest-source',
            file: compatibilityManifestPath,
            line: 1,
            message: `归档条目的源码文件不存在：${entry.source}`
          })
        }
      }
    }

    for (const relativePath of compatibilityArchiveDocuments) {
      if (!fs.existsSync(path.join(repoRoot, relativePath))) {
        issues.push({
          rule: 'compatibility-archive-structure',
          file: relativePath,
          line: 1,
          message: '兼容接口删除前归档缺少规定的索引、基线或批次文档。'
        })
      }
    }

    for (const relativePath of [
      'docs/guides/compatibility-route-retirement-ledger.md',
      currentDebtDocument,
      'docs/archive/INDEX.md'
    ]) {
      const absolutePath = path.join(repoRoot, relativePath)
      if (!fs.existsSync(absolutePath) || !fs.readFileSync(absolutePath, 'utf8').includes('archive/compatibility-routes')) {
        issues.push({
          rule: 'compatibility-archive-link',
          file: relativePath,
          line: 1,
          message: '兼容接口台账、全局待办和归档索引必须记录删除前归档位置。'
        })
      }
    }
  }

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
