-- C7CC36AKN742 旧站二手销售修复回滚（2026-11-21）
START TRANSACTION;
UPDATE sales SET sale_price=5800.00,sale_time='2025-05-31 00:00:00',invoice_number='202505310002XS',remarks='未参与' WHERE id=8381 AND phone_id=8925 AND invoice_number='202205310005XS';
UPDATE phones SET sale_price=5800.00,sale_time='2025-05-31 00:00:00',is_new=1,remarks='未参与' WHERE id=8925 AND serial_number='C7CC36AKN742';
UPDATE invoice_sequences SET current_sequence=4 WHERE sequence_date='20220531' AND type_suffix='XS' AND current_sequence=5;
COMMIT;
