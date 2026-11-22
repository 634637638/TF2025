-- 按旧站 t_info.inventoryprice 更正三笔已核实的二手销售采购成本。
-- 仅改 sales.purchase_cost 与 phones.purchase_cost，不改销售售价、客户、时间或状态。
START TRANSACTION;

SELECT s.id AS sale_id, s.phone_id, p.serial_number, s.purchase_cost AS sale_cost,
       p.purchase_cost AS phone_cost
FROM sales s
JOIN phones p ON p.id = s.phone_id
WHERE (s.id, s.phone_id, p.serial_number) IN (
  (4772, 5034, 'C2J34VKT27'),
  (5860, 6206, 'C2CT66C9Y1'),
  (2898, 3084, 'C02L7KQEF5V7')
)
ORDER BY s.id;

UPDATE sales
SET purchase_cost = CASE id
  WHEN 4772 THEN 3500.00
  WHEN 5860 THEN 4200.00
  WHEN 2898 THEN 1000.00
END
WHERE (id, phone_id, purchase_cost) IN (
  (4772, 5034, 6000.00),
  (5860, 6206, 8750.00),
  (2898, 3084, 1600.00)
);

UPDATE phones
SET purchase_cost = CASE id
  WHEN 5034 THEN 3500.00
  WHEN 6206 THEN 4200.00
  WHEN 3084 THEN 1000.00
END
WHERE (id, serial_number, purchase_cost) IN (
  (5034, 'C2J34VKT27', 6000.00),
  (6206, 'C2CT66C9Y1', 8750.00),
  (3084, 'C02L7KQEF5V7', 1600.00)
);

SELECT s.id AS sale_id, s.phone_id, p.serial_number, s.sale_price,
       s.purchase_cost AS sale_cost, p.purchase_cost AS phone_cost,
       s.sale_time, c.name AS buyer, c.phone
FROM sales s
JOIN phones p ON p.id = s.phone_id
JOIN customers c ON c.id = s.customer_id
WHERE (s.id, s.phone_id, p.serial_number) IN (
  (4772, 5034, 'C2J34VKT27'),
  (5860, 6206, 'C2CT66C9Y1'),
  (2898, 3084, 'C02L7KQEF5V7')
)
ORDER BY s.id;

COMMIT;
