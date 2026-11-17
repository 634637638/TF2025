import capabilities from '../../../backend/src/config/module-permission-capabilities.json'

const icons: Record<string, string> = {
  view: 'eye', 'goods-view': 'search', 'goods-sell': 'shopping-cart', 'goods-gift': 'gift',
  create: 'plus', 'stock-in': 'boxes', sell: 'cash-register', gift: 'gift', transfer: 'exchange-alt',
  'return-to-stock': 'undo-alt', exchange: 'exchange-alt', film: 'mobile-alt', wholesale: 'boxes',
  'proxy-transfer': 'exchange-alt', edit: 'edit', delete: 'trash', match: 'link', deliver: 'check-circle',
  'edit-history': 'history', cancel: 'ban', approve: 'check-circle', pay: 'money-bill-wave', 'return-check': 'clipboard-check',
  'goods-warning': 'exclamation-triangle', arrival: 'hand-holding-usd', upload: 'cloud-upload-alt',
  manage: 'user-shield', export: 'file-export', import: 'file-import', sync: 'sync-alt', menu_view: 'bars'
}

/** 权限开关、日志与无权提示共用能力清单中的中文名和说明。 */
export type PermissionAction = keyof typeof capabilities.actionLabels

export const getPermissionActionMeta = (action: string) => {
  const canonical = capabilities.actionAliases[action as keyof typeof capabilities.actionAliases] || action
  const name = capabilities.actionLabels[canonical as keyof typeof capabilities.actionLabels]
  const description = capabilities.actionDefinitions[canonical as keyof typeof capabilities.actionDefinitions]
  return {
    name: name || '未登记操作',
    description: description || (action === 'menu_view' ? '控制导航菜单显示，不授予页面查看权限' : '未登记权限动作'),
    icon: `fas fa-${icons[canonical] || 'check'}`
  }
}
