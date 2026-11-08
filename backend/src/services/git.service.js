'use strict'

const { normalizeBranchName } = require('../utils/git-branch')
const defaultFileSystem = require('node:fs').promises
const defaultPath = require('node:path')
const defaultOs = require('node:os')

class GitService {
  constructor({
    executeCommand,
    executeArgs = args => executeCommand(`git ${args.map(value => `'${String(value).replaceAll("'", "'\\''")}'`).join(' ')}`),
    fileSystem = defaultFileSystem,
    pathModule = defaultPath,
    osModule = defaultOs,
    now = () => new Date()
  } = {}) {
    if (typeof executeCommand !== 'function') {
      throw new TypeError('GitService requires an executeCommand function')
    }
    this.executeCommand = executeCommand
    this.executeArgs = executeArgs
    this.fileSystem = fileSystem
    this.path = pathModule
    this.os = osModule
    this.now = now
  }

  async discardChanges() {
    await this.executeCommand('git reset --hard HEAD')
    await this.executeCommand('git clean -fd')
  }

  async cleanUntrackedFiles() {
    const { stdout: statusOutput } = await this.executeCommand('git status --porcelain')
    const files = statusOutput.split('\n')
      .filter(line => line.trim().startsWith('??'))
      .map(line => line.substring(3))

    if (files.length === 0) {
      return { message: '没有未跟踪的文件需要清理', cleanedCount: 0 }
    }

    await this.executeCommand('git clean -fd')
    return {
      message: `已清理 ${files.length} 个未跟踪文件`,
      cleanedCount: files.length,
      files
    }
  }

  async getHeadState() {
    const { stdout: branchOutput } = await this.executeCommand('git branch --show-current')
    const { stdout: shortCommit } = await this.executeCommand('git rev-parse --short HEAD')
    const branch = branchOutput.trim()
    const detached = !branch

    return {
      branch,
      detached,
      shortCommit: shortCommit.trim(),
      displayName: detached ? `HEAD (detached @ ${shortCommit.trim()})` : branch
    }
  }

  async pull() {
    const headState = await this.getHeadState()
    const { branch } = headState

    if (headState.detached) {
      throw Object.assign(new Error('当前仓库处于分离 HEAD 状态，不能直接提交并推送'), {
        statusCode: 409,
        code: 'DETACHED_HEAD',
        shortCommit: headState.shortCommit
      })
    }

    if (branch !== 'main') {
      throw Object.assign(new Error(`当前分支为 ${branch}，请先恢复到 main`), {
        statusCode: 409,
        code: 'NOT_MAIN_BRANCH',
        branch
      })
    }

    const { stdout } = await this.executeCommand('git pull')
    return { message: '拉取成功', output: stdout }
  }

  async getStatus() {
    const { stdout: statusOutput } = await this.executeCommand('git status --porcelain')
    const { stdout: branchStatusOutput } = await this.executeCommand('git status --short --branch')
    const { stdout: logOutput } = await this.executeCommand('git log --oneline -5')
    const headState = await this.getHeadState()

    const modifiedFiles = statusOutput.split('\n').filter(line => line.trim())
    const changes = modifiedFiles.map(line => {
      const trimmedStatusColumn = line[1] === ' ' && line[2] !== ' '
      return {
        status: line.substring(0, 2).trim(),
        file: line.substring(trimmedStatusColumn ? 2 : 3)
      }
    })
    const branchStatusLine = branchStatusOutput.split('\n')[0] || ''
    const aheadMatch = branchStatusLine.match(/ahead (\d+)/)
    const behindMatch = branchStatusLine.match(/behind (\d+)/)

    return {
      branch: headState.branch,
      branchDisplay: headState.displayName,
      detached: headState.detached,
      headCommit: headState.shortCommit,
      aheadCount: aheadMatch ? Number(aheadMatch[1]) : 0,
      behindCount: behindMatch ? Number(behindMatch[1]) : 0,
      hasChanges: modifiedFiles.length > 0,
      changes,
      recentCommits: logOutput.split('\n')
    }
  }

  async getCommits(limit = 20) {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100)
    const fetchLimit = safeLimit * 3
    const { stdout } = await this.executeArgs([
      'log',
      `-${fetchLimit}`,
      '--date=iso',
      '--pretty=format:%H%x1f%s%x1f%B%x1f%an%x1f%ad%x1e'
    ])

    const hiddenCommitHashes = await this.getHiddenCommitHashes()
    const revertedHashes = new Set()
    const commitEntries = stdout.split('\x1e')
      .map(entry => entry.trim())
      .filter(Boolean)
      .map(entry => {
        const [hash = '', subject = '', body = '', author = '', date = ''] = entry.split('\x1f')
        const revertMatch = body.match(/This reverts commit ([0-9a-fA-F]{7,40})\./)
        if (revertMatch?.[1]) revertedHashes.add(revertMatch[1].toLowerCase())
        return { hash, message: subject, body, author, date, isRevertCommit: Boolean(revertMatch?.[1]) }
      })

    return commitEntries
      .filter(commit => commit.hash && commit.message)
      .filter(commit => !commit.isRevertCommit)
      .filter(commit => !revertedHashes.has(commit.hash.toLowerCase()))
      .filter(commit => !hiddenCommitHashes.has(commit.hash.toLowerCase()))
      .filter(commit => !commit.message.includes('本地备份') && !commit.message.includes('📦') && !commit.message.includes('自动备份'))
      .slice(0, safeLimit)
      .map(({ hash, message, author, date }) => ({ hash, message, author, date }))
  }

  async getBranches() {
    const { stdout: localBranchesOutput } = await this.executeCommand('git branch')
    const localBranches = localBranchesOutput.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const current = line.startsWith('*')
        const name = line.replace(/^\*\s*/, '').trim()
        return { name, type: 'local', current }
      })

    const { stdout: remoteBranchesOutput } = await this.executeCommand('git branch -r')
    const remoteBranches = remoteBranchesOutput.split('\n')
      .filter(line => line.trim() && !line.includes('HEAD'))
      .map(line => ({ name: line.trim(), type: 'remote', current: false }))

    const headState = await this.getHeadState()
    return {
      current: headState.branch,
      currentDisplay: headState.displayName,
      detached: headState.detached,
      branches: [...localBranches, ...remoteBranches]
    }
  }

  async createBranch(name, baseBranch = '') {
    const normalizedName = normalizeBranchName(name, '新分支名称')
    const normalizedBaseBranch = baseBranch
      ? normalizeBranchName(baseBranch, '基础分支名称')
      : ''

    if (normalizedBaseBranch) await this.executeArgs(['checkout', normalizedBaseBranch])
    await this.executeArgs(['checkout', '-b', normalizedName])

    return {
      message: `已创建并切换到新分支: ${normalizedName}`,
      branch: normalizedName
    }
  }

  async deleteBranch(branch, force = false) {
    const normalizedBranch = normalizeBranchName(branch)
    await this.executeArgs(force ? ['branch', '-D', normalizedBranch] : ['branch', '-d', normalizedBranch])
    return {
      message: `已删除分支: ${normalizedBranch}`,
      branch: normalizedBranch
    }
  }

  async switchBranch(branch) {
    const normalizedBranch = normalizeBranchName(branch)
    await this.executeArgs(['checkout', normalizedBranch])
    return {
      message: `已切换到分支: ${normalizedBranch}`,
      branch: normalizedBranch
    }
  }

  async checkoutCommit(commit, mode = 'view') {
    const normalizedCommit = String(commit || '').trim()
    if (!/^[0-9a-fA-F]{7,40}$/.test(normalizedCommit)) {
      throw Object.assign(new Error('提交哈希不合法'), { error: '提交哈希不合法', code: 'INVALID_COMMIT' })
    }

    if (mode === 'reset') {
      await this.executeArgs(['reset', '--hard', normalizedCommit])
      await this.executeCommand('git clean -fd')
      const { stdout: statusOutput } = await this.executeCommand('git status --porcelain')
      return {
        message: `已重置到版本 ${normalizedCommit.substring(0, 8)}`,
        mode: 'reset',
        cleaned: true,
        hasUntrackedFiles: statusOutput.trim().length > 0
      }
    }

    const tempBranchName = normalizeBranchName(`temp-view-${normalizedCommit.substring(0, 8)}`, '临时分支名称')
    try {
      await this.executeArgs(['checkout', '-b', tempBranchName, normalizedCommit])
      return {
        message: `已切换到版本 ${normalizedCommit.substring(0, 8)} (临时分支: ${tempBranchName})`,
        mode: 'view',
        branch: tempBranchName
      }
    } catch {
      await this.executeArgs(['checkout', normalizedCommit])
      return {
        message: `已切换到版本 ${normalizedCommit.substring(0, 8)} (分离 HEAD 状态)`,
        mode: 'view',
        branch: null
      }
    }
  }

  async createBranchBackupSnapshot({ name, message, includeChanges = true, returnToOriginal = true }) {
    const headState = await this.getHeadState()
    const { stdout: headHash } = await this.executeCommand('git rev-parse HEAD')
    const originalRef = headState.detached ? headHash.trim() : headState.branch
    const { stdout: statusOutput } = await this.executeCommand('git status --porcelain')
    const hasChanges = statusOutput.trim().length > 0
    const timestamp = this.now()
    const backupBranch = normalizeBranchName(name || `backup-${timestamp.toISOString().replace(/[:.]/g, '-').slice(0, 19)}`, '备份分支名称')

    try {
      await this.executeArgs(['rev-parse', '--verify', `refs/heads/${backupBranch}`])
      throw Object.assign(new Error(`备份分支已存在: ${backupBranch}`), {
        error: `备份分支已存在: ${backupBranch}`,
        code: 'BRANCH_EXISTS'
      })
    } catch (error) {
      if (error?.code === 'BRANCH_EXISTS') throw error
    }

    await this.executeArgs(['checkout', '-b', backupBranch])

    if (hasChanges && includeChanges) {
      await this.executeCommand('git add .')
      const tempFile = this.path.join(this.os.tmpdir(), `tf2025_backup_commit_${timestamp.getTime()}.txt`)
      await this.fileSystem.writeFile(tempFile, message || `📦 Git 分支备份 - ${timestamp.toLocaleString('zh-CN')}`, 'utf8')
      try {
        await this.executeArgs(['commit', '-F', tempFile])
      } finally {
        await this.fileSystem.unlink(tempFile).catch(() => {})
      }
    }

    const { stdout: logOutput } = await this.executeArgs(['log', backupBranch, '-1', '--pretty=format:%H|%s|%ai|%an'])
    const [hash, subject, date, author] = logOutput.trim().split('|')

    let activeBranch = backupBranch
    if (returnToOriginal && !headState.detached && originalRef) {
      await this.executeArgs(['checkout', originalRef])
      activeBranch = originalRef
    }

    return {
      headState,
      originalRef,
      backupBranch,
      activeBranch,
      hasChanges,
      commit: { hash, message: subject, date, author }
    }
  }

  async hideCommit(commit) {
    const hash = String(commit || '').trim()
    if (!/^[0-9a-fA-F]{7,40}$/.test(hash)) {
      throw Object.assign(new Error('提交哈希不合法'), { error: '提交哈希不合法', code: 'INVALID_COMMIT' })
    }
    const normalizedHash = hash.toLowerCase()
    const hiddenHashes = await this.getHiddenCommitHashes()
    const wasAdded = hiddenHashes.has(normalizedHash)
      ? false
      : await this.addHiddenCommitHash(normalizedHash)
    return {
      message: wasAdded
        ? `已从历史列表隐藏提交 ${hash.substring(0, 8)}`
        : `提交 ${hash.substring(0, 8)} 已经处于隐藏状态`,
      hiddenHash: hash,
      method: 'hide',
      affectsWorkingTree: false
    }
  }

  async addHiddenCommitHash(hash) {
    await this.executeArgs(['config', '--local', '--add', 'tf2025.hiddenCommit', hash])
    return true
  }

  async getHiddenCommitHashes() {
    try {
      const { stdout } = await this.executeArgs(['config', '--local', '--get-all', 'tf2025.hiddenCommit'])
      return new Set(stdout.split('\n').map(item => item.trim().toLowerCase()).filter(Boolean))
    } catch {
      return new Set()
    }
  }
}

module.exports = GitService
