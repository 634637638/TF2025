-- XJMQ9WQVTR: preserve two user-confirmed second-hand sale events.
-- Run as one transaction after verifying all preconditions below.
START TRANSACTION;

-- Expected source-backed cloud state: one sale 2625 / phone 2797.
-- Abort manually unless this SELECT returns exactly one row.
SELECT s.id, s.phone_id, s.customer_id, s.sale_price, s.purchase_cost,
       s.sale_time, s.invoice_number, p.serial_number, p.imei,
       p.inventory_time, p.payment_status, p.payment_batch_id
FROM sales s
JOIN phones p ON p.id = s.phone_id
WHERE s.id = 2625
  AND s.phone_id = 2797
  AND p.serial_number = 'XJMQ9WQVTR';

-- Keep the existing device and sale for the 2024-01-03 Zhong Zhipeng event.
UPDATE sales
SET customer_id = 3492,
    remarks = '二手'
WHERE id = 2625
  AND phone_id = 2797
  AND customer_id = 1875
  AND sale_time = '2024-01-03 00:00:00'
  AND sale_price = 3000.00
  AND purchase_cost = 2400.00
  AND invoice_number = '202401030001XS';

UPDATE phones
SET is_new = 0,
    remarks = '二手'
WHERE id = 2797
  AND serial_number = 'XJMQ9WQVTR'
  AND inventory_time = '2024-01-03 00:00:00'
  AND sale_time = '2024-01-03 00:00:00'
  AND purchase_cost = 2400.00
  AND sale_price = 3000.00;

-- Reuse the already-restored, unlinked duplicate device 2865 for the
-- independent 2024-01-25 Xiao Xiang event. Existing payment fields are
-- preserved because the source records do not provide a payment correction.
UPDATE phones
SET sale_price = 3000.00,
    is_new = 0,
    status = 'sold',
    remarks = '二手',
    sale_time = '2024-01-25 00:00:00',
    inventory_time = '2024-01-21 00:00:00',
    purchase_cost = 2500.00
WHERE id = 2865
  AND serial_number = 'XJMQ9WQVTR'
  AND sale_time = '2024-01-03 00:00:00'
  AND inventory_time = '2024-01-03 00:00:00'
  AND purchase_cost = 2400.00
  AND sale_id IS NULL;

SET @xjmq_new_phone_id = 2865;

INSERT INTO sales (
  phone_id, customer_id, sale_price, purchase_cost, sale_type, operator_id,
  store_id, status, payment_method, payment_channel, invoice_number,
  remarks, sale_time, created_at, points_awarded, points_accounted_at
)
SELECT
  @xjmq_new_phone_id, 1875, 3000.00, 2500.00, sale_type, operator_id,
  store_id, status, payment_method, payment_channel, '202401250002XS',
  '二手', '2024-01-25 00:00:00', created_at, 0, NULL
FROM sales
WHERE id = 2625
  AND phone_id = 2797;

-- Validate exactly two completed sale rows before committing.
SELECT s.id, s.phone_id, s.customer_id, c.name AS buyer, s.sale_price,
       s.purchase_cost, s.sale_time, s.invoice_number, p.inventory_time,
       p.is_new, p.remarks AS phone_remarks, p.payment_status,
       p.serial_number
FROM sales s
JOIN phones p ON p.id = s.phone_id
JOIN customers c ON c.id = s.customer_id
WHERE p.serial_number = 'XJMQ9WQVTR'
ORDER BY s.sale_time, s.id;

-- COMMIT only if the result contains the two source-confirmed events.
COMMIT;
