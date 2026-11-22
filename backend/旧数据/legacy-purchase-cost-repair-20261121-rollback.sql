-- 回滚 legacy-purchase-cost-repair-20261121.sql。
-- 仅当目标记录仍是本次修复后的成本时执行。
START TRANSACTION;

UPDATE sales
SET purchase_cost = CASE id
  WHEN 4772 THEN 6000.00
  WHEN 5860 THEN 8750.00
  WHEN 2898 THEN 1600.00
END
WHERE (id, phone_id, purchase_cost) IN (
  (4772, 5034, 3500.00),
  (5860, 6206, 4200.00),
  (2898, 3084, 1000.00)
);

UPDATE phones
SET purchase_cost = CASE id
  WHEN 5034 THEN 6000.00
  WHEN 6206 THEN 8750.00
  WHEN 3084 THEN 1600.00
END
WHERE (id, serial_number, purchase_cost) IN (
  (5034, 'C2J34VKT27', 3500.00),
  (6206, 'C2CT66C9Y1', 4200.00),
  (3084, 'C02L7KQEF5V7', 1000.00)
);

SELECT s.id AS sale_id, s.phone_id, p.serial_number,
       s.purchase_cost AS sale_cost, p.purchase_cost AS phone_cost
FROM sales s
JOIN phones p ON p.id = s.phone_id
WHERE (s.id, s.phone_id, p.serial_number) IN (
  (4772, 5034, 'C2J34VKT27'),
  (5860, 6206, 'C2CT66C9Y1'),
  (2898, 3084, 'C02L7KQEF5V7')
)
ORDER BY s.id;

COMMIT;
