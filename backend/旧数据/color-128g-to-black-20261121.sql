-- 原始颜色“128G”经用户确认实际为黑色(id=4)。
-- 仅修改颜色，不修改内存。
START TRANSACTION;
UPDATE phones SET color_id=4 WHERE id=12938 AND color_id IS NULL;
UPDATE phones SET color_id=4 WHERE id=12937 AND color_id IS NULL;
COMMIT;
