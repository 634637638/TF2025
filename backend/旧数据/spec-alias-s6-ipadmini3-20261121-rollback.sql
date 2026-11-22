-- 仅回滚本批设备新增的型号关联，并恢复本批补入的品牌关联。
START TRANSACTION;
UPDATE phones SET model_id = NULL
WHERE id = 14697 AND serial_number = 'R28G701CVBE' AND brand_id = 12 AND model_id = 230;
UPDATE phones SET model_id = NULL
WHERE id = 14570 AND serial_number = 'R28G71Q48SY' AND brand_id = 12 AND model_id = 230;
UPDATE phones SET model_id = NULL
WHERE id = 14763 AND serial_number = 'DLXQ23DBG5V3' AND brand_id = 1 AND model_id = 232;
UPDATE phones SET model_id = NULL
WHERE id = 14684 AND serial_number = 'DLXMF3CGG5YJ' AND brand_id = 1 AND model_id = 232;
UPDATE phones SET model_id = NULL
WHERE id = 14683 AND serial_number = 'F4KNN0NFG5YK' AND brand_id = 1 AND model_id = 232;
UPDATE phones SET model_id = NULL
WHERE id = 14682 AND serial_number = 'F4KND2RRG5YK' AND brand_id = 1 AND model_id = 232;
UPDATE phones SET brand_id = NULL, model_id = NULL
WHERE id = 13808 AND serial_number = 'F8QRR0QWG5V3' AND brand_id = 1 AND model_id = 232;
UPDATE phones SET model_id = NULL
WHERE id = 7981 AND serial_number = 'GY6DC1R4Q1XY' AND brand_id = 1 AND model_id = 233;
UPDATE phones SET model_id = NULL
WHERE id = 7572 AND serial_number = 'GY6DG2E0Q20T' AND brand_id = 1 AND model_id = 233;
COMMIT;
