import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { scanDocumentationConflicts } from '../lib/doc-standards-conflicts.mjs'

const writeFixture = (root, relativePath, source) => {
  const target = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, source)
}

const withFixture = (callback) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tf2025-doc-conflicts-'))
  try {
    return callback(root)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

test('当前入口、统一日志和迁移导航通过冲突检查', () => withFixture(root => {
  writeFixture(root, 'docs/guides/current.md', '真实数据库入口：npm --prefix backend run test:db\n')
  writeFixture(root, 'docs/guides/error-handling-standards.md', 'logger.error("失败")\n')
  writeFixture(root, 'docs/frontend/crud-standards.md', 'logger.debug("完成")\n')
  writeFixture(root, 'docs/frontend/notification-standards.md', '唯一入口：useNotification.ts\n')
  writeFixture(root, 'docs/deployment/CLOUD_DEPLOYMENT_GUIDE.md', '变量清单见 backend/.env.example\n')
  writeFixture(root, 'docs/deployment/INDEX.md', '服务器地址由私有运维配置提供\n')
  writeFixture(root, 'docs/backend/database-testing.md', '主机使用已授权占位参数\n')
  for (const file of [
    'docs/frontend/notification-guide.md',
    'docs/frontend/modal-development-guide.md',
    'docs/frontend/mobile-component-examples.md',
    'docs/frontend/PERFORMANCE_OPTIMIZATION.md',
    'docs/examples/modal-examples.md',
    'docs/examples/component-usage-examples.md'
  ]) {
    writeFixture(root, file, '# 迁移导航\n> 文档类型：迁移导航\n> 唯一权威：current.md\n')
  }

  assert.deepEqual(scanDocumentationConflicts(root), [])
}))

test('旧数据库入口、直接 console、重复密钥模板和真实地址必须失败', () => withFixture(root => {
  writeFixture(root, 'docs/guides/current.md', 'RUN_DB_TESTS=true npm test\n')
  writeFixture(root, 'docs/guides/error-handling-standards.md', 'console.error("失败")\n')
  writeFixture(root, 'docs/frontend/notification-standards.md', 'useNotification.ts 已删除\n')
  writeFixture(root, 'docs/deployment/CLOUD_DEPLOYMENT_GUIDE.md', 'JWT_SECRET=duplicate-template\n')
  writeFixture(root, 'docs/deployment/INDEX.md', '后端地址 10.1.2.3:3000\n')
  writeFixture(root, 'docs/frontend/notification-guide.md', '# 第二套通知正文\n')

  const rules = new Set(scanDocumentationConflicts(root).map(issue => issue.rule))
  for (const rule of [
    'legacy-database-test-entry',
    'direct-console-in-authority',
    'notification-authority-self-conflict',
    'duplicate-production-secret-template',
    'tracked-infrastructure-address',
    'duplicate-guide-must-stay-navigation'
  ]) assert.ok(rules.has(rule), `缺少规则：${rule}`)
}))

test('明确标注的 console 反例不会被误判为推荐代码', () => withFixture(root => {
  writeFixture(root, 'docs/guides/error-handling-standards.md', '// ❌ 反例：console.log("不要这样写")\n')
  assert.deepEqual(scanDocumentationConflicts(root), [])
}))

test('历史快照、唯一待办和开发归档元数据完整时通过', () => withFixture(root => {
  writeFixture(
    root,
    'docs/development/TECHNICAL_DEBT_PROGRESS.md',
    '# 全局技术债务进度\n\n## 当前待完善清单（唯一汇总）\n'
  )
  writeFixture(
    root,
    'docs/development/audit-2026-11-04.md',
    '# 审计报告\n\n> 文档类型：历史审计快照\n> 当前待办入口：[全局技术债务进度](TECHNICAL_DEBT_PROGRESS.md)\n\n## 当时建议的治理顺序\n'
  )
  writeFixture(
    root,
    'docs/archive/development/old-plan.md',
    '# 旧计划\n\n> 文档类型：归档资料\n> 替代入口：[全局技术债务进度](../../development/TECHNICAL_DEBT_PROGRESS.md)\n'
  )

  assert.deepEqual(scanDocumentationConflicts(root), [])
}))

test('第二份当前待办、未标记历史报告和无替代入口归档必须失败', () => withFixture(root => {
  writeFixture(root, 'docs/development/audit-2026-11-04.md', '# 审计报告\n\n## 剩余治理顺序\n')
  writeFixture(root, 'docs/development/another-progress.md', '# 另一份进度\n\n## 当前待完善清单\n')
  writeFixture(root, 'docs/archive/development/old-plan.md', '# 旧计划\n')

  const rules = new Set(scanDocumentationConflicts(root).map(issue => issue.rule))
  for (const rule of [
    'historical-snapshot-marker',
    'historical-current-ledger-link',
    'duplicate-current-backlog',
    'archive-lifecycle-metadata'
  ]) assert.ok(rules.has(rule), `缺少规则：${rule}`)
}))
