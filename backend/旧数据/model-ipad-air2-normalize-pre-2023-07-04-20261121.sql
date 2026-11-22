-- 将历史旧型号 ipadAIR2 统一为现有 iPad Air2(id=187)。
START TRANSACTION;
UPDATE phones SET model_id=187 WHERE id=1249 AND model_id=68;
UPDATE phones SET model_id=187 WHERE id=13543 AND model_id=68;
UPDATE phones SET model_id=187 WHERE id=14576 AND model_id=68;
UPDATE phones SET model_id=187 WHERE id=14577 AND model_id=68;
UPDATE phones SET model_id=187 WHERE id=14578 AND model_id=68;
UPDATE phones SET model_id=187 WHERE id=14579 AND model_id=68;
UPDATE phones SET model_id=187 WHERE id=14580 AND model_id=68;
UPDATE phones SET model_id=187 WHERE id=14581 AND model_id=68;
COMMIT;
