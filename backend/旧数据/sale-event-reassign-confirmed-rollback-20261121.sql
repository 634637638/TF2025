-- 回滚 sale-event-reassign-confirmed-20261121.sql
-- 只在对应修复已经提交且尚无新业务关联时执行。
-- 核验 rollback_precheck_passed=1 后执行更新；检查结果正确后手动 COMMIT，否则 ROLLBACK。

START TRANSACTION;

SELECT s.id, p.id
FROM sales s JOIN phones p ON p.id = s.phone_id
WHERE s.id IN (7034,11269,2519,4772,3005,5860)
ORDER BY s.id FOR UPDATE;

SET @rollback_precheck_passed := IF(
  (SELECT COUNT(*) FROM sales s JOIN phones p ON p.id = s.phone_id
   WHERE (s.id, p.id, p.serial_number, s.customer_id, s.sale_time, s.sale_price, s.invoice_number) IN
     ((7034,7427,'C37VTDZRJCLY',5030,'2018-02-01 00:00:00',6388.00,'201802010002XS'),
      (11269,11985,'C37VTDZRJCLY',3105,'2021-01-11 00:00:00',1600.00,'202101110005XS'),
      (2519,2687,'C2J34VKT27',1792,'2022-06-26 00:00:00',6000.00,'202206260001XS'),
      (4772,5034,'C2J34VKT27',1785,'2024-02-16 00:00:00',3700.00,'202402160013XS'),
      (3005,3192,'C2CT66C9Y1',2162,'2021-10-01 00:00:00',8750.00,'202110010002XS'),
      (5860,6206,'C2CT66C9Y1',2154,'2023-09-29 00:00:00',4900.00,'202309290006XS'))
  ) = 6
  AND (SELECT COUNT(*) FROM phones WHERE (id, inventory_time) IN
       ((7427,'2018-02-01 00:00:00'),(11985,'2021-01-11 00:00:00'),
        (2687,'2022-06-26 00:00:00'),(5034,'2024-02-16 00:00:00'),
        (3192,'2021-10-01 00:00:00'),(6206,'2023-09-29 00:00:00'))) = 6
  AND (SELECT COUNT(*) FROM phones WHERE id IN (7427,11985)
       AND brand_id = 1 AND model_id = 151 AND color_id = 4 AND memory_id = 6) = 2
  AND (SELECT COUNT(*) FROM phones WHERE id IN (3192,6206)
       AND brand_id = 1 AND model_id = 145 AND color_id = 4 AND memory_id = 3) = 2
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

SELECT @rollback_precheck_passed AS rollback_precheck_passed;

UPDATE sales
SET customer_id = 5030, sale_time = '2018-02-01 00:00:00', sale_price = 6388.00,
    invoice_number = '201802010003XS', remarks = '未参与', updated_at = NOW()
WHERE @rollback_precheck_passed = 1 AND id = 11269
  AND customer_id = 3105 AND sale_time = '2021-01-11 00:00:00'
  AND sale_price = 1600.00 AND invoice_number = '202101110005XS';
UPDATE phones
SET sale_price = 6388.00, sale_time = '2018-02-01 00:00:00', is_new = 1,
    inventory_time = '2018-02-01 00:00:00', remarks = '未参与'
WHERE @rollback_precheck_passed = 1 AND id = 11985 AND serial_number = 'C37VTDZRJCLY'
  AND sale_price = 1600.00 AND sale_time = '2021-01-11 00:00:00' AND is_new = 0;

UPDATE sales
SET customer_id = 1792, sale_time = '2022-06-26 00:00:00', sale_price = 6000.00,
    invoice_number = '202206260004XS', remarks = '未参与', updated_at = NOW()
WHERE @rollback_precheck_passed = 1 AND id = 4772
  AND customer_id = 1785 AND sale_time = '2024-02-16 00:00:00'
  AND sale_price = 3700.00 AND invoice_number = '202402160013XS';
UPDATE phones
SET sale_price = 6000.00, sale_time = '2022-06-26 00:00:00', is_new = 1,
    inventory_time = '2022-06-26 00:00:00', remarks = '未参与'
WHERE @rollback_precheck_passed = 1 AND id = 5034 AND serial_number = 'C2J34VKT27'
  AND sale_price = 3700.00 AND sale_time = '2024-02-16 00:00:00' AND is_new = 0;

UPDATE sales
SET customer_id = 2162, sale_time = '2021-10-01 00:00:00', sale_price = 8750.00,
    invoice_number = '202110010003XS', remarks = '未参与', updated_at = NOW()
WHERE @rollback_precheck_passed = 1 AND id = 5860
  AND customer_id = 2154 AND sale_time = '2023-09-29 00:00:00'
  AND sale_price = 4900.00 AND invoice_number = '202309290006XS';
UPDATE phones
SET sale_price = 8750.00, sale_time = '2021-10-01 00:00:00', is_new = 1,
    inventory_time = '2021-10-01 00:00:00', remarks = '未参与'
WHERE @rollback_precheck_passed = 1 AND id = 6206 AND serial_number = 'C2CT66C9Y1'
  AND sale_price = 4900.00 AND sale_time = '2023-09-29 00:00:00' AND is_new = 0;

UPDATE phones
SET brand_id = 1, model_id = 33, color_id = 4, memory_id = 6
WHERE @rollback_precheck_passed = 1 AND id IN (7427,11985)
  AND brand_id = 1 AND model_id = 151 AND color_id = 4 AND memory_id = 6;
UPDATE phones
SET brand_id = NULL, model_id = NULL, color_id = NULL, memory_id = 3
WHERE @rollback_precheck_passed = 1 AND id IN (3192,6206)
  AND brand_id = 1 AND model_id = 145 AND color_id = 4 AND memory_id = 3;

-- 单号序列表保持高水位，不回退以免之后的单号重用。
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

SELECT @rollback_precheck_passed AS rollback_precheck_passed,
       (SELECT COUNT(*) FROM sales WHERE id IN (11269,4772,5860)
          AND customer_id IN (5030,1792,2162)) AS restored_sales,
       (SELECT COUNT(*) FROM phones WHERE id IN (11985,5034,6206) AND is_new = 1) AS restored_devices,
       (SELECT COUNT(*) FROM phones WHERE (id, inventory_time) IN
          ((11985,'2018-02-01 00:00:00'),(5034,'2022-06-26 00:00:00'),(6206,'2021-10-01 00:00:00'))) AS restored_inventory_dates;

-- 核验 rollback_precheck_passed=1、restored_sales=3、restored_devices=3 后手动执行 COMMIT;
-- 任一结果不符时执行 ROLLBACK;，不要提交。
