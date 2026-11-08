'use strict'

const GIT_BRANCH_NAME_PATTERN = /^(?!-)(?!.*\.\.)(?!.*\/\/)(?!.*@\{)(?!.*\\)(?!.*\.$)[A-Za-z0-9._/-]{1,120}$/

const normalizeBranchName = (branch, fieldName = '分支名称') => {
  const normalizedBranch = String(branch || '').trim()
  if (!GIT_BRANCH_NAME_PATTERN.test(normalizedBranch)) {
    throw Object.assign(new Error(`${fieldName}不合法`), {
      error: `${fieldName}不合法`,
      code: 'INVALID_BRANCH'
    })
  }
  return normalizedBranch
}

module.exports = { GIT_BRANCH_NAME_PATTERN, normalizeBranchName }
