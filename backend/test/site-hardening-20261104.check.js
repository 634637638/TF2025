'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('私有文件签名统一绑定路径、用户和过期时间', () => {
  const { createPrivateFileUrl, verifyPrivateFileAccess } = require('../src/utils/private-file-access')
  const sourceKey = 'private-file-access-test-key-at-least-32-characters'
  const nowSeconds = 1_800_000_000
  const url = createPrivateFileUrl({
    routePrefix: '/api/repairs/media',
    relativePath: '10/photo.jpg',
    userId: 7,
    namespace: 'repair-media',
    sourceKey,
    nowSeconds
  })
  const parsed = new URL(url, 'https://example.test')
  const payload = {
    namespace: 'repair-media',
    relativePath: '10/photo.jpg',
    userId: parsed.searchParams.get('user'),
    expires: parsed.searchParams.get('expires'),
    signature: parsed.searchParams.get('signature')
  }
  assert.equal(verifyPrivateFileAccess(payload, { sourceKey, nowSeconds }), true)
  assert.equal(verifyPrivateFileAccess({ ...payload, relativePath: '11/photo.jpg' }, { sourceKey, nowSeconds }), false)
  assert.equal(verifyPrivateFileAccess({ ...payload, userId: 8 }, { sourceKey, nowSeconds }), false)
})

test('国补和维修媒体不再把登录 JWT 放进 URL', () => {
  const subsidy = read('src/routes/subsidy.js')
  const repairs = read('src/routes/repairs.js')
  const subsidyMigration = read('scripts/migrate-subsidy-photos.js')
  const format = read('../frontend/src/utils/format.ts')

  assert.doesNotMatch(subsidy, /req\.query\.token|verifyToken\(/)
  assert.doesNotMatch(format, /searchParams\.set\(['"]token['"]|storage\.getToken/)
  assert.match(subsidy, /verifyPrivateFileAccess/)
  assert.match(subsidy, /normalizeSubsidyPhotoStorageUrls\(subsidy_photos \|\| \[\]\)/)
  assert.match(subsidy, /normalizeSubsidyPhotoStorageUrls\(subsidyPhotos\)/)
  assert.match(subsidy, /SELECT subsidy_photos FROM national_subsidies WHERE id = \? FOR UPDATE/)
  assert.match(subsidy, /const validateSubmittedSubsidyPhotos = async/)
  assert.match(subsidy, /国补照片已被其他记录使用/)
  assert.match(subsidy, /SELECT id, apply_status FROM national_subsidies WHERE phone_id = \? FOR UPDATE/)
  assert.match(subsidy, /!previousPaths\.has\(relativePath\) \|\| nextPaths\.has\(relativePath\)/)
  assert.match(subsidy, /for \(const photoPath of removedPaths\)/)
  assert.doesNotMatch(subsidy, /for \(const photoUrl of deletedPhotos \|\| \[\]\)/)
  assert.match(subsidyMigration, /dbOnly: true/)
  assert.match(subsidyMigration, /if \(plan\.records\.length === 0\)/)
  assert.match(subsidy, /Cache-Control', 'private, no-store'/)
  assert.match(repairs, /verifyPrivateFileAccess/)
  assert.match(repairs, /acceptRanges: true/)
  assert.match(repairs, /await connection\.beginTransaction\(\)/)
  assert.match(repairs, /rollbackRepairMediaMoves\(movedMedia\)/)
  assert.match(repairs, /SELECT photos FROM repairs WHERE id = \? FOR UPDATE/)
  assert.match(repairs, /await connection\.commit\(\)/)
  assert.match(repairs, /const validateSubmittedRepairMedia =/)
  assert.match(repairs, /只能新增当前用户上传的临时维修媒体/)
  assert.match(repairs, /verifyPrivateFileAccess\(\{/)
})

test('通用临时清理仅允许本人导航草稿且其他模块使用专用接口', () => {
  const route = read('src/routes/upload-common.js')
  const guide = read('src/utils/guide-upload.js')

  assert.match(route, /const TEMP_DIRECTORY_PERMISSIONS = \{[\s\S]*guide: \['guide:upload'\][\s\S]*\}/)
  assert.doesNotMatch(route, /subsidy: \[|accessories: \[|repairs: \[|shop: \[/)
  assert.match(route, /expectedPrefix = `draft_\$\{Number\(req\.user\?\.id\)\}_`/)
  assert.match(guide, /draft_\$\{normalizedUserId\}_\$\{Date\.now\(\)\}_/)
})

test('健康检查区分存活与数据库就绪状态', () => {
  const database = read('src/config/database.js')
  const health = read('src/utils/health.js')
  const middleware = read('src/middleware/index.js')

  assert.match(database, /pool\.query\('SELECT 1 AS ok'\)/)
  assert.match(health, /databaseReady \? 200 : 503/)
  assert.match(middleware, /app\.get\('\/live', livenessHandler\)/)
  assert.match(middleware, /app\.get\('\/health', readinessHandler\)/)
})

test('Iconify 请求具备认证、独立限流、真实超时和短缓存', () => {
  const route = read('src/routes/icons.js')

  assert.match(route, /router\.get\('\/search\/online', unifiedAuth, requirePermission\('menus:view'\), iconifyRateLimit/)
  assert.match(route, /const controller = new AbortController\(\)/)
  assert.match(route, /signal: controller\.signal/)
  assert.match(route, /ICONIFY_CACHE_TTL_MS/)
  assert.doesNotMatch(route, /timeout:\s*(?:TIMEOUTS\.ICON_FETCH|15000)/)
})

test('前端错误日志在认证后按用户和 IP 独立限流', () => {
  const route = read('src/routes/frontend-error-logs.js')
  const limits = read('src/middleware/rate-limit.js')

  assert.match(route, /router\.post\('\/errors', unifiedAuth, frontendErrorLogRateLimit/)
  assert.match(limits, /windowMs: 5 \* 60 \* 1000,[\s\S]*max: 60/)
  assert.match(limits, /Number\(req\.user\?\.id\)[\s\S]*ip/)
})

test('Git 压缩备份不阻塞事件循环且拒绝并发创建', () => {
  const route = read('src/routes/git.js')

  assert.doesNotMatch(route, /\bexecSync\b/)
  assert.match(route, /await execFilePromise\('tar', \[\.\.\.excludeArgs/)
  assert.match(route, /archiveBackupInProgress/)
  assert.match(route, /已有压缩包备份正在创建/)
})

test('生产结构变更只允许显式迁移模式并记录校验和', () => {
  const policy = read('src/utils/schema-change-policy.js')
  const migration = read('scripts/migrate-schema.js')
  const dataBackup = read('src/services/data-backup.service.js')
  const dataBackupSchema = read('src/utils/data-check-backup-schema.js')
  const dataImport = read('src/services/data-import.service.js')
  const packageJson = JSON.parse(read('package.json'))

  assert.match(policy, /SCHEMA_MIGRATION_MODE === 'true'/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS schema_migrations/)
  assert.match(migration, /checksum CHAR\(64\)/)
  assert.match(migration, /校验和不一致，禁止自动覆盖/)
  assert.match(migration, /const applyChanges = process\.argv\.includes\('--apply'\)/)
  assert.match(migration, /mode: 'dry-run'/)
  assert.match(migration, /SELECT GET_LOCK\(\?, 10\) AS acquired/)
  assert.match(migration, /ensureDataCheckBackupSchema\(db\)/)
  assert.doesNotMatch(dataBackup, /CREATE TABLE/)
  assert.match(dataBackup, /prepareDataCheckBackupSchema\(this\.getPool\(\)\)/)
  assert.match(dataBackupSchema, /if \(!schemaChangesAllowed\(\)\) return/)
  assert.match(dataBackupSchema, /SELECT 1 FROM data_check_backups LIMIT 0/)
  assert.doesNotMatch(dataImport, /ALTER TABLE \$\{table\} AUTO_INCREMENT/)
  assert.match(dataImport, /完全替换必须把“清空 \+ 全量导入”放在同一事务中/)
  assert.match(dataImport, /if \(replaceAllTransactionStarted\) \{\s*await connection\.commit\(\)/)
  assert.match(dataImport, /完全替换在第 \$\{i \+ 2\} 行失败，已回滚全部数据/)
  assert.equal(packageJson.scripts['migrate:schema'], 'node scripts/migrate-schema.js')
})

test('入库自动匹配和退库状态转换使用锁与条件更新', () => {
  const stockIn = read('src/routes/stock-in.js')
  const repository = read('src/repositories/query.repository.js')

  assert.match(stockIn, /LIMIT 1\s+FOR UPDATE/)
  assert.match(stockIn, /WHERE id = \? AND status = 'pending' AND matched_phone_id IS NULL/)
  assert.match(stockIn, /await connection\.commit\(\)[\s\S]*构建响应数据/)
  assert.match(repository, /SELECT status, store_id FROM phones WHERE id = \? FOR UPDATE/)
  assert.match(repository, /deleteSaleResult\.affectedRows !== 1/)
  assert.match(repository, /phoneUpdateResult\.affectedRows !== 1/)
})
