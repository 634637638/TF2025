-- 原始颜色“不分”按用户确认归一为现有黑色字典(id=4)。
START TRANSACTION;
UPDATE phones SET color_id=4 WHERE id=7610 AND color_id IS NULL;
UPDATE phones SET color_id=4 WHERE id=7609 AND color_id IS NULL;
UPDATE phones SET color_id=4 WHERE id=7608 AND color_id IS NULL;
UPDATE phones SET color_id=4 WHERE id=7607 AND color_id IS NULL;
UPDATE phones SET color_id=4 WHERE id=7606 AND color_id IS NULL;
UPDATE phones SET color_id=4 WHERE id=7605 AND color_id IS NULL;
UPDATE phones SET color_id=4 WHERE id=7604 AND color_id IS NULL;
UPDATE phones SET color_id=4 WHERE id=7603 AND color_id IS NULL;
UPDATE phones SET color_id=4 WHERE id=7602 AND color_id IS NULL;
COMMIT;
