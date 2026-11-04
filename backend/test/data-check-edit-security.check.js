const assert = require('node:assert/strict')
const test = require('node:test')
const DataCheckController = require('../src/controllers/data-check.controller')
const DataCheckService = require('../src/services/data-check.service')

const createResponse = () => ({
  statusCode: 0,
  body: null,
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})

test('data-check 编辑接口以 400 拒绝恶意列名和敏感字段', async () => {
  const controller = new DataCheckController()
  controller.dataCheckService.getPool = () => {
    throw new Error('非法字段必须在获取数据库连接前被拒绝')
  }

  for (const body of [
    { 'name` = ?; DROP TABLE users; --': '恶意值' },
    { status: 0 },
    { password: 'new-password' },
    { role: 'admin' },
    { id: 999 }
  ]) {
    const res = createResponse()
    await controller.editData({ params: { type: 'users', id: '1' }, body }, res)
    assert.equal(res.statusCode, 400)
    assert.equal(res.body.success, false)
    assert.match(res.body.message, /不可编辑字段/)
  }
})

test('data-check 合法编辑仅生成白名单反引号列名', async () => {
  const service = new DataCheckService()
  const calls = []
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params })
      if (sql.startsWith('UPDATE')) {
        return [{ affectedRows: 1 }, []]
      }
      return [[{ id: 7, name: '新品牌', sort_order: 3 }], []]
    },
    release() {}
  }
  service.getPool = () => ({
    async getConnection() {
      return connection
    }
  })

  const result = await service.editData('brands', '7', { name: '新品牌', sort_order: 3 })

  assert.deepEqual(calls[0], {
    sql: 'UPDATE `brands` SET `name` = ?, `sort_order` = ? WHERE `id` = ?',
    params: ['新品牌', 3, 7]
  })
  assert.equal(
    calls[1].sql,
    'SELECT `id`, `name`, `sort_order` FROM `brands` WHERE `id` = ?'
  )
  assert.deepEqual(calls[1].params, [7])
  assert.equal(result.id, 7)
})
