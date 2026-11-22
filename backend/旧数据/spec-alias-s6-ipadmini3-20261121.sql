-- 原始数据明确映射：三星S6 -> 现有三星 S6；iPadmini3 -> 现有 iPad mini3。
-- 仅处理销售日期、手机号、售价唯一匹配且当前型号为空的设备，不创建字典值。
START TRANSACTION;

UPDATE phones
SET brand_id = 12, model_id = 230
WHERE id = 14697 AND serial_number = 'R28G701CVBE'
  AND brand_id = 12 AND model_id IS NULL;
UPDATE phones
SET brand_id = 12, model_id = 230
WHERE id = 14570 AND serial_number = 'R28G71Q48SY'
  AND brand_id = 12 AND model_id IS NULL;

UPDATE phones
SET brand_id = 1, model_id = 232
WHERE id = 14763 AND serial_number = 'DLXQ23DBG5V3'
  AND brand_id = 1 AND model_id IS NULL;
UPDATE phones
SET brand_id = 1, model_id = 232
WHERE id = 14684 AND serial_number = 'DLXMF3CGG5YJ'
  AND brand_id = 1 AND model_id IS NULL;
UPDATE phones
SET brand_id = 1, model_id = 232
WHERE id = 14683 AND serial_number = 'F4KNN0NFG5YK'
  AND brand_id = 1 AND model_id IS NULL;
UPDATE phones
SET brand_id = 1, model_id = 232
WHERE id = 14682 AND serial_number = 'F4KND2RRG5YK'
  AND brand_id = 1 AND model_id IS NULL;

-- 用户确认 mini3 -> iPad mini3；该记录品牌为空，按目标型号字典的苹果品牌关联。
UPDATE phones
SET brand_id = 1, model_id = 232
WHERE id = 13808 AND serial_number = 'F8QRR0QWG5V3'
  AND brand_id IS NULL AND model_id IS NULL;

-- 用户确认 watchs6 -> Watch S6；现有型号字典归属苹果品牌。
UPDATE phones
SET brand_id = 1, model_id = 233
WHERE id = 7981 AND serial_number = 'GY6DC1R4Q1XY'
  AND brand_id = 1 AND model_id IS NULL;
UPDATE phones
SET brand_id = 1, model_id = 233
WHERE id = 7572 AND serial_number = 'GY6DG2E0Q20T'
  AND brand_id = 1 AND model_id IS NULL;

SELECT id, serial_number, brand_id, model_id
FROM phones
WHERE id IN (14697, 14570, 14763, 14684, 14683, 14682, 13808, 7981, 7572)
ORDER BY id;
COMMIT;
