'use strict'

const log = require('../utils/log')

class GitPushService {
  constructor({
    getHeadState,
    executeCommand,
    getUpstreamRef,
    getPendingPushFileSizeCheck,
    buildPushSizeHint,
    verifyPushOutcome,
    logger = log
  } = {}) {
    this.getHeadState = getHeadState
    this.executeCommand = executeCommand
    this.getUpstreamRef = getUpstreamRef
    this.getPendingPushFileSizeCheck = getPendingPushFileSizeCheck
    this.buildPushSizeHint = buildPushSizeHint
    this.verifyPushOutcome = verifyPushOutcome
    this.logger = logger
  }

  async pushChanges() {
    const targetBranch = 'main'
    const headState = await this.getHeadState()
    if (headState.detached) return { statusCode: 409, body: detachedHeadError(headState.shortCommit) }
    if (headState.branch !== targetBranch) return { statusCode: 409, body: nonMainBranchError(headState.branch) }

    const pendingFileSizeCheck = await this.getPendingPushFileSizeCheck(targetBranch)
    if (pendingFileSizeCheck.blockedFiles.length > 0) {
      return { statusCode: 409, body: {
        success: false,
        error: '待推送提交包含超过 GitHub 限制的文件，已阻止推送',
        hint: this.buildPushSizeHint(pendingFileSizeCheck),
        details: {
          largeFiles: pendingFileSizeCheck.blockedFiles,
          warningFiles: pendingFileSizeCheck.warningFiles,
          syncStatus: await this.verifyPushOutcome(targetBranch)
        }
      } }
    }

    const upstreamRef = await this.getUpstreamRef(targetBranch)
    const pushCommand = upstreamRef ? 'git push' : 'git push --set-upstream origin main'
    let pushOutput = null
    let pushError = null
    try {
      pushOutput = await this.executeCommand(pushCommand)
    } catch (error) {
      pushError = error
      this.logger.error('Git 推送执行失败:', pushError)
    }

    let syncStatus
    try {
      syncStatus = await this.verifyPushOutcome(targetBranch)
    } catch (error) {
      this.logger.error('Git 推送结果核验失败:', error)
      return {
        statusCode: 503,
        body: {
          success: false,
          message: 'Git 推送结果暂时无法核验',
          error: 'Git 推送结果暂时无法核验',
          hint: '请先刷新 Git 状态确认远端是否已更新，再决定是否重试推送。',
          code: 'GIT_SYNC_CHECK_UNAVAILABLE'
        }
      }
    }
    if (!syncStatus.verified) {
      const failure = pushError
        ? classifyPushFailure(pushError)
        : {
            statusCode: 503,
            code: 'GIT_SYNC_UNVERIFIED',
            message: '推送后暂时无法确认远端同步状态',
            hint: '请先刷新 Git 状态确认远端是否已更新，再决定是否重试推送。'
          }
      return {
        statusCode: failure.statusCode,
        body: {
          success: false,
          message: failure.message,
          error: failure.message,
          hint: failure.hint,
          code: failure.code,
          details: { syncStatus }
        }
      }
    }

    return { statusCode: 200, body: {
      success: true,
      data: {
        message: pushError ? '远端已同步，推送输出异常已忽略' : (pushOutput?.stdout?.includes('Everything up-to-date') ? '已是最新，无需推送' : '推送成功'),
        output: pushOutput?.stdout || '',
        warning: pushError ? '推送命令返回异常，但远端同步已确认' : '',
        syncStatus
      }
    } }
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

const classifyPushFailure = (error) => {
  const raw = `${error?.error || ''} ${error?.message || ''} ${error?.stderr || ''}`.toLowerCase()

  if (
    raw.includes('non-fast-forward') ||
    raw.includes('fetch first') ||
    raw.includes('updates were rejected')
  ) {
    return {
      statusCode: 409,
      code: 'GIT_REMOTE_REJECTED',
      message: '远端分支有新提交，推送被拒绝',
      hint: '先拉取并核对远端更新，解决冲突后再提交推送。'
    }
  }

  if (error?.killed || raw.includes('timed out') || raw.includes('timeout')) {
    return {
      statusCode: 504,
      code: 'GIT_REMOTE_TIMEOUT',
      message: 'Git 远端推送超时',
      hint: '请检查网络后刷新 Git 状态；确认没有正在进行的推送后再重试。'
    }
  }

  if (
    raw.includes('permission denied') ||
    raw.includes('authentication failed') ||
    raw.includes('could not read username') ||
    raw.includes('http 401') ||
    raw.includes('http 403')
  ) {
    return {
      statusCode: 502,
      code: 'GIT_REMOTE_AUTH_FAILED',
      message: 'Git 远端认证失败',
      hint: '请检查远端凭据是否有效、是否仍有仓库写入权限，然后刷新状态再重试。'
    }
  }

  if (
    raw.includes('failed to connect') ||
    raw.includes('could not connect') ||
    raw.includes('could not resolve host') ||
    raw.includes('unable to access') ||
    raw.includes('network is unreachable')
  ) {
    return {
      statusCode: 502,
      code: 'GIT_REMOTE_UNAVAILABLE',
      message: '无法连接 Git 远端仓库',
      hint: '请检查网络、代理和远端仓库地址，然后刷新状态再重试。'
    }
  }

  return {
    statusCode: 502,
    code: 'GIT_PUSH_FAILED',
    message: 'Git 远端推送失败',
    hint: '请刷新 Git 状态确认远端是否已更新；若未更新，再检查远端仓库限制后重试。'
  }
}

module.exports = GitPushService
