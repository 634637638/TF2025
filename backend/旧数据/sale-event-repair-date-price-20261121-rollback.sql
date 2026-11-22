-- 回滚 sale-event-repair-date-price-20261121.sql，仅匹配本批修复后的值。
START TRANSACTION;

UPDATE sales SET sale_time = '2026-01-19 00:00:00', purchase_cost = 1000.00, invoice_number = '202601190003XS'
WHERE id = 14395 AND phone_id = 15269 AND sale_price = 1100.00
  AND purchase_cost = 800.00 AND sale_time = '2026-01-18 00:00:00' AND invoice_number = '202601180001XS';
UPDATE phones SET sale_time = '2026-01-19 00:00:00', inventory_time = '2026-01-19 00:00:00', purchase_cost = 1000.00
WHERE id = 15269 AND serial_number = 'DNPDWT3A0DYM' AND sale_price = 1100.00
  AND purchase_cost = 800.00 AND sale_time = '2026-01-18 00:00:00' AND inventory_time = '2026-01-18 00:00:00';

UPDATE sales SET sale_price = 5800.00, purchase_cost = 5800.00, remarks = '未参与'
WHERE id = 4308 AND phone_id = 4540 AND customer_id = 1039 AND sale_price = 2600.00
  AND purchase_cost = 2300.00 AND sale_time = '2025-01-16 00:00:00' AND invoice_number = '202501160002XS';
UPDATE phones SET sale_price = 5800.00, purchase_cost = 5800.00, inventory_time = '2024-12-04 00:00:00',
    is_new = 1, remarks = '未参与'
WHERE id = 4540 AND serial_number = 'J92NXMJ411' AND sale_price = 2600.00
  AND purchase_cost = 2300.00 AND sale_time = '2025-01-16 00:00:00' AND inventory_time = '2024-12-02 00:00:00' AND is_new = 0;

UPDATE sales SET sale_price = 4700.00, purchase_cost = 4700.00, sale_time = '2015-12-24 00:00:00',
    invoice_number = '201512240002XS', remarks = '是'
WHERE id = 13729 AND phone_id = 14500 AND customer_id = 9023 AND sale_price = 650.00
  AND purchase_cost = 650.00 AND sale_time = '2016-07-25 00:00:00' AND invoice_number = '201607250003XS';
UPDATE phones SET sale_price = 4700.00, purchase_cost = 4700.00, sale_time = '2015-12-24 00:00:00',
    inventory_time = '2015-12-24 00:00:00', is_new = 1, status = 'sold', remarks = '是'
WHERE id = 14500 AND serial_number = 'FK1QRH4BGRXV' AND sale_price = 650.00
  AND purchase_cost = 650.00 AND sale_time = '2016-07-25 00:00:00' AND inventory_time = '2016-07-25 00:00:00' AND is_new = 0;

UPDATE sales SET customer_id = 24, sale_type = 'supplier_proxy', sale_price = 0.00, purchase_cost = 0.00,
    sale_time = '2025-10-27 00:00:00', invoice_number = '202510270004HB', remarks = NULL
WHERE id = 345 AND phone_id = 388 AND customer_id = 255 AND sale_type = 'retail'
  AND sale_price = 9700.00 AND purchase_cost = 9400.00
  AND sale_time = '2025-10-31 00:00:00' AND invoice_number = '202510310008XS';
UPDATE phones SET sale_price = 0.00, purchase_cost = 0.00, sale_time = '2025-10-27 00:00:00',
    inventory_time = '2025-10-09 00:00:00', is_new = 1, status = 'supplier_proxy', remarks = ''
WHERE id = 388 AND serial_number = 'HFKYQMF3XK' AND sale_price = 9700.00
  AND purchase_cost = 9400.00 AND sale_time = '2025-10-31 00:00:00' AND inventory_time = '2025-10-31 00:00:00' AND status = 'sold';

UPDATE invoice_sequences SET current_sequence = 2 WHERE sequence_date = '20160725' AND type_suffix = 'XS' AND current_sequence = 3;
UPDATE invoice_sequences SET current_sequence = 7 WHERE sequence_date = '20251031' AND type_suffix = 'XS' AND current_sequence = 8;

COMMIT;
