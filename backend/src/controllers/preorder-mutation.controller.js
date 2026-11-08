'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const PreorderMutationService = require('../services/preorder-mutation.service')

class PreorderMutationController {
  constructor({ service = new PreorderMutationService(), maskItem = async item => item } = {}) {
    this.service = service
    this.maskItem = maskItem
  }

  async create(req, res) {
    try {
      const result = await this.service.create(req.body, req.user)
      const errors = {
        invalid_condition: [400, '成色必须为全新或二手'],
        customer_required: [400, '请选择客户'],
        reference_required: [400, '请完整选择商品信息（品牌、型号、颜色、内存）'],
        invalid_deposit: [400, '请输入有效的定金金额'],
        invalid_total_price: [400, '销售价格格式不正确'],
        invalid_expected_arrival: [400, '预计到货日期格式必须为 YYYY-MM-DD'],
        customer_not_found: [404, '客户不存在'],
        brand_not_found: [404, '品牌不存在'],
        model_not_found: [404, '型号不存在'],
        color_not_found: [404, '颜色不存在'],
        memory_not_found: [404, '内存不存在'],
        invalid_preorder_person: [400, '预定人编号无效'],
        preorder_person_unavailable: [400, '预定人不存在或已停用']
      }
      if (result.error === 'legacy_field') {
        return ApiResponse.badRequest(res, `字段 ${result.field} 已废弃，请使用统一字段`)
      }
      const error = errors[result.error]
      if (error) {
        return error[0] === 404
          ? ApiResponse.notFound(res, error[1])
          : ApiResponse.badRequest(res, error[1])
      }

      const data = await this.maskItem(result.data, req)
      return ApiResponse.success(
        res,
        data,
        result.matched
          ? '预定单创建成功，已自动匹配并预留库存，尚未出库'
          : '预定单创建成功'
      )
    } catch (error) {
      log.error('创建预定单失败:', error)
      return ApiResponse.serverError(res, '创建预定单失败', error)
    }
  }

  async update(req, res) {
    try {
      const result = await this.service.update(req.params.id, req.body)
      if (result.error === 'not_found') return ApiResponse.notFound(res, '预定单不存在')
      if (result.error === 'customer_not_found') return ApiResponse.notFound(res, '客户不存在')

      const errors = {
        invalid_status: '只能编辑待匹配或已匹配的预定单',
        invalid_expected_arrival: '预计到货日期格式必须为 YYYY-MM-DD',
        invalid_condition: '成色必须为全新或二手',
        invalid_deposit: '请输入有效的定金金额',
        invalid_total_price: '销售价格格式不正确',
        invalid_customer_id: '客户编号无效',
        invalid_created_by: '预定人编号无效',
        creator_unavailable: '预定人不存在或已停用',
        no_fields: '没有提供要更新的字段',
        release_failed: '原匹配设备无法释放，请刷新后重试'
      }
      if (result.error === 'legacy_field') {
        return ApiResponse.badRequest(res, `字段 ${result.field} 已废弃，请使用统一字段`)
      }
      if (errors[result.error]) return ApiResponse.badRequest(res, errors[result.error])

      const data = await this.maskItem(result.data, req)
      return ApiResponse.success(
        res,
        data,
        result.staleMatchNeedsClearing ? '原匹配已解除，请按当前商品规格重新匹配库存' : '预定单更新成功'
      )
    } catch (error) {
      log.error('更新预定单失败:', error)
      return ApiResponse.serverError(res, '更新预定单失败', error)
    }
  }

  async remove(req, res) {
    try {
      const result = await this.service.remove(req.params.id)
      if (result.error === 'not_found') return ApiResponse.notFound(res, '预定单不存在')
      if (result.error === 'invalid_status') {
        return ApiResponse.badRequest(res, '只能删除已取消或已交付的预定单')
      }

      return ApiResponse.success(res, result.data, '预定单删除成功')
    } catch (error) {
      log.error('删除预定单失败:', error)
      return ApiResponse.serverError(res, '删除预定单失败', error)
    }
  }

  async cancel(req, res) {
    try {
      const result = await this.service.cancel(req.params.id, req.body?.reason)
      if (result.error === 'not_found') return ApiResponse.notFound(res, '预定单不存在')
      if (result.error === 'already_cancelled') return ApiResponse.badRequest(res, '预定单已被取消')
      if (result.error === 'delivered') return ApiResponse.badRequest(res, '已交付的预定单不能取消')
      if (result.error === 'phone_in_use') {
        return ApiResponse.badRequest(res, '匹配设备仍被其他预定单占用，无法取消')
      }

      return ApiResponse.success(res, result.data, '预定单取消成功')
    } catch (error) {
      log.error('取消预定单失败:', error)
      return ApiResponse.serverError(res, '取消预定单失败', error)
    }
  }

  async deliver(_req, res) {
    return ApiResponse.error(res, '预定交付请从预定管理点击“交付”，在销售页面完成出库', 409)
  }

  async restore(req, res) {
    try {
      const result = await this.service.restore(req.params.id)
      if (result.error === 'not_found') return ApiResponse.notFound(res, '预定单不存在')
      if (result.error === 'invalid_status') return ApiResponse.badRequest(res, '只能恢复已取消状态的预定单')
      if (result.error === 'phone_in_use') return ApiResponse.badRequest(res, '库存设备刚刚被占用，请重新恢复')

      const data = await this.maskItem(result.data, req)
      return ApiResponse.success(
        res,
        data,
        result.matched
          ? '预定单已恢复，并已按当前商品规格自动匹配库存'
          : '预定单已恢复，当前无可用库存，后续入库后将自动匹配'
      )
    } catch (error) {
      log.error('恢复预定单失败:', error)
      return ApiResponse.serverError(res, '恢复预定单失败', error)
    }
  }

  async match(req, res) {
    try {
      const result = await this.service.match(req.params.id, req.body)
      const errors = {
        phone_required: [400, '请选择要匹配的手机或输入IMEI'],
        invalid_date: [400, '到货日期格式必须为 YYYY-MM-DD'],
        preorder_not_found: [404, '预定单不存在'],
        invalid_preorder_status: [400, '只有待匹配或已匹配且未交付的预定单可以更换设备'],
        phone_not_found: [404, '设备不存在'],
        phone_unavailable: [400, '设备已售出或已被其他预定单占用'],
        phone_has_other_preorder: [400, '设备已被其他预定单占用'],
        previous_phone_unavailable: [400, '原匹配设备已销售或已出库，不能更换匹配设备'],
        previous_phone_state_invalid: [400, '原匹配设备的预定状态异常，请刷新后重试'],
        specification_mismatch: [400, '设备的品牌、型号、颜色、内存或成色与预定单不一致'],
        invalid_price: [400, '销售价格格式不正确'],
        previous_phone_release_failed: [400, '原匹配设备无法释放，请刷新后重试'],
        phone_reservation_failed: [400, '设备已被其他预定单占用，请重新选择']
      }
      const error = errors[result.error]
      if (error) {
        return error[0] === 404
          ? ApiResponse.notFound(res, error[1])
          : ApiResponse.badRequest(res, error[1])
      }

      const data = await this.maskItem(result.data, req)
      return ApiResponse.success(res, data, result.message)
    } catch (error) {
      log.error('匹配预定单失败:', error)
      return ApiResponse.serverError(res, '匹配预定单失败', error)
    }
  }
}

module.exports = PreorderMutationController
