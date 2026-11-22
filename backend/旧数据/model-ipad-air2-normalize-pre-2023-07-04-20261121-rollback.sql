-- 回滚本批 iPad Air2 规范化。
START TRANSACTION;
UPDATE phones SET model_id=68 WHERE id=14581 AND model_id=187;
UPDATE phones SET model_id=68 WHERE id=14580 AND model_id=187;
UPDATE phones SET model_id=68 WHERE id=14579 AND model_id=187;
UPDATE phones SET model_id=68 WHERE id=14578 AND model_id=187;
UPDATE phones SET model_id=68 WHERE id=14577 AND model_id=187;
UPDATE phones SET model_id=68 WHERE id=14576 AND model_id=187;
UPDATE phones SET model_id=68 WHERE id=13543 AND model_id=187;
UPDATE phones SET model_id=68 WHERE id=1249 AND model_id=187;
COMMIT;
