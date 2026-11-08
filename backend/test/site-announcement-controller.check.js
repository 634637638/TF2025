'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const SiteAnnouncementRepository = require('../src/repositories/site-announcement.repository')
const SiteAnnouncementController = require('../src/controllers/site-announcement.controller')
const SiteAnnouncementService = require('../src/services/site-announcement.service')

const announcementRow = {
  id: '9',
  title: '维护通知',
  content: '<p>今晚维护</p>',
  is_published: 1,
  is_pinned: 1,
  published_at: '2026-11-07 09:00:00',
  expires_at: null,
  created_at: '2026-11-07 09:00:00',
  updated_at: '2026-11-07 09:00:00'
}

const response = () => ({
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})

const connectionWith = ({ execute, calls = [] }) => ({
  calls,
  async beginTransaction() {
    calls.push(['begin'])
  },
  async execute(sql, values) {
    calls.push(['execute', sql, values])
    return execute(sql, values)
  },
  async commit() {
    calls.push(['commit'])
  },
  async rollback() {
    calls.push(['rollback'])
  },
  release() {
    calls.push(['release'])
  }
})

test('公告列表查询保留员工端过滤排序与管理端分页上限', async () => {
  const queries = []
  const database = {
    async execute(sql) {
      queries.push(sql)
      return [[announcementRow]]
    }
  }
  const repository = new SiteAnnouncementRepository(() => database)

  assert.deepEqual(await repository.listPublished(), [announcementRow])
  assert.deepEqual(await repository.listAdmin(), [announcementRow])
  assert.match(queries[0], /WHERE is_published = 1/)
  assert.match(queries[0], /expires_at IS NULL OR expires_at > DATE_ADD\(UTC_TIMESTAMP\(\), INTERVAL 8 HOUR\)/)
  assert.match(queries[0], /ORDER BY is_pinned DESC, published_at DESC, id DESC LIMIT 20/)
  assert.match(queries[1], /ORDER BY updated_at DESC, id DESC LIMIT 100/)
})

test('置顶公告创建在同一事务内清除旧置顶、插入并读回后提交', async () => {
  const connection = connectionWith({
    execute(sql) {
      if (sql.startsWith('INSERT INTO site_announcements')) return [{ insertId: 9 }, []]
      if (sql.startsWith('SELECT id, title')) return [[announcementRow]]
      return [{ affectedRows: 1 }]
    }
  })
  const repository = new SiteAnnouncementRepository(() => ({ getConnection: async () => connection }))
  const input = { title: '维护通知', content: '<p>今晚维护</p>', isPublished: true, isPinned: true, expiresAt: null }

  assert.deepEqual(await repository.create(input), announcementRow)
  assert.deepEqual(connection.calls.map(call => call[0]), ['begin', 'execute', 'execute', 'execute', 'commit', 'release'])
  assert.match(connection.calls[1][1], /UPDATE site_announcements SET is_pinned = 0$/)
  assert.deepEqual(connection.calls[2][2], ['维护通知', '<p>今晚维护</p>', 1, 1, 1, null])
  assert.deepEqual(connection.calls[3][2], [9])
})

test('公告创建 SQL 失败时回滚并释放连接', async () => {
  const connection = connectionWith({
    execute(sql) {
      if (sql.startsWith('INSERT INTO site_announcements')) throw new Error('insert failed')
      return [{ affectedRows: 1 }]
    }
  })
  const repository = new SiteAnnouncementRepository(() => ({ getConnection: async () => connection }))

  await assert.rejects(repository.create({
    title: '维护通知', content: '正文', isPublished: false, isPinned: false, expiresAt: null
  }), /insert failed/)
  assert.deepEqual(connection.calls.map(call => call[0]), ['begin', 'execute', 'rollback', 'release'])
})

test('公告更新先锁定记录，缺失时回滚；存在时只清除其他记录置顶并提交', async () => {
  const missingConnection = connectionWith({ execute: () => [[]] })
  const missingRepository = new SiteAnnouncementRepository(() => ({ getConnection: async () => missingConnection }))
  assert.equal(await missingRepository.update(9, {}), null)
  assert.deepEqual(missingConnection.calls.map(call => call[0]), ['begin', 'execute', 'rollback', 'release'])
  assert.match(missingConnection.calls[1][1], /FOR UPDATE/)
  assert.deepEqual(missingConnection.calls[1][2], [9])

  const connection = connectionWith({
    execute(sql) {
      if (sql.includes('FOR UPDATE')) return [[{ id: 9 }]]
      if (sql.startsWith('SELECT id, title')) return [[announcementRow]]
      return [{ affectedRows: 1 }]
    }
  })
  const repository = new SiteAnnouncementRepository(() => ({ getConnection: async () => connection }))
  const updated = await repository.update(9, {
    title: '维护通知', content: '<p>今晚维护</p>', isPublished: true, isPinned: true, expiresAt: null
  })

  assert.deepEqual(updated, announcementRow)
  assert.deepEqual(connection.calls.map(call => call[0]), ['begin', 'execute', 'execute', 'execute', 'execute', 'commit', 'release'])
  assert.match(connection.calls[2][1], /WHERE id <> \?$/)
  assert.deepEqual(connection.calls[2][2], [9])
  assert.deepEqual(connection.calls[3][2], ['维护通知', '<p>今晚维护</p>', 1, 1, 1, null, 9])
})

test('公告 controller 规范输入、返回既有字段并拒绝无效 ID', async () => {
  let normalized
  let deleteCalls = 0
  const service = new SiteAnnouncementService({
    repository: {
      async create(input) {
        normalized = input
        return announcementRow
      },
      async update() {
        throw new Error('invalid id reached repository')
      },
      async delete() {
        deleteCalls += 1
        return false
      }
    }
  })
  const controller = new SiteAnnouncementController({
    service,
    logger: { warn() {}, error() {} }
  })
  const created = response()

  await controller.create({ body: { title: '  维护通知 ', content: '<p>今晚维护</p>', isPublished: true } }, created)
  assert.equal(created.statusCode, 201)
  assert.equal(created.body.message, '公告发布成功')
  assert.equal(created.body.data.id, 9)
  assert.deepEqual(normalized, {
    title: '维护通知',
    content: '<p>今晚维护</p>',
    isPublished: true,
    isPinned: false,
    expiresAt: null
  })

  const invalid = response()
  await controller.update({ params: { id: '0' }, body: {} }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(invalid.body.message, '公告编号无效')

  const deleted = response()
  await controller.remove({ params: { id: 'not-an-id' } }, deleted)
  assert.equal(deleted.statusCode, 400)
  assert.equal(deleteCalls, 0)
})
