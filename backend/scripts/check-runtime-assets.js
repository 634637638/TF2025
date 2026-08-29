'use strict'

const { loadCapabilityRegistry, resolveCapabilityRegistryPath } = require('../src/config/capability-registry')

try {
  const registry = loadCapabilityRegistry()
  const moduleCount = Object.keys(registry.modules).length
  console.log(`运行时资源检查通过: ${resolveCapabilityRegistryPath()}（${moduleCount} 个权限模块）`)
} catch (error) {
  console.error(`运行时资源检查失败: ${error.message}`)
  process.exitCode = 1
}
