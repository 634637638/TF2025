import { getPermissionActionMeta } from '@/config/permission-actions'

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

// 此处只维护日志中非权限业务事件的视觉信息；权限动作从公共清单派生。
const ACTION_EVENT_META: Record<string, ActionMeta> = {
  assign: { className: 'action-assign', icon: 'fas fa-user-tag', name: '分配' },
  permission: { className: 'action-permission', icon: 'fas fa-lock', name: '权限' },
  enable: { className: 'action-enable', icon: 'fas fa-toggle-on', name: '启用' },
  disable: { className: 'action-disable', icon: 'fas fa-toggle-off', name: '禁用' }
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
  if (ACTION_EVENT_META[action]) return ACTION_EVENT_META[action]
  const permissionMeta = getPermissionActionMeta(action)
  return { ...DEFAULT_ACTION_META, ...permissionMeta, className: `action-${action}` }
}

export const getPermissionMeta = getPermissionActionMeta
