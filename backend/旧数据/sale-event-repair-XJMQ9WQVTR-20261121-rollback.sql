-- Revert the XJMQ9WQVTR event repair if no later business changes depend on it.
START TRANSACTION;

DELETE FROM sales
WHERE invoice_number = '202401250002XS'
  AND phone_id = 2865
  AND customer_id = 1875;

UPDATE phones
SET sale_price = 3000.00,
    is_new = 0,
    status = 'sold',
    remarks = NULL,
    sale_time = '2024-01-03 00:00:00',
    inventory_time = '2024-01-03 00:00:00',
    purchase_cost = 2400.00
WHERE id = 2865
  AND serial_number = 'XJMQ9WQVTR';

UPDATE sales
SET customer_id = 1875,
    remarks = NULL
WHERE id = 2625
  AND phone_id = 2797
  AND customer_id = 3492
  AND sale_time = '2024-01-03 00:00:00'
  AND sale_price = 3000.00
  AND purchase_cost = 2400.00
  AND invoice_number = '202401030001XS';

UPDATE phones
SET remarks = NULL
WHERE id = 2797
  AND serial_number = 'XJMQ9WQVTR'
  AND inventory_time = '2024-01-03 00:00:00'
  AND sale_time = '2024-01-03 00:00:00'
  AND purchase_cost = 2400.00;

COMMIT;
