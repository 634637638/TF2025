-- Roll back FFXDKQTA0DYM two-event repair.
START TRANSACTION;

DELETE FROM sales
WHERE phone_id = 950 AND customer_id = 490
  AND sale_time = '2025-08-09 00:00:00'
  AND sale_price = 1400.00 AND purchase_cost = 1100.00
  AND invoice_number = '202508090004XS';

UPDATE phones
SET sale_price = 1500.00,
    purchase_cost = 800.00,
    is_new = 0,
    remarks = NULL,
    sale_time = '2025-06-22 00:00:00',
    inventory_time = '2025-06-19 00:00:00'
WHERE id = 950 AND serial_number = 'FFXDKQTA0DYM'
  AND imei = '353065111547945'
  AND sale_id IS NULL
  AND sale_time = '2025-08-09 00:00:00'
  AND inventory_time = '2025-08-02 00:00:00'
  AND sale_price = 1400.00 AND purchase_cost = 1100.00
  AND is_new = 0 AND status = 'sold';

UPDATE phones
SET is_new = 0
WHERE id = 748 AND serial_number = 'FFXDKQTA0DYM'
  AND sale_time = '2025-06-22 00:00:00'
  AND inventory_time = '2025-06-19 00:00:00'
  AND sale_price = 1500.00 AND purchase_cost = 800.00
  AND is_new = 1;

UPDATE sales
SET customer_id = 490, updated_at = NOW()
WHERE id = 684 AND phone_id = 748 AND customer_id = 1640
  AND sale_time = '2025-06-22 00:00:00'
  AND sale_price = 1500.00 AND purchase_cost = 800.00
  AND invoice_number = '202506220001XS';

-- The invoice sequence high-water mark is intentionally not lowered.
COMMIT;
