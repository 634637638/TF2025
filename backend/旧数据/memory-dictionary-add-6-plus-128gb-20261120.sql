-- 新增缺失的安卓标准内存字典项；不回填任何设备记录。
START TRANSACTION;
INSERT INTO memories (size, status, sort_order)
SELECT '6+128GB', 1, 9
WHERE NOT EXISTS (
  SELECT 1 FROM memories WHERE size = '6+128GB'
);
COMMIT;
