const path = require('path')
const ApiResponse = require('../utils/response')
const { requireAnyPermission } = require('./unified-auth')
const { getRelativeUploadPathFromUrl } = require('../utils/upload-paths')

const TEMP_DIRECTORY_PERMISSIONS = Object.freeze({
  guide: ['guide:upload']
})

const createTempFilePermissionGuard = ({
  permissionFactory = requireAnyPermission,
  getRelativePath = getRelativeUploadPathFromUrl
} = {}) => (req, res, next) => {
  const files = Array.isArray(req.body?.files) ? req.body.files : []
  const directories = new Set()

  for (const fileUrl of files) {
    const relativePath = getRelativePath(fileUrl)
    const directory = relativePath.split('/')[0]
    if (!Object.hasOwn(TEMP_DIRECTORY_PERMISSIONS, directory)) {
      return ApiResponse.error(res, '该目录不允许通过临时文件接口删除', 403)
    }

    const expectedPrefix = `draft_${Number(req.user?.id)}_`
    if (directory === 'guide' && !path.basename(relativePath).startsWith(expectedPrefix)) {
      return ApiResponse.error(res, '导航正式文件不允许通过临时接口删除', 403)
    }
    directories.add(directory)
  }

  const pendingDirectories = [...directories]
  const verifyNextDirectory = index => {
    if (index >= pendingDirectories.length) return next()
    const permissions = TEMP_DIRECTORY_PERMISSIONS[pendingDirectories[index]]
    return permissionFactory(permissions)(req, res, () => verifyNextDirectory(index + 1))
  }

  return verifyNextDirectory(0)
}

module.exports = createTempFilePermissionGuard
module.exports.createTempFilePermissionGuard = createTempFilePermissionGuard
module.exports.TEMP_DIRECTORY_PERMISSIONS = TEMP_DIRECTORY_PERMISSIONS
