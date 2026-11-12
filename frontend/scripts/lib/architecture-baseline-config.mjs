import { execFileSync } from 'node:child_process'

export const ARCHITECTURE_CONFIG_PATH = 'backend/scripts/config/backend-route-architecture.json'
// 仅用于读取迁移前 Git 提交；当前工作区始终使用后端目录内的唯一配置。
const HISTORICAL_CONFIG_PATH = 'config/backend-route-architecture.json'

export function loadArchitectureBaselineConfig(projectRoot, baselineRef) {
  const options = { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  // 引用无效、Git 读取失败、JSON 损坏都必须报错，不能当作首次登记。
  execFileSync('git', ['rev-parse', '--verify', `${baselineRef}^{commit}`], options)
  for (const configPath of [ARCHITECTURE_CONFIG_PATH, HISTORICAL_CONFIG_PATH]) {
    const trackedPath = execFileSync('git', ['ls-tree', '--name-only', baselineRef, '--', configPath], options).trim()
    if (!trackedPath) continue
    return JSON.parse(execFileSync('git', ['show', `${baselineRef}:${configPath}`], options))
  }
  return null
}
