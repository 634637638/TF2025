-- 回滚 sale-event-repair-confirmed-four-20261121.sql
-- 仅在本批执行完成且未发生后续业务变更时使用。
START TRANSACTION;

-- 删除本批新增销售，再删除 X322 本批复制设备。
DELETE FROM sales
WHERE (invoice_number IN ('201712160004XS','201810180005XS','202303120006XS')
       AND phone_id IN (12153,11054,3858))
   OR (invoice_number = '202407020007XS' AND customer_id = 23
       AND sale_time = '2024-07-02 00:00:00' AND sale_price = 2650.00);

DELETE FROM phones
WHERE serial_number = 'X322494GWJ' AND imei = '355240577483046'
       AND sale_time = '2024-07-02 00:00:00' AND inventory_time = '2024-06-29 00:00:00'
       AND sale_price = 2650.00 AND purchase_cost = 2300.00 AND is_new = 0
       AND sale_id IS NULL;

-- 恢复四张原销售单的原字段。
UPDATE sales SET customer_id = 5805, sale_price = 7800.00, purchase_cost = 7800.00,
    sale_time = '2017-12-16 00:00:00', invoice_number = '201712160001XS', remarks = '是'
WHERE id = 8410 AND phone_id = 8954 AND invoice_number = '202002170003XS';
UPDATE phones SET sale_price = 7800.00, purchase_cost = 7800.00, is_new = 1,
    sale_time = '2017-12-16 00:00:00', inventory_time = '2017-12-16 00:00:00', remarks = '是'
WHERE id = 8954 AND serial_number = 'F2MVT87BJCLG' AND imei = '353056090684668';

UPDATE sales SET customer_id = 5046, sale_price = 5700.00, purchase_cost = 5700.00,
    sale_time = '2018-10-18 00:00:00', invoice_number = '201810180001XS', remarks = '未参与'
WHERE id = 7067 AND phone_id = 7460 AND invoice_number = '202101010006XS';
UPDATE phones SET sale_price = 5700.00, purchase_cost = 5700.00, is_new = 1,
    sale_time = '2018-10-18 00:00:00', inventory_time = '2018-10-18 00:00:00', remarks = '未参与'
WHERE id = 7460 AND serial_number = 'FD2XD0EEJCLY' AND imei = '356109096552624';

UPDATE sales SET customer_id = 1600, sale_price = 2000.00, purchase_cost = 2000.00,
    sale_time = '2023-03-12 00:00:00', invoice_number = '202303120001XS', remarks = '二手'
WHERE id = 2273 AND phone_id = 2432 AND invoice_number = '202404300004XS';
UPDATE phones SET sale_price = 2000.00, purchase_cost = 2000.00, is_new = 0,
    sale_time = '2023-03-12 00:00:00', inventory_time = '2023-03-12 00:00:00', remarks = '二手'
WHERE id = 2432 AND serial_number = 'G0NCD540N742' AND imei = '356585104010921';

UPDATE sales SET customer_id = 23
WHERE id = 2098 AND phone_id = 2251 AND customer_id = 1926
  AND invoice_number = '202204230001XS';

UPDATE invoice_sequences SET current_sequence = 3
WHERE sequence_date = '20171216' AND type_suffix = 'XS' AND current_sequence = 4;
UPDATE invoice_sequences SET current_sequence = 4
WHERE sequence_date = '20181018' AND type_suffix = 'XS' AND current_sequence = 5;
UPDATE invoice_sequences SET current_sequence = 5
WHERE sequence_date = '20200217' AND type_suffix = 'XS' AND current_sequence = 3;
UPDATE invoice_sequences SET current_sequence = 5
WHERE sequence_date = '20210101' AND type_suffix = 'XS' AND current_sequence = 6;
UPDATE invoice_sequences SET current_sequence = 5
WHERE sequence_date = '20230312' AND type_suffix = 'XS' AND current_sequence = 6;
UPDATE invoice_sequences SET current_sequence = 3
WHERE sequence_date = '20240430' AND type_suffix = 'XS' AND current_sequence = 4;
UPDATE invoice_sequences SET current_sequence = 6
WHERE sequence_date = '20240702' AND type_suffix = 'XS' AND current_sequence = 7;

COMMIT;
