-- 仅在确认该字典项尚未被设备引用時执行。
START TRANSACTION;
DELETE FROM memories
WHERE size = '6+128GB'
  AND NOT EXISTS (
    SELECT 1 FROM phones WHERE memory_id = memories.id
  );
COMMIT;
