-- FFXDKQTA0DYM: preserve both legacy sales as independent events.
-- The first buyer was confirmed by the user as Huang Jianping / 13979090787.
-- The second buyer is matched by the legacy SQL phone number 18379004986.
-- Expected new invoice number was generated with the shared invoice utility.
START TRANSACTION;

-- Expected existing event: sale 684 / phone 748, June 22, 2025, CNY 1,500.
SELECT s.id, s.phone_id, s.customer_id, c.name, c.phone,
       s.sale_time, s.sale_price, s.purchase_cost, s.invoice_number,
       p.serial_number, p.imei, p.inventory_time, p.is_new
FROM sales s
JOIN phones p ON p.id = s.phone_id
LEFT JOIN customers c ON c.id = s.customer_id
WHERE s.id = 684 AND s.phone_id = 748
  AND p.serial_number = 'FFXDKQTA0DYM'
  AND s.customer_id = 490
  AND s.sale_time = '2025-06-22 00:00:00'
  AND s.sale_price = 1500.00 AND s.purchase_cost = 800.00
  AND s.invoice_number = '202506220001XS';

-- Reassign the June event to the user-confirmed buyer and classify the earliest,
-- higher-priced sale as new. Preserve the existing sale/payment metadata.
UPDATE sales
SET customer_id = 1640, updated_at = NOW()
WHERE id = 684 AND phone_id = 748 AND customer_id = 490
  AND sale_time = '2025-06-22 00:00:00'
  AND sale_price = 1500.00 AND purchase_cost = 800.00
  AND invoice_number = '202506220001XS';

UPDATE phones
SET is_new = 1
WHERE id = 748 AND serial_number = 'FFXDKQTA0DYM'
  AND sale_time = '2025-06-22 00:00:00'
  AND inventory_time = '2025-06-19 00:00:00'
  AND sale_price = 1500.00 AND purchase_cost = 800.00
  AND is_new = 0;

-- Reuse the unlinked duplicate device for the independent August resale.
UPDATE phones
SET sale_price = 1400.00,
    purchase_cost = 1100.00,
    is_new = 0,
    remarks = '二手',
    sale_time = '2025-08-09 00:00:00',
    inventory_time = '2025-08-02 00:00:00'
WHERE id = 950 AND serial_number = 'FFXDKQTA0DYM'
  AND imei = '353065111547945'
  AND sale_id IS NULL
  AND sale_time = '2025-06-22 00:00:00'
  AND inventory_time = '2025-06-19 00:00:00'
  AND sale_price = 1500.00 AND purchase_cost = 800.00
  AND is_new = 0 AND status = 'sold';

INSERT INTO sales (
  phone_id, customer_id, sale_price, purchase_cost, sale_type, operator_id,
  store_id, status, payment_method, payment_channel, invoice_number,
  remarks, sale_time, created_at, points_awarded, points_accounted_at
)
SELECT
  950, 490, 1400.00, 1100.00, sale_type, operator_id,
  store_id, status, NULL, NULL, '202508090004XS',
  '二手', '2025-08-09 00:00:00', created_at, 0, NULL
FROM sales
WHERE id = 684 AND phone_id = 748 AND customer_id = 1640
  AND sale_time = '2025-06-22 00:00:00'
  AND sale_price = 1500.00 AND purchase_cost = 800.00
  AND invoice_number = '202506220001XS';

INSERT INTO invoice_sequences (sequence_date, type_suffix, current_sequence)
VALUES ('20250809', 'XS', 4)
ON DUPLICATE KEY UPDATE current_sequence = GREATEST(current_sequence, 4);

-- Commit only after this returns the two source-confirmed events.
SELECT s.id AS sale_id, s.phone_id, c.name AS buyer, c.phone,
       s.sale_time, s.sale_price, s.purchase_cost, s.invoice_number,
       p.inventory_time, p.is_new, p.remarks, p.serial_number, p.imei
FROM sales s
JOIN phones p ON p.id = s.phone_id
LEFT JOIN customers c ON c.id = s.customer_id
WHERE p.serial_number = 'FFXDKQTA0DYM'
ORDER BY s.sale_time, s.id;

COMMIT;
