import fs from 'node:fs'
import path from 'node:path'

const sourceRoot = path.resolve(import.meta.dirname, '../src')
const appStore = fs.readFileSync(path.join(sourceRoot, 'stores/app.ts'), 'utf8')
const variables = fs.readFileSync(path.join(sourceRoot, 'styles/_variables.scss'), 'utf8')
const findings = []

if (!/root\.dataset\.theme\s*=\s*currentTheme\.value/.test(appStore)) {
  findings.push('app store 必须把生效主题写入 documentElement.dataset.theme')
}
if (!/\[data-theme="dark"\]\s*\{/.test(variables)) findings.push('_variables.scss 缺少暗色主题令牌块')
if (!appStore.includes('watch(theme, applyTheme)')) findings.push('主题偏好变化后必须重新应用主题')
if (!appStore.includes('darkModeQuery.addEventListener')) findings.push('自动主题必须响应系统颜色偏好变化')

if (findings.length) {
  console.error(`主题规范审计失败，共 ${findings.length} 项：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('主题审计通过：用户/自动主题均连接到 CSS data-theme 令牌入口。')
