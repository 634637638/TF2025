'use strict'

const PhoneInventoryQueryService = require('../services/phone-inventory-query.service')
const QueryService = require('../services/query.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class PhoneInventoryQueryController {
  constructor({
    service = new PhoneInventoryQueryService(),
    deleteService = new QueryService(),
    response = ApiResponse,
    logger = log
  } = {}) {
    this.service = service
    this.deleteService = deleteService
    this.response = response
    this.logger = logger
  }

  async getUsedModels(req, res) {
    try {
      const keyword = String(req.query.keyword || '').trim()
      if (keyword.length > 80) {
        return this.response.badRequest(res, '搜索关键词不能超过 80 个字符')
      }

      const rows = await this.service.getUsedModels(keyword)
      return this.response.success(res, rows, '获取在库二手机型号成功')
    } catch (error) {
      this.logger.error('获取在库二手机型号失败:', error)
      return this.response.serverError(res, '获取在库二手机型号失败', error)
    }
  }

  async getLongestInventory(req, res) {
    const { brand_id, model_id, color_id, memory_id, store_id } = req.query
    const isNew = req.query.is_new === undefined ? 1 : Number(req.query.is_new)
    if (isNew !== 0 && isNew !== 1) {
      return this.response.badRequest(res, 'is_new 必须为 0 或 1')
    }

    const hasPurchaseCostFilter = req.query.purchase_cost !== undefined
    const purchaseCostIsNull = req.query.purchase_cost === 'null'
    const purchaseCost = hasPurchaseCostFilter && !purchaseCostIsNull ? Number(req.query.purchase_cost) : null
    if (hasPurchaseCostFilter && !purchaseCostIsNull && (!Number.isFinite(purchaseCost) || purchaseCost < 0)) {
      return this.response.badRequest(res, 'purchase_cost 参数无效')
    }

    const filterIds = { brand_id, model_id, color_id, memory_id, store_id }
    for (const [field, value] of Object.entries(filterIds)) {
      if (value !== undefined && (!Number.isInteger(Number(value)) || Number(value) <= 0)) {
        return this.response.badRequest(res, `${field} 必须是正整数`)
      }
    }

    const missingSpecIds = Object.entries({ brand_id, model_id, color_id, memory_id })
      .filter(([, value]) => value === undefined || value === '')
      .map(([field]) => field)
    if (missingSpecIds.length > 0) {
      return this.response.badRequest(res, `缺少库存规格参数: ${missingSpecIds.join(', ')}`)
    }

    try {
      this.logger.debug('查询在库最久商品，参数:', { brand_id, model_id, color_id, memory_id, store_id })
      const data = await this.service.getLongestInventory({
        brand_id: Number(brand_id),
        model_id: Number(model_id),
        color_id: Number(color_id),
        memory_id: Number(memory_id),
        ...(store_id === undefined ? {} : { store_id: Number(store_id) }),
        is_new: isNew,
        ...(hasPurchaseCostFilter ? { purchase_cost: purchaseCostIsNull ? null : purchaseCost, purchase_cost_is_null: purchaseCostIsNull } : {})
      })
      return this.response.success(res, { total: data.length, data }, '查询在库最久商品成功')
    } catch (error) {
      this.logger.error('查询在库最久商品失败:', error)
      return this.response.serverError(res, '查询在库最久商品失败', error)
    }
  }

  async getSoldTimeline(_req, res) {
    try {
      const rows = await this.service.getSoldTimeline()
      return this.response.success(res, rows, '获取已销售手机时间线数据成功')
    } catch (error) {
      this.logger.error('获取已销售手机时间线数据失败:', error)
      return this.response.serverError(res, '获取已销售手机时间线数据失败', error)
    }
  }

  async searchByIdentifier(req, res) {
    try {
      const { keyword } = req.query
      if (!keyword) return this.response.badRequest(res, '搜索关键字不能为空')

      const searchKeyword = keyword.trim()
      const { exact, fuzzy } = await this.service.searchByIdentifier(searchKeyword)
      if (exact) {
        return this.response.success(res, { ...exact, match_type: 'exact' }, '查询成功')
      }
      if (fuzzy.length > 0) {
        const results = fuzzy.map(item => ({ ...item, match_type: 'fuzzy' }))
        return this.response.success(res, results, `找到 ${fuzzy.length} 个相似商品`)
      }
      return this.response.success(res, [], `未找到匹配 "${searchKeyword}" 的商品，请检查IMEI或序列号`)
    } catch (error) {
      this.logger.error('搜索商品失败:', error)
      return this.response.serverError(res, '搜索商品失败', error)
    }
  }

  async getPhoneDetails(req, res) {
    try {
      const phones = await this.service.getPhoneDetails(req.params.id)
      if (phones.length === 0) return this.response.notFound(res, '手机不存在')

      const phone = phones[0]
      return this.response.success(res, {
        ...phone,
        inventory_time: phone.inventory_time || null,
        sale_time: phone.sale_time || null,
        condition: Number(phone.is_new) === 1 ? 'new' : 'used',
        purchase_cost: phone.purchase_cost ?? null,
        sale_price: phone.sale_price ?? null,
        store_id: phone.sale_store_id || phone.inventory_store_id,
        store_name: phone.sale_store_name || phone.inventory_store_name
      })
    } catch (error) {
      this.logger.error('获取手机详情失败:', error)
      return this.response.serverError(res, '获取手机详情失败', error)
    }
  }

  async listInventoryPhones(req, res) {
    try {
      const result = await this.service.listInventoryPhones(req.query)
      return this.response.success(res, result)
    } catch (error) {
      this.logger.error('获取手机列表失败:', error)
      return this.response.serverError(res, '获取手机列表失败', error)
    }
  }

  async deleteInventoryPhone(req, res) {
    try {
      const result = await this.deleteService.deletePhoneRecord(parseInt(req.params.id))
      return this.response.success(res, result.data, '手机删除成功')
    } catch (error) {
      this.logger.error('删除手机失败:', error)
      return this.response.serverError(res, '删除手机失败', error)
    }
  }
}

module.exports = PhoneInventoryQueryController
