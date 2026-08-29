/**
 * 工资模板 API 服务
 */
import { unifiedApi } from '@/utils/unified-api'

// ============================================================================
// 类型定义
// ============================================================================

export interface SalaryTemplate {
  id?: number
  name: string
  description?: string
  base_salary: number
  // 自动涨薪规则
  auto_raise_rule?: {
    enabled?: boolean
    years?: number
    months?: number
    amount?: number
    max_salary?: number
  } | string | null
  commission_type: 'fixed' | 'percentage'
  commission_fixed?: number
  commission_new_fixed?: number
  commission_used_fixed?: number
  commission_percentage?: number
  overtime_hourly_rate: number
  rest_days: number
  is_active: boolean
  is_default: boolean
  employee_count?: number
  created_at?: string
  updated_at?: string
}

export interface TemplateFilters {
  page?: number
  page_size?: number
  is_active?: boolean
  is_default?: boolean
}

// ============================================================================
// 工资模板 API 对象
// ============================================================================

export const salaryTemplateApi = {
  /**
   * 获取工资模板列表
   */
  getTemplates: (filters: TemplateFilters = {}) => {
    return unifiedApi.get('/salary-templates', { params: filters })
  },

  /**
   * 获取激活的模板列表
   */
  getActiveTemplates: () => {
    return unifiedApi.get('/salary-templates/active')
  },

  /**
   * 获取工资模板详情
   */
  getTemplateById: (id: number) => {
    return unifiedApi.get(`/salary-templates/${id}`)
  },

  /**
   * 创建工资模板
   */
  createTemplate: (data: SalaryTemplate) => {
    return unifiedApi.post('/salary-templates', data)
  },

  /**
   * 更新工资模板
   */
  updateTemplate: (id: number, data: Partial<SalaryTemplate>) => {
    return unifiedApi.put(`/salary-templates/${id}`, data)
  },

  /**
   * 删除工资模板
   */
  deleteTemplate: (id: number) => {
    return unifiedApi.delete(`/salary-templates/${id}`)
  },

  /**
   * 设为默认模板
   */
  setAsDefault: (id: number) => {
    return unifiedApi.post(`/salary-templates/${id}/set-default`)
  },

  /**
   * 设置员工工资模板
   */
  setEmployeeTemplate: (userId: number, templateId: number | null) => {
    return unifiedApi.put(`/salary-templates/employees/${userId}/template`, { template_id: templateId })
  }
}

export default salaryTemplateApi
