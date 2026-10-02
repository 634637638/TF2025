import fs from 'node:fs'
import path from 'node:path'

const frontendRoot = path.resolve(import.meta.dirname, '..')
const sourceRoot = path.join(frontendRoot, 'src')
const drawerStylesPath = path.join(sourceRoot, 'styles/components/_drawer.scss')
const expectedConsumers = new Map([
  ['views/H5-mobile/page/ProductList.vue', 1]
])
const findings = []
const actualConsumers = new Map()

function collectVueFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) collectVueFiles(filePath, files)
    else if (entry.name.endsWith('.vue')) files.push(filePath)
  }
  return files
}

for (const filePath of collectVueFiles(sourceRoot)) {
  const source = fs.readFileSync(filePath, 'utf8')
  const matches = [...source.matchAll(/<el-drawer\b[^>]*>/gis)]
  if (!matches.length) continue
  const relativeFile = path.relative(sourceRoot, filePath).split(path.sep).join('/')
  actualConsumers.set(relativeFile, matches.length)
  const allowedCount = expectedConsumers.get(relativeFile)
  if (allowedCount === undefined || matches.length > allowedCount) {
    findings.push(`${relativeFile} 有 ${matches.length} 个直接 el-drawer，先复用统一样式并登记用途`)
  }
  if (matches.some(match => !/\bclass\s*=\s*["'][^"']*\btf-drawer\b/.test(match[0]))) {
    findings.push(`${relativeFile} 的 el-drawer 必须使用公共 tf-drawer class`)
  }
}

for (const [file, expectedCount] of expectedConsumers) {
  if (actualConsumers.get(file) !== expectedCount) findings.push(`${file} 的 Drawer 采用登记与实际不符`)
}

const globalStyles = fs.readFileSync(drawerStylesPath, 'utf8')
for (const fragment of ['.tf-drawer.el-drawer', '.el-drawer__header', '.el-drawer__body', '--tf-drawer-max-width']) {
  if (!globalStyles.includes(fragment)) findings.push(`公共 Drawer 样式缺少 ${fragment}`)
}
if (!fs.readFileSync(path.join(sourceRoot, 'styles.scss'), 'utf8').includes("components/_drawer.scss")) {
  findings.push('styles.scss 未全局加载 Drawer 公共样式')
}

if (findings.length) {
  console.error(`Drawer 规范审计失败，共 ${findings.length} 项：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`Drawer 规范审计通过：Element Plus Drawer 使用统一样式；已登记业务入口 ${actualConsumers.size} 个。`)
