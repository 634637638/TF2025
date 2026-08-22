const { getDatabase } = require('../config/database');

let ensurePromise = null;

async function ensureRentalSchema() {
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    const db = getDatabase();
    const [columns] = await db.query('SHOW COLUMNS FROM rentals');
    const existing = new Set(columns.map(column => column.Field));
    const additions = [
      ['contract_number', 'VARCHAR(32) NULL AFTER id'],
      ['billing_mode', "ENUM('daily','monthly','buyout') NOT NULL DEFAULT 'buyout' AFTER customer_id"],
      ['unit_price', 'DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER billing_mode'],
      ['term_months', 'TINYINT UNSIGNED NULL AFTER unit_price'],
      ['sale_price', 'DECIMAL(10,2) NULL AFTER term_months'],
      ['down_payment', 'DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER sale_price'],
      ['principal_amount', 'DECIMAL(10,2) NULL AFTER down_payment'],
      ['monthly_rent', 'DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER principal_amount'],
      ['returned_at', 'DATETIME NULL AFTER end_date'],
      ['monitoring_lock', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER term_months'],
      ['sale_id', 'INT NULL AFTER operator_id']
    ];

    for (const [name, definition] of additions) {
      if (!existing.has(name)) {
        await db.query(`ALTER TABLE rentals ADD COLUMN ${name} ${definition}`);
      }
    }

    await db.query(`UPDATE rentals SET contract_number = CONCAT(
      CASE WHEN billing_mode IN ('buyout','monthly') THEN 'MD' ELSE 'ZL' END,
      DATE_FORMAT(COALESCE(start_date, created_at, CURDATE()), '%Y%m%d'),
      CASE WHEN id < 10000 THEN LPAD(id, 4, '0') ELSE CAST(id AS CHAR) END
    ) WHERE contract_number IS NULL OR contract_number='' OR contract_number REGEXP '^(MD|ZL)0[0-9]{7}$'`);
    const [contractIndexes] = await db.query("SHOW INDEX FROM rentals WHERE Key_name='uk_rentals_contract_number'");
    if (!contractIndexes.length) {
      await db.query('ALTER TABLE rentals ADD UNIQUE KEY uk_rentals_contract_number (contract_number)');
    }

    const [billingModeColumns] = await db.query("SHOW COLUMNS FROM rentals LIKE 'billing_mode'");
    const billingModeType = String(billingModeColumns[0]?.Type || '');
    if (billingModeType.startsWith('enum(') && !billingModeType.includes("'buyout'")) {
      const values = [...billingModeType.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(match => match[1]);
      values.push('buyout');
      const enumSql = values.map(value => `'${value.replace(/'/g, "''")}'`).join(',');
      await db.query(`ALTER TABLE rentals MODIFY COLUMN billing_mode ENUM(${enumSql}) NOT NULL DEFAULT 'buyout'`);
    }

    const [rentalStatusColumns] = await db.query("SHOW COLUMNS FROM rentals LIKE 'status'");
    const rentalStatusType = String(rentalStatusColumns[0]?.Type || '');
    if (rentalStatusType.startsWith('enum(') && !rentalStatusType.includes("'bought_out'")) {
      const values = [...rentalStatusType.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(match => match[1]);
      values.push('bought_out');
      const enumSql = values.map(value => `'${value.replace(/'/g, "''")}'`).join(',');
      await db.query(`ALTER TABLE rentals MODIFY COLUMN status ENUM(${enumSql}) NOT NULL DEFAULT 'active'`);
    }

    const [saleIndexes] = await db.query("SHOW INDEX FROM rentals WHERE Key_name='idx_rentals_sale'");
    if (!saleIndexes.length) {
      await db.query('ALTER TABLE rentals ADD INDEX idx_rentals_sale (sale_id)');
    }

    const [salesColumns] = await db.query('SHOW COLUMNS FROM sales');
    const salesColumnNames = new Set(salesColumns.map(column => column.Field));
    if (!salesColumnNames.has('payment_channel')) {
      await db.query("ALTER TABLE sales ADD COLUMN payment_channel VARCHAR(64) NULL AFTER payment_method");
    }

    await db.query(`CREATE TABLE IF NOT EXISTS rental_contract_files (
      id INT PRIMARY KEY AUTO_INCREMENT,
      rental_id INT NOT NULL,
      file_url VARCHAR(500) NOT NULL,
      file_name VARCHAR(255) NULL,
      uploaded_by INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_rental_contract_files_rental (rental_id),
      CONSTRAINT fk_rental_contract_files_rental FOREIGN KEY (rental_id) REFERENCES rentals(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await db.query(`CREATE TABLE IF NOT EXISTS rental_payments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      rental_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      period_number TINYINT UNSIGNED NULL,
      paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      operator_id INT NOT NULL,
      remarks VARCHAR(255) NULL,
      INDEX idx_rental_payments_rental (rental_id),
      UNIQUE KEY uk_rental_payment_period (rental_id, period_number),
      CONSTRAINT fk_rental_payments_rental FOREIGN KEY (rental_id) REFERENCES rentals(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    const [paymentColumns] = await db.query('SHOW COLUMNS FROM rental_payments');
    const paymentColumnNames = new Set(paymentColumns.map(column => column.Field));
    if (!paymentColumnNames.has('period_number')) {
      await db.query('ALTER TABLE rental_payments ADD COLUMN period_number TINYINT UNSIGNED NULL AFTER amount');
    }
    if (!paymentColumnNames.has('payment_type')) {
      await db.query("ALTER TABLE rental_payments ADD COLUMN payment_type ENUM('down_payment','installment','daily') NOT NULL DEFAULT 'installment' AFTER period_number");
    }
    const [paymentIndexes] = await db.query("SHOW INDEX FROM rental_payments WHERE Key_name='uk_rental_payment_period'");
    if (!paymentIndexes.length) {
      await db.query('ALTER TABLE rental_payments ADD UNIQUE KEY uk_rental_payment_period (rental_id, period_number)');
    }

    const [statusColumns] = await db.query("SHOW COLUMNS FROM phones LIKE 'status'");
    const statusType = String(statusColumns[0]?.Type || '');
    if (statusType.startsWith('enum(') && !statusType.includes("'rented'")) {
      const values = [...statusType.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(match => match[1]);
      values.push('rented');
      const enumSql = values.map(value => `'${value.replace(/'/g, "''")}'`).join(',');
      await db.query(`ALTER TABLE phones MODIFY COLUMN status ENUM(${enumSql}) DEFAULT 'in_stock'`);
    }
  })().catch(error => {
    ensurePromise = null;
    throw error;
  });

  return ensurePromise;
}

module.exports = { ensureRentalSchema };
