-- 用户已确认的三组销售事件重配（2026-11-21）
-- 目标：保留首售行，将云端重复副本改配为旧站/原始数据中的后续二手销售。
-- 执行前请先在当前云端生成备份，并确认本文件中的 precheck_passed = 1。
-- 时间字段按当前业务库会话的北京时间值写入，销售日统一为 00:00:00。
-- 销售单号按统一 XS 规则重新编号；原单号由回滚文件恢复。

START TRANSACTION;

-- 按销售单号生成器的锁顺序先锁日期序列，再锁销售行和设备，防止并发占号。
SELECT sequence_date, type_suffix, current_sequence
FROM invoice_sequences
WHERE (sequence_date,type_suffix) IN (('20210111','XS'),('20240216','XS'),('20230929','XS'))
ORDER BY sequence_date, type_suffix FOR UPDATE;
SELECT s.id, p.id
FROM sales s JOIN phones p ON p.id = s.phone_id
WHERE s.id IN (7034,11269,2519,4772,3005,5860)
ORDER BY s.id FOR UPDATE;

-- 所有条件必须同时满足；不满足时后续 UPDATE 的 WHERE 条件为假，不会修改业务数据。
SET @precheck_passed := IF(
  (SELECT COUNT(*) FROM sales s JOIN phones p ON p.id = s.phone_id
   WHERE (s.id, p.id, p.serial_number, s.customer_id, s.sale_time, s.sale_price, s.invoice_number) IN
     ((7034,7427,'C37VTDZRJCLY',5030,'2018-02-01 00:00:00',6388.00,'201802010002XS'),
      (11269,11985,'C37VTDZRJCLY',5030,'2018-02-01 00:00:00',6388.00,'201802010003XS'),
      (2519,2687,'C2J34VKT27',1792,'2022-06-26 00:00:00',6000.00,'202206260001XS'),
      (4772,5034,'C2J34VKT27',1792,'2022-06-26 00:00:00',6000.00,'202206260004XS'),
      (3005,3192,'C2CT66C9Y1',2162,'2021-10-01 00:00:00',8750.00,'202110010002XS'),
      (5860,6206,'C2CT66C9Y1',2162,'2021-10-01 00:00:00',8750.00,'202110010003XS'))
  ) = 6
  AND (SELECT COUNT(*) FROM phones WHERE (id, inventory_time) IN
       ((7427,'2018-02-01 00:00:00'),(11985,'2018-02-01 00:00:00'),
        (2687,'2022-06-26 00:00:00'),(5034,'2022-06-26 00:00:00'),
        (3192,'2021-10-01 00:00:00'),(6206,'2021-10-01 00:00:00'))) = 6
  AND (SELECT COUNT(*) FROM customers WHERE id IN (3105,1785,2154) AND status = 1) = 3
  AND (SELECT COUNT(*) FROM models WHERE id IN (151,16,145) AND status = 1) = 3
  AND (SELECT COUNT(*) FROM colors WHERE id IN (4,1) AND status = 1) = 2
  AND (SELECT COUNT(*) FROM memories WHERE id IN (6,1,3) AND status = 1) = 3
  AND (SELECT COUNT(*) FROM brands WHERE id = 1 AND status = 1) = 1
  AND (SELECT COUNT(*) FROM sales WHERE invoice_number IN
       ('202101110005XS','202402160013XS','202309290006XS')) = 0
  AND (SELECT COUNT(*) FROM invoice_sequences WHERE
       (sequence_date,type_suffix) IN (('20210111','XS'),('20240216','XS'),('20230929','XS'))) = 3
  AND (SELECT COUNT(*) FROM national_subsidies WHERE sale_id IN (7034,11269,2519,4772,3005,5860)
       OR phone_id IN (7427,11985,2687,5034,3192,6206)) = 0
  AND (SELECT COUNT(*) FROM payment_records WHERE order_id IN (7034,11269,2519,4772,3005,5860)
       OR sales_order_id IN (7034,11269,2519,4772,3005,5860)) = 0
  AND (SELECT COUNT(*) FROM sales_order_items WHERE sale_id IN (7034,11269,2519,4772,3005,5860)
       OR phone_id IN (7427,11985,2687,5034,3192,6206)
       OR linked_phone_sale_id IN (7034,11269,2519,4772,3005,5860)) = 0
  AND (SELECT COUNT(*) FROM customer_account_entries WHERE source_id IN (7034,11269,2519,4772,3005,5860)) = 0
  AND (SELECT COUNT(*) FROM customer_film_services WHERE qualification_sale_id IN (7034,11269,2519,4772,3005,5860)
       OR phone_id IN (7427,11985,2687,5034,3192,6206)) = 0
  AND (SELECT COUNT(*) FROM accessory_serials WHERE sale_id IN (7034,11269,2519,4772,3005,5860)) = 0
  AND (SELECT COUNT(*) FROM rentals WHERE sale_id IN (7034,11269,2519,4772,3005,5860)
       OR phone_id IN (7427,11985,2687,5034,3192,6206)) = 0
  AND (SELECT COUNT(*) FROM repairs WHERE phone_id IN (7427,11985,2687,5034,3192,6206)) = 0
  AND (SELECT COUNT(*) FROM preorders WHERE sale_id IN (7034,11269,2519,4772,3005,5860)
       OR matched_phone_id IN (7427,11985,2687,5034,3192,6206)) = 0
  AND (SELECT COUNT(*) FROM sale_reversal_logs WHERE phone_id IN (7427,11985,2687,5034,3192,6206)
       OR original_sale_id IN (7034,11269,2519,4772,3005,5860)) = 0,
  1, 0
);

SELECT @precheck_passed AS precheck_passed;

-- 修正两组设备的现有规格；C2J34VKT27 的规格本来已正确，这里不重复写入。
UPDATE phones
SET brand_id = 1, model_id = 151, color_id = 4, memory_id = 6
WHERE @precheck_passed = 1 AND id IN (7427,11985)
  AND brand_id = 1 AND model_id = 33 AND color_id = 4 AND memory_id = 6;

UPDATE phones
SET brand_id = 1, model_id = 145, color_id = 4, memory_id = 3
WHERE @precheck_passed = 1 AND id IN (3192,6206)
  AND brand_id IS NULL AND model_id IS NULL AND color_id IS NULL AND memory_id = 3;

-- 重配 C37VTDZRJCLY：11269/11985 -> 张旭，2021-01-11，1600 元，二手。
UPDATE sales
SET customer_id = 3105, sale_time = '2021-01-11 00:00:00', sale_price = 1600.00,
    invoice_number = '202101110005XS',
    remarks = CONCAT_WS('；', NULLIF(remarks, ''), '历史重配：原始数据确认张旭二手销售'),
    updated_at = NOW()
WHERE @precheck_passed = 1 AND id = 11269
  AND customer_id = 5030 AND sale_time = '2018-02-01 00:00:00'
  AND sale_price = 6388.00 AND invoice_number = '201802010003XS';
UPDATE phones
SET sale_price = 1600.00, sale_time = '2021-01-11 00:00:00', is_new = 0,
    inventory_time = '2021-01-11 00:00:00',
    remarks = CONCAT_WS('；', NULLIF(remarks, ''), '历史重配：原始数据确认二手销售')
WHERE @precheck_passed = 1 AND id = 11985 AND serial_number = 'C37VTDZRJCLY'
  AND sale_price = 6388.00 AND sale_time = '2018-02-01 00:00:00' AND is_new = 1;

-- 重配 C2J34VKT27：4772/5034 -> 杜凯琳，2024-02-16，3700 元，二手。
UPDATE sales
SET customer_id = 1785, sale_time = '2024-02-16 00:00:00', sale_price = 3700.00,
    invoice_number = '202402160013XS',
    remarks = CONCAT_WS('；', NULLIF(remarks, ''), '历史重配：原始数据确认杜凯琳二手销售'),
    updated_at = NOW()
WHERE @precheck_passed = 1 AND id = 4772
  AND customer_id = 1792 AND sale_time = '2022-06-26 00:00:00'
  AND sale_price = 6000.00 AND invoice_number = '202206260004XS';
UPDATE phones
SET sale_price = 3700.00, sale_time = '2024-02-16 00:00:00', is_new = 0,
    inventory_time = '2024-02-16 00:00:00',
    remarks = CONCAT_WS('；', NULLIF(remarks, ''), '历史重配：原始数据确认二手销售')
WHERE @precheck_passed = 1 AND id = 5034 AND serial_number = 'C2J34VKT27'
  AND sale_price = 6000.00 AND sale_time = '2022-06-26 00:00:00' AND is_new = 1;

-- 重配 C2CT66C9Y1：5860/6206 -> 黄，2023-09-29，4900 元，二手。
UPDATE sales
SET customer_id = 2154, sale_time = '2023-09-29 00:00:00', sale_price = 4900.00,
    invoice_number = '202309290006XS',
    remarks = CONCAT_WS('；', NULLIF(remarks, ''), '历史重配：原始数据确认黄二手销售'),
    updated_at = NOW()
WHERE @precheck_passed = 1 AND id = 5860
  AND customer_id = 2162 AND sale_time = '2021-10-01 00:00:00'
  AND sale_price = 8750.00 AND invoice_number = '202110010003XS';
UPDATE phones
SET sale_price = 4900.00, sale_time = '2023-09-29 00:00:00', is_new = 0,
    inventory_time = '2023-09-29 00:00:00',
    remarks = CONCAT_WS('；', NULLIF(remarks, ''), '历史重配：原始数据确认二手销售')
WHERE @precheck_passed = 1 AND id = 6206 AND serial_number = 'C2CT66C9Y1'
  AND sale_price = 8750.00 AND sale_time = '2021-10-01 00:00:00' AND is_new = 1;

-- 保证后续统一单号生成器的日期序列不回退。
UPDATE invoice_sequences SET current_sequence = GREATEST(current_sequence, 5)
WHERE @precheck_passed = 1 AND sequence_date = '20210111' AND type_suffix = 'XS';
UPDATE invoice_sequences SET current_sequence = GREATEST(current_sequence, 13)
WHERE @precheck_passed = 1 AND sequence_date = '20240216' AND type_suffix = 'XS';
UPDATE invoice_sequences SET current_sequence = GREATEST(current_sequence, 6)
WHERE @precheck_passed = 1 AND sequence_date = '20230929' AND type_suffix = 'XS';

SELECT s.id AS sale_id, p.id AS device_id, p.serial_number, c.name AS buyer,
       DATE_FORMAT(s.sale_time,'%Y-%m-%d %H:%i:%s') AS sale_time,
       DATE_FORMAT(p.inventory_time,'%Y-%m-%d %H:%i:%s') AS inventory_time,
       s.sale_price, s.invoice_number, p.is_new,
       b.name AS brand, m.name AS model, co.name AS color, me.size AS memory
FROM sales s JOIN phones p ON p.id = s.phone_id
LEFT JOIN customers c ON c.id = s.customer_id
LEFT JOIN brands b ON b.id = p.brand_id
LEFT JOIN models m ON m.id = p.model_id
LEFT JOIN colors co ON co.id = p.color_id
LEFT JOIN memories me ON me.id = p.memory_id
WHERE s.id IN (7034,11269,2519,4772,3005,5860)
ORDER BY p.serial_number, s.id;

SELECT @precheck_passed AS precheck_passed,
       (SELECT COUNT(*) FROM sales WHERE id IN (11269,4772,5860)
          AND customer_id IN (3105,1785,2154)) AS reassigned_sales,
       (SELECT COUNT(*) FROM phones WHERE id IN (11985,5034,6206) AND is_new = 0) AS reassigned_devices,
       (SELECT COUNT(*) FROM phones WHERE (id, inventory_time) IN
          ((11985,'2021-01-11 00:00:00'),(5034,'2024-02-16 00:00:00'),(6206,'2023-09-29 00:00:00'))) AS corrected_inventory_dates;

-- 核验 precheck_passed=1、reassigned_sales=3、reassigned_devices=3，且逐条复查结果后手动执行 COMMIT;
-- 任一结果不符时执行 ROLLBACK;，不要提交。
