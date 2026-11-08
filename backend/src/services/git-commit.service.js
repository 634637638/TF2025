'use strict'

const fs = require('node:fs').promises
const os = require('node:os')
const path = require('node:path')
const log = require('../utils/log')

class GitCommitService {
  constructor({
    getHeadState,
    executeCommand,
    executeArgs,
    getUpstreamRef,
    getPendingPushFileSizeCheck,
    buildPushSizeHint,
    verifyPushOutcome,
    fileSystem = fs,
    osModule = os,
    pathModule = path,
    now = Date.now,
    logger = log
  } = {}) {
    this.getHeadState = getHeadState
    this.executeCommand = executeCommand
    this.executeArgs = executeArgs
    this.getUpstreamRef = getUpstreamRef
    this.getPendingPushFileSizeCheck = getPendingPushFileSizeCheck
    this.buildPushSizeHint = buildPushSizeHint
    this.verifyPushOutcome = verifyPushOutcome
    this.fileSystem = fileSystem
    this.os = osModule
    this.path = pathModule
    this.now = now
    this.logger = logger
  }

  async commitChanges({ message = '自动提交: 更新代码', autoPush = true } = {}) {
    const targetBranch = 'main'
    const headState = await this.getHeadState()
    if (headState.detached) {
      return { statusCode: 409, body: detachedHeadError(headState.shortCommit) }
    }
    if (headState.branch !== targetBranch) {
      return { statusCode: 409, body: nonMainBranchError(headState.branch) }
    }

    const { stdout: statusOutput } = await this.executeCommand('git status --porcelain')
    if (!statusOutput.trim()) {
      return { statusCode: 200, body: { success: true, data: { message: '没有需要提交的更改', committed: false, pushed: false } } }
    }

    await this.executeCommand('git add .')
    const commitMessage = `${message}\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude <noreply@anthropic.com>`
    const tempFile = this.path.join(this.os.tmpdir(), `tf2025_git_commit_${this.now()}.txt`)
    await this.fileSystem.writeFile(tempFile, commitMessage, 'utf8')
    try {
      await this.executeArgs(['commit', '-F', tempFile])
    } finally {
      await this.fileSystem.unlink(tempFile).catch(() => {})
    }

    let pushResult = null
    if (autoPush) {
      try {
        const { stdout: remoteOutput } = await this.executeCommand('git remote')
        if (!remoteOutput.trim()) {
          return { statusCode: 200, body: { success: true, data: {
            message: '提交成功但未配置远程仓库，无法推送', committed: true, pushed: false, error: '未配置远程仓库'
          } } }
        }

        const upstreamRef = await this.getUpstreamRef(targetBranch)
        const pendingFileSizeCheck = await this.getPendingPushFileSizeCheck(targetBranch)
        if (pendingFileSizeCheck.blockedFiles.length > 0) {
          return { statusCode: 200, body: { success: true, data: {
            message: '提交成功，但检测到超大文件，已阻止推送',
            committed: true,
            pushed: false,
            error: '待推送提交包含超过 GitHub 限制的文件',
            hint: this.buildPushSizeHint(pendingFileSizeCheck),
            syncStatus: await this.verifyPushOutcome(targetBranch),
            largeFiles: pendingFileSizeCheck.blockedFiles,
            warningFiles: pendingFileSizeCheck.warningFiles
          } } }
        }

        const pushCommand = upstreamRef ? 'git push' : 'git push --set-upstream origin main'
        let pushError = null
        try {
          pushResult = await this.executeCommand(pushCommand)
        } catch (error) {
          pushError = error
          this.logger.error('推送失败:', pushError)
        }

        const pushVerification = await this.verifyPushOutcome(targetBranch)
        if (!pushVerification.verified) {
          return { statusCode: 200, body: { success: true, data: {
            message: '提交成功，但远端未同步，请稍后重试推送',
            committed: true,
            pushed: false,
            error: pushError?.stderr || pushError?.error || '推送后校验失败',
            syncStatus: pushVerification
          } } }
        }
        if (pushError) {
          pushResult = {
            stdout: 'Push output unavailable, but remote sync has been verified.',
            stderr: pushError.stderr || pushError.error || ''
          }
        }
      } catch (pushError) {
        this.logger.error('推送失败:', pushError)
        return { statusCode: 200, body: { success: true, data: {
          message: '提交成功但推送失败',
          committed: true,
          pushed: false,
          error: pushError.stderr || pushError.error
        } } }
      }
    }

    const { stdout: logOutput } = await this.executeCommand('git log --oneline -1')
    return { statusCode: 200, body: { success: true, data: {
      message: autoPush ? '提交并推送成功' : '提交成功',
      committed: true,
      pushed: autoPush,
      commit: logOutput,
      pushOutput: pushResult?.stdout || '',
      pushWarning: pushResult?.stderr || ''
    } } }
  }
}

const nonMainBranchError = branch => ({
  success: false,
  error: `当前分支为 ${branch}，请先恢复到 main`,
  hint: '当前 Git 管理页已按主线模式运行。请先点击“恢复到 main”，确认最新代码已带回主线后，再执行提交、推送或拉取。',
  code: 'NOT_MAIN_BRANCH'
})

const detachedHeadError = shortCommit => ({
  success: false,
  error: '当前仓库处于分离 HEAD 状态，不能直接提交并推送',
  hint: `请先在 Git 管理页切换到正常分支（例如 main），或基于当前提交 ${shortCommit} 新建分支后再提交。`,
  code: 'DETACHED_HEAD'
})

module.exports = GitCommitService
