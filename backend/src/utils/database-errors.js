const DATABASE_AVAILABILITY_ERROR_CODES = new Set([
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
  'POOL_CLOSED'
]);

const isDatabaseAvailabilityError = (error) => {
  if (!error) {
    return false;
  }

  if (DATABASE_AVAILABILITY_ERROR_CODES.has(error.code)) {
    return true;
  }

  const message = String(error.message || '');
  return message.includes('连接池为空') ||
    message.includes('Pool is closed') ||
    message.includes('read ETIMEDOUT') ||
    message.includes('connect ETIMEDOUT');
};

module.exports = {
  DATABASE_AVAILABILITY_ERROR_CODES,
  isDatabaseAvailabilityError
};
