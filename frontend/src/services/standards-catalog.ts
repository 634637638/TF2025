import manifest from '../../../docs/frontend/standards-manifest.json'

export type StandardCategory =
  | '页面与布局'
  | '视觉与组件'
  | '数据与表格'
  | '搜索与表单'
  | '反馈与交互'
  | '权限与安全'
  | '运行时与性能'

export type StandardPreviewKind =
  | 'page'
  | 'button'
  | 'dialog'
  | 'table'
  | 'search'
  | 'form'
  | 'feedback'
  | 'security'
  | 'runtime'

export interface StandardCatalogItem {
  id: string
  document: string
  title: string
  category: StandardCategory
  summary: string
  requirements: string[]
  previewKind: StandardPreviewKind
  checks: string[]
  publicSources: string[]
  status: '已登记'
}

const titles: Record<string, string> = {
  'admin-table-standards.md': '后台卡片与表格',
  'admin-stat-card-color-standard.md': '统计卡片颜色',
  'button-standards.md': '按钮',
  'color-token-standard.md': '颜色令牌',
  'component-adoption-standard.md': '公共组件采用',
  'crud-standards.md': 'CRUD 与数据刷新',
  'design-token-standard.md': '视觉令牌',
  'motion-standards.md': '动效',
  'print-standards.md': '打印',
  'icon-standards.md': '图标',
  'basic-component-standards.md': '基础控件与抽屉',
  'keyboard-shortcut-standards.md': '快捷键',
  'telemetry-standards.md': '性能与行为埋点',
  'theme-standards.md': '主题切换',
  'customer-search-standard.md': '客户搜索',
  'price-contact-standard.md': '报价页联系方式',
  'data-freshness-standard.md': '数据实时性',
  'dialog-standards.md': '模态框与对话框',
  'empty-state-standard.md': '空状态',
  'global-loading-standard.md': '全局 Loading',
  'interaction-standards.md': '全局交互反馈',
  'field-consistency-standards.md': '字段一致性',
  'form-control-standards.md': '表单控件',
  'latest-request-standard.md': '最新请求处理',
  'menu-icon-management-standard.md': '菜单图标管理',
  'model-search-standard.md': '型号搜索',
  'notification-standards.md': '消息通知',
  'page-structure-standards.md': '页面结构',
  'pagination-standards.md': '分页',
  'payment-method-standard.md': '支付方式',
  'permission-capability-standards.md': '页面权限能力',
  'reminder-standards.md': '提醒',
  'responsive-breakpoint-standard.md': '响应式断点',
  'search-standards.md': '搜索与筛选',
  'security-runtime-standards.md': '安全与运行时',
  'shared-standards.md': '经验分享',
  'tab-standards.md': '标签页',
  'time-standards.md': '时间与日期',
  'unified-page-structure.md': '统一页面结构',
  'standards-audit-guide.md': '规范审计接入'
}

const categoryByDocument: Partial<Record<string, StandardCategory>> = {
  'page-structure-standards.md': '页面与布局',
  'responsive-breakpoint-standard.md': '页面与布局',
  'tab-standards.md': '页面与布局',
  'unified-page-structure.md': '页面与布局',
  'admin-table-standards.md': '数据与表格',
  'pagination-standards.md': '数据与表格',
  'crud-standards.md': '数据与表格',
  'data-freshness-standard.md': '数据与表格',
  'latest-request-standard.md': '数据与表格',
  'time-standards.md': '数据与表格',
  'field-consistency-standards.md': '数据与表格',
  'search-standards.md': '搜索与表单',
  'model-search-standard.md': '搜索与表单',
  'customer-search-standard.md': '搜索与表单',
  'form-control-standards.md': '搜索与表单',
  'button-standards.md': '视觉与组件',
  'color-token-standard.md': '视觉与组件',
  'design-token-standard.md': '视觉与组件',
  'admin-stat-card-color-standard.md': '视觉与组件',
  'icon-standards.md': '视觉与组件',
  'theme-standards.md': '视觉与组件',
  'motion-standards.md': '视觉与组件',
  'print-standards.md': '视觉与组件',
  'component-adoption-standard.md': '视觉与组件',
  'basic-component-standards.md': '视觉与组件',
  'menu-icon-management-standard.md': '视觉与组件',
  'dialog-standards.md': '反馈与交互',
  'global-loading-standard.md': '反馈与交互',
  'empty-state-standard.md': '反馈与交互',
  'notification-standards.md': '反馈与交互',
  'interaction-standards.md': '反馈与交互',
  'reminder-standards.md': '反馈与交互',
  'keyboard-shortcut-standards.md': '反馈与交互',
  'payment-method-standard.md': '反馈与交互',
  'permission-capability-standards.md': '权限与安全',
  'security-runtime-standards.md': '权限与安全',
  'telemetry-standards.md': '运行时与性能',
  'standards-audit-guide.md': '运行时与性能',
  'shared-standards.md': '反馈与交互',
  'price-contact-standard.md': '视觉与组件'
}

const previewByDocument: Partial<Record<string, StandardPreviewKind>> = {
  'admin-table-standards.md': 'table',
  'pagination-standards.md': 'table',
  'search-standards.md': 'search',
  'model-search-standard.md': 'search',
  'customer-search-standard.md': 'search',
  'form-control-standards.md': 'form',
  'button-standards.md': 'button',
  'dialog-standards.md': 'dialog',
  'global-loading-standard.md': 'feedback',
  'empty-state-standard.md': 'feedback',
  'notification-standards.md': 'feedback',
  'interaction-standards.md': 'feedback',
  'permission-capability-standards.md': 'security',
  'security-runtime-standards.md': 'security',
  'telemetry-standards.md': 'runtime',
  'responsive-breakpoint-standard.md': 'page'
}

const summaryByCategory: Record<StandardCategory, string> = {
  '页面与布局': '页面结构、布局容器、标签页和 PC/手机响应式边界。',
  '视觉与组件': '公共组件、颜色令牌、字号、按钮和视觉资产的统一入口。',
  '数据与表格': '列表、分页、数据刷新、字段格式和表格内容完整性。',
  '搜索与表单': '搜索入口、远程查询、表单控件和选项数据契约。',
  '反馈与交互': '弹窗、通知、Loading、空状态、提醒和交互行为。',
  '权限与安全': '页面权限、字段权限、运行时安全和访问边界。',
  '运行时与性能': '审计接入、埋点、性能和运行时稳定性。'
}

const requirementsByCategory: Record<StandardCategory, string[]> = {
  '页面与布局': [
    '页面必须使用公共页面壳、PageHeader 和统一内容容器。',
    'PC 与手机端共用同一结构，断点只使用全局响应式令牌。',
    '新增、删除或迁移页面、Tab、弹窗时同步维护页面功能单元台账。'
  ],
  '视觉与组件': [
    '颜色、字号、圆角、阴影、间距和按钮语义只能读取全局令牌。',
    '优先复用公共组件；业务页面不得复制第二套视觉或控件实现。',
    '专用展示必须声明独立语义 class，并登记审计例外。'
  ],
  '数据与表格': [
    '表格、分页、排序和空数据使用公共入口，字段必须完整展示。',
    '选项和业务列表不得固定截断结果；服务端分页必须返回完整总数。',
    '基础选项优先按 sort_order 排序，业务列表按自身契约排序。'
  ],
  '搜索与表单': [
    '搜索和筛选使用统一入口，关键词查询走服务端，不以固定数量截断。',
    '客户、员工等敏感或大数据量选项必须按用途、权限和关键词远程查询。',
    '表单控件、日期、金额和校验使用公共组件与格式工具。'
  ],
  '反馈与交互': [
    '弹窗、底部操作区、Loading、空状态和消息提示使用公共组件。',
    '确认、错误和成功反馈不得调用浏览器原生 alert、confirm 或重复通知实现。',
    '手机端交互保持可触达、居中和等分规则，PC 端按内容自适应。'
  ],
  '权限与安全': [
    '权限判断遵循用户 → 角色 → 权限链路，前后端都必须校验。',
    '字段权限隐藏时，若存在任一操作能力仍显示操作列并按动作控制按钮。',
    'CSRF、认证、上传和敏感数据访问使用统一安全入口。'
  ],
  '运行时与性能': [
    '请求、错误边界、时间处理、缓存和性能埋点使用公共服务。',
    '规范必须登记可执行审计命令和公共实现入口，并纳入 check:standards。',
    '审计失败时禁止启动或生产构建通过，历史债务只能登记并防止新增。'
  ]
}

const inferPreview = (document: string, category: StandardCategory): StandardPreviewKind => {
  if (previewByDocument[document]) return previewByDocument[document] as StandardPreviewKind
  if (category === '页面与布局') return 'page'
  if (category === '视觉与组件') return 'button'
  if (category === '数据与表格') return 'table'
  if (category === '搜索与表单') return 'form'
  if (category === '权限与安全') return 'security'
  if (category === '运行时与性能') return 'runtime'
  return 'feedback'
}

export const standardsCatalog: StandardCatalogItem[] = manifest.standards.map((standard) => {
  const category = categoryByDocument[standard.document] || '视觉与组件'
  return {
    id: standard.document.replace(/\.md$/, ''),
    document: standard.document,
    title: titles[standard.document] || standard.document.replace(/\.md$/, ''),
    category,
    summary: summaryByCategory[category],
    requirements: [...requirementsByCategory[category]],
    previewKind: inferPreview(standard.document, category),
    checks: [...standard.checks],
    publicSources: [...standard.publicSources],
    status: '已登记'
  }
})

export const standardCategories: StandardCategory[] = [
  '页面与布局',
  '视觉与组件',
  '数据与表格',
  '搜索与表单',
  '反馈与交互',
  '权限与安全',
  '运行时与性能'
]
