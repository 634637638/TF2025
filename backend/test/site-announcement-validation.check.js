'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { normalizeAnnouncementInput } = require('../src/services/site-announcement.service')

test('公告内容保留纯文本并默认不置顶', () => {
  assert.deepEqual(normalizeAnnouncementInput({
    title: '  活动通知  ',
    content: '  周五下午开展活动\n请准时参加  ',
    isPublished: true
  }), {
    title: '活动通知',
    content: '周五下午开展活动\n请准时参加',
    isPublished: true,
    isPinned: false,
    expiresAt: null
  })
})

test('草稿状态和有效日期可用，超期筛选由查询层执行', () => {
  assert.deepEqual(normalizeAnnouncementInput({
    title: '活动通知',
    content: '活动内容',
    isPublished: false,
    isPinned: false,
    expiresAt: '2026-12-31 23:59:00'
  }), {
    title: '活动通知',
    content: '活动内容',
    isPublished: false,
    isPinned: false,
    expiresAt: '2026-12-31 23:59:00'
  })
})

test('拒绝空标题、超长内容和无效日期', () => {
  assert.throws(() => normalizeAnnouncementInput({ title: ' ', content: '正文' }), /标题不能为空/)
  assert.throws(() => normalizeAnnouncementInput({ title: '标题', content: 'x'.repeat(100001) }), /内容不能超过100000个字符/)
  assert.throws(() => normalizeAnnouncementInput({ title: '标题', content: '正文', expiresAt: '2026-02-30 12:00:00' }), /有效期格式无效/)
})

test('公告路由保护员工只读范围并要求管理动作权限', () => {
  const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/system.js'), 'utf8')
  assert.match(routeSource, /router\.get\('\/announcements', unifiedAuth,/)
  assert.match(routeSource, /router\.get\('\/announcements\/admin', unifiedAuth, requirePermission\('system:view'\)/)
  assert.match(routeSource, /router\.post\('\/announcements', unifiedAuth, requirePermission\('system:edit'\)/)
  assert.match(routeSource, /router\.put\('\/announcements\/:id', unifiedAuth, requirePermission\('system:edit'\)/)
  assert.match(routeSource, /router\.delete\('\/announcements\/:id', unifiedAuth, requirePermission\('system:delete'\)/)
  assert.match(routeSource, /WHERE is_published = 1[\s\S]*expires_at > DATE_ADD\(UTC_TIMESTAMP\(\), INTERVAL 8 HOUR\)/)
  assert.match(routeSource, /ORDER BY is_pinned DESC, published_at DESC, id DESC/)
})

test('富文本净化保留图片并移除脚本和危险链接', () => {
  const result = normalizeAnnouncementInput({
    title: '媒体公告',
    content: '<p>正文</p><img src="/uploads/content-media/a.png"><script>alert(1)</script><a href="javascript:alert(1)">危险链接</a>',
    isPinned: true
  })
  assert.match(result.content, /<p>正文<\/p>/)
  assert.match(result.content, /<img src="\/uploads\/content-media\/a.png"/)
  assert.doesNotMatch(result.content, /script|javascript:/i)
  assert.equal(result.isPinned, true)
})

test('内容媒体上传接口限制于可管理内容的用户并校验文件签名', () => {
  const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/content-media.js'), 'utf8')
  assert.match(routeSource, /requireAnyPermission\(\['system:edit', 'guide:edit'\]\)/)
  assert.match(routeSource, /validateUploadedFileSignature\(req\.file, \['image', 'video'\]\)/)
  assert.match(routeSource, /fileSize: 100 \* 1024 \* 1024/)
})
