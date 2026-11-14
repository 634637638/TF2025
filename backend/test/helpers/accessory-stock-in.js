'use strict'

/** 正式业务夹具：跟随调用方事务状态读取已提交的原采购请求。 */
module.exports = function stockInRequestsFixture(repository, entries) {
  repository.stockInReady = async () => true
  repository.purchaseSnapshotSource = async (accessory_id, supplier_id, store_id) => ({ accessory_id, supplier_id, store_id,
    name: '原采购商品', category: '充电器', brand_name: null, product_model: null, color_name: null,
    unit: '个', supplier_name: '原供应商', store_name: '原入库门店' })
  repository.getStockInByKey = async key => {
    const row = entries().find(item => item.request_key === key)
    return row ? { ...row, id: row.id || entries().indexOf(row) + 1 } : null
  }
  return repository
}
