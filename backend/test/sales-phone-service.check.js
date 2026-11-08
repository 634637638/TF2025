'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const SalesPhoneService = require('../src/services/sales-phone.service')

function createService({ updateAffectedRows = 1 } = {}) {
  const events = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    async execute(sql) {
      if (sql === 'SET FOREIGN_KEY_CHECKS = 0') events.push('fk-off')
      if (sql === 'SET FOREIGN_KEY_CHECKS = 1') events.push('fk-on')
      return [{ affectedRows: 1 }]
    }
  }
  const repository = {
    async withConnection(operation) {
      try {
        return await operation(connection)
      } finally {
        events.push('release')
      }
    },
    async findCustomerByPhone() { return { id: 9 } },
    async updateCustomer() {},
    async findPhonesForSale() {
      return [{
        id: 12,
        status: 'in_stock',
        purchase_cost: 80,
        is_new: 1,
        is_preordered: 0,
        supplier_id: 4,
        remarks: 'existing'
      }]
    },
    async findDuplicateSales() { return [] },
    async createSale() { return 21 },
    async createPayment() { return 31 },
    async markPhoneSold() { return { affectedRows: updateAffectedRows } }
  }
  const service = new SalesPhoneService({
    repository,
    normalizeDate: value => value || '2026-11-08 12:00:00',
    prepareInvoiceTransaction: async () => {},
    generateInvoice: async () => 'INV-1',
    inspectColumn: async () => true,
    getPointsConfig: async () => ({}),
    reconcilePoints: async () => ({ points: 2, eligibleAmount: 100 }),
    logger: { error() {} }
  })
  return { service, events }
}

const request = {
  phone_id: 12,
  sale_price: 100,
  sale_time: '2026-11-08 12:00:00',
  customer_info: { name: '测试客户', phone: '13800138000' },
  payment_info: { payment_method: 'cash' }
}

test('sales phone service commits the sale, restores foreign keys and releases its connection', async () => {
  const { service, events } = createService()
  const result = await service.sell({ body: request, userId: 7 })

  assert.equal(result.status, 200)
  assert.equal(result.body.data.sale_id, 21)
  assert.equal(result.body.data.points_earned, 2)
  assert.deepEqual(events, ['begin', 'fk-off', 'fk-on', 'commit', 'release'])
})

test('sales phone service rolls back failed inventory updates and restores foreign keys', async () => {
  const { service, events } = createService({ updateAffectedRows: 0 })

  const result = await service.sell({ body: request, userId: 7 })
  assert.equal(result.status, 400)
  assert.equal(result.body.message, '部分设备状态更新失败')
  assert.deepEqual(events, ['begin', 'fk-off', 'fk-on', 'rollback', 'release'])
})
