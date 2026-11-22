-- 回滚 spec-alias-round-20261121.sql，仅在目标值仍为本批目标值时恢复。
START TRANSACTION;
UPDATE phones SET brand_id = NULL, model_id = NULL
WHERE id = 5645 AND serial_number = 'F17Z10JYKPGQ' AND brand_id = 1 AND model_id = 226 AND color_id = 8 AND memory_id = 6;
UPDATE phones SET brand_id = NULL, model_id = NULL
WHERE id = 9716 AND serial_number = 'F17Z10JYKPGQ' AND brand_id = 1 AND model_id = 226 AND color_id = 8 AND memory_id = 6;
UPDATE phones SET model_id = 12
WHERE id = 5635 AND serial_number = 'C39CK31HN6YL' AND brand_id = 1 AND model_id = 190 AND color_id = 9 AND memory_id = 6;
UPDATE phones SET model_id = 12
WHERE id = 8538 AND serial_number = 'C39CK31HN6YL' AND brand_id = 1 AND model_id = 190 AND color_id = 9 AND memory_id = 6;
UPDATE phones SET model_id = 32
WHERE id = 12316 AND serial_number = 'C39PP4JAG5QT' AND brand_id = 1 AND model_id = 147 AND color_id = 8 AND memory_id = 9;
UPDATE phones SET model_id = 32
WHERE id = 14644 AND serial_number = 'C39PP4JAG5QT' AND brand_id = 1 AND model_id = 147 AND color_id = 8 AND memory_id = 9;
UPDATE phones SET model_id = 32
WHERE id = 13459 AND serial_number = 'C39RV64EGRX5' AND brand_id = 1 AND model_id = 149 AND color_id = 8 AND memory_id = 6;
UPDATE phones SET model_id = 32
WHERE id = 13886 AND serial_number = 'C39RV64EGRX5' AND brand_id = 1 AND model_id = 149 AND color_id = 6 AND memory_id = 6;
UPDATE phones SET model_id = 32
WHERE id = 6901 AND serial_number = 'F2LW38EAGRXH' AND brand_id = 1 AND model_id = 149 AND color_id = 8 AND memory_id = 3;
UPDATE phones SET model_id = 32, color_id = 8
WHERE id = 11812 AND serial_number = 'F2LW38EAGRXH' AND brand_id = 1 AND model_id = 149 AND color_id = 1 AND memory_id = 3;
UPDATE phones SET model_id = 33
WHERE id = 7304 AND serial_number = 'F18WNH79JCM1' AND brand_id = 1 AND model_id = 151 AND color_id = 8 AND memory_id = 6;
-- 7353 在本批前已是 151，保留原值。
COMMIT;
