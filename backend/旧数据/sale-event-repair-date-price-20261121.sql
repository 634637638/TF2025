-- 旧站事件核对后修复四笔云端销售。
-- DNPD/J92 为同买家事件字段修复。FK1/HFK 复用云端重复副本重配为旧站第二笔销售。
START TRANSACTION;

-- 前置值核对后再执行以下 UPDATE；任一目标不符应整体回滚。
UPDATE sales
SET sale_time = '2026-01-18 00:00:00', purchase_cost = 800.00, invoice_number = '202601180001XS'
WHERE id = 14395 AND phone_id = 15269 AND customer_id = 9385
  AND sale_price = 1100.00 AND purchase_cost = 1000.00
  AND sale_time = '2026-01-19 00:00:00' AND invoice_number = '202601190003XS';
UPDATE phones
SET sale_time = '2026-01-18 00:00:00', inventory_time = '2026-01-18 00:00:00', purchase_cost = 800.00
WHERE id = 15269 AND serial_number = 'DNPDWT3A0DYM'
  AND sale_price = 1100.00 AND purchase_cost = 1000.00
  AND sale_time = '2026-01-19 00:00:00' AND inventory_time = '2026-01-19 00:00:00';

UPDATE sales
SET sale_price = 2600.00, purchase_cost = 2300.00, remarks = '未参与；二手'
WHERE id = 4308 AND phone_id = 4540 AND customer_id = 1039
  AND sale_price = 5800.00 AND purchase_cost = 5800.00
  AND sale_time = '2025-01-16 00:00:00' AND invoice_number = '202501160002XS';
UPDATE phones
SET sale_price = 2600.00, purchase_cost = 2300.00, inventory_time = '2024-12-02 00:00:00',
    is_new = 0, remarks = '未参与；二手'
WHERE id = 4540 AND serial_number = 'J92NXMJ411'
  AND sale_price = 5800.00 AND purchase_cost = 5800.00
  AND sale_time = '2025-01-16 00:00:00' AND inventory_time = '2024-12-04 00:00:00' AND is_new = 1;

UPDATE sales
SET customer_id = 9023, sale_price = 650.00, purchase_cost = 650.00,
    sale_time = '2016-07-25 00:00:00', invoice_number = '201607250003XS', remarks = '换机；二手'
WHERE id = 13729 AND phone_id = 14500 AND customer_id = 9023
  AND sale_price = 4700.00 AND purchase_cost = 4700.00
  AND sale_time = '2015-12-24 00:00:00' AND invoice_number = '201512240002XS';
UPDATE phones
SET sale_price = 650.00, purchase_cost = 650.00, sale_time = '2016-07-25 00:00:00',
    inventory_time = '2016-07-25 00:00:00', is_new = 0, status = 'sold', remarks = '换机；二手'
WHERE id = 14500 AND serial_number = 'FK1QRH4BGRXV'
  AND sale_price = 4700.00 AND purchase_cost = 4700.00
  AND sale_time = '2015-12-24 00:00:00' AND inventory_time = '2015-12-24 00:00:00' AND is_new = 1;

UPDATE sales
SET customer_id = 255, sale_type = 'retail', sale_price = 9700.00, purchase_cost = 9400.00,
    sale_time = '2025-10-31 00:00:00', invoice_number = '202510310008XS', remarks = '跟白色一起19600'
WHERE id = 345 AND phone_id = 388 AND customer_id = 24 AND sale_type = 'supplier_proxy'
  AND sale_price = 0.00 AND purchase_cost = 0.00
  AND sale_time = '2025-10-27 00:00:00' AND invoice_number = '202510270004HB';
UPDATE phones
SET sale_price = 9700.00, purchase_cost = 9400.00, sale_time = '2025-10-31 00:00:00',
    inventory_time = '2025-10-31 00:00:00', is_new = 1, status = 'sold', remarks = '跟白色一起19600'
WHERE id = 388 AND serial_number = 'HFKYQMF3XK'
  AND sale_price = 0.00 AND purchase_cost = 0.00
  AND sale_time = '2025-10-27 00:00:00' AND inventory_time = '2025-10-09 00:00:00' AND status = 'supplier_proxy';

INSERT INTO invoice_sequences (sequence_date, type_suffix, current_sequence)
VALUES ('20160725', 'XS', 3), ('20251031', 'XS', 8)
ON DUPLICATE KEY UPDATE current_sequence = GREATEST(current_sequence, VALUES(current_sequence));

COMMIT;
