import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const viewSource = readFileSync(resolve(root, 'src/views/standards/StandardsAuditView.vue'), 'utf8')

const requirements = [
  [/previewButtonAction/, '按钮预览必须有点击反馈'],
  [/previewDialogAction/, '弹窗预览必须有确认/取消反馈'],
  [/togglePreviewDetail/, '表格预览必须有展开/收起反馈'],
  [/runSearchPreview/, '搜索预览必须有查询反馈'],
  [/submitFormPreview/, '表单预览必须有提交/校验反馈'],
  [/runPreviewLoading/, '全局 Loading 预览必须能触发真实 Loading Store'],
  [/loadEmptyPreview/, '空状态预览必须能切换恢复状态'],
  [/showFeedbackPreview/, '通知预览必须能触发真实通知'],
  [/verifySecurityPreview/, '权限预览必须能执行权限验证'],
  [/runRuntimePreview/, '运行时预览必须能执行演示审计状态'],
  [/previewPageTab/, '页面结构预览必须能切换页面状态'],
  [/<InlineLoading\b/, 'Loading 预览必须展示公共 InlineLoading 状态'],
  [/<DataEmptyState\b/, '空状态预览必须使用公共 DataEmptyState']
]

const findings = requirements
  .filter(([pattern]) => !pattern.test(viewSource))
  .map(([, message]) => `src/views/standards/StandardsAuditView.vue ${message}`)

if (findings.length > 0) {
  console.error(`规范预览交互审计失败，共 ${findings.length} 处：`)
  findings.forEach(finding => console.error(`- ${finding}`))
  process.exit(1)
}

console.log('规范预览交互审计通过：全部预览类型均已登记真实交互入口。')
