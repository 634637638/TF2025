import { ElMessageBox } from 'element-plus'

type MessageBoxType = 'success' | 'warning' | 'info' | 'error'

type MessageBoxOptions = {
  type?: MessageBoxType
  confirmButtonText?: string
  cancelButtonText?: string
  customClass?: string | string[]
  appendTo?: HTMLElement
  [key: string]: any
}

type ConfirmSemantic = {
  title: string
  confirmText: string
  type: MessageBoxType
  customClass: string[]
}

const GENERIC_TITLES = new Set(['提示', '确认', '警告', '温馨提示', '操作确认'])
const GENERIC_CONFIRM_TEXTS = new Set(['确定', '确认'])
const TITLE_ALIAS_PATTERNS = [
  /确认删除|删除确认|删除媒体|删除颜色|删除预定单|确认删除/,
  /确认清空|清空确认|确认清除|清除确认/,
  /确认重置|重置确认/,
  /确认退出|退出确认/,
  /确认撤销|撤销确认/,
  /确认断开|断开确认/,
  /确认审核|审核确认/,
  /确认同步|同步确认/,
  /确认导入|导入确认/,
  /确认发布|发布确认/,
  /确认启用|启用确认/,
  /确认禁用|禁用确认/,
  /确认设为默认|设为默认确认/
]

let isEnhanced = false

const normalizeText = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : ''
}

const mergeCustomClass = (existing?: string | string[], additions: string[] = []) => {
  const base = Array.isArray(existing)
    ? existing
    : typeof existing === 'string'
      ? existing.split(/\s+/).filter(Boolean)
      : []

  return Array.from(new Set([...base, ...additions])).join(' ')
}

const inferConfirmSemantic = (message: string, title = ''): ConfirmSemantic => {
  const normalizedMessage = message.replace(/\s+/g, '')
  const normalizedTitle = title.replace(/\s+/g, '')
  const source = `${normalizedTitle}${normalizedMessage}`

  if (/清空|清除/.test(source)) {
    return {
      title: /清除/.test(source) ? '清除确认' : '清空确认',
      confirmText: /清除/.test(source) ? '清除' : '清空',
      type: 'warning',
      customClass: ['message-box-purple', 'message-box-danger']
    }
  }

  if (/删除|移除/.test(source)) {
    return {
      title: '删除确认',
      confirmText: '删除',
      type: 'warning',
      customClass: ['message-box-purple', 'message-box-danger']
    }
  }

  if (/重置/.test(source)) {
    return {
      title: '重置确认',
      confirmText: '重置',
      type: 'warning',
      customClass: ['message-box-purple', 'message-box-warning']
    }
  }

  if (/设为默认|默认模板|默认采集源/.test(source)) {
    return {
      title: '设为默认',
      confirmText: '设为默认',
      type: 'warning',
      customClass: ['message-box-purple']
    }
  }

  if (/启用/.test(source)) {
    return {
      title: '启用确认',
      confirmText: '启用',
      type: 'warning',
      customClass: ['message-box-purple']
    }
  }

  if (/禁用/.test(source)) {
    return {
      title: '禁用确认',
      confirmText: '禁用',
      type: 'warning',
      customClass: ['message-box-purple']
    }
  }

  if (/发布/.test(source)) {
    return {
      title: '发布确认',
      confirmText: '发布',
      type: 'warning',
      customClass: ['message-box-purple']
    }
  }

  if (/导入/.test(source)) {
    return {
      title: '导入确认',
      confirmText: '导入',
      type: 'warning',
      customClass: ['message-box-purple']
    }
  }

  if (/同步/.test(source)) {
    return {
      title: '同步确认',
      confirmText: '同步',
      type: 'warning',
      customClass: ['message-box-purple']
    }
  }

  if (/退出登录|退出/.test(source)) {
    return {
      title: '退出确认',
      confirmText: '退出',
      type: 'warning',
      customClass: ['message-box-purple']
    }
  }

  if (/撤销/.test(source)) {
    return {
      title: '撤销确认',
      confirmText: '撤销',
      type: 'warning',
      customClass: ['message-box-purple']
    }
  }

  if (/断开/.test(source)) {
    return {
      title: '断开确认',
      confirmText: '断开',
      type: 'warning',
      customClass: ['message-box-purple']
    }
  }

  if (/审核|通过/.test(source)) {
    return {
      title: '审核确认',
      confirmText: /通过/.test(source) ? '通过' : '确认',
      type: 'warning',
      customClass: ['message-box-purple']
    }
  }

  return {
    title: '操作确认',
    confirmText: '确定',
    type: 'warning',
    customClass: ['message-box-purple']
  }
}

const normalizeConfirmConfig = (
  message: unknown,
  title?: unknown,
  options?: MessageBoxOptions
) => {
  let nextTitle = title
  let nextOptions = options

  if (title && typeof title === 'object' && !Array.isArray(title)) {
    nextOptions = title as MessageBoxOptions
    nextTitle = undefined
  }

  const messageText = normalizeText(message)
  const titleText = normalizeText(nextTitle)
  const semantic = inferConfirmSemantic(messageText, titleText)
  const resolvedOptions = { ...(nextOptions || {}) }

  if (!titleText || GENERIC_TITLES.has(titleText) || TITLE_ALIAS_PATTERNS.some((pattern) => pattern.test(titleText))) {
    nextTitle = semantic.title
  }

  if (!resolvedOptions.confirmButtonText || GENERIC_CONFIRM_TEXTS.has(resolvedOptions.confirmButtonText)) {
    resolvedOptions.confirmButtonText = semantic.confirmText
  }

  if (!resolvedOptions.cancelButtonText) {
    resolvedOptions.cancelButtonText = '取消'
  }

  if (!resolvedOptions.type) {
    resolvedOptions.type = semantic.type
  }

  if (typeof document !== 'undefined') {
    resolvedOptions.appendTo = resolvedOptions.appendTo || document.body
  }

  resolvedOptions.customClass = mergeCustomClass(resolvedOptions.customClass, semantic.customClass)

  return {
    message,
    title: nextTitle || semantic.title,
    options: resolvedOptions
  }
}

export const enhanceGlobalMessageBox = () => {
  if (isEnhanced) {
    return
  }

  const originalConfirm = ElMessageBox.confirm.bind(ElMessageBox)

  ElMessageBox.confirm = ((message: unknown, title?: unknown, options?: MessageBoxOptions) => {
    const normalized = normalizeConfirmConfig(message, title, options)
    return originalConfirm(normalized.message as any, normalized.title as any, normalized.options as any)
  }) as typeof ElMessageBox.confirm

  isEnhanced = true
}
