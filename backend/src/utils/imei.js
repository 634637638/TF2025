const normalizeImei = (value) => String(value || '').trim().toUpperCase();

const isStandardImei = (value) => /^\d{15}$/.test(normalizeImei(value));

const isNoImeiDevice = (imei, serialNumber) => {
  const normalizedImei = normalizeImei(imei);
  const normalizedSerialNumber = normalizeImei(serialNumber);
  return Boolean(normalizedImei) && normalizedImei === normalizedSerialNumber && normalizedImei.length >= 4;
};

const validateImei = (imei, serialNumber) => {
  const normalizedImei = normalizeImei(imei);
  const normalizedSerialNumber = normalizeImei(serialNumber);

  if (!normalizedImei) {
    return { valid: false, normalizedImei, normalizedSerialNumber, reason: 'IMEI不能为空' };
  }

  if (isStandardImei(normalizedImei) || isNoImeiDevice(normalizedImei, normalizedSerialNumber)) {
    return { valid: true, normalizedImei, normalizedSerialNumber, isStandardImei: isStandardImei(normalizedImei) };
  }

  return {
    valid: false,
    normalizedImei,
    normalizedSerialNumber,
    reason: 'IMEI必须为15位纯数字，或与序列号相同（无IMEI设备）'
  };
};

module.exports = {
  normalizeImei,
  isStandardImei,
  isNoImeiDevice,
  validateImei
};
