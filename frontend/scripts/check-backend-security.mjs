import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'

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
const publicRouteFiles = new Set(config.unauthenticatedRouteFiles || [])
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
  if (!/router\.(?:get|post|put|patch|delete)\s*\(/.test(source)) continue

  const baseName = file.split('/').pop()
  const hasAuthentication = /\b(?:unifiedAuth|requirePermission|requireAnyPermission|requireBusinessUser|customerAuth|authenticate|verifyToken)\b/.test(source)
  if (!hasAuthentication && !publicRouteFiles.has(baseName)) {
    findings.push(`backend/src/routes/${baseName}: 路由文件没有认证中间件且未登记为公开路由`)
  }
}

for (const routeFile of publicRouteFiles) {
  const path = resolve(routesRoot, routeFile)
  if (!existsSync(path)) findings.push(`公开路由白名单文件不存在：backend/src/routes/${routeFile}`)
}

if (findings.length) {
  console.error(`后端安全审计失败，共 ${new Set(findings).size} 处：`)
  for (const finding of new Set(findings)) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`后端安全审计通过：已检查 ${backendFiles.length} 个源文件及 ${routeFiles.length} 个路由文件。`)
