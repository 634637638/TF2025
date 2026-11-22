-- 将云端旧型号字典 ipadAIR222222(id=68) 的设备关联统一到 iPad Air2(id=187)。
-- 仅更新 phones.model_id，不删除或改名型号字典。
START TRANSACTION;
UPDATE phones SET model_id=187 WHERE id=1419 AND model_id=68;
UPDATE phones SET model_id=187 WHERE id=2128 AND model_id=68;
UPDATE phones SET model_id=187 WHERE id=2154 AND model_id=68;
UPDATE phones SET model_id=187 WHERE id=2158 AND model_id=68;
UPDATE phones SET model_id=187 WHERE id=13134 AND model_id=68;
COMMIT;
