/**
 * 菜单相关类型定义
 */

export interface MenuItem {
  id: string | number
  name: string
  title?: string // 兼容不同命名
  url?: string
  path?: string
  icon?: string
  parent_id?: number | string
  module_id?: number
  module_key?: string
  sort_order?: number
  is_active?: boolean
  target?: string
  remarks?: string
  created_at?: string
  updated_at?: string
  menu_width?: number
  menu_type?: 'menu' | 'button' | 'directory'
  badge?: string | number
  priority?: number // 优先级，数字越小越重要
  children?: MenuItem[]
  meta?: {
    requiresAuth?: boolean
    roles?: string[]
    permissions?: string[]
    title?: string
    icon?: string
    hidden?: boolean
  }
}

export interface MenuConfig {
  // 菜单配置
  items: MenuItem[]
  // 主题配置
  theme?: 'light' | 'dark' | 'auto'
  // 动画配置
  animation?: {
    duration?: number
    easing?: string
    reducedMotion?: boolean
  }
  // 响应式配置
  responsive?: {
    mobile: {
      maxItems?: number
      enableGestures?: boolean
      enableAutoHide?: boolean
    }
    tablet: {
      collapsed?: boolean
    }
    desktop: {
      width?: number
      collapsible?: boolean
    }
  }
}

export interface MenuState {
  // 当前展开的菜单ID集合
  expandedMenus: Set<string | number>
  // 收藏的菜单
  favoriteMenus: MenuItem[]
  // 最近使用的菜单
  recentlyUsedMenus: MenuItem[]
  // 搜索关键字
  searchKeyword: string
  // 侧滑菜单是否打开
  isSlideMenuOpen: boolean
  // 底部导航是否可见
  isBottomNavVisible: boolean
  // 当前激活的菜单ID
  activeMenuId?: string | number
}

export interface MenuAction {
  // 快捷操作
  id: string
  name: string
  icon: string
  badge?: string | number
  handler: () => void
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
}

export interface MenuNavigation {
  // 菜单导航
  to: string | MenuItem
  replace?: boolean
  external?: boolean
}

export interface MenuItemComponentProps {
  // 菜单项组件属性
  item: MenuItem
  level?: number
  expanded?: boolean
  active?: boolean
  collapsible?: boolean
  showBadge?: boolean
  showIcon?: boolean
  onClick?: (item: MenuItem) => void
  onToggle?: (item: MenuItem) => void
}

export interface MenuSearchResult {
  // 菜单搜索结果
  item: MenuItem
  matchedPath: string[]
  score: number
}

export interface MenuGroup {
  // 菜单分组
  id: string
  name: string
  icon?: string
  items: MenuItem[]
  collapsed?: boolean
  sort_order?: number
}

export interface MenuBreadcrumb {
  // 面包屑导航
  id: string | number
  name: string
  path?: string
  icon?: string
  disabled?: boolean
}

export interface MenuPermission {
  // 菜单权限
  menuId: string | number
  permissions: string[]
  roles?: string[]
}

export interface MenuUserPreference {
  // 用户菜单偏好设置
  favoriteMenus: string[]
  recentlyUsedMenus: string[]
  expandedMenus: string[]
  menuWidth: {
    mobile: number
    tablet: number
    desktop: number
  }
  theme: 'light' | 'dark' | 'auto'
  animation: boolean
}

// 菜单事件类型
export interface MenuEvents {
  'menu-click': (menu: MenuItem) => void
  'menu-expand': (menu: MenuItem) => void
  'menu-collapse': (menu: MenuItem) => void
  'menu-search': (keyword: string, results: MenuSearchResult[]) => void
  'menu-favorite': (menu: MenuItem, isFavorite: boolean) => void
  'menu-resize': (width: number) => void
  'menu-theme-change': (theme: 'light' | 'dark' | 'auto') => void
}

// 菜单验证规则
export interface MenuValidationRule {
  field: keyof MenuItem
  required?: boolean
  min?: number
  max?: number
  pattern?: RegExp
  message?: string
  validator?: (value: any) => boolean | string
}

// 菜单导入导出格式
export interface MenuExportData {
  version: string
  timestamp: string
  menus: MenuItem[]
  preferences?: MenuUserPreference
}

// 菜单上下文
export interface MenuContext {
  // 当前菜单上下文
  user: {
    id: string | number
    name: string
    role: string
    permissions: string[]
  }
  device: {
    type: 'mobile' | 'tablet' | 'desktop'
    width: number
    height: number
    orientation: 'portrait' | 'landscape'
  }
  route: {
    path: string
    name?: string
    params?: Record<string, any>
    query?: Record<string, any>
  }
  config: MenuConfig
}

// 菜单工具函数类型
export type MenuUtils = {
  // 菜单工具函数
  flattenMenu: (menus: MenuItem[]) => MenuItem[]
  buildMenuTree: (menus: MenuItem[]) => MenuItem[]
  findMenuItem: (menus: MenuItem[], predicate: (item: MenuItem) => boolean) => MenuItem | null
  searchMenu: (menus: MenuItem[], keyword: string) => MenuSearchResult[]
  sortMenu: (menus: MenuItem[], field?: string) => MenuItem[]
  validateMenu: (menu: MenuItem, rules: MenuValidationRule[]) => { valid: boolean; errors: string[] }
}

// 默认菜单配置
export const DEFAULT_MENU_CONFIG: MenuConfig = {
  items: [],
  theme: 'auto',
  animation: {
    duration: 300,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    reducedMotion: false
  },
  responsive: {
    mobile: {
      maxItems: 5,
      enableGestures: true,
      enableAutoHide: true
    },
    tablet: {
      collapsed: false
    },
    desktop: {
      width: 260,
      collapsible: true
    }
  }
}

// 菜单断点
export const MENU_BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1200
} as const

// 菜单图标映射
export const MENU_ICON_MAP: Record<string, string> = {
  dashboard: 'fas fa-tachometer-alt',
  sales: 'fas fa-shopping-basket',
  inventory: 'fas fa-boxes',
  customers: 'fas fa-users',
  suppliers: 'fas fa-truck',
  phones: 'fas fa-mobile-alt',
  repairs: 'fas fa-tools',
  rentals: 'fas fa-handshake',
  analytics: 'fas fa-chart-line',
  system: 'fas fa-cog',
  settings: 'fas fa-sliders-h',
  user: 'fas fa-user',
  users: 'fas fa-users',
  report: 'fas fa-file-alt',
  export: 'fas fa-download',
  import: 'fas fa-upload',
  search: 'fas fa-search',
  filter: 'fas fa-filter',
  edit: 'fas fa-edit',
  delete: 'fas fa-trash',
  add: 'fas fa-plus',
  save: 'fas fa-save',
  cancel: 'fas fa-times',
  confirm: 'fas fa-check',
  warning: 'fas fa-exclamation-triangle',
  error: 'fas fa-times-circle',
  success: 'fas fa-check-circle',
  info: 'fas fa-info-circle'
}

export default MenuItem