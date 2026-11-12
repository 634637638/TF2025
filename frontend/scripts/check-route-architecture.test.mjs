import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { ARCHITECTURE_CONFIG_PATH, loadArchitectureBaselineConfig } from './lib/architecture-baseline-config.mjs'
import {
  analyzeControllerDatabaseCalls,
  analyzeControllerRepositoryDependencies,
  analyzeDatabaseConnectionLeases,
  checkControllerDatabaseArchitecture,
  checkControllerRepositoryArchitecture,
  checkLayerDependencyArchitecture,
  checkBackendArchitectureFoundation,
  checkRepositoryConnectionArchitecture,
  checkDatabaseConnectionLeaseArchitecture,
  checkArchitectureBaselineHistory,
  checkArchitectureBaselinesDoNotGrow,
  collectArchitectureSnapshot,
  checkRouteArchitecture,
  digestLegacyRoutes,
  analyzeRouteArchitecture
} from './lib/route-architecture-analysis.mjs'

const createFixture = (t) => {
  const root = mkdtempSync(join(tmpdir(), 'tf-route-architecture-'))
  const routesRoot = join(root, 'routes')
  const controllersRoot = join(root, 'controllers')
  const servicesRoot = join(root, 'services')
  const repositoriesRoot = join(root, 'repositories')
  mkdirSync(routesRoot)
  mkdirSync(controllersRoot)
  mkdirSync(servicesRoot)
  mkdirSync(repositoriesRoot)
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return { routesRoot, controllersRoot, servicesRoot, repositoriesRoot }
}

const createGitFixture = t => {
  const root = mkdtempSync(join(tmpdir(), 'tf-architecture-config-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  git('init')
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-m', 'fixture')
  const save = (file, text) => {
    mkdirSync(join(root, file, '..'), { recursive: true })
    writeFileSync(join(root, file), text)
    git('add', file)
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture configuration')
  }
  return { root, save }
}

test('架构基线迁移前后的 Git 版本均读取真实登记，不重建历史', t => {
  const { root, save } = createGitFixture(t)
  const original = { maxControllerSqlCalls: 3, baselineHistory: { maxControllerSqlCalls: [{ value: 3 }] } }
  save('config/backend-route-architecture.json', JSON.stringify(original))
  assert.deepEqual(loadArchitectureBaselineConfig(root, 'HEAD'), original)
  const current = { ...original, maxControllerSqlCalls: 2 }
  save(ARCHITECTURE_CONFIG_PATH, JSON.stringify(current))
  assert.deepEqual(loadArchitectureBaselineConfig(root, 'HEAD'), current)
  assert.deepEqual(loadArchitectureBaselineConfig(root, 'HEAD~1'), original)
})

test('新位置的架构基线损坏时拒绝读取旧位置绕过', t => {
  const { root, save } = createGitFixture(t)
  save('config/backend-route-architecture.json', '{}')
  save(ARCHITECTURE_CONFIG_PATH, '{')
  assert.throws(() => loadArchitectureBaselineConfig(root, 'HEAD'), SyntaxError)
})

test('只有有效且确实无台账的历史提交才返回首次登记，无效引用必须失败', t => {
  const { root } = createGitFixture(t)
  assert.equal(loadArchitectureBaselineConfig(root, 'HEAD'), null)
  assert.throws(() => loadArchitectureBaselineConfig(root, 'missing-synthetic-ref'))
})

test('architecture snapshot reads all per-file ratchets from target source trees', (t) => {
  const roots = createFixture(t)
  writeFileSync(join(roots.routesRoot, 'sample.js'), "router.get('/legacy', async (req, res) => res.send('legacy'))")
  writeFileSync(join(roots.controllersRoot, 'sample.controller.js'), "require('../repositories/sample.repository'); connection.execute('SELECT 1')")
  writeFileSync(join(roots.servicesRoot, 'sample.service.js'), 'pool.getConnection()')
  writeFileSync(join(roots.repositoriesRoot, 'sample.repository.js'), "require('../services/sample.service')")

  const snapshot = collectArchitectureSnapshot({
    sourceRoots: {
      routes: roots.routesRoot,
      controllers: roots.controllersRoot,
      services: roots.servicesRoot,
      repositories: roots.repositoriesRoot
    }
  })
  assert.equal(snapshot.maxLegacyNonControllerRoutes, 1)
  assert.equal(snapshot.maxControllerSqlCalls, 1)
  assert.equal(snapshot.maxControllerRepositoryDependencies, 1)
  assert.equal(snapshot.maxForbiddenLayerDependencies, 1)
  assert.equal(snapshot.maxDirectDatabaseConnectionLeases, 1)
  assert.deepEqual(snapshot.directDatabaseConnectionLeases, { 'services/sample.service.js': 1 })
})

test('route architecture accepts wired controllers and freezes legacy handlers', (t) => {
  const { routesRoot, controllersRoot } = createFixture(t)
  writeFileSync(join(controllersRoot, 'sample.controller.js'), 'module.exports = class SampleController {}')
  const routePath = join(routesRoot, 'sample.js')
  const source = `
    const SampleController = require('../controllers/sample.controller')
    const controller = new SampleController()
    router.get('/legacy', async (req, res) => res.send('legacy'))
    router.get('/current', controller.list)
  `
  writeFileSync(routePath, source)

  const routes = analyzeRouteArchitecture(routePath, source).routes
  const legacyRoutes = routes.filter(route => !route.usesController)
  const baseline = {
    'sample.js': { count: legacyRoutes.length, digest: digestLegacyRoutes(legacyRoutes) }
  }
  const current = checkRouteArchitecture({ routesRoot, controllersRoot, legacyRouteBaseline: baseline })
  assert.deepEqual(current.findings, [])

  writeFileSync(routePath, `${source}\nrouter.post('/new', async (req, res) => res.send('new'))`)
  const withNewInlineRoute = checkRouteArchitecture({ routesRoot, controllersRoot, legacyRouteBaseline: baseline })
  assert.ok(withNewInlineRoute.findings.some(finding => finding.includes('与审计基线不一致')))
})

test('route architecture treats inline controller forwarding wrappers as inline handlers', (t) => {
  const { routesRoot, controllersRoot } = createFixture(t)
  writeFileSync(join(controllersRoot, 'sample.controller.js'), 'module.exports = class SampleController {}')
  const routePath = join(routesRoot, 'sample.js')
  const source = `
    const SampleController = require('../controllers/sample.controller')
    const controller = new SampleController()
    router.get('/wrapped', (req, res) => controller.list(req, res))
    router.get('/direct', controller.list.bind(controller))
  `
  writeFileSync(routePath, source)

  const routes = analyzeRouteArchitecture(routePath, source).routes
  assert.equal(routes[0].usesController, false)
  assert.equal(routes[0].inlineHandler, true)
  assert.equal(routes[1].usesController, true)
  assert.equal(routes[1].inlineHandler, false)

  const result = checkRouteArchitecture({ routesRoot, controllersRoot, legacyRouteBaseline: {} })
  assert.ok(result.findings.some(finding => finding.includes('发现新的非 controller 路由')))
})

test('route architecture rejects orphan controllers and changed legacy handlers', (t) => {
  const { routesRoot, controllersRoot } = createFixture(t)
  writeFileSync(join(controllersRoot, 'sample.controller.js'), 'module.exports = class SampleController {}')
  writeFileSync(join(controllersRoot, 'orphan.controller.js'), 'module.exports = class OrphanController {}')
  const routePath = join(routesRoot, 'sample.js')
  const original = 'const SampleController = require(\'../controllers/sample.controller\')\nrouter.get(\'/legacy\', async (req, res) => res.send(\'before\'))'
  writeFileSync(routePath, original)
  const legacyRoutes = analyzeRouteArchitecture(routePath, original).routes
  const baseline = {
    'sample.js': { count: 1, digest: digestLegacyRoutes(legacyRoutes) }
  }

  writeFileSync(routePath, 'const SampleController = require(\'../controllers/sample.controller\')\nrouter.get(\'/legacy\', async (req, res) => res.send(\'after\'))')
  const result = checkRouteArchitecture({ routesRoot, controllersRoot, legacyRouteBaseline: baseline })
  assert.ok(result.findings.some(finding => finding.includes('sample.controller.js')))
  assert.ok(result.findings.some(finding => finding.includes('orphan.controller.js')))
  assert.ok(result.findings.some(finding => finding.includes('与审计基线不一致')))
})

test('controller database audit counts SQL and transaction calls and rejects growth', (t) => {
  const { controllersRoot } = createFixture(t)
  const source = `
    class SampleController {
      async list(connection) {
        await connection.beginTransaction()
        await connection.execute('SELECT 1')
        await connection.commit()
      }
    }
  `
  writeFileSync(join(controllersRoot, 'sample.controller.js'), source)
  const calls = analyzeControllerDatabaseCalls('sample.controller.js', source)
  assert.deepEqual(calls, { sql: 1, transaction: 2 })

  const baseline = { 'sample.controller.js': calls }
  const current = checkControllerDatabaseArchitecture({
    controllersRoot,
    callBaseline: baseline,
    maxSqlCalls: 1,
    maxTransactionCalls: 2
  })
  assert.deepEqual(current.findings, [])

  writeFileSync(join(controllersRoot, 'sample.controller.js'), `${source}\nconnection.query('SELECT 2')`)
  const grown = checkControllerDatabaseArchitecture({
    controllersRoot,
    callBaseline: baseline,
    maxSqlCalls: 1,
    maxTransactionCalls: 2
  })
  assert.ok(grown.findings.some(finding => finding.includes('不得增加')))

  writeFileSync(join(controllersRoot, 'sample.controller.js'), "connection.execute('SELECT 1')")
  const stale = checkControllerDatabaseArchitecture({
    controllersRoot,
    callBaseline: baseline,
    maxSqlCalls: 1,
    maxTransactionCalls: 2
  })
  assert.ok(stale.findings.some(finding => finding.includes('迁移后同步下调基线')))
})

test('controller database audit counts repository SQL wrappers', (t) => {
  const { controllersRoot } = createFixture(t)
  const source = `
    class SampleController {
      async list() {
        await this.repository.executePrepared('SELECT 1')
        await this.repository.executeQuery('SELECT 2')
        await this.repository.executeQueryWithTimeout('SELECT 3')
      }
    }
  `
  writeFileSync(join(controllersRoot, 'sample.controller.js'), source)
  const calls = analyzeControllerDatabaseCalls('sample.controller.js', source)
  assert.deepEqual(calls, { sql: 3, transaction: 0 })
  const baseline = { 'sample.controller.js': calls }
  assert.deepEqual(checkControllerDatabaseArchitecture({
    controllersRoot,
    callBaseline: baseline,
    maxSqlCalls: 3,
    maxTransactionCalls: 0
  }).findings, [])

  writeFileSync(join(controllersRoot, 'sample.controller.js'), `${source}\nthis.repository.executePrepared('SELECT 4')`)
  const grown = checkControllerDatabaseArchitecture({
    controllersRoot,
    callBaseline: baseline,
    maxSqlCalls: 3,
    maxTransactionCalls: 0
  })
  assert.ok(grown.findings.some(finding => finding.includes('controller 数据库调用不得增加')))
})

test('controller database audit requires exact max totals and removal of zero baseline shells', (t) => {
  const { controllersRoot } = createFixture(t)
  writeFileSync(join(controllersRoot, 'sample.controller.js'), 'class SampleController { run() {} }')
  const result = checkControllerDatabaseArchitecture({
    controllersRoot,
    callBaseline: { 'sample.controller.js': { sql: 0, transaction: 0 } },
    maxSqlCalls: 1,
    maxTransactionCalls: 0
  })
  assert.ok(result.findings.some(finding => finding.includes('最大值 1 必须等于逐文件基线总和 0')))
  assert.ok(result.findings.some(finding => finding.includes('已归零，必须删除空基线项')))
})

test('controller repository audit freezes existing direct imports and rejects new imports', (t) => {
  const { controllersRoot } = createFixture(t)
  const source = `
    const SampleRepository = require('../repositories/sample.repository')
    import OtherRepository from '../repositories/other.repository'
    async function loadRepository() { return import('../repositories/dynamic.repository') }
  `
  writeFileSync(join(controllersRoot, 'sample.controller.js'), source)
  assert.deepEqual(analyzeControllerRepositoryDependencies('sample.controller.js', source), [
    '../repositories/dynamic.repository',
    '../repositories/other.repository',
    '../repositories/sample.repository'
  ])

  const baseline = {
    'sample.controller.js': [
      '../repositories/dynamic.repository',
      '../repositories/sample.repository',
      '../repositories/other.repository'
    ]
  }
  const current = checkControllerRepositoryArchitecture({
    controllersRoot,
    dependencyBaseline: baseline,
    maxDependencies: 3
  })
  assert.deepEqual(current.findings, [])

  writeFileSync(join(controllersRoot, 'sample.controller.js'), `${source}\nrequire('../repositories/new.repository')`)
  const grown = checkControllerRepositoryArchitecture({
    controllersRoot,
    dependencyBaseline: baseline,
    maxDependencies: 3
  })
  assert.ok(grown.findings.some(finding => finding.includes('controller 新增 repository 直连依赖')))

  writeFileSync(join(controllersRoot, 'sample.controller.js'), "require('../repositories/sample.repository')")
  const stale = checkControllerRepositoryArchitecture({
    controllersRoot,
    dependencyBaseline: baseline,
    maxDependencies: 3
  })
  assert.ok(stale.findings.some(finding => finding.includes('必须同步收口基线')))
})

test('controller repository audit requires exact totals and removal of cleared baseline entries', (t) => {
  const { controllersRoot } = createFixture(t)
  writeFileSync(join(controllersRoot, 'sample.controller.js'), 'class SampleController {}')
  const result = checkControllerRepositoryArchitecture({
    controllersRoot,
    dependencyBaseline: { 'sample.controller.js': ['../repositories/old.repository'] },
    maxDependencies: 2
  })
  assert.ok(result.findings.some(finding => finding.includes('最大值 2 必须等于逐文件依赖总和 1')))
  assert.ok(result.findings.some(finding => finding.includes('已归零，必须删除空基线项')))
})

test('architecture foundation audit requires shared actor, base service and connection modules', (t) => {
  const { controllersRoot } = createFixture(t)
  const backendRoot = join(controllersRoot, '..')
  mkdirSync(join(backendRoot, 'types'))
  mkdirSync(join(backendRoot, 'core'))
  mkdirSync(join(backendRoot, 'core/base'))
  mkdirSync(join(backendRoot, 'core/db'))
  writeFileSync(join(backendRoot, 'types/actor.js'), `function getActorId(actor) { return actor.id }
module.exports = { getActorId }`)
  writeFileSync(join(backendRoot, 'core/base/base.service.js'), `const { getActorId } = require('../../types/actor')
class BaseService { getActorId(actor) { return getActorId(actor) } }
module.exports = BaseService`)
  writeFileSync(join(backendRoot, 'core/db/connection.js'), `async function withConnection(database, operation) {
  const connection = await database.getConnection()
  try { return await operation(connection) } finally { connection.release() }
}
module.exports = { withConnection }`)
  assert.deepEqual(checkBackendArchitectureFoundation({ backendRoot }).findings, [])
  writeFileSync(join(backendRoot, 'core/base/base.service.js'), '')
  assert.ok(checkBackendArchitectureFoundation({ backendRoot }).findings.some(finding => finding.includes('必须复用 types/actor.js')))
  rmSync(join(backendRoot, 'core/db/connection.js'))
  assert.ok(checkBackendArchitectureFoundation({ backendRoot }).findings.some(finding => finding.includes('core/db/connection.js')))
})

test('repository connection audit requires wrappers to delegate to the shared helper', (t) => {
  const { controllersRoot } = createFixture(t)
  const repositoriesRoot = join(controllersRoot, '../repositories')
  mkdirSync(repositoriesRoot, { recursive: true })
  writeFileSync(join(repositoriesRoot, 'good.repository.js'), `
    const { withConnection } = require('../core/db/connection')
    class GoodRepository {
      async withConnection(operation) { return withConnection(this.database, operation) }
    }
  `)
  assert.deepEqual(checkRepositoryConnectionArchitecture({ repositoriesRoot }).findings, [])
  writeFileSync(join(repositoriesRoot, 'dynamic.repository.js'), `
    class DynamicRepository {
      async withConnection(operation) {
        const { withConnection } = await import('../core/db/connection')
        return withConnection(this.database, operation)
      }
    }
  `)
  assert.deepEqual(checkRepositoryConnectionArchitecture({ repositoriesRoot }).findings, [])
  writeFileSync(join(repositoriesRoot, 'fake.repository.js'), `
    const { withConnection: sharedWithConnection } = require('../core/db/connection')
    class FakeRepository {
      async withConnection(operation) {
        const withConnection = (database, callback) => callback(database)
        return withConnection(this.database, operation)
      }
    }
  `)
  const fakeResult = checkRepositoryConnectionArchitecture({ repositoriesRoot })
  assert.ok(fakeResult.findings.some(finding => finding.includes('fake.repository.js')))
  writeFileSync(join(repositoriesRoot, 'bad.repository.js'), `
    class BadRepository {
      async withConnection(operation) { return operation(await this.database.getConnection()) }
    }
  `)
  const result = checkRepositoryConnectionArchitecture({ repositoriesRoot })
  assert.ok(result.findings.some(finding => finding.includes('bad.repository.js')))
})

test('database connection lease audit tracks all layers and rejects growth', (t) => {
  const { controllersRoot } = createFixture(t)
  const routesRoot = join(controllersRoot, '../routes')
  const servicesRoot = join(controllersRoot, '../services')
  const repositoriesRoot = join(controllersRoot, '../repositories')
  mkdirSync(servicesRoot, { recursive: true })
  mkdirSync(repositoriesRoot, { recursive: true })
  writeFileSync(join(routesRoot, 'legacy.js'), 'await pool.getConnection()')
  writeFileSync(join(servicesRoot, 'service.js'), 'await this.database.getConnection()')

  const sourceRoots = { routes: routesRoot, controllers: controllersRoot, services: servicesRoot, repositories: repositoriesRoot }
  const baseline = { 'routes/legacy.js': 1, 'services/service.js': 1 }
  const current = checkDatabaseConnectionLeaseArchitecture({ sourceRoots, leaseBaseline: baseline, maxLeases: 2 })
  assert.deepEqual(current.findings, [])

  writeFileSync(join(controllersRoot, 'new.controller.js'), 'await pool.getConnection()')
  const grown = checkDatabaseConnectionLeaseArchitecture({ sourceRoots, leaseBaseline: baseline, maxLeases: 2 })
  assert.ok(grown.findings.some(finding => finding.includes('新增直接数据库连接租借')))

  writeFileSync(join(servicesRoot, 'service.js'), 'module.exports = {}')
  const stale = checkDatabaseConnectionLeaseArchitecture({ sourceRoots, leaseBaseline: baseline, maxLeases: 2 })
  assert.ok(stale.findings.some(finding => finding.includes('必须删除空基线项')))
})

test('database connection lease audit requires exact totals', (t) => {
  const { controllersRoot } = createFixture(t)
  const sourceRoots = { controllers: controllersRoot }
  writeFileSync(join(controllersRoot, 'sample.controller.js'), 'module.exports = {}')
  const result = checkDatabaseConnectionLeaseArchitecture({
    sourceRoots,
    leaseBaseline: { 'controllers/sample.controller.js': 1 },
    maxLeases: 2
  })
  assert.ok(result.findings.some(finding => finding.includes('最大值 2 必须等于逐文件基线总和 1')))
  assert.ok(result.findings.some(finding => finding.includes('必须删除空基线项')))
})

test('database lease audit excludes pool accessors and counts acquired connections', (t) => {
  const { controllersRoot } = createFixture(t)
  const sourceRoots = { controllers: controllersRoot }
  const filePath = join(controllersRoot, 'sample.controller.js')
  writeFileSync(filePath, `
    class SampleController {
      getConnection() { return databasePool }
      list() { return this.getConnection().query('SELECT 1') }
      transaction() { return this.getConnection().getConnection() }
    }
    pool.getConnection()
  `)
  const result = checkDatabaseConnectionLeaseArchitecture({
    sourceRoots,
    leaseBaseline: { 'controllers/sample.controller.js': 2 },
    maxLeases: 2
  })
  assert.deepEqual(result.findings, [])
  assert.equal(result.currentLeases.get('controllers/sample.controller.js'), 2)
})

test('database lease audit excludes inherited BaseRepository pool access and counts its real acquisition', () => {
  const source = `
    const BaseRepository = require('../repositories/base.repository')
    class SampleRepository extends BaseRepository {
      list() { return this.getConnection().query('SELECT 1') }
      acquire() { return this.getConnection().getConnection() }
    }
  `

  assert.equal(analyzeDatabaseConnectionLeases('sample.repository.js', source), 1)
  assert.equal(analyzeDatabaseConnectionLeases('base.repository.js', `
    class BaseRepository {
      getConnection() { return databasePool }
      list() { return this.getConnection().query('SELECT 1') }
      acquireConnection() { return this.getConnection().getConnection() }
    }
  `), 1)
})

test('pool accessor exclusions stay within their class and do not hide returned leased connections', () => {
  assert.equal(analyzeDatabaseConnectionLeases('base.repository.js', `
    class PoolRepository {
      getConnection() { return databasePool }
      list() { return this.getConnection().query('SELECT 1') }
    }
    class LeaseRepository {
      async getConnection() {
        const connection = await pool.getConnection()
        return connection
      }
      run() { return this.getConnection() }
    }
  `), 2)
  assert.equal(analyzeDatabaseConnectionLeases('sample.repository.js', `
    const Base = require('./base.repository.js')
    class Sample extends Base {
      list() { return this.getConnection().query('SELECT 1') }
      acquire() { return this.getConnection().getConnection() }
    }
  `), 1)
  assert.equal(analyzeDatabaseConnectionLeases('stored-connections.service.js', `
    class StoredConnections {
      constructor() { this.externalConnections = new Map() }
      getConnection(id) {
        const entry = this.externalConnections.get(id)
        if (!entry) throw new Error('missing')
        return entry.connection
      }
      query(id) { return this.getConnection(id).query('SELECT 1') }
    }
  `), 0)
})

test('architecture baseline history is append-only and requires a reason for an increase', () => {
  const config = {
    maxLegacyNonControllerRoutes: 0,
    maxControllerSqlCalls: 4,
    maxControllerTransactionCalls: 2,
    maxControllerRepositoryDependencies: 1,
    maxForbiddenLayerDependencies: 0,
    maxDirectDatabaseConnectionLeases: 3,
    baselineHistory: Object.fromEntries([
      ['maxLegacyNonControllerRoutes', 0],
      ['maxControllerSqlCalls', 4],
      ['maxControllerTransactionCalls', 2],
      ['maxControllerRepositoryDependencies', 1],
      ['maxForbiddenLayerDependencies', 0],
      ['maxDirectDatabaseConnectionLeases', 3]
    ].map(([key, value]) => [key, [{ value, date: '2026-11-08', reason: '初始 AST 实测登记' }]]))
  }
  assert.deepEqual(checkArchitectureBaselineHistory(config).findings, [])

  const previous = structuredClone(config)
  const decreased = structuredClone(config)
  decreased.maxControllerSqlCalls = 3
  decreased.baselineHistory.maxControllerSqlCalls.push({ value: 3, date: '2026-11-09', reason: '迁移 SQL 至 repository' })
  assert.deepEqual(checkArchitectureBaselineHistory(decreased, previous).findings, [])

  const rewritten = structuredClone(decreased)
  rewritten.baselineHistory.maxControllerSqlCalls[0].reason = '改写既有锚点'
  assert.ok(checkArchitectureBaselineHistory(rewritten, previous).findings.some(finding => finding.includes('不可改写')))

  const raisedWithoutEntry = structuredClone(previous)
  raisedWithoutEntry.maxControllerSqlCalls = 5
  assert.ok(checkArchitectureBaselineHistory(raisedWithoutEntry, previous).findings.some(finding => finding.includes('必须等于历史锚点')))

  const raisedWithEntry = structuredClone(previous)
  raisedWithEntry.maxControllerSqlCalls = 5
  raisedWithEntry.baselineHistory.maxControllerSqlCalls.push({ value: 5, date: '2026-11-09', reason: '明确批准的兼容改造' })
  assert.deepEqual(checkArchitectureBaselineHistory(raisedWithEntry, previous).findings, [])

  const outOfOrderHistory = structuredClone(decreased)
  outOfOrderHistory.baselineHistory.maxControllerSqlCalls[1].date = '2026-11-07'
  assert.ok(checkArchitectureBaselineHistory(outOfOrderHistory).findings.some(finding => finding.includes('登记日期早于前一条记录')))

  const invalidCalendarDate = structuredClone(previous)
  invalidCalendarDate.baselineHistory.maxControllerSqlCalls[0].date = '2026-02-30'
  assert.ok(checkArchitectureBaselineHistory(invalidCalendarDate).findings.some(finding => finding.includes('必须包含非负整数 value、YYYY-MM-DD date 和 reason')))

  const unanchoredMax = structuredClone(previous)
  unanchoredMax.maxNewArchitectureDimension = 1
  assert.ok(checkArchitectureBaselineHistory(unanchoredMax).findings.some(finding => finding.includes('maxNewArchitectureDimension: baselineHistory 必须包含至少一条登记记录')))
})

test('architecture baselines cannot move debt between files without a max increase record', () => {
  const previous = {
    maxLegacyNonControllerRoutes: 0,
    legacyNonControllerRoutes: {},
    controllerDatabaseCalls: {
      'a.controller.js': { sql: 2, transaction: 0 },
      'b.controller.js': { sql: 1, transaction: 0 }
    },
    maxControllerSqlCalls: 3,
    maxControllerTransactionCalls: 0,
    controllerRepositoryDependencies: { 'a.controller.js': ['../repositories/a.repository'] },
    maxControllerRepositoryDependencies: 1,
    forbiddenLayerDependencies: {},
    maxForbiddenLayerDependencies: 0,
    directDatabaseConnectionLeases: { 'services/a.service.js': 2 },
    maxDirectDatabaseConnectionLeases: 2,
    baselineHistory: {
      maxLegacyNonControllerRoutes: [{ value: 0, date: '2026-11-08', reason: 'seed' }],
      maxControllerSqlCalls: [{ value: 3, date: '2026-11-08', reason: 'seed' }],
      maxControllerTransactionCalls: [{ value: 0, date: '2026-11-08', reason: 'seed' }],
      maxControllerRepositoryDependencies: [{ value: 1, date: '2026-11-08', reason: 'seed' }],
      maxForbiddenLayerDependencies: [{ value: 0, date: '2026-11-08', reason: 'seed' }],
      maxDirectDatabaseConnectionLeases: [{ value: 2, date: '2026-11-08', reason: 'seed' }]
    }
  }
  const movedDebt = structuredClone(previous)
  movedDebt.controllerDatabaseCalls['a.controller.js'].sql = 1
  movedDebt.controllerDatabaseCalls['b.controller.js'].sql = 2
  movedDebt.controllerRepositoryDependencies['a.controller.js'] = ['../repositories/b.repository']
  const findings = checkArchitectureBaselinesDoNotGrow(movedDebt, previous).findings
  assert.ok(findings.some(finding => finding.includes('b.controller.js')))
  assert.ok(findings.some(finding => finding.includes('新增基线依赖')))

  const approvedIncrease = structuredClone(previous)
  approvedIncrease.controllerDatabaseCalls['a.controller.js'].sql = 2
  approvedIncrease.controllerDatabaseCalls['b.controller.js'].sql = 2
  approvedIncrease.maxControllerSqlCalls = 4
  approvedIncrease.baselineHistory.maxControllerSqlCalls.push({
    value: 4, date: '2026-11-09', reason: '登记有依据的短期兼容 SQL'
  })
  assert.deepEqual(checkArchitectureBaselinesDoNotGrow(approvedIncrease, previous).findings, [])
})

test('layer dependency audit freezes existing reverse dependencies and rejects growth', (t) => {
  const { controllersRoot } = createFixture(t)
  const servicesRoot = join(controllersRoot, '../services')
  const repositoriesRoot = join(controllersRoot, '../repositories')
  mkdirSync(servicesRoot, { recursive: true })
  mkdirSync(repositoriesRoot, { recursive: true })
  writeFileSync(join(controllersRoot, 'sample.controller.js'), "require('../routes/sample')")
  writeFileSync(join(servicesRoot, 'sample.service.js'), "import Controller from '../controllers/sample.controller'\nimport('../routes/sample.js')")
  writeFileSync(join(repositoriesRoot, 'sample.repository.js'), "require('../services/sample.service')")

  const sourceRoots = { controllers: controllersRoot, services: servicesRoot, repositories: repositoriesRoot }
  const baseline = {
    'controllers/sample.controller.js': [{ layer: 'routes', path: '../routes/sample' }],
    'services/sample.service.js': [
      { layer: 'controllers', path: '../controllers/sample.controller' },
      { layer: 'routes', path: '../routes/sample.js' }
    ],
    'repositories/sample.repository.js': [{ layer: 'services', path: '../services/sample.service' }]
  }
  const result = checkLayerDependencyArchitecture({ sourceRoots, dependencyBaseline: baseline, maxDependencies: 4 })
  assert.deepEqual(result.findings, [])

  writeFileSync(join(controllersRoot, 'sample.controller.js'), "require('../routes/sample')\nrequire('../routes/another')")
  const grown = checkLayerDependencyArchitecture({ sourceRoots, dependencyBaseline: baseline, maxDependencies: 4 })
  assert.ok(grown.findings.some(finding => finding.includes('新增反向分层依赖')))

  writeFileSync(join(controllersRoot, 'sample.controller.js'), 'module.exports = {}')
  const stale = checkLayerDependencyArchitecture({ sourceRoots, dependencyBaseline: baseline, maxDependencies: 4 })
  assert.ok(stale.findings.some(finding => finding.includes('必须删除空基线项')))
})


test('lease receivers resolve imported repository pools and stored connections without hiding nested leases', t => {
  const { servicesRoot, repositoriesRoot } = createFixture(t)
  writeFileSync(join(repositoriesRoot, 'base.repository.js'), `
    class BaseRepository { getConnection() { return pool } }
    module.exports = BaseRepository
  `)
  writeFileSync(join(repositoriesRoot, 'attendance.repository.js'), `
    const BaseRepository = require('./base.repository')
    class AttendanceRepository extends BaseRepository {}
    module.exports = AttendanceRepository
  `)
  writeFileSync(join(servicesRoot, 'registry.service.js'), `
    class Registry {
      constructor() { this.entries = new Map() }
      getConnection(id) { const entry = this.entries.get(id); return entry.connection }
    }
    module.exports = Registry
  `)
  writeFileSync(join(servicesRoot, 'bridge.service.js'), `
    const Registry = require('./registry.service')
    class Bridge { constructor(registry = new Registry()) { this.registry = registry } }
    module.exports = Bridge
  `)
  const source = `
    const AttendanceRepository = require('../repositories/attendance.repository')
    const Registry = require('./registry.service')
    class Sample {
      constructor(registry = new Registry()) { this.repository = new AttendanceRepository(); Object.assign(this, { registry }) }
      run() {
        this.repository.getConnection()
        this.registry.getConnection('external')
        this.repository.getConnection().getConnection()
        pool.getConnection()
        unknown.getConnection()
      }
      first() {
        const Bridge = require('./bridge.service')
        const registry = new Registry()
        const bridge = new Bridge(registry)
        return bridge.registry.getConnection('external')
      }
      unrelated() { const registry = unknown; return registry }
    }
  `
  assert.equal(analyzeDatabaseConnectionLeases(join(servicesRoot, 'sample.service.js'), source), 3)
})

test('lease receiver resolution counts acquisition overrides, unknown arguments and reassigned properties', t => {
  const { servicesRoot, repositoriesRoot } = createFixture(t)
  writeFileSync(join(repositoriesRoot, 'base.repository.js'), `
    class BaseRepository { getConnection() { return pool } }
    module.exports = BaseRepository
  `)
  writeFileSync(join(repositoriesRoot, 'acquire.repository.js'), `
    const BaseRepository = require('./base.repository')
    class AcquireRepository extends BaseRepository { getConnection() { return pool.getConnection() } }
    module.exports = AcquireRepository
  `)
  writeFileSync(join(servicesRoot, 'bridge.service.js'), `
    const BaseRepository = require('../repositories/base.repository')
    class Bridge { constructor(repository = new BaseRepository()) { this.repository = repository } }
    module.exports = Bridge
  `)
  const source = `
    const AcquireRepository = require('../repositories/acquire.repository')
    const BaseRepository = require('../repositories/base.repository')
    const Bridge = require('./bridge.service')
    class Sample {
      constructor() { this.repository = new BaseRepository(); this.acquirer = new AcquireRepository() }
      replace(value) { this.repository = value }
      run() {
        this.acquirer.getConnection()
        this.repository.getConnection()
        const bridge = new Bridge(unknown)
        bridge.repository.getConnection()
      }
    }
  `
  assert.equal(analyzeDatabaseConnectionLeases(join(servicesRoot, 'sample.service.js'), source), 3)
})
