'use strict'

const { validId } = require('./sale-input')

const textFields = ['name', 'category', 'brand_name', 'product_model', 'color_name', 'unit', 'supplier_name', 'store_name']
const identityFields = ['accessory_id', 'supplier_id', 'store_id']
const conflict = () => {
  throw Object.assign(new Error('原采购资料快照不完整或与原单不符，请核对采购记录'), {
    statusCode: 409, code: 'PURCHASE_SNAPSHOT_CONFLICT'
  })
}

/** 只保存服务端原资料；客户端不能提交或覆盖历史快照。 */
function createPurchaseSnapshot(source, identity) {
  if (!source || identityFields.some(key => !validId(source[key]) || Number(source[key]) !== Number(identity[key]))) conflict()
  const snapshot = { version: 1 }
  for (const key of identityFields) snapshot[key] = Number(source[key])
  for (const key of textFields) {
    const value = source[key]
    if (value !== null && (typeof value !== 'string' || value.length > 1024)) conflict()
    if (['name', 'supplier_name', 'store_name'].includes(key) && (value === null || !value.trim())) conflict()
    snapshot[key] = value
  }
  return snapshot
}

/** 原值即使为NULL也不回填当前档案；旧无快照明确保留旧口径。 */
function projectPurchaseSnapshot(row) {
  const { product_snapshot: raw, ...output } = row
  if (raw === null || raw === undefined) return { ...output, has_snapshot: false }
  let snapshot
  try { snapshot = typeof raw === 'string' ? JSON.parse(raw) : raw }
  catch { conflict() }
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) || snapshot.version !== 1) conflict()
  const validated = createPurchaseSnapshot(snapshot, row)
  for (const key of textFields) output[key] = validated[key]
  return { ...output, has_snapshot: true }
}

/** SQL只接受本领域固定列名；供原资料检索及采购来源名称共用。 */
function purchaseSnapshotText(key, current, alias = 'si') {
  if (!textFields.includes(key) || !['si', 'asi'].includes(alias)) throw new Error('不支持的采购快照字段')
  const value = `JSON_EXTRACT(${alias}.product_snapshot, '$.${key}')`
  return `(CASE WHEN ${alias}.product_snapshot IS NULL THEN ${current}
    WHEN JSON_TYPE(${value}) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(${value}) END)`
}

module.exports = { createPurchaseSnapshot, projectPurchaseSnapshot, purchaseSnapshotText }
