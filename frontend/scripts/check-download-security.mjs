import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const projectRoot = resolve(root, '..')
const findings = []
const read = file => readFileSync(resolve(projectRoot, file), 'utf8')
const mustContain = (file, pattern, message) => {
  if (!pattern.test(read(file))) findings.push(message)
}

mustContain('frontend/src/utils/unified-api.ts', /download\s*\(/, '统一下载入口 unifiedApi.download 不存在')
mustContain('frontend/src/views/guide/GuidePublicView.vue', /unifiedApi\.download/, '导航文件下载未使用 unifiedApi.download')
mustContain('frontend/src/views/guide/GuidePublicView.vue', /file_mime/, '导航文件类型未使用服务端 MIME 字段')
mustContain('backend/src/utils/guide-file-access.js', /createGuideFileAccess/, '导航文件未生成短时签名访问地址')
mustContain('backend/src/routes/guide-public.js', /verifyGuideFileToken/, '导航文件公开接口缺少签名校验')
mustContain('backend/src/app.js', /req\.path\.startsWith\('\/guide\/'\)/, '静态 uploads 未禁止直接访问 guide 私有文件')
mustContain('docs/frontend/download-security-standard.md', /页面台账/, '下载规范未要求页面台账登记')
mustContain('docs/frontend/page-audit-inventory.md', /下载安全专项登记/, '页面台账缺少下载安全专项登记')

if (findings.length) {
  console.error(`下载安全审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('下载安全审计通过：统一下载入口、导航文件签名访问和页面台账均已接入。')
