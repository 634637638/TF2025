const log = require('./log');

let schemaReadyPromise = null;
let menuIconSchemaReadyPromise = null;

const ICON_OPTIONAL_COLUMNS = [
  { name: 'svg', definition: 'MEDIUMTEXT NULL' },
  { name: 'iconify_name', definition: 'VARCHAR(150) NULL' },
  { name: 'source', definition: "VARCHAR(30) NOT NULL DEFAULT 'local'" },
  { name: 'is_valid', definition: 'TINYINT(1) NOT NULL DEFAULT 1' },
  { name: 'last_checked_at', definition: 'DATETIME NULL' }
];

function extractIconifyName(iconClass = '') {
  const normalized = String(iconClass || '').trim();
  if (!normalized.startsWith('iconify ')) {
    return null;
  }

  return normalized.replace(/^iconify\s+/, '').trim() || null;
}

function parseIconifyName(iconifyName = '') {
  const normalized = String(iconifyName || '').trim();
  const separatorIndex = normalized.indexOf(':');

  if (separatorIndex <= 0 || separatorIndex === normalized.length - 1) {
    return null;
  }

  return {
    prefix: normalized.slice(0, separatorIndex),
    name: normalized.slice(separatorIndex + 1)
  };
}

function sanitizeSvg(svg = '') {
  const normalized = String(svg || '').trim();
  if (!normalized || !/^<svg[\s>]/i.test(normalized)) {
    return null;
  }

  return normalized
    .replace(/<(script|foreignObject|iframe|object|embed|style|link)\b[\s\S]*?>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|foreignObject|iframe|object|embed|style|link)\b[^>]*\/?\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/\s(?:href|xlink:href)\s*=\s*(['"])(?!#)[\s\S]*?\1/gi, '')
    .replace(/\sjavascript:/gi, '');
}

async function ensureIconSchema(db) {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      const [columns] = await db.execute('SHOW COLUMNS FROM icons');
      const existingColumns = new Set(columns.map((column) => column.Field));

      const classColumn = columns.find((column) => column.Field === 'class');
      if (classColumn?.Collation && classColumn.Collation !== 'utf8mb4_unicode_ci') {
        const type = classColumn.Type || 'varchar(100)';
        const nullable = classColumn.Null === 'NO' ? 'NOT NULL' : 'NULL';
        const defaultClause = classColumn.Default === null || classColumn.Default === undefined
          ? ''
          : ` DEFAULT ${db.escape(classColumn.Default)}`;

        await db.execute(
          `ALTER TABLE icons MODIFY COLUMN class ${type} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ${nullable}${defaultClause}`
        );
      }

      for (const column of ICON_OPTIONAL_COLUMNS) {
        if (!existingColumns.has(column.name)) {
          await db.execute(`ALTER TABLE icons ADD COLUMN ${column.name} ${column.definition}`);
        }
      }
    })().catch((error) => {
      schemaReadyPromise = null;
      log.error('初始化图标表扩展字段失败:', error);
      throw error;
    });
  }

  return schemaReadyPromise;
}

async function ensureMenuIconSchema(db) {
  if (!menuIconSchemaReadyPromise) {
    menuIconSchemaReadyPromise = (async () => {
      const [columns] = await db.execute(
        `SELECT
          COLUMN_NAME AS Field,
          COLUMN_TYPE AS Type,
          IS_NULLABLE AS \`Null\`,
          COLUMN_DEFAULT AS \`Default\`,
          COLLATION_NAME AS Collation
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?`,
        ['menus', 'icon']
      );
      const iconColumn = columns[0];

      if (!iconColumn) {
        return;
      }

      const type = String(iconColumn.Type || '').toLowerCase();
      const varcharMatch = type.match(/^varchar\((\d+)\)/);
      if (!varcharMatch) {
        return;
      }

      const currentLength = Number(varcharMatch[1]);
      if (currentLength >= 255) {
        return;
      }

      const nullable = iconColumn.Null === 'NO' ? 'NOT NULL' : 'NULL';
      const defaultClause = iconColumn.Default === null || iconColumn.Default === undefined
        ? ''
        : ` DEFAULT ${db.escape(iconColumn.Default)}`;

      await db.execute(
        `ALTER TABLE menus MODIFY COLUMN icon VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ${nullable}${defaultClause}`
      );
    })().catch((error) => {
      menuIconSchemaReadyPromise = null;
      log.error('初始化菜单图标字段失败:', error);
      throw error;
    });
  }

  return menuIconSchemaReadyPromise;
}

async function fetchIconifySvg(iconifyName, timeout = 10000) {
  const parsed = parseIconifyName(iconifyName);
  if (!parsed) {
    return null;
  }

  const encodedPrefix = encodeURIComponent(parsed.prefix);
  const encodedName = parsed.name.split('/').map(encodeURIComponent).join('/');
  const apiUrl = `https://api.iconify.design/${encodedPrefix}/${encodedName}.svg`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Accept: 'image/svg+xml,text/plain,*/*'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Iconify SVG 请求失败: ${response.status}`);
    }

    return sanitizeSvg(await response.text());
  } finally {
    clearTimeout(timer);
  }
}

function iconJoinSelect(menuAlias = 'm', iconAlias = 'i') {
  return `
    ${menuAlias}.*,
    ${menuAlias}.is_active as status,
    ${iconAlias}.svg as icon_svg,
    ${iconAlias}.source as icon_source,
    ${iconAlias}.is_valid as icon_is_valid
  `;
}

function iconLeftJoin(menuAlias = 'm', iconAlias = 'i') {
  return `LEFT JOIN icons ${iconAlias}
    ON ${iconAlias}.class COLLATE utf8mb4_unicode_ci = ${menuAlias}.icon COLLATE utf8mb4_unicode_ci
    AND (${iconAlias}.is_valid IS NULL OR ${iconAlias}.is_valid = 1)`;
}

module.exports = {
  ensureIconSchema,
  ensureMenuIconSchema,
  extractIconifyName,
  fetchIconifySvg,
  iconJoinSelect,
  iconLeftJoin,
  sanitizeSvg
};
