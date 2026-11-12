import fs from 'node:fs'
import path from 'node:path'
import { auditIconTemplate } from './lib/icon-contract.mjs'

const frontendRoot = path.resolve(import.meta.dirname, '..')
const sourceRoot = path.join(frontendRoot, 'src')
const rendererPath = path.join(sourceRoot, 'components/IconRenderer.vue')
const pickerPath = path.join(sourceRoot, 'components/IconPicker.vue')
const findings = []
const rendererConsumers = [
  'components/MenuItem.vue',
  'components/SimpleSidebar.vue',
  'components/IconPicker.vue',
  'components/IconSelector.vue',
  'components/business/ImportExportActions.vue',
  'components/TabsBar.vue',
  'components/mobile/MobileSlideMenu.vue',
  'components/base/PageHeader.vue',
  'views/menu/MenuManagementView.vue',
  'views/permissions/page/RoleFieldPermissionDialog.vue',
  'views/permissions/page/RolePermissionsPage.vue'
]
const renderer = fs.readFileSync(rendererPath, 'utf8')
const picker = fs.readFileSync(pickerPath, 'utf8')

for (const fragment of [
  'sanitizeIconSvg',
  'v-html="safeSvg"',
  'class="icon-renderer"',
  'width: 1em',
  'height: 1em',
  'fill: currentColor'
]) {
  if (!renderer.includes(fragment)) findings.push(`IconRenderer.vue 缺少安全或视觉契约：${fragment}`)
}
if (/https:\/\/api\.iconify\.design|iconify-mask/.test(renderer)) findings.push('IconRenderer 不得直接请求外站或使用在线 mask 预览')

for (const relativeFile of rendererConsumers) {
  const source = fs.readFileSync(path.join(sourceRoot, relativeFile), 'utf8')
  if (!source.includes('<IconRenderer')) findings.push(`${relativeFile} 的动态菜单/图标必须使用 IconRenderer`)
}

const iconifyUtility = fs.readFileSync(path.join(sourceRoot, 'utils/iconify.ts'), 'utf8')
if (!iconifyUtility.includes('extractIconifyName')) findings.push('IconRenderer 必须使用统一 Iconify 名称解析工具')
if (!picker.includes('!isIconifyIcon(currentClass)')) {
  findings.push('IconPicker 编辑已有图标时必须跳过 Iconify class 的本地图标查询')
}

const sanitizer = fs.readFileSync(path.join(sourceRoot, 'utils/icon-svg.ts'), 'utf8')
if (!sanitizer.includes('DOMPurify.sanitize')) findings.push('公共 SVG 净化入口必须调用 DOMPurify')
const selector = fs.readFileSync(path.join(sourceRoot, 'components/IconSelector.vue'), 'utf8')
if (!selector.includes('<IconPicker') || /\/icons\b/.test(selector)) findings.push('IconSelector 必须复用 IconPicker，不得保留独立目录或选择实现')
if (/code\.iconify\.design|\.scan\s*\(/.test(iconifyUtility)) findings.push('不得注入 Iconify 全局扫描脚本或扫描 Vue 管理的 DOM')
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(file)
    else if (file.endsWith('.vue')) {
      const relativeFile = path.relative(sourceRoot, file).split(path.sep).join('/')
      const source = fs.readFileSync(file, 'utf8')
      findings.push(...auditIconTemplate(source, relativeFile).map(message => `${relativeFile}: ${message}`))
      if (relativeFile !== 'components/IconRenderer.vue' && /https:\/\/api\.iconify\.design/.test(source)) {
        findings.push(`${relativeFile}: 不得重复实现在线图标资源入口`)
      }
    }
  }
}
walk(sourceRoot)

if (findings.length) {
  console.error(`图标规范审计失败，共 ${findings.length} 项：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`图标规范审计通过：动态 SVG 安全渲染、Iconify 解析、currentColor 继承和 ${rendererConsumers.length} 个公共消费者均已验证。`)
