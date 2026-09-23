import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const frontendRoot = resolve(import.meta.dirname, '..')
const projectRoot = resolve(frontendRoot, '..')
const registryPath = resolve(projectRoot, 'backend/src/config/module-permission-capabilities.json')
const modulesConfigPath = resolve(frontendRoot, 'src/config/modules.ts')
const permissionMapperPath = resolve(frontendRoot, 'src/utils/permissionMapper.ts')
const pagePermissionsPath = resolve(frontendRoot, 'src/composables/usePagePermissions.ts')
const routerPath = resolve(frontendRoot, 'src/router/index.ts')
const backendConfigPath = resolve(projectRoot, 'backend/src/config/module-permission-actions.js')
const backendPermissionMappingPath = resolve(projectRoot, 'backend/src/config/permission-mapping.js')
const scannerPath = resolve(projectRoot, 'backend/src/services/moduleScanner_simple.js')
const findings = []

const readJson = path => JSON.parse(readFileSync(path, 'utf8'))
const unique = values => [...new Set(values)]
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right)

if (!existsSync(registryPath)) {
  console.error('权限能力审计失败：缺少 backend/src/config/module-permission-capabilities.json')
  process.exit(1)
}

const registry = readJson(registryPath)
const modules = registry.modules || {}
const actionDefinitions = registry.actionDefinitions || {}
const actionOrder = registry.actionOrder || []

if (!sameJson(registry.defaultActions, ['view'])) {
  findings.push('defaultActions 必须严格为 ["view"]，禁止未知模块自动获得增删改等权限')
}

if (unique(actionOrder).length !== actionOrder.length) {
  findings.push('actionOrder 存在重复动作')
}

for (const action of actionOrder) {
  if (!actionDefinitions[action]) findings.push(`动作 ${action} 缺少 actionDefinitions 说明`)
}

for (const [moduleKey, actions] of Object.entries(modules)) {
  if (!Array.isArray(actions) || actions.length === 0) {
    findings.push(`模块 ${moduleKey} 没有声明任何权限`)
    continue
  }
  if (!actions.includes('view')) findings.push(`模块 ${moduleKey} 必须包含 view 权限`)
  if (unique(actions).length !== actions.length) findings.push(`模块 ${moduleKey} 存在重复权限`)

  for (const action of actions) {
    if (!actionDefinitions[action]) findings.push(`模块 ${moduleKey} 使用了未定义动作 ${action}`)
    if (!actionOrder.includes(action)) findings.push(`模块 ${moduleKey} 的动作 ${action} 未加入 actionOrder`)
  }

  const expectedOrder = [...actions].sort((a, b) => actionOrder.indexOf(a) - actionOrder.indexOf(b))
  if (!sameJson(actions, expectedOrder)) findings.push(`模块 ${moduleKey} 的权限顺序未遵循 actionOrder`)
}

for (const [alias, target] of Object.entries(registry.scanAliases || {})) {
  if (!modules[target]) findings.push(`扫描别名 ${alias} 指向未登记模块 ${target}`)
}

const require = createRequire(import.meta.url)
const ts = require('typescript')
const backendConfig = require(backendConfigPath)
const backendPermissionMapping = require(backendPermissionMappingPath)
if (!sameJson([...backendConfig.DEFAULT_PERMISSION_TYPES], registry.defaultActions)) {
  findings.push('后端 DEFAULT_PERMISSION_TYPES 与共享能力清单不一致')
}
if (!sameJson([...backendConfig.ACTION_ORDER], actionOrder)) {
  findings.push('后端 ACTION_ORDER 与共享能力清单不一致')
}
if (!sameJson(backendConfig.MODULE_PERMISSION_TYPES, modules)) {
  findings.push('后端 MODULE_PERMISSION_TYPES 与共享能力清单不一致')
}

const backendConfigSource = readFileSync(backendConfigPath, 'utf8')
if (/DEFAULT_PERMISSION_TYPES\s*=\s*\[/.test(backendConfigSource)) {
  findings.push('后端不得重新硬编码 DEFAULT_PERMISSION_TYPES，必须从共享能力清单读取')
}
if (/getModulePermissionTypes\s*\([^)]*extraTypes/.test(backendConfigSource)) {
  findings.push('getModulePermissionTypes 不得合并数据库历史动作，未知模块只能回退到 view')
}

const scannerModule = require(scannerPath)
const scanner = new scannerModule()
const scannedModules = await scanner.scanViewsDirectory()
const syncableModules = scanner.mergeCapabilityModules(scannedModules)
const scannerSource = readFileSync(scannerPath, 'utf8')
if (!scannerSource.includes("role.role_type === 'admin'")) {
  findings.push('模块同步必须识别 role_type=admin，并为管理员补齐新模块的全部真实权限')
}
if (/const\s+rolePermissionMap\s*=/.test(scannerSource) || /rolePermissionMap\[role\.name\]/.test(scannerSource)) {
  findings.push('模块同步不得按角色名称为普通角色自动授权，普通角色必须显式分配权限')
}
for (const scannedModule of scannedModules) {
  if (!modules[scannedModule.key]) {
    findings.push(`受保护路由页面 ${scannedModule.folder}/${scannedModule.filename} 未登记模块 ${scannedModule.key}`)
    continue
  }
  if (!sameJson(scannedModule.permissions, modules[scannedModule.key])) {
    findings.push(`扫描模块 ${scannedModule.key} 的权限与共享能力清单不一致`)
  }
}

const syncableModuleKeys = new Set(syncableModules.map(module => module.key))
for (const moduleKey of Object.keys(modules)) {
  if (!syncableModuleKeys.has(moduleKey)) {
    findings.push(`共享能力清单模块 ${moduleKey} 未进入数据库模块同步流程`)
  }
}

const scannedKeys = new Set(scannedModules.map(module => module.key))
for (const excludedPage of [...(registry.publicPages || []), ...(registry.scanExcludedPages || [])]) {
  const absolutePath = resolve(frontendRoot, 'src/views', excludedPage)
  if (!existsSync(absolutePath)) findings.push(`扫描排除页面不存在：frontend/src/views/${excludedPage}`)
}
for (const publicPage of registry.publicPages || []) {
  const publicModuleKey = scanner.analyzeVueFile(publicPage)?.key
  if (publicModuleKey && scannedKeys.has(publicModuleKey)) {
    findings.push(`公开页面 ${publicPage} 不得生成权限模块 ${publicModuleKey}`)
  }
}

const modulesConfigSource = readFileSync(modulesConfigPath, 'utf8')
if (!modulesConfigSource.includes("module-permission-capabilities.json")) {
  findings.push('frontend/src/config/modules.ts 未读取共享权限能力清单')
}
if (/permissions\s*:\s*\[/.test(modulesConfigSource)) {
  findings.push('frontend/src/config/modules.ts 禁止硬编码 permissions 数组')
}
for (const match of modulesConfigSource.matchAll(/\bkey:\s*['"]([^'"]+)['"]/g)) {
  if (!modules[match[1]]) findings.push(`frontend/src/config/modules.ts 登记了清单外模块 ${match[1]}`)
}
for (const match of modulesConfigSource.matchAll(/getCapabilityPermissions\(\s*['"]([^'"]+)['"]\s*\)/g)) {
  if (!modules[match[1]]) findings.push(`getCapabilityPermissions 引用了清单外模块 ${match[1]}`)
}

const mapperSource = readFileSync(permissionMapperPath, 'utf8')
if (!mapperSource.includes("module-permission-capabilities.json")) {
  findings.push('permissionMapper.ts 未读取共享权限能力清单')
}
if (/export\s+const\s+MODULE_PERMISSIONS[^=]*=\s*\{/.test(mapperSource)) {
  findings.push('permissionMapper.ts 禁止重复硬编码模块权限，必须由共享能力清单派生')
}

const moduleKeySection = mapperSource.match(/MODULE_KEY_MAP[\s\S]*?=\s*\{([\s\S]*?)\n\}/)?.[1] || ''
const moduleAliases = new Map()
for (const match of moduleKeySection.matchAll(/['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g)) {
  moduleAliases.set(match[1], match[2])
}
for (const moduleKey of Object.keys(modules)) moduleAliases.set(moduleKey, moduleKey)

const resolveModuleKey = alias => moduleAliases.get(alias) || alias
const parsePermission = permission => {
  const separatorIndex = permission.indexOf(':')
  if (separatorIndex < 1) return null
  return {
    moduleAlias: permission.slice(0, separatorIndex),
    action: permission.slice(separatorIndex + 1)
  }
}

const resolveViewPermission = permission => {
  const parsed = parsePermission(permission)
  if (!parsed || (parsed.action !== 'view' && !parsed.action.startsWith('view:'))) return null
  const moduleKey = resolveModuleKey(parsed.moduleAlias)
  return modules[moduleKey]?.includes('view') ? moduleKey : null
}

for (const moduleKey of Object.keys(modules)) {
  const expectedView = `${moduleKey}:view`
  const mappedViewEntries = Object.entries(backendPermissionMapping).filter(([permission, aliases]) => {
    const parsed = parsePermission(permission)
    return parsed?.action === 'view' && Array.isArray(aliases) && aliases.includes(expectedView)
  })
  if (mappedViewEntries.length === 0) {
    findings.push(`后端权限映射缺少模块 ${moduleKey} 的 view 映射`)
  }
}

for (const [hostPage, permissions] of Object.entries(registry.embeddedViewPermissions || {})) {
  const hostPath = resolve(frontendRoot, 'src/views', hostPage)
  if (!existsSync(hostPath)) {
    findings.push(`独立业务 TAB 宿主页面不存在：frontend/src/views/${hostPage}`)
    continue
  }

  const hostSource = readFileSync(hostPath, 'utf8')
  for (const permission of permissions) {
    if (!resolveViewPermission(permission)) {
      findings.push(`独立业务 TAB ${hostPage} 使用了无效查看权限 ${permission}`)
    }
    if (!hostSource.includes(`data-view-permission="${permission}"`)) {
      findings.push(`独立业务 TAB ${hostPage} 缺少 ${permission} 的显式查看权限标记`)
    }
  }
}

const actionEvidence = new Set()
const actionByCapability = {
  View: 'view',
  Create: 'create',
  Edit: 'edit',
  Update: 'edit',
  Delete: 'delete',
  Export: 'export',
  Import: 'import',
  Approve: 'approve',
  Manage: 'manage',
  Sync: 'sync',
  Match: 'match',
  Deliver: 'deliver',
  Cancel: 'cancel',
  Sell: 'sell'
}

const walkSourceFiles = (directory, files = []) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) walkSourceFiles(path, files)
    else if (['.vue', '.ts', '.js'].includes(extname(entry.name))) files.push(path)
  }
  return files
}

const validateActionUse = (moduleAlias, action, sourcePath) => {
  const moduleKey = resolveModuleKey(moduleAlias)
  if (!modules[moduleKey]) {
    findings.push(`${relative(projectRoot, sourcePath)} 使用了未登记模块 ${moduleAlias}`)
    return
  }
  if (!modules[moduleKey].includes(action)) {
    findings.push(`${relative(projectRoot, sourcePath)} 使用 ${moduleAlias}:${action}，但共享能力清单未声明该权限`)
    return
  }
  actionEvidence.add(`${moduleKey}:${action}`)
}

for (const sourcePath of walkSourceFiles(resolve(frontendRoot, 'src'))) {
  const source = readFileSync(sourcePath, 'utf8')
  const permissionCalls = [...source.matchAll(/usePagePermissions\(\s*['"]([^'"]+)['"]\s*\)/g)]
    .map(match => match[1])

  for (const match of source.matchAll(/const\s*\{([\s\S]*?)\}\s*=\s*usePagePermissions\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    for (const capability of match[1].matchAll(/\bcan(View|Create|Edit|Update|Delete|Export|Import|Approve|Manage|Sync|Match|Deliver|Cancel|Sell)\b/g)) {
      validateActionUse(match[2], actionByCapability[capability[1]], sourcePath)
    }
  }

  for (const match of source.matchAll(/const\s+(\w+)\s*=\s*usePagePermissions\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const variable = match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const capabilityPattern = new RegExp(`\\b${variable}\\.can(View|Create|Edit|Update|Delete|Export|Import|Approve|Manage|Sync|Match|Deliver|Cancel|Sell)\\b`, 'g')
    for (const capability of source.matchAll(capabilityPattern)) {
      validateActionUse(match[2], actionByCapability[capability[1]], sourcePath)
    }
  }

  const distinctPermissionCalls = unique(permissionCalls)
  if (distinctPermissionCalls.length === 1) {
    for (const match of source.matchAll(/(?:hasPermission|handleNoPermission)\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      if (actionDefinitions[match[1]]) validateActionUse(distinctPermissionCalls[0], match[1], sourcePath)
    }
  }
}

for (const sourcePath of walkSourceFiles(resolve(projectRoot, 'backend/src/routes'))) {
  const source = readFileSync(sourcePath, 'utf8')
  for (const match of source.matchAll(/requirePermission\(\s*['"]([^:'"]+):([^'"]+)['"]\s*\)/g)) {
    const moduleKey = resolveModuleKey(match[1])
    const action = match[2].split(':')[0]
    // permissions:admin 是后端现有的组合授权别名，不是页面按钮能力。
    if (modules[moduleKey] && actionDefinitions[action]) validateActionUse(match[1], action, sourcePath)
  }
  for (const match of source.matchAll(/requireAnyPermission\(\s*\[([\s\S]*?)\]/g)) {
    for (const permission of match[1].matchAll(/['"]([^:'"]+):([^'"]+)['"]/g)) {
      const moduleKey = resolveModuleKey(permission[1])
      const action = permission[2].split(':')[0]
      if (modules[moduleKey] && actionDefinitions[action]) validateActionUse(permission[1], action, sourcePath)
    }
  }
}

for (const [moduleKey, actions] of Object.entries(modules)) {
  for (const action of actions) {
    if (!actionEvidence.has(`${moduleKey}:${action}`)) {
      findings.push(`模块 ${moduleKey} 声明了 ${action}，但前端权限调用和后端接口中均未发现真实使用证据`)
    }
  }
}

const pagePermissionsSource = readFileSync(pagePermissionsPath, 'utf8')
if (!/canUpdate\s*=\s*computed\(\(\)\s*=>\s*hasPermission\(['"]edit['"]\)\)/.test(pagePermissionsSource)) {
  findings.push('canUpdate 必须作为 edit 的别名，禁止生成未登记的 update 权限')
}

const routerSource = readFileSync(routerPath, 'utf8')
for (const publicPage of registry.publicPages || []) {
  if (!routerSource.includes(`@/views/${publicPage}`)) {
    findings.push(`公开页面清单中的 ${publicPage} 未被路由引用`)
  }
}

const routePermissionSourcePath = resolve(frontendRoot, 'src/constants/routePermissions.ts')
const routePermissionSource = readFileSync(routePermissionSourcePath, 'utf8')

const parseTypeScript = (path, source) => ts.createSourceFile(
  path,
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
)

const propertyName = property => {
  if (!property?.name) return null
  if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name)) {
    return property.name.text
  }
  return null
}

const findProperty = (objectLiteral, name) => objectLiteral.properties.find(property => propertyName(property) === name)

const findVariableInitializer = (sourceFile, variableName) => {
  let initializer = null
  const visit = node => {
    if (initializer) return
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === variableName) {
      initializer = node.initializer || null
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return initializer
}

const readPermissionRecord = (sourceFile, variableName) => {
  const initializer = findVariableInitializer(sourceFile, variableName)
  const record = new Map()
  if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
    findings.push(`${relative(projectRoot, routePermissionSourcePath)} 无法解析 ${variableName}`)
    return record
  }

  for (const property of initializer.properties) {
    if (!ts.isPropertyAssignment(property)) continue
    const path = propertyName(property)
    if (!path || !ts.isArrayLiteralExpression(property.initializer)) continue
    const permissions = property.initializer.elements
      .filter(ts.isStringLiteralLike)
      .map(element => element.text)
    record.set(path, permissions)
  }
  return record
}

const routePermissionFile = parseTypeScript(routePermissionSourcePath, routePermissionSource)
const routePermissionMap = new Map([
  ...readPermissionRecord(routePermissionFile, 'ROUTE_PERMISSION_MAP'),
  ...readPermissionRecord(routePermissionFile, 'H5_ROUTE_PERMISSION_MAP')
])

const routeFile = parseTypeScript(routerPath, routerSource)
const routeInitializer = findVariableInitializer(routeFile, 'routes')
const protectedLeafRoutes = []

const readBooleanProperty = (objectLiteral, name) => {
  const property = findProperty(objectLiteral, name)
  if (!property || !ts.isPropertyAssignment(property)) return undefined
  if (property.initializer.kind === ts.SyntaxKind.TrueKeyword) return true
  if (property.initializer.kind === ts.SyntaxKind.FalseKeyword) return false
  return undefined
}

const readMetaRequiresAuth = objectLiteral => {
  const metaProperty = findProperty(objectLiteral, 'meta')
  if (!metaProperty || !ts.isPropertyAssignment(metaProperty) || !ts.isObjectLiteralExpression(metaProperty.initializer)) {
    return undefined
  }
  return readBooleanProperty(metaProperty.initializer, 'requiresAuth')
}

const readStringProperty = (objectLiteral, name) => {
  const property = findProperty(objectLiteral, name)
  if (!property || !ts.isPropertyAssignment(property) || !ts.isStringLiteralLike(property.initializer)) return null
  return property.initializer.text
}

const readComponentImport = objectLiteral => {
  const componentProperty = findProperty(objectLiteral, 'component')
  if (!componentProperty || !ts.isPropertyAssignment(componentProperty)) return null
  let importPath = null
  const visit = node => {
    if (importPath) return
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      importPath = node.arguments[0].text
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(componentProperty.initializer)
  return importPath
}

const joinRoutePath = (parentPath, childPath) => {
  if (childPath.startsWith('/')) return childPath
  if (!parentPath || parentPath === '/') return childPath ? `/${childPath}` : '/'
  return childPath ? `${parentPath.replace(/\/$/, '')}/${childPath}` : parentPath
}

const collectRoutes = (arrayLiteral, parentPath = '', parentRequiresAuth = false) => {
  for (const element of arrayLiteral.elements) {
    if (!ts.isObjectLiteralExpression(element)) continue
    const childPath = readStringProperty(element, 'path')
    if (childPath === null) continue
    const fullPath = joinRoutePath(parentPath, childPath)
    const ownRequiresAuth = readMetaRequiresAuth(element)
    const requiresAuth = ownRequiresAuth === false ? false : (ownRequiresAuth === true || parentRequiresAuth)
    const childrenProperty = findProperty(element, 'children')
    const children = childrenProperty && ts.isPropertyAssignment(childrenProperty) && ts.isArrayLiteralExpression(childrenProperty.initializer)
      ? childrenProperty.initializer
      : null
    const component = readComponentImport(element)

    if (children) collectRoutes(children, fullPath, requiresAuth)
    if (requiresAuth && component && !children) protectedLeafRoutes.push({ path: fullPath, component })
  }
}

if (!routeInitializer || !ts.isArrayLiteralExpression(routeInitializer)) {
  findings.push(`${relative(projectRoot, routerPath)} 无法解析 routes 路由树`)
} else {
  collectRoutes(routeInitializer)
}

for (const route of protectedLeafRoutes) {
  const requiredPermissions = routePermissionMap.get(route.path)
  if (!requiredPermissions?.length) {
    findings.push(`受保护叶子路由 ${route.path} 缺少精确的 view 权限映射`)
    continue
  }

  for (const permission of requiredPermissions) {
    if (!resolveViewPermission(permission)) {
      findings.push(`受保护叶子路由 ${route.path} 的 ${permission} 未映射到已登记模块的 view`)
    }
  }

  if (route.component.startsWith('@/views/')) {
    const componentPath = resolve(frontendRoot, 'src', route.component.slice(2))
    if (!existsSync(componentPath)) {
      findings.push(`受保护叶子路由 ${route.path} 的页面不存在：${route.component}`)
      continue
    }
    const componentSource = readFileSync(componentPath, 'utf8')
    if (!componentSource.includes('<PermissionGate')) {
      findings.push(`受保护叶子路由 ${route.path} 未接入统一 PermissionGate：${route.component}`)
    }
  }
}

if (findings.length) {
  const uniqueFindings = unique(findings)
  console.error(`权限能力审计失败，共 ${uniqueFindings.length} 处：`)
  for (const finding of uniqueFindings) console.error(`- ${finding}`)
  console.error('请按 docs/frontend/permission-capability-standards.md 登记并实现页面、按钮和接口权限。')
  process.exit(1)
}

console.log(`权限能力审计通过：${Object.keys(modules).length} 个模块、${protectedLeafRoutes.length} 个受保护叶子路由均已接入统一查看权限。`)
