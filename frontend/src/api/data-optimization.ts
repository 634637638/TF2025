/**
 * 数据优化 API 服务
 * 提供数据检查和数据导入功能的 API 调用
 */
import { unifiedApi } from '@/utils/unified-api'

/**
 * 数据检查相关 API
 */
export const dataCheckApi = {
  /**
   * 检查品牌重复数据
   */
  checkBrands: () => {
    return unifiedApi.get('/data-check/check/brands')
  },

  /**
   * 检查型号重复数据
   */
  checkModels: () => {
    return unifiedApi.get('/data-check/check/models')
  },

  /**
   * 检查颜色重复数据
   */
  checkColors: () => {
    return unifiedApi.get('/data-check/check/colors')
  },

  /**
   * 检查内存重复数据
   */
  checkMemories: () => {
    return unifiedApi.get('/data-check/check/memories')
  },

  /**
   * 检查供应商重复数据
   */
  checkSuppliers: () => {
    return unifiedApi.get('/data-check/check/suppliers')
  },

  /**
   * 检查店铺重复数据
   */
  checkStores: () => {
    return unifiedApi.get('/data-check/check/stores')
  },

  /**
   * 检查客户重复数据
   */
  checkCustomers: () => {
    return unifiedApi.get('/data-check/check/customers')
  },

  /**
   * 检查员工重复数据
   */
  checkUsers: () => {
    return unifiedApi.get('/data-check/check/users')
  },

  /**
   * 综合检查所有数据
   */
  checkAll: () => {
    return unifiedApi.get('/data-check/check/all')
  },

  /**
   * 合并重复数据
   */
  mergeDuplicates: (data: { type: string; primaryId: number; duplicateIds: number[] }) => {
    return unifiedApi.post('/data-check/merge', data)
  },

  /**
   * 批量合并多组重复数据（优化版）
   */
  batchMergeMultipleGroups: (data: { type: string; mergeGroups: Array<{ primaryId: number; duplicateIds: number[] }> }) => {
    return unifiedApi.post('/data-check/batch-merge', data)
  },

  /**
   * 批量删除重复数据
   */
  batchDeleteDuplicates: (data: { type: string; ids: number[] }) => {
    return unifiedApi.post('/data-check/batch-delete', data)
  },

  /**
   * 编辑数据
   */
  editData: (type: string, id: number, data: any) => {
    return unifiedApi.put(`/data-check/edit/${type}/${id}`, data)
  },

  /**
   * 删除单条数据
   */
  deleteData: (type: string, id: number) => {
    return unifiedApi.delete(`/data-check/delete/${type}/${id}`)
  },

  /**
   * 获取数据统计
   */
  getStatistics: () => {
    return unifiedApi.get('/data-check/statistics')
  },

  /**
   * 执行数据清理
   */
  cleanupData: (type: string, ids?: number[]) => {
    return unifiedApi.post('/data-check/cleanup', { type, ids })
  },

  /**
   * 获取所有数据（含重复状态标记）
   */
  getAllData: (type: string) => {
    return unifiedApi.get(`/data-check/all/${type}`)
  }
}

/**
 * 数据导入相关 API
 */
export const dataImportApi = {
  /**
   * 上传Excel文件
   */
  uploadFile: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return unifiedApi.post('/data-import/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  /**
   * 分析Excel数据
   */
  analyzeData: (filePath: string, options = {}) => {
    return unifiedApi.post('/data-import/analyze', { filePath, options }, {
      timeout: 300000 // 5分钟超时，用于大数据量分析
    })
  },

  /**
   * 执行数据导入
   */
  importData: (filePath: string, options: {
    strategy?: 'smart' | 'skip' | 'overwrite' | 'merge' | 'replace_all'
    createMissing?: boolean
    [key: string]: any
  }) => {
    return unifiedApi.post('/data-import/import', { filePath, options })
  },

  /**
   * 获取导入进度
   */
  getProgress: (importId: string | number) => {
    return unifiedApi.get(`/data-import/progress/${importId}`)
  },

  /**
   * 获取导入历史
   */
  getHistory: () => {
    return unifiedApi.get('/data-import/history')
  },

  /**
   * 删除导入历史记录
   */
  deleteHistory: (id: number) => {
    return unifiedApi.delete(`/data-import/history/${id}`)
  }
}

/**
 * 统一导出
 */
export const dataOptimizationApi = {
  check: dataCheckApi,
  import: dataImportApi
}

// 兼容旧文件引用
export default dataOptimizationApi
