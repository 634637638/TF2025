-- 回滚姓名误填颜色映射。
START TRANSACTION;
UPDATE phones SET color_id=NULL WHERE id=4276 AND color_id=2;
UPDATE phones SET color_id=NULL WHERE id=5475 AND color_id=10;
UPDATE phones SET color_id=NULL WHERE id=7287 AND color_id=1;
UPDATE phones SET color_id=NULL WHERE id=11584 AND color_id=4;
COMMIT;
