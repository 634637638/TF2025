'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { gzipSync } = require('node:zlib')
const source = require('./config/region-source.json')

const digest = value => createHash('sha256').update(value).digest('hex')

function parseCsvRow(line) {
  const fields = []
  let value = '', quoted = false
  for (let index = 0; index < line.length; index++) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index++ }
      else quoted = !quoted
    } else if (character === ',' && !quoted) { fields.push(value); value = '' }
    else value += character
  }
  if (quoted) throw new Error('地区 CSV 引号未闭合')
  fields.push(value)
  return fields
}

/** 只读取已下载且校验和匹配的固定版本，不访问数据库，不在应用启动时下载。 */
async function prepareRegionData(inputDirectory, outputDirectory) {
  const inputs = {}
  for (const [name, checksum] of Object.entries(source.files)) {
    const buffer = await fs.readFile(path.join(inputDirectory, name))
    if (digest(buffer) !== checksum) throw new Error(`地区源文件校验失败：${name}`)
    inputs[name] = buffer.toString('utf8')
  }
  const nodes = new Map(), chunks = new Map()
  const counts = { province: 0, city: 0, district: 0, town: 0, village: 0 }
  const definitions = [
    ['provinces.json', 'province', 2, null], ['cities.json', 'city', 4, 'provinceCode'],
    ['areas.json', 'district', 6, 'cityCode'], ['streets.json', 'town', 9, 'areaCode']
  ]
  const provinces = []
  const add = (code, name, parent, level, length) => {
    if (typeof code !== 'string' || !new RegExp(`^\\d{${length}}$`).test(code) ||
      typeof name !== 'string' || !name.trim() || name.length > 100 || /[\u0000-\u001f]/.test(name) || nodes.has(code)) {
      throw new Error(`地区记录无效或重复：${code}`)
    }
    if (parent && (!nodes.has(parent) || !code.startsWith(parent))) throw new Error(`地区父级缺失或不匹配：${code}`)
    nodes.set(code, { name, parent, level })
    counts[level]++
    if (!parent) { provinces.push([code, name]); chunks.set(code, {}); return }
    const children = chunks.get(code.slice(0, 2))
    if (!children[parent]) children[parent] = []
    children[parent].push([code, name])
  }
  for (const [file, level, length, parentField] of definitions) {
    for (const row of JSON.parse(inputs[file])) add(row.code, row.name, parentField ? row[parentField] : null, level, length)
  }
  const lines = inputs['villages.csv'].trimEnd().split(/\r?\n/)
  const header = parseCsvRow(lines.shift())
  if (header.join(',') !== 'code,name,streetCode,provinceCode,cityCode,areaCode') throw new Error('地区 CSV 表头不匹配')
  for (const line of lines) {
    const row = parseCsvRow(line)
    if (row.length !== header.length || !row[0].startsWith(row[3]) || !row[0].startsWith(row[4]) || !row[0].startsWith(row[5])) throw new Error('村级地区父级链不匹配')
    add(row[0], row[1], row[2], 'village', 12)
  }
  if (counts.province !== 31 || counts.village < 500000) throw new Error('地区源文件覆盖不完整')
  const files = {}
  await fs.mkdir(outputDirectory, { recursive: false })
  try {
    for (const [province, children] of chunks) {
      const buffer = gzipSync(JSON.stringify(children), { level: 9 })
      const filename = `${province}.json.gz`
      await fs.writeFile(path.join(outputDirectory, filename), buffer, { flag: 'wx' })
      files[filename] = { sha256: digest(buffer), bytes: buffer.length }
    }
    const manifest = { ...source, sourceFiles: source.files, files, counts, provinces }
    await fs.writeFile(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
    await fs.writeFile(path.join(outputDirectory, 'LICENSE'), inputs['LICENSE.source'], { flag: 'wx' })
    return manifest
  } catch (error) {
    await fs.rm(outputDirectory, { recursive: true, force: true })
    throw error
  }
}

if (require.main === module) {
  const input = process.argv[2]
  const output = process.argv[3] || path.resolve(__dirname, '../data/regions/2023-06-30')
  if (!input) throw new Error('用法：node scripts/prepare-region-data.js 已下载源文件目录 [输出目录]；禁止覆盖既有版本')
  fs.mkdir(path.dirname(output), { recursive: true }).then(() => prepareRegionData(input, output))
    .then(manifest => console.log(JSON.stringify({ version: manifest.version, counts: manifest.counts })))
    .catch(error => { console.error(error.message); process.exitCode = 1 })
}

module.exports = { parseCsvRow, prepareRegionData, digest }
