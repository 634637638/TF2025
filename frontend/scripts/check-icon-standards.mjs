import fs from 'node:fs'
import path from 'node:path'

const frontendRoot = path.resolve(import.meta.dirname, '..')
const sourceRoot = path.join(frontendRoot, 'src')
const rendererPath = path.join(sourceRoot, 'components/IconRenderer.vue')
const pickerPath = path.join(sourceRoot, 'components/IconPicker.vue')
const findings = []
const rendererConsumers = [
  'components/MenuItem.vue',
  'components/SimpleSidebar.vue',
  'components/IconPicker.vue'
]
const renderer = fs.readFileSync(rendererPath, 'utf8')
const picker = fs.readFileSync(pickerPath, 'utf8')

for (const fragment of [
  'DOMPurify.sanitize',
  'v-html="safeSvg"',
  'class="icon-renderer"',
  'width: 1em',
  'height: 1em',
  'fill: currentColor',
  'background-color: currentColor'
]) {
  if (!renderer.includes(fragment)) findings.push(`IconRenderer.vue 缺少安全或视觉契约：${fragment}`)
}

for (const relativeFile of rendererConsumers) {
  const source = fs.readFileSync(path.join(sourceRoot, relativeFile), 'utf8')
  if (!source.includes('<IconRenderer')) findings.push(`${relativeFile} 的动态菜单/图标必须使用 IconRenderer`)
}

const iconifyUtility = fs.readFileSync(path.join(sourceRoot, 'utils/iconify.ts'), 'utf8')
if (!iconifyUtility.includes('extractIconifyName')) findings.push('IconRenderer 必须使用统一 Iconify 名称解析工具')
if (!picker.includes('!isIconifyIcon(currentClass)')) {
  findings.push('IconPicker 编辑已有图标时必须跳过 Iconify class 的本地图标查询')
}

if (findings.length) {
  console.error(`图标规范审计失败，共 ${findings.length} 项：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`图标规范审计通过：动态 SVG 安全渲染、Iconify 解析、currentColor 继承和 ${rendererConsumers.length} 个公共消费者均已验证。`)
