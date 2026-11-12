'use strict'

const fs = require('node:fs')
const path = require('node:path')
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
  const moduleCount = Object.keys(registry.modules).length
  console.log(`运行时资源检查通过: ${resolveCapabilityRegistryPath()}、${reminderPolicyPath}（${moduleCount} 个权限模块）`)
} catch (error) {
  console.error(`运行时资源检查失败: ${error.message}`)
  process.exitCode = 1
}
