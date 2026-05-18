const fs = require('fs');
const path = require('path');

const DEFAULT_LOGS_DIR = path.resolve(__dirname, '../../logs');

function getLogsRoot() {
  const configuredPath = typeof process.env.LOG_PATH === 'string'
    ? process.env.LOG_PATH.trim()
    : '';

  return configuredPath ? path.resolve(configuredPath) : DEFAULT_LOGS_DIR;
}

function getLogSubdir(...segments) {
  return path.join(getLogsRoot(), ...segments);
}

function ensureLogDir(...segments) {
  const dirPath = getLogSubdir(...segments);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

module.exports = {
  getLogsRoot,
  getLogSubdir,
  ensureLogDir,
};
