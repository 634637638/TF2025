-- Revert DX3P3M8MFRC6 cost/note correction if no later business changes depend on it.
START TRANSACTION;

UPDATE sales
SET purchase_cost = 3300.00,
    remarks = '是；历史重配：旧站与原始数据确认后续二手销售'
WHERE id = 14172
  AND phone_id = 14948
  AND customer_id = 8969
  AND sale_price = 1300.00
  AND purchase_cost = 1300.00
  AND sale_time = '2016-01-29 00:00:00'
  AND invoice_number = '201601290008XS';

UPDATE phones
SET purchase_cost = 3300.00,
    remarks = '是；历史重配：旧站与原始数据确认后续二手销售',
    is_new = 0
WHERE id = 14948
  AND serial_number = 'DX3P3M8MFRC6'
  AND sale_price = 1300.00
  AND purchase_cost = 1300.00
  AND sale_time = '2016-01-29 00:00:00'
  AND inventory_time = '2016-01-29 00:00:00';

COMMIT;
