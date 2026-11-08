'use strict'

const homeSectionService = require('../services/home-section.service')
const log = require('../utils/log')

class HomeSectionController {
  constructor({ service = homeSectionService, logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async respond(res, {
    operation,
    successMessage,
    errorMessage,
    errorFallback = errorMessage,
    useErrorMessage = false,
    missingTableFallback = false,
    data = true
  }) {
    try {
      const result = await operation()
      const response = { success: true }
      if (data) response.data = result
      if (successMessage) response.message = successMessage
      return res.json(response)
    } catch (error) {
      this.logger.error(`${errorMessage}:`, error)
      const isMissingHomeSectionTable = (
        error?.code === 'ER_NO_SUCH_TABLE' ||
        /H5_home_sections|H5_home_section_products/i.test(String(error?.message || ''))
      )
      if (missingTableFallback && isMissingHomeSectionTable) {
        this.logger.warn('推荐区域相关数据表不存在，降级返回空列表')
        return res.json({
          success: true,
          data: [],
          message: '推荐区域未初始化'
        })
      }
      return res.status(500).json({
        success: false,
        message: useErrorMessage ? error.message || errorFallback : errorFallback
      })
    }
  }

  getActiveSections(req, res) {
    return this.respond(res, {
      operation: () => this.service.getActiveSections(),
      errorMessage: '获取推荐区域失败',
      missingTableFallback: true
    })
  }

  getAllSections(req, res) {
    return this.respond(res, {
      operation: () => this.service.getAllSections(),
      errorMessage: '获取推荐区域失败'
    })
  }

  createSection(req, res) {
    return this.respond(res, {
      operation: () => this.service.createSection(req.body),
      successMessage: '创建成功',
      errorMessage: '创建推荐区域失败',
      errorFallback: '创建失败',
      useErrorMessage: true
    })
  }

  updateSection(req, res) {
    return this.respond(res, {
      operation: () => this.service.updateSection(req.params.id, req.body),
      successMessage: '更新成功',
      errorMessage: '更新推荐区域失败',
      errorFallback: '更新失败',
      useErrorMessage: true
    })
  }

  deleteSection(req, res) {
    return this.respond(res, {
      operation: () => this.service.deleteSection(req.params.id),
      successMessage: '删除成功',
      errorMessage: '删除推荐区域失败',
      data: false
    })
  }

  getSectionProducts(req, res) {
    return this.respond(res, {
      operation: () => this.service.getSectionProductsAdmin(req.params.id),
      errorMessage: '获取推荐商品失败'
    })
  }

  addProduct(req, res) {
    return this.respond(res, {
      operation: () => this.service.addProductToSection(req.params.id, req.body),
      successMessage: '添加成功',
      errorMessage: '添加推荐商品失败',
      errorFallback: '添加失败',
      useErrorMessage: true,
      data: false
    })
  }

  addProducts(req, res) {
    return this.respond(res, {
      operation: () => this.service.addProductsToSection(req.params.id, req.body.products),
      successMessage: '批量添加成功',
      errorMessage: '批量添加推荐商品失败',
      errorFallback: '批量添加失败',
      useErrorMessage: true,
      data: false
    })
  }

  removeProduct(req, res) {
    return this.respond(res, {
      operation: () => this.service.removeProductFromSection(req.params.productId),
      successMessage: '移除成功',
      errorMessage: '移除推荐商品失败',
      data: false
    })
  }

  updateProductSort(req, res) {
    return this.respond(res, {
      operation: () => this.service.updateProductSort(req.params.productId, req.body.sort_order),
      successMessage: '更新排序成功',
      errorMessage: '更新排序失败',
      data: false
    })
  }

  clearSectionProducts(req, res) {
    return this.respond(res, {
      operation: () => this.service.clearSectionProducts(req.params.id),
      successMessage: '清空成功',
      errorMessage: '清空推荐商品失败',
      data: false
    })
  }

  searchProducts(req, res) {
    return this.respond(res, {
      operation: () => this.service.searchProducts(req.query.keyword, req.query.type),
      errorMessage: '搜索商品失败'
    })
  }
}

module.exports = HomeSectionController
