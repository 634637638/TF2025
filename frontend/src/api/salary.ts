/**
 * 工资记录 API 服务
 */
import { unifiedApi } from '@/utils/unified-api'
import { salaryTemplateApi } from './salary-template'
import type { SalaryFilters, SalaryRecord, SalaryRecordInput, SalaryRecalculationResult, SalaryCalculation,
  SalaryCalculatedSaveInput, SalaryListResponse, SalaryCalculationResult } from '@/types/salary'

export type { SalaryFilters, SalaryRecord, SalaryRecordInput } from '@/types/salary'

export const salaryRecordApi = {
  /**
   * 获取工资记录列表
   */
  getSalaryRecords: (filters: SalaryFilters = {}, signal?: AbortSignal) => {
    return unifiedApi.get<SalaryListResponse>('/salary-records', { params: filters, signal, useCache: false })
  },

  /**
   * 获取个人工资记录
   */
  getMySalaryRecords: (filters: SalaryFilters = {}) => {
    return unifiedApi.get<SalaryListResponse>('/salary-records', { params: filters, useCache: false })
  },

  /**
   * 获取工资记录详情
   */
  getSalaryRecordById: (id: number) => {
    return unifiedApi.get<SalaryRecord>(`/salary-records/${id}`, { useCache: false })
  },

  /**
   * 创建工资记录
   */
  createSalaryRecord: (data: Partial<SalaryRecordInput> & Pick<SalaryRecordInput, 'employee_id' | 'period_start' | 'period_end'>) => {
    return unifiedApi.post<{ data: SalaryRecord }>('/salary-records', data)
  },

  /**
   * 更新工资记录
   */
  updateSalaryRecord: (id: number, data: Partial<SalaryRecordInput>) => {
    return unifiedApi.put<{ data: SalaryRecord }>(`/salary-records/${id}`, data)
  },

  /**
   * 删除工资记录
   */
  deleteSalaryRecord: (id: number) => {
    return unifiedApi.delete(`/salary-records/${id}`)
  },

  /**
   * 计算工资
   */
  calculateSalary: (employeeId: number, periodStart: string, periodEnd: string) => {
    return unifiedApi.post<SalaryCalculation>('/salary-records/calculate', {
      employee_id: employeeId,
      period_start: periodStart,
      period_end: periodEnd
    })
  },

  /**
   * 保存计算的工资
   */
  saveCalculatedSalary: (data: SalaryCalculatedSaveInput) => {
    return unifiedApi.post<{ data: SalaryRecord }>('/salary-records/save', data)
  },

  /**
   * 批量计算工资
   */
  batchCalculateSalaries: (employeeIds: number[], periodStart: string, periodEnd: string) => {
    return unifiedApi.post<SalaryCalculationResult[]>('/salary-records/batch-calculate', {
      employee_ids: employeeIds,
      period_start: periodStart,
      period_end: periodEnd
    })
  },

  /**
   * 批量重算某月工资
   */
  recalculateMonth: (periodStart: string, periodEnd: string) => {
    return unifiedApi.post<SalaryRecalculationResult>('/salary-records/recalculate-month', {
      period_start: periodStart,
      period_end: periodEnd
    })
  },

  /**
   * 审批工资记录
   */
  approveSalaryRecord: (id: number) => {
    return unifiedApi.post(`/salary-records/${id}/approve`)
  },

  /**
   * 标记工资为已发放
   * @param id - 工资记录ID
   * @param payment_method - 支付方式 (cash/bank_transfer/wechat/alipay/other)
   */
  markAsPaid: (id: number, payment_method?: string, expected_calculation_version?: string) => {
    return unifiedApi.post<SalaryRecord>(`/salary-records/${id}/pay`, { payment_method, expected_calculation_version })
  },

  /**
   * 获取工资统计
   */
  getSalaryStats: (filters: SalaryFilters = {}) => {
    return unifiedApi.get('/salary-records/stats/summary', { params: filters })
  },

  /**
   * 批量获取员工销售数据（用于薪资计算）
   */
  getEmployeesSalesData: (periodStart: string, periodEnd: string) => {
    return unifiedApi.get('/salary-records/sales-data', {
      params: { period_start: periodStart, period_end: periodEnd }
    })
  },

  /**
   * 获取单个员工的销售明细列表
   */
  getEmployeeSalesDetails: (employeeId: number, periodStart: string, periodEnd: string) => {
    return unifiedApi.get('/salary-records/sales-details', {
      params: {
        employee_id: employeeId,
        period_start: periodStart,
        period_end: periodEnd
      }
    })
  }
}

// 统一导出
export const salaryApi = {
  templates: salaryTemplateApi,
  records: salaryRecordApi,
  // 便捷方法
  getSalaryRecords: salaryRecordApi.getSalaryRecords,
  getMySalaryRecords: salaryRecordApi.getMySalaryRecords,
  createSalaryRecord: salaryRecordApi.createSalaryRecord,
  updateSalaryRecord: salaryRecordApi.updateSalaryRecord,
  deleteSalaryRecord: salaryRecordApi.deleteSalaryRecord,
  calculateSalary: salaryRecordApi.calculateSalary,
  saveCalculatedSalary: salaryRecordApi.saveCalculatedSalary,
  approveSalaryRecord: salaryRecordApi.approveSalaryRecord
}

// 重新导出模板 API
export { salaryTemplateApi }
