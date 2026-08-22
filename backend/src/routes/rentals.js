const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const router = express.Router();
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth');
const { getDatabase } = require('../config/database');
const ApiResponse = require('../utils/response');
const log = require('../utils/log');
const { ensureRentalSchema } = require('../utils/rental-schema');
const { getUploadSubdir, getUploadUrl, getUploadPathFromUrl } = require('../utils/upload-paths');
const { isValidIdCard } = require('../utils/security-enhanced');
const { generateInvoiceNumber } = require('../utils/invoice-number');

router.use(unifiedAuth);

const ADMIN_ROLE_CODES = new Set(['super_admin', 'webadmin', 'admin']);
const isAdministrator = req => (req.user?.role_codes || []).some(code => ADMIN_ROLE_CODES.has(String(code).toLowerCase()));
const positiveMoney = value => Number.isFinite(Number(value)) && Number(value) >= 0;
const validPhone = value => /^1[3-9]\d{9}$/.test(String(value || '').trim());
const isBuyoutMode = value => ['buyout', 'monthly'].includes(String(value || ''));
const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const getPrincipalAmount = (salePrice, downPayment) => roundMoney(Math.max(Number(salePrice || 0) - Number(downPayment || 0), 0));
const getInstallmentAmount = (principal, monthlyRent, termMonths, periodNumber) => {
  const term = Math.max(Number(termMonths || 1), 1);
  const basePrincipal = roundMoney(Number(principal || 0) / term);
  const principalDue = Number(periodNumber) === term
    ? roundMoney(Number(principal || 0) - basePrincipal * (term - 1))
    : basePrincipal;
  return roundMoney(principalDue + Number(monthlyRent || 0));
};
const getContractNumber = (billingMode, startDate, rentalId) => {
  const datePart = String(startDate || '').replace(/-/g, '').slice(0, 8);
  return `${isBuyoutMode(billingMode) ? 'MD' : 'ZL'}${datePart}${String(rentalId).padStart(4, '0')}`;
};
const addMonthsClamped = (dateText, monthOffset) => {
  const [year, month, day] = String(dateText).split('-').map(Number);
  const targetMonthIndex = month - 1 + monthOffset;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
};
const contractUploadDir = getUploadSubdir('rentals', 'contracts');
fs.mkdirSync(contractUploadDir, { recursive: true });
const contractUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, contractUploadDir),
    filename: (req, file, cb) => cb(null, `${req.params.id}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, cb) => {
    const allowed = /^image\//.test(file.mimetype) || file.mimetype === 'application/pdf';
    cb(allowed ? null : new Error('仅支持图片或PDF合同文件'), allowed);
  }
});

const listSelect = `
  SELECT r.id, r.contract_number, r.phone_id, r.customer_id, r.billing_mode, r.unit_price,
         r.term_months, r.sale_price, r.down_payment, r.principal_amount, r.monthly_rent,
         CASE WHEN r.billing_mode IN ('buyout','monthly') THEN
           ROUND(COALESCE(r.principal_amount, COALESCE(r.sale_price, r.unit_price * COALESCE(r.term_months,1)) - COALESCE(r.down_payment,0)) / NULLIF(r.term_months,0), 2)
           ELSE NULL END AS monthly_principal,
         CASE WHEN r.billing_mode IN ('buyout','monthly') THEN
           ROUND(ROUND(COALESCE(r.principal_amount, COALESCE(r.sale_price, r.unit_price * COALESCE(r.term_months,1)) - COALESCE(r.down_payment,0)) / NULLIF(r.term_months,0), 2) + COALESCE(r.monthly_rent,0), 2)
           ELSE r.unit_price END AS installment_amount,
         r.monitoring_lock, DATE_FORMAT(r.start_date, '%Y-%m-%d') AS start_date,
         DATE_FORMAT(r.end_date, '%Y-%m-%d') AS end_date,
         DATE_FORMAT(r.returned_at, '%Y-%m-%d %H:%i:%s') AS returned_at,
         r.deposit, r.total_cost, r.status, r.remarks, r.operator_id, r.sale_id,
         DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
         c.name AS customer_name, c.phone AS customer_phone, c.id_card AS customer_id_card,
         p.imei, p.serial_number, p.purchase_cost, p.status AS phone_status,
         b.name AS brand, m.name AS model, co.name AS color, mem.size AS memory,
         s.id AS sale_order_id, s.invoice_number AS sale_invoice_number,
         s.price AS sale_order_price, s.store_id AS sale_store_id,
         s.operator_id AS sale_operator_id, s.payment_method AS sale_payment_method,
         s.payment_channel AS sale_payment_channel, s.remarks AS sale_remarks,
         sale_store.name AS sale_store_name,
         COALESCE(sale_operator.name, sale_operator.username) AS sale_operator_name,
         COALESCE(u.name, u.username) AS operator_name,
         GREATEST(DATEDIFF(COALESCE(DATE(r.returned_at), CURDATE()), r.start_date) + 1, 1) AS rented_days,
         CASE WHEN r.billing_mode = 'daily'
           THEN ROUND(r.unit_price * GREATEST(DATEDIFF(COALESCE(DATE(r.returned_at), CURDATE()), r.start_date) + 1, 1), 2)
           ELSE ROUND(COALESCE(r.sale_price, r.unit_price * COALESCE(r.term_months, 1)), 2)
         END AS accrued_rent,
         COALESCE((SELECT SUM(rp.amount) FROM rental_payments rp WHERE rp.rental_id=r.id),0) AS paid_rent,
         GREATEST(CASE WHEN r.billing_mode = 'daily'
           THEN ROUND(r.unit_price * GREATEST(DATEDIFF(COALESCE(DATE(r.returned_at), CURDATE()), r.start_date) + 1, 1), 2)
           ELSE ROUND(COALESCE(r.sale_price, r.unit_price * COALESCE(r.term_months, 1)), 2)
         END - COALESCE((SELECT SUM(rp.amount) FROM rental_payments rp WHERE rp.rental_id=r.id),0),0) AS payable_rent,
         CASE WHEN r.billing_mode IN ('buyout','monthly') THEN GREATEST(
           COALESCE(r.term_months, 1) - LEAST(
             COALESCE(r.term_months, 1),
             COALESCE((SELECT COUNT(rp.period_number) FROM rental_payments rp WHERE rp.rental_id=r.id AND rp.payment_type='installment'),0)
           ), 0
         ) ELSE NULL END AS remaining_periods
  FROM rentals r
  JOIN customers c ON c.id = r.customer_id
  JOIN phones p ON p.id = r.phone_id
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN models m ON m.id = p.model_id
  LEFT JOIN colors co ON co.id = p.color_id
  LEFT JOIN memories mem ON mem.id = p.memory_id
  LEFT JOIN users u ON u.id = r.operator_id
  LEFT JOIN sales s ON s.id = r.sale_id
  LEFT JOIN stores sale_store ON sale_store.id = s.store_id
  LEFT JOIN users sale_operator ON sale_operator.id = s.operator_id`;

router.get('/customers', requireAnyPermission(['rentals:view', 'rentals:create']), async (req, res) => {
  try {
    const keyword = String(req.query.keyword || '').trim();
    if (keyword.length < 2) return ApiResponse.success(res, [], '获取客户成功');
    const db = getDatabase();
    const like = `%${keyword}%`;
    const [rows] = await db.execute(
      `SELECT id, name, phone, id_card FROM customers
       WHERE status = 1 AND (name LIKE ? OR phone LIKE ?)
       ORDER BY CASE WHEN phone = ? THEN 0 ELSE 1 END, id DESC LIMIT 20`,
      [like, like, keyword]
    );
    return ApiResponse.success(res, rows, '获取客户成功');
  } catch (error) {
    log.error('租赁客户检索失败:', error);
    return ApiResponse.serverError(res, '客户检索失败', error);
  }
});

router.get('/sales-options', requireAnyPermission(['rentals:view', 'rentals:create']), async (_req, res) => {
  try {
    const db = getDatabase();
    const [operators] = await db.execute(
      `SELECT id, username, name FROM users WHERE status=1
       ORDER BY COALESCE(NULLIF(name,''), username), id`
    );
    const [stores] = await db.execute(
      'SELECT id, name FROM stores WHERE status=1 ORDER BY sort_order, name, id'
    );
    return ApiResponse.success(res, { operators, stores }, '获取销售选项成功');
  } catch (error) {
    log.error('获取租赁销售选项失败:', error);
    return ApiResponse.serverError(res, '获取销售选项失败', error);
  }
});

router.post('/customers', requirePermission('rentals:create'), async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const idCard = String(req.body?.id_card || '').trim().toUpperCase();
    if (!name || !validPhone(phone) || !isValidIdCard(idCard)) return ApiResponse.badRequest(res, '请输入客户姓名、正确的手机号码和身份证号');
    const db = getDatabase();
    const [existing] = await db.execute('SELECT id, name, phone FROM customers WHERE phone = ? LIMIT 1', [phone]);
    if (existing.length) {
      await db.execute('UPDATE customers SET name=?,id_card=?,updated_at=NOW() WHERE id=?', [name, idCard, existing[0].id]);
      return ApiResponse.success(res, { ...existing[0], name, id_card: idCard }, '客户已存在，实名信息已更新');
    }
    const [result] = await db.execute(
      `INSERT INTO customers (name, phone, id_card, customer_type, status, source, register_date, created_at, updated_at)
       VALUES (?, ?, ?, 'individual', 1, 'rental', CURDATE(), NOW(), NOW())`,
      [name, phone, idCard]
    );
    return ApiResponse.created(res, '客户创建成功', { id: result.insertId, name, phone, id_card: idCard });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') return ApiResponse.badRequest(res, '手机号已存在');
    log.error('租赁客户创建失败:', error);
    return ApiResponse.serverError(res, '客户创建失败', error);
  }
});

router.put('/customers/:id', requirePermission('rentals:create'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body?.name || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const idCard = String(req.body?.id_card || '').trim().toUpperCase();
    if (!id || !name || !validPhone(phone) || !isValidIdCard(idCard)) {
      return ApiResponse.badRequest(res, '请输入客户姓名、正确的手机号码和身份证号');
    }
    const db = getDatabase();
    const [duplicates] = await db.execute('SELECT id FROM customers WHERE phone=? AND id<>? LIMIT 1', [phone, id]);
    if (duplicates.length) return ApiResponse.badRequest(res, '该手机号已属于其他客户');
    const [result] = await db.execute(
      'UPDATE customers SET name=?,phone=?,id_card=?,updated_at=NOW() WHERE id=? AND status=1',
      [name, phone, idCard, id]
    );
    if (!result.affectedRows) return ApiResponse.notFound(res, '客户不存在或已停用');
    return ApiResponse.success(res, { id, name, phone, id_card: idCard }, '客户资料已更新');
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') return ApiResponse.badRequest(res, '手机号已存在');
    log.error('租赁客户资料更新失败:', error);
    return ApiResponse.serverError(res, '客户资料更新失败', error);
  }
});

router.get('/devices', requireAnyPermission(['rentals:view', 'rentals:create']), async (req, res) => {
  try {
    await ensureRentalSchema();
    const keyword = String(req.query.keyword || '').trim();
    // 默认返回全部可售在库设备，避免下拉列表被固定 30 条截断。
    // 调用方需要分页时传入 page/limit，单页最多 1000 条。
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Math.min(Math.max(requestedLimit || 200, 1), 1000);
    const offset = (page - 1) * limit;
    const db = getDatabase();
    const params = [];
    let searchSql = '';
    if (keyword) {
      const like = `%${keyword}%`;
      searchSql = `AND (
        p.imei LIKE ? OR p.serial_number LIKE ? OR p.purchase_number LIKE ? OR
        b.name LIKE ? OR m.name LIKE ? OR co.name LIKE ? OR mem.size LIKE ? OR st.name LIKE ?
      )`;
      params.push(like, like, like, like, like, like, like, like);
    }
    const paginationSql = hasPagination ? ` LIMIT ${limit} OFFSET ${offset}` : '';
    const [rows] = await db.execute(
      `SELECT p.id, p.imei, p.serial_number, p.purchase_number,
              p.purchase_cost, p.sale_price, p.quality_grade, p.is_new, p.status,
              b.name AS brand, m.name AS model,
              co.name AS color, mem.size AS memory, p.store_id, st.name AS store_name
       FROM phones p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN models m ON m.id = p.model_id
       LEFT JOIN colors co ON co.id = p.color_id
       LEFT JOIN memories mem ON mem.id = p.memory_id
       LEFT JOIN stores st ON st.id = p.store_id
       WHERE p.status = 'in_stock' ${searchSql}
       ORDER BY p.Inventorytime DESC, p.id DESC${paginationSql}`,
      params
    );
    if (hasPagination) {
      return ApiResponse.success(res, rows, '获取可售在库设备成功', 200, {
        pagination: { page, limit, count: rows.length, hasMore: rows.length === limit }
      });
    }
    return ApiResponse.success(res, rows, '获取可售在库设备成功');
  } catch (error) {
    log.error('可租设备检索失败:', error);
    return ApiResponse.serverError(res, '可租设备检索失败', error);
  }
});

router.get('/', requirePermission('rentals:view'), async (req, res) => {
  try {
    await ensureRentalSchema();
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    const keyword = String(req.query.keyword || '').trim();
    if (keyword) {
      const like = `%${keyword}%`;
      conditions.push('(c.name LIKE ? OR c.phone LIKE ? OR p.imei LIKE ? OR p.serial_number LIKE ? OR r.contract_number LIKE ? OR CAST(r.id AS CHAR) LIKE ?)');
      params.push(like, like, like, like, like, like);
    }
    if (req.query.status) {
      conditions.push('r.status = ?');
      params.push(req.query.status);
    }
    if (req.query.billing_mode) {
      if (req.query.billing_mode === 'buyout') {
        conditions.push("r.billing_mode IN ('buyout','monthly')");
      } else {
        conditions.push('r.billing_mode = ?');
        params.push(req.query.billing_mode);
      }
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const db = getDatabase();
    await db.execute("UPDATE rentals SET status='overdue' WHERE status='active' AND billing_mode IN ('buyout','monthly') AND end_date<CURDATE()");
    const [rows] = await db.execute(`${listSelect} ${where} ORDER BY r.id DESC LIMIT ${limit} OFFSET ${offset}`, params);
    for (const row of rows) {
      const [files] = await db.execute('SELECT id,file_url,file_name,created_at FROM rental_contract_files WHERE rental_id=? ORDER BY id DESC', [row.id]);
      row.contract_files = files;
      const [payments] = await db.execute('SELECT period_number FROM rental_payments WHERE rental_id=? AND period_number IS NOT NULL ORDER BY period_number', [row.id]);
      row.paid_period_numbers = payments.map(item => Number(item.period_number));
      if (isBuyoutMode(row.billing_mode)) {
        const paid = new Set(row.paid_period_numbers);
        const nextPeriod = Array.from({ length: Number(row.term_months || 0) }, (_, index) => index + 1).find(number => !paid.has(number));
        row.next_due_date = nextPeriod ? addMonthsClamped(row.start_date, nextPeriod) : null;
      }
    }
    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total FROM rentals r JOIN customers c ON c.id=r.customer_id JOIN phones p ON p.id=r.phone_id ${where}`,
      params
    );
    return ApiResponse.success(res, rows, '获取租赁合同成功', 200, {
      pagination: { page, limit, total: Number(countRows[0]?.total || 0) }
    });
  } catch (error) {
    log.error('获取租赁合同失败:', error);
    return ApiResponse.serverError(res, '获取租赁合同失败', error);
  }
});

router.post('/', requirePermission('rentals:create'), async (req, res) => {
  let connection;
  try {
    await ensureRentalSchema();
    const customerId = Number(req.body?.customer_id);
    const phoneId = Number(req.body?.phone_id);
    const billingMode = req.body?.billing_mode;
    const unitPrice = Number(req.body?.unit_price || 0);
    const salePrice = Number(req.body?.sale_price || 0);
    const downPayment = isBuyoutMode(billingMode) ? Number(req.body?.down_payment || 0) : 0;
    const monthlyRent = isBuyoutMode(billingMode) ? Number(req.body?.monthly_rent || 0) : 0;
    const termMonths = isBuyoutMode(billingMode) ? Number(req.body?.term_months) : null;
    const saleOperatorId = isBuyoutMode(billingMode) ? Number(req.body?.sale_operator_id || req.user.id) : null;
    const saleStoreId = isBuyoutMode(billingMode) ? Number(req.body?.sale_store_id || 0) || null : null;
    const salePaymentMethod = isBuyoutMode(billingMode) ? String(req.body?.sale_payment_method || 'cash') : null;
    const salePaymentChannel = isBuyoutMode(billingMode) ? String(req.body?.sale_payment_channel || '').trim() || null : null;
    const saleTransactionNo = isBuyoutMode(billingMode) ? String(req.body?.sale_transaction_no || '').trim() || null : null;
    const saleRemarks = isBuyoutMode(billingMode) ? String(req.body?.sale_remarks || '').trim() || null : null;
    const startDate = String(req.body?.start_date || '');
    const deposit = Number(req.body?.deposit || 0);
    // 买断合同视为销售出库，不收取押金且默认安装监管锁；按天租赁沿用表单设置。
    const isBuyout = billingMode === 'buyout';
    const monitoringLock = isBuyout ? 1 : (req.body?.monitoring_lock ? 1 : 0);
    if (!customerId || !phoneId || !['daily', 'buyout'].includes(billingMode) || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return ApiResponse.badRequest(res, '请选择客户、租赁设备、计费方式和开始日期');
    }
    if ((!positiveMoney(unitPrice) || unitPrice <= 0) && billingMode === 'daily') return ApiResponse.badRequest(res, '每日租金金额不正确');
    if (!positiveMoney(deposit)) return ApiResponse.badRequest(res, '押金金额不正确');
    if (billingMode === 'buyout' && (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 12)) {
      return ApiResponse.badRequest(res, '到期买断请选择1至12期');
    }
    if (!positiveMoney(salePrice) || salePrice <= 0) return ApiResponse.badRequest(res, '请输入销售价格');
    if (billingMode === 'buyout' && (!positiveMoney(downPayment) || downPayment > salePrice || !positiveMoney(monthlyRent))) {
      return ApiResponse.badRequest(res, '请正确填写销售总价、首付和每月租金');
    }
    if (billingMode === 'buyout' && !['cash', 'mobile', 'bank_card', 'subsidy_card', 'transfer', 'other'].includes(salePaymentMethod)) {
      return ApiResponse.badRequest(res, '请选择有效的支付方式');
    }

    connection = await getDatabase().getConnection();
    await connection.beginTransaction();
    const [customers] = await connection.execute('SELECT id,id_card FROM customers WHERE id=? AND status=1 FOR UPDATE', [customerId]);
    if (!customers.length || !isValidIdCard(String(customers[0].id_card || ''))) throw new Error('客户不存在、已停用或缺少正确身份证号');
    const [phones] = await connection.execute('SELECT id,status,purchase_cost,store_id FROM phones WHERE id=? FOR UPDATE', [phoneId]);
    if (!phones.length || phones[0].status !== 'in_stock') throw new Error('设备已不在库，请重新选择');
    const rawPurchaseCost = req.body?.purchase_cost;
    const purchaseCost = billingMode === 'buyout'
      ? (rawPurchaseCost === undefined || rawPurchaseCost === null || rawPurchaseCost === ''
        ? Number(phones[0].purchase_cost || 0)
        : Number(rawPurchaseCost))
      : Number(phones[0].purchase_cost || 0);
    if (billingMode === 'buyout' && !positiveMoney(purchaseCost)) throw new Error('入库价格金额不正确');
    if (billingMode === 'buyout' && rawPurchaseCost !== undefined && rawPurchaseCost !== null && rawPurchaseCost !== '') {
      await connection.execute('UPDATE phones SET purchase_cost=? WHERE id=?', [purchaseCost, phoneId]);
    }
    const principalAmount = billingMode === 'buyout' ? getPrincipalAmount(salePrice, downPayment) : null;
    const effectiveDeposit = billingMode === 'buyout' ? 0 : deposit;
    const insertParams = billingMode === 'buyout'
      ? [phoneId, customerId, billingMode, 0, termMonths, salePrice, downPayment, principalAmount, monthlyRent, monitoringLock, startDate, startDate, termMonths, effectiveDeposit, salePrice, req.user.id, null, String(req.body?.remarks || '').trim() || null]
      : [phoneId, customerId, billingMode, unitPrice, null, monitoringLock, startDate, effectiveDeposit, salePrice, req.user.id, null, String(req.body?.remarks || '').trim() || null];
    const insertSql = billingMode === 'buyout'
      ? `INSERT INTO rentals (phone_id,customer_id,billing_mode,unit_price,term_months,sale_price,down_payment,principal_amount,monthly_rent,monitoring_lock,start_date,end_date,deposit,total_cost,status,operator_id,sale_id,remarks)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,DATE_ADD(?, INTERVAL ? MONTH),?,?,'active',?,?,?)`
      : `INSERT INTO rentals (phone_id,customer_id,billing_mode,unit_price,term_months,sale_price,monitoring_lock,start_date,end_date,deposit,total_cost,status,operator_id,sale_id,remarks)
         VALUES (?,?,?,?,?,?,?, ?,NULL,?,?,'active',?,?,?)`;
    const [result] = await connection.execute(insertSql, insertParams);
    const contractNumber = getContractNumber(billingMode, startDate, result.insertId);
    await connection.execute('UPDATE rentals SET contract_number=? WHERE id=?', [contractNumber, result.insertId]);

    if (billingMode === 'buyout') {
      const totalPrice = Number(salePrice.toFixed(2));
      const saleDate = `${startDate} 00:00:00`;
      const invoiceNumber = await generateInvoiceNumber('retail', connection, saleDate);
      const [saleResult] = await connection.execute(
        `INSERT INTO sales (phone_id,customer_id,sale_type,operator_id,store_id,price,cost,payment_method,invoice_number,remarks,sale_date)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [phoneId, customerId, 'retail', saleOperatorId, saleStoreId || phones[0].store_id || null, totalPrice, purchaseCost, salePaymentMethod, invoiceNumber, saleRemarks || `租赁买断合同 ${contractNumber}`, saleDate]
      );
      await connection.execute('UPDATE rentals SET sale_id=? WHERE id=?', [saleResult.insertId, result.insertId]);
      await connection.execute(
        `UPDATE phones SET status='sold',sale_price=?,salestime=?,sale_operator_id=?,remarks=CONCAT(COALESCE(remarks,''), ?) WHERE id=?`,
        [totalPrice, saleDate, saleOperatorId, `\n租赁买断合同 ${contractNumber}`, phoneId]
      );
    }
    if (billingMode === 'buyout' && downPayment > 0) {
      await connection.execute(
        "INSERT INTO rental_payments (rental_id,amount,period_number,payment_type,operator_id,remarks) VALUES (?,?,NULL,'down_payment',?,?)",
        [result.insertId, downPayment, req.user.id, `买断首付 ${contractNumber}`]
      );
      const [saleRows] = await connection.execute('SELECT sale_id FROM rentals WHERE id=?', [result.insertId]);
      if (saleRows[0]?.sale_id) {
        await connection.execute(
          `INSERT INTO payment_records (order_id,customer_id,payment_method,payment_channel,amount,payment_status,transaction_no,payment_time,remarks)
           VALUES (?,?,?,?,?,'success',?,?,?)`,
          [saleRows[0].sale_id, customerId, salePaymentMethod, salePaymentChannel, downPayment, saleTransactionNo, `${startDate} 00:00:00`, `买断首付 ${contractNumber}`]
        );
      }
    }
    if (billingMode === 'daily') await connection.execute("UPDATE phones SET status='rented' WHERE id=?", [phoneId]);
    await connection.commit();
    return ApiResponse.created(res, billingMode === 'buyout' ? '买断合同已创建，销售订单已生成' : '按天租赁合同已创建', { id: result.insertId, contract_number: contractNumber });
  } catch (error) {
    if (connection) await connection.rollback();
    log.error('创建租赁合同失败:', error);
    return ApiResponse.error(res, error.message || '创建租赁合同失败', /不存在|停用|不在库|请选择|不正确|成本/.test(error.message || '') ? 400 : 500);
  } finally {
    if (connection) connection.release();
  }
});

router.put('/:id', requirePermission('rentals:edit'), async (req, res) => {
  try {
    await ensureRentalSchema();
    const id = Number(req.params.id);
    const unitPrice = Number(req.body?.unit_price || 0);
    const salePrice = Number(req.body?.sale_price || 0);
    const downPayment = Number(req.body?.down_payment || 0);
    const monthlyRent = Number(req.body?.monthly_rent || 0);
    const purchaseCost = Number(req.body?.purchase_cost || 0);
    const deposit = Number(req.body?.deposit || 0);
    const monitoringLock = req.body?.monitoring_lock ? 1 : 0;
    const requestedMode = req.body?.billing_mode;
    const termMonths = isBuyoutMode(requestedMode) ? Number(req.body?.term_months) : null;
    if (requestedMode === 'daily' && (!positiveMoney(unitPrice) || unitPrice <= 0 || !positiveMoney(deposit))) return ApiResponse.badRequest(res, '租金和押金金额不正确');
    if (requestedMode === 'buyout' && !positiveMoney(purchaseCost)) return ApiResponse.badRequest(res, '入库价格金额不正确');
    if (requestedMode === 'buyout' && (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 12)) {
      return ApiResponse.badRequest(res, '到期买断请选择1至12期');
    }
    const db = getDatabase();
    const [rows] = await db.execute('SELECT status,billing_mode,start_date,sale_id,phone_id FROM rentals WHERE id=?', [id]);
    if (!rows.length) return ApiResponse.notFound(res, '租赁合同不存在');
    if (rows[0].status !== 'active' && !isAdministrator(req)) return ApiResponse.badRequest(res, '已结束合同仅管理员可编辑');
    const mode = rows[0].billing_mode;
    if (requestedMode && !((requestedMode === 'buyout' && isBuyoutMode(mode)) || requestedMode === mode)) {
      return ApiResponse.badRequest(res, '合同类型创建后不可切换');
    }
    const normalizedMode = isBuyoutMode(mode) ? 'buyout' : 'daily';
    const effectiveMonitoringLock = normalizedMode === 'buyout' ? 1 : monitoringLock;
    const effectiveDeposit = normalizedMode === 'buyout' ? 0 : deposit;
    const effectiveTermMonths = isBuyoutMode(mode) ? (termMonths || 1) : null;
    const principalAmount = isBuyoutMode(mode) ? getPrincipalAmount(salePrice, downPayment) : null;
    if (isBuyoutMode(mode) && (salePrice <= 0 || downPayment < 0 || downPayment > salePrice || monthlyRent < 0)) {
      return ApiResponse.badRequest(res, '销售总价、首付或每月租金不正确');
    }
    if (isBuyoutMode(mode)) {
      const [paidRows] = await db.execute('SELECT COUNT(*) AS count FROM rental_payments WHERE rental_id=? AND period_number IS NOT NULL', [id]);
      if (Number(paidRows[0]?.count || 0) > effectiveTermMonths) return ApiResponse.badRequest(res, '买断期数不能少于已登记的还款期次');
    }
    await db.execute(
      `UPDATE rentals SET billing_mode=?,unit_price=?,term_months=?,sale_price=?,down_payment=?,principal_amount=?,monthly_rent=?,monitoring_lock=?,
       end_date=CASE WHEN ?='buyout' THEN DATE_ADD(start_date, INTERVAL ? MONTH) ELSE NULL END,
       deposit=?,total_cost=CASE WHEN ?='buyout' THEN ? ELSE total_cost END,remarks=? WHERE id=?`,
      [mode, isBuyoutMode(mode) ? 0 : unitPrice, effectiveTermMonths, salePrice || null, downPayment, principalAmount, monthlyRent, effectiveMonitoringLock, normalizedMode, effectiveTermMonths || 0, effectiveDeposit, normalizedMode, salePrice, String(req.body?.remarks || '').trim() || null, id]
    );
    if (normalizedMode === 'buyout') await db.execute('UPDATE phones SET purchase_cost=? WHERE id=?', [purchaseCost, rows[0].phone_id]);
    if (isBuyoutMode(mode) && rows[0].sale_id) {
      const totalPrice = Number(salePrice.toFixed(2));
      await db.execute(
        'UPDATE sales SET price=?,cost=?,store_id=COALESCE(?,store_id),operator_id=COALESCE(?,operator_id),payment_method=COALESCE(?,payment_method),payment_channel=?,remarks=COALESCE(?,remarks) WHERE id=?',
        [totalPrice, purchaseCost, req.body?.sale_store_id || null, req.body?.sale_operator_id || null, req.body?.sale_payment_method || null, req.body?.sale_payment_channel || null, req.body?.sale_remarks || null, rows[0].sale_id]
      );
      await db.execute('UPDATE phones SET sale_price=? WHERE id=? AND status=?', [totalPrice, rows[0].phone_id, 'sold']);
    }
    return ApiResponse.success(res, { id }, '租赁合同保存成功');
  } catch (error) {
    log.error('保存租赁合同失败:', error);
    return ApiResponse.serverError(res, '保存租赁合同失败', error);
  }
});

router.get('/:id/payment-schedule', requirePermission('rentals:view'), async (req, res) => {
  try {
    await ensureRentalSchema();
    const rentalId = Number(req.params.id);
    const db = getDatabase();
    const [rentals] = await db.execute(
      "SELECT billing_mode,term_months,unit_price,sale_price,down_payment,principal_amount,monthly_rent,DATE_FORMAT(start_date,'%Y-%m-%d') start_date FROM rentals WHERE id=?",
      [rentalId]
    );
    if (!rentals.length) return ApiResponse.notFound(res, '租赁合同不存在');
    const [payments] = await db.execute(
      `SELECT rp.id,rp.period_number,rp.amount,DATE_FORMAT(rp.paid_at,'%Y-%m-%d %H:%i:%s') paid_at,
              COALESCE(u.name,u.username) operator_name,rp.remarks
       FROM rental_payments rp LEFT JOIN users u ON u.id=rp.operator_id
       WHERE rp.rental_id=? ORDER BY COALESCE(rp.period_number,255),rp.id`,
      [rentalId]
    );
    if (!isBuyoutMode(rentals[0].billing_mode)) return ApiResponse.success(res, { schedule: [], payments }, '获取还款明细成功');
    const paidMap = new Map(payments.filter(item => item.period_number).map(item => [Number(item.period_number), item]));
    const schedule = Array.from({ length: Number(rentals[0].term_months || 0) }, (_, index) => {
      const periodNumber = index + 1;
      const payment = paidMap.get(periodNumber);
      return {
        period_number: periodNumber,
        due_date: addMonthsClamped(rentals[0].start_date, periodNumber),
        principal_amount: isBuyoutMode(rentals[0].billing_mode)
          ? getInstallmentAmount(rentals[0].principal_amount, 0, rentals[0].term_months, periodNumber) : 0,
        monthly_rent: Number(rentals[0].monthly_rent || 0),
        amount: isBuyoutMode(rentals[0].billing_mode)
          ? getInstallmentAmount(rentals[0].principal_amount, rentals[0].monthly_rent, rentals[0].term_months, periodNumber)
          : Number(rentals[0].unit_price || 0),
        paid: Boolean(payment),
        paid_at: payment?.paid_at || null,
        operator_name: payment?.operator_name || null
      };
    });
    return ApiResponse.success(res, { schedule, payments }, '获取还款明细成功');
  } catch (error) {
    return ApiResponse.serverError(res, '获取还款明细失败', error);
  }
});

router.post('/:id/payments', requirePermission('rentals:edit'), async (req, res) => {
  let connection;
  try {
    await ensureRentalSchema();
    const rentalId = Number(req.params.id);
    connection = await getDatabase().getConnection();
    await connection.beginTransaction();
    const [rentals] = await connection.execute(
      `SELECT r.contract_number,r.billing_mode,r.term_months,r.unit_price,r.sale_price,r.down_payment,r.principal_amount,r.monthly_rent,
              r.status,r.sale_id,r.customer_id,s.payment_method AS sale_payment_method,s.payment_channel AS sale_payment_channel
       FROM rentals r LEFT JOIN sales s ON s.id=r.sale_id WHERE r.id=? FOR UPDATE`,
      [rentalId]
    );
    if (!rentals.length) throw new Error('租赁合同不存在');
    const rental = rentals[0];
    if (['returned', 'damaged', 'bought_out'].includes(rental.status)) throw new Error('该合同已经结束');
    const remarks = String(req.body?.remarks || '').trim() || null;
    const inserted = [];
    if (isBuyoutMode(rental.billing_mode)) {
      const periodNumbers = [...new Set((req.body?.period_numbers || []).map(Number))].sort((a, b) => a - b);
      if (!periodNumbers.length || periodNumbers.some(number => !Number.isInteger(number) || number < 1 || number > Number(rental.term_months))) {
        throw new Error('请选择正确的未还期次');
      }
      const [existing] = await connection.execute(
        `SELECT period_number FROM rental_payments WHERE rental_id=? AND period_number IN (${periodNumbers.map(() => '?').join(',')}) FOR UPDATE`,
        [rentalId, ...periodNumbers]
      );
      if (existing.length) throw new Error(`第${existing.map(item => item.period_number).join('、')}期已经还款`);
      for (const periodNumber of periodNumbers) {
        const [result] = await connection.execute(
        'INSERT INTO rental_payments (rental_id,amount,period_number,payment_type,operator_id,remarks) VALUES (?,?,?,\'installment\',?,?)',
          [rentalId, getInstallmentAmount(rental.principal_amount, rental.monthly_rent, rental.term_months, periodNumber), periodNumber, req.user.id, remarks]
        );
        inserted.push({ id: result.insertId, period_number: periodNumber, amount: Number(rental.unit_price) });
        if (rental.sale_id) {
          await connection.execute(
            `INSERT INTO payment_records (order_id,customer_id,payment_method,payment_channel,amount,payment_status,transaction_no,payment_time,remarks)
             VALUES (?,?,?,?,?,'success',NULL,NOW(),?)`,
            [rental.sale_id, rental.customer_id, rental.sale_payment_method || 'cash', rental.sale_payment_channel || null, getInstallmentAmount(rental.principal_amount, rental.monthly_rent, rental.term_months, periodNumber), `租赁买断第${periodNumber}期 ${rental.contract_number || `MD${String(rentalId).padStart(8, '0')}`}${remarks ? `：${remarks}` : ''}`]
          );
        }
      }
      const [paidRows] = await connection.execute(
        'SELECT COUNT(DISTINCT period_number) AS count FROM rental_payments WHERE rental_id=? AND period_number IS NOT NULL',
        [rentalId]
      );
      if (Number(paidRows[0]?.count || 0) >= Number(rental.term_months || 0)) {
        await connection.execute("UPDATE rentals SET status='bought_out' WHERE id=?", [rentalId]);
      }
    } else {
      const amount = Number(req.body?.amount);
      if (!positiveMoney(amount) || amount <= 0) throw new Error('请输入正确的收款金额');
      const [result] = await connection.execute(
        "INSERT INTO rental_payments (rental_id,amount,period_number,payment_type,operator_id,remarks) VALUES (?,?,NULL,'daily',?,?)",
        [rentalId, amount, req.user.id, remarks]
      );
      inserted.push({ id: result.insertId, amount });
    }
    await connection.commit();
    return ApiResponse.created(res, isBuyoutMode(rental.billing_mode) ? '月供已登记' : '租金还款已登记', inserted);
  } catch (error) {
    if (connection) await connection.rollback();
    return ApiResponse.error(res, error.message || '租金还款登记失败', /不存在|请选择|已经还款|正确|已经结束/.test(error.message || '') ? 400 : 500);
  } finally {
    if (connection) connection.release();
  }
});

router.post('/:id/files', requirePermission('rentals:edit'), contractUpload.array('files', 12), async (req, res) => {
  try {
    await ensureRentalSchema();
    const rentalId = Number(req.params.id);
    const db = getDatabase();
    const [rentals] = await db.execute('SELECT id FROM rentals WHERE id=?', [rentalId]);
    if (!rentals.length) return ApiResponse.notFound(res, '租赁合同不存在');
    const uploaded = [];
    for (const file of req.files || []) {
      const url = getUploadUrl('rentals', 'contracts', file.filename);
      const [result] = await db.execute(
        'INSERT INTO rental_contract_files (rental_id,file_url,file_name,uploaded_by) VALUES (?,?,?,?)',
        [rentalId, url, file.originalname, req.user.id]
      );
      uploaded.push({ id: result.insertId, file_url: url, file_name: file.originalname });
    }
    return ApiResponse.created(res, '合同备份上传成功', uploaded);
  } catch (error) {
    for (const file of req.files || []) { try { fs.unlinkSync(file.path); } catch (_) {} }
    return ApiResponse.serverError(res, '合同备份上传失败', error);
  }
});

router.delete('/:id/files/:fileId', requirePermission('rentals:edit'), async (req, res) => {
  try {
    await ensureRentalSchema();
    const db = getDatabase();
    const [rows] = await db.execute('SELECT id,file_url FROM rental_contract_files WHERE id=? AND rental_id=?', [Number(req.params.fileId), Number(req.params.id)]);
    if (!rows.length) return ApiResponse.notFound(res, '合同备份不存在');
    await db.execute('DELETE FROM rental_contract_files WHERE id=?', [rows[0].id]);
    try { fs.unlinkSync(getUploadPathFromUrl(rows[0].file_url)); } catch (_) {}
    return ApiResponse.success(res, null, '合同备份已删除');
  } catch (error) {
    return ApiResponse.serverError(res, '删除合同备份失败', error);
  }
});

router.post('/:id/finish', requirePermission('rentals:edit'), async (req, res) => {
  let connection;
  try {
    await ensureRentalSchema();
    connection = await getDatabase().getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT * FROM rentals WHERE id=? FOR UPDATE', [Number(req.params.id)]);
    if (!rows.length) throw new Error('租赁合同不存在');
    const rental = rows[0];
    if (rental.status !== 'active' && rental.status !== 'overdue') throw new Error('该合同已经结束');
    if (isBuyoutMode(rental.billing_mode)) throw new Error('到期买断合同不能执行归还');
    const [costRows] = await connection.execute(
      `SELECT ROUND(unit_price * GREATEST(DATEDIFF(CURDATE(),start_date)+1,1),2) AS cost
       FROM rentals WHERE id=?`,
      [rental.id]
    );
    const totalCost = Number(costRows[0]?.cost || 0);
    await connection.execute(
      "UPDATE rentals SET status='returned',returned_at=NOW(),end_date=CURDATE(),total_cost=? WHERE id=?",
      [totalCost, rental.id]
    );
    await connection.execute("UPDATE phones SET status='in_stock' WHERE id=? AND status='rented'", [rental.phone_id]);
    await connection.commit();
    return ApiResponse.success(res, { id: rental.id, total_cost: totalCost }, '租赁已结束，设备已恢复在库');
  } catch (error) {
    if (connection) await connection.rollback();
    return ApiResponse.error(res, error.message || '结束租赁失败', /不存在|已经结束|不能执行归还/.test(error.message || '') ? 400 : 500);
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
