import manifest from '../../../docs/frontend/standards-manifest.json'

const standardDocumentLoaders = import.meta.glob('../../../docs/frontend/*.md', {
  import: 'default',
  query: '?raw'
}) as Record<string, () => Promise<string>>

export type StandardCategory =
  | '页面与布局'
  | '视觉与组件'
  | '数据与表格'
  | '数据与时间'
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
  | 'time'
  | 'rich-content'
  | 'rules'

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
  'download-security-standard.md': '安全下载',
  'component-adoption-standard.md': '公共组件采用',
  'crud-standards.md': 'CRUD 与数据刷新',
  'design-token-standard.md': '视觉令牌',
  'guide-navigation-standard.md': 'DH 导航',
  'motion-standards.md': '动效',
  'navigation-standards.md': '菜单与导航',
  'print-standards.md': '打印',
  'icon-standards.md': '图标',
  'basic-component-standards.md': '基础控件与抽屉',
  'keyboard-shortcut-standards.md': '快捷键',
  'telemetry-standards.md': '性能与行为埋点',
  'theme-standards.md': '主题切换',
  'typography-standards.md': '全局文字规范',
  'standards-exemptions.md': '规范豁免登记',
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
  'rich-content-standards.md': '富文本内容',
  'tab-standards.md': '标签页',
  'time-standards.md': '时间与日期',
  'unified-page-structure.md': '页面结构迁移入口',
  'standards-audit-guide.md': '规范审计接入'
}

const categoryByDocument: Partial<Record<string, StandardCategory>> = {
  'page-structure-standards.md': '页面与布局',
  'responsive-breakpoint-standard.md': '页面与布局',
  'navigation-standards.md': '页面与布局',
  'guide-navigation-standard.md': '页面与布局',
  'tab-standards.md': '页面与布局',
  'unified-page-structure.md': '页面与布局',
  'admin-table-standards.md': '数据与表格',
  'pagination-standards.md': '数据与表格',
  'crud-standards.md': '数据与表格',
  'data-freshness-standard.md': '数据与表格',
  'latest-request-standard.md': '数据与表格',
  'time-standards.md': '数据与时间',
  'field-consistency-standards.md': '数据与表格',
  'search-standards.md': '搜索与表单',
  'model-search-standard.md': '搜索与表单',
  'customer-search-standard.md': '搜索与表单',
  'form-control-standards.md': '搜索与表单',
  'button-standards.md': '视觉与组件',
  'typography-standards.md': '视觉与组件',
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
  'download-security-standard.md': '权限与安全',
  'telemetry-standards.md': '运行时与性能',
  'standards-audit-guide.md': '运行时与性能',
  'standards-exemptions.md': '运行时与性能',
  'shared-standards.md': '反馈与交互',
  'rich-content-standards.md': '视觉与组件',
  'price-contact-standard.md': '视觉与组件'
}

const previewByDocument: Partial<Record<string, StandardPreviewKind>> = {
  'admin-table-standards.md': 'table',
  'admin-stat-card-color-standard.md': 'rules',
  'button-standards.md': 'button',
  'color-token-standard.md': 'rules',
  'component-adoption-standard.md': 'rules',
  'crud-standards.md': 'rules',
  'design-token-standard.md': 'rules',
  'download-security-standard.md': 'security',
  'typography-standards.md': 'rules',
  'guide-navigation-standard.md': 'page',
  'motion-standards.md': 'rules',
  'print-standards.md': 'rules',
  'icon-standards.md': 'rules',
  'basic-component-standards.md': 'form',
  'keyboard-shortcut-standards.md': 'rules',
  'telemetry-standards.md': 'runtime',
  'theme-standards.md': 'rules',
  'customer-search-standard.md': 'search',
  'price-contact-standard.md': 'rules',
  'data-freshness-standard.md': 'rules',
  'dialog-standards.md': 'dialog',
  'empty-state-standard.md': 'feedback',
  'global-loading-standard.md': 'feedback',
  'interaction-standards.md': 'feedback',
  'field-consistency-standards.md': 'rules',
  'form-control-standards.md': 'form',
  'latest-request-standard.md': 'search',
  'menu-icon-management-standard.md': 'rules',
  'navigation-standards.md': 'page',
  'model-search-standard.md': 'search',
  'notification-standards.md': 'feedback',
  'page-structure-standards.md': 'page',
  'standards-exemptions.md': 'runtime',
  'time-standards.md': 'time',
  'pagination-standards.md': 'table',
  'search-standards.md': 'search',
  'payment-method-standard.md': 'rules',
  'permission-capability-standards.md': 'security',
  'security-runtime-standards.md': 'security',
  'reminder-standards.md': 'rules',
  'responsive-breakpoint-standard.md': 'page',
  'shared-standards.md': 'rules',
  'rich-content-standards.md': 'rich-content',
  'tab-standards.md': 'page',
  'unified-page-structure.md': 'page',
  'standards-audit-guide.md': 'runtime'
}

const summaryByCategory: Record<StandardCategory, string> = {
  '页面与布局': '页面结构、布局容器、标签页和 PC/手机响应式边界。',
  '视觉与组件': '公共组件、颜色令牌、字号、按钮和视觉资产的统一入口。',
  '数据与表格': '列表、分页、数据刷新、字段格式和表格内容完整性。',
  '数据与时间': '北京时间、业务日期、时间格式和日期控件的统一处理。',
  '搜索与表单': '搜索入口、远程查询、表单控件和选项数据契约。',
  '反馈与交互': '弹窗、通知、Loading、空状态、提醒和交互行为。',
  '权限与安全': '页面权限、字段权限、运行时安全和访问边界。',
  '运行时与性能': '审计接入、埋点、性能和运行时稳定性。'
}

const summaryByDocument: Record<string, string> = {
  'admin-table-standards.md': '后台卡片、表格表头、行高、列宽、悬停和操作区统一使用公共样式。',
  'admin-stat-card-color-standard.md': '统计卡片按指标语义使用统一颜色，避免同类数据在不同页面颜色不一致。',
  'button-standards.md': '页面工具栏、表格操作、弹窗和手机端按钮统一使用公共尺寸与语义颜色。',
  'color-token-standard.md': '全局颜色按基础令牌、组件语义色和业务状态色分层维护。',
  'component-adoption-standard.md': '后台页面优先采用统一搜索、分页、弹窗、空状态和 Loading 公共组件。',
  'crud-standards.md': '新增、查询、编辑、删除流程统一校验、权限、错误处理和数据刷新。',
  'design-token-standard.md': '圆角、阴影、间距、字号和层级使用公共设计令牌，禁止新增硬编码。',
  'typography-standards.md': '后台、H5、弹窗、Tab 和表格统一使用全局字号与文字语义令牌。',
  'motion-standards.md': '过渡和动画使用统一动效令牌，并尊重减少动态效果设置。',
  'print-standards.md': '页面打印统一使用公共打印样式，业务页面只维护必要的专用打印内容。',
  'icon-standards.md': '图标通过安全的公共渲染入口解析，动态图标不得拼接任意 HTML 或 URL。',
  'basic-component-standards.md': '后台表单优先使用 Element Plus 和公共抽屉控件，避免重复实现控件皮肤。',
  'keyboard-shortcut-standards.md': '跨页面快捷键通过共享 composable 注册，并在组件销毁时清理监听。',
  'telemetry-standards.md': '页面访问和业务事件通过统一埋点服务发送，并遵循数据过滤规则。',
  'theme-standards.md': 'Pinia 主题状态统一驱动根节点主题属性，组件从主题令牌读取样式。',
  'customer-search-standard.md': '客户搜索统一使用远程检索组件，避免加载或暴露不必要的客户数据。',
  'standards-exemptions.md': '规范例外必须记录具体页面、豁免规则、原因和复核范围。',
  'price-contact-standard.md': '销售报价和批发报价共用联系方式布局、字号和对齐样式。',
  'data-freshness-standard.md': '新增、编辑、删除和状态操作成功后立即显示服务端最新数据。',
  'dialog-standards.md': 'PC、平板和手机弹窗共用结构、尺寸、关闭按钮及底部操作规范。',
  'empty-state-standard.md': '表格、列表、卡片和弹窗统一通过 DataEmptyState 展示空数据与异常状态。',
  'global-loading-standard.md': '页面首次加载、手动刷新和局部数据加载按场景使用唯一对应的 Loading。',
  'interaction-standards.md': '确认、成功、警告、错误和加载反馈统一使用项目公共交互入口。',
  'field-consistency-standards.md': '前后端、数据库、表单、列表和权限审计共用一致的字段命名契约。',
  'form-control-standards.md': '输入框、选择框、日期控件和数字控件统一公共高度与交互方式。',
  'latest-request-standard.md': '搜索、筛选、分页和刷新使用最新请求控制，防止旧响应覆盖新结果。',
  'menu-icon-management-standard.md': '在线候选通过站内批量预览，保存有效 SVG 后才确认选择；全局动态图标统一渲染本地数据，缺失时显示本地占位。',
  'navigation-standards.md': '桌面侧栏、移动菜单和导航按钮使用统一令牌及响应式规则。',
  'model-search-standard.md': '型号选项按品牌加载完整数据，再本地筛选，不使用固定数量截断。',
  'notification-standards.md': '成功、错误、警告和一般提醒通过全局通知服务统一展示。',
  'page-structure-standards.md': '页面统一使用公共页面头部、内容容器和响应式页面结构。',
  'pagination-standards.md': '列表分页统一使用公共分页组件和服务端总数契约。',
  'payment-method-standard.md': '支付方式由公共配置和选择组件管理；当前配置仅记录和选择，不执行真实支付。',
  'permission-capability-standards.md': '页面权限按用户、角色、权限链路定义真实业务能力，并由前后端共同校验。',
  'reminder-standards.md': '待办提醒支持一次性或周期任务、指定员工和统一的记录列表操作。',
  'responsive-breakpoint-standard.md': '响应式断点集中配置，页面布局不得自行增加断点或按设备写重复规则。',
  'search-standards.md': '后台列表统一使用公共搜索面板，选项排序与远程检索遵循共享数据契约。',
  'security-runtime-standards.md': '后端路由、SQL、文件访问和运行时代码必须通过安全审计边界。',
  'shared-standards.md': '经验分享内容的公开、私有和管理权限由服务端规则统一约束。',
  'rich-content-standards.md': '经验分享、站内公告和 DH 公告共用富文本编辑器、安全净化展示及媒体插入契约。',
  'guide-navigation-standard.md': 'DH 导航支持分类、链接、密码访问和受控文件预览/下载。',
  'download-security-standard.md': '业务文件通过受控后端接口下载，校验登录、权限、归属和文件状态。',
  'tab-standards.md': '页面标签导航统一使用公共 Tab 结构，超出宽度时在标签区域内横向滑动。',
  'time-standards.md': '业务时间统一按北京时间处理，使用 TimeUtil、TIME_FORMATS 和公共格式化入口。',
  'unified-page-structure.md': '旧路径仅保留导航，正文及可编译模板统一见 page-structure-standards.md。',
  'standards-audit-guide.md': '规范正文、公共实现和自动审计必须同时登记并纳入启动与构建检查。'
}

const requirementsByDocument: Partial<Record<string, string[]>> = {
  'time-standards.md': [
    '业务时区固定为 Asia/Shanghai（北京时间），业务日期和日期范围按该时区解释。',
    '业务时间统一使用 TimeUtil、TIME_FORMATS、useTime 和公共格式化函数。',
    '日期-only 字符串按日历日期处理，不得直接转换为 UTC ISO 值。',
    'ISO 8601 仅用于机器传输、日志和导出；页面日期控件绑定 TIME_FORMATS。',
    '业务显示不得直接使用 new Date()、toLocaleString() 或 .toISOString()。'
  ]
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
  '数据与时间': [
    '业务日期和时间统一按 Asia/Shanghai（北京时间）解释和展示。',
    '时间格式和日期运算使用 TimeUtil、TIME_FORMATS 与公共格式化入口。',
    '日期-only 字段与 ISO 时间戳严格区分，不得混用 UTC 转换。'
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

const getPreviewKind = (document: string): StandardPreviewKind => previewByDocument[document] || 'rules'

const extractDocumentSummary = (source: string, fallback: string) => {
  const lines = source.split(/\r?\n/)
  const firstSectionIndex = lines.findIndex(line => /^##\s/.test(line.trim()))
  const candidates = lines.slice(firstSectionIndex >= 0 ? firstSectionIndex + 1 : 0)
  const paragraph = candidates.find((line) => {
    const value = line.trim()
    return value && !/^#/.test(value) && !/^[-*]\s/.test(value) && !/^\d+\.\s/.test(value) && !/^>|^`|^\||^---/.test(value)
  })
  return paragraph?.trim() || fallback
}

const extractDocumentRequirements = (source: string, fallback: string[]) => {
  const requirements = source
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map(line => line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').trim())
    .filter(Boolean)
    .slice(0, 6)
  return requirements.length > 0 ? requirements : fallback
}

export interface StandardDocumentDetail {
  summary: string
  requirements: string[]
}

export const loadStandardDocument = async (
  document: string,
  fallbackSummary: string,
  fallbackRequirements: string[]
): Promise<StandardDocumentDetail> => {
  const entry = Object.entries(standardDocumentLoaders).find(([path]) => path.endsWith(`/docs/frontend/${document}`))
  const source = entry ? await entry[1]() : ''
  return {
    summary: extractDocumentSummary(source, fallbackSummary),
    requirements: requirementsByDocument[document] || extractDocumentRequirements(source, fallbackRequirements)
  }
}

export const standardsCatalog: StandardCatalogItem[] = manifest.standards.map((standard) => {
  const category = categoryByDocument[standard.document] || '视觉与组件'
  return {
    id: standard.document.replace(/\.md$/, ''),
    document: standard.document,
    title: titles[standard.document] || standard.document.replace(/\.md$/, ''),
    category,
    summary: summaryByDocument[standard.document] || summaryByCategory[category],
    requirements: [...requirementsByCategory[category]],
    previewKind: getPreviewKind(standard.document),
    checks: [...standard.checks],
    publicSources: [...standard.publicSources],
    status: '已登记'
  }
})

export const standardCategories: StandardCategory[] = [
  '页面与布局',
  '视觉与组件',
  '数据与表格',
  '数据与时间',
  '搜索与表单',
  '反馈与交互',
  '权限与安全',
  '运行时与性能'
]
