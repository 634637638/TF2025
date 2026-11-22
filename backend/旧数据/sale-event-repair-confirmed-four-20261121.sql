-- 四组用户确认的旧站销售事件修复（2026-11-21）
-- 依据：原始数据为主，旧站 SQL 辅助；不同手机号、日期或售价均保留为独立销售事件。
-- 说明：李维斌的两个手机号对应两个云端档案，本批首售使用有旧站历史销售的 18679018000（客户 ID 7910）。
-- 执行前备份：backend/backups/sql-20261121_213604.sql
-- 本文件必须在已核对前置查询结果后作为单事务执行。

START TRANSACTION;

-- 前置回读：四个当前销售、七台现有设备及客户档案。
SELECT s.id AS sale_id, s.phone_id, p.serial_number, p.imei,
       s.customer_id, c.name AS buyer, c.phone AS buyer_phone,
       s.sale_time, s.sale_price, s.purchase_cost, s.invoice_number,
       p.inventory_time, p.is_new, p.status AS phone_status
FROM sales s
JOIN phones p ON p.id = s.phone_id
LEFT JOIN customers c ON c.id = s.customer_id
WHERE p.serial_number IN ('F2MVT87BJCLG','FD2XD0EEJCLY','G0NCD540N742','X322494GWJ')
ORDER BY p.serial_number, s.sale_time, s.id;

SELECT id, name, phone
FROM customers
WHERE phone IN ('17779051111','18679018000','13979091896','15170140840',
                '15807909864','18907908554','18879089272','18879020433')
ORDER BY phone, id;

-- F2MVT87BJCLG：现有 8410/8954 改为林环二手事件，12153 补回李维斌首售。
UPDATE sales
SET customer_id = 5805, sale_price = 3000.00, purchase_cost = 3000.00,
    sale_time = '2020-02-17 00:00:00', invoice_number = '202002170003XS',
    remarks = '二手'
WHERE id = 8410 AND phone_id = 8954 AND customer_id = 5805
  AND sale_price = 7800.00 AND purchase_cost = 7800.00
  AND sale_time = '2017-12-16 00:00:00' AND invoice_number = '201712160001XS'
  AND status = 'completed';

UPDATE phones
SET sale_price = 3000.00, purchase_cost = 3000.00, is_new = 0,
    sale_time = '2020-02-17 00:00:00', inventory_time = '2020-02-17 00:00:00',
    remarks = '二手', status = 'sold'
WHERE id = 8954 AND serial_number = 'F2MVT87BJCLG'
  AND imei = '353056090684668' AND sale_price = 7800.00
  AND purchase_cost = 7800.00 AND sale_time = '2017-12-16 00:00:00'
  AND inventory_time = '2017-12-16 00:00:00' AND is_new = 1;

UPDATE phones
SET sale_price = 7800.00, purchase_cost = 7800.00, is_new = 1,
    sale_time = '2017-12-16 00:00:00', inventory_time = '2017-12-16 00:00:00',
    remarks = '是', status = 'sold'
WHERE id = 12153 AND serial_number = 'F2MVT87BJCLG'
  AND imei = '353056090684668' AND sale_id IS NULL
  AND sale_price = 7800.00 AND purchase_cost = 7800.00
  AND sale_time = '2017-12-16 00:00:00' AND inventory_time = '2017-12-16 00:00:00'
  AND is_new = 1;

INSERT INTO sales (
  phone_id, customer_id, sale_price, purchase_cost, sale_type, operator_id,
  store_id, status, payment_method, payment_channel, invoice_number, remarks,
  sale_time, created_at, points_awarded, points_accounted_at
)
SELECT 12153, 7910, 7800.00, 7800.00, sale_type, operator_id, store_id,
       status, NULL, NULL, '201712160004XS', '是', '2017-12-16 00:00:00',
       created_at, 0, NULL
FROM sales
WHERE id = 8410 AND phone_id = 8954;

-- FD2XD0EEJCLY：现有 7067/7460 改为袁艺娇二手事件，11054 补回陈伟首售。
UPDATE sales
SET customer_id = 5046, sale_price = 1699.00, purchase_cost = 1699.00,
    sale_time = '2021-01-01 00:00:00', invoice_number = '202101010006XS',
    remarks = '二手'
WHERE id = 7067 AND phone_id = 7460 AND customer_id = 5046
  AND sale_price = 5700.00 AND purchase_cost = 5700.00
  AND sale_time = '2018-10-18 00:00:00' AND invoice_number = '201810180001XS'
  AND status = 'completed';

UPDATE phones
SET sale_price = 1699.00, purchase_cost = 1699.00, is_new = 0,
    sale_time = '2021-01-01 00:00:00', inventory_time = '2021-01-01 00:00:00',
    remarks = '二手', status = 'sold'
WHERE id = 7460 AND serial_number = 'FD2XD0EEJCLY'
  AND imei = '356109096552624' AND sale_price = 5700.00
  AND purchase_cost = 5700.00 AND sale_time = '2018-10-18 00:00:00'
  AND inventory_time = '2018-10-18 00:00:00' AND is_new = 1;

UPDATE phones
SET sale_price = 5700.00, purchase_cost = 5700.00, is_new = 1,
    sale_time = '2018-10-18 00:00:00', inventory_time = '2018-10-18 00:00:00',
    remarks = '未参与', status = 'sold'
WHERE id = 11054 AND serial_number = 'FD2XD0EEJCLY'
  AND imei = '356109096552624' AND sale_id IS NULL
  AND sale_price = 5700.00 AND purchase_cost = 5700.00
  AND sale_time = '2018-10-18 00:00:00' AND inventory_time = '2018-10-18 00:00:00'
  AND is_new = 1;

INSERT INTO sales (
  phone_id, customer_id, sale_price, purchase_cost, sale_type, operator_id,
  store_id, status, payment_method, payment_channel, invoice_number, remarks,
  sale_time, created_at, points_awarded, points_accounted_at
)
SELECT 11054, 1535, 5700.00, 5700.00, sale_type, operator_id, store_id,
       status, NULL, NULL, '201810180005XS', '未参与', '2018-10-18 00:00:00',
       created_at, 0, NULL
FROM sales
WHERE id = 7067 AND phone_id = 7460;

-- G0NCD540N742：IMEI 356585104010921 为郭的后续二手，3858 的 IMEI 为李聪首售。
UPDATE sales
SET customer_id = 1600, sale_price = 1500.00, purchase_cost = 1200.00,
    sale_time = '2024-04-30 00:00:00', invoice_number = '202404300004XS',
    remarks = '二手'
WHERE id = 2273 AND phone_id = 2432 AND customer_id = 1600
  AND sale_price = 2000.00 AND purchase_cost = 2000.00
  AND sale_time = '2023-03-12 00:00:00' AND invoice_number = '202303120001XS'
  AND status = 'completed';

UPDATE phones
SET sale_price = 1500.00, purchase_cost = 1200.00, is_new = 0,
    sale_time = '2024-04-30 00:00:00', inventory_time = '2024-04-30 00:00:00',
    remarks = '二手', status = 'sold'
WHERE id = 2432 AND serial_number = 'G0NCD540N742'
  AND imei = '356585104010921' AND sale_price = 2000.00
  AND purchase_cost = 2000.00 AND sale_time = '2023-03-12 00:00:00'
  AND inventory_time = '2023-03-12 00:00:00' AND is_new = 0;

UPDATE phones
SET sale_price = 2000.00, purchase_cost = 2000.00, is_new = 1,
    sale_time = '2023-03-12 00:00:00', inventory_time = '2023-03-12 00:00:00',
    remarks = '是', status = 'sold'
WHERE id = 3858 AND serial_number = 'G0NCD540N742'
  AND imei = '356585104081377' AND sale_id IS NULL
  AND sale_price = 2000.00 AND purchase_cost = 2000.00
  AND sale_time = '2023-03-12 00:00:00' AND inventory_time = '2023-03-12 00:00:00'
  AND is_new = 0;

INSERT INTO sales (
  phone_id, customer_id, sale_price, purchase_cost, sale_type, operator_id,
  store_id, status, payment_method, payment_channel, invoice_number, remarks,
  sale_time, created_at, points_awarded, points_accounted_at
)
SELECT 3858, 9637, 2000.00, 2000.00, sale_type, operator_id, store_id,
       status, NULL, NULL, '202303120006XS', '是', '2023-03-12 00:00:00',
       created_at, 0, NULL
FROM sales
WHERE id = 2273 AND phone_id = 2432;

-- X322494GWJ：现有 2098/2251 恢复为刘欢首售，复制设备历史承载郭燕二手销售。
UPDATE sales
SET customer_id = 1926
WHERE id = 2098 AND phone_id = 2251 AND customer_id = 23
  AND sale_price = 5400.00 AND purchase_cost = 5400.00
  AND sale_time = '2022-04-23 00:00:00' AND invoice_number = '202204230001XS'
  AND status = 'completed';

INSERT INTO phones (
  purchase_number, inventory_operator_id, memory_id, imei, serial_number,
  sale_price, is_new, supplier_id, store_id, status, wholesale_date,
  wholesale_price, sale_id, quality_grade, remarks, sale_time, preorder_id,
  is_preordered, inventory_time, sale_operator_id, brand_id, model_id,
  color_id, purchase_cost, payment_status, payment_time, payment_method,
  payment_operator_id, payment_remarks, payment_batch_id
)
SELECT purchase_number, inventory_operator_id, memory_id, imei, serial_number,
       2650.00, 0, supplier_id, store_id, 'sold', wholesale_date,
       wholesale_price, NULL, quality_grade, '二手', '2024-07-02 00:00:00',
       NULL, 0, '2024-06-29 00:00:00', sale_operator_id, brand_id, model_id,
       color_id, 2300.00, payment_status, payment_time, payment_method,
       payment_operator_id, payment_remarks, payment_batch_id
FROM phones
WHERE id = 2251 AND serial_number = 'X322494GWJ'
  AND imei = '355240577483046' AND sale_price = 5400.00
  AND purchase_cost = 5400.00 AND sale_time = '2022-04-23 00:00:00'
  AND inventory_time = '2022-04-23 00:00:00' AND is_new = 1;

SET @x322_new_phone_id = LAST_INSERT_ID();

INSERT INTO sales (
  phone_id, customer_id, sale_price, purchase_cost, sale_type, operator_id,
  store_id, status, payment_method, payment_channel, invoice_number, remarks,
  sale_time, created_at, points_awarded, points_accounted_at
)
SELECT @x322_new_phone_id, 23, 2650.00, 2300.00, sale_type, operator_id,
       store_id, status, NULL, NULL, '202407020007XS', '二手',
       '2024-07-02 00:00:00', created_at, 0, NULL
FROM sales
WHERE id = 2098 AND phone_id = 2251;

INSERT INTO invoice_sequences(sequence_date, type_suffix, current_sequence)
VALUES ('20171216','XS',4), ('20200217','XS',3),
       ('20181018','XS',5), ('20210101','XS',6),
       ('20230312','XS',6), ('20240430','XS',4),
       ('20240702','XS',7)
ON DUPLICATE KEY UPDATE current_sequence = GREATEST(current_sequence, VALUES(current_sequence));

-- 提交前回读：应为四组分别 2、2、2、2 条独立销售事件。
SELECT p.serial_number, s.id AS sale_id, s.phone_id, c.name AS buyer,
       c.phone AS buyer_phone, s.sale_time, s.sale_price, s.purchase_cost,
       s.invoice_number, p.inventory_time, p.is_new, p.imei
FROM sales s
JOIN phones p ON p.id = s.phone_id
JOIN customers c ON c.id = s.customer_id
WHERE p.serial_number IN ('F2MVT87BJCLG','FD2XD0EEJCLY','G0NCD540N742','X322494GWJ')
ORDER BY p.serial_number, s.sale_time, s.id;

COMMIT;
