const express = require('express')
const router = express.Router()
const { exec, execFile } = require('child_process')
const fs = require('fs').promises
const fsSync = require('fs')
const path = require('path')
const PROJECT_ROOT = path.resolve(__dirname, '../../..')
const log = require('../utils/log')
const { TIMEOUTS } = require('../config/constants')
const GitService = require('../services/git.service')
const GitCommitService = require('../services/git-commit.service')
const GitPushService = require('../services/git-push.service')
const GitArchiveBackupService = require('../services/git-archive-backup.service')
const GitRestoreMainService = require('../services/git-restore-main.service')
const { normalizeBranchName } = require('../utils/git-branch')

// 导入统一认证中间件
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const GitController = require('../controllers/git.controller')

/**
 * Promise 封装的 exec 函数
 * @param {string} command - 要执行的命令
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
const execPromise = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: PROJECT_ROOT, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(error)
      } else {
        resolve({ stdout, stderr })
      }
    })
  })
}

const GITHUB_WARNING_FILE_SIZE_BYTES = 50 * 1024 * 1024
const GITHUB_BLOCKED_FILE_SIZE_BYTES = 100 * 1024 * 1024

const getGitExecOptions = () => ({
  cwd: PROJECT_ROOT,
  timeout: TIMEOUTS.LONG_RUNNING_TASK,
  maxBuffer: 50 * 1024 * 1024,
  env: {
    ...process.env,
    GIT_HTTP_POST_BUFFER: '524288000'
  }
})

const createGitError = (message, code, details = {}) => Object.assign(
  new Error(message),
  { error: message, code, ...details }
)

const execGitArgs = (args) => {
  return new Promise((resolve, reject) => {
    execFile('git', args, getGitExecOptions(), (error, stdout, stderr) => {
      if (error) {
        reject(createGitError(error.message, error.code, {
          stderr: stderr.trim(),
          killed: error.killed
        }))
      } else {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() })
      }
    })
  })
}

const execFilePromise = (command, args, options = {}) => new Promise((resolve, reject) => {
  execFile(command, args, options, (error, stdout, stderr) => {
    if (error) {
      error.stderr = String(stderr || '').trim()
      return reject(error)
    }
    return resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') })
  })
})

const escapeShellArg = (value) => {
  return `'${String(value || '').replace(/'/g, '\'\\\'\'')}'`
}

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value >= 100 ? value.toFixed(0) : value.toFixed(2)} ${units[unitIndex]}`
}

/**
 * Git 自动提交路由
 * 提供一键提交代码到 Git 的功能
 * 仅限管理员访问
 */

// 所有路由都需要认证
router.use(unifiedAuth)

const requireGitView = requirePermission('git-management:view')
const requireGitCreate = requirePermission('git-management:create')
const requireGitEdit = requirePermission('git-management:edit')
const requireGitDelete = requirePermission('git-management:delete')

// 工具函数：执行 Git 命令
const execGitCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, getGitExecOptions(), (error, stdout, stderr) => {
      if (error) {
        reject(createGitError(error.message, error.code, {
          stderr: stderr.trim(),
          killed: error.killed
        }))
      } else {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() })
      }
    })
  })
}

const gitService = new GitService({ executeCommand: execGitCommand, executeArgs: execGitArgs })
const gitController = new GitController({
  service: gitService,
  archiveBackupService: new GitArchiveBackupService({
    projectRoot: PROJECT_ROOT,
    fileSystem: fs,
    existsSync: fsSync.existsSync,
    executeCommand: execPromise,
    executeArchive: execFilePromise,
    logger: log
  }),
  logger: log
})

const getHeadState = () => gitService.getHeadState()

const getUpstreamRef = async (branch = 'main') => {
  try {
    const { stdout } = await execGitArgs(['rev-parse', '--abbrev-ref', `${branch}@{upstream}`])
    return stdout.trim()
  } catch {
    return ''
  }
}

const getBranchSyncStatus = async (branch = 'main') => {
  const upstreamRef = await getUpstreamRef(branch)

  if (!upstreamRef) {
    return {
      hasUpstream: false,
      upstreamRef: '',
      ahead: 0,
      behind: 0,
      isSynced: false
    }
  }

  try {
    const { stdout } = await execGitArgs(['rev-list', '--left-right', '--count', `${branch}...${upstreamRef}`])
    const [aheadRaw = '0', behindRaw = '0'] = stdout.trim().split(/\s+/)
    const ahead = Number.parseInt(aheadRaw, 10) || 0
    const behind = Number.parseInt(behindRaw, 10) || 0

    return {
      hasUpstream: true,
      upstreamRef,
      ahead,
      behind,
      isSynced: ahead === 0
    }
  } catch (error) {
    log.warn('获取分支同步状态失败:', error)
    return {
      hasUpstream: true,
      upstreamRef,
      ahead: 0,
      behind: 0,
      isSynced: false
    }
  }
}

const verifyPushOutcome = async (branch = 'main') => {
  const syncStatus = await getBranchSyncStatus(branch)

  return {
    ...syncStatus,
    verified: syncStatus.hasUpstream && syncStatus.ahead === 0
  }
}

const getPendingPushFileSizeCheck = async (branch = 'main') => {
  const normalizedBranch = normalizeBranchName(branch, '分支名称')
  const upstreamRef = await getUpstreamRef(normalizedBranch)
  const rangeExpression = upstreamRef ? `${upstreamRef}..${normalizedBranch}` : normalizedBranch
  const revListCommand = upstreamRef
    ? `git rev-list --objects ${escapeShellArg(rangeExpression)}`
    : `git rev-list --objects ${escapeShellArg(normalizedBranch)} --not --remotes=origin`
  const batchCheckCommand = `${revListCommand} | git cat-file --batch-check='%(objecttype)|%(objectname)|%(objectsize)|%(rest)'`

  const { stdout } = await execGitCommand(batchCheckCommand)
  const oversizedByPath = new Map()

  stdout.split('\n').forEach((line) => {
    if (!line.trim()) {
      return
    }

    const [type, objectId, rawSize, ...restParts] = line.split('|')
    const filePath = restParts.join('|').trim()

    if (type !== 'blob' || !filePath) {
      return
    }

    const size = Number.parseInt(rawSize, 10)
    if (!Number.isFinite(size) || size < GITHUB_WARNING_FILE_SIZE_BYTES) {
      return
    }

    const existing = oversizedByPath.get(filePath)
    if (!existing || size > existing.size) {
      oversizedByPath.set(filePath, {
        objectId,
        path: filePath,
        size,
        sizeFormatted: formatBytes(size)
      })
    }
  })

  const files = Array.from(oversizedByPath.values()).sort((a, b) => b.size - a.size)

  return {
    hasUpstream: Boolean(upstreamRef),
    upstreamRef,
    blockedFiles: files.filter(file => file.size >= GITHUB_BLOCKED_FILE_SIZE_BYTES),
    warningFiles: files.filter(
      file => file.size >= GITHUB_WARNING_FILE_SIZE_BYTES && file.size < GITHUB_BLOCKED_FILE_SIZE_BYTES
    )
  }
}

const buildPushSizeHint = ({ blockedFiles = [], warningFiles = [] }) => {
  const lines = []

  if (blockedFiles.length > 0) {
    lines.push('以下文件超过 GitHub 100MB 限制，必须先从待推送提交中移除或改用 Git LFS：')
    blockedFiles.slice(0, 5).forEach((file) => {
      lines.push(`- ${file.path} (${file.sizeFormatted})`)
    })
  }

  if (warningFiles.length > 0) {
    lines.push('以下文件已超过 50MB，建议不要直接纳入 Git 主仓库：')
    warningFiles.slice(0, 5).forEach((file) => {
      lines.push(`- ${file.path} (${file.sizeFormatted})`)
    })
  }

  lines.push('建议：将备份压缩包、构建产物移出提交历史后再推送。')
  return lines.join('\n')
}

const gitRestoreMainService = new GitRestoreMainService({
  gitService,
  executeCommand: execGitCommand,
  executeArgs: execGitArgs,
  projectRoot: PROJECT_ROOT,
  logger: log
})
const gitCommitController = new GitController({
  service: gitService,
  commitService: new GitCommitService({
    getHeadState,
    executeCommand: execGitCommand,
    executeArgs: execGitArgs,
    getUpstreamRef,
    getPendingPushFileSizeCheck,
    buildPushSizeHint,
    verifyPushOutcome,
    logger: log
  }),
  logger: log
})
const gitRestoreMainController = new GitController({
  service: gitService,
  restoreMainService: gitRestoreMainService,
  logger: log
})
const gitPushController = new GitController({
  service: gitService,
  pushService: new GitPushService({
    getHeadState,
    executeCommand: execGitCommand,
    getUpstreamRef,
    getPendingPushFileSizeCheck,
    buildPushSizeHint,
    verifyPushOutcome,
    logger: log
  }),
  logger: log
})

/**
 * GET /api/git/status
 * 获取 Git 状态
 */
router.get('/status', requireGitView, gitController.getStatus.bind(gitController))

/**
 * POST /api/git/commit
 * 一键提交到 Git
 * Body: { message: string, autoPush: boolean }
 */
router.post('/commit', requireGitEdit, gitCommitController.commitChanges.bind(gitCommitController))

/**
 * POST /api/git/push
 * 单独推送代码
 */
router.post('/push', requireGitEdit, gitPushController.pushChanges.bind(gitPushController))

/**
 * POST /api/git/pull
 * 拉取远程更新
 */
router.post('/pull', requireGitEdit, gitController.pull.bind(gitController))

/**
 * GET /api/git/log
 * 获取提交历史（过滤掉本地备份相关的提交）
 */
router.get('/log', requireGitView, gitController.getLog.bind(gitController))

/**
 * POST /api/git/discard
 * 丢弃所有未提交的更改
 */
router.post('/discard', requireGitEdit, gitController.discardChanges.bind(gitController))

/**
 * POST /api/git/checkout
 * 切换到指定版本
 * Body: { commit: string, mode: 'view' | 'reset' }
 */
router.post('/checkout', requireGitEdit, gitController.checkoutCommit.bind(gitController))

/**
 * GET /api/git/branches
 * 获取所有分支列表
 */
router.get('/branches', requireGitView, gitController.getBranches.bind(gitController))

/**
 * POST /api/git/switch-branch
 * 切换分支
 * Body: { branch: string }
 */
router.post('/switch-branch', requireGitEdit, gitController.switchBranch.bind(gitController))

/**
 * POST /api/git/create-branch
 * 创建新分支
 * Body: { name: string, baseBranch?: string }
 */
router.post('/create-branch', requireGitCreate, gitController.createBranch.bind(gitController))

/**
 * DELETE /api/git/delete-branch
 * 删除分支
 * Body: { branch: string, force?: boolean }
 */
router.delete('/delete-branch', requireGitDelete, gitController.deleteBranch.bind(gitController))

/**
 * POST /api/git/clean
 * 清理未跟踪的文件
 */
router.post('/clean', requireGitEdit, gitController.cleanUntrackedFiles.bind(gitController))

/**
 * POST /api/git/delete-commit
 * 从 Git 管理历史列表中隐藏指定提交
 * Body: { hash: string }
 */
router.post('/delete-commit', requireGitDelete, gitController.hideCommit.bind(gitController))

// ==================== 创建本地压缩包备份 ====================
router.post('/backup/archive', requireGitCreate, gitController.createArchiveBackup.bind(gitController))

// ==================== 创建 Git 分支备份 ====================
router.post('/backup/branch', requireGitCreate, gitController.createBranchBackup.bind(gitController))

router.post('/restore-main', requireGitEdit, gitRestoreMainController.restoreMain.bind(gitRestoreMainController))

module.exports = router
