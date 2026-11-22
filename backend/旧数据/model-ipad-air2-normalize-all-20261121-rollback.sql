-- 回滚云端旧型号关联统一。
START TRANSACTION;
UPDATE phones SET model_id=68 WHERE id=13134 AND model_id=187;
UPDATE phones SET model_id=68 WHERE id=2158 AND model_id=187;
UPDATE phones SET model_id=68 WHERE id=2154 AND model_id=187;
UPDATE phones SET model_id=68 WHERE id=2128 AND model_id=187;
UPDATE phones SET model_id=68 WHERE id=1419 AND model_id=187;
COMMIT;
