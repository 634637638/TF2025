-- 用户确认的姓名误填颜色映射；仅处理唯一匹配记录。
START TRANSACTION;
UPDATE phones SET color_id=4 WHERE id=11584 AND color_id IS NULL AND memory_id =6;
UPDATE phones SET color_id=1 WHERE id=7287 AND color_id IS NULL AND memory_id IS NULL;
UPDATE phones SET color_id=10 WHERE id=5475 AND color_id IS NULL AND memory_id =3;
UPDATE phones SET color_id=2 WHERE id=4276 AND color_id IS NULL AND memory_id =1;
COMMIT;
