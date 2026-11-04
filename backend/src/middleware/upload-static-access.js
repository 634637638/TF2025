const path = require('node:path')

const PRIVATE_UPLOAD_ROOTS = new Set([
  'guide',
  'import',
  'rentals',
  'repairs',
  'shared',
  'subsidy',
  'temp'
])

const decodeUploadPath = value => {
  let decoded = String(value || '').split(/[?#]/, 1)[0]

  for (let index = 0; index < 3; index += 1) {
    const next = decodeURIComponent(decoded)
    if (next === decoded) break
    decoded = next
  }

  return decoded.replace(/\\/g, '/')
}

const inspectUploadRequestPath = value => {
  const decodedPath = decodeUploadPath(value)
  const segments = decodedPath.split('/').filter(Boolean)
  const hasParentTraversal = segments.includes('..')
  const normalizedPath = path.posix.normalize(`/${decodedPath}`).replace(/^\/+/, '')
  const normalizedRoot = normalizedPath.split('/').filter(Boolean)[0] || ''

  return {
    hasParentTraversal,
    isPrivate: PRIVATE_UPLOAD_ROOTS.has(normalizedRoot),
    normalizedPath
  }
}

const uploadStaticAccess = (req, res, next) => {
  let inspection

  try {
    inspection = inspectUploadRequestPath(req.url)
  } catch {
    return res.status(404).json({ success: false, message: '资源不存在' })
  }

  if (inspection.hasParentTraversal || inspection.isPrivate) {
    return res.status(404).json({ success: false, message: '资源不存在' })
  }

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')

  next()
}

module.exports = {
  PRIVATE_UPLOAD_ROOTS,
  inspectUploadRequestPath,
  uploadStaticAccess
}
