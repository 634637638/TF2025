'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { loadCapabilityRegistry, resolveCapabilityRegistryPath } = require('../src/config/capability-registry')

try {
  const registry = loadCapabilityRegistry()
  const reminderPolicyPath = path.resolve(__dirname, '../src/config/reminder-policy.json')
  if (!fs.existsSync(reminderPolicyPath)) {
    throw new Error(`[CONFIG_MISSING] 未找到提醒策略: ${reminderPolicyPath}；请重新上传完整 backend/src/config 目录`)
  }
  const reminderPolicy = JSON.parse(fs.readFileSync(reminderPolicyPath, 'utf8'))
  if (!reminderPolicy || !Number.isFinite(reminderPolicy.mandatory_hours) || reminderPolicy.mandatory_hours <= 0) {
    throw new Error(`[CONFIG_INVALID] 提醒策略 mandatory_hours 必须为正数: ${reminderPolicyPath}`)
  }
  const regionDirectory = path.resolve(__dirname, '../data/regions/2023-06-30')
  const manifest = JSON.parse(fs.readFileSync(path.join(regionDirectory, 'manifest.json'), 'utf8'))
  if (manifest.version !== '2023-06-30' || manifest.license !== 'WTFPL-2.0' ||
    !manifest.files || Object.keys(manifest.files).length !== 31) throw new Error('[REGION_INVALID] 地区资源清单无效，请完整上传 backend/data/regions')
  for (const [file, expected] of Object.entries(manifest.files)) {
    if (!/^\d{2}\.json\.gz$/.test(file)) throw new Error('[REGION_INVALID] 地区资源文件名无效')
    const resource = fs.readFileSync(path.join(regionDirectory, file))
    if (resource.length !== expected.bytes || createHash('sha256').update(resource).digest('hex') !== expected.sha256) {
      throw new Error(`[REGION_INVALID] 地区资源校验失败：${file}，请完整上传 backend/data/regions`)
    }
  }
  if (!fs.readFileSync(path.join(regionDirectory, 'LICENSE'), 'utf8').includes('Version 2, December 2004')) throw new Error('[REGION_INVALID] 缺少原始地区许可')
  for (const file of ['regions.openapi.json', 'performance-report.schema.json']) JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/contracts', file), 'utf8'))
  const moduleCount = Object.keys(registry.modules).length
  console.log(`运行时资源检查通过: ${resolveCapabilityRegistryPath()}、${reminderPolicyPath}（${moduleCount} 个权限模块），31省地区资源与许可及接口契约完整`)
} catch (error) {
  console.error(`运行时资源检查失败: ${error.message}`)
  process.exitCode = 1
}
