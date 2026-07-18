const path = require('path');

const DEFAULT_UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const UPLOADS_URL_PREFIX = '/uploads';

function getUploadsRoot() {
  const configuredPath = typeof process.env.UPLOAD_PATH === 'string'
    ? process.env.UPLOAD_PATH.trim()
    : '';

  return configuredPath ? path.resolve(configuredPath) : DEFAULT_UPLOADS_DIR;
}

function resolveWithinUploads(...segments) {
  const uploadsRoot = path.resolve(getUploadsRoot());
  const resolvedPath = path.resolve(uploadsRoot, ...segments.map(segment => String(segment || '')));
  const relativePath = path.relative(uploadsRoot, resolvedPath);

  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    if (!relativePath && segments.length === 0) {
      return uploadsRoot;
    }
    throw new Error('文件路径超出上传目录');
  }

  return resolvedPath;
}

function getUploadSubdir(...segments) {
  return segments.length > 0 ? resolveWithinUploads(...segments) : path.resolve(getUploadsRoot());
}

function getUploadUrl(...segments) {
  const normalized = segments
    .filter(segment => segment !== undefined && segment !== null && segment !== '')
    .map(segment => String(segment).replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);

  return normalized.length > 0
    ? `${UPLOADS_URL_PREFIX}/${normalized.join('/')}`
    : UPLOADS_URL_PREFIX;
}

function getRelativeUploadPathFromUrl(fileUrl) {
  if (typeof fileUrl !== 'string' || !fileUrl.trim()) {
    return '';
  }

  const urlObj = new URL(fileUrl, 'http://localhost');
  const urlPath = urlObj.pathname.replace(/\\/g, '/');

  return urlPath.startsWith(`${UPLOADS_URL_PREFIX}/`)
    ? urlPath.slice(`${UPLOADS_URL_PREFIX}/`.length)
    : '';
}

function getUploadPathFromUrl(fileUrl) {
  const relativePath = getRelativeUploadPathFromUrl(fileUrl);
  if (!relativePath) {
    throw new Error('无效的上传文件 URL');
  }
  return resolveWithinUploads(relativePath);
}

module.exports = {
  getUploadsRoot,
  getUploadSubdir,
  getUploadUrl,
  getRelativeUploadPathFromUrl,
  getUploadPathFromUrl,
};
