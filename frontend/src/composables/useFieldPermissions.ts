import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { unifiedApi as api } from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { logger } from '@/utils/logger'

interface ModuleFieldPermissions {
  hidden_fields: string[]
  editable_fields: string[]
}

interface FieldPermissionsResponse {
  field_permissions?: Record<string, Partial<ModuleFieldPermissions>>
}

export const shouldShowActionColumn = (
  fieldVisible: boolean,
  actionPermissions: readonly boolean[]
) => fieldVisible || actionPermissions.some(Boolean)

export function useFieldPermissions() {
  const authStore = useAuthStore()
  const loading = ref(false)
  const permissions = ref<Record<string, ModuleFieldPermissions>>({})

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
      hidden_fields: new Set<string>(),
      editable_fields: new Set<string>()
    }

    const moduleKeyVariants = getNormalizedModuleKeys(moduleKey)
    let matchedPermissions = moduleKeyVariants
      .map(key => permissions.value[key])
      .filter((modulePerms): modulePerms is ModuleFieldPermissions => Boolean(modulePerms))

    // Some callers still use a short page key (for example `subsidy`) while
    // the permission API returns the registered key (`subsidy_subsidyview`).
    // Only use reverse alias matching when no direct variant was found, so a
    // specific child page cannot accidentally inherit a sibling page's rules.
    if (matchedPermissions.length === 0) {
      const requestedVariants = new Set(moduleKeyVariants)
      matchedPermissions = Object.entries(permissions.value)
        .filter(([configuredKey]) => (
          getNormalizedModuleKeys(configuredKey).some(key => requestedVariants.has(key))
        ))
        .map(([, modulePerms]) => modulePerms)
    }

    matchedPermissions.forEach((modulePerms) => {
      modulePerms.hidden_fields.forEach((field) => merged.hidden_fields.add(field))
      modulePerms.editable_fields.forEach((field) => merged.editable_fields.add(field))
    })

    return {
      hidden_fields: Array.from(merged.hidden_fields),
      editable_fields: Array.from(merged.editable_fields)
    }
  }

  // 获取模块的字段权限
  const getModuleFieldPermissions = (moduleKey: string) => {
    return mergeModuleFieldPermissions(moduleKey)
  }

  // 检查字段是否可见
  const isFieldVisible = (moduleKey: string, fieldKey: string) => {
    return !mergeModuleFieldPermissions(moduleKey).hidden_fields.includes(fieldKey)
  }

  // 检查字段是否可编辑
  const isFieldEditable = (moduleKey: string, fieldKey: string) => {
    if (!isFieldVisible(moduleKey, fieldKey)) {
      return false
    }

    // 获取模块的字段权限配置
    const modulePerms = mergeModuleFieldPermissions(moduleKey)
    const editable_fields = modulePerms.editable_fields || []

    // 支持多种格式匹配：
    // 1. 完整字段 ID：customer_info.customer_idcard（直接使用 fieldKey）
    // 2. 简单字段名：customer_idcard（提取最后部分）
    // 3. 模块.字段 ID：subsidy.customer_info.customer_idcard（完整格式）

    // 检查字段是否在可编辑列表中
    return editable_fields.includes(fieldKey) ||
           editable_fields.includes(fieldKey.split('.').pop() || '') ||
           editable_fields.includes(`${moduleKey}.${fieldKey}`)
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
        // 处理后端返回的数据结构，提取 field_permissions
        // unifiedApi 已解包一层，直接从 response 取 data
        const responseData = extractResponseData<FieldPermissionsResponse>(response)
        const rawPermissions = responseData.field_permissions || {}
        const processedPermissions: Record<string, ModuleFieldPermissions> = {}

        // 后端返回的结构: { subsidy: { module_key: "subsidy", hidden_fields: [...], editable_fields: [...], role_sources: [...] } }
        Object.keys(rawPermissions).forEach(key => {
          const modulePerm = rawPermissions[key]
          processedPermissions[key] = {
            hidden_fields: modulePerm.hidden_fields || [],
            editable_fields: modulePerm.editable_fields || []
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
    fields: Array<{ key: string; [key: string]: unknown }>
  ) => {
    return fields.filter(field => isFieldVisible(moduleKey, field.key))
  }

  // 获取特定模块的隐藏字段列表
  const getHiddenFields = (moduleKey: string) => {
    const modulePerms = getModuleFieldPermissions(moduleKey)
    return modulePerms.hidden_fields || []
  }

  // 生成表格列的显示控制对象
  const generateColumnVisibility = (moduleKey: string, columns: Array<string>) => {
    const hidden_fields = getHiddenFields(moduleKey)
    const visibility: Record<string, boolean> = {}

    columns.forEach(column => {
      visibility[column] = !hidden_fields.includes(column)
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
