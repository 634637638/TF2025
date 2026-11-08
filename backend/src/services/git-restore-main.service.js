'use strict'

const fs = require('node:fs').promises
const os = require('node:os')
const path = require('node:path')
const { normalizeBranchName } = require('../utils/git-branch')

const GENERATED_BRANCH_SWITCH_FILES = [
  'frontend/src/components.d.ts',
  'frontend/src/auto-imports.d.ts',
  'frontend/components.d.ts',
  'frontend/auto-imports.d.ts',
  'frontend/VITE_DEV_OUT.txt'
]

class GitRestoreMainService {
  constructor({
    gitService,
    executeCommand,
    executeArgs,
    fileSystem = fs,
    pathModule = path,
    osModule = os,
    projectRoot,
    now = () => new Date(),
    logger = { warn() {} }
  } = {}) {
    this.gitService = gitService
    this.executeCommand = executeCommand
    this.executeArgs = executeArgs
    this.fileSystem = fileSystem
    this.path = pathModule
    this.os = osModule
    this.projectRoot = projectRoot
    this.now = now
    this.logger = logger
  }

  buildBackupBranchName() {
    return `backup-${this.now().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
  }

  async moveGeneratedBranchSwitchFiles() {
    const tempDir = this.path.join(this.os.tmpdir(), `tf2025-restore-main-${this.now().getTime()}`)
    const movedFiles = []
    for (const relativeFile of GENERATED_BRANCH_SWITCH_FILES) {
      const sourceFile = this.path.join(this.projectRoot, relativeFile)
      try {
        await this.fileSystem.access(sourceFile)
      } catch {
        continue
      }
      const targetFile = this.path.join(tempDir, relativeFile.replace(/[\\/]/g, '__'))
      await this.fileSystem.mkdir(this.path.dirname(targetFile), { recursive: true })
      try {
        await this.fileSystem.rename(sourceFile, targetFile)
      } catch {
        await this.fileSystem.copyFile(sourceFile, targetFile)
        await this.fileSystem.unlink(sourceFile)
      }
      movedFiles.push(relativeFile)
    }
    return movedFiles
  }

  async checkoutMainWithGeneratedFileRetry(targetBranch) {
    const safeTargetBranch = normalizeBranchName(targetBranch, '目标分支')
    let lastError = null
    const movedGeneratedFiles = []
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const movedThisRound = await this.moveGeneratedBranchSwitchFiles()
      movedGeneratedFiles.push(...movedThisRound.filter(file => !movedGeneratedFiles.includes(file)))
      try {
        await this.executeArgs(['checkout', safeTargetBranch])
        return movedGeneratedFiles
      } catch (error) {
        const stderr = error.stderr || error.error || ''
        if (!GENERATED_BRANCH_SWITCH_FILES.some(file => stderr.includes(file))) throw error
        lastError = error
      }
    }
    throw lastError
  }

  async restoreMain() {
    const targetBranch = 'main'
    const headState = await this.gitService.getHeadState()
    const { stdout: statusOutput } = await this.executeCommand('git status --porcelain')
    const hasChanges = statusOutput.trim().length > 0
    const stashName = `auto-restore-main-${this.now().getTime()}`
    let stashed = false
    let movedGeneratedFiles = []

    if (!headState.detached && headState.branch === targetBranch) {
      return {
        success: true,
        data: {
          message: hasChanges ? '当前已经在 main，最新未提交代码已保留，无需恢复' : '当前已经在 main，且工作区干净',
          branch: targetBranch,
          hasChanges
        }
      }
    }

    let sourceBranch = null
    let snapshotBranch = null
    if (headState.detached || hasChanges) {
      const backup = await this.gitService.createBranchBackupSnapshot({
        name: this.buildBackupBranchName(),
        message: `🌿 自动恢复主线备份 - ${this.now().toLocaleString('zh-CN')}\n\n修改内容:\n恢复到 main 之前自动保存当前状态。\n\n优化内容:\n自动主线恢复流程`,
        includeChanges: true,
        returnToOriginal: false
      })
      sourceBranch = backup.backupBranch
      snapshotBranch = backup.backupBranch
    } else if (headState.branch && headState.branch !== targetBranch) {
      sourceBranch = headState.branch
    }

    const { stdout: residualStatus } = await this.executeCommand('git status --porcelain --untracked-files=all')
    if (residualStatus.trim()) {
      await this.executeArgs(['stash', 'push', '--include-untracked', '-m', stashName])
      stashed = true
    }

    movedGeneratedFiles = await this.checkoutMainWithGeneratedFileRetry(targetBranch)
    let merged = false
    if (sourceBranch && sourceBranch !== targetBranch) {
      try {
        await this.executeArgs(['merge', '--no-ff', '--no-edit', sourceBranch])
        merged = true
      } catch {
        await this.executeCommand('git merge --abort').catch(() => {})
        return {
          status: 409,
          body: {
            success: false,
            error: '已回到 main，但当前最新代码未能自动合并到主线',
            hint: `你的代码已经安全保存在分支 ${sourceBranch}。请后续手动将该分支合并到 main。`,
            code: 'MERGE_CONFLICT',
            data: { backupBranch: sourceBranch, snapshotBranch }
          }
        }
      }
    }

    let appliedStash = false
    if (stashed) {
      try {
        await this.executeCommand('git stash apply')
        await this.executeCommand('git stash drop')
        appliedStash = true
      } catch {
        return {
          status: 409,
          body: {
            success: false,
            error: '已切回 main，但还有一部分未跟踪文件未能自动恢复',
            hint: `你的最新代码已经保存在分支 ${sourceBranch || headState.branch || targetBranch}，剩余文件仍安全保存在 stash 中，请后续手动处理。`,
            code: 'STASH_APPLY_CONFLICT',
            data: { backupBranch: sourceBranch || null, snapshotBranch, stashName }
          }
        }
      }
    }

    return {
      success: true,
      data: {
        message: sourceBranch
          ? `已恢复到 main${merged ? `，并已带回 ${sourceBranch} 的最新代码` : ''}${appliedStash ? '，剩余文件也已恢复' : ''}`
          : '已切换到 main',
        branch: targetBranch,
        restoredFromDetached: headState.detached,
        backupBranch: sourceBranch || null,
        snapshotBranch,
        merged,
        appliedStash,
        movedGeneratedFiles
      }
    }
  }
}

module.exports = GitRestoreMainService
