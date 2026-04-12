export interface RoleVisualMeta {
  tagClass: string
  cardBadgeClass: string
  badgeClass: string
  icon: string
}

export interface ActionMeta {
  className: string
  icon: string
  name: string
}

export interface PermissionMeta {
  icon: string
  name: string
  description: string
}

const DEFAULT_ROLE_VISUAL: RoleVisualMeta = {
  tagClass: 'role-tag info',
  cardBadgeClass: 'bg-secondary',
  badgeClass: 'badge-secondary',
  icon: 'fas fa-user'
}

const ROLE_VISUAL_PRESETS: RoleVisualMeta[] = [
  {
    tagClass: 'role-tag primary',
    cardBadgeClass: 'bg-primary',
    badgeClass: 'badge-primary',
    icon: 'fas fa-user-shield'
  },
  {
    tagClass: 'role-tag success',
    cardBadgeClass: 'bg-success',
    badgeClass: 'badge-success',
    icon: 'fas fa-user-check'
  },
  {
    tagClass: 'role-tag warning',
    cardBadgeClass: 'bg-warning',
    badgeClass: 'badge-warning',
    icon: 'fas fa-user-tag'
  },
  {
    tagClass: 'role-tag info',
    cardBadgeClass: 'bg-secondary',
    badgeClass: 'badge-info',
    icon: 'fas fa-user-tie'
  },
  {
    tagClass: 'role-tag danger',
    cardBadgeClass: 'bg-danger',
    badgeClass: 'badge-danger',
    icon: 'fas fa-user-cog'
  }
]

const DEFAULT_ACTION_META: ActionMeta = {
  className: 'secondary',
  icon: 'fas fa-cog',
  name: '未知操作'
}

const ACTION_META_MAP: Record<string, ActionMeta> = {
  create: {
    className: 'success',
    icon: 'fas fa-plus',
    name: '创建'
  },
  edit: {
    className: 'warning',
    icon: 'fas fa-edit',
    name: '编辑'
  },
  delete: {
    className: 'danger',
    icon: 'fas fa-trash',
    name: '删除'
  },
  assign: {
    className: 'primary',
    icon: 'fas fa-user-tag',
    name: '分配'
  },
  permission: {
    className: 'info',
    icon: 'fas fa-lock',
    name: '权限'
  }
}

const DEFAULT_PERMISSION_META: PermissionMeta = {
  icon: 'fas fa-check',
  name: '',
  description: '权限功能'
}

const PERMISSION_META_MAP: Record<string, PermissionMeta> = {
  view: {
    icon: 'fas fa-eye',
    name: '查看',
    description: '查看数据和列表'
  },
  create: {
    icon: 'fas fa-plus',
    name: '新增',
    description: '创建新数据'
  },
  'return-to-stock': {
    icon: 'fas fa-undo-alt',
    name: '退库',
    description: '执行退库并恢复库存状态'
  },
  wholesale: {
    icon: 'fas fa-boxes',
    name: '调货',
    description: '执行同行调货或批发操作'
  },
  'proxy-transfer': {
    icon: 'fas fa-exchange-alt',
    name: '划拨',
    description: '执行供应商代划拨操作'
  },
  edit: {
    icon: 'fas fa-edit',
    name: '编辑',
    description: '编辑现有数据'
  },
  delete: {
    icon: 'fas fa-trash',
    name: '删除',
    description: '删除数据'
  },
  approve: {
    icon: 'fas fa-check-circle',
    name: '审批',
    description: '审批待处理业务'
  },
  manage: {
    icon: 'fas fa-user-shield',
    name: '管理',
    description: '执行管理类业务操作'
  },
  export: {
    icon: 'fas fa-file-export',
    name: '导出',
    description: '导出数据'
  },
  import: {
    icon: 'fas fa-file-import',
    name: '导入',
    description: '导入数据'
  },
  menu_view: {
    icon: 'fas fa-bars',
    name: '菜单显示',
    description: '控制左侧菜单是否显示'
  },
  'admin:view': {
    icon: 'fas fa-eye',
    name: '管理查看',
    description: '查看管理数据'
  },
  'admin:edit': {
    icon: 'fas fa-edit',
    name: '管理编辑',
    description: '编辑管理数据'
  },
  sell: {
    icon: 'fas fa-cash-register',
    name: '销售',
    description: '执行销售操作'
  },
  sync: {
    icon: 'fas fa-rotate',
    name: '同步',
    description: '执行同步类操作'
  }
}

const getStableHash = (value: string): number => {
  return value.split('').reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 0)
}

export const getRoleVisualMeta = (roleName: string): RoleVisualMeta => {
  const normalizedRoleName = (roleName || '').trim()
  if (!normalizedRoleName) {
    return DEFAULT_ROLE_VISUAL
  }

  const preset = ROLE_VISUAL_PRESETS[getStableHash(normalizedRoleName) % ROLE_VISUAL_PRESETS.length]
  return preset || DEFAULT_ROLE_VISUAL
}

export const getActionMeta = (action: string): ActionMeta => {
  return ACTION_META_MAP[action] || {
    ...DEFAULT_ACTION_META,
    name: action
  }
}

export const getPermissionMeta = (type: string): PermissionMeta => {
  return PERMISSION_META_MAP[type] || {
    ...DEFAULT_PERMISSION_META,
    name: type
  }
}
