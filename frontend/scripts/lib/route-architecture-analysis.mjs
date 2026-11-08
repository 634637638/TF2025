import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { createHash } from 'node:crypto'
import ts from 'typescript'

const ROUTE_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all'])
// Controllers may reach SQL through the legacy BaseRepository execution
// wrappers as well as directly through mysql2.  Keep every SQL execution
// entry point in the same ratchet so an already-registered controller cannot
// grow more database work while its repository dependency is being migrated.
const CONTROLLER_SQL_METHODS = new Set([
  'execute',
  'query',
  'executePrepared',
  'executeQuery',
  'executeQueryWithTimeout'
])
const CONTROLLER_TRANSACTION_METHODS = new Set(['beginTransaction', 'commit', 'rollback'])

const getRouteReceiver = (expression) => {
  if (ts.isIdentifier(expression)) return expression
  if (
    ts.isCallExpression(expression)
    && ts.isPropertyAccessExpression(expression.expression)
    && expression.expression.name.text === 'route'
    && ts.isIdentifier(expression.expression.expression)
  ) return expression.expression.expression
  return null
}

const getPaths = (argument) => {
  if (argument && ts.isStringLiteralLike(argument)) return [argument.text]
  if (argument && ts.isArrayLiteralExpression(argument)) {
    return argument.elements.map((entry) => ts.isStringLiteralLike(entry) ? entry.text : null)
  }
  return [null]
}

const getRequirePath = (initializer) => (
  initializer
  && ts.isCallExpression(initializer)
  && ts.isIdentifier(initializer.expression)
  && initializer.expression.text === 'require'
  && initializer.arguments[0]
  && ts.isStringLiteralLike(initializer.arguments[0])
    ? initializer.arguments[0].text
    : null
)

const getDynamicImportPath = (node) => {
  let modulePath = null
  const visit = (current) => {
    if (
      ts.isCallExpression(current)
      && current.expression.kind === ts.SyntaxKind.ImportKeyword
      && current.arguments[0]
      && ts.isStringLiteralLike(current.arguments[0])
    ) modulePath = current.arguments[0].text
    ts.forEachChild(current, visit)
  }
  if (node) visit(node)
  return modulePath
}

const collectControllerBindings = (sourceFile) => {
  const controllerClasses = new Map()
  const controllerInstances = new Map()
  const controllerMethods = new Map()

  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      if (node.moduleSpecifier.text.includes('/controllers/')) {
        const controllerModule = node.moduleSpecifier.text
        if (node.importClause?.name) controllerClasses.set(node.importClause.name.text, controllerModule)
        if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
          for (const element of node.importClause.namedBindings.elements) {
            controllerMethods.set(element.name.text, controllerModule)
          }
        }
      }
    }

    if (ts.isVariableDeclaration(node) && node.initializer) {
      const requirePath = getRequirePath(node.initializer)
      if (requirePath?.includes('/controllers/')) {
        if (ts.isIdentifier(node.name)) controllerClasses.set(node.name.text, requirePath)
        if (ts.isObjectBindingPattern(node.name)) {
          for (const element of node.name.elements) {
            const name = element.propertyName || element.name
            if (ts.isIdentifier(name)) controllerMethods.set(name.text, requirePath)
          }
        }
      } else if (
        ts.isIdentifier(node.name)
        && ts.isNewExpression(node.initializer)
        && ts.isIdentifier(node.initializer.expression)
        && controllerClasses.has(node.initializer.expression.text)
      ) {
        controllerInstances.set(node.name.text, controllerClasses.get(node.initializer.expression.text))
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return { controllerClasses, controllerInstances, controllerMethods }
}

const getControllerModuleForHandler = (handler, bindings) => {
  if (!handler) return null
  if (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) {
    const body = handler.body
    if (!ts.isBlock(body)) return getControllerModuleForHandler(body, bindings)
    if (body.statements.length !== 1) return null
    const statement = body.statements[0]
    if (ts.isExpressionStatement(statement)) {
      return getControllerModuleForHandler(statement.expression, bindings)
    }
    if (ts.isReturnStatement(statement)) {
      return getControllerModuleForHandler(statement.expression, bindings)
    }
    return null
  }
  if (ts.isIdentifier(handler)) return bindings.controllerMethods.get(handler.text) || null
  if (ts.isCallExpression(handler) && ts.isPropertyAccessExpression(handler.expression)) {
    if (handler.expression.name.text === 'bind') {
      return getControllerModuleForHandler(handler.expression.expression, bindings)
    }
    return getControllerModuleForHandler(handler.expression, bindings)
  }
  if (ts.isPropertyAccessExpression(handler) && ts.isIdentifier(handler.expression)) {
    return bindings.controllerInstances.get(handler.expression.text)
      || bindings.controllerClasses.get(handler.expression.text)
      || null
  }
  return null
}

export function analyzeRouteArchitecture(filePath, source) {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const bindings = collectControllerBindings(sourceFile)
  const routes = []
  const usedControllerModules = new Set()

  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text.toLowerCase()
      const receiver = getRouteReceiver(node.expression.expression)
      if (receiver && /router/i.test(receiver.text) && ROUTE_METHODS.has(method)) {
        const chained = ts.isCallExpression(node.expression.expression)
        const pathArgument = chained
          ? node.expression.expression.arguments[0]
          : node.arguments[0]
        const handler = node.arguments[node.arguments.length - 1]
        const controllerModule = getControllerModuleForHandler(handler, bindings)
        if (controllerModule) usedControllerModules.add(controllerModule)
        for (const routePath of getPaths(pathArgument)) {
          routes.push({
            method: method.toUpperCase(),
            path: routePath,
            usesController: Boolean(controllerModule) && !(handler && (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler))),
            handlerSource: handler ? source.slice(handler.getStart(sourceFile), handler.end) : '',
            inlineHandler: Boolean(handler && (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)))
          })
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return { routes, controllerModules: [...usedControllerModules] }
}

const walkJsFiles = (directory) => readdirSync(directory).flatMap((name) => {
  const filePath = join(directory, name)
  return statSync(filePath).isDirectory()
    ? walkJsFiles(filePath)
    : filePath.endsWith('.js') ? [filePath] : []
})

export function digestLegacyRoutes(routes) {
  const signatures = routes
    .map(({ method, path: routePath, handlerSource }) => `${method} ${routePath}\n${handlerSource}`)
    .sort()
  return createHash('sha256').update(signatures.join('\n')).digest('hex')
}

export function analyzeControllerDatabaseCalls(filePath, source) {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const calls = { sql: 0, transaction: 0 }
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text
      if (CONTROLLER_SQL_METHODS.has(method)) calls.sql += 1
      if (CONTROLLER_TRANSACTION_METHODS.has(method)) calls.transaction += 1
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return calls
}

export function checkControllerDatabaseArchitecture({ controllersRoot, callBaseline, maxSqlCalls, maxTransactionCalls }) {
  const findings = []
  const currentCalls = new Map()
  for (const filePath of walkJsFiles(controllersRoot)) {
    const relativePath = relative(controllersRoot, filePath).replaceAll('\\', '/')
    const calls = analyzeControllerDatabaseCalls(filePath, readFileSync(filePath, 'utf8'))
    if (calls.sql || calls.transaction) currentCalls.set(relativePath, calls)
  }

  const baselineSqlCalls = Object.values(callBaseline).reduce((sum, calls) => sum + calls.sql, 0)
  const baselineTransactionCalls = Object.values(callBaseline).reduce((sum, calls) => sum + calls.transaction, 0)
  if (baselineSqlCalls !== maxSqlCalls) {
    findings.push(`controller SQL 基线最大值 ${maxSqlCalls} 必须等于逐文件基线总和 ${baselineSqlCalls}`)
  }
  if (baselineTransactionCalls !== maxTransactionCalls) {
    findings.push(`controller 事务基线最大值 ${maxTransactionCalls} 必须等于逐文件基线总和 ${baselineTransactionCalls}`)
  }

  const fileNames = new Set([...Object.keys(callBaseline), ...currentCalls.keys()])
  for (const fileName of fileNames) {
    const baseline = callBaseline[fileName]
    const current = currentCalls.get(fileName)
    if (!baseline && current) {
      findings.push(`${fileName}: controller 新增数据库调用（SQL=${current.sql}, 事务=${current.transaction}），必须迁入 service/repository`)
      continue
    }
    if (baseline && !current) {
      findings.push(`${fileName}: controller SQL 基线已归零，必须删除空基线项`)
      continue
    }
    if (!baseline || !current) continue
    if (baseline.sql <= 0 && baseline.transaction <= 0) {
      findings.push(`${fileName}: controller 数据库调用基线不得保留空壳`)
    }
    if (current.sql !== baseline.sql || current.transaction !== baseline.transaction) {
      findings.push(`${fileName}: controller 数据库调用台账必须与实测一致（SQL ${current.sql}/${baseline.sql}, 事务 ${current.transaction}/${baseline.transaction}）；迁移后同步下调基线`)
    }
    if (current.sql > baseline.sql || current.transaction > baseline.transaction) {
      findings.push(`${fileName}: controller 数据库调用不得增加（SQL ${current.sql}/${baseline.sql}, 事务 ${current.transaction}/${baseline.transaction}）`)
    }
  }

  return { findings, currentCalls }
}

export function analyzeControllerRepositoryDependencies(filePath, source) {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const dependencies = new Set()
  const visit = (node) => {
    if (ts.isCallExpression(node) && (
      ts.isIdentifier(node.expression) && node.expression.text === 'require'
      || node.expression.kind === ts.SyntaxKind.ImportKeyword
    )) {
      const argument = node.arguments[0]
      if (argument && ts.isStringLiteralLike(argument) && /(?:^|\/)repositories\//.test(argument.text)) {
        dependencies.add(argument.text)
      }
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier) && /(?:^|\/)repositories\//.test(node.moduleSpecifier.text)) {
      dependencies.add(node.moduleSpecifier.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return [...dependencies].sort()
}

export function checkBackendArchitectureFoundation({ backendRoot }) {
  const findings = []
  const requiredContracts = {
    'types/actor.js': [
      [/function\s+getActorId\s*\(/, '必须实现 getActorId'],
      [/module\.exports\s*=\s*\{[^}]*\bgetActorId\b/s, '必须导出 getActorId']
    ],
    'core/base/base.service.js': [
      [/require\(['"]\.\.\/\.\.\/types\/actor['"]\)/, '必须复用 types/actor.js'],
      [/class\s+BaseService\b/, '必须实现 BaseService'],
      [/getActorId\s*\(\s*actor\s*\)/, '必须提供统一 actor ID 读取方法']
    ],
    'core/db/connection.js': [
      [/async\s+function\s+withConnection\s*\(/, '必须实现 withConnection'],
      [/finally\s*\{[^}]*connection\.release\(\)/s, '必须在 finally 中释放连接'],
      [/module\.exports\s*=\s*\{[^}]*\bwithConnection\b/s, '必须导出 withConnection']
    ]
  }

  for (const [relativePath, checks] of Object.entries(requiredContracts)) {
    const filePath = join(backendRoot, relativePath)
    if (!existsSync(filePath)) {
      findings.push(`后端架构基础文件缺失：${relativePath}`)
      continue
    }
    const source = readFileSync(filePath, 'utf8')
    for (const [pattern, message] of checks) {
      if (!pattern.test(source)) findings.push(`${relativePath}: ${message}`)
    }
  }

  return { findings }
}

export function checkRepositoryConnectionArchitecture({ repositoriesRoot }) {
  const findings = []
  const helperPath = '../core/db/connection'
  const methodName = 'withConnection'

  for (const filePath of walkJsFiles(repositoriesRoot)) {
    const source = readFileSync(filePath, 'utf8')
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
    let hasConnectionWrapper = false
    let delegatesToSharedHelper = false
    const sharedHelperBindings = new Set()
    const addSharedHelperBindings = (bindings) => {
      if (!bindings) return
      if (ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          const importedName = element.propertyName || element.name
          if (ts.isIdentifier(importedName) && importedName.text === methodName) {
            sharedHelperBindings.add(element.name.text)
          }
        }
      }
      if (ts.isObjectBindingPattern(bindings)) {
        for (const element of bindings.elements) {
          const importedName = element.propertyName || element.name
          if (ts.isIdentifier(importedName) && importedName.text === methodName && ts.isIdentifier(element.name)) {
            sharedHelperBindings.add(element.name.text)
          }
        }
      }
    }

    const collectSharedHelperBindings = (node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier) && node.moduleSpecifier.text === helperPath) {
        addSharedHelperBindings(node.importClause?.namedBindings)
      }
      if (ts.isVariableDeclaration(node) && node.initializer) {
        const importedPath = getRequirePath(node.initializer)
        if (importedPath === helperPath) addSharedHelperBindings(node.name)
        if (getDynamicImportPath(node.initializer) === helperPath) {
          addSharedHelperBindings(node.name)
        }
      }
      ts.forEachChild(node, collectSharedHelperBindings)
    }

    collectSharedHelperBindings(sourceFile)

    const visit = (node) => {
      if (
        (ts.isMethodDeclaration(node) || ts.isMethodSignature(node))
        && node.name
        && node.name.getText(sourceFile) === methodName
      ) {
        hasConnectionWrapper = true
        const inspectBody = (bodyNode) => {
          if (ts.isCallExpression(bodyNode) && ts.isIdentifier(bodyNode.expression) && sharedHelperBindings.has(bodyNode.expression.text)) {
            delegatesToSharedHelper = true
          }
          ts.forEachChild(bodyNode, inspectBody)
        }
        if (node.body) inspectBody(node.body)
      }
      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    if (hasConnectionWrapper && !delegatesToSharedHelper) {
      findings.push(`${relative(repositoriesRoot, filePath).replaceAll('\\', '/')}: withConnection 必须委托给 ../core/db/connection 公共实现`)
    }
  }

  return { findings }
}

function collectBaseRepositoryBindings(sourceFile) {
  const bindings = new Set()
  const visit = node => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)
      && /base\.repository(?:\.js)?$/.test(node.moduleSpecifier.text)
      && node.importClause?.name) bindings.add(node.importClause.name.text)
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
      && /base\.repository(?:\.js)?$/.test(getRequirePath(node.initializer) || '')) bindings.add(node.name.text)
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return bindings
}

function hasPoolAccessor(classNode, baseBindings) {
  const accessor = classNode.members.find(member => ts.isMethodDeclaration(member)
    && member.name?.getText() === 'getConnection')
  if (!accessor) {
    return classNode.heritageClauses?.some(clause => clause.token === ts.SyntaxKind.ExtendsKeyword
      && clause.types.some(type => ts.isIdentifier(type.expression) && baseBindings.has(type.expression.text))) || false
  }
  if (!accessor.body) return false
  const poolBindings = new Set()
  const connectionMaps = new Set()
  const storedEntries = new Set()
  for (const member of classNode.members) {
    if (!ts.isConstructorDeclaration(member) || !member.body) continue
    const inspect = node => {
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isPropertyAccessExpression(node.left) && ts.isThis(node.left.expression)
        && ts.isNewExpression(node.right) && ts.isIdentifier(node.right.expression)
        && node.right.expression.text === 'Map') connectionMaps.add(node.left.name.text)
      ts.forEachChild(node, inspect)
    }
    inspect(member.body)
  }
  const isPool = expression => {
    if (!expression) return false
    if (ts.isIdentifier(expression)) return poolBindings.has(expression.text) || /^(?:databasePool|pool)$/.test(expression.text)
    if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)) {
      return ['getDatabase', 'getPool'].includes(expression.expression.text)
    }
    if (ts.isPropertyAccessExpression(expression) && expression.name.text === 'connection'
      && ts.isIdentifier(expression.expression) && storedEntries.has(expression.expression.text)) return true
    return ts.isPropertyAccessExpression(expression) && ts.isThis(expression.expression)
      && ['pool', 'databasePool'].includes(expression.name.text)
  }
  let returns = 0
  let allReturnsPool = true
  const visit = node => {
    // A nested callback's return value says nothing about this accessor.
    if (node !== accessor.body && ts.isFunctionLike(node)) return
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
      && ts.isCallExpression(node.initializer) && ts.isPropertyAccessExpression(node.initializer.expression)
      && node.initializer.expression.name.text === 'get') {
      const receiver = node.initializer.expression.expression
      if (ts.isPropertyAccessExpression(receiver) && ts.isThis(receiver.expression)
        && connectionMaps.has(receiver.name.text)) storedEntries.add(node.name.text)
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && isPool(node.initializer)) poolBindings.add(node.name.text)
    if (ts.isReturnStatement(node)) {
      returns += 1
      allReturnsPool &&= isPool(node.expression)
    }
    ts.forEachChild(node, visit)
  }
  visit(accessor.body)
  return returns > 0 && allReturnsPool
}

export function analyzeDatabaseConnectionLeases(filePath, source) {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const baseBindings = collectBaseRepositoryBindings(sourceFile)
  let count = 0
  const visit = (node, poolAccessor = false) => {
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) poolAccessor = hasPoolAccessor(node, baseBindings)
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'getConnection'
      && !(poolAccessor && ts.isThis(node.expression.expression))) count += 1
    ts.forEachChild(node, child => visit(child, poolAccessor))
  }
  visit(sourceFile)
  return count
}

export function checkDatabaseConnectionLeaseArchitecture({ sourceRoots, leaseBaseline, maxLeases }) {
  const findings = []
  const currentLeases = new Map()

  for (const [sourceLayer, sourceRoot] of Object.entries(sourceRoots)) {
    for (const filePath of walkJsFiles(sourceRoot)) {
      const relativePath = `${sourceLayer}/${relative(sourceRoot, filePath).replaceAll('\\', '/')}`
      const count = analyzeDatabaseConnectionLeases(filePath, readFileSync(filePath, 'utf8'))
      if (count) currentLeases.set(relativePath, count)
    }
  }

  const baselineTotal = Object.values(leaseBaseline).reduce((sum, count) => sum + count, 0)
  if (baselineTotal !== maxLeases) {
    findings.push(`数据库连接租借基线最大值 ${maxLeases} 必须等于逐文件基线总和 ${baselineTotal}`)
  }

  const fileNames = new Set([...Object.keys(leaseBaseline), ...currentLeases.keys()])
  for (const fileName of fileNames) {
    const baseline = leaseBaseline[fileName]
    const current = currentLeases.get(fileName) || 0
    if (baseline === undefined && current > 0) {
      findings.push(`${fileName}: 新增直接数据库连接租借（${current}），必须通过共享 withConnection 或同步收敛台账`)
      continue
    }
    if (baseline !== undefined && current === 0) {
      findings.push(`${fileName}: 数据库连接租借已归零，必须删除空基线项`)
      continue
    }
    if (baseline !== undefined && current !== baseline) {
      findings.push(`${fileName}: 数据库连接租借台账必须与实测一致（${current}/${baseline}）；迁移后同步下调基线，且不得增加`)
    }
  }

  return { findings, currentLeases }
}

export function checkArchitectureBaselineHistory(config, previousConfig = null) {
  const findings = []
  const history = config.baselineHistory
  const maxKeys = Object.keys(config).filter(key => /^max[A-Z]/.test(key))

  if (!history || typeof history !== 'object') {
    return { findings: ['缺少 baselineHistory，所有 max* 必须有单调登记序列'] }
  }

  for (const historyKey of Object.keys(history)) {
    if (!maxKeys.includes(historyKey)) findings.push(`${historyKey}: baselineHistory 包含无对应 max* 的失效锚点`)
  }

  for (const maxKey of maxKeys) {
    const entries = history[maxKey]
    if (!Array.isArray(entries) || entries.length === 0) {
      findings.push(`${maxKey}: baselineHistory 必须包含至少一条登记记录`)
      continue
    }
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]
      const date = entry?.date || ''
      const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
        && !Number.isNaN(Date.parse(`${date}T00:00:00.000Z`))
        && new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) === date
      if (!Number.isInteger(entry?.value) || entry.value < 0 || !validDate || !entry?.reason?.trim()) {
        findings.push(`${maxKey}: 第 ${index + 1} 条历史记录必须包含非负整数 value、YYYY-MM-DD date 和 reason`)
        continue
      }
      if (index > 0 && entry.date < entries[index - 1].date) {
        findings.push(`${maxKey}: 第 ${index + 1} 条历史登记日期早于前一条记录`)
      }
    }
    if (entries.at(-1)?.value !== config[maxKey]) {
      findings.push(`${maxKey}: 当前值 ${config[maxKey]} 必须等于历史锚点最新值 ${entries.at(-1)?.value}`)
    }
  }

  if (previousConfig) {
    for (const maxKey of maxKeys) {
      const previousEntries = previousConfig.baselineHistory?.[maxKey] || []
      const currentEntries = history[maxKey] || []
      if (currentEntries.length < previousEntries.length) {
        findings.push(`${maxKey}: 不得删除或缩短已登记历史锚点`)
        continue
      }
      const prefixMatches = previousEntries.every((entry, index) => JSON.stringify(entry) === JSON.stringify(currentEntries[index]))
      if (!prefixMatches) findings.push(`${maxKey}: 已有历史锚点不可改写，新增记录只能追加`)
      if (currentEntries.length === previousEntries.length && config[maxKey] > previousConfig[maxKey]) {
        findings.push(`${maxKey}: 相对目标分支上调 ${previousConfig[maxKey]} → ${config[maxKey]}，必须追加带事由的历史锚点`)
      }
    }
  }

  return { findings }
}

export function checkArchitectureBaselinesDoNotGrow(config, previousConfig) {
  if (!previousConfig) return { findings: [] }
  const findings = []
  const raiseApproved = (maxKey) => {
    const priorHistory = previousConfig.baselineHistory?.[maxKey] || []
    const nextHistory = config.baselineHistory?.[maxKey] || []
    const appended = nextHistory.length > priorHistory.length
      && priorHistory.every((entry, index) => (
        entry.value === nextHistory[index]?.value
        && entry.date === nextHistory[index]?.date
        && entry.reason === nextHistory[index]?.reason
      ))
    const latest = nextHistory.at(-1)
    return appended
      && config[maxKey] > previousConfig[maxKey]
      && latest?.value === config[maxKey]
      && Boolean(latest?.reason?.trim())
  }
  const compareCounts = (label, current = {}, previous = {}, maxKey) => {
    const approved = raiseApproved(maxKey)
    for (const [file, count] of Object.entries(current)) {
      const prior = previous[file] || 0
      if (count > prior && !approved) {
        findings.push(`${label} ${file}: 基线从 ${prior} 增至 ${count}，总 max 未通过带事由的上调锚点批准`)
      }
    }
  }

  compareCounts(
    'route handler',
    Object.fromEntries(Object.entries(config.legacyNonControllerRoutes || {}).map(([file, entry]) => [file, entry.count])),
    Object.fromEntries(Object.entries(previousConfig.legacyNonControllerRoutes || {}).map(([file, entry]) => [file, entry.count])),
    'maxLegacyNonControllerRoutes'
  )
  const routeIncreaseApproved = raiseApproved('maxLegacyNonControllerRoutes')
  for (const [file, entry] of Object.entries(config.legacyNonControllerRoutes || {})) {
    const previous = previousConfig.legacyNonControllerRoutes?.[file]
    const sameCount = previous && entry.count === previous.count
    if (previous && entry.count >= previous.count && entry.digest !== previous.digest
      && (sameCount || !routeIncreaseApproved)) {
      findings.push(`route handler ${file}: count 未下降时不得改写既有实现摘要`)
    }
  }

  for (const dimension of [
    ['sql', 'maxControllerSqlCalls'],
    ['transaction', 'maxControllerTransactionCalls']
  ]) {
    const [field, maxKey] = dimension
    const current = config.controllerDatabaseCalls || {}
    const previous = previousConfig.controllerDatabaseCalls || {}
    for (const [file, calls] of Object.entries(current)) {
      const prior = previous[file]?.[field] || 0
      if ((calls[field] || 0) > prior && !raiseApproved(maxKey)) {
        findings.push(`controller ${field} ${file}: 基线从 ${prior} 增至 ${calls[field]}，总 max 未通过带事由的上调锚点批准`)
      }
    }
  }

  const compareDependencies = (label, current = {}, previous = {}, maxKey, serialize = value => value) => {
    const approved = raiseApproved(maxKey)
    for (const [file, dependencies] of Object.entries(current)) {
      const prior = previous[file] || []
      const priorKeys = new Set(prior.map(serialize))
      const additions = dependencies.map(serialize).filter(value => !priorKeys.has(value))
      if (additions.length && !approved) {
        findings.push(`${label} ${file}: 新增基线依赖 ${additions.join(', ')}，总 max 未通过带事由的上调锚点批准`)
      }
    }
  }
  compareDependencies(
    'controller repository 依赖',
    config.controllerRepositoryDependencies,
    previousConfig.controllerRepositoryDependencies,
    'maxControllerRepositoryDependencies'
  )
  compareDependencies(
    '反向分层依赖',
    config.forbiddenLayerDependencies,
    previousConfig.forbiddenLayerDependencies,
    'maxForbiddenLayerDependencies',
    dependency => `${dependency.layer}:${dependency.path}`
  )
  compareCounts(
    '数据库连接租借',
    config.directDatabaseConnectionLeases,
    previousConfig.directDatabaseConnectionLeases,
    'maxDirectDatabaseConnectionLeases'
  )

  return { findings }
}

export function checkControllerRepositoryArchitecture({ controllersRoot, dependencyBaseline, maxDependencies }) {
  const findings = []
  const currentDependencies = new Map()
  for (const filePath of walkJsFiles(controllersRoot)) {
    const relativePath = relative(controllersRoot, filePath).replaceAll('\\', '/')
    const dependencies = analyzeControllerRepositoryDependencies(filePath, readFileSync(filePath, 'utf8'))
    if (dependencies.length) currentDependencies.set(relativePath, dependencies)
  }

  const baselineTotal = Object.values(dependencyBaseline).reduce((sum, dependencies) => sum + dependencies.length, 0)
  if (baselineTotal !== maxDependencies) {
    findings.push(`controller repository 依赖基线最大值 ${maxDependencies} 必须等于逐文件依赖总和 ${baselineTotal}`)
  }

  const fileNames = new Set([...Object.keys(dependencyBaseline), ...currentDependencies.keys()])
  for (const fileName of fileNames) {
    const baseline = dependencyBaseline[fileName]
    const current = currentDependencies.get(fileName) || []
    if (!baseline && current.length) {
      findings.push(`${fileName}: controller 新增 repository 直连依赖，必须通过 service 访问 repository`)
      continue
    }
    if (baseline && current.length === 0) {
      findings.push(`${fileName}: controller repository 依赖已归零，必须删除空基线项`)
      continue
    }
    if (!baseline) continue
    const additions = current.filter(dependency => !baseline.includes(dependency))
    if (additions.length) {
      findings.push(`${fileName}: controller 新增 repository 直连依赖（${additions.join(', ')}），必须通过 service 访问 repository`)
    }
    const stale = baseline.filter(dependency => !current.includes(dependency))
    if (stale.length) {
      findings.push(`${fileName}: controller repository 依赖已移除，必须同步收口基线（${stale.join(', ')}）`)
    }
  }

  return { findings, currentDependencies }
}

const getLayerImports = (sourceFile) => {
  const imports = []
  const add = (specifier) => {
    if (!specifier) return
    const segments = specifier.split('/').filter(Boolean)
    for (const layer of ['routes', 'controllers', 'services', 'repositories']) {
      if (segments.includes(layer)) imports.push({ layer, specifier })
    }
  }

  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      add(node.moduleSpecifier.text)
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      add(node.moduleSpecifier.text)
    } else if (
      ts.isCallExpression(node)
      && (ts.isIdentifier(node.expression) && node.expression.text === 'require'
        || node.expression.kind === ts.SyntaxKind.ImportKeyword)
      && node.arguments[0]
      && ts.isStringLiteralLike(node.arguments[0])
    ) {
      add(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return imports
}

export function collectArchitectureSnapshot({ sourceRoots }) {
  const legacyNonControllerRoutes = {}
  for (const filePath of walkJsFiles(sourceRoots.routes)) {
    const source = readFileSync(filePath, 'utf8')
    const analyzed = analyzeRouteArchitecture(filePath, source)
    const inlineRoutes = analyzed.routes.filter(route => route.inlineHandler)
    if (inlineRoutes.length) {
      legacyNonControllerRoutes[basename(filePath)] = {
        count: inlineRoutes.length,
        digest: digestLegacyRoutes(inlineRoutes)
      }
    }
  }

  const controllerDatabaseCalls = {}
  for (const filePath of walkJsFiles(sourceRoots.controllers)) {
    const calls = analyzeControllerDatabaseCalls(filePath, readFileSync(filePath, 'utf8'))
    if (calls.sql || calls.transaction) controllerDatabaseCalls[relative(sourceRoots.controllers, filePath).replaceAll('\\', '/')] = calls
  }

  const controllerRepositoryDependencies = {}
  for (const filePath of walkJsFiles(sourceRoots.controllers)) {
    const dependencies = analyzeControllerRepositoryDependencies(filePath, readFileSync(filePath, 'utf8'))
    if (dependencies.length) controllerRepositoryDependencies[relative(sourceRoots.controllers, filePath).replaceAll('\\', '/')] = dependencies
  }

  const forbiddenLayerDependencies = {}
  const forbiddenLayers = {
    controllers: new Set(['routes']),
    services: new Set(['routes', 'controllers']),
    repositories: new Set(['routes', 'controllers', 'services'])
  }
  for (const [sourceLayer, sourceRoot] of Object.entries(sourceRoots)) {
    const forbidden = forbiddenLayers[sourceLayer]
    if (!forbidden) continue
    for (const filePath of walkJsFiles(sourceRoot)) {
      const sourceFile = ts.createSourceFile(filePath, readFileSync(filePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
      const dependencies = getLayerImports(sourceFile)
        .filter(dependency => forbidden.has(dependency.layer))
        .map(({ layer, specifier }) => ({ layer, path: specifier }))
      if (dependencies.length) {
        forbiddenLayerDependencies[`${sourceLayer}/${relative(sourceRoot, filePath).replaceAll('\\', '/')}`] = dependencies
      }
    }
  }

  const directDatabaseConnectionLeases = {}
  for (const [sourceLayer, sourceRoot] of Object.entries(sourceRoots)) {
    for (const filePath of walkJsFiles(sourceRoot)) {
      const count = analyzeDatabaseConnectionLeases(filePath, readFileSync(filePath, 'utf8'))
      if (count) directDatabaseConnectionLeases[`${sourceLayer}/${relative(sourceRoot, filePath).replaceAll('\\', '/')}`] = count
    }
  }

  const sum = values => Object.values(values).reduce((total, value) => total + value, 0)
  return {
    legacyNonControllerRoutes,
    maxLegacyNonControllerRoutes: sum(Object.fromEntries(Object.entries(legacyNonControllerRoutes).map(([file, entry]) => [file, entry.count]))),
    controllerDatabaseCalls,
    maxControllerSqlCalls: sum(Object.fromEntries(Object.entries(controllerDatabaseCalls).map(([file, calls]) => [file, calls.sql]))),
    maxControllerTransactionCalls: sum(Object.fromEntries(Object.entries(controllerDatabaseCalls).map(([file, calls]) => [file, calls.transaction]))),
    controllerRepositoryDependencies,
    maxControllerRepositoryDependencies: sum(Object.fromEntries(Object.entries(controllerRepositoryDependencies).map(([file, dependencies]) => [file, dependencies.length]))),
    forbiddenLayerDependencies,
    maxForbiddenLayerDependencies: sum(Object.fromEntries(Object.entries(forbiddenLayerDependencies).map(([file, dependencies]) => [file, dependencies.length]))),
    directDatabaseConnectionLeases,
    maxDirectDatabaseConnectionLeases: sum(directDatabaseConnectionLeases)
  }
}

export function checkLayerDependencyArchitecture({ sourceRoots, dependencyBaseline, maxDependencies }) {
  const findings = []
  const currentDependencies = new Map()
  const forbiddenLayers = {
    controllers: new Set(['routes']),
    services: new Set(['routes', 'controllers']),
    repositories: new Set(['routes', 'controllers', 'services'])
  }

  for (const [sourceLayer, sourceRoot] of Object.entries(sourceRoots)) {
    const forbidden = forbiddenLayers[sourceLayer]
    if (!forbidden) continue
    for (const filePath of walkJsFiles(sourceRoot)) {
      const sourceFile = ts.createSourceFile(filePath, readFileSync(filePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
      const fileName = relative(sourceRoot, filePath).replaceAll('\\', '/')
      for (const dependency of getLayerImports(sourceFile)) {
        if (forbidden.has(dependency.layer)) {
          const key = `${sourceLayer}/${fileName}`
          const dependencies = currentDependencies.get(key) || []
          dependencies.push({ layer: dependency.layer, path: dependency.specifier })
          currentDependencies.set(key, dependencies)
        }
      }
    }
  }

  const baselineTotal = Object.values(dependencyBaseline).reduce((sum, dependencies) => sum + dependencies.length, 0)
  if (baselineTotal !== maxDependencies) {
    findings.push(`反向分层依赖基线最大值 ${maxDependencies} 必须等于逐文件基线总和 ${baselineTotal}`)
  }

  const fileNames = new Set([...Object.keys(dependencyBaseline), ...currentDependencies.keys()])
  for (const fileName of fileNames) {
    const baseline = dependencyBaseline[fileName]
    const current = currentDependencies.get(fileName) || []
    if (!baseline && current.length) {
      findings.push(`${fileName}: 新增反向分层依赖，必须迁入正确层级（${current.map(({ layer, path }) => `${layer}:${path}`).join(', ')}）`)
      continue
    }
    if (baseline && current.length === 0) {
      findings.push(`${fileName}: 反向分层依赖已归零，必须删除空基线项`)
      continue
    }
    if (!baseline) continue
    const serialize = ({ layer, path }) => `${layer}:${path}`
    const currentKeys = current.map(serialize)
    const baselineKeys = baseline.map(serialize)
    const additions = currentKeys.filter(dependency => !baselineKeys.includes(dependency))
    const stale = baselineKeys.filter(dependency => !currentKeys.includes(dependency))
    if (additions.length) findings.push(`${fileName}: 新增反向分层依赖，必须迁入正确层级（${additions.join(', ')}）`)
    if (stale.length) findings.push(`${fileName}: 反向分层依赖已移除，必须同步收口基线（${stale.join(', ')}）`)
  }

  return { findings, currentDependencies }
}

export function checkRouteArchitecture({ routesRoot, controllersRoot, legacyRouteBaseline }) {
  const findings = []
  const controllerReferences = new Set()
  const currentRoutes = new Map()

  for (const filePath of walkJsFiles(routesRoot)) {
    const relativePath = relative(routesRoot, filePath).replaceAll('\\', '/')
    const source = readFileSync(filePath, 'utf8')
    const { routes, controllerModules } = analyzeRouteArchitecture(filePath, source)

    for (const controllerModule of controllerModules) {
      controllerReferences.add(`${basename(controllerModule)}.js`.replace(/\.js\.js$/, '.js'))
    }

    for (const route of routes) {
      if (!route.usesController) {
        const routes = currentRoutes.get(relativePath) || []
        routes.push(route)
        currentRoutes.set(relativePath, routes)
        if (!route.path) {
          findings.push(`${relativePath}: ${route.method} 路由路径无法静态识别`)
        }
      }
    }
  }

  const fileNames = new Set([...Object.keys(legacyRouteBaseline), ...currentRoutes.keys()])
  for (const fileName of fileNames) {
    const routes = currentRoutes.get(fileName) || []
    const baseline = legacyRouteBaseline[fileName]
    if (!baseline && routes.length > 0) {
      findings.push(`${fileName}: 发现新的非 controller 路由；route 必须委托给 controller`)
      continue
    }
    if (!baseline) continue

    const currentDigest = digestLegacyRoutes(routes)
    if (routes.length > baseline.count || currentDigest !== baseline.digest) {
      findings.push(`${fileName}: 旧 route handler 与审计基线不一致；新增或修改业务 handler 前应迁移到 controller`)
    }
  }

  for (const filePath of walkJsFiles(controllersRoot)) {
    const fileName = basename(filePath)
    if (!controllerReferences.has(fileName)) {
      findings.push(`${relative(controllersRoot, filePath)}: controller 未被任何 route 引用`)
    }
  }

  return { findings, currentRoutes }
}
