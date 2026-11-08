import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(frontendRoot, 'src')
const findings = []
const legacyMessageBoxBaseline = 0
let legacyMessageBoxCalls = 0
let directNotificationCalls = 0

const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(filePath)
    else if (/\.(?:ts|tsx|js|jsx|vue)$/.test(entry.name)) inspect(filePath)
  }
}

const lineNumber = (source, offset) => source.slice(0, offset).split(/\r?\n/).length

function inspect(filePath) {
  const relativePath = path.relative(path.resolve(frontendRoot, '..'), filePath)
  const source = fs.readFileSync(filePath, 'utf8')

  // 移动端表格行双击防护必须复用 useMobileRowDoubleTap，禁止页面重新手写时间戳 + 时间窗判定。
  const isRowDoubleTapImplementation = filePath.endsWith(path.join('composables', 'useMobileRowDoubleTap.ts'))
  if (!isRowDoubleTapImplementation) {
    for (const match of source.matchAll(/\b\w*[Tt]ap\w*Timestamp\b/g)) {
      findings.push(`${relativePath}:${lineNumber(source, match.index)} 禁止手写移动端行双击时间戳 ${match[0]}，必须复用 useMobileRowDoubleTap()`)
    }
    for (const match of source.matchAll(/now\s*-\s*\w*[Tt]imestamp\w*\.value\s*<=\s*\d+/g)) {
      findings.push(`${relativePath}:${lineNumber(source, match.index)} 禁止手写移动端行双击时间窗判定，必须复用 useMobileRowDoubleTap()`)
    }
  }

  const isNotificationImplementation = [
    path.join('services', 'notification-simple.ts'),
    path.join('utils', 'message-box.ts'),
    path.join('utils', 'element-feedback.ts'),
    path.join('composables', 'useNotification.ts'),
    path.join('composables', 'ui', 'useConfirm.ts'),
    path.join('plugins', 'notification.ts')
  ].some((suffix) => filePath.endsWith(suffix))

  if (isNotificationImplementation) return

  const notificationBindings = new Set(['ElMessage', 'ElNotification'])
  const importedNotificationBindings = new Set()
  for (const match of source.matchAll(/\bimport\s+(?!type\b)([\s\S]*?)\s+from\s*['"]element-plus(?:\/[^'"]*)?['"]/g)) {
    const clause = match[1].replace(/^type\s+/, '')
    const namedImports = clause.match(/\{([^}]*)\}/)?.[1] ?? ''
    for (const specifier of namedImports.split(',')) {
      const binding = specifier.trim().match(/^(?!type\s+)(ElMessage|ElNotification)(?:\s+as\s+(\w+))?$/)
      if (binding) {
        notificationBindings.add(binding[2] ?? binding[1])
        importedNotificationBindings.add(binding[2] ?? binding[1])
      }
    }

    const namespaceBinding = clause.match(/\*\s+as\s+(\w+)/)?.[1]
    if (namespaceBinding) {
      notificationBindings.add(`${namespaceBinding}.*`)
      importedNotificationBindings.add(`${namespaceBinding}.*`)
    }
  }

  for (const binding of notificationBindings) {
    const target = binding.endsWith('.*')
      ? `${binding.slice(0, -2)}\\s*\\.\\s*(?:ElMessage|ElNotification)`
      : `\\b${binding}\\b`
    const callPattern = new RegExp(`(?:${target})\\s*(?:\\.\\s*\\w+)?\\s*\\(`, 'g')
    for (const match of source.matchAll(callPattern)) {
      directNotificationCalls += 1
      findings.push(`${relativePath}:${lineNumber(source, match.index)} 禁止业务代码直接调用 Element Plus 通知 ${match[0].replace(/\\s+/g, '')}，请使用 useNotification()`)
    }
    if (importedNotificationBindings.has(binding)) {
      findings.push(`${relativePath}:${lineNumber(source, source.indexOf(binding.split('.')[0]))} 禁止业务代码从 element-plus 导入通知 API，请使用 useNotification()`)
    }
  }

  const legacyCalls = [...source.matchAll(/(?:ElMessageBox|MessageBox)\.(?:confirm|alert|prompt)\s*\(/g)]
  legacyMessageBoxCalls += legacyCalls.length

  const usesNotificationAlert = /\b(?:const|let|var)\s+\{[^}]*\balert\b[^}]*\}\s*=\s*useNotification\s*\(/.test(source)
  const usesNotificationConfirm = /\b(?:const|let|var)\s+\{[^}]*\bconfirm\b[^}]*\}\s*=\s*useNotification\s*\(/.test(source)
  const usesNotificationPrompt = /\b(?:const|let|var)\s+\{[^}]*\bprompt\b[^}]*\}\s*=\s*useNotification\s*\(/.test(source)

  for (const match of source.matchAll(/\b(?:window|globalThis)\.(alert|confirm)\s*\(/g)) {
    findings.push(`${relativePath}:${lineNumber(source, match.index)} 禁止使用浏览器原生 ${match[1]}()，请使用项目统一异步封装`)
  }

  for (const match of source.matchAll(/(?<![\w.])alert\s*\(/g)) {
    if (usesNotificationAlert) continue
    findings.push(`${relativePath}:${lineNumber(source, match.index)} 禁止使用浏览器原生 alert()，请使用 useNotification()`)
  }

  for (const match of source.matchAll(/(?<![\w.])confirm\s*\(/g)) {
    if (usesNotificationConfirm) continue
    findings.push(`${relativePath}:${lineNumber(source, match.index)} 禁止使用浏览器原生 confirm()，请使用 useNotification().confirm()`)
  }

  for (const match of source.matchAll(/(?:ElMessageBox|MessageBox)\.prompt\s*\(/g)) {
    if (usesNotificationPrompt) continue
    findings.push(`${relativePath}:${lineNumber(source, match.index)} 禁止业务代码直接使用 MessageBox.prompt，请使用 useNotification().prompt()`)
  }
}

walk(sourceRoot)

if (legacyMessageBoxCalls > legacyMessageBoxBaseline) {
  findings.push(`业务代码中的 ElMessageBox.confirm/alert/prompt 从基线 ${legacyMessageBoxBaseline} 增加到 ${legacyMessageBoxCalls}，新增页面必须使用 useNotification()`)
}

if (directNotificationCalls > 0) {
  findings.push(`业务代码直接调用 Element Plus 通知共 ${directNotificationCalls} 处，必须迁移到 useNotification()`)
}

if (findings.length > 0) {
  console.error(`交互统一审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`交互统一审计通过：原生弹窗调用=0，Element Plus 通知直调=${directNotificationCalls}，业务 ElMessageBox.confirm/alert/prompt 调用=${legacyMessageBoxCalls}（基线 ${legacyMessageBoxBaseline}）。`)
