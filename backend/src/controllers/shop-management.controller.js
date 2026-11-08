'use strict'

const ShopService = require('../services/shop.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const { archiveShopAssetUpload } = require('../utils/shop-media-storage')
const { getRelativeUploadPathFromUrl, getUploadPathFromUrl } = require('../utils/upload-paths')
const { ensureShopTemplateMediaSchema } = require('../utils/shop-template-media-schema')
const { validateUploadedFileSignature, removeUploadedFiles } = require('../utils/upload-file-validation')
const fs = require('fs').promises

class ShopManagementController {
  constructor({
    service = new ShopService(),
    response = ApiResponse,
    logger = log,
    archiveAssetUpload = archiveShopAssetUpload,
    getRelativeUploadPath = getRelativeUploadPathFromUrl,
    getUploadPath = getUploadPathFromUrl,
    fileSystem = fs,
    validateFileSignature = validateUploadedFileSignature,
    removeFiles = removeUploadedFiles
  } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
    this.archiveAssetUpload = archiveAssetUpload
    this.getRelativeUploadPath = getRelativeUploadPath
    this.getUploadPath = getUploadPath
    this.fileSystem = fileSystem
    this.validateFileSignature = validateFileSignature
    this.removeFiles = removeFiles
  }

  async getAllConfigs(_req, res) {
    try {
      const configs = await this.service.getAllConfigs()
      return this.response.success(res, configs, '获取配置成功')
    } catch (error) {
      this.logger.error('获取商城配置失败:', error)
      return this.response.error(res, error.message || '获取配置失败', 500)
    }
  }

  async getConfigsByCategory(req, res) {
    try {
      const configs = await this.service.getConfigsByCategory(req.params.category)
      return this.response.success(res, configs, '获取配置成功')
    } catch (error) {
      this.logger.error('获取商城配置失败:', error)
      return this.response.error(res, error.message || '获取配置失败', 500)
    }
  }

  async updateConfig(req, res) {
    try {
      await this.service.updateConfig(req.params.key, req.body.value)
      return this.response.success(res, null, '更新配置成功')
    } catch (error) {
      this.logger.error('更新商城配置失败:', error)
      return this.response.error(res, error.message || '更新配置失败', 500)
    }
  }

  async batchUpdateConfigs(req, res) {
    try {
      await this.service.batchUpdateConfigs(req.body.configs)
      return this.response.success(res, null, '批量更新配置成功')
    } catch (error) {
      this.logger.error('批量更新商城配置失败:', error)
      return this.response.error(res, error.message || '批量更新配置失败', 500)
    }
  }

  async getAllBanners(_req, res) {
    try {
      const banners = await this.service.getAllBanners()
      return this.response.success(res, banners, '获取轮播图成功')
    } catch (error) {
      this.logger.error('获取轮播图失败:', error)
      return this.response.error(res, error.message || '获取轮播图失败', 500)
    }
  }

  async createBanner(req, res) {
    try {
      const banner = await this.service.createBanner(req.body)
      return this.response.created(res, '创建轮播图成功', banner)
    } catch (error) {
      this.logger.error('创建轮播图失败:', error)
      return this.response.error(res, error.message || '创建轮播图失败', 500)
    }
  }

  async updateBanner(req, res) {
    try {
      await this.service.updateBanner(req.params.id, req.body)
      return this.response.success(res, null, '更新轮播图成功')
    } catch (error) {
      this.logger.error('更新轮播图失败:', error)
      return this.response.error(res, error.message || '更新轮播图失败', 500)
    }
  }

  async deleteBanner(req, res) {
    try {
      await this.service.deleteBanner(req.params.id)
      return this.response.success(res, null, '删除轮播图成功')
    } catch (error) {
      this.logger.error('删除轮播图失败:', error)
      return this.response.error(res, error.message || '删除轮播图失败', 500)
    }
  }

  async reorderBanners(req, res) {
    try {
      await this.service.reorderBanners(req.body.orders)
      return this.response.success(res, null, '更新排序成功')
    } catch (error) {
      this.logger.error('更新轮播图排序失败:', error)
      return this.response.error(res, error.message || '更新排序失败', 500)
    }
  }

  async getOrders(req, res) {
    try {
      const page = Math.max(1, Number.parseInt(String(req.query.page ?? 1), 10) || 1)
      const page_size = Math.min(100, Math.max(1, Number.parseInt(String(req.query.page_size ?? 20), 10) || 20))
      const { status, start_date, end_date, search } = req.query
      const result = await this.service.getOrders({ page, page_size, status, start_date, end_date, search })

      return res.status(200).json({
        success: true,
        message: '获取订单成功',
        data: result.data,
        pagination: {
          page: result.page,
          page_size: result.page_size,
          total: result.total,
          total_pages: result.total_pages,
          has_next: result.has_next,
          has_prev: result.has_prev
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      this.logger.error('获取订单列表失败:', error)
      return this.response.error(res, error.message || '获取订单列表失败', 500)
    }
  }

  async getOrderDetail(req, res) {
    try {
      const order = await this.service.getOrderDetail(req.params.id)
      return this.response.success(res, order, '获取订单详情成功')
    } catch (error) {
      this.logger.error('获取订单详情失败:', error)
      return this.response.error(res, error.message || '获取订单详情失败', 500)
    }
  }

  async updateOrderStatus(req, res) {
    try {
      await this.service.updateOrderStatus(req.params.id, req.body.status, req.user.id)
      return this.response.success(res, null, '更新订单状态成功')
    } catch (error) {
      this.logger.error('更新订单状态失败:', error)
      return this.response.error(res, error.message || '更新订单状态失败', 500)
    }
  }

  async migrateConditionGrade(_req, res) {
    try {
      await this.service.migrateConditionGrade()
      return this.response.success(res, null, '成色字段迁移成功')
    } catch (error) {
      this.logger.error('成色字段迁移失败:', error)
      return this.response.error(res, error.message || '迁移失败', 500)
    }
  }

  async migrateSalePrice(_req, res) {
    try {
      await this.service.migrateSalePrice()
      return this.response.success(res, null, '销售价格字段迁移成功')
    } catch (error) {
      this.logger.error('销售价格字段迁移失败:', error)
      return this.response.error(res, error.message || '迁移失败', 500)
    }
  }

  async deletePhoneImages(req, res) {
    try {
      await this.service.deletePhoneImages(req.params.id)
      return this.response.success(res, null, '删除图片成功')
    } catch (error) {
      this.logger.error('删除图片失败:', error)
      return this.response.error(res, error.message || '删除图片失败', 500)
    }
  }

  async uploadShopImages(req, res) {
    try {
      const files = req.files
      if (!files || files.length === 0) return this.response.error(res, '没有上传文件', 400)

      const signatureChecks = await Promise.all(
        files.map(file => this.validateFileSignature(file, ['image']))
      )
      if (signatureChecks.some(isValid => !isValid)) {
        await this.removeFiles(files)
        return this.response.error(res, '文件内容与图片格式不匹配', 400)
      }

      const moduleName = String(req.body?.module || '').trim()
      const fileUrls = []
      for (const file of files) {
        fileUrls.push(await this.archiveAssetUpload({ file, moduleName }))
      }
      const uploadedFiles = files.map((file, index) => ({
        url: fileUrls[index],
        filename: file.filename,
        originalname: file.originalname,
        size: file.size
      }))

      return this.response.success(res, {
        files: uploadedFiles,
        count: uploadedFiles.length
      }, `成功上传 ${uploadedFiles.length} 张图片`)
    } catch (error) {
      await this.removeFiles(Array.isArray(req.files) ? req.files : []).catch(() => {})
      this.logger.error('上传图片失败:', error)
      return this.response.error(res, error.message || '上传失败', 500)
    }
  }

  async deleteShopImage(req, res) {
    try {
      const { image_url: imageUrl } = req.body
      if (!imageUrl) return this.response.error(res, '缺少图片URL', 400)

      try {
        const relativePath = this.getRelativeUploadPath(imageUrl)
        if (!relativePath.startsWith('shop/')) {
          return this.response.error(res, '只能删除商城图片目录中的文件', 400)
        }
        const filePath = this.getUploadPath(imageUrl)
        await this.fileSystem.unlink(filePath)
        this.logger.debug('已删除商城图片文件:', filePath)
      } catch (error) {
        this.logger.warn('删除商城图片文件失败:', error.message)
      }

      return this.response.success(res, null, '删除成功')
    } catch (error) {
      this.logger.error('删除图片失败:', error)
      return this.response.error(res, error.message || '删除失败', 500)
    }
  }

  async getSoldProducts(_req, res) {
    try {
      const products = await this.service.getSoldProducts()
      return this.response.success(res, products, '获取已售商品列表成功')
    } catch (error) {
      this.logger.error('获取已售商品列表失败:', error)
      return this.response.serverError(res, '获取已售商品列表失败', error)
    }
  }

  async getTemplates(_req, res) {
    try {
      const templates = await this.service.getTemplates()
      this.logger.debug('[获取模板列表] 返回数量:', templates.length)
      this.logger.debug('[获取模板列表] 模板数据:', templates.map(template => ({
        id: template.id,
        name: template.template_name || `${template.brand_name} ${template.model_name} ${template.color_name}`,
        is_active: template.is_active,
        is_active_type: typeof template.is_active
      })))
      return this.response.success(res, templates, '获取模板列表成功')
    } catch (error) {
      this.logger.error('获取模板列表失败:', error)
      return this.response.error(res, error.message || '获取失败', 500)
    }
  }

  async reorderTemplates(req, res) {
    try {
      const { orders } = req.body
      if (!Array.isArray(orders) || orders.length === 0) {
        return this.response.error(res, '排序数据不能为空', 400)
      }
      this.logger.debug('[模板排序] 更新排序:', orders)
      await this.service.reorderTemplates(orders)
      return this.response.success(res, null, '排序更新成功')
    } catch (error) {
      this.logger.error('更新排序失败:', error)
      return this.response.error(res, error.message || '更新失败', 500)
    }
  }

  async getTemplateById(req, res) {
    try {
      const template = await this.service.getTemplateById(req.params.id)
      if (!template) return this.response.error(res, '模板不存在', 404)
      return this.response.success(res, template, '获取模板详情成功')
    } catch (error) {
      this.logger.error('获取模板详情失败:', error)
      return this.response.error(res, error.message || '获取失败', 500)
    }
  }

  async createTemplate(req, res) {
    try {
      this.logger.debug('[创建模板] 请求体:', req.body)
      const template = await this.service.createTemplate(req.body)
      this.logger.debug('[创建模板] 服务返回:', template)
      return this.response.success(res, template, '创建模板成功')
    } catch (error) {
      this.logger.error('创建模板失败:', error)
      return this.response.error(res, error.message || '创建失败', 500)
    }
  }

  async updateTemplate(req, res) {
    try {
      this.logger.debug('[更新模板] 模板ID:', req.params.id)
      this.logger.debug('[更新模板] 请求体:', req.body)
      this.logger.debug('[更新模板] 请求体字段:', Object.keys(req.body))
      const template = await this.service.updateTemplate(req.params.id, req.body)
      return this.response.success(res, template, '更新模板成功')
    } catch (error) {
      this.logger.error('更新模板失败:', error)
      return this.response.error(res, error.message || '更新失败', 500)
    }
  }

  async deleteTemplate(req, res) {
    try {
      await this.service.deleteTemplate(req.params.id)
      return this.response.success(res, null, '删除模板成功')
    } catch (error) {
      this.logger.error('删除模板失败:', error)
      return this.response.error(res, error.message || '删除失败', 500)
    }
  }

  async uploadTemplateImage(req, res) {
    try {
      await ensureShopTemplateMediaSchema()
      this.logger.debug('[上传模板图片] 模板ID:', req.params.id)
      this.logger.debug('[上传模板图片] 用户ID:', req.user?.id)
      this.logger.debug('[上传模板图片] 文件信息:', req.file ? {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      } : '无文件')

      if (!req.file) {
        this.logger.error('[上传模板图片] 错误: 没有接收到文件')
        return this.response.error(res, '没有上传文件', 400)
      }
      if (!(await validateUploadedFileSignature(req.file, ['image', 'video']))) {
        await removeUploadedFiles([req.file])
        return this.response.error(res, '文件内容与图片或视频格式不匹配', 400)
      }

      const image = await this.service.uploadTemplateImage(req.params.id, req.file, req.user?.id)
      this.logger.debug('[上传模板图片] 服务返回:', image)
      return this.response.success(res, image, '上传图片成功')
    } catch (error) {
      await removeUploadedFiles(req.file ? [req.file] : []).catch(() => {})
      this.logger.error('上传图片失败:', error)
      return this.response.error(res, error.message || '上传失败', 500)
    }
  }

  async deleteTemplateImage(req, res) {
    try {
      await this.service.deleteTemplateImage(req.params.id, req.params.imageId)
      return this.response.success(res, null, '删除图片成功')
    } catch (error) {
      this.logger.error('删除图片失败:', error)
      return this.response.error(res, error.message || '删除图片失败', 500)
    }
  }

  async commitTemplateImageUploads(req, res) {
    try {
      const result = await this.service.commitTemplateImageUploads(req.body?.entries, req.user?.id)
      return this.response.success(res, result, '模板媒体已保存')
    } catch (error) {
      this.logger.error('保存模板媒体失败:', error)
      return this.response.error(res, error.message || '保存模板媒体失败', 500)
    }
  }

  async discardTemplateImageUploads(req, res) {
    try {
      const deletedCount = await this.service.discardTemplateImageUploads(req.body?.entries, req.user?.id)
      return this.response.success(res, { deleted_count: deletedCount }, '未保存媒体已清理')
    } catch (error) {
      this.logger.error('清理未保存模板媒体失败:', error)
      return this.response.error(res, error.message || '清理未保存模板媒体失败', 500)
    }
  }

  async setPrimaryTemplateImage(req, res) {
    try {
      await this.service.setPrimaryTemplateImage(req.params.id, req.params.imageId)
      return this.response.success(res, null, '设置主图成功')
    } catch (error) {
      this.logger.error('设置主图失败:', error)
      return this.response.error(res, error.message || '设置失败', 500)
    }
  }

  async reorderTemplateImages(req, res) {
    try {
      const { id } = req.params
      const { orders } = req.body
      if (!Array.isArray(orders)) return this.response.error(res, '排序数据格式错误', 400)
      await this.service.reorderTemplateImages(id, orders)
      return this.response.success(res, null, '图片排序更新成功')
    } catch (error) {
      this.logger.error('更新图片排序失败:', error)
      return this.response.error(res, error.message || '更新排序失败', 500)
    }
  }
}

module.exports = ShopManagementController
