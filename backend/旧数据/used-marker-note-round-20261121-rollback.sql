-- 回滚 used-marker-note-round-20261121.sql，仅在备注和目标状态未变化时恢复。
START TRANSACTION;
UPDATE phones SET is_new = 1 WHERE id = 14572 AND serial_number = 'C35K8ZX1DTWF' AND is_new = 0 AND remarks = '保修一月';
UPDATE phones SET is_new = 1 WHERE id = 11822 AND serial_number = 'FFPQN1MSG5MV' AND is_new = 0 AND remarks = 'ID6只换保修一个月';
UPDATE phones SET is_new = 1 WHERE id = 11624 AND serial_number = 'DX3QTC6YG5QT' AND is_new = 0 AND remarks = '保修一个月';
UPDATE phones SET is_new = 1 WHERE id = 11542 AND serial_number = 'FFQQD9BZG5MN' AND is_new = 0 AND remarks = '保修一个月';
UPDATE phones SET is_new = 1 WHERE id = 11506 AND serial_number = 'C76QG2TXGRY7' AND is_new = 0 AND remarks = '保修一个月';
UPDATE phones SET is_new = 1 WHERE id = 14469 AND serial_number = 'F17QR4N8GRXV' AND is_new = 0 AND remarks = '开票保修';
UPDATE phones SET is_new = 1 WHERE id = 10221 AND serial_number = 'F17T843THG6W' AND is_new = 0 AND remarks = '换主板保修7天';
COMMIT;
