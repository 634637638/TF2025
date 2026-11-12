import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { ARCHITECTURE_CONFIG_PATH, loadArchitectureBaselineConfig } from './lib/architecture-baseline-config.mjs'
import {
  checkControllerDatabaseArchitecture,
  checkLayerDependencyArchitecture,
  checkControllerRepositoryArchitecture,
  checkRouteArchitecture,
  checkBackendArchitectureFoundation,
  checkRepositoryConnectionArchitecture,
  checkDatabaseConnectionLeaseArchitecture,
  checkArchitectureBaselineHistory,
  checkArchitectureBaselinesDoNotGrow,
  collectArchitectureSnapshot
} from './lib/route-architecture-analysis.mjs'

const projectRoot = resolve(import.meta.dirname, '../..')
const backendRoot = resolve(projectRoot, 'backend/src')
const configPath = resolve(projectRoot, ARCHITECTURE_CONFIG_PATH)
const config = JSON.parse(readFileSync(configPath, 'utf8'))
const targetBranch = process.env.GITHUB_BASE_REF
const baselineRef = process.env.ARCHITECTURE_BASELINE_REF || (targetBranch ? `origin/${targetBranch}` : 'HEAD')
let previousConfig = null
try {
  previousConfig = loadArchitectureBaselineConfig(projectRoot, baselineRef)
} catch {
  console.error(`无法从目标基线 ${baselineRef} 读取架构台账，拒绝跳过 max* 锚点比较`)
  process.exit(1)
}
if (!previousConfig) {
  if (process.env.ARCHITECTURE_BASELINE_REF) {
    console.error(`无法从目标基线 ${baselineRef} 读取架构台账，拒绝跳过 max* 锚点比较`)
    process.exit(1)
  }
  if (targetBranch) {
    console.warn(`目标分支 ${targetBranch} 尚无架构台账：按首次登记检查 baselineHistory；合入后将启用目标分支比较。`)
  } else {
    console.warn('架构台账尚未存在于 HEAD：按首次登记检查 baselineHistory；合入后将启用目标分支锚点比较。')
  }
}

const targetSnapshotDirectory = mkdtempSync(join(tmpdir(), 'tf2025-architecture-baseline-'))
let targetSourceBaseline
let targetSourceBaselineError
try {
  const archive = execFileSync('git', ['archive', '--format=tar', baselineRef, 'backend/src'], {
    cwd: projectRoot,
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore']
  })
  execFileSync('tar', ['-xf', '-', '-C', targetSnapshotDirectory], {
    cwd: projectRoot,
    input: archive,
    stdio: ['pipe', 'ignore', 'pipe']
  })
  const targetBackendRoot = resolve(targetSnapshotDirectory, 'backend/src')
  targetSourceBaseline = collectArchitectureSnapshot({
    sourceRoots: {
      routes: resolve(targetBackendRoot, 'routes'),
      controllers: resolve(targetBackendRoot, 'controllers'),
      services: resolve(targetBackendRoot, 'services'),
      repositories: resolve(targetBackendRoot, 'repositories')
    }
  })
} catch {
  targetSourceBaselineError = `无法从目标基线 ${baselineRef} 导出后端源码，拒绝跳过相对目标分支架构比较`
} finally {
  rmSync(targetSnapshotDirectory, { recursive: true, force: true })
}
if (targetSourceBaselineError) {
  console.error(targetSourceBaselineError)
  process.exit(1)
}
const baselineHistory = checkArchitectureBaselineHistory(config, previousConfig)
const baselineGrowth = checkArchitectureBaselinesDoNotGrow(config, previousConfig)
const targetSourceGrowth = checkArchitectureBaselinesDoNotGrow(config, targetSourceBaseline)
const baselineFindings = [
  ...baselineHistory.findings,
  ...baselineGrowth.findings,
  ...targetSourceGrowth.findings
]
if (baselineFindings.length) {
  console.error(`后端分层审计失败，共 ${baselineFindings.length} 项：`)
  for (const finding of baselineFindings) console.error(`- ${finding}`)
  process.exit(1)
}
const foundationArchitecture = checkBackendArchitectureFoundation({ backendRoot })
const repositoryConnectionArchitecture = checkRepositoryConnectionArchitecture({
  repositoriesRoot: resolve(backendRoot, 'repositories')
})
const foundationFindings = [
  ...foundationArchitecture.findings,
  ...repositoryConnectionArchitecture.findings
]
if (foundationFindings.length) {
  console.error(`后端分层审计失败，共 ${foundationFindings.length} 项：`)
  for (const finding of foundationFindings) console.error(`- ${finding}`)
  process.exit(1)
}
const baselineTotal = Object.values(config.legacyNonControllerRoutes)
  .reduce((sum, entry) => sum + entry.count, 0)
const baselineKeyCount = Object.keys(config.legacyNonControllerRoutes).length

if (baselineTotal !== config.maxLegacyNonControllerRoutes) {
  console.error(`后端分层审计失败：遗留 handler 基线总和 ${baselineTotal} 必须精确等于 maxLegacyNonControllerRoutes ${config.maxLegacyNonControllerRoutes}`)
  process.exit(1)
}

if (Object.values(config.legacyNonControllerRoutes).some(entry => entry.count <= 0)) {
  console.error('后端分层审计失败：legacyNonControllerRoutes 不得保留 count=0 的空壳')
  process.exit(1)
}

const { findings, currentRoutes } = checkRouteArchitecture({
  routesRoot: resolve(backendRoot, 'routes'),
  controllersRoot: resolve(backendRoot, 'controllers'),
  legacyRouteBaseline: config.legacyNonControllerRoutes
})

const currentInlineFileCount = currentRoutes.size
if (baselineKeyCount !== currentInlineFileCount) {
  findings.push(`遗留 key 数 ${baselineKeyCount} 必须等于仍有内联的文件数 ${currentInlineFileCount}`)
}

const controllerArchitecture = checkControllerDatabaseArchitecture({
  controllersRoot: resolve(backendRoot, 'controllers'),
  callBaseline: config.controllerDatabaseCalls,
  maxSqlCalls: config.maxControllerSqlCalls,
  maxTransactionCalls: config.maxControllerTransactionCalls
})
findings.push(...controllerArchitecture.findings)

const controllerRepositoryArchitecture = checkControllerRepositoryArchitecture({
  controllersRoot: resolve(backendRoot, 'controllers'),
  dependencyBaseline: config.controllerRepositoryDependencies,
  maxDependencies: config.maxControllerRepositoryDependencies
})
findings.push(...controllerRepositoryArchitecture.findings)

const layerDependencyArchitecture = checkLayerDependencyArchitecture({
  sourceRoots: {
    controllers: resolve(backendRoot, 'controllers'),
    services: resolve(backendRoot, 'services'),
    repositories: resolve(backendRoot, 'repositories')
  },
  dependencyBaseline: config.forbiddenLayerDependencies,
  maxDependencies: config.maxForbiddenLayerDependencies
})
findings.push(...layerDependencyArchitecture.findings)

const databaseConnectionLeaseArchitecture = checkDatabaseConnectionLeaseArchitecture({
  sourceRoots: {
    routes: resolve(backendRoot, 'routes'),
    controllers: resolve(backendRoot, 'controllers'),
    services: resolve(backendRoot, 'services'),
    repositories: resolve(backendRoot, 'repositories')
  },
  leaseBaseline: config.directDatabaseConnectionLeases,
  maxLeases: config.maxDirectDatabaseConnectionLeases
})
findings.push(...databaseConnectionLeaseArchitecture.findings)

if (findings.length) {
  console.error(`后端分层审计失败，共 ${findings.length} 项：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

const legacyCount = [...currentRoutes.values()].reduce((sum, routes) => sum + routes.length, 0)
const currentSqlCalls = [...controllerArchitecture.currentCalls.values()].reduce((sum, calls) => sum + calls.sql, 0)
const currentTransactionCalls = [...controllerArchitecture.currentCalls.values()].reduce((sum, calls) => sum + calls.transaction, 0)
const currentRepositoryDependencies = [...controllerRepositoryArchitecture.currentDependencies.values()].reduce((sum, dependencies) => sum + dependencies.length, 0)
const currentForbiddenLayerDependencies = [...layerDependencyArchitecture.currentDependencies.values()].reduce((sum, dependencies) => sum + dependencies.length, 0)
const currentDatabaseConnectionLeases = [...databaseConnectionLeaseArchitecture.currentLeases.values()].reduce((sum, count) => sum + count, 0)
const anchorComparison = previousConfig ? `目标分支 ${baselineRef} 锚点历史及逐文件台账已比较；` : ''
console.log(`后端分层审计通过：${anchorComparison}目标源码 ${baselineRef} 的逐文件 AST 基线已比较；基础设施=3/3，仓储 withConnection 共用实现；非 controller 路由 handler ${legacyCount}/${config.maxLegacyNonControllerRoutes}，遗留 key 数=${baselineKeyCount}，仍有内联的文件数=${currentInlineFileCount}，controller SQL=${currentSqlCalls}/${config.maxControllerSqlCalls}，controller 事务调用=${currentTransactionCalls}/${config.maxControllerTransactionCalls}，controller repository 直连=${currentRepositoryDependencies}/${config.maxControllerRepositoryDependencies}，反向分层依赖=${currentForbiddenLayerDependencies}/${config.maxForbiddenLayerDependencies}，直接数据库连接租借=${currentDatabaseConnectionLeases}/${config.maxDirectDatabaseConnectionLeases}，孤立 controller=0。新增业务 handler 迁入 controller；controller 通过 service 访问 repository。`)
