-- C7CC36AKN742 旧站二手销售修复（2026-11-21）
-- 来源：旧站 t_info 第10445行，2022-05-31，袁小强，18679061619，2500元，备注二手
-- 目标：复用现有销售8381/设备8925，不删除、不新建
START TRANSACTION;
UPDATE sales SET sale_price=2500.00,sale_time='2022-05-31 00:00:00',invoice_number='202205310005XS',remarks='未参与；二手'
WHERE id=8381 AND phone_id=8925 AND customer_id=3557 AND sale_price=5800.00 AND sale_time='2025-05-31 00:00:00' AND invoice_number='202505310002XS' AND status='completed';
UPDATE phones SET sale_price=2500.00,sale_time='2022-05-31 00:00:00',is_new=0,remarks='未参与；二手'
WHERE id=8925 AND serial_number='C7CC36AKN742' AND sale_price=5800.00 AND sale_time='2025-05-31 00:00:00' AND is_new=1 AND remarks='未参与';
INSERT INTO invoice_sequences(sequence_date,type_suffix,current_sequence) VALUES('20220531','XS',5) ON DUPLICATE KEY UPDATE current_sequence=GREATEST(current_sequence,5);
COMMIT;
