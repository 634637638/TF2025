-- 回滚颜色“128G”到原关联。
START TRANSACTION;
UPDATE phones SET color_id =NULL WHERE id=12937 AND color_id=4;
UPDATE phones SET color_id =NULL WHERE id=12938 AND color_id=4;
COMMIT;
