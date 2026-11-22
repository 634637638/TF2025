-- 回滚“不分”颜色映射。
START TRANSACTION;
UPDATE phones SET color_id =NULL WHERE id=7602 AND color_id=4;
UPDATE phones SET color_id =NULL WHERE id=7603 AND color_id=4;
UPDATE phones SET color_id =NULL WHERE id=7604 AND color_id=4;
UPDATE phones SET color_id =NULL WHERE id=7605 AND color_id=4;
UPDATE phones SET color_id =NULL WHERE id=7606 AND color_id=4;
UPDATE phones SET color_id =NULL WHERE id=7607 AND color_id=4;
UPDATE phones SET color_id =NULL WHERE id=7608 AND color_id=4;
UPDATE phones SET color_id =NULL WHERE id=7609 AND color_id=4;
UPDATE phones SET color_id =NULL WHERE id=7610 AND color_id=4;
COMMIT;
