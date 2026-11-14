'use strict'

const { moneyCents, validId } = require('./sale-input')
const { readCheckoutGoods } = require('./checkout-goods-facts')
const conflict = () => { throw Object.assign(new Error('共同原单明细或金额不一致，请核对原单'), { statusCode: 409, code: 'CHECKOUT_FACTS_CONFLICT' }) }
const integer = value => ['number', 'string'].includes(typeof value) && /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value))
const text = value => typeof value === 'string' ? value : null

/** 只投影原成交事实，不使用当前商品、手机或客户资料补造历史。 */
function readCheckoutOrder(header, rows) {
  if (!validId(header.id) || !validId(header.store_id) || !validId(header.customer_id) || !validId(header.operator_id) ||
    !text(header.order_no)?.trim() || !rows.length || new Set(rows.map(row => String(row.id))).size !== rows.length) conflict()
  const snapshots = new Map()
  for (const row of rows) {
    let snapshot
    try { snapshot = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot } catch { conflict() }
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) || (!integer(row.id) || Number(row.id) < 1) ||
      Number(row.order_id) !== Number(header.id) || Number(row.sale_customer_id) !== Number(header.customer_id) ||
      Number(row.sale_operator_id) !== Number(header.operator_id) || Number(row.sale_store_id) !== Number(header.store_id)) conflict()
    snapshots.set(Number(row.id), snapshot)
  }
  const phoneInvoices = new Map()
  for (const row of rows.filter(row => row.item_type === 'phone')) {
    const snapshot = snapshots.get(Number(row.id)), amount = moneyCents(row.total_amount)
    if (!validId(row.sale_id) || !validId(row.phone_id) || Number(row.phone_id) !== Number(row.sale_phone_id) || Number(row.quantity) !== 1 ||
      amount === null || amount <= 0 || amount !== moneyCents(row.unit_price) || amount !== moneyCents(row.phone_sale_price) ||
      !integer(row.points_awarded) || Number(row.points_awarded) > 2147483647 || snapshot.invoice_number !== row.phone_sale_no ||
      !text(row.phone_sale_no)?.trim() ||
      (snapshot.serial_number !== null && snapshot.serial_number !== undefined && typeof snapshot.serial_number !== 'string')) conflict()
    if (phoneInvoices.has(Number(row.sale_id))) conflict()
    phoneInvoices.set(Number(row.sale_id), row.phone_sale_no)
  }
  const items = rows.map(row => {
    const snapshot = snapshots.get(Number(row.id))
    if (row.item_type === 'phone') return { id: Number(row.id), item_type: 'phone', sale_no: row.phone_sale_no,
      linked_phone_sale_no: null, sale_type: 'sale', name: text(snapshot.model_name), brand_name: text(snapshot.brand_name),
      product_model: null, color_name: text(snapshot.color_name), memory: text(snapshot.memory_name),
      imei: text(snapshot.imei), serial_numbers: snapshot.serial_number ? [snapshot.serial_number] : [],
      unit: '台', quantity: 1, unit_price: moneyCents(row.unit_price) / 100, total_amount: moneyCents(row.total_amount) / 100,
      gross_amount: moneyCents(row.total_amount) / 100, points_used: 0, deduction_amount: 0, points_awarded: Number(row.points_awarded) }
    if (row.item_type !== 'accessory' || !integer(row.accessory_sale_id) || Number(row.accessory_sale_id) < 1 || !integer(row.accessory_id) || Number(row.accessory_id) < 1 ||
      Number(row.accessory_id) !== Number(row.goods_accessory_id) ||
      Number(row.quantity) !== Number(row.goods_quantity) || moneyCents(row.unit_price) !== moneyCents(row.goods_unit_price) ||
      moneyCents(row.total_amount) !== moneyCents(row.goods_total_price) || snapshot.sale_type !== row.goods_sale_type ||
      snapshot.sale_no !== row.goods_sale_no || !text(row.goods_sale_no) ||
      (phoneInvoices.size ? !phoneInvoices.has(Number(row.linked_phone_sale_id)) :
        row.linked_phone_sale_id !== null && (!validId(row.linked_phone_sale_id) || !text(row.linked_phone_sale_no)))) conflict()
    const { item } = readCheckoutGoods({ ...row, item_id: row.id, snapshot })
    return { id: Number(row.id), item_type: 'accessory', sale_no: row.goods_sale_no,
      linked_phone_sale_no: phoneInvoices.get(Number(row.linked_phone_sale_id)) || text(row.linked_phone_sale_no),
      sale_type: item.sale_type, name: item.name, brand_name: text(snapshot.brand_name), product_model: text(snapshot.product_model),
      color_name: text(snapshot.color_name), memory: null, imei: null, serial_numbers: item.serial_numbers, unit: text(snapshot.unit),
      quantity: item.quantity, unit_price: item.unit_price, total_amount: item.total_amount, gross_amount: item.gross_amount,
      points_used: item.points_used, deduction_amount: item.deduction_amount, points_awarded: item.points_awarded }
  })
  const sums = items.reduce((sum, item) => ({ gross: sum.gross + Math.round(item.gross_amount * 100),
    net: sum.net + Math.round(item.total_amount * 100), deduction: sum.deduction + Math.round(item.deduction_amount * 100),
    points: sum.points + item.points_awarded, used: sum.used + item.points_used }), { gross: 0, net: 0, deduction: 0, points: 0, used: 0 })
  if (Object.values(sums).some(value => !Number.isSafeInteger(value)) || sums.gross !== moneyCents(header.total_amount) ||
    sums.net !== moneyCents(header.final_amount) || sums.gross - sums.deduction !== sums.net ||
    !integer(header.points_awarded) || sums.points !== Number(header.points_awarded) ||
    moneyCents(header.paid_amount) === null || moneyCents(header.paid_amount) > sums.net) conflict()
  return { id: Number(header.id), order_no: text(header.order_no), customer_name: text(header.customer_name),
    customer_phone: text(header.customer_phone), store_name: text(header.store_name), operator_name: text(header.operator_name),
    sale_time: header.sale_time, remarks: text(header.remarks), total_amount: sums.gross / 100,
    final_amount: sums.net / 100, paid_amount: moneyCents(header.paid_amount) / 100,
    deduction_amount: sums.deduction / 100, points_used: sums.used, points_awarded: sums.points, items }
}

module.exports = { readCheckoutOrder }
