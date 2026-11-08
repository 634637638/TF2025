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

    const syncStatus = await this.verifyPushOutcome(targetBranch)
    if (!syncStatus.verified) {
      const errorMessage = pushError?.error || '推送后校验失败，本地提交尚未同步到远端'
      return {
        statusCode: 500,
        body: {
          success: false,
          error: errorMessage,
          hint: getPushErrorHint(errorMessage, pushError?.killed),
          details: { stderr: pushError?.stderr || '', code: pushError?.code, syncStatus }
        }
      }
    }

    return { statusCode: 200, body: {
      success: true,
      data: {
        message: pushError ? '远端已同步，推送输出异常已忽略' : (pushOutput?.stdout?.includes('Everything up-to-date') ? '已是最新，无需推送' : '推送成功'),
        output: pushOutput?.stdout || '',
        warning: pushError?.stderr || pushError?.error || '',
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

const getPushErrorHint = (message, killed = false) => {
  if (message.includes('Failed to connect') || message.includes('Could not connect')) {
    return '网络连接失败，可能原因：\n1. 需要配置代理\n2. 网络不稳定\n3. 防火墙阻止连接\n\n建议：\n- 配置 Git 代理：git config --global http.proxy http://代理地址:端口\n- 或在终端手动执行：git push'
  }
  if (message.includes('Permission denied') || message.includes('fatal: unable to access')) {
    return 'Git 凭证可能已过期或无效。\n\n建议：\n- 更新 Git 凭证：git config --global credential.helper store\n- 或使用 SSH 方式：git remote set-url origin git@github.com:用户名/仓库.git'
  }
  if (message.includes('timed out') || killed) {
    return '推送超时，可能是网络慢或数据量大。\n\n建议：\n- 稍后重试\n- 检查网络连接\n- 在终端手动执行：git push'
  }
  return '请检查远端仓库连接、Git 凭证和网络状态后重试。'
}

module.exports = GitPushService
