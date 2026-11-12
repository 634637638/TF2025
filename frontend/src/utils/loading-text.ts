import type { RequestConfig } from './unified-api'

/** Loading 文案只使用已知业务名称，不回显 URL、参数、文件名或凭据。 */
const resourceNames: Record<string, string> = {
  dashboard: '仪表盘数据', suppliers: '供应商资料', payments: '供应商付款记录',
  system: '系统设置', 'system-settings': '系统设置', 'site-settings': '站点设置',
  backup: '备份记录', git: '仓库状态', menus: '菜单', permissions: '权限配置',
  roles: '角色', users: '用户资料', 'user-stores': '门店绑定', employees: '员工资料',
  stores: '门店资料', customers: '客户资料', brands: '品牌', models: '型号', colors: '颜色',
  memories: '内存规格', phones: '库存设备', inventory: '库存数据', sales: '销售记录',
  accessories: '配件', preorders: '预定记录', reminders: '待办提醒', shared: '经验分享',
  guide: '导航内容', marketing: '营销内容', analytics: '分析数据', attendance: '考勤记录',
  salary: '工资数据', subsidy: '国补记录', rentals: '租赁记录', repairs: '维修记录',
  'price-list': '报价数据', price: '报价数据', 'screen-lock': '安全设置',
  'phone-stock-warnings': '库存预警配置', 'data-check': '数据检查结果', 'data-import': '导入记录',
  logs: '日志', shop: '商城配置', home: '首页推荐', banners: '轮播图', templates: '商品模板',
  products: '商品', cart: '购物车', orders: '订单', 'content-media': '内容素材',
  icons: '图标', regions: '地区信息', auth: '账户信息', 'salary-records': '工资记录',
  'salary-templates': '工资模板', 'permission-logs': '权限日志', modules: '权限模块',
  'supplier-payments': '供应商付款记录', transfers: '调拨记录', 'stock-in': '入库记录',
  uploads: '上传文件', upload: '文件', options: '筛选选项', my: '个人资料', query: '设备资料',
  'sales-management': '商城订单', settings: '界面设置', config: '商城配置',
  announcements: '站内公告', 'query-users': '查询密码', images: '商品图片',
  'h5-orders': '商城订单', 'field-permissions': '字段权限'
}

const operationText: Record<string, string> = {
  '/git/commit': '正在提交仓库更改...',
  '/git/push': '正在推送仓库更改...',
  '/git/pull': '正在拉取仓库更新...',
  '/git/discard': '正在撤销仓库更改...',
  '/git/checkout': '正在切换仓库版本...',
  '/git/delete-commit': '正在删除提交记录...',
  '/git/backup/archive': '正在创建代码备份...',
  '/git/restore-main': '正在恢复主分支...',
  '/backup/create': '正在创建备份...',
  '/backup/cleanup': '正在清理旧备份...',
  '/backup/cloud/test': '正在测试云盘连接...',
  '/backup/cloud/connect': '正在连接云盘...',
  '/data-import/upload/cleanup': '正在清理导入临时文件...',
  '/repairs/upload/cleanup': '正在清理维修临时附件...',
  '/shared/uploads/cleanup': '正在清理经验分享临时附件...',
  '/upload/delete-temp-files': '正在清理临时文件...',
  '/data-import/analyze': '正在分析导入文件...',
  '/data-import/import': '正在导入数据...',
  '/inventory/quick-sale': '正在提交销售记录...',
  '/sales/phone': '正在提交销售记录...',
  '/auth/change-password': '正在修改密码...',
  '/auth/refresh': '正在续期登录状态...',
  '/cart/add': '正在加入购物车...',
  '/orders/create': '正在提交订单...'
}

const resourcePaths: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/(?:phones|shop\/(?:products|templates))\/[^/]+\/images(?:\/|$)/, '商品图片'],
  [/^\/rentals\/[^/]+\/files(?:\/|$)/, '租赁附件'],
  [/^\/subsidy\/[^/]+\/photos(?:\/|$)/, '国补照片'],
  [/^\/employees\/roles(?:\/|$)/, '角色'],
  [/^\/(?:repairs|rentals)\/customers(?:\/|$)/, '客户资料'],
  [/^\/guide\/announcements(?:\/|$)/, '导航公告'],
  [/^\/guide\/(?:categories\/[^/]+\/)?links(?:\/|$)/, '导航链接'],
  [/^\/guide\/categories(?:\/|$)/, '导航分类'],
  [/^\/shared\/categories(?:\/|$)/, '经验分享分类'],
  [/^\/query\/returngoods(?:\/|$)/, '退库记录'],
  [/^\/backup\/cloud\/settings(?:\/|$)/, '云盘备份设置'],
  [/^\/backup\/cloud\/accounts(?:\/|$)/, '云盘账户'],
  [/^\/backup\/cloud\/(?:files|trash)(?:\/|$)/, '云盘文件'],
  [/^\/backup\/cloud\/folders(?:\/|$)/, '云盘目录'],
  [/^\/backup\/cloud\/tasks(?:\/|$)/, '云盘备份任务']
]

export function resolveRequestLoadingText(config: RequestConfig): string {
  if (config.loadingText?.trim()) return config.loadingText.trim()
  const path = (config.url || '').replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0]
    .replace(/^\/api(?=\/)/, '').replace(/^\/public(?=\/)/, '')
  const method = (config.method || 'get').toLowerCase()
  const write = !['get', 'head', 'options'].includes(method)
  const segment = path.split('/').filter(Boolean)
  const resourceKey = ['shop', 'auth', 'system', 'permissions', 'screen-lock', 'sales-management'].includes(segment[0]) && resourceNames[segment[1]]
    ? segment[1] : segment[0]
  const resource = resourcePaths.find(([pattern]) => pattern.test(path))?.[1] || resourceNames[resourceKey] || '数据'

  if (write && operationText[path]) return operationText[path]
  if (write && /\/(?:login|register|logout)$/.test(path)) {
    return path.endsWith('/login') ? '正在登录...' : path.endsWith('/register') ? '正在注册账户...' : '正在退出登录...'
  }
  if (write && /\/(?:verify[^/]*|unlock)$/.test(path)) return '正在验证身份...'
  if (/^\/backup\/download-link\//.test(path)) return '正在准备备份下载...'
  if (write && /\/(?:cleanup|clear[^/]*)(?:\/|$)/.test(path)) return `正在清理${resource}...`
  if (write && /\/(?:batch-delete|delete[^/]*)(?:\/|$)/.test(path)) return `正在删除${resource}...`
  if (method === 'delete') return `正在删除${resource}...`
  if (write && /\/import(?:\/|$)/.test(path)) return `正在导入${resource}...`
  if (write && ((typeof FormData !== 'undefined' && config.data instanceof FormData) || /\/upload(?:\/|$)/.test(path))) return '正在上传文件...'
  if (/\/export(?:\/|$)/.test(path)) return `正在导出${resource}...`
  if (/\/download(?:\/|$)/.test(path) || config.responseType === 'blob') return '正在下载文件...'
  if (write && /\/(?:batch-merge|merge)(?:\/|$)/.test(path)) return '正在合并数据...'
  if (write && /\/(?:sync\/(?:trigger|all)|sync-all)$/.test(path)) return `正在同步${resource}...`
  if (write && /^\/salary-records\/(?:calculate|batch-calculate|recalculate-month)$/.test(path)) return '正在计算工资...'
  if (write && /\/(?:cancel|batch-cancel)$/.test(path)) return `正在取消${resource}...`
  if (write && /\/restore(?:-name)?$/.test(path)) return `正在恢复${resource}...`
  if (write && /\/(?:reorder|sort)$/.test(path)) return `正在保存${resource}排序...`
  if (write && /\/match$/.test(path)) return '正在匹配预定设备...'
  if (write && /\/(?:deliver|ship)$/.test(path)) return `正在提交${resource}交付信息...`
  if (write && /\/(?:complete|finish)$/.test(path)) return `正在完成${resource}...`
  if (write && /\/return-to-stock$/.test(path)) return '正在办理设备退库...'
  if (write && /\/confirm-arrival$/.test(path)) return '正在确认国补到账...'
  if (write && /\/confirm$/.test(path)) return `正在确认${resource}...`
  if (write && /\/confirm-payment$/.test(path)) return '正在确认支付...'
  if (write && /\/(?:approve|reject|audit)(?:\/|$)/.test(path)) return `正在审核${resource}...`
  if (write && /\/(?:pay|payments?|batch-payment|settle|refund)(?:\/|$)/.test(path)) return '正在提交收付款信息...'
  if (write) return `正在保存${resource}...`
  return `正在读取${resource}...`
}
