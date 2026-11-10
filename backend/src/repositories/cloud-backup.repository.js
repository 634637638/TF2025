'use strict'

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

/** 运行状态独立于备份包保存；原子替换，禁止把云盘凭据纳入压缩备份。 */
class CloudBackupRepository {
  constructor(directory) {
    this.directory = directory
    this.filename = path.join(directory, 'state.json')
    this.lockPath = path.join(directory, 'worker.lock')
  }

  read() {
    try {
      const state = JSON.parse(fs.readFileSync(this.filename, 'utf8'))
      if (![1, 2].includes(state.version) || !Array.isArray(state.tasks) || !state.config) {
        throw new Error('云盘备份状态格式无效')
      }
      if (state.version === 1) {
        const { enabled, ...account } = state.config
        const accountId = account.token ? 'legacy' : ''
        return { version: 2, config: { enabled: enabled === true, accountId },
          accounts: accountId ? [{ ...account, id: accountId, name: '默认网盘' }] : [],
          tasks: state.tasks.map(task => ({ ...task, accountId })) }
      }
      if (!Array.isArray(state.accounts)) throw new Error('云盘账户状态格式无效')
      return state
    } catch (error) {
      if (error.code === 'ENOENT') return { version: 2, config: { enabled: false, accountId: '' }, accounts: [], tasks: [] }
      throw error
    }
  }

  write(state) {
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 })
    const temporary = `${this.filename}.${crypto.randomUUID()}.tmp`
    try {
      fs.writeFileSync(temporary, JSON.stringify(state), { mode: 0o600, flag: 'wx' })
      fs.renameSync(temporary, this.filename)
    } finally {
      fs.rmSync(temporary, { force: true })
    }
  }

  acquireLock() {
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 })
    try {
      const fd = fs.openSync(this.lockPath, 'wx', 0o600)
      fs.writeFileSync(fd, String(process.pid))
      fs.closeSync(fd)
      return () => fs.rmSync(this.lockPath, { force: true })
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      const pid = Number(fs.readFileSync(this.lockPath, 'utf8'))
      if (!Number.isSafeInteger(pid) || pid <= 0) return null
      try {
        process.kill(pid, 0)
      } catch (probeError) {
        if (probeError.code === 'ESRCH') fs.rmSync(this.lockPath, { force: true })
      }
      return null
    }
  }
}

module.exports = CloudBackupRepository
