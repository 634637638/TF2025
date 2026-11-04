/**
 * 工资记录 API 服务
 */
import { unifiedApi } from '@/utils/unified-api'
import { salaryTemplateApi } from './salary-template'
import type { SalaryFilters, SalaryRecordInput } from '@/types/salary'

export type { SalaryFilters, SalaryRecord, SalaryRecordInput } from '@/types/salary'

export const salaryRecordApi = {
  /**
   * 获取工资记录列表
   */
  getSalaryRecords: (filters: SalaryFilters = {}) => {
    return unifiedApi.get('/salary-records', { params: filters })
  },

  /**
   * 获取个人工资记录
   */
  getMySalaryRecords: (filters: SalaryFilters = {}) => {
    return unifiedApi.get('/salary-records', { params: filters })
  },

  /**
   * 获取工资记录详情
   */
  getSalaryRecordById: (id: number) => {
    return unifiedApi.get(`/salary-records/${id}`)
  },

  /**
   * 创建工资记录
   */
  createSalaryRecord: (data: SalaryRecordInput) => {
    return unifiedApi.post('/salary-records', data)
  },

  /**
   * 更新工资记录
   */
  updateSalaryRecord: (id: number, data: Partial<SalaryRecordInput>) => {
    return unifiedApi.put(`/salary-records/${id}`, data)
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
    return unifiedApi.post('/salary-records/calculate', {
      employee_id: employeeId,
      period_start: periodStart,
      period_end: periodEnd
    })
  },

  /**
   * 保存计算的工资
   */
  saveCalculatedSalary: (data: Partial<SalaryRecordInput>) => {
    return unifiedApi.post('/salary-records/save', data)
  },

  /**
   * 批量计算工资
   */
  batchCalculateSalaries: (employeeIds: number[], periodStart: string, periodEnd: string) => {
    return unifiedApi.post('/salary-records/batch-calculate', {
      employee_ids: employeeIds,
      period_start: periodStart,
      period_end: periodEnd
    })
  },

  /**
   * 批量重算某月工资
   */
  recalculateMonth: (periodStart: string, periodEnd: string) => {
    return unifiedApi.post('/salary-records/recalculate-month', {
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
  markAsPaid: (id: number, payment_method?: string) => {
    return unifiedApi.post(`/salary-records/${id}/pay`, { payment_method })
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
