import fs from 'node:fs'
import path from 'node:path'

const sourceRoot = path.resolve(import.meta.dirname, '../src')
const findings = []
const shortcutPath = path.join(sourceRoot, 'composables/useKeyboardShortcut.ts')
const shortcut = fs.readFileSync(shortcutPath, 'utf8')

for (const fragment of ['onScopeDispose(stop)', 'event.repeat', 'ctrlOrMeta', 'ignoreEditable']) {
  if (!shortcut.includes(fragment)) findings.push(`useKeyboardShortcut 缺少生命周期或键盘冲突保护：${fragment}`)
}

for (const relativeFile of ['composables/useScreenLock.ts', 'composables/useMobileMenu.ts']) {
  const source = fs.readFileSync(path.join(sourceRoot, relativeFile), 'utf8')
  if (!source.includes('useKeyboardShortcut')) findings.push(`${relativeFile} 的全局快捷键未使用公共 composable`)
}

if (findings.length) {
  console.error(`快捷键规范审计失败，共 ${findings.length} 项：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('快捷键规范审计通过：全局快捷键使用共享 Composable 并自动清理监听。')
