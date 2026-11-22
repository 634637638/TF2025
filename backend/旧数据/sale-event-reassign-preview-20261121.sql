-- 销售事件错配重配只读预览（2026-11-21）
-- 本文件只包含 SELECT，不执行 INSERT、UPDATE、DELETE。
-- 目标：查看云端现有销售副本是否可以改配为来源中的后续真实销售。
-- 执行任何修复前，必须再次核对门店、操作员、单号、付款、国补、积分、售后和设备状态。

SET @preview_only = 1;

-- C02L7KQEF5V7：保留胡瑶 2023-11-02 / 1900；候选改配给晏少辉 2024-08-29 / 1380。
SELECT s.id AS sale_id, s.phone_id AS device_id, p.serial_number, p.imei,
       s.customer_id, c.name AS buyer_name, c.phone AS buyer_phone,
       s.sale_time, s.sale_price, s.sale_type, s.store_id, s.operator_id,
       s.status, s.invoice_number, s.remarks
FROM sales s
JOIN phones p ON p.id = s.phone_id
LEFT JOIN customers c ON c.id = s.customer_id
WHERE p.serial_number = 'C02L7KQEF5V7'
ORDER BY s.sale_time, s.id;

-- C2CT66C9Y1：保留严康平 2021-10-01 / 8750；候选改配给黄 2023-09-29 / 4900。
SELECT s.id AS sale_id, s.phone_id AS device_id, p.serial_number, p.imei,
       s.customer_id, c.name AS buyer_name, c.phone AS buyer_phone,
       s.sale_time, s.sale_price, s.sale_type, s.store_id, s.operator_id,
       s.status, s.invoice_number, s.remarks
FROM sales s
JOIN phones p ON p.id = s.phone_id
LEFT JOIN customers c ON c.id = s.customer_id
WHERE p.serial_number = 'C2CT66C9Y1'
ORDER BY s.sale_time, s.id;

-- C2J34VKT27：保留黄传 2022-06-26 / 6000；候选改配给杜凯琳 2024-02-16 / 3700。
SELECT s.id AS sale_id, s.phone_id AS device_id, p.serial_number, p.imei,
       s.customer_id, c.name AS buyer_name, c.phone AS buyer_phone,
       s.sale_time, s.sale_price, s.sale_type, s.store_id, s.operator_id,
       s.status, s.invoice_number, s.remarks
FROM sales s
JOIN phones p ON p.id = s.phone_id
LEFT JOIN customers c ON c.id = s.customer_id
WHERE p.serial_number = 'C2J34VKT27'
ORDER BY s.sale_time, s.id;

-- C2MXH9WQ4J：保留敖家文 2021-11-26 / 5700；候选改配给刘艳老公 2022-07-12 / 4200。
SELECT s.id AS sale_id, s.phone_id AS device_id, p.serial_number, p.imei,
       s.customer_id, c.name AS buyer_name, c.phone AS buyer_phone,
       s.sale_time, s.sale_price, s.sale_type, s.store_id, s.operator_id,
       s.status, s.invoice_number, s.remarks
FROM sales s
JOIN phones p ON p.id = s.phone_id
LEFT JOIN customers c ON c.id = s.customer_id
WHERE p.serial_number = 'C2MXH9WQ4J'
ORDER BY s.sale_time, s.id;

-- C35P2MDJG5MQ：保留赵琳 2015-01-25 / 5000；候选改配给黄圣 2016-01-29 / 2500。
SELECT s.id AS sale_id, s.phone_id AS device_id, p.serial_number, p.imei,
       s.customer_id, c.name AS buyer_name, c.phone AS buyer_phone,
       s.sale_time, s.sale_price, s.sale_type, s.store_id, s.operator_id,
       s.status, s.invoice_number, s.remarks
FROM sales s
JOIN phones p ON p.id = s.phone_id
LEFT JOIN customers c ON c.id = s.customer_id
WHERE p.serial_number = 'C35P2MDJG5MQ'
ORDER BY s.sale_time, s.id;

-- C37VTDZRJCLY：保留钟玉 2018-02-01 / 6388；候选改配给张旭 2021-01-11 / 1600，销售类型二手。
SELECT s.id AS sale_id, s.phone_id AS device_id, p.serial_number, p.imei,
       s.customer_id, c.name AS buyer_name, c.phone AS buyer_phone,
       s.sale_time, s.sale_price, s.sale_type, s.store_id, s.operator_id,
       s.status, s.invoice_number, s.remarks
FROM sales s
JOIN phones p ON p.id = s.phone_id
LEFT JOIN customers c ON c.id = s.customer_id
WHERE p.serial_number = 'C37VTDZRJCLY'
ORDER BY s.sale_time, s.id;
