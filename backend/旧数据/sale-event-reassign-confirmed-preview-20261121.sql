-- 用户已确认的三组销售事件重配预览（2026-11-21）
-- 本文件只读，仅输出现有销售记录、建议保留/重配的记录及现有字典映射。
-- 不执行 INSERT、UPDATE 或 DELETE。销售单号日期规则确认后才可生成事务修复脚本。

WITH confirmed_events AS (
  SELECT 'C37VTDZRJCLY' AS serial_number, 7034 AS first_sale_id,
         11269 AS reassigned_sale_id, 3105 AS later_customer_id,
         '2021-01-11 00:00:00' AS later_sale_time, 1600.00 AS later_sale_price,
         'iphone 8p' AS expected_model, '黑色' AS expected_color,
         '64GB' AS expected_memory, 1 AS expected_brand_id
  UNION ALL
  SELECT 'C2J34VKT27', 2519, 4772, 1785,
         '2024-02-16 00:00:00', 3700.00,
         'iphone13', '白色', '256GB', 1
  UNION ALL
  SELECT 'C2CT66C9Y1', 3005, 5860, 2154,
         '2023-09-29 00:00:00', 4900.00,
         '13promax', '黑色', '128GB', 1
)
SELECT e.serial_number,
       CASE WHEN s.id = e.first_sale_id THEN '保留首次销售'
            ELSE '候选重配为后续二手销售' END AS proposed_role,
       s.id AS sale_id, p.id AS device_id,
       s.customer_id AS current_customer_id, current_customer.name AS current_buyer,
       current_customer.phone AS current_buyer_phone,
       DATE_FORMAT(s.sale_time, '%Y-%m-%d %H:%i:%s') AS current_sale_time,
       s.sale_price AS current_sale_price, s.sale_type, s.status AS sale_status,
       s.invoice_number, s.points_awarded, s.points_accounted_at,
       p.status AS device_status, p.is_new,
       p.brand_id, current_brand.name AS current_brand,
       p.model_id, current_model.name AS current_model,
       p.color_id, current_color.name AS current_color,
       p.memory_id, current_memory.size AS current_memory,
       e.later_customer_id, later_customer.name AS later_buyer,
       later_customer.phone AS later_buyer_phone,
       e.later_sale_time AS confirmed_later_sale_time,
       e.later_sale_price AS confirmed_later_sale_price,
       e.expected_brand_id,
       e.expected_model,
       expected_model.id AS existing_model_id,
       e.expected_color,
       expected_color.id AS existing_color_id,
       e.expected_memory,
       expected_memory.id AS existing_memory_id,
       (SELECT COUNT(*) FROM national_subsidies n
        WHERE n.sale_id = s.id OR n.phone_id = p.id) AS subsidy_count,
       (SELECT COUNT(*) FROM payment_records r
        WHERE r.order_id = s.id OR r.sales_order_id = s.id) AS payment_count,
       (SELECT COUNT(*) FROM sales_order_items i
        WHERE i.sale_id = s.id OR i.phone_id = p.id OR i.linked_phone_sale_id = s.id) AS order_item_count,
       (SELECT COUNT(*) FROM sales_order_items i
        JOIN sales_aftersales a ON a.order_id = i.order_id
        WHERE i.sale_id = s.id OR i.phone_id = p.id) AS aftersales_count,
       (SELECT COUNT(*) FROM customer_account_entries a
        WHERE a.source_id = s.id) AS account_entry_count,
       (SELECT COUNT(*) FROM customer_film_services f
        WHERE f.qualification_sale_id = s.id OR f.phone_id = p.id) AS film_service_count,
       (SELECT COUNT(*) FROM accessory_serials a
        WHERE a.sale_id = s.id) AS accessory_serial_count,
       (SELECT COUNT(*) FROM rentals r
        WHERE r.sale_id = s.id OR r.phone_id = p.id) AS rental_count,
       (SELECT COUNT(*) FROM repairs r WHERE r.phone_id = p.id) AS repair_count,
       (SELECT COUNT(*) FROM preorders r
        WHERE r.sale_id = s.id OR r.matched_phone_id = p.id) AS preorder_count,
       (SELECT COUNT(*) FROM sale_reversal_logs r
        WHERE r.phone_id = p.id OR r.original_sale_id = s.id) AS reversal_count
FROM confirmed_events e
JOIN sales s ON s.id IN (e.first_sale_id, e.reassigned_sale_id)
JOIN phones p ON p.id = s.phone_id AND p.serial_number = e.serial_number
LEFT JOIN customers current_customer ON current_customer.id = s.customer_id
LEFT JOIN customers later_customer ON later_customer.id = e.later_customer_id
LEFT JOIN brands current_brand ON current_brand.id = p.brand_id
LEFT JOIN models current_model ON current_model.id = p.model_id
LEFT JOIN colors current_color ON current_color.id = p.color_id
LEFT JOIN memories current_memory ON current_memory.id = p.memory_id
LEFT JOIN models expected_model
       ON expected_model.brand_id = e.expected_brand_id
      AND LOWER(expected_model.name) = LOWER(e.expected_model)
LEFT JOIN colors expected_color ON expected_color.name = e.expected_color
LEFT JOIN memories expected_memory ON expected_memory.size = e.expected_memory
ORDER BY e.serial_number, s.id;
