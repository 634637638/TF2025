'use strict'

const fs = require('node:fs')
const path = require('node:path')

const REGISTRY_FILENAME = 'module-permission-capabilities.json'

/**
 * Resolve the shared capability registry independently of the process cwd.
 * Deployments may override the project-level config directory explicitly, but
 * there is still only one source file for the backend and frontend.
 */
function resolveCapabilityRegistryPath() {
  if (process.env.TF2025_CONFIG_DIR) {
    return path.resolve(process.env.TF2025_CONFIG_DIR, REGISTRY_FILENAME)
  }

  return path.resolve(__dirname, REGISTRY_FILENAME)
}

function loadCapabilityRegistry() {
  const registryPath = resolveCapabilityRegistryPath()
  if (!fs.existsSync(registryPath)) {
    throw new Error(
      `[CONFIG_MISSING] 未找到权限能力清单: ${registryPath}. ` +
      '请重新上传完整 backend/src/config 目录；' +
      '或设置 TF2025_CONFIG_DIR 指向包含该文件的 config 目录。'
    )
  }

  let registry
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
  } catch (error) {
    throw new Error(`[CONFIG_INVALID] 权限能力清单无法解析 (${registryPath}): ${error.message}`)
  }

  if (!registry || typeof registry !== 'object' ||
      !Array.isArray(registry.defaultActions) ||
      !Array.isArray(registry.actionOrder) ||
      !registry.modules || typeof registry.modules !== 'object') {
    throw new Error(
      `[CONFIG_INVALID] 权限能力清单结构不完整 (${registryPath})，` +
      '需要 defaultActions、actionOrder 和 modules。'
    )
  }

  return registry
}

const capabilityRegistry = loadCapabilityRegistry()

module.exports = capabilityRegistry
Object.defineProperties(module.exports, {
  REGISTRY_FILENAME: { value: REGISTRY_FILENAME },
  resolveCapabilityRegistryPath: { value: resolveCapabilityRegistryPath },
  loadCapabilityRegistry: { value: loadCapabilityRegistry }
})
