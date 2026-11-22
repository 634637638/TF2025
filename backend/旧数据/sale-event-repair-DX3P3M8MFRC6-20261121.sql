-- DX3P3M8MFRC6: correct the confirmed second-hand sale cost and note.
START TRANSACTION;

SELECT s.id, s.phone_id, s.customer_id, s.sale_price, s.purchase_cost,
       s.sale_time, s.invoice_number, s.remarks, p.serial_number,
       p.purchase_cost AS phone_cost, p.inventory_time, p.is_new,
       p.remarks AS phone_remarks
FROM sales s
JOIN phones p ON p.id = s.phone_id
WHERE s.id = 14172
  AND s.phone_id = 14948
  AND p.serial_number = 'DX3P3M8MFRC6';

UPDATE sales
SET purchase_cost = 1300.00,
    remarks = '二手保修1月'
WHERE id = 14172
  AND phone_id = 14948
  AND customer_id = 8969
  AND sale_price = 1300.00
  AND purchase_cost = 3300.00
  AND sale_time = '2016-01-29 00:00:00'
  AND invoice_number = '201601290008XS';

UPDATE phones
SET purchase_cost = 1300.00,
    remarks = '二手保修1月',
    is_new = 0
WHERE id = 14948
  AND serial_number = 'DX3P3M8MFRC6'
  AND sale_price = 1300.00
  AND purchase_cost = 3300.00
  AND sale_time = '2016-01-29 00:00:00'
  AND inventory_time = '2016-01-29 00:00:00';

SELECT s.id AS sale_id, s.phone_id, c.name AS buyer, c.phone,
       s.sale_price, s.purchase_cost, s.sale_time, s.invoice_number,
       s.remarks, p.inventory_time, p.is_new, p.purchase_cost AS phone_cost,
       p.remarks AS phone_remarks, p.serial_number
FROM sales s
JOIN phones p ON p.id = s.phone_id
JOIN customers c ON c.id = s.customer_id
WHERE s.id = 14172
  AND p.serial_number = 'DX3P3M8MFRC6';

COMMIT;
