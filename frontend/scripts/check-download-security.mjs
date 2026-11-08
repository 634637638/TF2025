import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const projectRoot = resolve(root, '..')
const findings = []
const read = file => readFileSync(resolve(projectRoot, file), 'utf8')
const mustContain = (file, pattern, message) => {
  if (!pattern.test(read(file))) findings.push(message)
}

mustContain('frontend/src/utils/unified-api.ts', /download\s*\(/, '统一下载入口 unifiedApi.download 不存在')
mustContain('frontend/src/utils/unified-api.ts', /extractBlobResponse[^]*from ['"]\.\/download-response['"]/, '统一下载入口未复用下载响应校验工具')
mustContain('frontend/src/utils/download-response.ts', /status < 200 \|\| status >= 300/, '下载响应未拒绝非 2xx 状态')
mustContain('frontend/src/utils/download-response.ts', /ERROR_CONTENT_TYPE_PATTERN/, '下载响应未拒绝 JSON 或 HTML 错误体')
mustContain('frontend/scripts/check-download-security.test.mjs', /\[401, 403, 404, 500\]/, '下载安全测试未覆盖 401/403/404/500')
mustContain('frontend/src/views/guide/GuidePublicView.vue', /unifiedApi\.download/, '导航文件下载未使用 unifiedApi.download')
mustContain('frontend/src/views/subsidy/components/SubsidyPhotoManageDialog.vue', /unifiedApi\.download/, '国补照片下载未使用 unifiedApi.download')
if (/fetch\s*\(\s*formatImageUrl/.test(read('frontend/src/views/subsidy/components/SubsidyPhotoManageDialog.vue'))) {
  findings.push('国补照片下载仍在直接 fetch 受保护文件')
}
mustContain('frontend/src/views/guide/GuidePublicView.vue', /file_mime/, '导航文件类型未使用服务端 MIME 字段')
mustContain('backend/src/utils/guide-file-access.js', /createGuideFileAccess/, '导航文件未生成短时签名访问地址')
mustContain('backend/src/controllers/guide-public.controller.js', /record\.requires_token\s*&&\s*!this\.verifyFileToken\(id,\s*expires,\s*signature\)/, '导航文件 controller 未对密码分类文件执行短时签名校验')
mustContain('backend/src/app.js', /app\.use\('\/uploads',\s*uploadStaticAccess\)/, '静态 uploads 未挂载统一私有目录访问控制')
mustContain('backend/src/middleware/upload-static-access.js', /PRIVATE_UPLOAD_ROOTS[\s\S]*['"]guide['"]/, '静态 uploads 私有目录清单未包含 guide')
mustContain('docs/frontend/download-security-standard.md', /页面台账/, '下载规范未要求页面台账登记')
mustContain('docs/frontend/page-audit-inventory.md', /下载安全专项登记/, '页面台账缺少下载安全专项登记')

if (findings.length) {
  console.error(`下载安全审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('下载安全审计通过：统一下载入口、导航文件签名访问和页面台账均已接入。')
