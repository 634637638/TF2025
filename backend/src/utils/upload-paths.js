const path = require('path');

const DEFAULT_UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const UPLOADS_URL_PREFIX = '/uploads';

function getUploadsRoot() {
  const configuredPath = typeof process.env.UPLOAD_PATH === 'string'
    ? process.env.UPLOAD_PATH.trim()
    : '';

  return configuredPath ? path.resolve(configuredPath) : DEFAULT_UPLOADS_DIR;
}

function getUploadSubdir(...segments) {
  return path.join(getUploadsRoot(), ...segments);
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
    : urlPath.replace(/^\/+/, '');
}

function getUploadPathFromUrl(fileUrl) {
  const relativePath = getRelativeUploadPathFromUrl(fileUrl);
  return relativePath ? path.join(getUploadsRoot(), relativePath) : getUploadsRoot();
}

module.exports = {
  getUploadsRoot,
  getUploadSubdir,
  getUploadUrl,
  getRelativeUploadPathFromUrl,
  getUploadPathFromUrl,
};
