const { getDatabase } = require('../config/database');
const { hasColumn, hasTable } = require('./schemaInspector.service');
const log = require('../utils/log');

const POINTS_CONFIG_KEY = 'customer_points_config';

const DEFAULT_POINTS_CONFIG = Object.freeze({
  enabled: true,
  amount_per_point: 100,
  include_new: true,
  include_used: true
});

const RETAIL_SALE_TYPES = new Set(['', 'retail', 'sale', 'normal', 'batch', 'batch_item']);

const normalizeBoolean = (value, fallback = true) => {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (['true', 'yes', 'on'].includes(lowered)) return true;
    if (['false', 'no', 'off'].includes(lowered)) return false;
  }
  return fallback;
};

const normalizePointsConfig = (config = {}) => {
  const amountPerPoint = Number(config.amount_per_point);

  return {
    enabled: normalizeBoolean(config.enabled, DEFAULT_POINTS_CONFIG.enabled),
    amount_per_point: Number.isFinite(amountPerPoint) && amountPerPoint > 0
      ? amountPerPoint
      : DEFAULT_POINTS_CONFIG.amount_per_point,
    include_new: normalizeBoolean(config.include_new, DEFAULT_POINTS_CONFIG.include_new),
    include_used: normalizeBoolean(config.include_used, DEFAULT_POINTS_CONFIG.include_used)
  };
};

const parseStoredConfig = (rawValue) => {
  if (!rawValue) return DEFAULT_POINTS_CONFIG;

  try {
    const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
    return normalizePointsConfig(parsed);
  } catch (error) {
    log.warn('客户积分配置解析失败，使用默认配置:', error.message);
    return DEFAULT_POINTS_CONFIG;
  }
};

const resolveSettingsColumns = async (executor) => {
  const db = executor || getDatabase();
  const settingsExists = await hasTable('settings', db);
  if (!settingsExists) return null;

  const hasKeyName = await hasColumn('settings', 'key_name', db);
  const hasValue = await hasColumn('settings', 'value', db);
  if (hasKeyName && hasValue) {
    return {
      keyColumn: 'key_name',
      valueColumn: 'value',
      typeColumn: await hasColumn('settings', 'type', db) ? 'type' : null,
      descriptionColumn: await hasColumn('settings', 'description', db) ? 'description' : null
    };
  }

  const hasSettingKey = await hasColumn('settings', 'setting_key', db);
  const hasSettingValue = await hasColumn('settings', 'setting_value', db);
  if (hasSettingKey && hasSettingValue) {
    return {
      keyColumn: 'setting_key',
      valueColumn: 'setting_value',
      typeColumn: await hasColumn('settings', 'setting_type', db) ? 'setting_type' : null,
      descriptionColumn: await hasColumn('settings', 'description', db) ? 'description' : null
    };
  }

  return null;
};

const getCustomerPointsConfig = async (executor = null) => {
  const db = executor || getDatabase();
  const columns = await resolveSettingsColumns(db);

  if (!columns) {
    return normalizePointsConfig();
  }

  const [rows] = await db.execute(
    `SELECT ${columns.valueColumn} AS config_value
     FROM settings
     WHERE ${columns.keyColumn} = ?
     LIMIT 1`,
    [POINTS_CONFIG_KEY]
  );

  return rows.length > 0
    ? parseStoredConfig(rows[0].config_value)
    : normalizePointsConfig();
};

const saveCustomerPointsConfig = async (config, executor = null) => {
  const db = executor || getDatabase();
  const columns = await resolveSettingsColumns(db);

  if (!columns) {
    throw new Error('settings表缺少可用的键值字段，无法保存客户积分设置');
  }

  const normalizedConfig = normalizePointsConfig(config);
  const storedValue = JSON.stringify(normalizedConfig);

  const [existingRows] = await db.execute(
    `SELECT id FROM settings WHERE ${columns.keyColumn} = ? LIMIT 1`,
    [POINTS_CONFIG_KEY]
  );

  if (existingRows.length > 0) {
    const updates = [`${columns.valueColumn} = ?`];
    const params = [storedValue];

    if (columns.typeColumn) {
      updates.push(`${columns.typeColumn} = ?`);
      params.push('json');
    }

    if (columns.descriptionColumn) {
      updates.push(`${columns.descriptionColumn} = ?`);
      params.push('客户积分自动累计规则');
    }

    params.push(POINTS_CONFIG_KEY);
    await db.execute(
      `UPDATE settings SET ${updates.join(', ')} WHERE ${columns.keyColumn} = ?`,
      params
    );
  } else {
    const insertColumns = [columns.keyColumn, columns.valueColumn];
    const placeholders = ['?', '?'];
    const params = [POINTS_CONFIG_KEY, storedValue];

    if (columns.typeColumn) {
      insertColumns.push(columns.typeColumn);
      placeholders.push('?');
      params.push('json');
    }

    if (columns.descriptionColumn) {
      insertColumns.push(columns.descriptionColumn);
      placeholders.push('?');
      params.push('客户积分自动累计规则');
    }

    await db.execute(
      `INSERT INTO settings (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`,
      params
    );
  }

  return normalizedConfig;
};

const isRetailSaleType = (saleType) => RETAIL_SALE_TYPES.has(String(saleType || '').trim().toLowerCase());

const isEligiblePhoneCondition = (isNew, config) => {
  const isNewPhone = Number(isNew) === 1;
  return isNewPhone ? config.include_new : config.include_used;
};

const calculateCustomerPointsForSale = ({ phones = [], saleType = '', config = DEFAULT_POINTS_CONFIG }) => {
  const normalizedConfig = normalizePointsConfig(config);

  if (!normalizedConfig.enabled || !isRetailSaleType(saleType)) {
    return {
      points: 0,
      eligibleAmount: 0,
      amountPerPoint: normalizedConfig.amount_per_point
    };
  }

  const eligibleAmount = phones.reduce((sum, phone) => {
    if (!isEligiblePhoneCondition(phone.is_new, normalizedConfig)) {
      return sum;
    }
    return sum + (Number(phone.price) || 0);
  }, 0);

  return {
    points: Math.floor(eligibleAmount / normalizedConfig.amount_per_point),
    eligibleAmount,
    amountPerPoint: normalizedConfig.amount_per_point
  };
};

module.exports = {
  DEFAULT_POINTS_CONFIG,
  getCustomerPointsConfig,
  saveCustomerPointsConfig,
  calculateCustomerPointsForSale
};
