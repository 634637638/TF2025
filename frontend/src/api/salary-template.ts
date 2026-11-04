/**
 * 工资模板 API 服务
 */
import { unifiedApi } from '@/utils/unified-api'
import type { SalaryTemplateInput, TemplateFilters } from '@/types/salary'

// API 边界显式保留分页字段，实际业务类型仍集中在 types/salary.ts。
type SalaryTemplateFilters = TemplateFilters & { page_size?: number }

export type { SalaryTemplate, SalaryTemplateInput, TemplateFilters } from '@/types/salary'

// ============================================================================
// 工资模板 API 对象
// ============================================================================

export const salaryTemplateApi = {
  /**
   * 获取工资模板列表
   */
  getTemplates: (filters: SalaryTemplateFilters = {}) => {
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
  createTemplate: (data: Partial<SalaryTemplateInput>) => {
    return unifiedApi.post('/salary-templates', data)
  },

  /**
   * 更新工资模板
   */
  updateTemplate: (id: number, data: Partial<SalaryTemplateInput>) => {
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
