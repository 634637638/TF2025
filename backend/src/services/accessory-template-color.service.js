'use strict'

const BaseService = require('../core/base/base.service')
const { validId } = require('../utils/sale-input')

function normalizeColorVariants(value) {
  const invalid = message => { throw Object.assign(new Error(message), { statusCode: 400, code: 'VALIDATION_ERROR' }) }
  if (!Array.isArray(value) || !value.length || value.length > 100) invalid('请选择1至100种商品颜色')
  const colors = new Set(), barcodes = new Set()
  return value.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(key => !['color_id', 'barcode'].includes(key)) || !validId(row.color_id)) invalid('商品颜色格式无效')
    const colorId = Number(row.color_id)
    if (colors.has(colorId)) invalid('同一模板不能重复选择颜色')
    colors.add(colorId)
    if (row.barcode !== undefined && row.barcode !== null && typeof row.barcode !== 'string') invalid('颜色条形码格式无效')
    const barcode = row.barcode === undefined ? undefined : row.barcode?.trim() || null
    if (barcode?.length > 100) invalid('颜色条形码不能超过100个字符')
    if (barcode && barcodes.has(barcode.toLowerCase())) invalid('不同颜色不能使用相同条形码')
    if (barcode) barcodes.add(barcode.toLowerCase())
    return { color_id: colorId, ...(barcode === undefined ? {} : { barcode }) }
  })
}

const sharedFields = ['name', 'category', 'category_id', 'model_id', 'sale_price', 'unit', 'unit_id', 'description', 'image_url',
  'min_stock', 'serial_tracking', 'product_model', 'status', 'remarks', 'free_film']
const pick = (data, fields) => Object.fromEntries(fields.filter(field => data[field] !== undefined).map(field => [field, data[field]]))

class AccessoryTemplateColorService extends BaseService {
  constructor(repository) {
    super()
    this.repository = repository
    this.colors = repository.templateColors
  }

  async checkColors(variants, connection, existing = []) {
    const rows = await this.colors.lockColors(variants.map(row => row.color_id), connection)
    for (const variant of variants) {
      if (!rows.some(row => Number(row.id) === variant.color_id && (Number(row.status) === 1 || existing.some(item => Number(item.color_id) === variant.color_id)))) {
        throw this.createError('所选颜色不存在或已停用，请刷新颜色选项', 400, 'INVALID_REFERENCE')
      }
    }
  }

  async checkBarcode(barcode, ownId, connection) {
    if (!barcode) return
    const duplicate = await this.repository.getAccessoryByBarcode(barcode, connection, { includeInactive: true })
    if (duplicate && Number(duplicate.id) !== Number(ownId)) throw this.createError('颜色条形码已被其他商品使用，请核对', 400, 'DUPLICATE_BARCODE')
  }

  async create(data, input) {
    const variants = normalizeColorVariants(input)
    if (data.color_id || data.barcode) throw this.createError('多颜色模板请按颜色分别填写条形码', 400, 'VALIDATION_ERROR')
    if (!this.colors) throw this.createError('多颜色模板结构尚未就绪', 409, 'TEMPLATE_COLOR_NOT_READY')
    return this.repository.withConnection(async connection => {
      await connection.beginTransaction()
      try {
        await this.repository.lockFilmConfiguration(connection, data)
        await this.colors.assertReady(connection)
        await this.checkColors(variants, connection)
        const template = { ...data, brand_id: null, supplier_id: null, purchase_cost: 0, color_id: null, barcode: null }
        const id = await this.repository.createAccessory(template, connection)
        if (data.model_ids !== undefined) await this.repository.replaceCompatibleModels(id, data.model_ids, connection)
        for (const variant of variants) {
          await this.checkBarcode(variant.barcode, null, connection)
          const colorId = await this.repository.createAccessory({ ...template, ...variant }, connection)
          if (data.model_ids !== undefined) await this.repository.replaceCompatibleModels(colorId, data.model_ids, connection)
          await this.colors.link(id, colorId, variant.color_id, connection)
        }
        const created = await this.repository.getAccessoryById(id, connection)
        await connection.commit()
        return created
      } catch (error) { await connection.rollback(); throw error }
    })
  }

  /** 显式保存旧模板的多颜色资料；原采购根及品牌商品ID继续归属原颜色。 */
  async promote({ id, existing, data, input, connection }) {
    const variants = normalizeColorVariants(input)
    if (!this.colors) throw this.createError('多颜色模板结构尚未就绪', 409, 'TEMPLATE_COLOR_NOT_READY')
    await this.colors.assertReady(connection)
    const rootId = Number(existing.template_id || existing.id)
    const root = await this.repository.lockAccessory(rootId, connection)
    if (!root || root.template_id || (await this.colors.families([rootId], connection, { forUpdate: true })).length) {
      throw this.createError('模板颜色关联已变化，请刷新后重新编辑', 409, 'PROFILE_CORRECTION_STALE')
    }
    const originalColorId = Number(root.color_id) || variants[0].color_id
    if (!variants.some(row => row.color_id === originalColorId)) {
      throw this.createError('请保留现有商品颜色，再追加其他颜色', 409, 'TEMPLATE_COLOR_IN_USE')
    }
    await this.checkColors(variants, connection, root.color_id ? [{ color_id: originalColorId }] : [])
    const modelIds = data.model_ids ?? await this.repository.getCompatibleModelIds(rootId, connection, { forUpdate: true })
    const ownerId = await this.repository.createAccessory({ ...root, ...pick(data, sharedFields),
      template_id: null, brand_id: null, supplier_id: null, purchase_cost: 0, color_id: null, barcode: null }, connection)
    await this.repository.replaceCompatibleModels(ownerId, modelIds, connection)
    if (!root.color_id) await this.repository.updateAccessory(rootId, { color_id: originalColorId }, connection)
    await this.colors.link(ownerId, rootId, originalColorId, connection)
    return this.update({ id, existing, data, input: variants,
      family: [{ template_id: ownerId, accessory_id: rootId, color_id: originalColorId }], connection })
  }

  /** 调用方提供原事务；只同步档案，不改库存、数量、成交金额或成本快照。 */
  async update({ id, existing, data, input, family, connection }) {
    await this.colors.assertReady(connection)
    const ownerId = Number(family[0].template_id)
    const root = await this.repository.lockAccessory(ownerId, connection)
    if (!root) throw this.createError('商品模板已变化，请刷新', 409, 'PROFILE_CORRECTION_STALE')
    family = await this.colors.families([ownerId], connection, { forUpdate: true })
    const ownRoot = Number(existing.template_id || existing.id)
    const colorRoots = new Map()
    for (const row of family) {
      const colorRoot = await this.repository.lockAccessory(row.accessory_id, connection)
      if (!colorRoot || colorRoot.template_id || Number(colorRoot.color_id) !== Number(row.color_id)) throw this.createError('商品颜色归属已变化，请刷新模板核对', 409, 'PROFILE_CORRECTION_STALE')
      colorRoots.set(Number(row.accessory_id), colorRoot)
    }
    const current = ownRoot === ownerId ? root : Number(id) === ownRoot ? colorRoots.get(ownRoot) : await this.repository.lockAccessory(id, connection)
    if (!family.length || !current || ownRoot !== ownerId && (!colorRoots.has(ownRoot) || Number(current.template_id || current.id) !== ownRoot)) {
      throw this.createError('商品模板关联已变化，请刷新核对', 409, 'PROFILE_CORRECTION_STALE')
    }
    if (ownRoot === ownerId && (data.color_id || data.barcode)) throw this.createError('多颜色模板请按颜色分别维护条形码', 400, 'VALIDATION_ERROR')
    const variants = input === undefined ? null : normalizeColorVariants(input)
    if (variants) {
      if (data.color_id || data.barcode) throw this.createError('多颜色资料请按颜色分别维护条形码', 400, 'VALIDATION_ERROR')
      if (family.some(row => !variants.some(item => item.color_id === Number(row.color_id)))) {
        throw this.createError('已保存颜色须保留，可追加颜色或修改对应条形码', 409, 'TEMPLATE_COLOR_IN_USE')
      }
      await this.checkColors(variants, connection, family)
    }
    const common = pick(data, sharedFields)
    const modelIds = data.model_ids ?? await this.repository.getCompatibleModelIds(ownerId, connection, { forUpdate: true })
    for (const rootId of [ownerId, ...family.map(row => Number(row.accessory_id))]) {
      if (Object.keys(common).length) await this.repository.updateAccessory(rootId, common, connection)
      if (data.model_ids !== undefined) await this.repository.replaceCompatibleModels(rootId, modelIds, connection)
    }
    if (ownRoot !== ownerId) {
      const child = pick(data, ['brand_id', 'supplier_id', 'purchase_cost'])
      if (data.brand_id !== undefined && Number(data.brand_id || 0) !== Number(current.brand_id || 0)) {
        const colorRoot = colorRoots.get(ownRoot)
        const duplicate = Number(colorRoot.brand_id || 0) === Number(data.brand_id || 0) ? colorRoot
          : await this.repository.getBrandVariant(ownRoot, data.brand_id, connection)
        if (duplicate && Number(duplicate.id) !== Number(id)) throw this.createError('此颜色下已存在该品牌的商品，不能合并库存', 409, 'DUPLICATE_BRAND_VARIANT')
      }
      if (Object.keys(child).length) await this.repository.updateAccessory(id, child, connection)
    }
    if (!variants && ownRoot !== ownerId) {
      const own = family.find(row => Number(row.accessory_id) === ownRoot)
      if (data.color_id !== undefined && Number(data.color_id) !== Number(own?.color_id)) throw this.createError('颜色规格须在商品模板中维护', 400, 'VALIDATION_ERROR')
      if (data.barcode !== undefined) {
        await this.checkBarcode(data.barcode, ownRoot, connection)
        await this.repository.updateAccessory(ownRoot, { barcode: data.barcode }, connection)
      }
    }
    for (const variant of variants || []) {
      const current = family.find(row => Number(row.color_id) === variant.color_id)
      if (current && (variant.barcode === undefined || variant.barcode === colorRoots.get(Number(current.accessory_id))?.barcode)) continue
      await this.checkBarcode(variant.barcode, current?.accessory_id, connection)
      if (current) {
        if (variant.barcode !== undefined) await this.repository.updateAccessory(current.accessory_id, { barcode: variant.barcode }, connection)
      } else {
        const colorId = await this.repository.createAccessory({ ...root, ...common, color_id: variant.color_id, barcode: variant.barcode || null,
          template_id: null, brand_id: null, supplier_id: null, purchase_cost: 0 }, connection)
        await this.repository.replaceCompatibleModels(colorId, modelIds, connection)
        await this.colors.link(ownerId, colorId, variant.color_id, connection)
        family.push({ accessory_id: colorId })
      }
    }
    for (const rootId of [ownerId, ...family.map(row => Number(row.accessory_id))]) await this.repository.syncProductProfileSnapshots(id, rootId, connection)
    return this.repository.getAccessoryById(id, connection, { currentRead: true })
  }
}

module.exports = { AccessoryTemplateColorService, normalizeColorVariants }
