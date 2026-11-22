-- 2026-11-21 已确认型号/颜色别名修复。
-- 仅使用现有品牌、型号、颜色和内存字典，不创建基础资料。
-- 执行前应完成云端备份。所有 UPDATE 均带设备 ID、SN 和原值前置条件。
START TRANSACTION;

-- xs -> iPhoneXS，苹果品牌。
UPDATE phones SET brand_id = 1, model_id = 226
WHERE id = 5645 AND serial_number = 'F17Z10JYKPGQ'
  AND brand_id IS NULL AND model_id IS NULL AND color_id = 8 AND memory_id = 6;
UPDATE phones SET brand_id = 1, model_id = 226
WHERE id = 9716 AND serial_number = 'F17Z10JYKPGQ'
  AND brand_id IS NULL AND model_id IS NULL AND color_id = 8 AND memory_id = 6;

-- 11pro -> iPhone11pro。
UPDATE phones SET model_id = 190
WHERE id = 5635 AND serial_number = 'C39CK31HN6YL'
  AND brand_id = 1 AND model_id = 12 AND color_id = 9 AND memory_id = 6;
UPDATE phones SET model_id = 190
WHERE id = 8538 AND serial_number = 'C39CK31HN6YL'
  AND brand_id = 1 AND model_id = 12 AND color_id = 9 AND memory_id = 6;

-- iPhone6p -> 6plus。
UPDATE phones SET model_id = 147
WHERE id = 12316 AND serial_number = 'C39PP4JAG5QT'
  AND brand_id = 1 AND model_id = 32 AND color_id = 8 AND memory_id = 9;
UPDATE phones SET model_id = 147
WHERE id = 14644 AND serial_number = 'C39PP4JAG5QT'
  AND brand_id = 1 AND model_id = 32 AND color_id = 8 AND memory_id = 9;

-- iphone6sp -> 6s plus。
UPDATE phones SET model_id = 149
WHERE id = 13459 AND serial_number = 'C39RV64EGRX5'
  AND brand_id = 1 AND model_id = 32 AND color_id = 8 AND memory_id = 6;
UPDATE phones SET model_id = 149
WHERE id = 13886 AND serial_number = 'C39RV64EGRX5'
  AND brand_id = 1 AND model_id = 32 AND color_id = 6 AND memory_id = 6;

-- F2LW38EAGRXH 的两笔来源均为 iphone6sp。2021 年来源银色 -> 白色，2018 年来源金色保留。
UPDATE phones SET model_id = 149
WHERE id = 6901 AND serial_number = 'F2LW38EAGRXH'
  AND brand_id = 1 AND model_id = 32 AND color_id = 8 AND memory_id = 3;
UPDATE phones SET model_id = 149, color_id = 1
WHERE id = 11812 AND serial_number = 'F2LW38EAGRXH'
  AND brand_id = 1 AND model_id = 32 AND color_id = 8 AND memory_id = 3;

-- F18WNH79JCM1 来源两笔均为 iphone8p，内存按原始表统一为 64GB。
UPDATE phones SET model_id = 151
WHERE id = 7304 AND serial_number = 'F18WNH79JCM1'
  AND brand_id = 1 AND model_id = 33 AND color_id = 8 AND memory_id = 6;

COMMIT;
