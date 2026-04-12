const express = require('express');
const router = express.Router();
const { exec, execSync, execFile } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const log = require('../utils/log');

// 导入统一认证中间件
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');

/**
 * Promise 封装的 exec 函数
 * @param {string} command - 要执行的命令
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
const execPromise = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: PROJECT_ROOT, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
};

const GIT_BRANCH_NAME_PATTERN = /^(?!-)(?!.*\.\.)(?!.*\/\/)(?!.*@\{)(?!.*\\)(?!.*\.$)[A-Za-z0-9._/-]{1,120}$/;
const GIT_COMMIT_HASH_PATTERN = /^[0-9a-fA-F]{7,40}$/;
const GITHUB_WARNING_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const GITHUB_BLOCKED_FILE_SIZE_BYTES = 100 * 1024 * 1024;

const getGitExecOptions = () => ({
  cwd: PROJECT_ROOT,
  timeout: 300000,
  maxBuffer: 50 * 1024 * 1024,
  env: {
    ...process.env,
    GIT_HTTP_POST_BUFFER: '524288000'
  }
});

const execGitArgs = (args) => {
  return new Promise((resolve, reject) => {
    execFile('git', args, getGitExecOptions(), (error, stdout, stderr) => {
      if (error) {
        reject({
          error: error.message,
          stderr: stderr.trim(),
          code: error.code,
          killed: error.killed
        });
      } else {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      }
    });
  });
};

const escapeShellArg = (value) => {
  return `'${String(value || '').replace(/'/g, `'\\''`)}'`;
};

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 100 ? value.toFixed(0) : value.toFixed(2)} ${units[unitIndex]}`;
};

const normalizeBranchName = (branch, fieldName = '分支名称') => {
  const normalizedBranch = String(branch || '').trim();

  if (!GIT_BRANCH_NAME_PATTERN.test(normalizedBranch)) {
    throw {
      error: `${fieldName}不合法`,
      code: 'INVALID_BRANCH'
    };
  }

  return normalizedBranch;
};

const normalizeCommitHash = (commit) => {
  const normalizedCommit = String(commit || '').trim();

  if (!GIT_COMMIT_HASH_PATTERN.test(normalizedCommit)) {
    throw {
      error: '提交哈希不合法',
      code: 'INVALID_COMMIT'
    };
  }

  return normalizedCommit;
};

const sanitizeArchiveBackupName = (name, fallbackName) => {
  const normalizedName = String(name || '')
    .trim()
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9._ -]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 80);

  return normalizedName || fallbackName;
};

/**
 * Git 自动提交路由
 * 提供一键提交代码到 Git 的功能
 * 仅限管理员访问
 */

// 所有路由都需要认证
router.use(unifiedAuth);

const requireAdmin = requirePermission('permissions:admin');

// 工具函数：执行 Git 命令
const execGitCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, getGitExecOptions(), (error, stdout, stderr) => {
      if (error) {
        reject({
          error: error.message,
          stderr: stderr.trim(),
          code: error.code,
          killed: error.killed
        });
      } else {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      }
    });
  });
};

const getHeadState = async () => {
  const { stdout: branchOutput } = await execGitCommand('git branch --show-current');
  const { stdout: shortCommit } = await execGitCommand('git rev-parse --short HEAD');
  const branch = branchOutput.trim();
  const detached = !branch;

  return {
    branch,
    detached,
    shortCommit,
    displayName: detached ? `HEAD (detached @ ${shortCommit})` : branch
  };
};

const getUpstreamRef = async (branch = 'main') => {
  try {
    const { stdout } = await execGitArgs(['rev-parse', '--abbrev-ref', `${branch}@{upstream}`]);
    return stdout.trim();
  } catch {
    return '';
  }
};

const getBranchSyncStatus = async (branch = 'main') => {
  const upstreamRef = await getUpstreamRef(branch);

  if (!upstreamRef) {
    return {
      hasUpstream: false,
      upstreamRef: '',
      ahead: 0,
      behind: 0,
      isSynced: false
    };
  }

  try {
    const { stdout } = await execGitArgs(['rev-list', '--left-right', '--count', `${branch}...${upstreamRef}`]);
    const [aheadRaw = '0', behindRaw = '0'] = stdout.trim().split(/\s+/);
    const ahead = Number.parseInt(aheadRaw, 10) || 0;
    const behind = Number.parseInt(behindRaw, 10) || 0;

    return {
      hasUpstream: true,
      upstreamRef,
      ahead,
      behind,
      isSynced: ahead === 0
    };
  } catch (error) {
    log.warn('获取分支同步状态失败:', error);
    return {
      hasUpstream: true,
      upstreamRef,
      ahead: 0,
      behind: 0,
      isSynced: false
    };
  }
};

const verifyPushOutcome = async (branch = 'main') => {
  const syncStatus = await getBranchSyncStatus(branch);

  return {
    ...syncStatus,
    verified: syncStatus.hasUpstream && syncStatus.ahead === 0
  };
};

const HIDDEN_COMMIT_CONFIG_KEY = 'tf2025.hiddenCommit';

const getHiddenCommitHashes = async () => {
  try {
    const { stdout } = await execGitArgs(['config', '--local', '--get-all', HIDDEN_COMMIT_CONFIG_KEY]);
    return new Set(
      stdout
        .split('\n')
        .map(item => item.trim().toLowerCase())
        .filter(Boolean)
    );
  } catch {
    return new Set();
  }
};

const addHiddenCommitHash = async (hash) => {
  const normalizedHash = normalizeCommitHash(hash).toLowerCase();
  const hiddenHashes = await getHiddenCommitHashes();

  if (hiddenHashes.has(normalizedHash)) {
    return false;
  }

  await execGitArgs(['config', '--local', '--add', HIDDEN_COMMIT_CONFIG_KEY, normalizedHash]);
  return true;
};

const getPendingPushFileSizeCheck = async (branch = 'main') => {
  const normalizedBranch = normalizeBranchName(branch, '分支名称');
  const upstreamRef = await getUpstreamRef(normalizedBranch);
  const rangeExpression = upstreamRef ? `${upstreamRef}..${normalizedBranch}` : normalizedBranch;
  const revListCommand = upstreamRef
    ? `git rev-list --objects ${escapeShellArg(rangeExpression)}`
    : `git rev-list --objects ${escapeShellArg(normalizedBranch)} --not --remotes=origin`;
  const batchCheckCommand = `${revListCommand} | git cat-file --batch-check='%(objecttype)|%(objectname)|%(objectsize)|%(rest)'`;

  const { stdout } = await execGitCommand(batchCheckCommand);
  const oversizedByPath = new Map();

  stdout.split('\n').forEach((line) => {
    if (!line.trim()) {
      return;
    }

    const [type, objectId, rawSize, ...restParts] = line.split('|');
    const filePath = restParts.join('|').trim();

    if (type !== 'blob' || !filePath) {
      return;
    }

    const size = Number.parseInt(rawSize, 10);
    if (!Number.isFinite(size) || size < GITHUB_WARNING_FILE_SIZE_BYTES) {
      return;
    }

    const existing = oversizedByPath.get(filePath);
    if (!existing || size > existing.size) {
      oversizedByPath.set(filePath, {
        objectId,
        path: filePath,
        size,
        sizeFormatted: formatBytes(size)
      });
    }
  });

  const files = Array.from(oversizedByPath.values()).sort((a, b) => b.size - a.size);

  return {
    hasUpstream: Boolean(upstreamRef),
    upstreamRef,
    blockedFiles: files.filter(file => file.size >= GITHUB_BLOCKED_FILE_SIZE_BYTES),
    warningFiles: files.filter(
      file => file.size >= GITHUB_WARNING_FILE_SIZE_BYTES && file.size < GITHUB_BLOCKED_FILE_SIZE_BYTES
    )
  };
};

const buildPushSizeHint = ({ blockedFiles = [], warningFiles = [] }) => {
  const lines = [];

  if (blockedFiles.length > 0) {
    lines.push('以下文件超过 GitHub 100MB 限制，必须先从待推送提交中移除或改用 Git LFS：');
    blockedFiles.slice(0, 5).forEach((file) => {
      lines.push(`- ${file.path} (${file.sizeFormatted})`);
    });
  }

  if (warningFiles.length > 0) {
    lines.push('以下文件已超过 50MB，建议不要直接纳入 Git 主仓库：');
    warningFiles.slice(0, 5).forEach((file) => {
      lines.push(`- ${file.path} (${file.sizeFormatted})`);
    });
  }

  lines.push('建议：将备份压缩包、构建产物移出提交历史后再推送。');
  return lines.join('\n');
};

const nonMainBranchError = (branch) => ({
  success: false,
  error: `当前分支为 ${branch}，请先恢复到 main`,
  hint: '当前 Git 管理页已按主线模式运行。请先点击“恢复到 main”，确认最新代码已带回主线后，再执行提交、推送或拉取。',
  code: 'NOT_MAIN_BRANCH'
});

const detachedHeadError = (shortCommit) => ({
  success: false,
  error: '当前仓库处于分离 HEAD 状态，不能直接提交并推送',
  hint: `请先在 Git 管理页切换到正常分支（例如 main），或基于当前提交 ${shortCommit} 新建分支后再提交。`,
  code: 'DETACHED_HEAD'
});

const buildBackupBranchName = () => {
  return `backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
};

const GENERATED_BRANCH_SWITCH_FILES = [
  'frontend/src/components.d.ts',
  'frontend/src/auto-imports.d.ts',
  'frontend/components.d.ts',
  'frontend/auto-imports.d.ts',
  'frontend/VITE_DEV_OUT.txt'
];

const moveGeneratedBranchSwitchFiles = async () => {
  const projectRoot = path.resolve(__dirname, '../..');
  const os = require('os');
  const tempDir = path.join(os.tmpdir(), `tf2025-restore-main-${Date.now()}`);
  const movedFiles = [];

  for (const relativeFile of GENERATED_BRANCH_SWITCH_FILES) {
    const sourceFile = path.join(projectRoot, relativeFile);

    try {
      await fs.access(sourceFile);
    } catch {
      continue;
    }

    const targetFile = path.join(tempDir, relativeFile.replace(/[\\/]/g, '__'));
    await fs.mkdir(path.dirname(targetFile), { recursive: true });

    try {
      await fs.rename(sourceFile, targetFile);
    } catch (error) {
      await fs.copyFile(sourceFile, targetFile);
      await fs.unlink(sourceFile);
    }

    movedFiles.push(relativeFile);
  }

  return movedFiles;
};

const checkoutMainWithGeneratedFileRetry = async (targetBranch) => {
  const safeTargetBranch = normalizeBranchName(targetBranch, '目标分支');
  let lastError = null;
  let movedGeneratedFiles = [];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const movedThisRound = await moveGeneratedBranchSwitchFiles();
    if (movedThisRound.length > 0) {
      movedGeneratedFiles = [...new Set([...movedGeneratedFiles, ...movedThisRound])];
    }

    try {
      await execGitArgs(['checkout', safeTargetBranch]);
      return movedGeneratedFiles;
    } catch (error) {
      const stderr = error.stderr || error.error || '';
      const blockedByGeneratedFile = GENERATED_BRANCH_SWITCH_FILES.some(file => stderr.includes(file));

      if (!blockedByGeneratedFile) {
        throw error;
      }

      lastError = error;
    }
  }

  throw lastError;
};

const createBranchBackupSnapshot = async ({
  name,
  message,
  includeChanges = true,
  returnToOriginal = true
}) => {
  const headState = await getHeadState();
  const { stdout: headHash } = await execGitCommand('git rev-parse HEAD');
  const originalRef = headState.detached ? headHash.trim() : headState.branch;
  const { stdout: statusOutput } = await execGitCommand('git status --porcelain');
  const hasChanges = statusOutput.trim().length > 0;
  const backupBranch = normalizeBranchName(name || buildBackupBranchName(), '备份分支名称');

  try {
    await execGitArgs(['rev-parse', '--verify', `refs/heads/${backupBranch}`]);
    throw {
      error: `备份分支已存在: ${backupBranch}`,
      code: 'BRANCH_EXISTS'
    };
  } catch (error) {
    if (error?.code === 'BRANCH_EXISTS') {
      throw error;
    }
  }

  await execGitArgs(['checkout', '-b', backupBranch]);

  if (hasChanges && includeChanges) {
    await execGitCommand('git add .');
    const tempDir = require('os').tmpdir();
    const tempFile = path.join(tempDir, `tf2025_backup_commit_${Date.now()}.txt`);
    await fs.writeFile(tempFile, message || `📦 Git 分支备份 - ${new Date().toLocaleString('zh-CN')}`, 'utf8');
    try {
      await execGitArgs(['commit', '-F', tempFile]);
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  }

  const { stdout: logOutput } = await execGitArgs(['log', backupBranch, '-1', '--pretty=format:%H|%s|%ai|%an']);
  const [hash, subject, date, author] = logOutput.trim().split('|');

  let activeBranch = backupBranch;
  if (returnToOriginal && !headState.detached && originalRef) {
    await execGitArgs(['checkout', originalRef]);
    activeBranch = originalRef;
  }

  return {
    headState,
    originalRef,
    backupBranch,
    activeBranch,
    hasChanges,
    commit: {
      hash,
      message: subject,
      date,
      author
    }
  };
};

/**
 * GET /api/git/status
 * 获取 Git 状态
 */
router.get('/status', requireAdmin, async (req, res) => {
  try {
    const { stdout: statusOutput } = await execGitCommand('git status --porcelain');
    const { stdout: branchStatusOutput } = await execGitCommand('git status --short --branch');
    const { stdout: logOutput } = await execGitCommand('git log --oneline -5');
    const headState = await getHeadState();

    // 解析状态
    const modifiedFiles = statusOutput.split('\n').filter(line => line.trim());
    const changes = modifiedFiles.map(line => {
      const status = line.substring(0, 2).trim();
      const file = line.substring(3);
      return { status, file };
    });

    const branchStatusLine = branchStatusOutput.split('\n')[0] || '';
    const aheadMatch = branchStatusLine.match(/ahead (\d+)/);
    const behindMatch = branchStatusLine.match(/behind (\d+)/);

    res.json({
      success: true,
      data: {
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
    });
  } catch (error) {
    log.error('获取 Git 状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.error || '获取 Git 状态失败'
    });
  }
});

/**
 * POST /api/git/commit
 * 一键提交到 Git
 * Body: { message: string, autoPush: boolean }
 */
router.post('/commit', requireAdmin, async (req, res) => {
  try {
    const { message = '自动提交: 更新代码', autoPush = true } = req.body;
    const headState = await getHeadState();
    const targetBranch = 'main';

    if (headState.detached) {
      return res.status(409).json(detachedHeadError(headState.shortCommit));
    }

    if (headState.branch !== targetBranch) {
      return res.status(409).json(nonMainBranchError(headState.branch));
    }

    // 检查是否有更改
    const { stdout: statusOutput } = await execGitCommand('git status --porcelain');
    if (!statusOutput.trim()) {
      return res.json({
        success: true,
        data: {
          message: '没有需要提交的更改',
          committed: false,
          pushed: false
        }
      });
    }

    // 添加所有更改
    await execGitCommand('git add .');

    const commitMessage = `${message}\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude <noreply@anthropic.com>`;
    const tempFile = path.join(require('os').tmpdir(), `tf2025_git_commit_${Date.now()}.txt`);
    await fs.writeFile(tempFile, commitMessage, 'utf8');

    try {
      await execGitArgs(['commit', '-F', tempFile]);
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }

    let pushResult = null;
    if (autoPush) {
      try {
        // 检查是否配置了远程仓库
        const { stdout: remoteOutput } = await execGitCommand('git remote');
        if (!remoteOutput.trim()) {
          return res.json({
            success: true,
            data: {
              message: '提交成功但未配置远程仓库，无法推送',
              committed: true,
              pushed: false,
              error: '未配置远程仓库'
            }
          });
        }
        const upstreamRef = await getUpstreamRef(targetBranch);
        const pendingFileSizeCheck = await getPendingPushFileSizeCheck(targetBranch);

        if (pendingFileSizeCheck.blockedFiles.length > 0) {
          return res.json({
            success: true,
            data: {
              message: '提交成功，但检测到超大文件，已阻止推送',
              committed: true,
              pushed: false,
              error: '待推送提交包含超过 GitHub 限制的文件',
              hint: buildPushSizeHint(pendingFileSizeCheck),
              syncStatus: await verifyPushOutcome(targetBranch),
              largeFiles: pendingFileSizeCheck.blockedFiles,
              warningFiles: pendingFileSizeCheck.warningFiles
            }
          });
        }

        const pushCommand = upstreamRef ? 'git push' : 'git push --set-upstream origin main';
        let pushError = null;

        try {
          pushResult = await execGitCommand(pushCommand);
        } catch (error) {
          pushError = error;
          log.error('推送失败:', pushError);
        }

        const pushVerification = await verifyPushOutcome(targetBranch);
        if (!pushVerification.verified) {
          return res.json({
            success: true,
            data: {
              message: '提交成功，但远端未同步，请稍后重试推送',
              committed: true,
              pushed: false,
              error: pushError?.stderr || pushError?.error || '推送后校验失败',
              syncStatus: pushVerification
            }
          });
        }

        if (pushError) {
          pushResult = {
            stdout: 'Push output unavailable, but remote sync has been verified.',
            stderr: pushError.stderr || pushError.error || ''
          };
        }
      } catch (pushError) {
        log.error('推送失败:', pushError);
        return res.json({
          success: true,
          data: {
            message: '提交成功但推送失败',
            committed: true,
            pushed: false,
            error: pushError.stderr || pushError.error
          }
        });
      }
    }


    // 获取最新的提交信息
    const { stdout: logOutput } = await execGitCommand('git log --oneline -1');

    res.json({
      success: true,
      data: {
        message: autoPush ? '提交并推送成功' : '提交成功',
        committed: true,
        pushed: autoPush,
        commit: logOutput,
        pushOutput: pushResult?.stdout || '',
        pushWarning: pushResult?.stderr || ''
      }
    });
  } catch (error) {
    log.error('Git 提交失败:', error);
    res.status(500).json({
      success: false,
      error: error.error || '提交失败',
      details: {
        stderr: error.stderr,
        code: error.code
      }
    });
  }
});

/**
 * POST /api/git/push
 * 单独推送代码
 */
router.post('/push', requireAdmin, async (req, res) => {
  try {
    const headState = await getHeadState();
    const targetBranch = 'main';

    if (headState.detached) {
      return res.status(409).json(detachedHeadError(headState.shortCommit));
    }

    if (headState.branch !== targetBranch) {
      return res.status(409).json(nonMainBranchError(headState.branch));
    }

    const pendingFileSizeCheck = await getPendingPushFileSizeCheck(targetBranch);
    if (pendingFileSizeCheck.blockedFiles.length > 0) {
      return res.status(409).json({
        success: false,
        error: '待推送提交包含超过 GitHub 限制的文件，已阻止推送',
        hint: buildPushSizeHint(pendingFileSizeCheck),
        details: {
          largeFiles: pendingFileSizeCheck.blockedFiles,
          warningFiles: pendingFileSizeCheck.warningFiles,
          syncStatus: await verifyPushOutcome(targetBranch)
        }
      });
    }

    const upstreamRef = await getUpstreamRef(targetBranch);
    const pushCommand = upstreamRef ? 'git push' : 'git push --set-upstream origin main';

    let pushOutput = null;
    let pushError = null;

    try {
      pushOutput = await execGitCommand(pushCommand);
    } catch (error) {
      pushError = error;
      log.error('Git 推送执行失败:', pushError);
    }

    const syncStatus = await verifyPushOutcome(targetBranch);
    if (!syncStatus.verified) {
      const errorMessage = pushError?.error || '推送后校验失败，本地提交尚未同步到远端';
      let errorHint = '请检查远端仓库连接、Git 凭证和网络状态后重试。';

      if (errorMessage.includes('Failed to connect') || errorMessage.includes('Could not connect')) {
        errorHint = '网络连接失败，可能原因：\n1. 需要配置代理\n2. 网络不稳定\n3. 防火墙阻止连接\n\n建议：\n- 配置 Git 代理：git config --global http.proxy http://代理地址:端口\n- 或在终端手动执行：git push';
      } else if (errorMessage.includes('Permission denied') || errorMessage.includes('fatal: unable to access')) {
        errorHint = 'Git 凭证可能已过期或无效。\n\n建议：\n- 更新 Git 凭证：git config --global credential.helper store\n- 或使用 SSH 方式：git remote set-url origin git@github.com:用户名/仓库.git';
      } else if (errorMessage.includes('timed out') || pushError?.killed) {
        errorHint = '推送超时，可能是网络慢或数据量大。\n\n建议：\n- 稍后重试\n- 检查网络连接\n- 在终端手动执行：git push';
      }

      return res.status(500).json({
        success: false,
        error: errorMessage,
        hint: errorHint,
        details: {
          stderr: pushError?.stderr || '',
          code: pushError?.code,
          syncStatus
        }
      });
    }

    res.json({
      success: true,
      data: {
        message: pushError ? '远端已同步，推送输出异常已忽略' : (pushOutput?.stdout?.includes('Everything up-to-date') ? '已是最新，无需推送' : '推送成功'),
        output: pushOutput?.stdout || '',
        warning: pushError?.stderr || pushError?.error || '',
        syncStatus
      }
    });
  } catch (error) {
    log.error('Git 推送失败:', error);

    // 分析错误类型并提供友好的错误信息
    let errorMessage = error.error || '推送失败';
    let errorHint = '';

    if (errorMessage.includes('Failed to connect') || errorMessage.includes('Could not connect')) {
      errorMessage = '无法连接到 GitHub';
      errorHint = '网络连接失败，可能原因：\n1. 需要配置代理\n2. 网络不稳定\n3. 防火墙阻止连接\n\n建议：\n- 配置 Git 代理：git config --global http.proxy http://代理地址:端口\n- 或在终端手动执行：git push';
    } else if (errorMessage.includes('Permission denied') || errorMessage.includes('fatal: unable to access')) {
      errorMessage = '认证失败';
      errorHint = 'Git 凭证可能已过期或无效。\n\n建议：\n- 更新 Git 凭证：git config --global credential.helper store\n- 或使用 SSH 方式：git remote set-url origin git@github.com:用户名/仓库.git';
    } else if (errorMessage.includes('timed out') || error.killed) {
      errorMessage = '连接超时';
      errorHint = '推送超时，可能是网络慢或数据量大。\n\n建议：\n- 稍后重试\n- 检查网络连接\n- 在终端手动执行：git push';
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
      hint: errorHint,
      details: {
        stderr: error.stderr,
        code: error.code
      }
    });
  }
});

/**
 * POST /api/git/pull
 * 拉取远程更新
 */
router.post('/pull', requireAdmin, async (req, res) => {
  try {
    const headState = await getHeadState();
    const targetBranch = 'main';

    if (headState.detached) {
      return res.status(409).json(detachedHeadError(headState.shortCommit));
    }

    if (headState.branch !== targetBranch) {
      return res.status(409).json(nonMainBranchError(headState.branch));
    }

    const { stdout } = await execGitCommand('git pull');

    res.json({
      success: true,
      data: {
        message: '拉取成功',
        output: stdout
      }
    });
  } catch (error) {
    log.error('Git 拉取失败:', error);
    res.status(500).json({
      success: false,
      error: error.error || '拉取失败'
    });
  }
});

/**
 * GET /api/git/log
 * 获取提交历史（过滤掉本地备份相关的提交）
 */
router.get('/log', requireAdmin, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const fetchLimit = safeLimit * 3;
    const { stdout } = await execGitArgs([
      'log',
      `-${fetchLimit}`,
      '--date=iso',
      '--pretty=format:%H%x1f%s%x1f%B%x1f%an%x1f%ad%x1e'
    ]);

    const revertedHashes = new Set();
    const hiddenCommitHashes = await getHiddenCommitHashes();

    const commitEntries = stdout.split('\x1e')
      .map(entry => entry.trim())
      .filter(Boolean)
      .map(entry => {
        const [hash = '', subject = '', body = '', author = '', date = ''] = entry.split('\x1f');
        const revertMatch = body.match(/This reverts commit ([0-9a-fA-F]{7,40})\./);

        if (revertMatch?.[1]) {
          revertedHashes.add(revertMatch[1].toLowerCase());
        }

        return {
          hash,
          message: subject,
          body,
          author,
          date,
          isRevertCommit: Boolean(revertMatch?.[1])
        };
      });

    const commits = commitEntries
      .filter(commit => {
        if (!commit.hash || !commit.message) {
          return false;
        }

        // 隐藏 revert 生成的撤销提交
        if (commit.isRevertCommit) {
          return false;
        }

        // 隐藏已经被 revert 的原提交
        if (revertedHashes.has(commit.hash.toLowerCase())) {
          return false;
        }

        // 隐藏用户手动标记为“删除历史记录”的提交
        if (hiddenCommitHashes.has(commit.hash.toLowerCase())) {
          return false;
        }

        // 过滤掉本地备份相关的提交
        return !commit.message.includes('本地备份') &&
               !commit.message.includes('📦') &&
               !commit.message.includes('自动备份');
      })
      .slice(0, safeLimit)
      .map(({ hash, message, author, date }) => ({ hash, message, author, date }));

    res.json({
      success: true,
      data: { commits }
    });
  } catch (error) {
    log.error('获取提交历史失败:', error);
    res.status(500).json({
      success: false,
      error: error.error || '获取提交历史失败'
    });
  }
});

/**
 * POST /api/git/discard
 * 丢弃所有未提交的更改
 */
router.post('/discard', requireAdmin, async (req, res) => {
  try {
    // 丢弃所有更改
    await execGitCommand('git reset --hard HEAD');
    await execGitCommand('git clean -fd');

    res.json({
      success: true,
      data: {
        message: '已丢弃所有未提交的更改'
      }
    });
  } catch (error) {
    log.error('丢弃更改失败:', error);
    res.status(500).json({
      success: false,
      error: error.error || '丢弃更改失败'
    });
  }
});

/**
 * POST /api/git/checkout
 * 切换到指定版本
 * Body: { commit: string, mode: 'view' | 'reset' }
 */
router.post('/checkout', requireAdmin, async (req, res) => {
  try {
    const safeCommit = normalizeCommitHash(req.body.commit);
    const { mode = 'view' } = req.body;

    if (mode === 'reset') {
      // 硬重置到指定版本（危险操作）
      await execGitArgs(['reset', '--hard', safeCommit]);

      // 清理未跟踪的文件和目录
      const cleanResult = await execGitCommand('git clean -fd');
      log.debug('清理未跟踪文件结果:', cleanResult);

      // 返回清理的文件数量
      const { stdout: statusOutput } = await execGitCommand('git status --porcelain');
      const hasUntracked = statusOutput.trim().length > 0;

      res.json({
        success: true,
        data: {
          message: `已重置到版本 ${safeCommit.substring(0, 8)}`,
          mode: 'reset',
          cleaned: true,
          hasUntrackedFiles: hasUntracked
        }
      });
    } else {
      // 查看模式：创建临时分支
      const tempBranchName = normalizeBranchName(`temp-view-${safeCommit.substring(0, 8)}`, '临时分支名称');

      try {
        // 先尝试创建临时分支
        await execGitArgs(['checkout', '-b', tempBranchName, safeCommit]);

        res.json({
          success: true,
          data: {
            message: `已切换到版本 ${safeCommit.substring(0, 8)} (临时分支: ${tempBranchName})`,
            mode: 'view',
            branch: tempBranchName
          }
        });
      } catch (error) {
        // 如果创建分支失败，直接 checkout
        await execGitArgs(['checkout', safeCommit]);

        res.json({
          success: true,
          data: {
            message: `已切换到版本 ${safeCommit.substring(0, 8)} (分离 HEAD 状态)`,
            mode: 'view',
            branch: null
          }
        });
      }
    }
  } catch (error) {
    log.error('切换版本失败:', error);

    if (error.code === 'INVALID_COMMIT') {
      return res.status(400).json({
        success: false,
        error: error.error || '提交哈希不合法'
      });
    }

    res.status(500).json({
      success: false,
      error: error.error || '切换版本失败'
    });
  }
});

/**
 * GET /api/git/branches
 * 获取所有分支列表
 */
router.get('/branches', requireAdmin, async (req, res) => {
  try {
    // 获取本地分支
    const { stdout: localBranchesOutput } = await execGitCommand('git branch');
    const localBranches = localBranchesOutput.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const isCurrent = line.startsWith('*');
        const name = line.replace(/^\*\s*/, '').trim();
        return { name, type: 'local', current: isCurrent };
      });

    // 获取远程分支
    const { stdout: remoteBranchesOutput } = await execGitCommand('git branch -r');
    const remoteBranches = remoteBranchesOutput.split('\n')
      .filter(line => line.trim() && !line.includes('HEAD'))
      .map(line => ({
        name: line.trim(),
        type: 'remote',
        current: false
      }));

    // 获取当前分支
    const headState = await getHeadState();

    res.json({
      success: true,
      data: {
        current: headState.branch,
        currentDisplay: headState.displayName,
        detached: headState.detached,
        branches: [...localBranches, ...remoteBranches]
      }
    });
  } catch (error) {
    log.error('获取分支列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.error || '获取分支列表失败'
    });
  }
});

/**
 * POST /api/git/switch-branch
 * 切换分支
 * Body: { branch: string }
 */
router.post('/switch-branch', requireAdmin, async (req, res) => {
  try {
    const branch = normalizeBranchName(req.body.branch);

    // 切换分支
    await execGitArgs(['checkout', branch]);

    res.json({
      success: true,
      data: {
        message: `已切换到分支: ${branch}`,
        branch
      }
    });
  } catch (error) {
    log.error('切换分支失败:', error);

    if (error.code === 'INVALID_BRANCH') {
      return res.status(400).json({
        success: false,
        error: error.error || '分支名称不合法'
      });
    }

    const stderr = error.stderr || error.error || '';

    if (stderr.includes('would be overwritten by checkout')) {
      return res.status(409).json({
        success: false,
        error: '当前有未提交改动，无法直接切换分支',
        hint: '请先提交改动，或先使用“Git 分支备份”保存当前状态，再切换到目标分支。',
        code: 'UNCOMMITTED_CHANGES'
      });
    }

    if (stderr.includes('pathspec') && stderr.includes('did not match')) {
      return res.status(404).json({
        success: false,
        error: `分支不存在: ${branch}`,
        hint: '请先刷新分支列表，确认该分支仍然存在。'
      });
    }

    res.status(500).json({
      success: false,
      error: error.error || '切换分支失败',
      details: {
        stderr: error.stderr,
        code: error.code
      }
    });
  }
});

/**
 * POST /api/git/create-branch
 * 创建新分支
 * Body: { name: string, baseBranch?: string }
 */
router.post('/create-branch', requireAdmin, async (req, res) => {
  try {
    const name = normalizeBranchName(req.body.name, '新分支名称');
    const baseBranch = req.body.baseBranch
      ? normalizeBranchName(req.body.baseBranch, '基础分支名称')
      : '';

    // 创建并切换到新分支
    if (baseBranch) {
      await execGitArgs(['checkout', baseBranch]);
    }
    await execGitArgs(['checkout', '-b', name]);

    res.json({
      success: true,
      data: {
        message: `已创建并切换到新分支: ${name}`,
        branch: name
      }
    });
  } catch (error) {
    log.error('创建分支失败:', error);

    if (error.code === 'INVALID_BRANCH') {
      return res.status(400).json({
        success: false,
        error: error.error || '分支名称不合法'
      });
    }

    res.status(500).json({
      success: false,
      error: error.error || '创建分支失败'
    });
  }
});

/**
 * DELETE /api/git/delete-branch
 * 删除分支
 * Body: { branch: string, force?: boolean }
 */
router.delete('/delete-branch', requireAdmin, async (req, res) => {
  try {
    const branch = normalizeBranchName(req.body.branch);
    const { force = false } = req.body;

    // 删除分支
    await execGitArgs(force ? ['branch', '-D', branch] : ['branch', '-d', branch]);

    res.json({
      success: true,
      data: {
        message: `已删除分支: ${branch}`,
        branch
      }
    });
  } catch (error) {
    log.error('删除分支失败:', error);

    if (error.code === 'INVALID_BRANCH') {
      return res.status(400).json({
        success: false,
        error: error.error || '分支名称不合法'
      });
    }

    res.status(500).json({
      success: false,
      error: error.error || '删除分支失败'
    });
  }
});

/**
 * POST /api/git/clean
 * 清理未跟踪的文件
 */
router.post('/clean', requireAdmin, async (req, res) => {
  try {
    // 先检查有哪些未跟踪文件
    const { stdout: statusOutput } = await execGitCommand('git status --porcelain');
    const untrackedFiles = statusOutput.split('\n')
      .filter(line => line.trim().startsWith('??'))
      .map(line => line.substring(3));

    if (untrackedFiles.length === 0) {
      return res.json({
        success: true,
        data: {
          message: '没有未跟踪的文件需要清理',
          cleanedCount: 0
        }
      });
    }

    // 清理未跟踪文件和目录
    await execGitCommand('git clean -fd');

    res.json({
      success: true,
      data: {
        message: `已清理 ${untrackedFiles.length} 个未跟踪文件`,
        cleanedCount: untrackedFiles.length,
        files: untrackedFiles
      }
    });
  } catch (error) {
    log.error('清理未跟踪文件失败:', error);
    res.status(500).json({
      success: false,
      error: error.error || '清理未跟踪文件失败'
    });
  }
});

/**
 * POST /api/git/delete-commit
 * 从 Git 管理历史列表中隐藏指定提交
 * Body: { hash: string }
 */
router.post('/delete-commit', requireAdmin, async (req, res) => {
  try {
    const hash = normalizeCommitHash(req.body.hash);
    log.debug(`🗂️ 隐藏提交历史记录: ${hash.substring(0, 8)}`);

    const wasAdded = await addHiddenCommitHash(hash);

    return res.json({
      success: true,
      data: {
        message: wasAdded
          ? `已从历史列表隐藏提交 ${hash.substring(0, 8)}`
          : `提交 ${hash.substring(0, 8)} 已经处于隐藏状态`,
        hiddenHash: hash,
        method: 'hide',
        affectsWorkingTree: false
      }
    });
  } catch (error) {
    log.error('❌ 删除提交失败:', error);

    if (error.code === 'INVALID_COMMIT') {
      return res.status(400).json({
        success: false,
        error: error.error || '提交哈希不合法'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || '隐藏历史记录失败',
      hint: '此操作现在只会隐藏 Git 管理页里的历史记录，不会删除或修改当前工作区文件'
    });
  }
});

// ==================== 创建本地压缩包备份 ====================
router.post('/backup/archive', requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;

    log.debug('📦 开始创建本地压缩包备份:', { name });

    // 1. 生成备份文件名（使用时间戳）
    const now = new Date();
    const shanghaiFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const timestampParts = shanghaiFormatter.formatToParts(now);
    const getPart = (type) => timestampParts.find(part => part.type === type)?.value || '00';
    const timestamp = `${getPart('year')}-${getPart('month')}-${getPart('day')}_${getPart('hour')}-${getPart('minute')}-${getPart('second')}`;
    const backupName = sanitizeArchiveBackupName(name, `${timestamp}备份`);
    const backupFileName = `${backupName}.tar.gz`;

    // 2. 设置备份文件路径（保存在项目根目录下的“本地备份”文件夹）
    const projectRoot = PROJECT_ROOT;
    const backupDir = path.join(projectRoot, '本地备份');
    const backupFilePath = path.join(backupDir, backupFileName);

    log.debug('📁 项目根目录:', projectRoot);
    log.debug('📁 备份目录:', backupDir);

    // 3. 确保备份目录存在
    await fs.mkdir(backupDir, { recursive: true });

    // 4. 记录当前工作区状态。压缩包直接打包当前工作区，不自动提交代码。
    const statusResult = await execPromise('git status --porcelain');
    const hasChanges = statusResult.stdout.trim().length > 0;

    // 5. 创建压缩包备份（只打包核心项目文件）
    log.debug('🗜️  创建核心项目压缩包...');
    const archiveItems = ['frontend', 'package.json'];

    const backendItems = [
      'backend/src',
      'backend/package.json',
      'backend/package-lock.json',
      'backend/server.js',
      'backend/start-server.js',
      'backend/restart.sh',
      'backend/ecosystem.config.js',
      'backend/ecosystem.production.js',
      'backend/database',
      'backend/migrations',
      'backend/.env.example'
    ];

    backendItems.forEach((item) => {
      if (fsSync.existsSync(path.join(projectRoot, item))) {
        archiveItems.push(item);
      }
    });

    const optionalRootItems = ['package-lock.json', 'ecosystem.config.js', 'shared'];
    optionalRootItems.forEach((item) => {
      if (fsSync.existsSync(path.join(projectRoot, item))) {
        archiveItems.push(item);
      }
    });

    const excludePatterns = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.DS_Store',
      '*.log',
      'uploads',
      '.vite',
      '.frontend.pid',
      '.eslintrc.js',
      '本地备份',
      'ssl',
      '.claude',
      'restart-backend.sh',
      'force-sync-permissions.js',
      'fix_time_literals.py',
      'router-guards-fix.patch',
      'public/quick-fix.js',
      'backend/logs',
      'backend/uploads',
      'backend/*.pid',
      'backend/migrations/*.pid',
      'backend/*.traineddata',
      'backend/.env',
      'backend/.env.production',
      'backend/.env.production-fixed',
      'backend/.env.production-separated',
      'backend/database/*.db',
      'backend/scripts/*.json',
      'backend/.DS_Store'
    ];

    // 构建 tar 命令的排除参数
    const excludeArgs = excludePatterns.map(pattern => `--exclude="${pattern}"`).join(' ');
    const includeArgs = archiveItems.map(item => `"${item}"`).join(' ');

    // 使用 tar 创建压缩包
    try {
      execSync(`tar ${excludeArgs} -czf "${backupFilePath}" ${includeArgs}`, {
        cwd: projectRoot,
        stdio: 'pipe',
        timeout: 120000 // 2分钟超时
      });
      log.debug('✅ 压缩包创建成功');
    } catch (error) {
      log.debug('⚠️  tar 命令出现问题:', error.message);
      // tar 不可用或出错，使用简化方案：只备份核心目录
      log.debug('📦 使用简化方案：只备份核心文件...');
      try {
        execSync(
          `tar --exclude='node_modules' --exclude='.git' --exclude='uploads' -czf "${backupFilePath}" ${includeArgs}`,
          {
            cwd: projectRoot,
            stdio: 'pipe',
            timeout: 60000
          }
        );
        log.debug('✅ 核心文件压缩包创建成功');
      } catch (err) {
        throw new Error('无法创建压缩包: ' + err.message);
      }
    }

    // 6. 获取备份文件大小
    const stats = await fs.stat(backupFilePath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    // 7. 获取当前 Git 提交信息
    let gitInfo = {};
    try {
      const logResult = await execPromise('git log -1 --pretty=format:"%H|%s|%ai|%an"');
      const [hash, subject, date, author] = logResult.stdout.trim().split('|');
      gitInfo = {
        hash: hash.substring(0, 8),
        message: subject,
        date: date,
        author: author
      };
    } catch (error) {
      log.debug('⚠️  无法获取 Git 信息');
    }

    log.debug('✅ 本地压缩包备份创建成功:', {
      fileName: backupFileName,
      filePath: backupFilePath,
      fileSize: `${fileSizeInMB} MB`,
      hasChanges
    });

    res.json({
      success: true,
      data: {
        message: `本地压缩包备份创建成功 (${fileSizeInMB} MB)`,
        backup: {
          fileName: backupFileName,
          filePath: backupFilePath,
          fileSize: `${fileSizeInMB} MB`,
          fileSizeBytes: stats.size,
          createdAt: now.toISOString(),
          gitInfo: gitInfo,
          hasChanges: hasChanges,
          includedItems: archiveItems,
          type: 'archive'
        }
      }
    });

  } catch (error) {
    log.error('创建本地压缩包备份失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '创建本地压缩包备份失败',
      hint: '请检查磁盘空间和 tar 命令是否可用'
    });
  }
});

// ==================== 创建 Git 分支备份 ====================
router.post('/backup/branch', requireAdmin, async (req, res) => {
  try {
    const { name, message, includeChanges = true } = req.body;

    log.debug('🌿 开始创建 Git 分支备份:', { name, includeChanges });
    const backup = await createBranchBackupSnapshot({
      name,
      message,
      includeChanges,
      returnToOriginal: true
    });

    log.debug('✅ Git 分支备份创建成功:', {
      branch: backup.backupBranch,
      commit: backup.commit.hash.substring(0, 8),
      hasChanges: backup.hasChanges
    });

    res.json({
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
    });

  } catch (error) {
    log.error('创建 Git 分支备份失败:', error);
    const stderr = error.stderr || error.error || '';

    if (error.code === 'INVALID_BRANCH') {
      return res.status(400).json({
        success: false,
        error: error.error || '备份分支名称不合法'
      });
    }

    if (error.code === 'BRANCH_EXISTS') {
      return res.status(409).json({
        success: false,
        error: error.error,
        hint: '请使用新的备份名称后重试。',
        code: 'BRANCH_EXISTS'
      });
    }

    if (stderr.includes('would be overwritten by checkout')) {
      return res.status(409).json({
        success: false,
        error: '当前改动阻止了备份分支切换',
        hint: '请先处理未提交改动，或刷新后重试 Git 分支备份。',
        code: 'UNCOMMITTED_CHANGES'
      });
    }

    res.status(500).json({
      success: false,
      error: error.error || '创建 Git 分支备份失败',
      hint: '请检查 Git 仓库状态和权限',
      details: {
        stderr: error.stderr,
        code: error.code
      }
    });
  }
});

router.post('/restore-main', requireAdmin, async (req, res) => {
  try {
    const targetBranch = 'main';
    const headState = await getHeadState();
    const { stdout: statusOutput } = await execGitCommand('git status --porcelain');
    const hasChanges = statusOutput.trim().length > 0;
    const stashName = `auto-restore-main-${Date.now()}`;
    let stashed = false;
    let movedGeneratedFiles = [];

    if (!headState.detached && headState.branch === targetBranch) {
      return res.json({
        success: true,
        data: {
          message: hasChanges ? '当前已经在 main，最新未提交代码已保留，无需恢复' : '当前已经在 main，且工作区干净',
          branch: targetBranch,
          hasChanges
        }
      });
    }

    let sourceBranch = null;
    let snapshotBranch = null;

    if (headState.detached || hasChanges) {
      const backup = await createBranchBackupSnapshot({
        name: buildBackupBranchName(),
        message: `🌿 自动恢复主线备份 - ${new Date().toLocaleString('zh-CN')}\n\n修改内容:\n恢复到 main 之前自动保存当前状态。\n\n优化内容:\n自动主线恢复流程`,
        includeChanges: true,
        returnToOriginal: false
      });
      sourceBranch = backup.backupBranch;
      snapshotBranch = backup.backupBranch;
    } else if (headState.branch && headState.branch !== targetBranch) {
      sourceBranch = headState.branch;
    }

    const { stdout: residualStatus } = await execGitCommand('git status --porcelain --untracked-files=all');
    if (residualStatus.trim()) {
      await execGitArgs(['stash', 'push', '--include-untracked', '-m', stashName]);
      stashed = true;
    }

    movedGeneratedFiles = await checkoutMainWithGeneratedFileRetry(targetBranch);

    let merged = false;
    if (sourceBranch && sourceBranch !== targetBranch) {
      try {
        await execGitArgs(['merge', '--no-ff', '--no-edit', sourceBranch]);
        merged = true;
      } catch (error) {
        await execGitCommand('git merge --abort').catch(() => {});
        return res.status(409).json({
          success: false,
          error: '已回到 main，但当前最新代码未能自动合并到主线',
          hint: `你的代码已经安全保存在分支 ${sourceBranch}。请后续手动将该分支合并到 main。`,
          code: 'MERGE_CONFLICT',
          data: {
            backupBranch: sourceBranch,
            snapshotBranch
          }
        });
      }
    }

    let appliedStash = false;
    if (stashed) {
      try {
        await execGitCommand('git stash apply');
        await execGitCommand('git stash drop');
        appliedStash = true;
      } catch (error) {
        return res.status(409).json({
          success: false,
          error: '已切回 main，但还有一部分未跟踪文件未能自动恢复',
          hint: `你的最新代码已经保存在分支 ${sourceBranch || headState.branch || targetBranch}，剩余文件仍安全保存在 stash 中，请后续手动处理。`,
          code: 'STASH_APPLY_CONFLICT',
          data: {
            backupBranch: sourceBranch || null,
            snapshotBranch,
            stashName
          }
        });
      }
    }

    return res.json({
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
    });
  } catch (error) {
    log.error('恢复到 main 失败:', error);
    const stderr = error.stderr || error.error || '';

    if (stderr.includes('would be overwritten by checkout')) {
      return res.status(409).json({
        success: false,
        error: '切换到 main 时被 Git 阻止，但你的最新代码没有丢失',
        hint: '系统已尽量保留当前代码。请重试一次；如果仍失败，我会继续把恢复逻辑改成更保守的方式。',
        code: 'CHECKOUT_BLOCKED',
        details: {
          stderr: error.stderr,
          code: error.code
        }
      });
    }

    res.status(500).json({
      success: false,
      error: error.error || '恢复到 main 失败',
      hint: '请检查 Git 仓库状态后重试',
      details: {
        stderr: error.stderr,
        code: error.code
      }
    });
  }
});

module.exports = router;
