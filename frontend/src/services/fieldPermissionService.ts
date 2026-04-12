/**
 * 前端字段权限服务
 * 处理字段权限控制和显示/隐藏逻辑
 */
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { unifiedApi } from '@/utils/unified-api'
import { logger } from '@/utils/logger'

// 字段敏感度级别
export enum SensitivityLevel {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  SENSITIVE = 'SENSITIVE',
  CONFIDENTIAL = 'CONFIDENTIAL'
}

// 字段类型
export enum FieldType {
  TEXT = 'TEXT',
  NUMBER = 'NUMBER',
  DATE = 'DATE',
  DATETIME = 'DATETIME',
  BOOLEAN = 'BOOLEAN',
  SELECT = 'SELECT',
  TEXTAREA = 'TEXTAREA',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  JSON = 'JSON'
}

// 字段权限接口
export interface FieldPermission {
  id: string
  name: string
  field: string
  type: FieldType
  sensitivity: SensitivityLevel
  group: string
  searchable: boolean
  editable: boolean
  visible: boolean
  exportable: boolean
  permissionLevel: string
}

// 模块字段配置接口
export interface ModuleFieldConfig {
  moduleKey: string
  moduleName: string
  icon: string
  fields: FieldPermission[]
  groups: FieldGroup[]
  source: string
}

interface FieldGroup {
  name: string
  fields: FieldPermission[]
}

export interface FieldTableColumn {
  key: string
  title: string
  dataIndex: string
  type: FieldType
  sensitivity: SensitivityLevel
  editable: boolean
  sorter: boolean
  width: number
  customRender: (value: unknown) => unknown
}

export interface FieldFormRule {
  required?: boolean
  message: string
  type?: 'email' | 'number'
  pattern?: RegExp
}

export interface FieldFormField {
  name: string
  label: string
  type: FieldType
  required: boolean
  rules: FieldFormRule[]
  placeholder: string
  options?: Array<{ label: string; value: string | number }>
}

export interface FieldSearchField {
  name: string
  label: string
  type: FieldType
  placeholder: string
}

type PermissionRowData = Record<string, unknown>

class FieldPermissionService {
  private fieldConfigs = ref<Map<string, ModuleFieldConfig>>(new Map())
  loading = ref(false)
  private authStore = useAuthStore()

  /**
   * 获取模块字段权限配置
   */
  async getModuleFieldConfig(moduleKey: string): Promise<ModuleFieldConfig | null> {
    // 检查缓存
    if (this.fieldConfigs.value.has(moduleKey)) {
      return this.fieldConfigs.value.get(moduleKey)!
    }

    try {
      this.loading.value = true

      // 从后端获取配置
      const response = await unifiedApi.get(`/fields/permissions/${moduleKey}`)

      if (response.success) {
        const config = response.data as ModuleFieldConfig
        this.fieldConfigs.value.set(moduleKey, config)
        return config
      }

      return null
    } catch (error) {
      logger.error(`获取模块 ${moduleKey} 字段权限失败:`, error)
      return null
    } finally {
      this.loading.value = false
    }
  }

  /**
   * 检查字段是否可见
   */
  isFieldVisible(moduleKey: string, fieldId: string): boolean {
    const config = this.fieldConfigs.value.get(moduleKey)
    if (!config) return true // 默认可见

    const field = config.fields.find(f => f.id === fieldId)
    return field ? field.visible : true
  }

  /**
   * 检查字段是否可编辑
   */
  isFieldEditable(moduleKey: string, fieldId: string): boolean {
    const config = this.fieldConfigs.value.get(moduleKey)
    if (!config) return true // 默认可编辑

    const field = config.fields.find(f => f.id === fieldId)
    return field ? field.editable : true
  }

  /**
   * 获取可见字段列表
   */
  getVisibleFields(moduleKey: string): FieldPermission[] {
    const config = this.fieldConfigs.value.get(moduleKey)
    if (!config) return []

    return config.fields.filter(field => field.visible)
  }

  /**
   * 获取可搜索字段列表
   */
  getSearchableFields(moduleKey: string): FieldPermission[] {
    const config = this.fieldConfigs.value.get(moduleKey)
    if (!config) return []

    return config.fields.filter(field => field.searchable && field.visible)
  }

  /**
   * 获取表格列配置
   */
  getTableColumns(moduleKey: string): FieldTableColumn[] {
    const config = this.fieldConfigs.value.get(moduleKey)
    if (!config) return []

    return config.fields
      .filter(field => field.visible)
      .map(field => ({
        key: field.field,
        title: field.name,
        dataIndex: field.field,
        type: field.type,
        sensitivity: field.sensitivity,
        editable: field.editable,
        sorter: field.type === FieldType.NUMBER || field.type === FieldType.DATE,
        width: this.getColumnWidth(field.type),
        customRender: this.getCustomRender(field)
      }))
  }

  /**
   * 获取表单字段配置
   */
  getFormFields(moduleKey: string): FieldFormField[] {
    const config = this.fieldConfigs.value.get(moduleKey)
    if (!config) return []

    return config.fields
      .filter(field => field.visible && field.editable)
      .map(field => ({
        name: field.field,
        label: field.name,
        type: field.type,
        required: this.isRequiredField(field.field),
        rules: this.getFieldRules(field),
        placeholder: `请输入${field.name}`,
        options: field.type === FieldType.SELECT ? [] : undefined
      }))
  }

  /**
   * 获取搜索表单字段配置
   */
  getSearchFormFields(moduleKey: string): FieldSearchField[] {
    const config = this.fieldConfigs.value.get(moduleKey)
    if (!config) return []

    return config.fields
      .filter(field => field.searchable && field.visible)
      .map(field => ({
        name: field.field,
        label: field.name,
        type: field.type,
        placeholder: `搜索${field.name}`
      }))
  }

  /**
   * 过滤数据对象（根据权限）
   */
  filterDataByPermissions(moduleKey: string, data: PermissionRowData): PermissionRowData {
    const config = this.fieldConfigs.value.get(moduleKey)
    if (!config) return data

    const filtered: PermissionRowData = {}

    // 保留可见字段
    config.fields.forEach(field => {
      if (field.visible && data[field.field] !== undefined) {
        filtered[field.field] = this.formatFieldValue(data[field.field], field)
      }
    })

    // 保留系统字段
    if (data.id) filtered.id = data.id
    if (data.created_at) filtered.created_at = data.created_at
    if (data.updated_at) filtered.updated_at = data.updated_at

    return filtered
  }

  /**
   * 格式化字段值（根据敏感度）
   */
  private formatFieldValue(value: unknown, field: FieldPermission): unknown {
    if (value === null || value === undefined) return value

    switch (field.sensitivity) {
      case SensitivityLevel.CONFIDENTIAL:
        // 机密字段，只对高级管理员显示
        if (!this.isHighLevelAdmin()) {
          return '***'
        }
        break

      case SensitivityLevel.SENSITIVE:
        // 敏感字段，部分隐藏
        if (!this.isAdmin()) {
          return this.maskSensitiveValue(value, field.type)
        }
        break

      case SensitivityLevel.INTERNAL:
        // 内部字段，只对员工显示
        if (!this.isEmployee()) {
          return '***'
        }
        break
    }

    return value
  }

  /**
   * 掩码敏感值
   */
  private maskSensitiveValue(value: unknown, type: FieldType): string {
    const str = String(value)

    switch (type) {
      case FieldType.PHONE:
        // 手机号：138****1234
        return str.length === 11
          ? str.substring(0, 3) + '****' + str.substring(7)
          : '***'

      case FieldType.EMAIL:
        // 邮箱：a***@example.com
        const [username, domain] = str.split('@')
        if (username && domain) {
          return username.substring(0, 1) + '***@' + domain
        }
        return '***'

      case FieldType.TEXT:
        // 文本：显示前后各2位
        if (str.length <= 4) {
          return '***'
        }
        return str.substring(0, 2) + '***' + str.substring(str.length - 2)

      default:
        return '***'
    }
  }

  /**
   * 获取列宽
   */
  private getColumnWidth(type: FieldType): number {
    const widthMap: Record<FieldType, number> = {
      [FieldType.NUMBER]: 100,
      [FieldType.DATE]: 120,
      [FieldType.DATETIME]: 160,
      [FieldType.BOOLEAN]: 80,
      [FieldType.SELECT]: 120,
      [FieldType.EMAIL]: 200,
      [FieldType.PHONE]: 130,
      [FieldType.TEXT]: 150,
      [FieldType.TEXTAREA]: 200,
      [FieldType.JSON]: 150
    }

    return widthMap[type] || 150
  }

  /**
   * 获取自定义渲染函数
   */
  private getCustomRender(field: FieldPermission) {
    return (value: unknown) => {
      if (value === null || value === undefined) return '-'

      // 根据敏感度格式化显示
      return this.formatFieldValue(value, field)
    }
  }

  /**
   * 判断是否为必填字段
   */
  private isRequiredField(fieldName: string): boolean {
    const requiredFields = ['name', 'phone', 'status']
    return requiredFields.includes(fieldName)
  }

  /**
   * 获取字段验证规则
   */
  private getFieldRules(field: FieldPermission): FieldFormRule[] {
    const rules: FieldFormRule[] = []

    if (this.isRequiredField(field.field)) {
      rules.push({ required: true, message: `请输入${field.name}` })
    }

    switch (field.type) {
      case FieldType.EMAIL:
        rules.push({ type: 'email', message: '请输入有效的邮箱地址' })
        break

      case FieldType.PHONE:
        rules.push({ pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' })
        break

      case FieldType.NUMBER:
        rules.push({ type: 'number', message: '请输入有效的数字' })
        break
    }

    return rules
  }

  /**
   * 检查用户角色
   */
  private isHighLevelAdmin(): boolean {
    return this.authStore.isAdmin
  }

  private isAdmin(): boolean {
    return this.authStore.isAdmin
  }

  private isEmployee(): boolean {
    return this.authStore.isAuthenticated
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.fieldConfigs.value.clear()
  }

  /**
   * 监听角色变化
   */
  watchRoleChange(callback: () => void) {
    watch(
      () => [
        this.authStore.user?.role_id,
        Array.isArray(this.authStore.user?.role_ids) ? this.authStore.user.role_ids.join(',') : '',
        Array.isArray(this.authStore.userRoles)
          ? this.authStore.userRoles
              .map((role: unknown) => {
                if (typeof role === 'string') return role
                if (typeof role === 'object' && role !== null) {
                  const roleInfo = role as { id?: string | number; code?: string; name?: string }
                  return roleInfo.id || roleInfo.code || roleInfo.name || ''
                }
                return ''
              })
              .join(',')
          : ''
      ],
      () => {
        this.clearCache()
        callback()
      }
    )
  }
}

// 创建单例
export const fieldPermissionService = new FieldPermissionService()

// 提供组合式API
export function useFieldPermissions() {
  const loading = computed(() => fieldPermissionService.loading.value)

  return {
    loading,
    getModuleFieldConfig: fieldPermissionService.getModuleFieldConfig.bind(fieldPermissionService),
    isFieldVisible: fieldPermissionService.isFieldVisible.bind(fieldPermissionService),
    isFieldEditable: fieldPermissionService.isFieldEditable.bind(fieldPermissionService),
    getVisibleFields: fieldPermissionService.getVisibleFields.bind(fieldPermissionService),
    getSearchableFields: fieldPermissionService.getSearchableFields.bind(fieldPermissionService),
    getTableColumns: fieldPermissionService.getTableColumns.bind(fieldPermissionService),
    getFormFields: fieldPermissionService.getFormFields.bind(fieldPermissionService),
    getSearchFormFields: fieldPermissionService.getSearchFormFields.bind(fieldPermissionService),
    filterDataByPermissions: fieldPermissionService.filterDataByPermissions.bind(fieldPermissionService),
    clearCache: fieldPermissionService.clearCache.bind(fieldPermissionService),
    watchRoleChange: fieldPermissionService.watchRoleChange.bind(fieldPermissionService)
  }
}
