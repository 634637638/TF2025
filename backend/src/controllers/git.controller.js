'use strict'

const GitService = require('../services/git.service')
const log = require('../utils/log')

class GitController {
  constructor({ service, commitService, pushService, archiveBackupService, restoreMainService, executeCommand, logger = log } = {}) {
    this.service = service || new GitService({ executeCommand })
    this.commitService = commitService
    this.pushService = pushService
    this.archiveBackupService = archiveBackupService
    this.restoreMainService = restoreMainService
    this.logger = logger
  }

  async pushChanges(_req, res) {
    try {
      const result = await this.pushService.pushChanges()
      return res.status(result.statusCode).json(result.body)
    } catch (error) {
      this.logger.error('Git 推送失败:', error)
      let errorMessage = error.error || '推送失败'
      let errorHint = ''
      if (errorMessage.includes('Failed to connect') || errorMessage.includes('Could not connect')) {
        errorMessage = '无法连接到 GitHub'
        errorHint = '网络连接失败，可能原因：\n1. 需要配置代理\n2. 网络不稳定\n3. 防火墙阻止连接\n\n建议：\n- 配置 Git 代理：git config --global http.proxy http://代理地址:端口\n- 或在终端手动执行：git push'
      } else if (errorMessage.includes('Permission denied') || errorMessage.includes('fatal: unable to access')) {
        errorMessage = '认证失败'
        errorHint = 'Git 凭证可能已过期或无效。\n\n建议：\n- 更新 Git 凭证：git config --global credential.helper store\n- 或使用 SSH 方式：git remote set-url origin git@github.com:用户名/仓库.git'
      } else if (errorMessage.includes('timed out') || error.killed) {
        errorMessage = '连接超时'
        errorHint = '推送超时，可能是网络慢或数据量大。\n\n建议：\n- 稍后重试\n- 检查网络连接\n- 在终端手动执行：git push'
      }
      return res.status(500).json({
        success: false,
        error: errorMessage,
        hint: errorHint,
        details: { stderr: error.stderr, code: error.code }
      })
    }
  }

  async commitChanges(req, res) {
    try {
      const result = await this.commitService.commitChanges(req.body || {})
      return res.status(result.statusCode).json(result.body)
    } catch (error) {
      this.logger.error('Git 提交失败:', error)
      return res.status(500).json({
        success: false,
        error: error.error || '提交失败',
        details: { stderr: error.stderr, code: error.code }
      })
    }
  }

  async discardChanges(_req, res) {
    try {
      await this.service.discardChanges()
      return res.json({
        success: true,
        data: { message: '已丢弃所有未提交的更改' }
      })
    } catch (error) {
      this.logger.error('丢弃更改失败:', error)
      return res.status(500).json({
        success: false,
        error: error.error || '丢弃更改失败'
      })
    }
  }

  async cleanUntrackedFiles(_req, res) {
    try {
      const data = await this.service.cleanUntrackedFiles()
      return res.json({ success: true, data })
    } catch (error) {
      this.logger.error('清理未跟踪文件失败:', error)
      return res.status(500).json({
        success: false,
        error: error.error || '清理未跟踪文件失败'
      })
    }
  }

  async getStatus(_req, res) {
    try {
      const data = await this.service.getStatus()
      return res.json({ success: true, data })
    } catch (error) {
      this.logger.error('获取 Git 状态失败:', error)
      return res.status(500).json({
        success: false,
        error: error.error || '获取 Git 状态失败'
      })
    }
  }

  async getLog(req, res) {
    try {
      const commits = await this.service.getCommits(req.query.limit)
      return res.json({ success: true, data: { commits } })
    } catch (error) {
      this.logger.error('获取提交历史失败:', error)
      return res.status(500).json({
        success: false,
        error: error.error || '获取提交历史失败'
      })
    }
  }

  async getBranches(_req, res) {
    try {
      const data = await this.service.getBranches()
      return res.json({ success: true, data })
    } catch (error) {
      this.logger.error('获取分支列表失败:', error)
      return res.status(500).json({
        success: false,
        error: error.error || '获取分支列表失败'
      })
    }
  }

  async createBranch(req, res) {
    try {
      const result = await this.service.createBranch(req.body.name, req.body.baseBranch)
      return res.json({ success: true, data: result })
    } catch (error) {
      this.logger.error('创建分支失败:', error)
      if (error.code === 'INVALID_BRANCH') {
        return res.status(400).json({ success: false, error: error.error || '分支名称不合法' })
      }
      return res.status(500).json({ success: false, error: error.error || '创建分支失败' })
    }
  }

  async deleteBranch(req, res) {
    try {
      const result = await this.service.deleteBranch(req.body.branch, req.body.force)
      return res.json({ success: true, data: result })
    } catch (error) {
      this.logger.error('删除分支失败:', error)
      if (error.code === 'INVALID_BRANCH') {
        return res.status(400).json({ success: false, error: error.error || '分支名称不合法' })
      }
      return res.status(500).json({ success: false, error: error.error || '删除分支失败' })
    }
  }

  async switchBranch(req, res) {
    try {
      const result = await this.service.switchBranch(req.body.branch)
      return res.json({ success: true, data: result })
    } catch (error) {
      this.logger.error('切换分支失败:', error)
      if (error.code === 'INVALID_BRANCH') {
        return res.status(400).json({ success: false, error: error.error || '分支名称不合法' })
      }

      const stderr = error.stderr || error.error || ''
      if (stderr.includes('would be overwritten by checkout')) {
        return res.status(409).json({
          success: false,
          error: '当前有未提交改动，无法直接切换分支',
          hint: '请先提交改动，或先使用“Git 分支备份”保存当前状态，再切换到目标分支。',
          code: 'UNCOMMITTED_CHANGES'
        })
      }
      if (stderr.includes('pathspec') && stderr.includes('did not match')) {
        return res.status(404).json({
          success: false,
          error: `分支不存在: ${String(req.body.branch || '').trim()}`,
          hint: '请先刷新分支列表，确认该分支仍然存在。'
        })
      }
      return res.status(500).json({
        success: false,
        error: error.error || '切换分支失败',
        details: { stderr: error.stderr, code: error.code }
      })
    }
  }

  async checkoutCommit(req, res) {
    try {
      const data = await this.service.checkoutCommit(req.body.commit, req.body.mode || 'view')
      return res.json({ success: true, data })
    } catch (error) {
      this.logger.error('切换版本失败:', error)
      if (error.code === 'INVALID_COMMIT') {
        return res.status(400).json({ success: false, error: error.error || '提交哈希不合法' })
      }
      return res.status(500).json({ success: false, error: error.error || '切换版本失败' })
    }
  }

  async createBranchBackup(req, res) {
    try {
      const { name, message, includeChanges = true } = req.body
      this.logger.debug('🌿 开始创建 Git 分支备份:', { name, includeChanges })
      const backup = await this.service.createBranchBackupSnapshot({
        name,
        message,
        includeChanges,
        returnToOriginal: true
      })
      this.logger.debug('✅ Git 分支备份创建成功:', {
        branch: backup.backupBranch,
        commit: backup.commit.hash.substring(0, 8),
        hasChanges: backup.hasChanges
      })

      return res.json({
        success: true,
        data: {
          message: backup.headState.detached
            ? `Git 分支备份创建成功，已切换到备份分支: ${backup.backupBranch}`
            : 'Git 分支备份创建成功',
          backup: {
            branch: backup.backupBranch,
            current: backup.activeBranch,
            commit: backup.commit,
            hasChanges: backup.hasChanges,
            type: 'branch'
          }
        }
      })
    } catch (error) {
      this.logger.error('创建 Git 分支备份失败:', error)
      const stderr = error.stderr || error.error || ''
      if (error.code === 'INVALID_BRANCH') {
        return res.status(400).json({ success: false, error: error.error || '备份分支名称不合法' })
      }
      if (error.code === 'BRANCH_EXISTS') {
        return res.status(409).json({
          success: false,
          error: error.error,
          hint: '请使用新的备份名称后重试。',
          code: 'BRANCH_EXISTS'
        })
      }
      if (stderr.includes('would be overwritten by checkout')) {
        return res.status(409).json({
          success: false,
          error: '当前改动阻止了备份分支切换',
          hint: '请先处理未提交改动，或刷新后重试 Git 分支备份。',
          code: 'UNCOMMITTED_CHANGES'
        })
      }
      return res.status(500).json({
        success: false,
        error: error.error || '创建 Git 分支备份失败',
        hint: '请检查 Git 仓库状态和权限',
        details: { stderr: error.stderr, code: error.code }
      })
    }
  }

  async createArchiveBackup(req, res) {
    try {
      const data = await this.archiveBackupService.createArchiveBackup(req.body?.name)
      return res.json({ success: true, data })
    } catch (error) {
      this.logger.error('创建本地压缩包备份失败:', error)
      const statusCode = error.statusCode || 500
      if (statusCode === 409) {
        return res.status(409).json({ success: false, error: error.message })
      }
      return res.status(500).json({
        success: false,
        error: error.message || '创建本地压缩包备份失败',
        hint: '请检查磁盘空间和 tar 命令是否可用'
      })
    }
  }

  async restoreMain(_req, res) {
    try {
      const result = await this.restoreMainService.restoreMain()
      return res.status(result.status || 200).json(result.body || result)
    } catch (error) {
      this.logger.error('恢复到 main 失败:', error)
      const stderr = error.stderr || error.error || ''
      if (stderr.includes('would be overwritten by checkout')) {
        return res.status(409).json({
          success: false,
          error: '切换到 main 时被 Git 阻止，但你的最新代码没有丢失',
          hint: '系统已尽量保留当前代码。请重试一次；如果仍失败，我会继续把恢复逻辑改成更保守的方式。',
          code: 'CHECKOUT_BLOCKED',
          details: { stderr: error.stderr, code: error.code }
        })
      }
      return res.status(500).json({
        success: false,
        error: error.error || '恢复到 main 失败',
        hint: '请检查 Git 仓库状态后重试',
        details: { stderr: error.stderr, code: error.code }
      })
    }
  }

  async hideCommit(req, res) {
    try {
      const result = await this.service.hideCommit(req.body.hash)
      return res.json({ success: true, data: result })
    } catch (error) {
      this.logger.error('隐藏提交历史记录失败:', error)
      if (error.code === 'INVALID_COMMIT') {
        return res.status(400).json({ success: false, error: error.error || '提交哈希不合法' })
      }
      return res.status(500).json({
        success: false,
        error: error.message || '隐藏历史记录失败',
        hint: '此操作现在只会隐藏 Git 管理页里的历史记录，不会删除或修改当前工作区文件'
      })
    }
  }

  async pull(_req, res) {
    try {
      const result = await this.service.pull()
      return res.json({ success: true, data: result })
    } catch (error) {
      if (error.statusCode === 409 && error.code === 'DETACHED_HEAD') {
        return res.status(409).json({
          success: false,
          error: '当前仓库处于分离 HEAD 状态，不能直接提交并推送',
          hint: `请先在 Git 管理页切换到正常分支（例如 main），或基于当前提交 ${error.shortCommit} 新建分支后再提交。`,
          code: 'DETACHED_HEAD'
        })
      }
      if (error.statusCode === 409 && error.code === 'NOT_MAIN_BRANCH') {
        return res.status(409).json({
          success: false,
          error: `当前分支为 ${error.branch}，请先恢复到 main`,
          hint: '当前 Git 管理页已按主线模式运行。请先点击“恢复到 main”，确认最新代码已带回主线后，再执行提交、推送或拉取。',
          code: 'NOT_MAIN_BRANCH'
        })
      }

      this.logger.error('Git 拉取失败:', error)
      return res.status(500).json({
        success: false,
        error: error.error || '拉取失败'
      })
    }
  }
}

module.exports = GitController
