-- Revert F2LVDC2FJCM0 repair if no later business changes depend on it.
START TRANSACTION;

DELETE FROM sales
WHERE invoice_number = '201710010011XS'
  AND phone_id IN (
    SELECT id FROM phones
    WHERE serial_number = 'F2LVDC2FJCM0'
      AND sale_time = '2017-10-01 00:00:00'
      AND inventory_time = '2017-10-01 00:00:00'
      AND purchase_cost = 6680.00
  )
  AND customer_id = 2720;

DELETE FROM phones
WHERE serial_number = 'F2LVDC2FJCM0'
  AND sale_time = '2017-10-01 00:00:00'
  AND inventory_time = '2017-10-01 00:00:00'
  AND purchase_cost = 6680.00
  AND model_id = 151;

UPDATE phones
SET brand_id = 1,
    model_id = 33,
    color_id = 1,
    memory_id = 6
WHERE id = 8333
  AND serial_number = 'F2LVDC2FJCM0'
  AND model_id = 151
  AND color_id = 1
  AND memory_id = 6;

UPDATE invoice_sequences
SET current_sequence = 10
WHERE sequence_date = '20171001'
  AND type_suffix = 'XS'
  AND current_sequence = 11;

COMMIT;
