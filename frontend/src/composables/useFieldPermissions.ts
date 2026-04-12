import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { unifiedApi as api } from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { logger } from '@/utils/logger'

export function useFieldPermissions() {
  const authStore = useAuthStore()
  const loading = ref(false)
  const permissions = ref<Record<string, any>>({})

  const getNormalizedModuleKeys = (moduleKey: string) => {
    const normalizedKeys = new Set<string>()
    const rawKey = String(moduleKey || '').trim()

    if (!rawKey) {
      return []
    }

    normalizedKeys.add(rawKey)

    const compactKey = rawKey.replace(/^\/+|\/+$/g, '')
    normalizedKeys.add(compactKey)

    const withoutViewSuffix = compactKey.replace(/_?view$/i, '')
    normalizedKeys.add(withoutViewSuffix)

    const pageModuleKey = compactKey.replace(/_[^_]*view$/i, '')
    normalizedKeys.add(pageModuleKey)

    const simpleModuleKey = pageModuleKey.split('_')[0]
    if (simpleModuleKey) {
      normalizedKeys.add(simpleModuleKey)
    }

    return Array.from(normalizedKeys).filter(Boolean)
  }

  const mergeModuleFieldPermissions = (moduleKey: string) => {
    const merged = {
      hiddenFields: new Set<string>(),
      editableFields: new Set<string>()
    }

    getNormalizedModuleKeys(moduleKey).forEach((key) => {
      const modulePerms = permissions.value[key] || {}
      ;(modulePerms.hiddenFields || []).forEach((field: string) => merged.hiddenFields.add(field))
      ;(modulePerms.editableFields || []).forEach((field: string) => merged.editableFields.add(field))
    })

    return {
      hiddenFields: Array.from(merged.hiddenFields),
      editableFields: Array.from(merged.editableFields)
    }
  }

  // 获取模块的字段权限
  const getModuleFieldPermissions = (moduleKey: string) => {
    return mergeModuleFieldPermissions(moduleKey)
  }

  // 标准化模块 key 的辅助函数
  const normalizeModuleKey = (key: string): string[] => {
    return getNormalizedModuleKeys(key)
  }

  // 检查字段是否可见
  const isFieldVisible = (moduleKey: string, fieldKey: string) => {
    // 直接访问 permissions.value 以确保响应式
    const currentPermissions = permissions.value || {}

    // 尝试所有可能的模块 key 变体
    const moduleKeyVariants = normalizeModuleKey(moduleKey)

    // 收集所有变体的隐藏字段
    const allHiddenFields = new Set<string>()
    for (const variant of moduleKeyVariants) {
      const modulePerms = currentPermissions[variant] || { hiddenFields: [] }
      const hiddenFields = modulePerms.hiddenFields || []
      hiddenFields.forEach(field => allHiddenFields.add(field))
    }

    const hiddenFieldsArray = Array.from(allHiddenFields)

    // 检查字段是否在隐藏列表中
    const result = !hiddenFieldsArray.includes(fieldKey)

    return result
  }

  // 检查字段是否可编辑
  const isFieldEditable = (moduleKey: string, fieldKey: string) => {
    if (!isFieldVisible(moduleKey, fieldKey)) {
      return false
    }

    // 获取模块的字段权限配置
    const modulePerms = mergeModuleFieldPermissions(moduleKey)
    const editableFields = modulePerms.editableFields || []

    // 支持多种格式匹配：
    // 1. 完整字段 ID：customer_info.customer_idcard（直接使用 fieldKey）
    // 2. 简单字段名：customer_idcard（提取最后部分）
    // 3. 模块.字段 ID：subsidy.customer_info.customer_idcard（完整格式）

    // 检查字段是否在可编辑列表中
    return editableFields.includes(fieldKey) ||
           editableFields.includes(fieldKey.split('.').pop() || '') ||
           editableFields.includes(`${moduleKey}.${fieldKey}`)
  }

  // 检查模块权限
  const hasModulePermission = (moduleKey: string, permission: string) => {
    return authStore.hasPermission(`${moduleKey}:${permission}`)
  }

  // 获取用户的所有字段权限
  const fetchUserFieldPermissions = async () => {
    if (!authStore.token) {
      return
    }

    loading.value = true
    try {
      // 使用统一的API客户端
      const response = await api.get('/permissions/user-field-permissions')

      if (response.success) {
        // 处理后端返回的数据结构，提取 fieldPermissions
        // unifiedApi 已解包一层，直接从 response 取 data
        const responseData = extractResponseData<any>(response)
        const rawPermissions = responseData.fieldPermissions || {}
        const processedPermissions: Record<string, any> = {}

        // 后端返回的结构: { subsidy: { moduleKey: "subsidy", hiddenFields: [...], editableFields: [...], roleSources: [...] } }
        // 需要转换为: { subsidy: { hiddenFields: [...], editableFields: [...] } }
        Object.keys(rawPermissions).forEach(key => {
          const modulePerm = rawPermissions[key]
          processedPermissions[key] = {
            hiddenFields: modulePerm.hiddenFields || [],
            editableFields: modulePerm.editableFields || []
          }
        })

        permissions.value = processedPermissions
      }
    } catch (error) {
      logger.error('获取字段权限失败:', error)
    } finally {
      loading.value = false
    }
  }

  // 获取字段的权限类名
  const getFieldPermissionClass = (moduleKey: string, fieldKey: string) => {
    if (!isFieldVisible(moduleKey, fieldKey)) {
      return 'field-hidden'
    }
    if (!isFieldEditable(moduleKey, fieldKey)) {
      return 'field-readonly'
    }
    return ''
  }

  // 过滤字段列表
  const filterFieldsByPermission = (
    moduleKey: string,
    fields: Array<{ key: string; [key: string]: any }>
  ) => {
    return fields.filter(field => isFieldVisible(moduleKey, field.key))
  }

  // 获取特定模块的隐藏字段列表
  const getHiddenFields = (moduleKey: string) => {
    const modulePerms = getModuleFieldPermissions(moduleKey)
    return modulePerms.hiddenFields || []
  }

  // 生成表格列的显示控制对象
  const generateColumnVisibility = (moduleKey: string, columns: Array<string>) => {
    const hiddenFields = getHiddenFields(moduleKey)
    const visibility: Record<string, boolean> = {}

    columns.forEach(column => {
      visibility[column] = !hiddenFields.includes(column)
    })

    return visibility
  }

  // 初始化 - 实时获取权限
  const init = async (forceRefresh = false) => {
    // 如果有token，直接从服务器获取最新权限
    if (authStore.token) {
      // 如果是强制刷新，先清空缓存
      if (forceRefresh) {
        permissions.value = {}
      }
      await fetchUserFieldPermissions()
    }
  }

  return {
    loading: computed(() => loading.value),
    permissions: computed(() => permissions.value),
    getModuleFieldPermissions,
    isFieldVisible,
    isFieldEditable,
    hasModulePermission,
    fetchUserFieldPermissions,
    getFieldPermissionClass,
    filterFieldsByPermission,
    getHiddenFields,
    generateColumnVisibility,
    init
  }
}

// 全局实例
export const fieldPermissions = useFieldPermissions()
