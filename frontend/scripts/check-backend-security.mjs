import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { collectRouteRegistrations, routePolicyKey } from './lib/route-security-analysis.mjs'

const frontendRoot = resolve(import.meta.dirname, '..')
const projectRoot = resolve(frontendRoot, '..')
const backendRoot = resolve(projectRoot, 'backend/src')
const routesRoot = resolve(backendRoot, 'routes')
const configPath = resolve(projectRoot, 'config/backend-security-audit.json')
const findings = []

const walk = (directory, extension) => readdirSync(directory).flatMap((name) => {
  const path = resolve(directory, name)
  return statSync(path).isDirectory() ? walk(path, extension) : path.endsWith(extension) ? [path] : []
})

if (!existsSync(configPath)) {
  console.error('后端安全审计失败：缺少 config/backend-security-audit.json')
  process.exit(1)
}

const config = JSON.parse(readFileSync(configPath, 'utf8'))
const publicRoutes = config.publicRoutes || {}
const manualAuthRoutes = config.manualAuthRoutes || {}
const reviewedRouteKeys = new Set()
const backendFiles = walk(backendRoot, '.js')

for (const file of backendFiles) {
  const source = readFileSync(file, 'utf8')
  const fileName = relative(projectRoot, file)

  if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(source)) {
    findings.push(`${fileName}: 禁止使用 eval 或 new Function`)
  }

  const hardcodedSecret = /\b(?:JWT_SECRET|SESSION_SECRET|DB_PASSWORD|API_KEY|PRIVATE_KEY)\b\s*[:=]\s*['"](?!\*|change|your_|test|example)[^'"]{8,}['"]/i
  if (hardcodedSecret.test(source)) {
    findings.push(`${fileName}: 疑似硬编码密钥或密码`)
  }

  if (/(?:query|execute)\s*\(\s*`[\s\S]{0,1200}\$\{\s*(?:req|request)\.(?:body|query|params)/.test(source)) {
    findings.push(`${fileName}: SQL 模板直接插入请求字段`)
  }

  if (/(?:path\.(?:join|resolve)|fs\.(?:readFile|writeFile|unlink|createReadStream)|res\.(?:sendFile|download))\s*\([^\n]{0,300}(?:req|request)\.(?:body|query|params)/.test(source)) {
    findings.push(`${fileName}: 文件路径直接使用请求字段，存在路径穿越风险`)
  }
}

const routeFiles = walk(routesRoot, '.js')
for (const file of routeFiles) {
  const source = readFileSync(file, 'utf8')
  const fileName = relative(routesRoot, file)
  const registrations = collectRouteRegistrations(file, source)

  for (const route of registrations) {
    if (!route.path) {
      findings.push(`${fileName}: ${route.method} 路由路径不是静态字符串，无法纳入逐路由审计`)
      continue
    }

    const key = routePolicyKey(fileName, route.method, route.path)
    const hasMiddlewareAuth = route.middlewareAuthenticated || route.globallyAuthenticated

    if (hasMiddlewareAuth) {
      if (Object.hasOwn(publicRoutes, key) || Object.hasOwn(manualAuthRoutes, key)) {
        findings.push(`${key}: 已配置的例外与认证中间件重复，请清理审计配置`)
      }
      continue
    }

    if (Object.hasOwn(publicRoutes, key)) {
      reviewedRouteKeys.add(key)
      if (typeof publicRoutes[key] !== 'string' || !publicRoutes[key].trim()) {
        findings.push(`${key}: 公开路由例外必须填写明确原因`)
      }
      continue
    }

    if (Object.hasOwn(manualAuthRoutes, key)) {
      reviewedRouteKeys.add(key)
      const requiredMarkers = manualAuthRoutes[key]
      if (
        !Array.isArray(requiredMarkers)
        || requiredMarkers.length === 0
        || requiredMarkers.some((marker) => typeof marker !== 'string' || !route.source.includes(marker))
      ) {
        findings.push(`${key}: 手动认证路由缺少配置要求的认证校验标记`)
      }
      continue
    }

    findings.push(`${key}: 未发现认证中间件，也没有逐路由的公开/手动认证审查记录`)
  }
}

for (const key of [...Object.keys(publicRoutes), ...Object.keys(manualAuthRoutes)]) {
  if (!reviewedRouteKeys.has(key)) {
    findings.push(`${key}: 审计例外未匹配任何现存路由，需更新配置`)
  }
}

if (findings.length) {
  console.error(`后端安全审计失败，共 ${new Set(findings).size} 处：`)
  for (const finding of new Set(findings)) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`后端安全审计通过：已检查 ${backendFiles.length} 个源文件及全部路由声明。`)
