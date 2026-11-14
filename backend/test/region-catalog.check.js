'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { gunzipSync } = require('node:zlib')
const RegionService = require('../src/services/region.service')
const { parseCsvRow, digest } = require('../scripts/prepare-region-data')
const directory = path.resolve(__dirname, '../data/regions/2023-06-30')

test('五级数据全量校验版本、校验和、唯一编码及父子覆盖，不访问数据库', async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'))
  assert.equal(manifest.version, '2023-06-30')
  assert.equal(manifest.license, 'WTFPL-2.0')
  assert.match(await fs.readFile(path.join(directory, 'LICENSE'), 'utf8'), /Version 2, December 2004/)
  const counts = { 2: manifest.provinces.length, 4: 0, 6: 0, 9: 0, 12: 0 }
  const nodes = new Set(manifest.provinces.map(([code]) => code))
  for (const [file, expected] of Object.entries(manifest.files)) {
    const buffer = await fs.readFile(path.join(directory, file))
    assert.equal(digest(buffer), expected.sha256)
    const children = JSON.parse(gunzipSync(buffer).toString())
    const pending = []
    for (const [parent, options] of Object.entries(children)) {
      assert.ok(options.length > 0)
      for (const [code, name] of options) {
        assert.ok(code.startsWith(parent))
        assert.ok([4, 6, 9, 12].includes(code.length))
        assert.ok(name.length > 0 && name.length <= 100)
        assert.equal(nodes.has(code), false, `重复地区 ${code}`)
        nodes.add(code)
        pending.push(parent)
        counts[code.length]++
      }
    }
    for (const parent of pending) assert.ok(nodes.has(parent), `缺少上级 ${parent}`)
  }
  assert.deepEqual(counts, { 2: 31, 4: 342, 6: 2978, 9: 41352, 12: 620573 })
})

test('按父级加载并验证五级链，拒绝跨省、伪造或缺失上级', async () => {
  const service = new RegionService()
  const root = await service.children()
  assert.equal(root.options.length, 31)
  const selection = { province: '11', city: '1101', district: '110101', town: '110101001', village: '110101001001' }
  const resolved = await service.resolve(selection)
  assert.equal(resolved.district, '东城区')
  assert.equal(resolved.town, '东华门街道')
  assert.equal(resolved.village, '多福巷社区居委会')
  assert.equal(resolved.region_version, '2023-06-30')
  await assert.rejects(service.resolve({ ...selection, province: '44' }), { statusCode: 400 })
  await assert.rejects(service.resolve({ ...selection, town: '' }), { statusCode: 400 })
  await assert.rejects(service.resolve({ ...selection, village: '110101001999' }), { statusCode: 400 })
  for (const parent of ['../../', [], {}, '110101001001', 'unknown']) await assert.rejects(service.children(parent), { statusCode: 400 })
  await assert.rejects(service.children('81'), { statusCode: 404 })
})

test('地区并发读取合并，最多缓存三个省，CSV 正确处理引号和逗号', async () => {
  const service = new RegionService()
  const results = await Promise.all(Array.from({ length: 5 }, () => service.loadProvince('11')))
  assert.ok(results.every(result => result === results[0]))
  for (const province of ['12', '13', '14']) await service.loadProvince(province)
  assert.equal(service.cache.size, 3)
  assert.equal(service.cache.has('11'), false)
  assert.deepEqual(parseCsvRow('1,"某,村","a""b",2'), ['1', '某,村', 'a"b', '2'])
  assert.throws(() => parseCsvRow('1,"未闭合'), /引号未闭合/)
})
