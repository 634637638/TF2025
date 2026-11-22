-- F2LVDC2FJCM0: restore the user-confirmed 2017 first sale and
-- normalize both events to existing reference dictionaries.
START TRANSACTION;

-- Expected current cloud event: 2020-07-15 sale 7802 / phone 8333.
SELECT s.id, s.phone_id, s.customer_id, s.sale_price, s.purchase_cost,
       s.sale_time, s.invoice_number, p.serial_number, p.imei,
       p.model_id, p.color_id, p.memory_id
FROM sales s
JOIN phones p ON p.id = s.phone_id
WHERE s.id = 7802
  AND s.phone_id = 8333
  AND p.serial_number = 'F2LVDC2FJCM0';

-- Existing reference IDs: Apple=1, iphone 8p=151, white=1, 64GB=6.
UPDATE phones
SET brand_id = 1,
    model_id = 151,
    color_id = 1,
    memory_id = 6
WHERE id = 8333
  AND serial_number = 'F2LVDC2FJCM0'
  AND model_id = 33
  AND color_id = 1
  AND memory_id = 6;

-- Add the missing 2017 first-sale device as a separate historical record.
INSERT INTO phones (
  purchase_number, inventory_operator_id, memory_id, imei, serial_number,
  sale_price, is_new, supplier_id, store_id, status, wholesale_date,
  wholesale_price, sale_id, quality_grade, remarks, sale_time, preorder_id,
  is_preordered, inventory_time, sale_operator_id, brand_id, model_id,
  color_id, purchase_cost, payment_status, payment_time, payment_method,
  payment_operator_id, payment_remarks, payment_batch_id
)
SELECT
  purchase_number, inventory_operator_id, 6, imei, serial_number,
  6680.00, 1, supplier_id, store_id, 'sold', wholesale_date,
  wholesale_price, NULL, quality_grade, NULL, '2017-10-01 00:00:00',
  NULL, 0, '2017-10-01 00:00:00', sale_operator_id, 1, 151,
  1, 6680.00, payment_status, payment_time, payment_method,
  payment_operator_id, payment_remarks, payment_batch_id
FROM phones
WHERE id = 8333
  AND serial_number = 'F2LVDC2FJCM0'
  AND imei = '356713082794528';

SET @f2lv_first_phone_id = LAST_INSERT_ID();

INSERT INTO sales (
  phone_id, customer_id, sale_price, purchase_cost, sale_type, operator_id,
  store_id, status, payment_method, payment_channel, invoice_number,
  remarks, sale_time, created_at, points_awarded, points_accounted_at
)
SELECT
  @f2lv_first_phone_id, 2720, 6680.00, 6680.00, sale_type, operator_id,
  store_id, status, payment_method, payment_channel, '201710010011XS',
  NULL, '2017-10-01 00:00:00', created_at, 0, NULL
FROM sales
WHERE id = 7802
  AND phone_id = 8333;

INSERT INTO invoice_sequences (sequence_date, type_suffix, current_sequence)
VALUES ('20171001', 'XS', 11)
ON DUPLICATE KEY UPDATE current_sequence = GREATEST(current_sequence, 11);

SELECT s.id AS sale_id, s.phone_id, c.name AS buyer, c.phone,
       s.sale_price, s.purchase_cost, s.sale_time, s.invoice_number,
       p.inventory_time, p.is_new, p.serial_number, p.imei,
       b.name AS brand, m.name AS model, co.name AS color, me.size AS memory
FROM sales s
JOIN phones p ON p.id = s.phone_id
JOIN customers c ON c.id = s.customer_id
LEFT JOIN brands b ON b.id = p.brand_id
LEFT JOIN models m ON m.id = p.model_id
LEFT JOIN colors co ON co.id = p.color_id
LEFT JOIN memories me ON me.id = p.memory_id
WHERE p.serial_number = 'F2LVDC2FJCM0'
ORDER BY s.sale_time, s.id;

COMMIT;
