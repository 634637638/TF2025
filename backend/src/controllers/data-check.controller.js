const log = require('../utils/log')
/**
 * 数据检查控制器
 * 检查和管理品牌、型号、颜色、内存、供应商、店铺、客户、员工等基础数据的重复问题
 */
const DataCheckService = require('../services/data-check.service')
const ApiResponse = require('../utils/response')

class DataCheckController {
  constructor() {
    this.dataCheckService = new DataCheckService()
  }

  /**
   * 检查品牌重复数据
   */
  async checkBrands(req, res) {
    try {
      const result = await this.dataCheckService.checkBrands()
      ApiResponse.success(res, '品牌数据检查完成', result)
    } catch (error) {
      log.error('检查品牌数据失败:', error)
      ApiResponse.serverError(res, '检查品牌数据失败', error)
    }
  }

  /**
   * 检查型号重复数据
   */
  async checkModels(req, res) {
    try {
      const result = await this.dataCheckService.checkModels()
      ApiResponse.success(res, '型号数据检查完成', result)
    } catch (error) {
      log.error('检查型号数据失败:', error)
      ApiResponse.serverError(res, '检查型号数据失败', error)
    }
  }

  /**
   * 检查颜色重复数据
   */
  async checkColors(req, res) {
    try {
      const result = await this.dataCheckService.checkColors()
      ApiResponse.success(res, '颜色数据检查完成', result)
    } catch (error) {
      log.error('检查颜色数据失败:', error)
      ApiResponse.serverError(res, '检查颜色数据失败', error)
    }
  }

  /**
   * 检查内存重复数据
   */
  async checkMemories(req, res) {
    try {
      const result = await this.dataCheckService.checkMemories()
      ApiResponse.success(res, '内存数据检查完成', result)
    } catch (error) {
      log.error('检查内存数据失败:', error)
      ApiResponse.serverError(res, '检查内存数据失败', error)
    }
  }

  /**
   * 检查供应商重复数据
   */
  async checkSuppliers(req, res) {
    try {
      const result = await this.dataCheckService.checkSuppliers()
      ApiResponse.success(res, '供应商数据检查完成', result)
    } catch (error) {
      log.error('检查供应商数据失败:', error)
      ApiResponse.serverError(res, '检查供应商数据失败', error)
    }
  }

  /**
   * 检查店铺重复数据
   */
  async checkStores(req, res) {
    try {
      const result = await this.dataCheckService.checkStores()
      ApiResponse.success(res, '店铺数据检查完成', result)
    } catch (error) {
      log.error('检查店铺数据失败:', error)
      ApiResponse.serverError(res, '检查店铺数据失败', error)
    }
  }

  /**
   * 检查客户重复数据
   */
  async checkCustomers(req, res) {
    try {
      const result = await this.dataCheckService.checkCustomers()
      ApiResponse.success(res, '客户数据检查完成', result)
    } catch (error) {
      log.error('检查客户数据失败:', error)
      ApiResponse.serverError(res, '检查客户数据失败', error)
    }
  }

  /**
   * 检查员工重复数据
   */
  async checkUsers(req, res) {
    try {
      const result = await this.dataCheckService.checkUsers()
      ApiResponse.success(res, '员工数据检查完成', result)
    } catch (error) {
      log.error('检查员工数据失败:', error)
      ApiResponse.serverError(res, '检查员工数据失败', error)
    }
  }

  /**
   * 综合检查所有数据
   */
  async checkAll(req, res) {
    try {
      const result = await this.dataCheckService.checkAll()
      ApiResponse.success(res, '综合数据检查完成', result)
    } catch (error) {
      log.error('综合数据检查失败:', error)
      ApiResponse.serverError(res, '综合数据检查失败', error)
    }
  }

  /**
   * 合并重复数据
   */
  async mergeDuplicates(req, res) {
    try {
      const { type, primary_id, duplicate_ids } = req.body || {}
      const normalized_primary_id = Number(primary_id)
      const normalized_duplicate_ids = Array.isArray(duplicate_ids) ? duplicate_ids.map(Number) : []

      log.debug('合并请求参数:', { type, primary_id: normalized_primary_id, duplicate_ids: normalized_duplicate_ids })

      if (
        !type || !Number.isSafeInteger(normalized_primary_id) || normalized_primary_id <= 0 ||
        normalized_duplicate_ids.length === 0 ||
        normalized_duplicate_ids.some(id => !Number.isSafeInteger(id) || id <= 0) ||
        new Set(normalized_duplicate_ids).size !== normalized_duplicate_ids.length ||
        normalized_duplicate_ids.includes(normalized_primary_id)
      ) {
        return ApiResponse.validationError(res, '参数不完整')
      }

      const result = await this.dataCheckService.mergeDuplicates(type, normalized_primary_id, normalized_duplicate_ids, req.user)
      ApiResponse.success(res, '合并数据成功', result)
    } catch (error) {
      log.error('合并数据失败:', error)
      log.debug('错误堆栈:', error.stack)
      ApiResponse.serverError(res, '合并数据失败', error)
    }
  }

  /**
   * 批量合并多组重复数据（优化版）
   */
  async batchMergeMultipleGroups(req, res) {
    try {
      const { type, merge_groups } = req.body || {}

      log.debug('批量合并请求参数:', { type, merge_groups })

      if (!type || !Array.isArray(merge_groups) || merge_groups.length === 0) {
        return ApiResponse.validationError(res, '参数不完整')
      }

      const normalized_groups = merge_groups.map(group => ({
        primary_id: Number(group?.primary_id),
        duplicate_ids: Array.isArray(group?.duplicate_ids) ? group.duplicate_ids.map(Number) : []
      }))
      for (const group of normalized_groups) {
        if (
          !Number.isSafeInteger(group.primary_id) || group.primary_id <= 0 ||
          group.duplicate_ids.length === 0 ||
          group.duplicate_ids.some(id => !Number.isSafeInteger(id) || id <= 0) ||
          new Set(group.duplicate_ids).size !== group.duplicate_ids.length ||
          group.duplicate_ids.includes(group.primary_id)
        ) {
          return ApiResponse.validationError(res, '组合并数据格式不正确')
        }
      }

      const result = await this.dataCheckService.batchMergeMultipleGroups(type, normalized_groups, req.user)
      ApiResponse.success(res, '批量合并成功', result)
    } catch (error) {
      log.error('批量合并失败:', error)
      log.debug('错误堆栈:', error.stack)
      ApiResponse.serverError(res, '批量合并失败', error)
    }
  }

  /**
   * 批量删除重复数据
   */
  async batchDeleteDuplicates(req, res) {
    try {
      const { type, ids } = req.body

      log.debug('批量删除请求参数:', { type, ids })

      if (!type || !Array.isArray(ids) || ids.length === 0) {
        log.debug('参数验证失败:', { type, ids, isArray: Array.isArray(ids), length: ids?.length })
        return ApiResponse.validationError(res, '参数不完整')
      }

      const result = await this.dataCheckService.batchDeleteDuplicates(type, ids, req.user)
      ApiResponse.success(res, '批量删除成功', result)
    } catch (error) {
      log.error('批量删除失败:', error)
      ApiResponse.serverError(res, '批量删除失败', error)
    }
  }

  /**
   * 编辑数据
   */
  async editData(req, res) {
    try {
      const { type, id } = req.params
      const data = req.body

      if (!type || !id) {
        return ApiResponse.validationError(res, '参数不完整')
      }

      const result = await this.dataCheckService.editData(type, id, data, req.user)
      ApiResponse.success(res, '更新数据成功', result)
    } catch (error) {
      log.error('更新数据失败:', error)
      ApiResponse.serverError(res, '更新数据失败', error)
    }
  }

  /**
   * 删除单条数据
   */
  async deleteData(req, res) {
    try {
      const { type, id } = req.params

      if (!type || !id) {
        return ApiResponse.validationError(res, '参数不完整')
      }

      const result = await this.dataCheckService.deleteData(type, id, req.user)
      ApiResponse.success(res, '删除数据成功', result)
    } catch (error) {
      log.error('删除数据失败:', error)
      ApiResponse.serverError(res, '删除数据失败', error)
    }
  }

  /**
   * 获取数据统计
   */
  async getStatistics(req, res) {
    try {
      const result = await this.dataCheckService.getStatistics()
      ApiResponse.success(res, '获取统计数据成功', result)
    } catch (error) {
      log.error('获取统计数据失败:', error)
      ApiResponse.serverError(res, '获取统计数据失败', error)
    }
  }

  /**
   * 执行数据清理
   */
  async cleanupData(req, res) {
    try {
      const { type, ids } = req.body

      log.debug('清理数据请求:', { type, ids })

      const result = await this.dataCheckService.cleanupData(type, req.user, ids)
      log.debug('清理数据结果:', result)
      ApiResponse.success(res, '数据清理完成', result)
    } catch (error) {
      log.error('数据清理失败:', error)
      log.debug('错误堆栈:', error.stack)
      ApiResponse.serverError(res, '数据清理失败', error)
    }
  }

  /**
   * 获取所有数据（含重复状态标记）
   */
  async getAllData(req, res) {
    try {
      const { type } = req.params

      if (!type) {
        return ApiResponse.validationError(res, '缺少数据类型参数')
      }

      const result = await this.dataCheckService.getAllData(type)
      if (!result) throw new Error('数据检查服务未返回结果')
      ApiResponse.success(res, result.total === 0 ? '该数据表暂无数据' : '获取数据成功', result)
    } catch (error) {
      log.error('获取数据失败:', error)
      ApiResponse.serverError(res, '获取数据失败', error)
    }
  }
}

module.exports = DataCheckController
